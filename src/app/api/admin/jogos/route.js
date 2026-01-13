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

/**
 * GET: lista jogos de uma etapa (com nomes das equipes)
 * query: ?etapa_id=1
 */
export async function GET(request) {
  if (!isAuthorized(request)) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const etapa_id = Number(searchParams.get('etapa_id') || 0)
  if (!etapa_id) return NextResponse.json({ error: 'etapa_id obrigatório' }, { status: 400 })

  try {
    const supabase = supabaseAdmin()

    const { data, error } = await supabase
      .from('jogos')
      .select(`
        id, etapa_id, rodada, data_jogo, hora_inicio, hora_fim, equipe_a_id, equipe_b_id, gols_a, gols_b, finalizado, created_at,
        equipeA:equipes!jogos_equipe_a_id_fkey(id, nome_equipe),
        equipeB:equipes!jogos_equipe_b_id_fkey(id, nome_equipe)
      `)
      .eq('etapa_id', etapa_id)
      .order('rodada', { ascending: true })
      .order('hora_inicio', { ascending: true, nullsFirst: true })
      .order('id', { ascending: true })

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json(data || [])
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

/**
 * POST: cria jogo
 * body: { etapa_id, rodada, data_jogo, equipe_a_id, equipe_b_id }
 */
export async function POST(request) {
  if (!isAuthorized(request)) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  try {
    const supabase = supabaseAdmin()
    const body = await request.json()

    const payload = {
      etapa_id: body.etapa_id,
      rodada: body.rodada ?? null,
      data_jogo: body.data_jogo || null,
      hora_inicio: body.hora_inicio || null, // opcional (se quiser criar já com hora)
      hora_fim: body.hora_fim || null,       // opcional
      equipe_a_id: body.equipe_a_id,
      equipe_b_id: body.equipe_b_id,
      gols_a: null,
      gols_b: null,
      finalizado: false,
    }

    if (!payload.etapa_id || !payload.equipe_a_id || !payload.equipe_b_id) {
      return NextResponse.json({ error: 'Campos obrigatórios: etapa_id, equipe_a_id, equipe_b_id' }, { status: 400 })
    }
    if (payload.equipe_a_id === payload.equipe_b_id) {
      return NextResponse.json({ error: 'Times devem ser diferentes' }, { status: 400 })
    }

    const { data, error } = await supabase
      .from('jogos')
      .insert([payload])
      .select()
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true, jogo: data })
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

/**
 * PUT: lança placar / finaliza jogo
 * body:
 *  { action:'set_score', id, gols_a, gols_b }
 *  { action:'finalize', id, finalizado:true/false }
 */
export async function PUT(request) {
  if (!isAuthorized(request)) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  try {
    const supabase = supabaseAdmin()
    const body = await request.json()
    const { action, id } = body || {}

    if (!action || !id) return NextResponse.json({ error: 'Campos obrigatórios: action, id' }, { status: 400 })

    if (action === 'set_score') {
      const gols_a = Number(body.gols_a)
      const gols_b = Number(body.gols_b)
      if (!Number.isFinite(gols_a) || !Number.isFinite(gols_b) || gols_a < 0 || gols_b < 0) {
        return NextResponse.json({ error: 'Placar inválido' }, { status: 400 })
      }

      const { error } = await supabase
        .from('jogos')
        .update({ gols_a, gols_b })
        .eq('id', id)

      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
      return NextResponse.json({ ok: true })
    }

    if (action === 'finalize') {
      const finalizado = Boolean(body.finalizado)
      const { error } = await supabase
        .from('jogos')
        .update({ finalizado })
        .eq('id', id)

      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
      return NextResponse.json({ ok: true })
    }

    return NextResponse.json({ error: 'Ação inválida' }, { status: 400 })
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
