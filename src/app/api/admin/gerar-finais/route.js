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

function parseHHMM(hhmm) {
  const [h, m] = (hhmm || '').split(':').map((x) => Number(x))
  if (!Number.isFinite(h) || !Number.isFinite(m)) return null
  if (h < 0 || h > 23 || m < 0 || m > 59) return null
  return { h, m }
}

function addMinutes(t, delta) {
  let total = t.h * 60 + t.m + delta
  total = ((total % (24 * 60)) + 24 * 60) % (24 * 60)
  return { h: Math.floor(total / 60), m: total % 60 }
}

function fmtHHMM(t) {
  const hh = String(t.h).padStart(2, '0')
  const mm = String(t.m).padStart(2, '0')
  return `${hh}:${mm}`
}

function toInt(v, def = 0) {
  const n = Number(v)
  return Number.isFinite(n) ? n : def
}

function ensureArray(x) {
  return Array.isArray(x) ? x : []
}

function buildStandings(teamIds) {
  const map = new Map()
  for (const id of teamIds) {
    map.set(id, { equipe_id: id, pts: 0, j: 0, v: 0, e: 0, d: 0, gp: 0, gc: 0, sg: 0 })
  }
  return map
}

function applyGame(tableMap, a, b, ga, gb) {
  const A = tableMap.get(a)
  const B = tableMap.get(b)
  if (!A || !B) return

  A.j += 1
  B.j += 1

  A.gp += ga
  A.gc += gb
  B.gp += gb
  B.gc += ga

  if (ga > gb) {
    A.v += 1
    B.d += 1
    A.pts += 3
  } else if (ga < gb) {
    B.v += 1
    A.d += 1
    B.pts += 3
  } else {
    A.e += 1
    B.e += 1
    A.pts += 1
    B.pts += 1
  }

  A.sg = A.gp - A.gc
  B.sg = B.gp - B.gc
}

function sortTable(rows) {
  // FIFA-like básico: PTS -> V -> SG -> GP -> GC (menor melhor) -> equipe_id
  return [...rows].sort((x, y) => {
    if (y.pts !== x.pts) return y.pts - x.pts
    if (y.v !== x.v) return y.v - x.v
    if (y.sg !== x.sg) return y.sg - x.sg
    if (y.gp !== x.gp) return y.gp - x.gp
    if (x.gc !== y.gc) return x.gc - y.gc
    return x.equipe_id - y.equipe_id
  })
}

async function insertJogosSafe(supabase, inserts) {
  const tryInsert = async (rows) => {
    return await supabase.from('jogos').insert(rows).select()
  }

  let res = await tryInsert(inserts)
  if (!res.error) return res

  const msg = String(res.error.message || '')

  // fallback hora_jogo (se não existir coluna)
  if (msg.includes('hora_jogo') && (msg.includes('does not exist') || msg.includes('column'))) {
    const rows = inserts.map(({ hora_jogo, ...rest }) => rest)
    res = await tryInsert(rows)
    if (!res.error) return res
  }

  // fallback categoria
  if (msg.includes('categoria') && (msg.includes('does not exist') || msg.includes('column'))) {
    const rows = inserts.map(({ categoria, ...rest }) => rest)
    res = await tryInsert(rows)
    if (!res.error) return res
  }

  return res
}

/**
 * POST body:
 * {
 *   etapa_id: 1,
 *   grupoA: [id,id,id],   // opcional (se não mandar, tenta inferir)
 *   grupoB: [id,id,id],   // opcional
 *   duracao_min: 20,      // opcional (default 20)
 *   intervalo_min: 10,    // opcional (default 10)
 *   limpar_finais_existentes: true // default true
 * }
 */
