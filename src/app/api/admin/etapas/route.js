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
 * Mantém: garantir apenas uma etapa "EM_ANDAMENTO"
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

    // Se a nova etapa for AO VIVO, encerra as outras para não confundir o site
    if (payload.status === 'EM_ANDAMENTO') {
      // ⚠️ Mantive "ENCERRADA" igual seu código anterior (não muda dado antigo)
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
 * PUT: suporta 2 modos:
 * 1) Atualizar status da etapa: { id (ou etapa_id), status }  ✅ (action opcional)
 * 2) Gerenciar equipes: { action: add_team/remove_team, etapa_id, equipe_id }
 */
export async function PUT(request) {
  if (!isAuthorized(request)) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  try {
    const supabase = supabaseAdmin()
    const body = await request.json()
    const actionRaw = body?.action
    const action = (actionRaw || '').toString()

    // ✅ MODO 1: atualizar status (aceita sem action para não dar erro)
    const idStatus = body?.id ?? body?.etapa_id
    const status = (body?.status || '').toString().toUpperCase().trim()

    const isUpdateStatus =
      action === 'update_status' ||
      (idStatus && status && !body?.equipe_id) // se vier id+status e não tiver equipe_id, assume status

    if (isUpdateStatus) {
      if (!idStatus || !status) {
        return NextResponse.json(
          { error: 'Campos obrigatórios para status: id (ou etapa_id) e status' },
          { status: 400 }
        )
      }

      // Se colocar EM_ANDAMENTO, encerra as outras (mesma regra do POST)
      if (status === 'EM_ANDAMENTO') {
        await supabase
          .from('etapas')
          .update({ status: 'ENCERRADA' })
          .neq('id', Number(idStatus))
      }

      const { data, error } = await supabase
        .from('etapas')
        .update({ status })
        .eq('id', Number(idStatus))
        .select()
        .limit(1)

      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
      return NextResponse.json({ ok: true, etapa: data?.[0] || null })
    }

    // ✅ MODO 2: manter seu PUT antigo (equipes)
    const { etapa_id, equipe_id } = body || {}
    if (!action || !etapa_id || !equipe_id) {
      return NextResponse.json({ error: 'Campos obrigatórios: action, etapa_id, equipe_id' }, { status: 400 })
    }

    if (action === 'add_team') {
      const { error } = await supabase.from('etapa_equipes').insert([{ etapa_id, equipe_id }])
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

/**
 * DELETE: Apaga etapa
 */
export async function DELETE(request) {
  if (!isAuthorized(request)) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const id = searchParams.get('id')

  if (!id) return NextResponse.json({ error: 'ID necessário' }, { status: 400 })

  try {
    const supabase = supabaseAdmin()

    await supabase.from('jogos').delete().eq('etapa_id', id)
    await supabase.from('etapa_equipes').delete().eq('etapa_id', id)

    const { error } = await supabase.from('etapas').delete().eq('id', id)

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ success: true })
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
