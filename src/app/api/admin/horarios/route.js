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
  const m = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(String(hhmm || '').trim())
  if (!m) return null
  return { h: Number(m[1]), min: Number(m[2]) }
}

function addMinutes({ h, min }, delta) {
  const total = h * 60 + min + delta
  const h2 = Math.floor((total % (24 * 60) + (24 * 60)) % (24 * 60) / 60)
  const m2 = ((total % 60) + 60) % 60
  return { h: h2, min: m2 }
}

function fmt({ h, min }) {
  return `${String(h).padStart(2, '0')}:${String(min).padStart(2, '0')}:00`
}

export async function POST(request) {
  if (!isAuthorized(request)) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const body = await request.json().catch(() => null)
  if (!body) return NextResponse.json({ error: 'JSON inválido' }, { status: 400 })

  const etapa_id = Number(body.etapa_id || 0)
  const data_jogo = body.data_jogo || null // opcional: "2026-03-07"
  const inicio = parseHHMM(body.hora_inicio_base)
  const duracao = Number(body.duracao_min || 0)
  const intervalo = Number(body.intervalo_min ?? 0)

  if (!etapa_id) return NextResponse.json({ error: 'etapa_id obrigatório' }, { status: 400 })
  if (!inicio) return NextResponse.json({ error: 'hora_inicio_base inválida (use HH:MM)' }, { status: 400 })
  if (!duracao || duracao < 1) return NextResponse.json({ error: 'duracao_min inválida' }, { status: 400 })
  if (intervalo < 0) return NextResponse.json({ error: 'intervalo_min inválido' }, { status: 400 })

  try {
    const supabase = supabaseAdmin()

    // busca jogos (por etapa e opcionalmente por data)
    let q = supabase
      .from('jogos')
      .select('id, rodada, data_jogo')
      .eq('etapa_id', etapa_id)
      .order('rodada', { ascending: true })
      .order('id', { ascending: true })

    if (data_jogo) q = q.eq('data_jogo', data_jogo)

    const { data: jogos, error } = await q
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    if (!jogos || jogos.length === 0) {
      return NextResponse.json({ error: 'Nenhum jogo encontrado para gerar horários.' }, { status: 400 })
    }

    // gera horários sequenciais
    let curStart = inicio
    const updates = []

    for (const j of jogos) {
      const curEnd = addMinutes(curStart, duracao)
      updates.push({
        id: j.id,
        hora_inicio: fmt(curStart),
        hora_fim: fmt(curEnd),
      })
      curStart = addMinutes(curEnd, intervalo)
    }

    // aplica updates (15 jogos é tranquilo)
    for (const u of updates) {
      const { error: errU } = await supabase
        .from('jogos')
        .update({ hora_inicio: u.hora_inicio, hora_fim: u.hora_fim })
        .eq('id', u.id)

      if (errU) return NextResponse.json({ error: errU.message }, { status: 500 })
    }

    return NextResponse.json({ ok: true, jogos_atualizados: updates.length })
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
