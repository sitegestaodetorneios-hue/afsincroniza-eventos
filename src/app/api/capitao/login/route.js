import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import crypto from 'crypto'

export const dynamic = 'force-dynamic'

function supabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new Error('Env ausente: NEXT_PUBLIC_SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY')
  return createClient(url, key, { auth: { persistSession: false } })
}

function isEmail(v) {
  return /^\S+@\S+\.\S+$/.test(String(v || '').trim())
}

function signSession(payloadObj) {
  const secret = process.env.SESSION_SECRET || 'change-me'
  const payload = Buffer.from(JSON.stringify(payloadObj)).toString('base64url')
  const sig = crypto.createHmac('sha256', secret).update(payload).digest('base64url')
  return `${payload}.${sig}`
}

export async function POST(request) {
  let body
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'JSON inválido' }, { status: 400 })
  }

  const email = String(body.email || '').trim().toLowerCase()
  const senha = String(body.senha || '')

  if (!email || !senha) return NextResponse.json({ error: 'Informe e-mail e senha.' }, { status: 400 })
  if (!isEmail(email)) return NextResponse.json({ error: 'E-mail inválido.' }, { status: 400 })

  let supabase
  try {
    supabase = supabaseAdmin()
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }

  const { data: equipe, error } = await supabase
    .from('equipes')
    .select('id, nome_equipe, cidade, nome_capitao, whatsapp, email, pago, created_at, senha_hash, senha, termo_url, termo_assinado, modalidade')
    .eq('email', email)
    .maybeSingle()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!equipe) return NextResponse.json({ error: 'E-mail ou senha incorretos.' }, { status: 401 })

  let senhaValida = false;

  // LÓGICA DE SENHA AJUSTADA:
  // 1. Tenta comparar como texto puro primeiro (para os registros que acabamos de fazer)
  if (equipe.senha_hash === senha || equipe.senha === senha) {
    senhaValida = true;
    
    // Opcional: Se logou com texto puro, vamos gerar o hash agora para segurança futura
    const newHash = await bcrypt.hash(senha, 10);
    await supabase.from('equipes').update({ senha_hash: newHash }).eq('id', equipe.id);
  } 
  // 2. Se não for texto puro, tenta comparar usando bcrypt (para registros antigos ou já convertidos)
  else if (equipe.senha_hash && equipe.senha_hash.startsWith('$2')) {
    senhaValida = await bcrypt.compare(senha, equipe.senha_hash);
  }

  if (!senhaValida) {
    return NextResponse.json({ error: 'E-mail ou senha incorretos.' }, { status: 401 })
  }

  // GERAÇÃO DE SESSÃO
  const session = signSession({
    equipe_id: equipe.id,
    exp: Date.now() + 1000 * 60 * 60 * 24 * 7, 
  })

  const safe = {
    id: equipe.id,
    nome_equipe: equipe.nome_equipe,
    cidade: equipe.cidade,
    nome_capitao: equipe.nome_capitao,
    whatsapp: equipe.whatsapp,
    email: equipe.email,
    pago: Boolean(equipe.pago),
    created_at: equipe.created_at,
    termo_url: equipe.termo_url,
    termo_assinado: Boolean(equipe.termo_assinado),
    modalidade: equipe.modalidade
  }

  const res = NextResponse.json({ ok: true, equipe: safe })
  res.cookies.set('cap_session', session, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 60 * 60 * 24 * 7,
  })
  
  return res
}