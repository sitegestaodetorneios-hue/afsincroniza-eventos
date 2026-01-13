import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'

export const dynamic = 'force-dynamic'

function supabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new Error('Env ausente: NEXT_PUBLIC_SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY')
  return createClient(url, key, { auth: { persistSession: false } })
}

function onlyDigits(v) {
  return (v || '').toString().replace(/\D/g, '')
}

function isEmail(v) {
  return /^\S+@\S+\.\S+$/.test(String(v || '').trim())
}

export async function POST(request) {
  let supabase
  try {
    supabase = supabaseAdmin()
  } catch (e) {
    return NextResponse.json({ erro: e.message }, { status: 500 })
  }

  let dados
  try {
    dados = await request.json()
  } catch {
    return NextResponse.json({ erro: 'JSON inválido' }, { status: 400 })
  }

  const nome_equipe = (dados.nome_equipe || '').trim()
  const cidade = (dados.cidade || '').trim()
  const nome_capitao = (dados.nome_capitao || '').trim()
  const email = (dados.email || '').trim().toLowerCase()
  const whatsapp = onlyDigits(dados.whatsapp)
  const senha = String(dados.senha || '')

  // ✅ validações básicas
  if (!nome_equipe || !nome_capitao || !email || !whatsapp || !senha) {
    return NextResponse.json({ erro: 'Preencha todos os campos obrigatórios.' }, { status: 400 })
  }
  if (!isEmail(email)) {
    return NextResponse.json({ erro: 'E-mail inválido.' }, { status: 400 })
  }
  if (whatsapp.length < 10) {
    return NextResponse.json({ erro: 'WhatsApp inválido. Informe DDD + número.' }, { status: 400 })
  }
  if (senha.length < 6) {
    return NextResponse.json({ erro: 'Senha muito curta (mínimo 6 caracteres).' }, { status: 400 })
  }

  // ✅ checa duplicidade (email OU nome_equipe)
  const { data: existingByEmail, error: errEmail } = await supabase
    .from('equipes')
    .select('id')
    .eq('email', email)
    .maybeSingle()

  if (errEmail) return NextResponse.json({ erro: errEmail.message }, { status: 500 })
  if (existingByEmail?.id) {
    return NextResponse.json({ erro: 'Já existe uma equipe cadastrada com este e-mail.' }, { status: 409 })
  }

  const { data: existingByName, error: errName } = await supabase
    .from('equipes')
    .select('id')
    .ilike('nome_equipe', nome_equipe)
    .maybeSingle()

  if (errName) return NextResponse.json({ erro: errName.message }, { status: 500 })
  if (existingByName?.id) {
    return NextResponse.json({ erro: 'Já existe uma equipe com este nome.' }, { status: 409 })
  }

  // ✅ hash da senha (não salvar em texto puro)
  const senha_hash = await bcrypt.hash(senha, 10)

  // ✅ salvar sem expor senha
  const payload = {
    nome_equipe,
    cidade,
    nome_capitao,
    whatsapp,
    email,
    senha_hash,
    pago: false,
  }

  const { data, error } = await supabase
    .from('equipes')
    .insert([payload])
    .select('id, nome_equipe, cidade, nome_capitao, whatsapp, email, pago, created_at')
    .single()

  if (error) {
    return NextResponse.json({ erro: error.message }, { status: 500 })
  }

  return NextResponse.json({ sucesso: true, equipe: data })
}
