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

    // 1. IDENTIFICAÇÃO DA ETAPA
    if (etapaIdParam) {
      const { data } = await supabase.from('etapas').select('*').eq('id', etapaIdParam).single()
      etapa = data
    } else {
      let { data: active } = await supabase.from('etapas').select('*').eq('status', 'EM_ANDAMENTO').limit(1)
      etapa = active?.[0] || (await supabase.from('etapas').select('*').order('created_at', { ascending: false }).limit(1)).data?.[0]
    }

    if (!etapa) return NextResponse.json({ etapa: null, classificacao: [], finais: [], menu: [], artilharia: [], defesa: [] })

    // 2. BUSCA DADOS DA VIEW (PONTUAÇÃO, VITORIAS, GOLS)
    const { data: dadosView } = await supabase.from('vw_tabela_oficial').select('*').eq('etapa_id', etapa.id)
    
    // 3. BUSCA EVENTOS (PARA CARTÕES E ARTILHARIA)
    const { data: jogos } = await supabase.from('jogos').select('id').eq('etapa_id', etapa.id)
    const jogoIds = jogos?.map(j => j.id) || []

    let eventos = []
    if (jogoIds.length > 0) {
        const { data: evs } = await supabase
            .from('jogo_eventos')
            .select(`id, tipo, equipe_id, atleta_id`)
            .in('jogo_id', jogoIds)
        eventos = evs || []
    }

    // 4. PROCESSAMENTO DE CARTÕES E GOLS
    const statsTime = {} 
    const golsPorAtletaId = {}

    eventos.forEach(ev => {
        if (!statsTime[ev.equipe_id]) statsTime[ev.equipe_id] = { am: 0, verm: 0 }
        if (ev.tipo === 'AMARELO') statsTime[ev.equipe_id].am++
        if (ev.tipo === 'VERMELHO') statsTime[ev.equipe_id].verm++

        if (ev.tipo === 'GOL' && ev.atleta_id) {
            golsPorAtletaId[ev.atleta_id] = (golsPorAtletaId[ev.atleta_id] || 0) + 1
        }
    })

    // 5. RANKING DE ARTILHARIA (TOP 10)
    const idsArtilheiros = Object.keys(golsPorAtletaId)
    let artilhariaFinal = []
    if (idsArtilheiros.length > 0) {
        const { data: atletas } = await supabase.from('atletas').select('id, nome, equipe_id').in('id', idsArtilheiros)
        const equipeIds = [...new Set(atletas?.map(a => a.equipe_id) || [])]
        const { data: equipesArt } = await supabase.from('equipes').select('id, nome_equipe').in('id', equipeIds)
        
        const equipeMap = {}
        equipesArt?.forEach(eq => equipeMap[eq.id] = eq.nome_equipe)

        artilhariaFinal = atletas?.map(atleta => ({
            id: atleta.id,
            nome: atleta.nome,
            equipe: equipeMap[atleta.equipe_id] || 'Time',
            gols: golsPorAtletaId[atleta.id]
        })).sort((a, b) => b.gols - a.gols).slice(0, 10) || []
    }

    // 6. CLASSIFICAÇÃO COM CRITÉRIOS DE DESEMPATE FIFA
    const classificacaoFinal = (dadosView || []).map(time => {
        const cartoes = statsTime[time.equipe_id] || { am: 0, verm: 0 }
        const gp = time.gp || 0
        const gc = time.gc || 0
        return { 
          ...time, 
          gp, 
          gc, 
          sg: gp - gc,
          ca: cartoes.am, 
          cv: cartoes.verm,
          media_gc: time.j > 0 ? (gc / time.j) : 999 
        }
    }).sort((a, b) => {
        // ORDEM FIFA: 
        // 1. PONTOS
        if (b.pts !== a.pts) return b.pts - a.pts;
        // 2. SALDO DE GOLS
        if (b.sg !== a.sg) return b.sg - a.sg;
        // 3. GOLS PRÓ
        if (b.gp !== a.gp) return b.gp - a.gp;
        // 4. VITÓRIAS
        if (b.v !== a.v) return b.v - a.v;
        // 5. FAIR PLAY - MENOS VERMELHOS
        if (a.cv !== b.cv) return a.cv - b.cv; 
        // 6. FAIR PLAY - MENOS AMARELOS
        return a.ca - b.ca;
    });

    // 7. RANKING GOLEIRO MENOS VAZADO (MELHOR DEFESA)
    const defesaFinal = [...classificacaoFinal]
      .filter(t => t.j > 0) 
      .sort((a, b) => a.gc - b.gc || a.media_gc - b.media_gc)
      .slice(0, 5);

    // 8. BUSCA JOGOS DE MATA-MATA (FINAIS)
    const { data: finais } = await supabase
        .from('jogos')
        .select(`
            id, tipo_jogo, gols_a, gols_b, penaltis_a, penaltis_b, finalizado, status,
            equipeA:equipes!jogos_equipe_a_id_fkey(nome_equipe),
            equipeB:equipes!jogos_equipe_b_id_fkey(nome_equipe)
        `)
        .eq('etapa_id', etapa.id)
        .in('tipo_jogo', ['FINAL', 'DISPUTA_3', 'SEMI', 'QUARTAS'])
        .order('id', { ascending: true })

    const { data: menu } = await supabase.from('etapas').select('id, titulo, status, modalidade').order('created_at', { ascending: false })

    // RETORNO COM HEADERS DE CACHE PARA VERCEL
    return NextResponse.json({ 
        etapa, 
        classificacao: classificacaoFinal,
        artilharia: artilhariaFinal,
        defesa: defesaFinal,
        finais: finais || [],
        menu: menu || []
    }, {
        headers: {
            'Cache-Control': 's-maxage=1, stale-while-revalidate=59',
            'x-nextjs-tags': 'tabela'
        }
    })

  } catch (e) {
    console.error("ERRO API TABELA:", e.message)
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}