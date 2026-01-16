import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'
import { revalidateTag } from 'next/cache' // ✅ IMPORTADO

function supabaseAdmin() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)
}

export async function GET() {
  const supabase = supabaseAdmin()
  const { data, error } = await supabase.from('patrocinios').select('*').order('ordem', { ascending: true })
  
  // ✅ RESPOSTA COM CACHE PARA TODAS AS PÁGINAS
  return NextResponse.json(data || [], {
    headers: {
        'Cache-Control': 's-maxage=60, stale-while-revalidate=300',
        'x-nextjs-tags': 'patrocinios' // Tag compartilhada (Home, Tabela, Ao Vivo usam essa)
    }
  })
}

export async function POST(request) {
  const supabase = supabaseAdmin()
  const body = await request.json()
  const { data, error } = await supabase.from('patrocinios').insert([body])
  
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // ✅ LIMPA O CACHE DE TODOS OS LUGARES QUE MOSTRAM PATROCÍNIO
  revalidateTag('patrocinios')

  return NextResponse.json({ success: true })
}

export async function DELETE(request) {
  const { id } = await request.json()
  const supabase = supabaseAdmin()
  const { error } = await supabase.from('patrocinios').delete().eq('id', id)
  
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // ✅ LIMPA O CACHE SE REMOVER UM PATROCINADOR
  revalidateTag('patrocinios')

  return NextResponse.json({ success: true })
}