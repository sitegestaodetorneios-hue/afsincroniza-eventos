import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

function isAuthorized(request) {
  const pin = request.headers.get('x-admin-pin') || ''
  return pin && pin === (process.env.ADMIN_PIN || '2026')
}

function supabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new Error('Env ausente')
  return createClient(url, key, { auth: { persistSession: false } })
}

// embaralhar (efeito “bingo”)
function shuffle(arr) {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

// gera todos contra todos (round robin) – retorna lista de pares (A,B)
function roundRobinPairs(teamIds) {
  const teams = [...teamIds]
  if (teams.length < 2) return []
  // se ímpar, adiciona BYE
  const hasBye = teams.length % 2 === 1
  if (hasBye) teams.push(null)

  const n = teams.length
  const rounds = n - 1
  const half = n / 2

  const schedule = []

  let arr = [...teams]
  for (let r = 1; r <= rounds; r++) {
    const pairs = []
    for (let i = 0; i < half; i++) {
      const a = arr[i]
      const b = arr[n - 1 - i]
      if (a !== null && b !== null) pairs.push([a, b])
    }
    schedule.push({ rodada: r, pairs })

    // rotação (método do círculo)
    const fixed = arr[0]
    const rest = arr.slice(1)
    rest.unshift(rest.pop())
    arr = [fixed, ...rest]
  }

  return schedule
}

export async function POST(request) {
  if (!isAuthorized(request)) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const body = await request.json().catch(() => null)
  if (!body) return NextResponse.json({ error: 'JSON inválido' }, { status: 400 })

  const etapa_id = Number(body.etapa_id || 0)
  const data_base = body.data_base || null // ex: "2026-03-07" (sábado) ou null
  const dias = body.dias || ['SAB', 'DOM'] // alterna sábado/domingo por rodada (configurável)
  const modo = body.modo || 'BINGO' // BINGO = embaralha ordem dentro de cada rodada

  if (!etapa_id) return NextResponse.json({ error: 'etapa_id obrigatório' }, { status: 400 })

  try {
    const supabase = supabaseAdmin()

    // pega etapa (categoria opcional)
    const { data: etapa, error: errEt } = await supabase
      .from('etapas')
      .select('id, categoria')
      .eq('id', etapa_id)
      .single()

    if (errEt) return NextResponse.json({ error: errEt.message }, { status: 500 })

    // busca equipes vinculadas na etapa
    const { data: rel, error: errRel } = await supabase
      .from('etapa_equipes')
      .select('equipe_id')
      .eq('etapa_id', etapa_id)

    if (errRel) return NextResponse.json({ error: errRel.message }, { status: 500 })

    const teamIds = (rel || []).map(r => r.equipe_id)

    if (teamIds.length !== 6) {
      // por enquanto vocês sempre falaram 6 times
      // dá pra permitir diferente, mas 6 é o padrão inicial
      return NextResponse.json({ error: `A etapa precisa ter exatamente 6 equipes vinculadas. Hoje: ${teamIds.length}` }, { status: 400 })
    }

    // evita duplicar: apaga jogos existentes da etapa (se você quiser manter, me fala)
    if (body.limpar_existentes !== false) {
      const { error: errDel } = await supabase.from('jogos').delete().eq('etapa_id', etapa_id)
      if (errDel) return NextResponse.json({ error: errDel.message }, { status: 500 })
    }

    // gera round robin
    const rr = roundRobinPairs(teamIds)

    // transforma em inserts
    const inserts = []
    for (const round of rr) {
      const rodada = round.rodada

      let pairs = round.pairs
      if (modo === 'BINGO') pairs = shuffle(pairs)

      // opcional: define dia por rodada alternando SAB/DOM (se tiver data_base)
      let data_jogo = null
      if (data_base) {
        // rodada 1 = data_base, rodada 2 = data_base + 1 dia, rodada 3 = data_base + 7 dias ...
        // aqui deixo simples: alterna sábado/domingo dentro do mesmo fim de semana
        // se quiser calendário real por mês, fazemos depois
        const dayIndex = (rodada - 1) % dias.length
        const offset = dias[dayIndex] === 'DOM' ? 1 : 0
        // data_base + offset
        const d = new Date(data_base + 'T00:00:00')
        d.setDate(d.getDate() + offset)
        data_jogo = d.toISOString().slice(0, 10)
      }

      for (const [a, b] of pairs) {
        inserts.push({
          etapa_id,
          rodada,
          data_jogo,
          equipe_a_id: a,
          equipe_b_id: b,
          gols_a: null,
          gols_b: null,
          finalizado: false,
          categoria: etapa?.categoria || null,
        })
      }
    }

    const { data, error } = await supabase.from('jogos').insert(inserts).select()
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    return NextResponse.json({ ok: true, jogos_criados: data?.length || inserts.length })
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
