import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

// ❌ REMOVIDO 'force-dynamic' para permitir o Cache

function supabaseAnon() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url || !key) throw new Error('Env ausente')
  return createClient(url, key, { auth: { persistSession: false } })
}

export async function GET(request) {
  const { searchParams } = new URL(request.url)
  const id = Number(searchParams.get('id') || 0)

  // Se não tiver ID, retorna erro 400
  if (!id) return NextResponse.json({ error: 'id obrigatório' }, { status: 400 })

  let supabase
  try {
    supabase = supabaseAnon()
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }

  // 1. BUSCA O JOGO
  // Usamos * para garantir que pega tudo, mas mantemos os relacionamentos específicos das equipes
  const { data: jogo, error } = await supabase
    .from('jogos')
    .select(`
      *,
      equipeA:equipes!jogos_equipe_a_id_fkey(id, nome_equipe, logo_url),
      equipeB:equipes!jogos_equipe_b_id_fkey(id, nome_equipe, logo_url)
    `)
    .eq('id', id)
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // 2. BUSCAS PARALELAS (Eventos + Atletas A + Atletas B)
  // Fazemos tudo junto para ser mais rápido
  const [resEventos, resAtletasA, resAtletasB] = await Promise.all([
    supabase
      .from('jogo_eventos')
      .select('id, jogo_id, equipe_id, atleta_id, tipo, minuto, tempo, observacao, camisa_no_jogo, created_at')
      .eq('jogo_id', id)
      .order('created_at', { ascending: true }), // Ordem cronológica
    
    supabase
      .from('atletas')
      .select('id, nome, numero_camisa, equipe_id')
      .eq('equipe_id', jogo.equipe_a_id)
      .order('numero_camisa', { ascending: true, nullsFirst: true }),

    supabase
      .from('atletas')
      .select('id, nome, numero_camisa, equipe_id')
      .eq('equipe_id', jogo.equipe_b_id)
      .order('numero_camisa', { ascending: true, nullsFirst: true })
  ])

  // Tratamento de erros das paralelas (se houver, usamos array vazio)
  const eventos = resEventos.data || []
  const atletasA = resAtletasA.data || []
  const atletasB = resAtletasB.data || []

  // 3. PROCESSAMENTO (Lógica de formatar nomes para o Frontend)
  
  // Mapa para busca rápida de atleta por ID
  const atletaMap = new Map()
  ;[...atletasA, ...atletasB].forEach((a) => atletaMap.set(a.id, a))

  const nomeA = jogo?.equipeA?.nome_equipe || `Equipe ${jogo.equipe_a_id}`
  const nomeB = jogo?.equipeB?.nome_equipe || `Equipe ${jogo.equipe_b_id}`

  const evPlus = eventos.map((ev) => {
    const teamName = ev.equipe_id === jogo.equipe_a_id ? nomeA : nomeB
    const atleta = ev.atleta_id ? atletaMap.get(ev.atleta_id) : null
    
    // Prioridade: Camisa digitada no evento > Camisa do cadastro > Traço
    const camisa = ev.camisa_no_jogo ?? atleta?.numero_camisa ?? '-'
    
    // Monta o label: "#10 NEYMAR" ou "#10 —"
    const atletaLabel = atleta ? `#${camisa} ${atleta.nome}` : `#${camisa} —`
    
    return { ...ev, team_name: teamName, atleta_label: atletaLabel }
  })

  // 4. RETORNO COM CACHE 🛡️
  return NextResponse.json({
      jogo,
      eventos: evPlus,
      atletasA,
      atletasB
  }, {
      status: 200,
      headers: {
          // Cache de 30 segundos (igual ao resto do site)
          'Cache-Control': 'public, s-maxage=30, stale-while-revalidate=59',
      }
  })
}