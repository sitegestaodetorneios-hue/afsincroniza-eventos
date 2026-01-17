import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'
import { revalidateTag } from 'next/cache'

// Função para LEITURA (Pública)
function supabaseAnon() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    { auth: { persistSession: false } }
  )
}

// Função para ESCRITA (Admin - Permissão Total)
function supabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { persistSession: false } }
  )
}

// 1. GET (BUSCAR) - CACHE LONGO DE 1 HORA
export async function GET() {
  const supabase = supabaseAnon()
  
  try {
    const { data, error } = await supabase
        .from('patrocinios')
        .select('*')
        .eq('ativo', true) // Só traz os ativos
        .order('ordem', { ascending: true }) // Ordena pela posição
    
    if (error) throw error

    return NextResponse.json(data || [], {
        status: 200,
        headers: {
            // Cache de 1 HORA (3600s). Se o banco cair, segura por 1 dia (86400s).
            'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=86400',
            'x-nextjs-tags': 'patrocinios' // Etiqueta para limpeza
        }
    })
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

// 2. POST (CRIAR)
export async function POST(request) {
  const supabase = supabaseAdmin()
  
  try {
    const body = await request.json()
    const { error } = await supabase.from('patrocinios').insert([body])
    
    if (error) throw error

    // 🚀 LIMPA O CACHE DA HOME, TABELA E AO VIVO NA HORA
    revalidateTag('patrocinios')

    return NextResponse.json({ success: true })
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

// 3. PUT (EDITAR/REORDENAR) - Adicionei para você poder mudar a ordem
export async function PUT(request) {
  const supabase = supabaseAdmin()
  
  try {
    const body = await request.json()
    const { id, ...updates } = body

    if (!id) throw new Error('ID obrigatório para edição')

    const { error } = await supabase
        .from('patrocinios')
        .update(updates)
        .eq('id', id)
    
    if (error) throw error

    // 🚀 ATUALIZA O SITE INSTANTANEAMENTE
    revalidateTag('patrocinios')

    return NextResponse.json({ success: true })
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

// 4. DELETE (APAGAR)
export async function DELETE(request) {
  const supabase = supabaseAdmin()
  
  try {
    const { id } = await request.json()
    const { error } = await supabase.from('patrocinios').delete().eq('id', id)
    
    if (error) throw error

    // 🚀 REMOVE DO SITE NA HORA
    revalidateTag('patrocinios')

    return NextResponse.json({ success: true })
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}