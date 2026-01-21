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

  return { sbAdmin, staff, user: u.user }
}

export async function GET(req) {
  try {
    const { sbAdmin, staff } = await requireStaff(req)

    // ✅ pega etapas via staff_etapas
    const { data, error } = await sbAdmin
      .from('staff_etapas')
      .select('role, etapas:etapa_id (id, titulo, regras, created_at)')
      .eq('staff_id', staff.id)
      .order('created_at', { ascending: false })

    if (error) throw error

    // agrupa roles por etapa
    const map = new Map()
    for (const row of (data || [])) {
      const etapa = row.etapas
      if (!etapa) continue

      const key = String(etapa.id)
      const cur = map.get(key) || { ...etapa, roles: [] }
      cur.roles = Array.from(new Set([...(cur.roles || []), String(row.role).toUpperCase()]))
      map.set(key, cur)
    }

    return NextResponse.json({ etapas: Array.from(map.values()) })
  } catch (e) {
    const code = e.message || ''
    const status =
      code === 'NO_TOKEN' || code === 'BAD_TOKEN' ? 401 :
      code === 'NOT_STAFF' || code === 'INACTIVE' ? 403 : 500
    return NextResponse.json({ error: code }, { status })
  }
}
