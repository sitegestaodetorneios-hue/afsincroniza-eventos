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
    // 1. BUSCA O JOGO (Primeiro passo isolado)
    const { data: jogo, error } = await supabase
      .from('jogos')
      .select('*')
      .eq('id', id)
      .maybeSingle() // ✅ USA maybeSingle: Se não achar, retorna null em vez de erro

    if (error) throw error
    if (!jogo) return NextResponse.json({ error: 'Jogo não encontrado' }, { status: 404 })

    // 2. BUSCAS AUXILIARES (Preparadas para falhar sem derrubar tudo)
    const promises = [
        supabase.from('jogo_eventos').select('*').eq('jogo_id', id).order('created_at', { ascending: true }),
        // Busca atletas dos dois times
        supabase.from('atletas').select('id, nome, numero_camisa, equipe_id').in('equipe_id', [jogo.equipe_a_id, jogo.equipe_b_id].filter(Boolean))
    ]

    // Adiciona busca do Time A (se tiver ID)
    if (jogo.equipe_a_id) {
        promises.push(supabase.from('equipes').select('id, nome_equipe, logo_url').eq('id', jogo.equipe_a_id).maybeSingle())
    } else {
        promises.push(Promise.resolve({ data: null })) // Placeholder se não tiver time A
    }

    // Adiciona busca do Time B (se tiver ID)
    if (jogo.equipe_b_id) {
        promises.push(supabase.from('equipes').select('id, nome_equipe, logo_url').eq('id', jogo.equipe_b_id).maybeSingle())
    } else {
        promises.push(Promise.resolve({ data: null })) // Placeholder se não tiver time B
    }

    // Executa tudo
    const [resEventos, resAtletas, resTimeA, resTimeB] = await Promise.all(promises)

    // 3. MONTA O OBJETO FINAL (Com proteção contra nulos)
    const equipeA = resTimeA?.data || { nome_equipe: 'A Definir' }
    const equipeB = resTimeB?.data || { nome_equipe: 'A Definir' }

    const jogoCompleto = {
        ...jogo,
        equipeA,
        equipeB
    }

    // 4. PREPARA LISTAS
    const eventos = resEventos.data || []
    const todosAtletas = resAtletas.data || []
    
    // Filtra e organiza escalações
    const atletasA = todosAtletas.filter(a => a.equipe_id === jogo.equipe_a_id).sort((a,b) => (a.numero_camisa || 99) - (b.numero_camisa || 99))
    const atletasB = todosAtletas.filter(a => a.equipe_id === jogo.equipe_b_id).sort((a,b) => (a.numero_camisa || 99) - (b.numero_camisa || 99))

    // 5. ENRIQUECE EVENTOS
    const atletaMap = new Map()
    todosAtletas.forEach(a => atletaMap.set(a.id, a))

    const eventosFormatados = eventos.map(ev => {
        const isTimeA = ev.equipe_id === jogo.equipe_a_id
        const teamName = isTimeA ? equipeA.nome_equipe : equipeB.nome_equipe
        
        const atleta = ev.atleta_id ? atletaMap.get(ev.atleta_id) : null
        const camisa = ev.camisa_no_jogo ?? atleta?.numero_camisa ?? '-'
        const atletaLabel = atleta ? `#${camisa} ${atleta.nome}` : `#${camisa} Jogador`

        return {
            ...ev,
            team_name: teamName,
            atleta_label: atletaLabel
        }
    })

    // 6. RETORNO FINAL
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
    console.error("ERRO CRÍTICO API PARTIDA:", e)
    // Retorna JSON de erro para o front saber que falhou
    return NextResponse.json({ error: e.message || 'Erro interno no servidor' }, { status: 500 })
  }
}