import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

// ✅ precisa ser dinâmico pra respeitar ?etapa_id=
export const dynamic = 'force-dynamic'

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
    // 1) MENU (sempre)
    const { data: etapas, error: errEtapas } = await supabase
      .from('etapas')
      .select('*')
      .order('created_at', { ascending: false })

    if (errEtapas) {
      return NextResponse.json({ error: errEtapas.message }, { status: 500 })
    }

    // 2) ETAPA ATIVA/SELECIONADA
    let etapaAtiva = null

    if (etapaIdParam) {
      const { data, error } = await supabase
        .from('etapas')
        .select('*')
        .eq('id', Number(etapaIdParam))
        .limit(1)

      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
      etapaAtiva = data?.[0] || null
    } else {
      let { data: active, error: errActive } = await supabase
        .from('etapas')
        .select('*')
        .eq('status', 'EM_ANDAMENTO')
        .limit(1)

      if (errActive) return NextResponse.json({ error: errActive.message }, { status: 500 })

      if (active && active.length > 0) {
        etapaAtiva = active[0]
      } else {
        etapaAtiva = (etapas || [])[0] || null
      }
    }

    if (!etapaAtiva) {
      return NextResponse.json(
        { menu: etapas || [], etapa: null, classificacao: [], finais: [], artilharia: [], defesa: [], now: new Date().toISOString() },
        { status: 200, headers: { 'Cache-Control': 'public, s-maxage=30, stale-while-revalidate=59' } }
      )
    }

    const id = etapaAtiva.id

    // 3) TIMES NA ETAPA + JOGOS
    const [timesRes, jogosRes] = await Promise.all([
      supabase
        .from('etapa_equipes')
        .select('equipe_id, grupo, equipes(nome_equipe)')
        .eq('etapa_id', id),
      supabase
        .from('jogos')
        .select('*')
        .eq('etapa_id', id)
        .order('id', { ascending: true }),
    ])

    if (timesRes.error) return NextResponse.json({ error: timesRes.error.message }, { status: 500 })
    if (jogosRes.error) return NextResponse.json({ error: jogosRes.error.message }, { status: 500 })

    const jogosDaEtapa = jogosRes.data || []
    const jogoIds = jogosDaEtapa.map(j => j.id).filter(Boolean)

    // 4) EVENTOS (somente desta etapa)
    const [cartoesRes, artilhariaRes] = await Promise.all([
      jogoIds.length
        ? supabase
            .from('jogo_eventos')
            .select('*')
            .in('jogo_id', jogoIds)
            .in('tipo', ['AMARELO', 'VERMELHO'])
        : Promise.resolve({ data: [], error: null }),
      jogoIds.length
        ? supabase
            .from('jogo_eventos')
            .select('atleta_id, tipo, equipes(nome_equipe), atletas(nome), jogo_id')
            .in('jogo_id', jogoIds)
            .eq('tipo', 'GOL')
        : Promise.resolve({ data: [], error: null }),
    ])

    if (cartoesRes.error) return NextResponse.json({ error: cartoesRes.error.message }, { status: 500 })
    if (artilhariaRes.error) return NextResponse.json({ error: artilhariaRes.error.message }, { status: 500 })

    // 5) STATS
    const stats = {}
    timesRes.data?.forEach(t => {
      const grp = (t.grupo || 'U').trim().toUpperCase().replace('GRUPO', '').trim() || 'U'
      stats[t.equipe_id] = {
        equipe_id: t.equipe_id,
        nome_equipe: t.equipes?.nome_equipe || 'Time',
        grupo: grp,
        pts: 0, v: 0, e: 0, d: 0, j: 0, sg: 0, gp: 0, gc: 0,
        ca: 0, cv: 0,
      }
    })

    // tabela (só jogos de grupo com placar)
    jogosDaEtapa
      .filter(j => j.tipo_jogo === 'GRUPO')
      .forEach(j => {
        if (j.gols_a !== null && j.gols_b !== null) {
          const tA = j.equipe_a_id
          const tB = j.equipe_b_id
          const gA = Number(j.gols_a)
          const gB = Number(j.gols_b)

          if (stats[tA] && stats[tB]) {
            stats[tA].j++; stats[tB].j++
            stats[tA].gp += gA; stats[tA].gc += gB; stats[tA].sg += (gA - gB)
            stats[tB].gp += gB; stats[tB].gc += gA; stats[tB].sg += (gB - gA)

            if (gA > gB) { stats[tA].v++; stats[tA].pts += 3; stats[tB].d++ }
            else if (gB > gA) { stats[tB].v++; stats[tB].pts += 3; stats[tA].d++ }
            else { stats[tA].e++; stats[tA].pts += 1; stats[tB].e++; stats[tB].pts += 1 }
          }
        }
      })

    // cartões
    cartoesRes.data?.forEach(ev => {
      const equipeId = ev.equipe_id
      if (!equipeId || !stats[equipeId]) return
      if (ev.tipo === 'AMARELO') stats[equipeId].ca++
      if (ev.tipo === 'VERMELHO') stats[equipeId].cv++
    })

    let classificacao = Object.values(stats)

    const regrasSalvas = etapaAtiva.regras?.criterios
    const criterios = (regrasSalvas && regrasSalvas.length > 0)
      ? regrasSalvas
      : ['PONTOS', 'VITORIAS', 'SALDO', 'GOLS_PRO', 'VERMELHOS', 'AMARELOS']

    classificacao.sort((a, b) => {
      if (a.grupo < b.grupo) return -1
      if (a.grupo > b.grupo) return 1
      for (let crit of criterios) {
        if (crit === 'PONTOS' && b.pts !== a.pts) return b.pts - a.pts
        if (crit === 'VITORIAS' && b.v !== a.v) return b.v - a.v
        if (crit === 'SALDO' && b.sg !== a.sg) return b.sg - a.sg
        if (crit === 'GOLS_PRO' && b.gp !== a.gp) return b.gp - a.gp
        if (crit === 'GOLS_CONTRA' && a.gc !== b.gc) return a.gc - b.gc
        if (crit === 'VERMELHOS' && a.cv !== b.cv) return a.cv - b.cv
        if (crit === 'AMARELOS' && a.ca !== b.ca) return a.ca - b.ca
      }
      return 0
    })

    // artilharia
    const artilhariaMap = {}
    artilhariaRes.data?.forEach(g => {
      if (!g.atleta_id) return
      if (!artilhariaMap[g.atleta_id]) {
        artilhariaMap[g.atleta_id] = {
          nome: g.atletas?.nome || 'Atleta',
          equipe: g.equipes?.nome_equipe || 'Equipe',
          gols: 0,
        }
      }
      artilhariaMap[g.atleta_id].gols++
    })

    const corpo = {
      menu: etapas || [],
      etapa: etapaAtiva,
      selected_etapa_id: etapaAtiva.id,
      classificacao,
      finais: jogosDaEtapa
        .filter(j => j.tipo_jogo !== 'GRUPO')
        .map(j => ({
          ...j,
          equipeA: { nome_equipe: stats[j.equipe_a_id]?.nome_equipe || j.origem_a || 'A definir' },
          equipeB: { nome_equipe: stats[j.equipe_b_id]?.nome_equipe || j.origem_b || 'A definir' },
        })),
      artilharia: Object.values(artilhariaMap).sort((a, b) => b.gols - a.gols).slice(0, 10),
      defesa: classificacao.filter(t => t.j > 0).sort((a, b) => (a.gc / a.j) - (b.gc / b.j)).slice(0, 5),
      now: new Date().toISOString(),
    }

    // ✅ CACHE IGUAL AO AO-VIVO (funciona na Vercel)
    return NextResponse.json(corpo, {
      status: 200,
      headers: {
        'Cache-Control': 'public, s-maxage=30, stale-while-revalidate=59',
      }
    })
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
