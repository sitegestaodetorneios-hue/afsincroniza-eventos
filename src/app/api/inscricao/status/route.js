import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

// Impede qualquer tipo de cache do Next.js para garantir dados em tempo real
export const dynamic = 'force-dynamic'
export const revalidate = 0

export async function GET() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  )

  try {
    // 1. Busca as configurações de vagas na tabela config_site (gerenciada pelo Admin)
    const { data: config } = await supabase
      .from('config_site')
      .select('vagas_futsal, vagas_suiço')
      .eq('id', 1)
      .single()
    
    // 2. Converte os valores das colunas para números
    const totalFutsal = config ? Number(config.vagas_futsal) : 0
    const totalSociety = config ? Number(config.vagas_society) : 0

    // 3. Busca apenas as equipes pagas para contar as vagas ocupadas oficialmente
    // Nota: Você pode optar por contar todas ou apenas as pagas dependendo da sua regra de negócio.
    const { data: equipes } = await supabase
      .from('equipes')
      .select('modalidade')

    // 4. Contagem por modalidade (FUTSAL e SOCIETY/SUICO)
    const nFutsal = equipes?.filter(e => e.modalidade === 'FUTSAL').length || 0
    const nSociety = equipes?.filter(e => e.modalidade === 'SOCIETY' || e.modalidade === 'SUICO').length || 0

    // 5. Retorna o JSON com headers de proibição de cache
    const responseData = {
      futsal: {
        total: totalFutsal,
        ocupadas: nFutsal,
        restantes: Math.max(0, totalFutsal - nFutsal),
        esgotado: totalFutsal > 0 ? nFutsal >= totalFutsal : true
      },
      society: {
        total: totalSociety,
        ocupadas: nSociety,
        restantes: Math.max(0, totalSociety - nSociety),
        esgotado: totalSociety > 0 ? nSociety >= totalSociety : true
      }
    }

    return new NextResponse(JSON.stringify(responseData), {
      status: 200,
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
        'Content-Type': 'application/json',
        'Expires': '0',
        'Pragma': 'no-cache'
      }
    })

  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}