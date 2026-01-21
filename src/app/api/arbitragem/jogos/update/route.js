import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const runtime = 'nodejs'

function supabaseAnon() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    { auth: { persistSession: false } }
  )
}

function supabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { persistSession: false } }
  )
}

async function requireStaff(req) {
  const auth = req.headers.get('authorization') || ''
  const token = auth.toLowerCase().startsWith('bearer ') ? auth.slice(7) : ''
  if (!token) throw new Error('NO_TOKEN')

  const sbAnon = supabaseAnon()
  const { data: u, error: uErr } = await sbAnon.auth.getUser(token)
  if (uErr || !u?.user) throw new Error('BAD_TOKEN')

  const sbAdmin = supabaseAdmin()
  const { data: staff, error: sErr } = await sbAdmin
    .from('staff_profiles')
    .select('*')
    .eq('user_id', u.user.id)
    .single()

  if (sErr || !staff) throw new Error('NOT_STAFF')
  if (staff.ativo === false) throw new Error('INACTIVE')

  return { sbAdmin, staff, user: u.user }
}

function normalizeReqMap(regras) {
  const raw = regras?.sumula?.assinaturas_required
  if (raw && typeof raw === 'object') {
    const out = {}
    for (const [k, v] of Object.entries(raw)) {
      const key = String(k || '').toUpperCase()
      const n = Number(v)
      if (key && Number.isFinite(n) && n >= 0) out[key] = n
    }
    return out
  }
  return { ARBITRO: 1, MESARIO: 1 }
}

async function getEtapaRegras(sbAdmin, etapa_id) {
  const { data, error } = await sbAdmin
    .from('etapas')
    .select('regras')
    .eq('id', Number(etapa_id))
    .single()
  if (error) throw error
  return data?.regras || null
}

async function countRoles(sbAdmin, etapa_id, jogo_id) {
  const { data, error } = await sbAdmin
    .from('sumula_assinaturas')
    .select('role')
    .eq('etapa_id', Number(etapa_id))
    .eq('jogo_id', Number(jogo_id))
  if (error) throw error

  const counts = {}
  for (const r of (data || [])) {
    const role = String(r.role || '').toUpperCase()
    counts[role] = (counts[role] || 0) + 1
  }
  return counts
}

async function isLocked(sbAdmin, etapa_id, jogo_id, reqMap) {
  const counts = await countRoles(sbAdmin, etapa_id, jogo_id)
  return Object.keys(reqMap || {}).every(role => (counts[role] || 0) >= Number(reqMap[role] || 0))
}

async function audit(sbAdmin, staff, userId, etapa_id, jogo_id, action, meta = {}) {
  try {
    await sbAdmin.from('sumula_audit').insert({
      etapa_id: Number(etapa_id),
      jogo_id: Number(jogo_id),
      actor_user_id: userId,
      actor_nome: staff.nome,
      actor_role: staff.role,
      action,
      meta
    })
  } catch {}
}

export async function PATCH(req) {
  try {
    const { sbAdmin, staff, user } = await requireStaff(req)
    const body = await req.json()

    const jogo_id = Number(body.jogo_id || 0)
    if (!jogo_id) return NextResponse.json({ error: 'jogo_id obrigatório' }, { status: 400 })

    const { data: jogo, error: jErr } = await sbAdmin
      .from('jogos')
      .select('*')
      .eq('id', jogo_id)
      .single()
    if (jErr || !jogo) return NextResponse.json({ error: 'JOGO_NOT_FOUND' }, { status: 404 })

    const allowed = Array.isArray(staff.etapas_permitidas) ? staff.etapas_permitidas.map(Number) : []
    if (!allowed.includes(Number(jogo.etapa_id))) return NextResponse.json({ error: 'ETAPA_NOT_ALLOWED' }, { status: 403 })

    const regras = await getEtapaRegras(sbAdmin, jogo.etapa_id)
    const required = normalizeReqMap(regras)
    const locked = await isLocked(sbAdmin, jogo.etapa_id, jogo.id, required)
    if (locked) return NextResponse.json({ error: 'SUMULA_ASSINADA_BLOQUEADA' }, { status: 409 })

    const patch = {}

    if (body.action === 'set_score') {
      patch.gols_a = body.gols_a === '' || body.gols_a === null ? 0 : Number(body.gols_a)
      patch.gols_b = body.gols_b === '' || body.gols_b === null ? 0 : Number(body.gols_b)
      patch.penaltis_a = body.penaltis_a === '' ? null : (body.penaltis_a ?? null)
      patch.penaltis_b = body.penaltis_b === '' ? null : (body.penaltis_b ?? null)
    }

    if (body.action === 'set_status') {
      patch.status = String(body.status || '')
      if (body.gols_a !== undefined) patch.gols_a = body.gols_a === '' ? 0 : Number(body.gols_a)
      if (body.gols_b !== undefined) patch.gols_b = body.gols_b === '' ? 0 : Number(body.gols_b)
      if (body.penaltis_a !== undefined) patch.penaltis_a = body.penaltis_a
      if (body.penaltis_b !== undefined) patch.penaltis_b = body.penaltis_b
    }

    if (Object.keys(patch).length === 0) {
      return NextResponse.json({ error: 'action inválida' }, { status: 400 })
    }

    const { error: uErr } = await sbAdmin.from('jogos').update(patch).eq('id', jogo_id)
    if (uErr) throw uErr

    await audit(sbAdmin, staff, user.id, jogo.etapa_id, jogo.id, String(body.action || 'UPDATE_JOGO').toUpperCase(), patch)

    return NextResponse.json({ ok: true })
  } catch (e) {
    const code = e.message || ''
    const status = (code === 'NO_TOKEN' || code === 'BAD_TOKEN') ? 401 : 500
    return NextResponse.json({ error: code }, { status })
  }
}
