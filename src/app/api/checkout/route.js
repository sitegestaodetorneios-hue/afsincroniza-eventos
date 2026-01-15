import { MercadoPagoConfig, Payment } from 'mercadopago'
import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

const client = new MercadoPagoConfig({ accessToken: process.env.MP_ACCESS_TOKEN })

export async function POST(request) {
  try {
    const { nome_equipe, email, nome_capitao, modalidade } = await request.json()
    const emailLimpo = email.toLowerCase().trim()
    
    const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)
    const { data: config } = await supabase.from('config_site').select('*').single()

    const valorInscricao = modalidade === 'FUTSAL' 
      ? (config?.preco_futsal || 150.00) 
      : (config?.preco_society || 150.00)

    const payment = new Payment(client)

    // Monta o corpo do pagamento
    const paymentBody = {
      transaction_amount: Number(valorInscricao),
      description: `Inscrição ${modalidade}: ${nome_equipe}`,
      payment_method_id: 'pix',
      external_reference: emailLimpo,
      payer: {
        email: emailLimpo,
        first_name: nome_capitao || 'Professor',
      },
    }

    // SÓ ADICIONA NOTIFICATION_URL SE NÃO FOR LOCALHOST
    // Mercado Pago rejeita links 'localhost' ou sem HTTPS
    if (process.env.NEXT_PUBLIC_SITE_URL && process.env.NEXT_PUBLIC_SITE_URL.includes('https')) {
      paymentBody.notification_url = `${process.env.NEXT_PUBLIC_SITE_URL}/api/mp/webhook`
    }

    const result = await payment.create({ body: paymentBody })

    return NextResponse.json({
      qr_code: result.point_of_interaction.transaction_data.qr_code,
      qr_code_base64: result.point_of_interaction.transaction_data.qr_code_base64,
      id: result.id,
      valor: valorInscricao
    })
  } catch (error) {
    console.error('Erro detalhado MP:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}