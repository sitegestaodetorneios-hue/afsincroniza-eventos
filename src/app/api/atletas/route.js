import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function supabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new Error('Env ausente: NEXT_PUBLIC_SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY')
  return createClient(url, key, { auth: { persistSession: false } })
}

function json(data, init = {}) {
  const res = NextResponse.json(data, init)
  res.headers.set('Cache-Control', 'no-store')
  return res
}

function toIntOrNull(v) {
  if (v === undefined || v === null || v === '') return null
  const n = Number(v)
  if (!Number.isFinite(n)) return null
  return Math.trunc(n)
}

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url)
    const equipe_id = Number(searchParams.get('equipe_id') || 0)
    if (!Number.isFinite(equipe_id) || equipe_id <= 0) {
      return json({ error: 'equipe_id obrigatório' }, { status: 400 })
    }

    const supabase = supabaseAdmin()
    const { data, error } = await supabase
      .from('atletas')
      .select('id, nome, rg, numero_camisa, equipe_id')
      .eq('equipe_id', equipe_id)
      .order('numero_camisa', { ascending: true, nullsFirst: true })
      .order('nome', { ascending: true })

    if (error) return json({ error: error.message }, { status: 500 })
    return json(data || [])
  } catch (e) {
    return json({ error: e?.message || 'Erro interno' }, { status: 500 })
  }
}

export async function POST(request) {
  try {
    const body = await request.json().catch(() => null)
    if (!body) return json({ error: 'JSON inválido' }, { status: 400 })

    const equipe_id = Number(body.equipe_id || 0)
    if (!Number.isFinite(equipe_id) || equipe_id <= 0) {
      return json({ error: 'equipe_id obrigatório' }, { status: 400 })
    }

    const nome = String(body.nome || '').trim()
    const rg = String(body.rg || '').trim()
    if (!nome || !rg) return json({ error: 'nome e rg obrigatórios' }, { status: 400 })

    const payload = {
      nome,
      rg,
      numero_camisa: toIntOrNull(body.camisa),
      equipe_id,
    }

    const supabase = supabaseAdmin()
    const { data, error } = await supabase
      .from('atletas')
      .insert([payload])
      .select('id, nome, rg, numero_camisa, equipe_id')
      .single()

    if (error) return json({ error: error.message }, { status: 500 })
    return json({ ok: true, atleta: data })
  } catch (e) {
    return json({ error: e?.message || 'Erro interno' }, { status: 500 })
  }
}
