import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

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

  try {
    // 1) ETAPA - Alterado .single() para .limit(1) para evitar Erro 500 se não encontrar
    let etapa = null
    if (etapaIdParam) {
      const { data } = await supabase.from('etapas').select('*').eq('id', Number(etapaIdParam)).limit(1)
      etapa = data?.[0] || null
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
      return NextResponse.json({ etapa: null, jogos: [], eventos: [] }, {
        status: 200, 
        headers: { 'Cache-Control': 'public, s-maxage=30, stale-while-revalidate=59' }
      })
    }

    // 2) JOGOS
    const { data: jogos, error: errJogos } = await supabase
      .from('jogos')
      .select('*') 
      .eq('etapa_id', etapa.id)
      .order('id', { ascending: true })

    if (errJogos) throw errJogos

    // 3) EQUIPES - Proteção contra array vazio
    const equipeIds = Array.from(
      new Set((jogos || []).flatMap(j => [j.equipe_a_id, j.equipe_b_id]).filter(Boolean))
    )

    let equipes = []
    if (equipeIds.length > 0) {
        const { data: eq, error: errEq } = await supabase
            .from('equipes')
            .select('id, nome_equipe, escudo_url')
            .in('id', equipeIds)
        if (errEq) throw errEq
        equipes = eq || []
    }

    // 4) EVENTOS
    const jogoIds = (jogos || []).map(j => j.id)
    let eventos = []
    if (jogoIds.length > 0) {
      const { data: ev, error: errEv } = await supabase
        .from('jogo_eventos')
        .select('id, jogo_id, equipe_id, atleta_id, tipo, minuto, tempo, camisa_no_jogo, observacao, created_at')
        .in('jogo_id', jogoIds)
        .order('created_at', { ascending: false })

      if (errEv) throw errEv
      eventos = ev || []
    }

    // 5) ATLETAS
    const atletaIds = Array.from(new Set(eventos.map(e => e.atleta_id).filter(Boolean)))
    let atletas = []
    if (atletaIds.length > 0) {
      const { data: at, error: errAt } = await supabase
        .from('atletas')
        .select('id, nome, numero_camisa, equipe_id')
        .in('id', atletaIds)

      if (errAt) throw errAt
      atletas = at || []
    }

    // ✅ RESPOSTA COM CACHE ATIVADO
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
        'Cache-Control': 'public, s-maxage=30, stale-while-revalidate=59',
      }
    })

  } catch (error) {
    console.error("Erro na API ao-vivo:", error)
    return NextResponse.json({ error: "Erro interno" }, { status: 500 })
  }
}