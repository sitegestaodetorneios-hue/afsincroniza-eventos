import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'
import { revalidateTag } from 'next/cache'

export const dynamic = 'force-dynamic'

function isAuthorized(request) {
  const pin = request.headers.get('x-admin-pin') || ''
  return pin === (process.env.ADMIN_PIN || '2026')
}

function supabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { persistSession: false } }
  )
}

export async function GET(request) {
  if (!isAuthorized(request)) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  const { searchParams } = new URL(request.url)
  const etapa_id = searchParams.get('etapa_id')

  const supabase = supabaseAdmin()
  const { data, error } = await supabase
    .from('jogos')
    .select(`
      *,
      equipeA:equipes!jogos_equipe_a_id_fkey(nome_equipe),
      equipeB:equipes!jogos_equipe_b_id_fkey(nome_equipe)
    `)
    .eq('etapa_id', etapa_id)
    .order('id', { ascending: true })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function POST(request) {
  if (!isAuthorized(request)) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  const body = await request.json()
  const supabase = supabaseAdmin()
  
  const { error } = await supabase.from('jogos').insert([body])
  
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // ✅ LIMPEZA DE CACHE ON-DEMAND: Novo jogo criado
  revalidateTag('jogos-ao-vivo')
  revalidateTag('tabela')

  return NextResponse.json({ ok: true })
}

export async function PUT(request) {
  if (!isAuthorized(request)) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  try {
    const supabase = supabaseAdmin()
    const body = await request.json()
    const { action, id } = body

    if (action === 'set_score') {
      await supabase.from('jogos').update({ 
          gols_a: body.gols_a, 
          gols_b: body.gols_b,
          penaltis_a: body.penaltis_a, 
          penaltis_b: body.penaltis_b
      }).eq('id', id)
    }
    
    if (action === 'set_status') {
      const isFinal = body.status === 'FINALIZADO'
      await supabase.from('jogos').update({ status: body.status, finalizado: isFinal }).eq('id', id)
    }
    
    if (action === 'update_info') {
      await supabase.from('jogos').update({ 
          data_jogo: body.data_jogo, 
          horario: body.horario, 
          arbitro: body.arbitro 
      }).eq('id', id)
    }

    // ✅ LIMPEZA DE CACHE ON-DEMAND: Placar, data ou status alterados
    revalidateTag('jogos-ao-vivo')
    revalidateTag('tabela')

    return NextResponse.json({ ok: true })
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}