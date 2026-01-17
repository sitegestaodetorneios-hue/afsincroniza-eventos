import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

// Removido dynamic para cache, mas mantenha em mente que para debug as vezes ajuda limpar cache
// export const dynamic = 'force-dynamic' 

function supabaseAnon() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    { auth: { persistSession: false } }
  )
}

export async function GET(request) {
  const { searchParams } = new URL(request.url)
  const id = searchParams.get('id') // Pega como string primeiro

  console.log(`🔍 [API] Buscando Jogo ID: ${id}`)

  if (!id) return NextResponse.json({ error: 'ID não fornecido' }, { status: 400 })

  const supabase = supabaseAnon()

  try {
    // 1. TENTATIVA DIRETA E SIMPLES (Sem relacionamentos)
    const { data: jogo, error } = await supabase
      .from('jogos')
      .select('*') // Pega TUDO, sem frescura de foreign key
      .eq('id', id)
      .maybeSingle()

    if (error) {
        console.error("❌ [API] Erro no Supabase:", error.message)
        throw error
    }

    if (!jogo) {
        console.error(`❌ [API] Jogo ${id} retornou NULL. Possível bloqueio RLS ou ID inexistente.`)
        return NextResponse.json({ error: 'Jogo não encontrado no banco' }, { status: 404 })
    }

    console.log(`✅ [API] Jogo encontrado: ${jogo.id} - ${jogo.data_jogo}`)

    // 2. AGORA BUSCAMOS OS NOMES DOS TIMES (Separado para não travar)
    let nomeA = 'A Definir'
    let nomeB = 'A Definir'
    let logoA = null
    let logoB = null

    if (jogo.equipe_a_id) {
        const { data: tA } = await supabase.from('equipes').select('nome_equipe, logo_url').eq('id', jogo.equipe_a_id).maybeSingle()
        if (tA) { nomeA = tA.nome_equipe; logoA = tA.logo_url }
    }

    if (jogo.equipe_b_id) {
        const { data: tB } = await supabase.from('equipes').select('nome_equipe, logo_url').eq('id', jogo.equipe_b_id).maybeSingle()
        if (tB) { nomeB = tB.nome_equipe; logoB = tB.logo_url }
    }

    // 3. BUSCA EVENTOS
    const { data: eventos } = await supabase
        .from('jogo_eventos')
        .select('*')
        .eq('jogo_id', id)
        .order('created_at', { ascending: true })

    // 4. FORMATAÇÃO SIMPLES (Sem buscar atletas por enquanto para isolar o erro)
    const eventosFormatados = (eventos || []).map(ev => ({
        ...ev,
        team_name: ev.equipe_id === jogo.equipe_a_id ? nomeA : nomeB,
        atleta_label: ev.camisa_no_jogo ? `#${ev.camisa_no_jogo}` : (ev.observacao || 'Lance')
    }))

    // Objeto do jogo com os times "injetados" manualmente
    const jogoCompleto = {
        ...jogo,
        equipeA: { nome_equipe: nomeA, logo_url: logoA },
        equipeB: { nome_equipe: nomeB, logo_url: logoB }
    }

    return NextResponse.json({
        jogo: jogoCompleto,
        eventos: eventosFormatados,
        atletasA: [], // Mandando vazio por segurança agora
        atletasB: []  // Mandando vazio por segurança agora
    }, {
        headers: { 'Cache-Control': 'public, s-maxage=10, stale-while-revalidate=59' } // Cache baixo para teste
    })

  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}