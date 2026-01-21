import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const runtime = 'nodejs'

function supabaseAnon() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    { auth: { persistSession: false } }
  )
}

function supabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { persistSession: false } }
  )
}

async function requireStaff(req) {
  const auth = req.headers.get('authorization') || ''
  const token = auth.toLowerCase().startsWith('bearer ') ? auth.slice(7) : ''
  if (!token) throw new Error('NO_TOKEN')

  const sbAnon = supabaseAnon()
  const { data: u, error: uErr } = await sbAnon.auth.getUser(token)
  if (uErr || !u?.user) throw new Error('BAD_TOKEN')

  const sbAdmin = supabaseAdmin()
  const { data: staff, error: sErr } = await sbAdmin
    .from('staff_profiles')
    .select('*')
    .eq('user_id', u.user.id)
    .single()

  if (sErr || !staff) throw new Error('NOT_STAFF')
  if (staff.ativo === false) throw new Error('INACTIVE')

  return { sbAdmin }
}

export async function GET(req) {
  try {
    const { sbAdmin } = await requireStaff(req)
    const { searchParams } = new URL(req.url)
    const equipe_id = Number(searchParams.get('equipe_id') || 0)
    if (!equipe_id) return NextResponse.json({ error: 'equipe_id obrigatório' }, { status: 400 })

    const { data, error } = await sbAdmin
      .from('atletas')
      .select('id,nome,numero_camisa,equipe_id,tipo')
      .eq('equipe_id', equipe_id)
      .eq('tipo', 'ATLETA')
      .order('nome', { ascending: true })

    if (error) throw error
    return NextResponse.json(data || [])
  } catch (e) {
    const code = e.message || ''
    const status = (code === 'NO_TOKEN' || code === 'BAD_TOKEN') ? 401 : 500
    return NextResponse.json({ error: code }, { status })
  }
}
