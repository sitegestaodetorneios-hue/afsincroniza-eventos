import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

function supabaseAnon() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url || !key) throw new Error('Env ausente: NEXT_PUBLIC_SUPABASE_URL ou NEXT_PUBLIC_SUPABASE_ANON_KEY')
  return createClient(url, key, { auth: { persistSession: false } })
}

export async function GET(request) {
  const { searchParams } = new URL(request.url)
  const etapaIdParam = searchParams.get('etapa_id')

  let supabase
  try {
    supabase = supabaseAnon()
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }

  // 1) define etapa
  let etapa = null
  if (etapaIdParam) {
    const { data, error } = await supabase.from('etapas').select('*').eq('id', Number(etapaIdParam)).single()
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    etapa = data
  } else {
    // pega a mais recente em andamento (ou última)
    const { data, error } = await supabase
      .from('etapas')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(1)

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    etapa = data?.[0] || null
  }

  if (!etapa) {
    return NextResponse.json({ etapa: null, jogos: [], eventos: [] })
  }

  // 2) jogos da etapa (placar vem de jogos.gols_a/gols_b — atualizado pelo trigger quando lança GOL)
  const { data: jogos, error: errJogos } = await supabase
    .from('jogos')
    .select('id, etapa_id, rodada, data_jogo, equipe_a_id, equipe_b_id, gols_a, gols_b, finalizado, created_at')
    .eq('etapa_id', etapa.id)
    .order('rodada', { ascending: true })
    .order('id', { ascending: true })

  if (errJogos) return NextResponse.json({ error: errJogos.message }, { status: 500 })

  const jogoIds = (jogos || []).map(j => j.id)
  const equipeIds = Array.from(
    new Set((jogos || []).flatMap(j => [j.equipe_a_id, j.equipe_b_id]))
  )

  // 3) nomes das equipes
  const { data: equipes, error: errEq } = await supabase
    .from('equipes')
    .select('id, nome_equipe')
    .in('id', equipeIds)

  if (errEq) return NextResponse.json({ error: errEq.message }, { status: 500 })

  // 4) eventos dos jogos (gols/cartões) com camisa_no_jogo
  let eventos = []
  if (jogoIds.length) {
    const { data: ev, error: errEv } = await supabase
      .from('jogo_eventos')
      .select('id, jogo_id, equipe_id, atleta_id, tipo, minuto, tempo, camisa_no_jogo, observacao, created_at')
      .in('jogo_id', jogoIds)
      .order('created_at', { ascending: true })

    if (errEv) return NextResponse.json({ error: errEv.message }, { status: 500 })
    eventos = ev || []
  }

  // 5) atletas usados nos eventos (pra mostrar nome + camisa cadastro)
  const atletaIds = Array.from(new Set(eventos.map(e => e.atleta_id).filter(Boolean)))
  let atletas = []
  if (atletaIds.length) {
    const { data: at, error: errAt } = await supabase
      .from('atletas')
      .select('id, nome, numero_camisa, equipe_id')
      .in('id', atletaIds)

    if (errAt) return NextResponse.json({ error: errAt.message }, { status: 500 })
    atletas = at || []
  }

  return NextResponse.json({
    etapa,
    jogos: jogos || [],
    equipes: equipes || [],
    atletas,
    eventos,
    now: new Date().toISOString(),
  })
}
