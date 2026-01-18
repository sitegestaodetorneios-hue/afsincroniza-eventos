import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'
import { unstable_cache } from 'next/cache'

// ✅ pode continuar dinâmico (usa querystring), mas vamos cachear manualmente
export const dynamic = 'force-dynamic'

function supabasePublic() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    { auth: { persistSession: false } }
  )
}

export async function GET(request) {
  const { searchParams } = new URL(request.url)
  const etapaIdParam = searchParams.get('etapa_id')

  // ✅ cache separado por URL param (id específico vs "auto")
  const cacheKey = etapaIdParam ? `id-${String(etapaIdParam)}` : 'auto'

  const getCached = unstable_cache(
    async () => {
      const supabase = supabasePublic()

      // 1) Menu (sempre)
      const { data: etapas, error: errEtapas } = await supabase
        .from('etapas')
        .select('*')
        .order('created_at', { ascending: false })

      if (errEtapas) {
        return { __error: errEtapas.message, __status: 500 }
      }

      // 2) Etapa escolhida
      let etapaAtiva = null

      if (etapaIdParam) {
        // busca por id
        const { data: etapaSel, error: errSel } = await supabase
          .from('etapas')
          .select('*')
          .eq('id', Number(etapaIdParam))
          .single()

        if (errSel) {
          return { __error: errSel.message, __status: 500 }
        }
        etapaAtiva = etapaSel
      } else {
        etapaAtiva =
          (etapas || []).find((e) => String(e.status).toUpperCase() === 'EM_ANDAMENTO') ||
          (etapas || [])[0] ||
          null
      }

      if (!etapaAtiva) {
        return {
          menu: etapas || [],
          etapa: null,
          __status: 200,
        }
      }

      const id = etapaAtiva.id

      // 3) Times + jogos
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

      if (timesRes.error) return { __error: timesRes.error.message, __status: 500 }
      if (jogosRes.error) return { __error: jogosRes.error.message, __status: 500 }

      const jogosDaEtapa = jogosRes.data || []
      const jogoIds = jogosDaEtapa.map((j) => j.id).filter(Boolean)

      // 4) Eventos da etapa
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

      if (cartoesRes.error) return { __error: cartoesRes.error.message, __status: 500 }
      if (artilhariaRes.error) return { __error: artilhariaRes.error.message, __status: 500 }

      // 5) Stats base
      const stats = {}
      timesRes.data?.forEach((t) => {
        const grp =
          (t.grupo || 'U').trim().toUpperCase().replace('GRUPO', '').trim() || 'U'
        stats[t.equipe_id] = {
          equipe_id: t.equipe_id,
          nome_equipe: t.equipes?.nome_equipe || 'Time',
          grupo: grp,
          pts: 0, v: 0, e: 0, d: 0, j: 0, sg: 0, gp: 0, gc: 0,
          ca: 0, cv: 0,
        }
      })

      // 6) Calcula tabela (apenas GRUPO)
      jogosDaEtapa
        .filter((j) => j.tipo_jogo === 'GRUPO')
        .forEach((j) => {
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

      // 7) cartões
      cartoesRes.data?.forEach((ev) => {
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

      // 8) artilharia
      const artilhariaMap = {}
      artilhariaRes.data?.forEach((g) => {
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

      return {
        menu: etapas || [],
        etapa: etapaAtiva,
        selected_etapa_id: etapaAtiva.id,
        classificacao,
        finais: jogosDaEtapa
          .filter((j) => j.tipo_jogo !== 'GRUPO')
          .map((j) => ({
            ...j,
            equipeA: { nome_equipe: stats[j.equipe_a_id]?.nome_equipe || j.origem_a || 'A definir' },
            equipeB: { nome_equipe: stats[j.equipe_b_id]?.nome_equipe || j.origem_b || 'A definir' },
          })),
        artilharia: Object.values(artilhariaMap).sort((a, b) => b.gols - a.gols).slice(0, 10),
        defesa: classificacao.filter((t) => t.j > 0).sort((a, b) => (a.gc / a.j) - (b.gc / b.j)).slice(0, 5),
        now: new Date().toISOString(),
        __status: 200,
      }
    },
    // ✅ chave do cache (muda se mudar o etapa_id)
    ['tabela-api', cacheKey],
    // ✅ revalida a cada 30s (cache real no Next)
    { revalidate: 30 }
  )

  const data = await getCached()

  if (data?.__error) {
    return NextResponse.json({ error: data.__error }, { status: data.__status || 500 })
  }

  // limpa campos internos
  const { __status, ...corpo } = data || {}

  return NextResponse.json(corpo, {
    status: __status || 200,
    headers: {
      // CDN/browser (leve)
      'Cache-Control': 'public, s-maxage=30, stale-while-revalidate=59',
      'Vary': 'Accept-Encoding',
    },
  })
}
