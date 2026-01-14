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

// LÓGICA NOVA: GRUPO A vs GRUPO B
function generateInterGroupMatches(teamsA, teamsB) {
  const schedule = []
  
  // Clona os arrays para não alterar os originais
  let listA = [...teamsA]
  let listB = [...teamsB]

  // Se os grupos tiverem tamanhos diferentes, adiciona 'BYE' (folga) no menor
  while (listA.length < listB.length) listA.push(null)
  while (listB.length < listA.length) listB.push(null)

  const count = listA.length // Agora ambos têm o mesmo tamanho

  // Número de rodadas = número de times no grupo oposto
  // Ex: 3x3 times = 3 rodadas
  for (let r = 0; r < count; r++) {
    const pairs = []
    
    for (let i = 0; i < count; i++) {
      const timeA = listA[i]
      // Pega o oponente em B usando deslocamento (i + r) % count
      // Isso faz o time B "girar" a cada rodada
      const timeB = listB[(i + r) % count]

      if (timeA !== null && timeB !== null) {
        pairs.push([timeA, timeB])
      }
    }
    
    if (pairs.length > 0) {
      schedule.push({ rodada: r + 1, pairs })
    }
  }

  return schedule
}

export async function POST(request) {
  if (!isAuthorized(request)) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const body = await request.json().catch(() => null)
  const etapa_id = Number(body.etapa_id || 0)
  const data_base = body.data_base || null 
  const dias = body.dias || ['SAB', 'DOM'] 

  if (!etapa_id) return NextResponse.json({ error: 'Etapa ID obrigatório' }, { status: 400 })

  try {
    const supabase = supabaseAdmin()

    // 1. Busca Equipes E SEUS GRUPOS
    const { data: rel, error: errRel } = await supabase
      .from('etapa_equipes')
      .select('equipe_id, grupo') // <--- IMPORTANTE: Pegar o grupo
      .eq('etapa_id', etapa_id)

    if (errRel) return NextResponse.json({ error: errRel.message }, { status: 500 })

    // Separa os times
    const teamsA = rel.filter(t => t.grupo === 'A').map(t => t.equipe_id)
    const teamsB = rel.filter(t => t.grupo === 'B').map(t => t.equipe_id)

    if (teamsA.length === 0 || teamsB.length === 0) {
      return NextResponse.json({ error: 'É necessário ter times no Grupo A e no Grupo B. Faça o sorteio dos grupos primeiro.' }, { status: 400 })
    }

    // 2. Limpa jogos anteriores
    if (body.limpar_existentes !== false) {
      await supabase.from('jogos').delete().eq('etapa_id', etapa_id)
    }

    // 3. Gera a Tabela Intergrupos
    const agenda = generateInterGroupMatches(teamsA, teamsB)
    const inserts = []

    for (const round of agenda) {
      const rodada = round.rodada
      const pairs = round.pairs // Pares A vs B já definidos

      // Define Data (Simples)
      let data_jogo = null
      if (data_base) {
        const d = new Date(data_base + 'T00:00:00')
        // Se for tudo no mesmo dia, não soma dias. Se for dias diferentes, soma.
        // Assumindo que você quer tudo no sábado, por exemplo.
        // Se quiser dias diferentes, descomente abaixo:
        // d.setDate(d.getDate() + (rodada - 1)) 
        data_jogo = d.toISOString().slice(0, 10)
      }

      for (const [a, b] of pairs) {
        inserts.push({
          etapa_id,
          rodada,
          data_jogo,
          equipe_a_id: a, // Time do A
          equipe_b_id: b, // Time do B
          finalizado: false,
          tipo_jogo: 'GRUPO'
        })
      }
    }

    const { data } = await supabase.from('jogos').insert(inserts).select()

    return NextResponse.json({ 
        ok: true, 
        jogos_criados: inserts.length,
        detalhe: `${teamsA.length} times (A) vs ${teamsB.length} times (B)`
    })

  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}