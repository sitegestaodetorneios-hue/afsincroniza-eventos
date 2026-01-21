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
    if (cpfDigits.length !== 11) {
      return NextResponse.json({ error: 'CPF inválido' }, { status: 400 })
    }

    const cpf_hash = sha256hex(cpfDigits)

    const { data, error } = await sb
      .from('staff_profiles')
      .select('id, ativo')
      .eq('cpf_hash', cpf_hash)
      .maybeSingle()

    if (error) throw error
    if (!data?.id) return NextResponse.json({ error: 'CPF não cadastrado' }, { status: 404 })
    if (data.ativo === false) return NextResponse.json({ error: 'Usuário inativo' }, { status: 403 })

    return NextResponse.json({ email: makeEmailFromCPF(cpfDigits) })
  } catch (e) {
    return NextResponse.json({ error: e.message || 'ERRO' }, { status: 500 })
  }
}
