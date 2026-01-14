import { MercadoPagoConfig, Payment } from 'mercadopago'
import { NextResponse } from 'next/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const client = new MercadoPagoConfig({ accessToken: process.env.MP_ACCESS_TOKEN })

export async function POST(request) {
  try {
    const { nome_equipe, email, nome_capitao } = await request.json()

    const token = process.env.MP_ACCESS_TOKEN || ''
    if (!token) {
      return NextResponse.json({ error: 'MP_ACCESS_TOKEN não configurado' }, { status: 500 })
    }

    const isTestToken = token.startsWith('TEST-')

    // ✅ Se for TEST, MP exige buyer de TEST USER (não aceita email real)
    const payerEmail = isTestToken
      ? process.env.MP_TEST_PAYER_EMAIL
      : (email || 'ronaldo131ces@GamepadDirectional.com')

    if (isTestToken && !payerEmail) {
      return NextResponse.json(
        { error: 'MP_TEST_PAYER_EMAIL não configurado (crie um Test User Buyer no Mercado Pago e coloque o email aqui).' },
        { status: 500 }
      )
    }

    const payment = new Payment(client)

    const result = await payment.create({
      body: {
        transaction_amount: 150.0,
        description: `Inscrição: ${nome_equipe}`,
        payment_method_id: 'pix',
        payer: {
          email: payerEmail,
          first_name: nome_capitao || 'Capitao',
        },
      },
    })

    return NextResponse.json({
      qr_code: result.point_of_interaction.transaction_data.qr_code,
      qr_code_base64: result.point_of_interaction.transaction_data.qr_code_base64,
      id: result.id,
      mp_mode: isTestToken ? 'TEST' : 'PROD',
      payer_email_usado: payerEmail,
    })
  } catch (error) {
    console.error('Erro MP:', error)
    return NextResponse.json({ error: error.message, detail: error }, { status: 500 })
  }
}
