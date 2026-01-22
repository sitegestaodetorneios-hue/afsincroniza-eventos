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

export async function POST(req) {
  const supabase = getSupabase()
  const body = await req.json().catch(() => ({}))
  const title = (body?.title || 'Checklist TOTAL do Torneio').trim()

  // token “secreto” (vai ficar na URL)
  const token = crypto.randomBytes(24).toString('hex')
  const token_hash = sha256(token)

  // data inicial pode vir do client; se não vier, salva um esqueleto
  const data = body?.data ?? []

  const { data: row, error } = await supabase
    .from('checklists')
    .insert({ title, data, token_hash })
    .select('id,title,created_at,updated_at')
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 })
  }

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || ''
  const url = `${baseUrl}/admin/checklist?cid=${row.id}&t=${token}`

  return NextResponse.json({ id: row.id, token, url, title: row.title })
}
