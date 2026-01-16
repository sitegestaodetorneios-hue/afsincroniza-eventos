import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

function isAuthorized(request) {
  const pin = request.headers.get('x-admin-pin') || ''
  return pin === (process.env.ADMIN_PIN || '2026')
}

function supabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  return createClient(url, key, { auth: { persistSession: false } })
}

function generateInterGroupMatches(teamsA, teamsB) {
  const schedule = []
  let listA = [...teamsA]
  let listB = [...teamsB]

  while (listA.length < listB.length) listA.push(null)
  while (listB.length < listA.length) listB.push(null)

  const count = listA.length

  for (let r = 0; r < count; r++) {
    const pairs = []
    for (let i = 0; i < count; i++) {
      const timeA = listA[i]
      const timeB = listB[(i + r) % count]

      if (timeA !== null && timeB !== null) {
        pairs.push([timeA, timeB])
      }
    }
    if (pairs.length > 0) schedule.push({ rodada: r + 1, pairs })
  }
  return schedule
}

export async function POST(request) {
  if (!isAuthorized(request)) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const body = await request.json().catch(() => null)
  const etapa_id = Number(body.etapa_id || 0)
  const data_base = body.data_base || null 

  if (!etapa_id) return NextResponse.json({ error: 'Etapa ID obrigatório' }, { status: 400 })

  try {
    const supabase = supabaseAdmin()

    // 1. Busca Equipes ORDENADAS PELA ORDEM DO SORTEIO
    // Aqui está a correção definitiva da divergência
    const { data: rel, error: errRel } = await supabase
      .from('etapa_equipes')
      .select('equipe_id, grupo, ordem_sorteio')
      .eq('etapa_id', etapa_id)
      .order('ordem_sorteio', { ascending: true }) // <--- GARANTE A ORDEM VISUAL

    if (errRel) return NextResponse.json({ error: errRel.message }, { status: 500 })

    // Como já veio ordenado do banco, o map mantém a ordem A1, A2, A3...
    const teamsA = rel.filter(t => t.grupo === 'A').map(t => t.equipe_id)
    const teamsB = rel.filter(t => t.grupo === 'B').map(t => t.equipe_id)

    if (teamsA.length === 0 || teamsB.length === 0) {
      return NextResponse.json({ error: 'Grupos vazios. Faça o sorteio primeiro.' }, { status: 400 })
    }

    // 2. Limpa jogos anteriores
    if (body.limpar_existentes !== false) {
      await supabase.from('jogos').delete().eq('etapa_id', etapa_id)
    }

    // 3. Gera a Tabela
    const agenda = generateInterGroupMatches(teamsA, teamsB)
    const inserts = []

    for (const round of agenda) {
      const rodada = round.rodada
      const pairs = round.pairs
      
      let data_jogo = null
      if (data_base) {
        const d = new Date(data_base + 'T00:00:00')
        data_jogo = d.toISOString().slice(0, 10)
      }

      for (const [a, b] of pairs) {
        inserts.push({
          etapa_id,
          rodada,
          data_jogo,
          equipe_a_id: a,
          equipe_b_id: b,
          finalizado: false,
          tipo_jogo: 'GRUPO'
        })
      }
    }

    if (inserts.length > 0) {
        await supabase.from('jogos').insert(inserts)
    }

    return NextResponse.json({ 
        ok: true, 
        jogos_criados: inserts.length 
    })

  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}