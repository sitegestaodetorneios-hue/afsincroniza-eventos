import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const runtime = 'nodejs'

function supabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { persistSession: false } }
  )
}

// ✅ use o mesmo PIN admin que você já usa no projeto
function requireAdminPin(req) {
  const pin = req.headers.get('x-admin-pin') || ''
  if (pin !== '2026') throw new Error('PIN_INVALIDO')
}

export async function GET(req) {
  try {
    requireAdminPin(req)
    const sb = supabaseAdmin()

    const { searchParams } = new URL(req.url)
    const staff_id = Number(searchParams.get('staff_id') || 0)
    if (!staff_id) return NextResponse.json({ error: 'staff_id obrigatório' }, { status: 400 })

    const { data, error } = await sb
      .from('staff_etapas')
      .select('id, role, etapa_id, created_at, etapas:etapa_id (id, titulo, created_at)')
      .eq('staff_id', staff_id)
      .order('created_at', { ascending: false })

    if (error) throw error

    return NextResponse.json({ vinculos: data || [] })
  } catch (e) {
    const msg = e.message || 'ERRO'
    const status = msg === 'PIN_INVALIDO' ? 401 : 500
    return NextResponse.json({ error: msg }, { status })
  }
}

export async function POST(req) {
  try {
    requireAdminPin(req)
    const sb = supabaseAdmin()

    const body = await req.json()
    const staff_id = Number(body.staff_id || 0)
    const etapa_id = Number(body.etapa_id || 0)
    const role = String(body.role || 'ARBITRO').toUpperCase()

    if (!staff_id || !etapa_id) {
      return NextResponse.json({ error: 'staff_id e etapa_id obrigatórios' }, { status: 400 })
    }
    if (!['ARBITRO', 'ASSISTENTE', 'MESARIO'].includes(role)) {
      return NextResponse.json({ error: 'role inválido' }, { status: 400 })
    }

    const { error } = await sb.from('staff_etapas').insert([{
      staff_id,
      etapa_id,
      role
    }])

    if (error) throw error

    return NextResponse.json({ ok: true })
  } catch (e) {
    const msg = e.message || 'ERRO'
    const status = msg === 'PIN_INVALIDO' ? 401 : 500
    return NextResponse.json({ error: msg }, { status })
  }
}

export async function DELETE(req) {
  try {
    requireAdminPin(req)
    const sb = supabaseAdmin()

    const { searchParams } = new URL(req.url)
    const id = Number(searchParams.get('id') || 0)
    if (!id) return NextResponse.json({ error: 'id obrigatório' }, { status: 400 })

    const { error } = await sb.from('staff_etapas').delete().eq('id', id)
    if (error) throw error

    return NextResponse.json({ ok: true })
  } catch (e) {
    const msg = e.message || 'ERRO'
    const status = msg === 'PIN_INVALIDO' ? 401 : 500
    return NextResponse.json({ error: msg }, { status })
  }
}
