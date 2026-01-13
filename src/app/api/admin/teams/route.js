import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

function isAuthorized(request) {
  const pin = request.headers.get('x-admin-pin') || ''
  return pin && pin === process.env.ADMIN_PIN
}

function supabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!url || !serviceRole) {
    throw new Error('Supabase env ausente: NEXT_PUBLIC_SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY')
  }

  return createClient(url, serviceRole, {
    auth: { persistSession: false },
  })
}

function sanitizeTeam(row) {
  if (!row) return row
  // remove campos perigosos caso existam
  const { senha, password, ...safe } = row
  return safe
}

export async function GET(request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  }

  let supabase
  try {
    supabase = supabaseAdmin()
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }

  const { data, error } = await supabase
    .from('equipes')
    .select('*')
    .order('created_at', { ascending: false })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  // não expor senha
  const safe = (data || []).map(sanitizeTeam)
  return NextResponse.json(safe)
}

export async function PUT(request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  }

  let supabase
  try {
    supabase = supabaseAdmin()
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }

  let body
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'JSON inválido' }, { status: 400 })
  }

  const { action, id } = body || {}
  if (!id || !action) {
    return NextResponse.json({ error: 'Parâmetros obrigatórios: action, id' }, { status: 400 })
  }

  if (!['delete', 'approve'].includes(action)) {
    return NextResponse.json({ error: 'Ação inválida' }, { status: 400 })
  }

  if (action === 'delete') {
    const { error } = await supabase.from('equipes').delete().eq('id', id)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  }

  if (action === 'approve') {
    const { error } = await supabase.from('equipes').update({ pago: true }).eq('id', id)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
