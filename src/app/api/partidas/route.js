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
    // 1. BUSCA O MENU COMPLETO
    const { data: menu, error: errMenu } = await supabase
        .from('etapas')
        .select('id, titulo, status, modalidade')
        .order('created_at', { ascending: false })
    
    if (errMenu) throw errMenu

    // 2. DEFINE QUAL ETAPA MOSTRAR (Lógica Blindada)
    let etapaId = etapaIdParam ? Number(etapaIdParam) : null
    let etapaAtual = null

    if (etapaId) {
        // Se o usuário clicou no menu, respeita a escolha dele
        etapaAtual = menu?.find(e => e.id === etapaId)
    } else {
        // Se entrou direto na página:
        // 1º Tenta pegar a 'EM_ANDAMENTO'
        etapaAtual = menu?.find(e => e.status === 'EM_ANDAMENTO')
        // 2º Se não tiver nenhuma ativa, pega a última criada (topo da lista)
        if (!etapaAtual) etapaAtual = menu?.[0]
        
        etapaId = etapaAtual?.id
    }

    if (!etapaId) {
        return NextResponse.json({ jogos: [], menu: [], etapa: null })
    }

    // 3. BUSCA OS JOGOS (COM A CORREÇÃO DA CHAVE ESTRANGEIRA)
    const { data: jogos, error } = await supabase
      .from('jogos')
      .select(`
        *,
        equipeA:equipes!jogos_equipe_a_id_fkey(id, nome_equipe, logo_url),
        equipeB:equipes!jogos_equipe_b_id_fkey(id, nome_equipe, logo_url)
      `)
      .eq('etapa_id', etapaId)
      .order('rodada', { ascending: true })
      .order('data_jogo', { ascending: true })
      .order('horario', { ascending: true })

    if (error) {
        console.error("Erro Supabase Jogos:", error.message)
        throw error
    }

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
    console.error("ERRO API PARTIDAS:", e.message)
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}