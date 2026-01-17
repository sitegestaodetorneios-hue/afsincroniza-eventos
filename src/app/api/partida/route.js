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
  const id = Number(searchParams.get('id') || 0)

  if (!id) return NextResponse.json({ error: 'ID obrigatório' }, { status: 400 })

  const supabase = supabaseAnon()

  try {
    // 1. BUSCA O JOGO (Sem tentar adivinhar relacionamento complexo)
    const { data: jogo, error } = await supabase
      .from('jogos')
      .select('*')
      .eq('id', id)
      .single()

    if (error) throw error

    // 2. BUSCA TUDO O RESTO EM PARALELO (Times, Eventos, Atletas)
    // Fazemos manual para não falhar nunca
    const [resTimeA, resTimeB, resEventos, resAtletas] = await Promise.all([
      supabase.from('equipes').select('id, nome_equipe, logo_url').eq('id', jogo.equipe_a_id).single(),
      supabase.from('equipes').select('id, nome_equipe, logo_url').eq('id', jogo.equipe_b_id).single(),
      supabase.from('jogo_eventos').select('*').eq('jogo_id', id).order('created_at', { ascending: true }),
      // Busca atletas dos dois times de uma vez só
      supabase.from('atletas').select('id, nome, numero_camisa, equipe_id').in('equipe_id', [jogo.equipe_a_id, jogo.equipe_b_id])
    ])

    // 3. MONTA O OBJETO DO JOGO COM OS TIMES
    const jogoCompleto = {
        ...jogo,
        equipeA: resTimeA.data || { nome_equipe: 'A Definir' },
        equipeB: resTimeB.data || { nome_equipe: 'A Definir' }
    }

    // 4. PREPARA OS DADOS AUXILIARES
    const eventos = resEventos.data || []
    const todosAtletas = resAtletas.data || []
    
    // Separa os atletas por time
    const atletasA = todosAtletas.filter(a => a.equipe_id === jogo.equipe_a_id).sort((a,b) => (a.numero_camisa || 99) - (b.numero_camisa || 99))
    const atletasB = todosAtletas.filter(a => a.equipe_id === jogo.equipe_b_id).sort((a,b) => (a.numero_camisa || 99) - (b.numero_camisa || 99))

    // 5. ENRIQUECE OS EVENTOS (Coloca nome do jogador e do time no evento)
    // Cria mapa para acesso rápido
    const atletaMap = new Map()
    todosAtletas.forEach(a => atletaMap.set(a.id, a))

    const eventosFormatados = eventos.map(ev => {
        const isTimeA = ev.equipe_id === jogo.equipe_a_id
        const teamName = isTimeA ? jogoCompleto.equipeA.nome_equipe : jogoCompleto.equipeB.nome_equipe
        
        const atleta = ev.atleta_id ? atletaMap.get(ev.atleta_id) : null
        const camisa = ev.camisa_no_jogo ?? atleta?.numero_camisa ?? '-'
        const atletaLabel = atleta ? `#${camisa} ${atleta.nome}` : `#${camisa} Jogador`

        return {
            ...ev,
            team_name: teamName,
            atleta_label: atletaLabel
        }
    })

    // 6. RETORNA COM CACHE DE 30 SEGUNDOS
    return NextResponse.json({
        jogo: jogoCompleto,
        eventos: eventosFormatados,
        atletasA,
        atletasB
    }, {
        status: 200,
        headers: {
            'Cache-Control': 'public, s-maxage=30, stale-while-revalidate=59',
        }
    })

  } catch (e) {
    console.error("ERRO API PARTIDA:", e.message)
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}