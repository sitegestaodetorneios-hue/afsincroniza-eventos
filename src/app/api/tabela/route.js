import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

// REMOVIDO 'force-dynamic' para permitir o Cache da Vercel funcionar

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

    if (!etapa) {
        return NextResponse.json({ etapa: null, classificacao: [], finais: [], menu: [], artilharia: [], defesa: [] }, {
            headers: { 'Cache-Control': 'public, s-maxage=30, stale-while-revalidate=59' }
        })
    }

    // 2. BUSCA DADOS DA VIEW
    const { data: dadosView } = await supabase.from('vw_tabela_oficial').select('*').eq('etapa_id', etapa.id)
    
    // 3. BUSCA EVENTOS (OTIMIZADO)
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

    // 4. PROCESSAMENTO
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

    // 5. ARTILHARIA
    const idsArtilheiros = Object.keys(golsPorAtletaId)
    let artilhariaFinal = []
    if (idsArtilheiros.length > 0) {
        const { data: atletas } = await supabase.from('atletas').select('id, nome, equipe_id').in('id', idsArtilheiros)
        
        // Otimização: Pegar apenas equipes necessárias
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

    // 6. CLASSIFICAÇÃO FIFA
    const classificacaoFinal = (dadosView || []).map(time => {
        const cartoes = statsTime[time.equipe_id] || { am: 0, verm: 0 }
        const gp = time.gp || 0
        const gc = time.gc || 0
        return { 
          ...time, 
          gp, gc, 
          sg: gp - gc,
          ca: cartoes.am, 
          cv: cartoes.verm,
          media_gc: time.j > 0 ? (gc / time.j) : 999 
        }
    }).sort((a, b) => {
        if (b.pts !== a.pts) return b.pts - a.pts;
        if (b.sg !== a.sg) return b.sg - a.sg;
        if (b.gp !== a.gp) return b.gp - a.gp;
        if (b.v !== a.v) return b.v - a.v;
        if (a.cv !== b.cv) return a.cv - b.cv; 
        return a.ca - b.ca;
    });

    // 7. MELHOR DEFESA
    const defesaFinal = [...classificacaoFinal]
      .filter(t => t.j > 0) 
      .sort((a, b) => a.gc - b.gc || a.media_gc - b.media_gc)
      .slice(0, 5);

    // 8. FINAIS
    const { data: finais } = await supabase
        .from('jogos')
        .select(`
            id, tipo_jogo, gols_a, gols_b, penaltis_a, penaltis_b, finalizado, status, rodada, data_jogo, horario,
            equipeA:equipes!jogos_equipe_a_id_fkey(nome_equipe, logo_url),
            equipeB:equipes!jogos_equipe_b_id_fkey(nome_equipe, logo_url)
        `)
        .eq('etapa_id', etapa.id)
        .in('tipo_jogo', ['FINAL', 'DISPUTA_3', 'SEMI', 'QUARTAS'])
        .order('id', { ascending: true })

    const { data: menu } = await supabase.from('etapas').select('id, titulo, status, modalidade').order('created_at', { ascending: false })

    // RETORNO COM CACHE DE 30s (Igual ao Ao Vivo)
    return NextResponse.json({ 
        etapa, 
        classificacao: classificacaoFinal,
        artilharia: artilhariaFinal,
        defesa: defesaFinal,
        finais: finais || [],
        menu: menu || []
    }, {
        status: 200,
        headers: {
            'Cache-Control': 'public, s-maxage=30, stale-while-revalidate=59',
            'x-nextjs-tags': 'tabela'
        }
    })

  } catch (e) {
    console.error("ERRO API TABELA:", e.message)
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}