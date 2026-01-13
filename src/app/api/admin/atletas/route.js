import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

function isAuthorized(request) {
  const pin = request.headers.get('x-admin-pin') || ''
  return pin && pin === (process.env.ADMIN_PIN || '2026')
}

function supabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new Error('Env ausente: NEXT_PUBLIC_SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY')
  return createClient(url, key, { auth: { persistSession: false } })
}

export async function GET(request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const equipe_id = Number(searchParams.get('equipe_id') || 0)
  if (!equipe_id) return NextResponse.json({ error: 'equipe_id obrigatório' }, { status: 400 })

  try {
    const supabase = supabaseAdmin()
    const { data, error } = await supabase
      .from('atletas')
      .select('id, nome, rg, numero_camisa, equipe_id')
      .eq('equipe_id', equipe_id)
      .order('numero_camisa', { ascending: true })

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json(data || [])
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
