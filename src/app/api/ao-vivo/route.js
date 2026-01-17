import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

// ⚠️ REMOVEMOS 'force-dynamic' e 'revalidate' para permitir o Cache Manual

function supabaseAnon() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url || !key) throw new Error('Env ausente')
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

  // 1) ETAPA
  let etapa = null
  if (etapaIdParam) {
    const { data } = await supabase.from('etapas').select('*').eq('id', Number(etapaIdParam)).single()
    etapa = data
  } else {
    let { data: active } = await supabase.from('etapas').select('*').eq('status', 'EM_ANDAMENTO').limit(1)
    if (active && active.length > 0) {
        etapa = active[0]
    } else {
        const { data: last } = await supabase.from('etapas').select('*').order('created_at', { ascending: false }).limit(1)
        etapa = last?.[0] || null
    }
  }

  if (!etapa) {
    return NextResponse.json({ etapa: null, jogos: [], eventos: [] })
  }

  // 2) JOGOS
  const { data: jogos, error: errJogos } = await supabase
    .from('jogos')
    .select('*') 
    .eq('etapa_id', etapa.id)
    .order('id', { ascending: true })

  if (errJogos) return NextResponse.json({ error: errJogos.message }, { status: 500 })

  const jogoIds = (jogos || []).map(j => j.id)
  const equipeIds = Array.from(
    new Set((jogos || []).flatMap(j => [j.equipe_a_id, j.equipe_b_id]))
  )

  // 3) EQUIPES
  const { data: equipes, error: errEq } = await supabase
    .from('equipes')
    .select('id, nome_equipe, logo_url') // Adicionei logo_url por garantia
    .in('id', equipeIds)

  if (errEq) return NextResponse.json({ error: errEq.message }, { status: 500 })

  // 4) EVENTOS
  let eventos = []
  if (jogoIds.length) {
    const { data: ev, error: errEv } = await supabase
      .from('jogo_eventos')
      .select('id, jogo_id, equipe_id, atleta_id, tipo, minuto, tempo, camisa_no_jogo, observacao, created_at')
      .in('jogo_id', jogoIds)
      .order('created_at', { ascending: false })

    if (errEv) return NextResponse.json({ error: errEv.message }, { status: 500 })
    eventos = ev || []
  }

  // 5) ATLETAS
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

  // ✅ AQUI ESTÁ A MÁGICA DO CACHE
  return NextResponse.json({
    etapa,
    jogos: jogos || [],
    equipes: equipes || [],
    atletas,
    eventos,
    now: new Date().toISOString(),
  }, {
    status: 200,
    headers: {
      // s-maxage=30: A Vercel guarda por 30 segundos (HIT)
      // stale-while-revalidate=59: Permite atualização em segundo plano
      'Cache-Control': 'public, s-maxage=30, stale-while-revalidate=59',
    }
  })
}