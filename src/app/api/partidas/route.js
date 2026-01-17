import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

// ❌ REMOVIDO 'force-dynamic' para permitir o Cache da Vercel

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
    // 1. DESCOBRE O ID DA ETAPA (Se não vier na URL, pega a ativa)
    let etapaId = etapaIdParam
    
    if (!etapaId) {
        const { data: active } = await supabase.from('etapas').select('id').eq('status', 'EM_ANDAMENTO').limit(1).single()
        if (active) {
            etapaId = active.id
        } else {
            const { data: last } = await supabase.from('etapas').select('id').order('created_at', { ascending: false }).limit(1).single()
            etapaId = last?.id
        }
    }

    // Se não tiver etapa nenhuma, retorna lista vazia (com cache)
    if (!etapaId) {
        return NextResponse.json([], { 
            headers: { 'Cache-Control': 'public, s-maxage=30, stale-while-revalidate=59' } 
        })
    }

    // 2. BUSCA OS JOGOS
    // Usamos select('*') para garantir que pega hora_jogo, horario, start_at (qualquer que seja o nome)
    const { data: jogos, error } = await supabase
      .from('jogos')
      .select(`
        *,
        equipeA:equipes!equipe_a_id(id, nome_equipe, logo_url),
        equipeB:equipes!equipe_b_id(id, nome_equipe, logo_url)
      `)
      .eq('etapa_id', etapaId)
      .order('rodada', { ascending: true })
      .order('data_jogo', { ascending: true }) // Ordena por data
      .order('id', { ascending: true })

    if (error) throw error

    // 3. RETORNA O ARRAY DIRETO (Igual o Front espera) + CACHE
    return NextResponse.json(jogos || [], {
      status: 200,
      headers: {
        // A MÁGICA: Cache de 30 segundos
        'Cache-Control': 'public, s-maxage=30, stale-while-revalidate=59',
      },
    })

  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}