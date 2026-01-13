import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

function supabaseAnon() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url || !key) throw new Error('Env ausente: NEXT_PUBLIC_SUPABASE_URL ou NEXT_PUBLIC_SUPABASE_ANON_KEY')
  return createClient(url, key, { auth: { persistSession: false } })
}

export async function GET(request) {
  const { searchParams } = new URL(request.url)
  const etapaIdParam = searchParams.get('etapa_id')

  let supabase
  try {
    supabase = supabaseAnon()
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }

  // 1) escolhe etapa
  let etapa = null

  if (etapaIdParam) {
    const { data, error } = await supabase
      .from('etapas')
      .select('*')
      .eq('id', Number(etapaIdParam))
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    etapa = data
  } else {
    // pega a etapa mais recente EM_ANDAMENTO; se não existir, pega a última criada
    const { data, error } = await supabase
      .from('etapas')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(1)

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    etapa = data?.[0] || null
  }

  if (!etapa) {
    return NextResponse.json({ etapa: null, classificacao: [] })
  }

  // 2) busca a classificação
  const { data: classificacao, error: errCls } = await supabase
    .from('vw_classificacao')
    .select('*')
    .eq('etapa_id', etapa.id)
    .order('pos', { ascending: true })

  if (errCls) return NextResponse.json({ error: errCls.message }, { status: 500 })

  return NextResponse.json({
    etapa,
    classificacao: classificacao || [],
    vagas_grande_final: 1,
    obs: 'Liga (todos contra todos). Maior pontuação garante vaga na Grande Final.',
  })
}
