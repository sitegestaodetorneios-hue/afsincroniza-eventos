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
    // 1. BUSCA O MENU (Lista de todas as etapas para o dropdown)
    const { data: menu } = await supabase
        .from('etapas')
        .select('id, titulo, status, modalidade')
        .order('created_at', { ascending: false })

    // 2. DEFINE QUAL ETAPA MOSTRAR
    // Se veio ID na URL, usa ele. Se não, tenta achar a "EM_ANDAMENTO" ou a última criada.
    let etapaId = etapaIdParam ? Number(etapaIdParam) : null
    let etapaAtual = null

    if (etapaId) {
        etapaAtual = menu?.find(e => e.id === etapaId)
    } else {
        etapaAtual = menu?.find(e => e.status === 'EM_ANDAMENTO') || menu?.[0]
        etapaId = etapaAtual?.id
    }

    if (!etapaId) {
        // Se não tem etapa nenhuma cadastrada
        return NextResponse.json({ jogos: [], menu: [], etapa: null }, { 
            headers: { 'Cache-Control': 'public, s-maxage=30, stale-while-revalidate=59' } 
        })
    }

    // 3. BUSCA OS JOGOS DA ETAPA SELECIONADA
    const { data: jogos, error } = await supabase
      .from('jogos')
      .select(`
        *,
        equipeA:equipes!equipe_a_id(id, nome_equipe, logo_url),
        equipeB:equipes!equipe_b_id(id, nome_equipe, logo_url)
      `)
      .eq('etapa_id', etapaId)
      .order('rodada', { ascending: true })
      .order('data_jogo', { ascending: true })
      .order('horario', { ascending: true }) // Ordena por hora para ficar organizado

    if (error) throw error

    // 4. RETORNA TUDO (Jogos + Menu + Etapa Atual)
    return NextResponse.json({
        jogos: jogos || [],
        menu: menu || [],
        etapa: etapaAtual
    }, {
      status: 200,
      headers: {
        'Cache-Control': 'public, s-maxage=30, stale-while-revalidate=59',
      },
    })

  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}