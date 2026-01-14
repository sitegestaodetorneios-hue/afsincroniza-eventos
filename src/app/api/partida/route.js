import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

function supabaseAnon() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url || !key) throw new Error('Env ausente')
  return createClient(url, key, { auth: { persistSession: false } })
}

function json(data, init = {}) {
  const res = NextResponse.json(data, init)
  res.headers.set('Cache-Control', 'no-store')
  return res
}

export async function GET(request) {
  const { searchParams } = new URL(request.url)
  const id = Number(searchParams.get('id') || 0)
  if (!id) return json({ error: 'id obrigatório' }, { status: 400 })

  let supabase
  try {
    supabase = supabaseAnon()
  } catch (e) {
    return json({ error: e.message }, { status: 500 })
  }

  const { data: jogo, error } = await supabase
    .from('jogos')
    .select(`
      id, etapa_id, rodada, data_jogo, hora_jogo, start_at,
      equipe_a_id, equipe_b_id, gols_a, gols_b, finalizado,
      equipeA:equipes!jogos_equipe_a_id_fkey(id, nome_equipe),
      equipeB:equipes!jogos_equipe_b_id_fkey(id, nome_equipe)
    `)
    .eq('id', id)
    .single()

  if (error) return json({ error: error.message }, { status: 500 })

  // eventos
  const { data: eventos, error: eEv } = await supabase
    .from('jogo_eventos')
    .select('id, jogo_id, equipe_id, atleta_id, tipo, minuto, tempo, observacao, camisa_no_jogo, created_at')
    .eq('jogo_id', id)
    .order('created_at', { ascending: true })

  if (eEv) return json({ error: eEv.message }, { status: 500 })

  // atletas dos 2 times (pra mostrar elenco)
  const [aA, aB] = await Promise.all([
    supabase.from('atletas').select('id, nome, numero_camisa').eq('equipe_id', jogo.equipe_a_id).order('numero_camisa', { ascending: true, nullsFirst: true }),
    supabase.from('atletas').select('id, nome, numero_camisa').eq('equipe_id', jogo.equipe_b_id).order('numero_camisa', { ascending: true, nullsFirst: true }),
  ])

  const atletasA = aA.data || []
  const atletasB = aB.data || []

  // mapa atleta -> nome + camisa
  const atletaMap = new Map()
  ;[...atletasA, ...atletasB].forEach((a) => atletaMap.set(a.id, a))

  // enriquece eventos (time_name e atleta_label)
  const nomeA = jogo?.equipeA?.nome_equipe || `Equipe ${jogo.equipe_a_id}`
  const nomeB = jogo?.equipeB?.nome_equipe || `Equipe ${jogo.equipe_b_id}`

  const evPlus = (eventos || []).map((ev) => {
    const teamName = ev.equipe_id === jogo.equipe_a_id ? nomeA : nomeB
    const atleta = ev.atleta_id ? atletaMap.get(ev.atleta_id) : null
    const camisa = ev.camisa_no_jogo ?? atleta?.numero_camisa ?? '-'
    const atletaLabel = atleta ? `#${camisa} ${atleta.nome}` : `#${camisa} —`
    return { ...ev, team_name: teamName, atleta_label: atletaLabel }
  })

  return json({ jogo, eventos: evPlus, atletasA, atletasB })
}
