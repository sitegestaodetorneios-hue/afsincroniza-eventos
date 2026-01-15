import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

export async function GET(request) {
  const { searchParams } = new URL(request.url)
  const email = searchParams.get('email')

  if (!email) {
    return NextResponse.json({ pago: false }, { status: 400 })
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  )
  
  // Consulta apenas a coluna 'pago' para a equipe com este e-mail
  const { data } = await supabase
    .from('equipes')
    .select('pago')
    .eq('email', email.toLowerCase())
    .single()

  return NextResponse.json({ pago: data?.pago || false })
}