import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import crypto from 'crypto'

export const runtime = 'nodejs'

function supabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { persistSession: false } }
  )
}

const onlyDigits = (s) => String(s || '').replace(/\D/g, '')
const makeEmailFromCPF = (cpfDigits) => `${cpfDigits}@staff.local`

function sha256hex(s) {
  return crypto.createHash('sha256').update(String(s)).digest('hex')
}

export async function POST(req) {
  try {
    const sb = supabaseAdmin()
    const body = await req.json()

    const cpfDigits = onlyDigits(body.cpf)
    const nome = String(body.nome || '').trim()
    const password = String(body.password || '')
    const role = String(body.role || 'ARBITRO').toUpperCase()

    if (cpfDigits.length !== 11) {
      return NextResponse.json({ error: 'CPF inválido (precisa ter 11 dígitos).' }, { status: 400 })
    }
    if (nome.length < 3) {
      return NextResponse.json({ error: 'Informe seu nome (mínimo 3 letras).' }, { status: 400 })
    }
    if (password.length < 6) {
      return NextResponse.json({ error: 'Senha muito curta (mínimo 6 caracteres).' }, { status: 400 })
    }
    if (!['ARBITRO', 'ASSISTENTE', 'MESARIO'].includes(role)) {
      return NextResponse.json({ error: 'Role inválido.' }, { status: 400 })
    }

    const cpf_hash = sha256hex(cpfDigits)
    const cpf_last4 = cpfDigits.slice(-4)
    const email = makeEmailFromCPF(cpfDigits)

    // já existe?
    const { data: exists, error: exErr } = await sb
      .from('staff_profiles')
      .select('id')
      .eq('cpf_hash', cpf_hash)
      .maybeSingle()

    if (exErr) throw exErr
    if (exists?.id) {
      return NextResponse.json({ error: 'CPF já cadastrado. Faça login.' }, { status: 409 })
    }

    // cria usuário no Auth (email fictício baseado no CPF)
    const { data: created, error: cErr } = await sb.auth.admin.createUser({
      email,
      password,
      email_confirm: true
    })

    if (cErr) {
      // se já existir no Auth, avisa para fazer login
      return NextResponse.json({ error: 'Usuário já existe. Faça login.' }, { status: 409 })
    }

    const user_id = created?.user?.id
    if (!user_id) {
      return NextResponse.json({ error: 'Falha ao criar usuário.' }, { status: 500 })
    }

    const { error: iErr } = await sb
      .from('staff_profiles')
      .insert([{
        user_id,
        nome,
        role,
        ativo: true,
        cpf_hash,
        cpf_last4
      }])

    if (iErr) throw iErr

    return NextResponse.json({ ok: true, email })
  } catch (e) {
    return NextResponse.json({ error: e.message || 'ERRO' }, { status: 500 })
  }
}
