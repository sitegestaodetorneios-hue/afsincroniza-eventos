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

// GET: Lista todas as etapas
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
 * Adicionado: Lógica para garantir apenas uma etapa "EM_ANDAMENTO"
 */
export async function POST(request) {
  if (!isAuthorized(request)) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  try {
    const supabase = supabaseAdmin()
    const body = await request.json()

    const payload = {
      modalidade: (body.modalidade || 'FUTSAL').toUpperCase(),
      titulo: body.titulo || 'Nova Etapa',
      tipo: (body.tipo || 'LIGA').toUpperCase(),
      status: (body.status || 'EM_ANDAMENTO').toUpperCase(),
      data_inicio: body.data_inicio || null,
      local: body.local || null,
    }

    // MELHORIA: Se a nova etapa for AO VIVO, encerra as outras para não confundir o site
    if (payload.status === 'EM_ANDAMENTO') {
        await supabase.from('etapas').update({ status: 'ENCERRADA' }).neq('id', 0)
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
      const { error } = await supabase.from('etapa_equipes').insert([{ etapa_id, equipe_id }])
      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
      return NextResponse.json({ ok: true })
    }

    if (action === 'remove_team') {
      const { error } = await supabase.from('etapa_equipes').delete().eq('etapa_id', etapa_id).eq('equipe_id', equipe_id)
      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
      return NextResponse.json({ ok: true })
    }

    return NextResponse.json({ error: 'Ação inválida' }, { status: 400 })
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

/**
 * DELETE: Apaga etapa (NOVO)
 * Isso permite que o botão de lixeira no admin funcione
 */
export async function DELETE(request) {
    if (!isAuthorized(request)) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')
  
    if (!id) return NextResponse.json({ error: 'ID necessário' }, { status: 400 })
  
    try {
        const supabase = supabaseAdmin()
        
        // O banco (Postgres) deve estar configurado com CASCADE
        // Mas por segurança tentamos apagar vínculos primeiro se não tiver cascade
        await supabase.from('jogos').delete().eq('etapa_id', id)
        await supabase.from('etapa_equipes').delete().eq('etapa_id', id)

        const { error } = await supabase.from('etapas').delete().eq('id', id)
    
        if (error) return NextResponse.json({ error: error.message }, { status: 500 })
        return NextResponse.json({ success: true })
    } catch (e) {
        return NextResponse.json({ error: e.message }, { status: 500 })
    }
}