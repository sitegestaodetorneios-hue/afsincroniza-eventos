import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import crypto from 'crypto'

function getSupabase() {
  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY

  if (!url) throw new Error('Env faltando: SUPABASE_URL (ou NEXT_PUBLIC_SUPABASE_URL)')
  if (!key) throw new Error('Env faltando: SUPABASE_SERVICE_ROLE_KEY')

  return createClient(url, key, { auth: { persistSession: false } })
}

function sha256(s) {
  return crypto.createHash('sha256').update(String(s)).digest('hex')
}

async function validateToken(supabase, id, token) {
  if (!token) throw new Error('Token ausente (param t=...)')

  const token_hash = sha256(token)

  const { data: row, error } = await supabase
    .from('checklists')
    .select('id, token_hash')
    .eq('id', id)
    .single()

  // ✅ agora mostra o erro real (ex.: "relation does not exist", "permission denied", etc.)
  if (error) throw new Error(error.message)
  if (!row) throw new Error('Checklist não encontrado')
  if (row.token_hash !== token_hash) throw new Error('Token inválido')

  return true
}

export async function GET(req, { params }) {
  try {
    const supabase = getSupabase()
    const id = params.id
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
    const { searchParams } = new URL(req.url)
    const t = searchParams.get('t') || ''

    await validateToken(supabase, id, t)

    const body = await req.json()
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
