import { MercadoPagoConfig, Payment } from 'mercadopago'
import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'

const client = new MercadoPagoConfig({ accessToken: process.env.MP_ACCESS_TOKEN })

function supabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new Error('Env ausente: NEXT_PUBLIC_SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY')
  return createClient(url, key, { auth: { persistSession: false } })
}

function isEmail(v) {
  return /^\S+@\S+\.\S+$/.test(String(v || '').trim())
}

function baseUrl() {
  // Vercel: https://<projeto>.vercel.app
  // Local: http://localhost:3000
  return process.env.PUBLIC_SITE_URL || 'http://localhost:3000'
}

export async function POST(request) {
  try {
    const { nome_equipe, email, nome_capitao } = await request.json()

    if (!nome_equipe) return NextResponse.json({ error: 'nome_equipe obrigatório' }, { status: 400 })

    const payerEmail = isEmail(email) ? email : 'email_teste@test.com'
    const payment = new Payment(client)

    // referência única (ajuda a rastrear no webhook)
    const external_reference = `insc_${Date.now()}_${Math.floor(Math.random() * 100000)}`

    const result = await payment.create({
      body: {
        transaction_amount: 150.0,
        description: `Inscrição: ${nome_equipe}`,
        payment_method_id: 'pix',
        external_reference,

        // 🔔 Webhook
        notification_url: `${baseUrl()}/api/mp/webhook`,

        payer: {
          email: payerEmail,
          first_name: (nome_capitao || 'Capitão').split(' ')[0],
          last_name: (nome_capitao || '').split(' ').slice(1).join(' ') || undefined,
        },
      },
    })

    // ✅ salva no banco (opcional mas recomendado)
    // cria tabela pagamentos ou salva em equipes (melhor: tabela pagamentos)
    try {
      const supabase = supabaseAdmin()
      await supabase.from('pagamentos').insert([{
        mp_payment_id: result.id,
        external_reference,
        nome_equipe,
        email: payerEmail,
        status: result.status,
        transaction_amount: 150.0,
        qr_code: result?.point_of_interaction?.transaction_data?.qr_code || null,
        created_at: new Date().toISOString(),
      }])
    } catch (e) {
      // não quebra o checkout se o save falhar (mas loga)
      console.error('Falha ao salvar pagamento no Supabase:', e?.message || e)
    }

    return NextResponse.json({
      qr_code: result.point_of_interaction.transaction_data.qr_code,
      qr_code_base64: result.point_of_interaction.transaction_data.qr_code_base64,
      id: result.id,
      status: result.status,
      external_reference,
    })
  } catch (error) {
    console.error('Erro MP:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
