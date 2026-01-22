import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import crypto from 'crypto'

function getSupabase() {
  const url = process.env.SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new Error('SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY não configurados')
  return createClient(url, key, { auth: { persistSession: false } })
}

function sha256(s) {
  return crypto.createHash('sha256').update(String(s)).digest('hex')
}

async function validateTokenOrThrow(supabase, id, token) {
  if (!token) throw new Error('Token ausente')
  const token_hash = sha256(token)

  const { data: row, error } = await supabase
    .from('checklists')
    .select('id, token_hash')
    .eq('id', id)
    .single()

  if (error || !row) throw new Error('Checklist não encontrado')
  if (row.token_hash !== token_hash) throw new Error('Token inválido')

  return true
}

export async function GET(req, { params }) {
  const supabase = getSupabase()
  const id = params.id
  const { searchParams } = new URL(req.url)
  const t = searchParams.get('t') || ''

  try {
    await validateTokenOrThrow(supabase, id, t)
    const { data: row, error } = await supabase
      .from('checklists')
      .select('id,title,data,created_at,updated_at')
      .eq('id', id)
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 400 })
    return NextResponse.json(row)
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 401 })
  }
}

export async function PUT(req, { params }) {
  const supabase = getSupabase()
  const id = params.id
  const { searchParams } = new URL(req.url)
  const t = searchParams.get('t') || ''

  try {
    await validateTokenOrThrow(supabase, id, t)

    const body = await req.json()
    const title = typeof body?.title === 'string' ? body.title.trim() : undefined
    const data = body?.data

    if (!data) return NextResponse.json({ error: 'data é obrigatório' }, { status: 400 })

    const patch = { data }
    if (title) patch.title = title

    const { data: row, error } = await supabase
      .from('checklists')
      .update(patch)
      .eq('id', id)
      .select('id,title,updated_at')
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 400 })
    return NextResponse.json({ ok: true, ...row })
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 401 })
  }
}
