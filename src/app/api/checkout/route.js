import { MercadoPagoConfig, Payment } from 'mercadopago'
import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

const client = new MercadoPagoConfig({ accessToken: process.env.MP_ACCESS_TOKEN })

export async function POST(request) {
  try {
    const body = await request.json().catch(() => ({}))
    const { equipe_id, nome_equipe, email, nome_capitao, modalidade } = body

    if (!equipe_id || !email || !nome_equipe || !modalidade) {
      return NextResponse.json({ error: 'Dados incompletos (equipe_id, email, nome_equipe, modalidade)' }, { status: 400 })
    }

    const emailLimpo = String(email).toLowerCase().trim()

    // ✅ ANON está OK aqui (só leitura da config)
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      { auth: { persistSession: false } }
    )

    const { data: config } = await supabase.from('config_site').select('*').single()

    const mod = String(modalidade).toUpperCase()
    const valorInscricao =
      mod === 'FUTSAL'
        ? Number(config?.preco_futsal || 150.0)
        : Number(config?.preco_society || 150.0)

    const payment = new Payment(client)

    const paymentBody = {
      transaction_amount: Number(valorInscricao),
      description: `Inscrição ${mod}: ${nome_equipe}`,
      payment_method_id: 'pix',

      // ✅ MELHOR: vincula pelo ID da equipe (não por email)
      external_reference: String(equipe_id),

      payer: {
        email: emailLimpo,
        first_name: nome_capitao || 'Professor',
      },
    }

    // notification_url só com HTTPS
    if (process.env.NEXT_PUBLIC_SITE_URL && process.env.NEXT_PUBLIC_SITE_URL.includes('https')) {
      paymentBody.notification_url = `${process.env.NEXT_PUBLIC_SITE_URL}/api/mp/webhook`
    }

    const result = await payment.create({ body: paymentBody })

    const tx = result?.point_of_interaction?.transaction_data || {}

    return NextResponse.json({
      qr_code: tx.qr_code,
      qr_code_base64: tx.qr_code_base64,
      id: result?.id,
      valor: valorInscricao,
      external_reference: String(equipe_id),
    })
  } catch (error) {
    console.error('Erro detalhado MP:', error)
    return NextResponse.json({ error: error?.message || 'Erro no checkout' }, { status: 500 })
  }
}
