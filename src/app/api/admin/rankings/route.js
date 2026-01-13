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
  if (!url || !key) throw new Error('Env ausente')
  return createClient(url, key, { auth: { persistSession: false } })
}

export async function GET(request) {
  if (!isAuthorized(request)) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const etapa_id = Number(searchParams.get('etapa_id') || 0)
  if (!etapa_id) return NextResponse.json({ error: 'etapa_id obrigatório' }, { status: 400 })

  try {
    const supabase = supabaseAdmin()

    const [cls, art, disc] = await Promise.all([
      supabase.from('vw_classificacao').select('*').eq('etapa_id', etapa_id).order('pos', { ascending: true }),
      supabase.from('vw_artilheiros').select('*').eq('etapa_id', etapa_id).order('gols', { ascending: false }),
      supabase.from('vw_disciplina').select('*').eq('etapa_id', etapa_id),
    ])

    if (cls.error) return NextResponse.json({ error: cls.error.message }, { status: 500 })
    if (art.error) return NextResponse.json({ error: art.error.message }, { status: 500 })
    if (disc.error) return NextResponse.json({ error: disc.error.message }, { status: 500 })

    // menos vazado = menor gc (com pelo menos 1 jogo)
    const menosVazado = (cls.data || [])
      .filter((r) => (r.j || 0) > 0)
      .sort((a, b) => (a.gc ?? 0) - (b.gc ?? 0))
      .slice(0, 5)

    return NextResponse.json({
      classificacao: cls.data || [],
      artilharia: (art.data || []).slice(0, 20),
      disciplina: (disc.data || []).slice(0, 20),
      menosVazado,
    })
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
