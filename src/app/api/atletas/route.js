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

function onlyDigits(s) {
  return String(s || '').replace(/\D/g, '')
}

function isValidCPF(cpfRaw) {
  const cpf = onlyDigits(cpfRaw)
  if (cpf.length !== 11) return false
  if (/^(\d)\1{10}$/.test(cpf)) return false

  let sum = 0
  for (let i = 0; i < 9; i++) sum += parseInt(cpf[i], 10) * (10 - i)
  let d1 = 11 - (sum % 11)
  if (d1 >= 10) d1 = 0
  if (d1 !== parseInt(cpf[9], 10)) return false

  sum = 0
  for (let i = 0; i < 10; i++) sum += parseInt(cpf[i], 10) * (11 - i)
  let d2 = 11 - (sum % 11)
  if (d2 >= 10) d2 = 0
  if (d2 !== parseInt(cpf[10], 10)) return false

  return true
}

const TIPOS_VALIDOS = new Set(['ATLETA', 'TECNICO', 'AUX_TECNICO', 'PREP_GOLEIRO', 'PREP_FISICO'])
const LIMITES = {
  ATLETA: 16,
  TECNICO: 1,
  AUX_TECNICO: 1,
  PREP_GOLEIRO: 1,
  PREP_FISICO: 1,
}

function normalizeTipo(t) {
  const tipo = String(t || 'ATLETA').trim().toUpperCase()
  return TIPOS_VALIDOS.has(tipo) ? tipo : 'ATLETA'
}

async function getCountsByTipo(supabase, equipe_id) {
  const { data, error } = await supabase
    .from('atletas')
    .select('tipo')
    .eq('equipe_id', equipe_id)

  if (error) throw new Error(error.message)

  const counts = { ATLETA: 0, TECNICO: 0, AUX_TECNICO: 0, PREP_GOLEIRO: 0, PREP_FISICO: 0 }
  for (const row of data || []) {
    const t = normalizeTipo(row.tipo)
    counts[t] = (counts[t] || 0) + 1
  }
  return counts
}

async function camisaDuplicadaEntreAtletas(supabase, equipe_id, numero_camisa, ignoreId = null) {
  if (numero_camisa === null || numero_camisa === undefined || numero_camisa === '') return false

  let q = supabase
    .from('atletas')
    .select('id')
    .eq('equipe_id', equipe_id)
    .eq('tipo', 'ATLETA')
    .eq('numero_camisa', numero_camisa)
    .limit(1)

  if (ignoreId) q = q.neq('id', ignoreId)

  const { data, error } = await q
  if (error) throw new Error(error.message)
  return (data || []).length > 0
}

function validateDoc(rg) {
  const digits = onlyDigits(rg)
  if (digits.length < 7) return 'RG/CPF inválido (mín. 7 dígitos).'
  if (digits.length === 11 && !isValidCPF(digits)) return 'CPF inválido.'
  return null
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
      .select('id, nome, rg, numero_camisa, equipe_id, tipo')
      .eq('equipe_id', equipe_id)
      .order('tipo', { ascending: true })
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

    const tipo = normalizeTipo(body.tipo)
    const nome = String(body.nome || '').trim()
    const rg = String(body.rg || '').trim()

    if (!nome) return json({ error: 'nome obrigatório' }, { status: 400 })
    if (!rg) return json({ error: 'rg/cpf obrigatório' }, { status: 400 })

    const docErr = validateDoc(rg)
    if (docErr) return json({ error: docErr }, { status: 400 })

    // aceita numero_camisa ou camisa (compatível)
    const numero_camisa = toIntOrNull(body.numero_camisa ?? body.camisa)

    if (tipo === 'ATLETA' && (numero_camisa === null)) {
      return json({ error: 'Para ATLETA, numero_camisa é obrigatório' }, { status: 400 })
    }

    const supabase = supabaseAdmin()

    // Limites por tipo
    const counts = await getCountsByTipo(supabase, equipe_id)
    if ((counts[tipo] || 0) >= (LIMITES[tipo] ?? 999999)) {
      return json({ error: `Limite atingido para ${tipo} (${LIMITES[tipo]}).` }, { status: 400 })
    }

    // Camisa duplicada (somente entre ATLETAS)
    if (tipo === 'ATLETA') {
      const dup = await camisaDuplicadaEntreAtletas(supabase, equipe_id, numero_camisa, null)
      if (dup) return json({ error: `Já existe ATLETA com a camisa ${numero_camisa}.` }, { status: 400 })
    }

    const payload = {
      nome,
      rg,
      numero_camisa: (tipo === 'ATLETA') ? numero_camisa : (numero_camisa ?? null),
      equipe_id,
      tipo,
    }

    const { data, error } = await supabase
      .from('atletas')
      .insert([payload])
      .select('id, nome, rg, numero_camisa, equipe_id, tipo')
      .single()

    if (error) return json({ error: error.message }, { status: 500 })
    return json({ ok: true, atleta: data })
  } catch (e) {
    return json({ error: e?.message || 'Erro interno' }, { status: 500 })
  }
}

