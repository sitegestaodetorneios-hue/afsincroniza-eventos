import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

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
    // 1. BUSCA O MENU (Igual ao seu original)
    const { data: menu } = await supabase
        .from('etapas')
        .select('id, titulo, status, modalidade')
        .order('created_at', { ascending: false })

    // 2. DEFINE ETAPA (Igual ao seu original)
    let etapaId = etapaIdParam ? Number(etapaIdParam) : null
    let etapaAtual = null

    if (etapaId) {
        etapaAtual = menu?.find(e => e.id === etapaId)
    } else {
        etapaAtual = menu?.find(e => e.status === 'EM_ANDAMENTO') || menu?.[0]
        etapaId = etapaAtual?.id
    }

    if (!etapaId) {
        return NextResponse.json({ jogos: [], menu: [], etapa: null })
    }

    // 3. BUSCA JOGOS (Igual ao seu original)
    const { data: jogos, error: errJogos } = await supabase
      .from('jogos')
      .select('*') 
      .eq('etapa_id', etapaId)
      .order('rodada', { ascending: true })
      .order('data_jogo', { ascending: true })
      .order('horario', { ascending: true })

    if (errJogos) throw errJogos

    // 4. CORREÇÃO DOS NOMES: Busca equipes para injetar os nomes nos cards
    let jogosCompletos = []
    if (jogos && jogos.length > 0) {
        const idsTimes = [...new Set(jogos.flatMap(j => [j.equipe_a_id, j.equipe_b_id]))].filter(Boolean)

        const { data: times } = await supabase
            .from('equipes')
            .select('id, nome_equipe, logo_url')
            .in('id', idsTimes)

        const mapaTimes = {}
        times?.forEach(t => mapaTimes[t.id] = t)

        jogosCompletos = jogos.map(j => ({
            ...j,
            // Injeta o objeto que a página partidas/page.js espera ler
            equipeA: mapaTimes[j.equipe_a_id] || { nome_equipe: j.origem_a || 'A Definir' },
            equipeB: mapaTimes[j.equipe_b_id] || { nome_equipe: j.origem_b || 'A Definir' }
        }))
    }

    // 5. RETORNA COM O CACHE ATIVADO (Igual ao seu ao-vivo)
    return NextResponse.json({
        jogos: jogosCompletos,
        menu: menu || [],
        etapa: etapaAtual
    }, {
      status: 200,
      headers: {
        'Cache-Control': 'public, s-maxage=30, stale-while-revalidate=59',
      },
    })

  } catch (e) {
    console.error("ERRO API PARTIDAS:", e.message)
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}