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
    // PASSO 1: Busca o Jogo (Simples)
    const { data: jogo, error: errJogo } = await supabase
      .from('jogos')
      .select('*')
      .eq('id', id)
      .maybeSingle()

    if (errJogo) throw errJogo
    if (!jogo) return NextResponse.json({ error: 'Jogo não encontrado' }, { status: 404 })

    // PASSO 2: Busca os Times (Manual e Seguro)
    // Se não tiver time A ou B definido, ele não quebra
    const idsTimes = [jogo.equipe_a_id, jogo.equipe_b_id].filter(Boolean)
    
    let times = []
    if (idsTimes.length > 0) {
        const resTimes = await supabase.from('equipes').select('id, nome_equipe, logo_url').in('id', idsTimes)
        times = resTimes.data || []
    }

    // Mapeia os times para fácil acesso
    const timeA = times.find(t => t.id === jogo.equipe_a_id) || { nome_equipe: 'A Definir' }
    const timeB = times.find(t => t.id === jogo.equipe_b_id) || { nome_equipe: 'A Definir' }

    // PASSO 3: Busca Eventos e Atletas
    const { data: eventos } = await supabase
        .from('jogo_eventos')
        .select('*')
        .eq('jogo_id', id)
        .order('created_at', { ascending: true })

    const { data: todosAtletas } = await supabase
        .from('atletas')
        .select('id, nome, numero_camisa, equipe_id')
        .in('equipe_id', idsTimes)

    // PASSO 4: Processamento Final
    const atletasLista = todosAtletas || []
    const atletasA = atletasLista.filter(a => a.equipe_id === jogo.equipe_a_id).sort((a,b) => (a.numero_camisa || 99) - (b.numero_camisa || 99))
    const atletasB = atletasLista.filter(a => a.equipe_id === jogo.equipe_b_id).sort((a,b) => (a.numero_camisa || 99) - (b.numero_camisa || 99))

    // Formata eventos
    const atletaMap = new Map()
    atletasLista.forEach(a => atletaMap.set(a.id, a))

    const eventosFormatados = (eventos || []).map(ev => {
        const isTimeA = ev.equipe_id === jogo.equipe_a_id
        const teamName = isTimeA ? timeA.nome_equipe : timeB.nome_equipe
        const atleta = ev.atleta_id ? atletaMap.get(ev.atleta_id) : null
        const camisa = ev.camisa_no_jogo ?? atleta?.numero_camisa ?? '-'
        const atletaLabel = atleta ? `#${camisa} ${atleta.nome}` : `#${camisa} Jogador`

        return { ...ev, team_name: teamName, atleta_label: atletaLabel }
    })

    // Monta objeto final
    const jogoCompleto = { ...jogo, equipeA: timeA, equipeB: timeB }

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
    console.error("ERRO API PARTIDA:", e)
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}