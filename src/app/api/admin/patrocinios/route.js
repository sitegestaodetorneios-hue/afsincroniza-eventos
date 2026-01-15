import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

function supabaseAdmin() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)
}

export async function GET() {
  const supabase = supabaseAdmin()
  const { data, error } = await supabase.from('patrocinios').select('*').order('ordem', { ascending: true })
  return NextResponse.json(data || [])
}

export async function POST(request) {
  const supabase = supabaseAdmin()
  const body = await request.json()
  const { data, error } = await supabase.from('patrocinios').insert([body])
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}

export async function DELETE(request) {
  const { id } = await request.json()
  const supabase = supabaseAdmin()
  await supabase.from('patrocinios').delete().eq('id', id)
  return NextResponse.json({ success: true })
}