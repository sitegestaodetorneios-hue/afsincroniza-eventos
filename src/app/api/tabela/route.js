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
    // 1. Buscar TODAS as etapas para o menu (NOVO)
    const { data: menuEtapas } = await supabase
        .from('etapas')
        .select('id, titulo, status, modalidade')
        .order('created_at', { ascending: false })

    let etapa = null

    // 2. Definir qual etapa mostrar
    if (etapaIdParam) {
      // Se o usuário clicou numa etapa específica
      etapa = menuEtapas.find(e => String(e.id) === String(etapaIdParam))
    } else {
      // Padrão: Pega a que está EM_ANDAMENTO ou a primeira da lista (mais recente)
      etapa = menuEtapas.find(e => e.status === 'EM_ANDAMENTO') || menuEtapas[0]
    }

    if (!etapa) return NextResponse.json({ etapa: null, classificacao: [], finais: [], menu: [] })

    // 3. Classificação
    const { data: dados } = await supabase.from('vw_tabela_oficial').select('*').eq('etapa_id', etapa.id)
    
    const sorted = (dados || []).sort((a, b) => {
        if (b.pts !== a.pts) return b.pts - a.pts;
        if (b.v !== a.v) return b.v - a.v;
        const sgA = a.gp - a.gc;
        const sgB = b.gp - b.gc;
        if (sgB !== sgA) return sgB - sgA;
        return b.gp - a.gp;
    });

    // 4. Finais/Jogos Decisivos
    const { data: finais } = await supabase
        .from('jogos')
        .select(`
            id, tipo_jogo, gols_a, gols_b, penaltis_a, penaltis_b, finalizado, status,
            equipeA:equipes!jogos_equipe_a_id_fkey(nome_equipe),
            equipeB:equipes!jogos_equipe_b_id_fkey(nome_equipe)
        `)
        .eq('etapa_id', etapa.id)
        .in('tipo_jogo', ['FINAL', 'DISPUTA_3', 'SEMI', 'QUARTAS']) // Adicionei Semi/Quartas se quiser usar
        .order('tipo_jogo', { ascending: false })

    return NextResponse.json({ 
        etapa, 
        classificacao: sorted,
        finais: finais || [],
        menu: menuEtapas || [] // Envia a lista para o front
    })

  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}