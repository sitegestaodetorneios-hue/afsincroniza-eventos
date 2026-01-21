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

async function isLocked(sbAdmin, etapa_id, jogo_id) {
  // ✅ trava se tiver assinatura de ARBITRO e MESARIO
  const { data, error } = await sbAdmin
    .from('sumula_assinaturas')
    .select('role')
    .eq('etapa_id', Number(etapa_id))
    .eq('jogo_id', Number(jogo_id))

  if (error) return false
  const roles = (data || []).map(r => String(r.role).toUpperCase())
  return roles.includes('ARBITRO') && roles.includes('MESARIO')
}

async function requireEtapaAllowed(sbAdmin, staff, jogo_id) {
  const { data: jogo, error: jErr } = await sbAdmin
    .from('jogos')
    .select('id, etapa_id, equipe_a_id, equipe_b_id')
    .eq('id', Number(jogo_id))
    .single()

  if (jErr || !jogo) throw new Error('JOGO_NOT_FOUND')

  const allowed = Array.isArray(staff.etapas_permitidas)
    ? staff.etapas_permitidas.map(Number).filter(Boolean)
    : []

  if (!allowed.includes(Number(jogo.etapa_id))) throw new Error('ETAPA_NOT_ALLOWED')

  return jogo
}

async function audit(sbAdmin, staff, userId, jogo, action, meta = {}) {
  // best-effort (não derruba fluxo se tabela não existir/RLS)
  try {
    await sbAdmin.from('sumula_audit').insert({
      etapa_id: Number(jogo.etapa_id),
      jogo_id: Number(jogo.id),
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

    const jogo = await requireEtapaAllowed(sbAdmin, staff, jogo_id)

    const { data, error } = await sbAdmin
      .from('jogo_eventos')
      .select('*')
      .eq('jogo_id', jogo_id)
      .order('created_at', { ascending: true })

    if (error) throw error

    // opcional: log de leitura (se não quiser logar GET, pode remover)
    await audit(sbAdmin, staff, user.id, jogo, 'GET_EVENTOS', { total: (data || []).length })

    return NextResponse.json(data || [])
  } catch (e) {
    const code = e.message || ''
    const status =
      code === 'NO_TOKEN' || code === 'BAD_TOKEN' ? 401 :
      code === 'ETAPA_NOT_ALLOWED' ? 403 :
      code === 'JOGO_NOT_FOUND' ? 404 :
      500

    return NextResponse.json({ error: code }, { status })
  }
}

export async function POST(req) {
  try {
    const { sbAdmin, staff, user } = await requireStaff(req)
    const body = await req.json()

    const jogo_id = Number(body.jogo_id || 0)
    const equipe_id = Number(body.equipe_id || 0)

    if (!jogo_id || !equipe_id || !body.tipo) {
      return NextResponse.json({ error: 'jogo_id, equipe_id e tipo obrigatórios' }, { status: 400 })
    }

    const jogo = await requireEtapaAllowed(sbAdmin, staff, jogo_id)

    // ✅ trava se súmula já assinada por árbitro+mesário
    const locked = await isLocked(sbAdmin, jogo.etapa_id, jogo.id)
    if (locked) return NextResponse.json({ error: 'SUMULA_ASSINADA_BLOQUEADA' }, { status: 409 })

    // ✅ valida se equipe_id pertence ao jogo
    const equipeOk =
      Number(equipe_id) === Number(jogo.equipe_a_id) ||
      Number(equipe_id) === Number(jogo.equipe_b_id)

    if (!equipeOk) {
      return NextResponse.json({ error: 'EQUIPE_INVALIDA_PARA_O_JOGO' }, { status: 400 })
    }

    const payload = {
      jogo_id,
      equipe_id,
      atleta_id: body.atleta_id ? Number(body.atleta_id) : null,
      tipo: String(body.tipo).toUpperCase(),
      minuto: body.minuto ? String(body.minuto) : null,
      tempo: body.tempo ? String(body.tempo) : null, // ✅ 1T/2T
      observacao: body.observacao ? String(body.observacao) : null,
      camisa_no_jogo: body.camisa_no_jogo ? String(body.camisa_no_jogo) : null
    }

    const { data: inserted, error } = await sbAdmin
      .from('jogo_eventos')
      .insert(payload)
      .select('*')
      .single()

    if (error) throw error

    await audit(sbAdmin, staff, user.id, jogo, 'ADD_EVENTO', inserted || payload)

    return NextResponse.json({ ok: true, evento: inserted || null })
  } catch (e) {
    const code = e.message || ''
    const status =
      code === 'NO_TOKEN' || code === 'BAD_TOKEN' ? 401 :
      code === 'ETAPA_NOT_ALLOWED' ? 403 :
      code === 'JOGO_NOT_FOUND' ? 404 :
      500

    return NextResponse.json({ error: code }, { status })
  }
}

export async function DELETE(req) {
  try {
    const { sbAdmin, staff, user } = await requireStaff(req)
    const { searchParams } = new URL(req.url)
    const id = Number(searchParams.get('id') || 0)
    if (!id) return NextResponse.json({ error: 'id obrigatório' }, { status: 400 })

    // 1) pega evento (pra saber jogo_id)
    const { data: ev, error: evErr } = await sbAdmin
      .from('jogo_eventos')
      .select('*')
      .eq('id', id)
      .single()

    if (evErr || !ev) return NextResponse.json({ error: 'EVENTO_NOT_FOUND' }, { status: 404 })

    // 2) valida etapa liberada
    const jogo = await requireEtapaAllowed(sbAdmin, staff, Number(ev.jogo_id))

    // 3) trava se assinada
    const locked = await isLocked(sbAdmin, jogo.etapa_id, jogo.id)
    if (locked) return NextResponse.json({ error: 'SUMULA_ASSINADA_BLOQUEADA' }, { status: 409 })

    // 4) apaga
    const { error } = await sbAdmin.from('jogo_eventos').delete().eq('id', id)
    if (error) throw error

    await audit(sbAdmin, staff, user.id, jogo, 'DEL_EVENTO', { ...ev })

    return NextResponse.json({ ok: true })
  } catch (e) {
    const code = e.message || ''
    const status =
      code === 'NO_TOKEN' || code === 'BAD_TOKEN' ? 401 :
      code === 'ETAPA_NOT_ALLOWED' ? 403 :
      code === 'JOGO_NOT_FOUND' ? 404 :
      500

    return NextResponse.json({ error: code }, { status })
  }
}