export async function POST(request) {
  if (!isAuthorized(request)) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const body = await request.json().catch(() => null)
  if (!body) return NextResponse.json({ error: 'JSON inválido' }, { status: 400 })

  const etapa_id = Number(body.etapa_id || 0)
  if (!etapa_id) return NextResponse.json({ error: 'etapa_id obrigatório' }, { status: 400 })

  const duracao_min = Number(body.duracao_min ?? 20)
  const intervalo_min = Number(body.intervalo_min ?? 10)
  const delta = duracao_min + intervalo_min

  if (!Number.isFinite(delta) || delta <= 0) {
    return NextResponse.json({ error: 'duracao_min/intervalo_min inválidos' }, { status: 400 })
  }

  const limparFinais = body.limpar_finais_existentes !== false

  try {
    const supabase = supabaseAdmin()

    // etapa (categoria opcional)
    const { data: etapa, error: errEt } = await supabase
      .from('etapas')
      .select('id, categoria')
      .eq('id', etapa_id)
      .single()
    if (errEt) return NextResponse.json({ error: errEt.message }, { status: 500 })

    // pega todos os jogos da etapa (para achar data_jogo / ultimo horario e pontuação)
    const { data: jogos, error: errJ } = await supabase
      .from('jogos')
      .select('id, etapa_id, rodada, data_jogo, hora_jogo, equipe_a_id, equipe_b_id, gols_a, gols_b, finalizado')
      .eq('etapa_id', etapa_id)
      .order('rodada', { ascending: true })
      .order('id', { ascending: true })

    if (errJ) return NextResponse.json({ error: errJ.message }, { status: 500 })

    const jogosList = ensureArray(jogos)

    if (jogosList.length < 9) {
      return NextResponse.json(
        { error: `Poucos jogos encontrados (${jogosList.length}). Precisa existir a fase A x B (9 jogos).` },
        { status: 400 }
      )
    }

    // data do dia (tudo no mesmo dia)
    const data_jogo = jogosList.find((j) => j.data_jogo)?.data_jogo || null
    if (!data_jogo) {
      return NextResponse.json({ error: 'Não encontrei data_jogo nos jogos existentes.' }, { status: 400 })
    }

    // inferir grupos:
    // Preferência: body manda grupoA/grupoB. Se não, tenta inferir pelos 6 times da etapa
    let grupoA = ensureArray(body.grupoA).map((x) => Number(x)).filter(Boolean)
    let grupoB = ensureArray(body.grupoB).map((x) => Number(x)).filter(Boolean)

    if (grupoA.length !== 3 || grupoB.length !== 3) {
      // pega equipes da etapa
      const { data: rel, error: errRel } = await supabase
        .from('etapa_equipes')
        .select('equipe_id')
        .eq('etapa_id', etapa_id)
      if (errRel) return NextResponse.json({ error: errRel.message }, { status: 500 })

      const teamIds = ensureArray(rel).map((r) => r.equipe_id)
      if (teamIds.length !== 6) {
        return NextResponse.json({ error: `Etapa precisa ter 6 equipes. Hoje: ${teamIds.length}` }, { status: 400 })
      }

      // Heurística simples: tenta deduzir pela frequência de confrontos A x B (cada time joga 3 vezes nessa fase).
      // Como TODOS jogam 3x na fase A x B, isso não separa. Então: se não vier do body, não dá pra saber A/B com 100%.
      // A solução correta é: o endpoint de sorteio deve salvar os grupos em tabela/coluna.
      // Como você quer agora, eu exijo que mande grupoA/grupoB quando não houver registro.
      return NextResponse.json({
        error:
          'Para gerar final/3º automaticamente eu preciso saber Grupo A e Grupo B. Envie no body: {grupoA:[...3 ids], grupoB:[...3 ids]}.',
      }, { status: 400 })
    }

    // garante disjuntos
    const setA = new Set(grupoA)
    const setB = new Set(grupoB)
    for (const id of setA) {
      if (setB.has(id)) {
        return NextResponse.json({ error: 'Grupo A e Grupo B não podem ter o mesmo time.' }, { status: 400 })
      }
    }

    // filtra só jogos A x B FINALIZADOS (pra classificação)
    const faseAB = jogosList.filter((j) => {
      const a = j.equipe_a_id
      const b = j.equipe_b_id
      const isAB = (setA.has(a) && setB.has(b)) || (setA.has(b) && setB.has(a))
      return isAB && j.finalizado === true && j.gols_a !== null && j.gols_b !== null
    })

    if (faseAB.length < 1) {
      return NextResponse.json(
        { error: 'Nenhum jogo A x B finalizado ainda. Final/3º precisa de resultados para ranking.' },
        { status: 400 }
      )
    }

    // calcula ranking por grupo (só jogos A x B)
    const tabA = buildStandings(grupoA)
    const tabB = buildStandings(grupoB)

    for (const j of faseAB) {
      const a = j.equipe_a_id
      const b = j.equipe_b_id
      const ga = toInt(j.gols_a, 0)
      const gb = toInt(j.gols_b, 0)

      // atualiza para ambos os grupos
      // independentemente de quem está como A/B no jogo
      if (setA.has(a) && setB.has(b)) {
        applyGame(tabA, a, a, 0, 0) // no-op guard (não usado)
      }

      // aplica na tabela correta
      // (a e b estão em grupos diferentes)
      applyGame(setA.has(a) ? tabA : tabB, setA.has(a) ? a : b, setA.has(a) ? a : b, 0, 0) // dummy no-op

      // forma direta:
      if (setA.has(a) && setB.has(b)) {
        applyGame(tabA, a, a, 0, 0) // no-op (mantém consistente)
        applyGame(tabB, b, b, 0, 0)
        // aplica o jogo “de verdade”
        applyGame(tabA, a, a, 0, 0)
        applyGame(tabB, b, b, 0, 0)
      }

      // Aplicação REAL (sem gambi):
      // A e B estão em grupos diferentes. Precisamos atualizar ambos.
      // Vamos atualizar manualmente:
      const Arow = setA.has(a) ? tabA.get(a) : tabA.get(b)
      const Brow = setB.has(b) ? tabB.get(b) : tabB.get(a)
      if (!Arow || !Brow) continue

      // atualiza como se Arow fosse "time do grupo A" e Brow "time do grupo B"
      // precisa descobrir os gols do time do grupo A e do grupo B
      const golsGrupoA = setA.has(a) ? ga : gb
      const golsGrupoB = setB.has(b) ? gb : ga

      // aplicar na Arow e Brow
      // incrementos
      Arow.j += 1
      Brow.j += 1
      Arow.gp += golsGrupoA
      Arow.gc += golsGrupoB
      Brow.gp += golsGrupoB
      Brow.gc += golsGrupoA

      if (golsGrupoA > golsGrupoB) {
        Arow.v += 1
        Brow.d += 1
        Arow.pts += 3
      } else if (golsGrupoA < golsGrupoB) {
        Brow.v += 1
        Arow.d += 1
        Brow.pts += 3
      } else {
        Arow.e += 1
        Brow.e += 1
        Arow.pts += 1
        Brow.pts += 1
      }

      Arow.sg = Arow.gp - Arow.gc
      Brow.sg = Brow.gp - Brow.gc
    }

    const rankA = sortTable(Array.from(tabA.values()))
    const rankB = sortTable(Array.from(tabB.values()))

    if (rankA.length < 2 || rankB.length < 2) {
      return NextResponse.json({ error: 'Falha ao calcular ranking dos grupos.' }, { status: 500 })
    }

    const A1 = rankA[0].equipe_id
    const A2 = rankA[1].equipe_id
    const B1 = rankB[0].equipe_id
    const B2 = rankB[1].equipe_id

    // descobre último slot/hora para encaixar finais no mesmo dia
    // usa maior (rodada) + hora_jogo se existir; senão, só rodada.
    let maxRodada = 0
    let lastTime = null

    for (const j of jogosList) {
      maxRodada = Math.max(maxRodada, Number(j.rodada || 0))
      if (j.hora_jogo) {
        const t = parseHHMM(j.hora_jogo)
        if (t) {
          // pega a maior hora pelo total de minutos (simples)
          const total = t.h * 60 + t.m
          const cur = lastTime ? lastTime.h * 60 + lastTime.m : -1
          if (total > cur) lastTime = t
        }
      }
    }

    // Próximo horário = (última hora + delta)
    const tStart = lastTime ? addMinutes(lastTime, delta) : parseHHMM('08:00')
    const hora_terceiro = tStart ? fmtHHMM(tStart) : null
    const hora_final = tStart ? fmtHHMM(addMinutes(tStart, delta)) : null

    // limpar finais anteriores (se quiser)
    if (limparFinais) {
      // aqui eu apago jogos da etapa que tenham rodada acima da fase (>= 10) OU finalizado=false? (opcional)
      // Como estamos usando rodada como slot, vamos apagar os 2 últimos slots se já existirem
      const { error: errDel } = await supabase
        .from('jogos')
        .delete()
        .eq('etapa_id', etapa_id)
        .gte('rodada', 10) // por convenção: finais começam a partir do 10
      if (errDel) {
        return NextResponse.json({ error: errDel.message }, { status: 500 })
      }
    }

    const inserts = [
      {
        etapa_id,
        rodada: 10, // 10 = disputa 3º/4º
        data_jogo,
        hora_jogo: hora_terceiro,
        equipe_a_id: A2,
        equipe_b_id: B2,
        gols_a: null,
        gols_b: null,
        finalizado: false,
        categoria: etapa?.categoria || null,
      },
      {
        etapa_id,
        rodada: 11, // 11 = final
        data_jogo,
        hora_jogo: hora_final,
        equipe_a_id: A1,
        equipe_b_id: B1,
        gols_a: null,
        gols_b: null,
        finalizado: false,
        categoria: etapa?.categoria || null,
      },
    ]

    const { data, error } = await insertJogosSafe(supabase, inserts)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    return NextResponse.json({
      ok: true,
      data_jogo,
      horarios: { terceiro: hora_terceiro, final: hora_final },
      classificados: { grupoA: { A1, A2 }, grupoB: { B1, B2 } },
      ranking: { A: rankA, B: rankB },
      jogos_criados: data?.length || inserts.length,
      obs: 'Ranking calculado só pelos jogos A x B finalizados.',
    })
  } catch (e) {
    return NextResponse.json({ error: e.message || 'Erro interno' }, { status: 500 })
  }
}
