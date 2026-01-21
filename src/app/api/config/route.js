import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

// ✅ Mantém cache pro público
// ✅ Admin (com PIN) sempre sem cache (não volta valores antigos)

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

function compact(obj) {
  return Object.fromEntries(Object.entries(obj).filter(([, v]) => v !== undefined))
}

function toNumberOrUndef(v) {
  if (v === null || v === undefined || v === '') return undefined
  if (typeof v === 'number' && Number.isFinite(v)) return v
  if (typeof v === 'string') {
    const cleaned = v
      .trim()
      .replace(/\./g, '')
      .replace(',', '.')
      .replace(/[^\d.-]/g, '')
    const n = Number(cleaned)
    return Number.isFinite(n) ? n : undefined
  }
  return undefined
}

export async function GET(request) {
  let supabase
  try {
    supabase = makeAnon()
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }

  const { searchParams } = new URL(request.url)
  const wantsAdmin = searchParams.get('admin') === '1'
  const adminOk = wantsAdmin && isAuthorized(request)

  const { data, error } = await supabase
    .from('config_site')
    .select('*')
    .eq('id', 1)
    .maybeSingle()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!data) return NextResponse.json({})

  if (adminOk) {
    return NextResponse.json(data, {
      status: 200,
      headers: { 'Cache-Control': 'no-store' }
    })
  }

  return NextResponse.json(data, {
    status: 200,
    headers: { 'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=86400' }
  })
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

    // Textos do Hero (layout novo)
    hero_headline: body.hero_headline,
    hero_tagline: body.hero_tagline,
    hero_badge: body.hero_badge,

    // 4. Configurações Futsal
    titulo_futsal: body.titulo_futsal,
    desc_futsal: body.desc_futsal,
    local_futsal: body.local_futsal,
    inicio_futsal: body.inicio_futsal,
    vagas_futsal: toNumberOrUndef(body.vagas_futsal),
    preco_futsal: toNumberOrUndef(body.preco_futsal),

    // 5. Configurações Society
    titulo_society: body.titulo_society,
    desc_society: body.desc_society,
    local_society: body.local_society,
    inicio_society: body.inicio_society,
    vagas_society: toNumberOrUndef(body.vagas_society),
    preco_society: toNumberOrUndef(body.preco_society),

    // 6. Títulos Gerais e Rodapé
    titulo_modalidades: body.titulo_modalidades,
    subtitulo_modalidades: body.subtitulo_modalidades,
    texto_footer: body.texto_footer,

    // 7. Campos de controle da inscrição
    inscricoes_abertas: body.inscricoes_abertas,
    inscricoes_futsal_abertas: body.inscricoes_futsal_abertas,
    inscricoes_society_abertas: body.inscricoes_society_abertas,
  })

  // ✅ UPDATE direto no id=1 (sem inserir id manualmente)
  const { data, error } = await supabase
    .from('config_site')
    .update(updates)
    .eq('id', 1)
    .select('*')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ success: true, config: data }, {
    status: 200,
    headers: { 'Cache-Control': 'no-store' }
  })
}
