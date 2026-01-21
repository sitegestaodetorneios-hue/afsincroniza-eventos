import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import crypto from 'crypto'

export const runtime = 'nodejs'

function onlyDigits(s) { return String(s || '').replace(/\D/g, '') }

function cpfHash(cpfDigits) {
  const salt = process.env.STAFF_CPF_SALT || 'CHANGE_ME'
  return crypto.createHash('sha256').update(`${cpfDigits}|${salt}`).digest('hex')
}

export async function POST(req) {
  try {
    const body = await req.json()
    const { pin, nome, cpf, password, role, etapas_permitidas } = body || {}

    if (!pin || pin !== process.env.STAFF_CREATE_PIN) {
      return NextResponse.json({ error: 'PIN inválido' }, { status: 401 })
    }

    const cpfDigits = onlyDigits(cpf)
    if (!nome || !cpfDigits || cpfDigits.length !== 11 || !password || !role) {
      return NextResponse.json({ error: 'Dados incompletos (CPF 11 dígitos)' }, { status: 400 })
    }

    const roleUp = String(role).toUpperCase()
    if (!['ARBITRO', 'MESARIO'].includes(roleUp)) {
      return NextResponse.json({ error: 'Função inválida' }, { status: 400 })
    }

    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    )

    // Email interno aleatório (usuário não vê)
    const internalEmail = `staff_${crypto.randomUUID()}@staff.local`

    const { data: created, error: createErr } = await supabaseAdmin.auth.admin.createUser({
      email: internalEmail,
      password,
      email_confirm: true
    })
    if (createErr) throw createErr

    const etapas = Array.isArray(etapas_permitidas)
      ? etapas_permitidas.map(n => Number(n)).filter(Boolean)
      : []

    const hash = cpfHash(cpfDigits)
    const last4 = cpfDigits.slice(-4)

    const { error: profErr } = await supabaseAdmin
      .from('staff_profiles')
      .insert({
        user_id: created.user.id,
        nome,
        role: roleUp,
        ativo: true,
        etapas_permitidas: etapas,
        cpf_hash: hash,
        cpf_last4: last4
      })

    if (profErr) throw profErr

    return NextResponse.json({ ok: true })
  } catch (e) {
    console.error(e)
    return NextResponse.json({ error: e.message || 'Erro ao cadastrar' }, { status: 500 })
  }
}
