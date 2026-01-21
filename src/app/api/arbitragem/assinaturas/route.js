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
  // fallback legado
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
  const keys = Object.keys(reqMap || {})
  return keys.every(role => (counts[role] || 0) >= Number(reqMap[role] || 0))
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

export async function GET(req) {
  try {
    const { sbAdmin, staff, user } = await requireStaff(req)
    const { searchParams } = new URL(req.url)
    const jogo_id = Number(searchParams.get('jogo_id') || 0)
    if (!jogo_id) return NextResponse.json({ error: 'jogo_id obrigatório' }, { status: 400 })

    const { data: jogo, error: jErr } = await sbAdmin
      .from('jogos')
      .select('id, etapa_id, status')
      .eq('id', jogo_id)
      .single()
    if (jErr || !jogo) return NextResponse.json({ error: 'JOGO_NOT_FOUND' }, { status: 404 })

    const allowed = Array.isArray(staff.etapas_permitidas) ? staff.etapas_permitidas.map(Number) : []
    if (!allowed.includes(Number(jogo.etapa_id))) return NextResponse.json({ error: 'ETAPA_NOT_ALLOWED' }, { status: 403 })

    const regras = await getEtapaRegras(sbAdmin, jogo.etapa_id)
    const required = normalizeReqMap(regras)

    const { data: assinaturas, error } = await sbAdmin
      .from('sumula_assinaturas')
      .select('*')
      .eq('etapa_id', Number(jogo.etapa_id))
      .eq('jogo_id', Number(jogo.id))
      .order('role', { ascending: true })
      .order('role_slot', { ascending: true })
      .order('signed_at', { ascending: true })

    if (error) throw error

    const locked = await isLocked(sbAdmin, jogo.etapa_id, jogo.id, required)

    await audit(sbAdmin, staff, user.id, jogo.etapa_id, jogo.id, 'GET_ASSINATURAS', { locked })

    return NextResponse.json({
      required,
      locked,
      assinaturas: assinaturas || []
    })
  } catch (e) {
    const code = e.message || ''
    const status = (code === 'NO_TOKEN' || code === 'BAD_TOKEN') ? 401 : 500
    return NextResponse.json({ error: code }, { status })
  }
}

export async function POST(req) {
  try {
    const { sbAdmin, staff, user } = await requireStaff(req)
    const body = await req.json()

    const jogo_id = Number(body.jogo_id || 0)
    const signature_hash = String(body.signature_hash || '')
    const signed_at = body.signed_at ? String(body.signed_at) : new Date().toISOString()

    if (!jogo_id || !signature_hash) {
      return NextResponse.json({ error: 'jogo_id e signature_hash obrigatórios' }, { status: 400 })
    }

    const { data: jogo, error: jErr } = await sbAdmin
      .from('jogos')
      .select('*')
      .eq('id', jogo_id)
      .single()
    if (jErr || !jogo) return NextResponse.json({ error: 'JOGO_NOT_FOUND' }, { status: 404 })

    const allowed = Array.isArray(staff.etapas_permitidas) ? staff.etapas_permitidas.map(Number) : []
    if (!allowed.includes(Number(jogo.etapa_id))) return NextResponse.json({ error: 'ETAPA_NOT_ALLOWED' }, { status: 403 })

    if (String(jogo.status || '').toUpperCase() !== 'FINALIZADO') {
      return NextResponse.json({ error: 'JOGO_NAO_FINALIZADO' }, { status: 409 })
    }

    const regras = await getEtapaRegras(sbAdmin, jogo.etapa_id)
    const required = normalizeReqMap(regras)

    const role = String(staff.role || '').toUpperCase()
    if (!(role in required)) {
      return NextResponse.json({ error: 'ROLE_NAO_CONFIGURADA_NA_ETAPA' }, { status: 409 })
    }
    const need = Number(required[role] || 0)
    if (need <= 0) {
      return NextResponse.json({ error: 'ROLE_SEM_ASSINATURA_NA_ETAPA' }, { status: 409 })
    }

    // quantas assinaturas já existem nesse role
    const { data: existing } = await sbAdmin
      .from('sumula_assinaturas')
      .select('id, role_slot, user_id')
      .eq('etapa_id', Number(jogo.etapa_id))
      .eq('jogo_id', Number(jogo.id))
      .eq('role', role)

    // se esse user já assinou nesse role
    const already = (existing || []).some(x => String(x.user_id) === String(user.id))
    if (already) return NextResponse.json({ error: 'JA_ASSINOU' }, { status: 409 })

    if ((existing || []).length >= need) {
      return NextResponse.json({ error: 'LIMITE_DE_ASSINATURAS_ATINGIDO' }, { status: 409 })
    }

    // define slot livre (1..need)
    const used = new Set((existing || []).map(x => Number(x.role_slot)).filter(Boolean))
    let role_slot = 1
    for (let i = 1; i <= need; i++) {
      if (!used.has(i)) { role_slot = i; break }
    }

    const payload = {
      etapa_id: Number(jogo.etapa_id),
      jogo_id: Number(jogo.id),
      user_id: user.id,
      nome: staff.nome,
      role,
      role_slot,
      signed_at,
      signature_hash,
      cpf_last4: staff.cpf_last4 || null
    }

    const { error } = await sbAdmin.from('sumula_assinaturas').insert(payload)
    if (error) throw error

    const locked = await isLocked(sbAdmin, jogo.etapa_id, jogo.id, required)
    await audit(sbAdmin, staff, user.id, jogo.etapa_id, jogo.id, 'ASSINOU_SUMULA', { role, role_slot, locked })

    return NextResponse.json({ ok: true, role, role_slot, locked })
  } catch (e) {
    const code = e.message || ''
    const status = (code === 'NO_TOKEN' || code === 'BAD_TOKEN') ? 401 : 500
    return NextResponse.json({ error: code }, { status })
  }
}
