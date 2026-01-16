import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'
import { revalidateTag } from 'next/cache'

export const dynamic = 'force-dynamic'

function isAuthorized(request) {
  const pin = request.headers.get('x-admin-pin') || ''
  return pin && pin === (process.env.ADMIN_PIN || '2026')
}

function supabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new Error('Env ausente')
  return createClient(url, key, { auth: { persistSession: false } })
}

function toIntOrNull(v) {
  if (v === undefined || v === null || v === '') return null
  const n = Number(v)
  return Number.isFinite(n) ? n : null
}

export async function GET(request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const jogo_id = Number(searchParams.get('jogo_id') || 0)
  if (!jogo_id) return NextResponse.json({ error: 'jogo_id obrigatório' }, { status: 400 })

  const supabase = supabaseAdmin()
  const { data, error } = await supabase
    .from('jogo_eventos')
    .select('*')
    .eq('jogo_id', jogo_id)
    .order('created_at', { ascending: true })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data || [])
}

export async function POST(request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  }

  const body = await request.json().catch(() => null)
  if (!body) return NextResponse.json({ error: 'JSON inválido' }, { status: 400 })

  const payload = {
    jogo_id: Number(body.jogo_id),
    equipe_id: Number(body.equipe_id),
    atleta_id: body.atleta_id ? Number(body.atleta_id) : null,
    tipo: String(body.tipo || '').toUpperCase(),
    minuto: toIntOrNull(body.minuto),
    tempo: body.tempo ? String(body.tempo) : null,
    observacao: body.observacao || null,
    camisa_no_jogo: toIntOrNull(body.camisa_no_jogo),
  }

  if (!payload.jogo_id || !payload.equipe_id || !payload.tipo) {
    return NextResponse.json(
      { error: 'Campos obrigatórios: jogo_id, equipe_id, tipo' },
      { status: 400 }
    )
  }

  const supabase = supabaseAdmin()
  const { data, error } = await supabase
    .from('jogo_eventos')
    .insert([payload])
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // ✅ LIMPEZA DE CACHE ON-DEMAND (Sincronizada)
  revalidateTag('jogos-ao-vivo') // Atualiza as páginas Partidas e Ao Vivo
  revalidateTag('tabela')        // Atualiza a Classificação e Artilharia

  return NextResponse.json({ ok: true, evento: data })
}

export async function DELETE(request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const id = Number(searchParams.get('id') || 0)
  if (!id) return NextResponse.json({ error: 'id obrigatório' }, { status: 400 })

  const supabase = supabaseAdmin()
  const { error } = await supabase.from('jogo_eventos').delete().eq('id', id)
  
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // ✅ LIMPEZA DE CACHE ON-DEMAND (Garantindo que a Tabela também atualize se remover um gol)
  revalidateTag('jogos-ao-vivo')
  revalidateTag('tabela')

  return NextResponse.json({ ok: true })
}