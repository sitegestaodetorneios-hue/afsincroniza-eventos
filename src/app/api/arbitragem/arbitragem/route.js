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
  const id = searchParams.get('id')

  if (!id) return NextResponse.json({ error: 'ID obrigatório' }, { status: 400 })

  const supabase = supabaseAnon()

  try {
    // 1) BUSCA O JOGO
    const { data: jogo, error: errJogo } = await supabase
      .from('jogos')
      .select('*')
      .eq('id', Number(id))
      .maybeSingle()

    if (errJogo) throw errJogo
    if (!jogo) return NextResponse.json({ error: 'Jogo não encontrado' }, { status: 404 })

    // 2) BUSCA TIMES
    let timeA = { id: 0, nome_equipe: 'Time A', logo_url: null }
    let timeB = { id: 0, nome_equipe: 'Time B', logo_url: null }

    const idsTimes = []
    if (jogo.equipe_a_id) idsTimes.push(jogo.equipe_a_id)
    if (jogo.equipe_b_id) idsTimes.push(jogo.equipe_b_id)

    if (idsTimes.length > 0) {
      const { data: times, error: errTimes } = await supabase
        .from('equipes')
        .select('id, nome_equipe, escudo_url')
        .in('id', idsTimes)

      if (errTimes) throw errTimes

      if (times?.length) {
        const idBuscaA = String(jogo.equipe_a_id)
        const idBuscaB = String(jogo.equipe_b_id)

        const tA = times.find(t => String(t.id) === idBuscaA)
        if (tA) timeA = { ...tA, logo_url: tA.escudo_url || null }

        const tB = times.find(t => String(t.id) === idBuscaB)
        if (tB) timeB = { ...tB, logo_url: tB.escudo_url || null }
      }
    }

    // 3) BUSCA EVENTOS ✅ tabela correta: jogo_eventos (singular)
    const { data: eventos, error: errEv } = await supabase
      .from('jogo_eventos')
      .select('*')
      .eq('jogo_id', Number(id))
      .order('created_at', { ascending: true })

    if (errEv) throw errEv

    // 4) BUSCA ATLETAS (somente tipo ATLETA)
    const { data: atletas, error: errAt } = await supabase
      .from('atletas')
      .select('id, nome, numero_camisa, equipe_id, tipo')
      .in('equipe_id', idsTimes)
      .eq('tipo', 'ATLETA')

    if (errAt) throw errAt

    const listaAtletas = atletas || []
    const atletaMap = new Map()
    listaAtletas.forEach(a => atletaMap.set(a.id, a))

    const eventosFormatados = (eventos || []).map(ev => {
      const isTimeA = String(ev.equipe_id) === String(jogo.equipe_a_id)
      const teamName = isTimeA ? timeA.nome_equipe : timeB.nome_equipe
      const atleta = ev.atleta_id ? atletaMap.get(ev.atleta_id) : null
      const camisa = ev.camisa_no_jogo ?? atleta?.numero_camisa ?? '-'
      const atletaLabel = atleta ? `#${camisa} ${atleta.nome}` : `#${camisa} Jogador`
      return { ...ev, team_name: teamName, atleta_label: atletaLabel }
    })

    const jogoCompleto = { ...jogo, equipeA: timeA, equipeB: timeB }
    const atletasA = listaAtletas.filter(a => String(a.equipe_id) === String(jogo.equipe_a_id))
    const atletasB = listaAtletas.filter(a => String(a.equipe_id) === String(jogo.equipe_b_id))

    return NextResponse.json(
      { jogo: jogoCompleto, eventos: eventosFormatados, atletasA, atletasB },
      {
        status: 200,
        headers: { 'Cache-Control': 'public, s-maxage=5, stale-while-revalidate=20' }
      }
    )
  } catch (e) {
    console.error('ERRO API SUMULA:', e)
    return NextResponse.json({ error: e.message || 'Erro interno' }, { status: 500 })
  }
}
