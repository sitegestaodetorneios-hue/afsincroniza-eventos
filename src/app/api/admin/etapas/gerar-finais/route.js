import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

function isAuthorized(request) {
  const pin = request.headers.get('x-admin-pin') || ''
  return pin && pin === (process.env.ADMIN_PIN || '2026')
}

export async function POST(request) {
  if (!isAuthorized(request)) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const body = await request.json()
  const { etapa_id, data_final } = body

  if (!etapa_id) return NextResponse.json({ error: 'Etapa ID obrigatório' }, { status: 400 })

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  )

  try {
    // Chama a função RPC do banco de dados (aquela inteligência SQL)
    const { data, error } = await supabase.rpc('fn_gerar_finais', {
      p_etapa_id: Number(etapa_id),
      p_data_final: data_final || new Date().toISOString().split('T')[0] // Usa hoje se não passar data
    })

    if (error) throw error

    if (!data.ok) {
        return NextResponse.json({ error: data.error || 'Erro ao gerar finais' }, { status: 400 })
    }

    return NextResponse.json({ success: true, jogos_criados: data.jogos_criados })

  } catch (e) {
    console.error(e)
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}