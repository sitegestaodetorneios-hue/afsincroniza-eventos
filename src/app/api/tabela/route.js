import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

function supabaseAnon() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    { auth: { persistSession: false } }
  )
}

export async function GET(request) {
  const { searchParams } = new URL(request.url)
  const etapaIdParam = searchParams.get('etapa_id')
  const supabase = supabaseAnon()

  try {
    let etapa = null

    // 1. Identificar Etapa
    if (etapaIdParam) {
      const { data } = await supabase.from('etapas').select('*').eq('id', etapaIdParam).single()
      etapa = data
    } else {
      let { data: active } = await supabase.from('etapas').select('*').eq('status', 'EM_ANDAMENTO').limit(1)
      etapa = active?.[0] || (await supabase.from('etapas').select('*').order('created_at', { ascending: false }).limit(1)).data?.[0]
    }

    if (!etapa) return NextResponse.json({ etapa: null, classificacao: [], finais: [], menu: [], artilharia: [] })

    // 2. Buscar Dados Básicos
    const { data: dadosView } = await supabase.from('vw_tabela_oficial').select('*').eq('etapa_id', etapa.id)
    
    // 3. Buscar Eventos (Gols e Cartões)
    const { data: jogos } = await supabase.from('jogos').select('id').eq('etapa_id', etapa.id)
    const jogoIds = jogos?.map(j => j.id) || []

    let eventos = []
    if (jogoIds.length > 0) {
        const { data: evs } = await supabase
            .from('jogo_eventos')
            .select(`
                id, tipo, equipe_id, atleta_id,
                atletas (id, nome),
                equipes (id, nome_equipe)
            `)
            .in('jogo_id', jogoIds)
        eventos = evs || []
    }

    // 4. Processar Estatísticas
    const statsTime = {} 
    const golsPorAtletaId = {}

    eventos.forEach(ev => {
        // Cartões
        if (!statsTime[ev.equipe_id]) statsTime[ev.equipe_id] = { am: 0, verm: 0 }
        if (ev.tipo === 'AMARELO') statsTime[ev.equipe_id].am++
        if (ev.tipo === 'VERMELHO') statsTime[ev.equipe_id].verm++

        // Gols (Artilharia)
        if (ev.tipo === 'GOL' && ev.atleta_id) {
            golsPorAtletaId[ev.atleta_id] = (golsPorAtletaId[ev.atleta_id] || 0) + 1
        }
    })

    // 5. Montar Artilharia
    const idsArtilheiros = Object.keys(golsPorAtletaId)
    let artilhariaFinal = []
    
    if (idsArtilheiros.length > 0) {
        const { data: atletas } = await supabase.from('atletas').select('id, nome, equipe_id').in('id', idsArtilheiros)
        const equipeIds = atletas?.map(a => a.equipe_id) || []
        const { data: equipes } = await supabase.from('equipes').select('id, nome_equipe').in('id', equipeIds)
        const equipeMap = {}
        equipes?.forEach(eq => equipeMap[eq.id] = eq.nome_equipe)

        artilhariaFinal = atletas?.map(atleta => ({
            id: atleta.id,
            nome: atleta.nome,
            equipe: equipeMap[atleta.equipe_id] || 'Time',
            gols: golsPorAtletaId[atleta.id]
        })) || []

        artilhariaFinal.sort((a, b) => b.gols - a.gols).slice(0, 10)
    }

    // 6. Classificação PADRÃO FIFA
    // Critérios: Pontos > Saldo de Gols > Gols Pró > Confronto Direto (ignorado aqui) > Fair Play
    const classificacaoFinal = (dadosView || []).map(time => {
        const cartoes = statsTime[time.equipe_id] || { am: 0, verm: 0 }
        return { ...time, ca: cartoes.am, cv: cartoes.verm }
    }).sort((a, b) => {
        // 1. Pontos
        if (b.pts !== a.pts) return b.pts - a.pts;
        
        // 2. Saldo de Gols (Padrão FIFA vem antes de vitórias)
        const sgA = a.gp - a.gc;
        const sgB = b.gp - b.gc;
        if (sgB !== sgA) return sgB - sgA;
        
        // 3. Gols Pró (Ataque mais positivo)
        if (b.gp !== a.gp) return b.gp - a.gp;

        // 4. Número de Vitórias (Desempate comum secundário)
        if (b.v !== a.v) return b.v - a.v;

        // 5. Fair Play (Menos Vermelhos)
        if (a.cv !== b.cv) return a.cv - b.cv; 
        
        // 6. Fair Play (Menos Amarelos)
        return a.ca - b.ca;
    });

    // 7. Dados Finais
    const { data: finais } = await supabase
        .from('jogos')
        .select(`
            id, tipo_jogo, gols_a, gols_b, penaltis_a, penaltis_b, finalizado, status,
            equipeA:equipes!jogos_equipe_a_id_fkey(nome_equipe),
            equipeB:equipes!jogos_equipe_b_id_fkey(nome_equipe)
        `)
        .eq('etapa_id', etapa.id)
        .in('tipo_jogo', ['FINAL', 'DISPUTA_3', 'SEMI', 'QUARTAS'])
        .order('tipo_jogo', { ascending: false })

    const { data: menu } = await supabase.from('etapas').select('id, titulo, status, modalidade').order('created_at', { ascending: false })

    return NextResponse.json({ 
        etapa, 
        classificacao: classificacaoFinal,
        artilharia: artilhariaFinal,
        finais: finais || [],
        menu: menu || []
    })

  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}