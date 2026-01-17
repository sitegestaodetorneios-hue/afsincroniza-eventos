import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

// ❌ REMOVIDO: export const dynamic = 'force-dynamic'
// (Remover essa linha permite que o cache funcione)

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
    // 1. BUSCA O JOGO
    const { data: jogo, error: errJogo } = await supabase
      .from('jogos')
      .select('*')
      .eq('id', id)
      .maybeSingle()

    if (errJogo) throw errJogo
    if (!jogo) return NextResponse.json({ error: 'Jogo não encontrado' }, { status: 404 })

    // 2. BUSCA TIMES
    let timeA = { id: 0, nome_equipe: 'Time A' }
    let timeB = { id: 0, nome_equipe: 'Time B' }

    const idsTimes = []
    if (jogo.equipe_a_id) idsTimes.push(jogo.equipe_a_id)
    if (jogo.equipe_b_id) idsTimes.push(jogo.equipe_b_id)

    if (idsTimes.length > 0) {
        // Busca com * para evitar erro de coluna inexistente (logo_url)
        const { data: times } = await supabase
            .from('equipes')
            .select('*') 
            .in('id', idsTimes)

        if (times && times.length > 0) {
            const idBuscaA = String(jogo.equipe_a_id)
            const idBuscaB = String(jogo.equipe_b_id)

            const tA = times.find(t => String(t.id) === idBuscaA)
            // Tenta achar o logo em vários campos possíveis ou deixa null
            if (tA) timeA = { ...tA, logo_url: tA.logo_url || tA.escudo || tA.logo || null }
            
            const tB = times.find(t => String(t.id) === idBuscaB)
            if (tB) timeB = { ...tB, logo_url: tB.logo_url || tB.escudo || tB.logo || null }
        }
    }

    // 3. BUSCA EVENTOS
    const { data: eventos } = await supabase
        .from('jogo_eventos')
        .select('*')
        .eq('jogo_id', id)
        .order('created_at', { ascending: true })

    // 4. BUSCA ATLETAS
    const { data: atletas } = await supabase
        .from('atletas')
        .select('id, nome, numero_camisa, equipe_id')
        .in('equipe_id', idsTimes)

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

    return NextResponse.json({
        jogo: jogoCompleto,
        eventos: eventosFormatados,
        atletasA,
        atletasB
    }, {
        status: 200,
        headers: {
            // ✅ CACHE ATIVADO:
            // s-maxage=15: O servidor guarda a resposta por 15 segundos.
            // stale-while-revalidate=59: Se passar de 15s, ele mostra o velho enquanto busca o novo.
            'Cache-Control': 'public, s-maxage=15, stale-while-revalidate=59',
        }
    })

  } catch (e) {
    console.error("ERRO API:", e)
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}