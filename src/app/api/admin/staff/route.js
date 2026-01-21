import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import crypto from 'crypto'

export const runtime = 'nodejs'

function supabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { persistSession: false } }
  )
}

function requireAdminPin(req) {
  const pin = req.headers.get('x-admin-pin') || ''
  if (pin !== '2026') throw new Error('PIN_INVALIDO')
}

const onlyDigits = (s) => String(s || '').replace(/\D/g, '')

function sha256hex(s) {
  return crypto.createHash('sha256').update(String(s)).digest('hex')
}

export async function GET(req) {
  try {
    requireAdminPin(req)
    const sb = supabaseAdmin()

    // pega staff (SEM cpf e SEM email_interno)
    const { data: staff, error: sErr } = await sb
      .from('staff_profiles')
      .select('id, user_id, nome, role, ativo, etapas_permitidas, created_at, cpf_last4')
      .order('created_at', { ascending: false })

    if (sErr) throw sErr

    // pega vínculos
    const ids = (staff || []).map(s => s.id)
    let vinc = []
    if (ids.length) {
      const { data: vData, error: vErr } = await sb
        .from('staff_etapas')
        .select('id, staff_id, role, etapa_id, etapas:etapa_id (id, titulo)')
        .in('staff_id', ids)
        .order('created_at', { ascending: false })
      if (vErr) throw vErr
      vinc = vData || []
    }

    const byStaff = new Map()
    for (const v of vinc) {
      const arr = byStaff.get(v.staff_id) || []
      arr.push({
        id: v.id,
        role: v.role,
        etapa_id: v.etapa_id,
        etapa_titulo: v.etapas?.titulo || `Etapa ${v.etapa_id}`
      })
      byStaff.set(v.staff_id, arr)
    }

    const out = (staff || []).map(s => ({
      ...s,
      cpf_last4: s.cpf_last4 || '',
      vinculos: byStaff.get(s.id) || []
    }))

    return NextResponse.json({ staff: out })
  } catch (e) {
    const msg = e.message || 'ERRO'
    const status = msg === 'PIN_INVALIDO' ? 401 : 500
    return NextResponse.json({ error: msg }, { status })
  }
}

export async function PATCH(req) {
  try {
    requireAdminPin(req)
    const sb = supabaseAdmin()
    const body = await req.json()

    const id = Number(body.id || 0)
    if (!id) return NextResponse.json({ error: 'id obrigatório' }, { status: 400 })

    const payload = {
      nome: body.nome !== undefined ? String(body.nome) : undefined,
      ativo: body.ativo === undefined ? undefined : Boolean(body.ativo)
    }

    // CPF opcional vindo do front como cpf_raw
    if (body.cpf_raw) {
      const cpf = onlyDigits(body.cpf_raw)
      if (cpf.length !== 11) {
        return NextResponse.json({ error: 'CPF inválido (precisa ter 11 dígitos)' }, { status: 400 })
      }
      payload.cpf_hash = sha256hex(cpf)
      payload.cpf_last4 = cpf.slice(-4)
    }

    // remove undefined para não sobrescrever sem querer
    Object.keys(payload).forEach(k => payload[k] === undefined && delete payload[k])

    const { data: updated, error: uErr } = await sb
      .from('staff_profiles')
      .update(payload)
      .eq('id', id)
      .select('id, user_id, nome, role, ativo, etapas_permitidas, created_at, cpf_last4')
      .single()

    if (uErr) throw uErr

    // reset de senha (opcional) - mantido comentado
    if (body.new_password) {
      // await sb.auth.admin.updateUserById(updated.user_id, { password: String(body.new_password) })
    }

    return NextResponse.json({ ok: true, staff: updated })
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

    // remove vínculos primeiro (por garantia)
    await sb.from('staff_etapas').delete().eq('staff_id', id)

    // remove perfil
    const { error } = await sb.from('staff_profiles').delete().eq('id', id)
    if (error) throw error

    return NextResponse.json({ ok: true })
  } catch (e) {
    const msg = e.message || 'ERRO'
    const status = msg === 'PIN_INVALIDO' ? 401 : 500
    return NextResponse.json({ error: msg }, { status })
  }
}
