import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

function makeAnon() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url || !anon) throw new Error('Env ausente: NEXT_PUBLIC_SUPABASE_URL ou NEXT_PUBLIC_SUPABASE_ANON_KEY')
  return createClient(url, anon, { auth: { persistSession: false } })
}

function makeService() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const svc = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !svc) throw new Error('Env ausente: NEXT_PUBLIC_SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY')
  return createClient(url, svc, { auth: { persistSession: false } })
}

function isAuthorized(request) {
  const pinHeader = request.headers.get('x-admin-pin') || ''
  const adminPin = process.env.ADMIN_PIN || '2026'
  return pinHeader && pinHeader === adminPin
}

// remove chaves undefined para não sobrescrever sem querer
function compact(obj) {
  return Object.fromEntries(Object.entries(obj).filter(([, v]) => v !== undefined))
}

export async function GET() {
  let supabase
  try {
    supabase = makeAnon()
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }

  const { data, error } = await supabase
    .from('config_site')
    .select('*')
    .eq('id', 1)
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function PUT(request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  }

  let body
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'JSON inválido' }, { status: 400 })
  }

  let supabase
  try {
    supabase = makeService()
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }

  // --- MAPEAMENTO DE TODOS OS CAMPOS EDITÁVEIS ---
  const updates = compact({
    // 1. Identidade & Contato
    nome_competicao: body.nome_competicao,
    nome_empresa: body.nome_empresa,
    logo_url: body.logo_url,
    slogan: body.slogan,
    whatsapp: body.whatsapp,
    texto_empresa: body.texto_empresa,
    missao: body.missao,
    valores: body.valores,

    // 2. Status de Inscrição
    status_futsal: body.status_futsal,
    status_society: body.status_society,

    // 3. Hero Section (Capa)
    titulo_destaque: body.titulo_destaque,
    subtitulo: body.subtitulo,
    data_limite: body.data_limite,
    valor_premio: body.valor_premio,
    imagem_fundo: body.imagem_fundo,
    texto_topo: body.texto_topo,
    titulo_card_hero: body.titulo_card_hero,
    texto_card_hero: body.texto_card_hero,

    // 4. Configurações Futsal
    titulo_futsal: body.titulo_futsal,
    desc_futsal: body.desc_futsal,
    local_futsal: body.local_futsal,
    inicio_futsal: body.inicio_futsal,
    vagas_futsal: typeof body.vagas_futsal === 'number' ? body.vagas_futsal : undefined,
    preco_futsal: typeof body.preco_futsal === 'number' ? body.preco_futsal : undefined, // 👈 SALVANDO PREÇO DINÂMICO

    // 5. Configurações Society
    titulo_society: body.titulo_society,
    desc_society: body.desc_society,
    local_society: body.local_society,
    inicio_society: body.inicio_society,
    vagas_society: typeof body.vagas_society === 'number' ? body.vagas_society : undefined,
    preco_society: typeof body.preco_society === 'number' ? body.preco_society : undefined, // 👈 SALVANDO PREÇO DINÂMICO

    // 6. Títulos Gerais e Rodapé
    titulo_modalidades: body.titulo_modalidades,
    subtitulo_modalidades: body.subtitulo_modalidades,
    texto_footer: body.texto_footer,
  })

  const { error } = await supabase
    .from('config_site')
    .update(updates)
    .eq('id', 1)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}