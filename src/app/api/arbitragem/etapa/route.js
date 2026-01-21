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

export async function GET(req) {
  try {
    const { sbAdmin, staff } = await requireStaff(req)
    const { searchParams } = new URL(req.url)
    const etapa_id = Number(searchParams.get('etapa_id') || 0)
    if (!etapa_id) return NextResponse.json({ error: 'etapa_id obrigatório' }, { status: 400 })

    const allowed = Array.isArray(staff.etapas_permitidas) ? staff.etapas_permitidas.map(Number) : []
    if (!allowed.includes(etapa_id)) return NextResponse.json({ error: 'Etapa não liberada' }, { status: 403 })

    const { data: etapaData, error: eErr } = await sbAdmin
      .from('etapas')
      .select('id,titulo,regras')
      .eq('id', etapa_id)
      .single()
    if (eErr) throw eErr

    const { data: timesData, error: tErr } = await sbAdmin
      .from('etapa_equipes')
      .select('*, equipes(*)')
      .eq('etapa_id', etapa_id)
    if (tErr) throw tErr

    const listaTimes = (timesData || []).map(t => {
      const eq = t.equipes || {}
      return {
        ...eq,
        grupo: t.grupo,
        escudo_url: eq.escudo_url || eq.logo_url || eq.escudo || eq.logo || null
      }
    })

    const mapaTimes = {}
    listaTimes.forEach(t => { mapaTimes[t.id] = t })

    const { data: jogosCrus, error: jErr } = await sbAdmin
      .from('jogos')
      .select('*')
      .eq('etapa_id', etapa_id)
      .order('rodada', { ascending: true })
      .order('id', { ascending: true })
    if (jErr) throw jErr

    const jogos = (jogosCrus || []).map(j => ({
      ...j,
      equipeA: j.equipe_a_id ? mapaTimes[j.equipe_a_id] : null,
      equipeB: j.equipe_b_id ? mapaTimes[j.equipe_b_id] : null
    }))

    return NextResponse.json({
      etapa: etapaData,
      jogos,
      times: listaTimes
    })
  } catch (e) {
    const code = e.message || ''
    const status =
      code === 'NO_TOKEN' || code === 'BAD_TOKEN' ? 401 :
      code === 'NOT_STAFF' || code === 'INACTIVE' ? 403 : 500
    return NextResponse.json({ error: code }, { status })
  }
}
