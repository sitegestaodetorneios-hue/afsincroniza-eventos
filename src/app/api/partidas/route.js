import { createClient } from '@supabase/supabase-js'

export const dynamic = 'force-static'
export const revalidate = 30

function supabasePublic() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url || !key) throw new Error('Env ausente: NEXT_PUBLIC_SUPABASE_URL ou NEXT_PUBLIC_SUPABASE_ANON_KEY')
  return createClient(url, key, { auth: { persistSession: false } })
}

function traduzirOrigem(texto) {
  if (!texto) return 'A definir'
  const t = String(texto)

  if (t.includes('RANKING|')) {
    try {
      const raw = t.split('|')[1]
      const [grp, pos] = raw.split(':')
      return `${Number(pos) + 1}º Grupo ${String(grp).trim().toUpperCase()}`
    } catch {
      return 'A definir'
    }
  }

  if (t.includes('JOGO_VENC|')) {
    try {
      const idx = Number(t.split(':')[1])
      return `Venc. Jogo ${idx + 1}`
    } catch {
      return 'A definir'
    }
  }

  return t
}

export async function GET(request) {
  const { searchParams } = new URL(request.url)
  const etapaIdParam = searchParams.get('etapa_id')

  let supabase
  try {
    supabase = supabasePublic()
  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), { status: 500 })
  }

  try {
    const { data: menu, error: errMenu } = await supabase
      .from('etapas')
      .select('*')
      .order('created_at', { ascending: false })

    if (errMenu) {
      return new Response(JSON.stringify({ error: errMenu.message }), { status: 500 })
    }

    const etapas = menu || []

    let etapaAtiva = null
    if (etapaIdParam) {
      etapaAtiva = etapas.find((e) => String(e.id) === String(etapaIdParam)) || null
    } else {
      etapaAtiva =
        etapas.find((e) => String(e.status).toUpperCase() === 'EM_ANDAMENTO') ||
        etapas[0] ||
        null
    }

    if (!etapaAtiva) {
      return new Response(JSON.stringify({ menu: etapas, etapa: null, jogos: [] }), {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'public, s-maxage=30, stale-while-revalidate=59',
          'Vary': 'Accept-Encoding',
        },
      })
    }

    const etapa_id = etapaAtiva.id

    const { data: jogosData, error: errJogos } = await supabase
      .from('jogos')
      .select('*')
      .eq('etapa_id', etapa_id)
      .order('rodada', { ascending: true })
      .order('horario', { ascending: true, nullsFirst: true })
      .order('id', { ascending: true })

    if (errJogos) {
      return new Response(JSON.stringify({ error: errJogos.message }), { status: 500 })
    }

    const listaJogos = jogosData || []

    // ✅ sem logo_url por enquanto
    const { data: equipes, error: errEq } = await supabase
      .from('equipes')
      .select('id, nome_equipe')

    if (errEq) {
      return new Response(JSON.stringify({ error: errEq.message }), { status: 500 })
    }

    const mapaEquipes = {}
    ;(equipes || []).forEach((eq) => {
      mapaEquipes[String(eq.id)] = eq
    })

    const jogosCompletos = listaJogos.map((j) => {
      const timeA = mapaEquipes[String(j.equipe_a_id)]
      const timeB = mapaEquipes[String(j.equipe_b_id)]

      return {
        ...j,
        equipeA: {
          nome_equipe: timeA ? timeA.nome_equipe : traduzirOrigem(j.origem_a),
          logo_url: null,
        },
        equipeB: {
          nome_equipe: timeB ? timeB.nome_equipe : traduzirOrigem(j.origem_b),
          logo_url: null,
        },
      }
    })

    const corpo = {
      menu: etapas,
      etapa: etapaAtiva,
      jogos: jogosCompletos,
      now: new Date().toISOString(),
    }

    return new Response(JSON.stringify(corpo), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'public, s-maxage=30, stale-while-revalidate=59',
        'Vary': 'Accept-Encoding',
      },
    })
  } catch (e) {
    return new Response(JSON.stringify({ error: e.message || 'Erro interno' }), { status: 500 })
  }
}