export async function PUT(request) {
  try {
    const body = await request.json().catch(() => null)
    if (!body) return json({ error: 'JSON inválido' }, { status: 400 })

    const id = Number(body.id || 0)
    const equipe_id = Number(body.equipe_id || 0)
    if (!Number.isFinite(id) || id <= 0) return json({ error: 'id obrigatório' }, { status: 400 })
    if (!Number.isFinite(equipe_id) || equipe_id <= 0) return json({ error: 'equipe_id obrigatório' }, { status: 400 })

    const tipo = normalizeTipo(body.tipo)
    const nome = String(body.nome || '').trim()
    const rg = String(body.rg || '').trim()

    if (!nome) return json({ error: 'nome obrigatório' }, { status: 400 })
    if (!rg) return json({ error: 'rg/cpf obrigatório' }, { status: 400 })

    const docErr = validateDoc(rg)
    if (docErr) return json({ error: docErr }, { status: 400 })

    const numero_camisa = toIntOrNull(body.numero_camisa ?? body.camisa)

    if (tipo === 'ATLETA' && numero_camisa === null) {
      return json({ error: 'Para ATLETA, numero_camisa é obrigatório' }, { status: 400 })
    }

    const supabase = supabaseAdmin()

    // Confere se o registro é da equipe (evita editar id de outra equipe)
    const { data: atual, error: errAtual } = await supabase
      .from('atletas')
      .select('id, equipe_id, tipo')
      .eq('id', id)
      .single()

    if (errAtual) return json({ error: errAtual.message }, { status: 500 })
    if (!atual || Number(atual.equipe_id) !== equipe_id) {
      return json({ error: 'Registro não pertence à equipe.' }, { status: 403 })
    }

    // Limites por tipo (se mudar tipo, precisa respeitar)
    if (normalizeTipo(atual.tipo) !== tipo) {
      const counts = await getCountsByTipo(supabase, equipe_id)
      // ao mudar tipo, você "libera" 1 do tipo antigo e ocupa 1 do novo
      const novoCount = (counts[tipo] || 0) + 1
      const limite = LIMITES[tipo] ?? 999999
      if (novoCount > limite) {
        return json({ error: `Limite atingido para ${tipo} (${limite}).` }, { status: 400 })
      }
    }

    // Camisa duplicada (somente entre atletas)
    if (tipo === 'ATLETA') {
      const dup = await camisaDuplicadaEntreAtletas(supabase, equipe_id, numero_camisa, id)
      if (dup) return json({ error: `Já existe ATLETA com a camisa ${numero_camisa}.` }, { status: 400 })
    }

    const payload = {
      nome,
      rg,
      tipo,
      numero_camisa: (tipo === 'ATLETA') ? numero_camisa : (numero_camisa ?? null),
    }

    const { data, error } = await supabase
      .from('atletas')
      .update(payload)
      .eq('id', id)
      .eq('equipe_id', equipe_id)
      .select('id, nome, rg, numero_camisa, equipe_id, tipo')
      .single()

    if (error) return json({ error: error.message }, { status: 500 })
    return json({ ok: true, atleta: data })
  } catch (e) {
    return json({ error: e?.message || 'Erro interno' }, { status: 500 })
  }
}

export async function DELETE(request) {
  try {
    const body = await request.json().catch(() => null)
    if (!body) return json({ error: 'JSON inválido' }, { status: 400 })

    const id = Number(body.id || 0)
    const equipe_id = Number(body.equipe_id || 0)
    if (!Number.isFinite(id) || id <= 0) return json({ error: 'id obrigatório' }, { status: 400 })
    if (!Number.isFinite(equipe_id) || equipe_id <= 0) return json({ error: 'equipe_id obrigatório' }, { status: 400 })

    const supabase = supabaseAdmin()

    const { error } = await supabase
      .from('atletas')
      .delete()
      .eq('id', id)
      .eq('equipe_id', equipe_id)

    if (error) return json({ error: error.message }, { status: 500 })
    return json({ ok: true })
  } catch (e) {
    return json({ error: e?.message || 'Erro interno' }, { status: 500 })
  }
}
