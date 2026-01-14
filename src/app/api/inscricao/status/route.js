import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

function supabaseAnon() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    { auth: { persistSession: false } }
  )
}

export async function GET() {
  const supabase = supabaseAnon()

  try {
    // 1. Pega Configuração (Total de Vagas)
    const { data: config } = await supabase.from('config').select('*').single()
    
    // 2. Conta quantos times PAGOS existem por modalidade
    // FUTSAL
    const { count: ocupadasFutsal } = await supabase
      .from('equipes')
      .select('*', { count: 'exact', head: true })
      .eq('modalidade', 'FUTSAL')
      .eq('pago', true) // Só conta quem já pagou o PIX

    // SUÍÇO
    const { count: ocupadasSociety } = await supabase
      .from('equipes')
      .select('*', { count: 'exact', head: true })
      .eq('modalidade', 'SOCIETY') // ou SUICO, verifique como salvou no banco
      .eq('pago', true)

    // 3. Monta o objeto de resposta
    const totalFutsal = config?.vagas_futsal || 0
    const totalSociety = config?.vagas_society || 0

    return NextResponse.json({
      futsal: {
        total: totalFutsal,
        ocupadas: ocupadasFutsal || 0,
        restantes: Math.max(0, totalFutsal - (ocupadasFutsal || 0)),
        esgotado: (ocupadasFutsal || 0) >= totalFutsal
      },
      society: {
        total: totalSociety,
        ocupadas: ocupadasSociety || 0,
        restantes: Math.max(0, totalSociety - (ocupadasSociety || 0)),
        esgotado: (ocupadasSociety || 0) >= totalSociety
      }
    })

  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}