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
  const idJogo = searchParams.get('id') // Ex: 325

  const supabase = supabaseAnon()
  const relatorio = { status: 'Iniciando diagnóstico profundo...' }

  try {
    // 1. BUSCA O JOGO
    const { data: jogo } = await supabase.from('jogos').select('*').eq('id', idJogo).maybeSingle()
    
    if (!jogo) {
        relatorio.erro_jogo = "JOGO NÃO ENCONTRADO."
        return NextResponse.json(relatorio)
    }

    relatorio.jogo = {
        id: jogo.id,
        id_time_A: jogo.equipe_a_id,
        id_time_B: jogo.equipe_b_id
    }

    // 2. TENTA BUSCAR OS TIMES EXATOS
    const ids = [jogo.equipe_a_id, jogo.equipe_b_id].filter(Boolean)
    relatorio.buscando_times_ids = ids

    const { data: times, error: errTimes } = await supabase
        .from('equipes')
        .select('id, nome_equipe')
        .in('id', ids)

    if (errTimes) {
        relatorio.erro_busca_times = errTimes.message
    } else {
        relatorio.times_encontrados = times
        relatorio.quantidade_times = times.length
        
        // Verifica se achou os dois
        const achouA = times.find(t => t.id == jogo.equipe_a_id)
        const achouB = times.find(t => t.id == jogo.equipe_b_id)
        
        relatorio.status_time_A = achouA ? "OK: " + achouA.nome_equipe : "FALHA: ID " + jogo.equipe_a_id + " NÃO EXISTE NA TABELA"
        relatorio.status_time_B = achouB ? "OK: " + achouB.nome_equipe : "FALHA: ID " + jogo.equipe_b_id + " NÃO EXISTE NA TABELA"
    }

    return NextResponse.json(relatorio)

  } catch (e) {
    return NextResponse.json({ erro_fatal: e.message })
  }
}