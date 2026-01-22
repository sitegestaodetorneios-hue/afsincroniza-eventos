import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import crypto from 'crypto'

function isUuid(v) {
  return typeof v === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v)
}

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!url) throw new Error('Env faltando: NEXT_PUBLIC_SUPABASE_URL')
  if (!key) throw new Error('Env faltando: SUPABASE_SERVICE_ROLE_KEY')

  return createClient(url, key, { auth: { persistSession: false } })
}

function sha256(s) {
  return crypto.createHash('sha256').update(String(s)).digest('hex')
}

async function validateToken(supabase, id, token) {
  if (!token) throw new Error('Token ausente (param t=...)')

  const token_hash = sha256(token)

  // ✅ valida id + token_hash em uma tacada (mais robusto)
  const { data: row, error } = await supabase
    .from('checklists')
    .select('id')
    .eq('id', id)
    .eq('token_hash', token_hash)
    .maybeSingle()

  if (error) throw new Error(error.message)
  if (!row) throw new Error('Checklist não encontrado ou token inválido')
  return true
}

export async function GET(req, { params }) {
  try {
    const supabase = getSupabase()
    const id = params.id

    // ✅ evita erro do Postgres com "undefined"
    if (!isUuid(id)) return NextResponse.json({ error: 'Checklist id inválido' }, { status: 400 })

    const { searchParams } = new URL(req.url)
    const t = searchParams.get('t') || ''

    await validateToken(supabase, id, t)

    const { data: row, error } = await supabase
      .from('checklists')
      .select('id,title,data,created_at,updated_at')
      .eq('id', id)
      .single()

    if (error) throw new Error(error.message)

    return NextResponse.json(row)
  } catch (e) {
    return NextResponse.json({ error: String(e.message || e) }, { status: 401 })
  }
}

export async function PUT(req, { params }) {
  try {
    const supabase = getSupabase()
    const id = params.id

    // ✅ evita erro do Postgres com "undefined"
    if (!isUuid(id)) return NextResponse.json({ error: 'Checklist id inválido' }, { status: 400 })

    const { searchParams } = new URL(req.url)
    const t = searchParams.get('t') || ''

    await validateToken(supabase, id, t)

    const body = await req.json().catch(() => ({}))
    if (!body?.data) throw new Error('data é obrigatório')

    const patch = { data: body.data }
    if (typeof body?.title === 'string' && body.title.trim()) patch.title = body.title.trim()

    const { data: row, error } = await supabase
      .from('checklists')
      .update(patch)
      .eq('id', id)
      .select('id,title,updated_at')
      .single()

    if (error) throw new Error(error.message)

    return NextResponse.json({ ok: true, ...row })
  } catch (e) {
    return NextResponse.json({ error: String(e.message || e) }, { status: 401 })
  }
}
