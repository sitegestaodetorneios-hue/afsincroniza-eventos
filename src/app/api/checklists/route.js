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

export async function POST(req) {
  try {
    const supabase = getSupabase()
    const body = await req.json().catch(() => ({}))
    const title = (body?.title || 'Checklist TOTAL do Torneio').trim()
    const data = body?.data ?? []

    const token = crypto.randomBytes(24).toString('hex')
    const token_hash = sha256(token)

    const { data: row, error } = await supabase
      .from('checklists')
      .insert({ title, data, token_hash })
      .select('id,title,created_at,updated_at')
      .single()

    if (error) throw new Error(error.message)

    return NextResponse.json({ id: row.id, token, title: row.title })
  } catch (e) {
    return NextResponse.json({ error: String(e.message || e) }, { status: 500 })
  }
}
