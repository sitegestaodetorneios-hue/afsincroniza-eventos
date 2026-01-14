import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

function supabaseAnon() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url || !key) throw new Error('Env ausente')
  return createClient(url, key, { auth: { persistSession: false } })
}

function json(data, init = {}) {
  const res = NextResponse.json(data, init)
  res.headers.set('Cache-Control', 'no-store')
  return res
}

export async function GET(request) {
  const { searchParams } = new URL(request.url)
  const etapaIdParam = searchParams.get('etapa_id')

  let supabase
  try {
    supabase = supabaseAnon()
  } catch (e) {
    return json({ error: e.message }, { status: 500 })
  }

  // etapa atual (mesma lógica do /api/tabela)
  let etapa = null
  if (etapaIdParam) {
    const { data, error } = await supabase.from('etapas').select('*').eq('id', Number(etapaIdParam)).single()
    if (error) return json({ error: error.message }, { status: 500 })
    etapa = data
  } else {
    const { data, error } = await supabase.from('etapas').select('*').order('created_at', { ascending: false }).limit(1)
    if (error) return json({ error: error.message }, { status: 500 })
    etapa = data?.[0] || null
  }

  if (!etapa) return json({ etapa: null, jogos: [] })

  // jogos + nomes
  const { data: jogos, error } = await supabase
    .from('jogos')
    .select(`
      id, etapa_id, rodada, data_jogo, hora_jogo, start_at, equipe_a_id, equipe_b_id, gols_a, gols_b, finalizado,
      equipeA:equipes!jogos_equipe_a_id_fkey(id, nome_equipe),
      equipeB:equipes!jogos_equipe_b_id_fkey(id, nome_equipe)
    `)
    .eq('etapa_id', etapa.id)
    .order('rodada', { ascending: true })
    .order('id', { ascending: true })

  if (error) {
    // fallback sem hora/start_at se não existir coluna
    const { data: jogos2, error: e2 } = await supabase
      .from('jogos')
      .select(`
        id, etapa_id, rodada, data_jogo, equipe_a_id, equipe_b_id, gols_a, gols_b, finalizado,
        equipeA:equipes!jogos_equipe_a_id_fkey(id, nome_equipe),
        equipeB:equipes!jogos_equipe_b_id_fkey(id, nome_equipe)
      `)
      .eq('etapa_id', etapa.id)
      .order('rodada', { ascending: true })
      .order('id', { ascending: true })

    if (e2) return json({ error: e2.message }, { status: 500 })
    return json({ etapa, jogos: jogos2 || [] })
  }

  return json({ etapa, jogos: jogos || [] })
}
