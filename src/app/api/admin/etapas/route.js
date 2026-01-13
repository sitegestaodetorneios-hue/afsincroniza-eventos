import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

function isAuthorized(request) {
  const pin = request.headers.get('x-admin-pin') || ''
  return pin && pin === (process.env.ADMIN_PIN || '2026')
}

function supabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new Error('Env ausente: NEXT_PUBLIC_SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY')
  return createClient(url, key, { auth: { persistSession: false } })
}

export async function GET(request) {
  if (!isAuthorized(request)) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  try {
    const supabase = supabaseAdmin()
    const { data, error } = await supabase
      .from('etapas')
      .select('*')
      .order('created_at', { ascending: false })

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json(data || [])
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

/**
 * POST: cria etapa
 * body: { modalidade, titulo, tipo, status, data_inicio, local }
 */
export async function POST(request) {
  if (!isAuthorized(request)) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  try {
    const supabase = supabaseAdmin()
    const body = await request.json()

    const payload = {
      modalidade: (body.modalidade || 'FUTSAL').toUpperCase(),
      titulo: body.titulo || 'Liga - 6 times (todos contra todos)',
      tipo: (body.tipo || 'LIGA').toUpperCase(),
      status: (body.status || 'EM_ANDAMENTO').toUpperCase(),
      data_inicio: body.data_inicio || null,
      local: body.local || null,
    }

    const { data, error } = await supabase
      .from('etapas')
      .insert([payload])
      .select()
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true, etapa: data })
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

/**
 * PUT: gerencia equipes na etapa
 * body:
 *  { action: 'add_team', etapa_id, equipe_id }
 *  { action: 'remove_team', etapa_id, equipe_id }
 */
export async function PUT(request) {
  if (!isAuthorized(request)) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  try {
    const supabase = supabaseAdmin()
    const body = await request.json()
    const { action, etapa_id, equipe_id } = body || {}

    if (!action || !etapa_id || !equipe_id) {
      return NextResponse.json({ error: 'Campos obrigatórios: action, etapa_id, equipe_id' }, { status: 400 })
    }

    if (action === 'add_team') {
      const { error } = await supabase
        .from('etapa_equipes')
        .insert([{ etapa_id, equipe_id }])

      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
      return NextResponse.json({ ok: true })
    }

    if (action === 'remove_team') {
      const { error } = await supabase
        .from('etapa_equipes')
        .delete()
        .eq('etapa_id', etapa_id)
        .eq('equipe_id', equipe_id)

      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
      return NextResponse.json({ ok: true })
    }

    return NextResponse.json({ error: 'Ação inválida' }, { status: 400 })
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
