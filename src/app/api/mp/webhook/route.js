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

export async function POST(request) {
  try {
    const body = await request.json().catch(() => ({}))

    // MP manda variações. O mais comum é:
    // { "type":"payment", "data": { "id": "123" } }
    const paymentId = body?.data?.id || body?.id
    const type = body?.type || body?.topic

    if (!paymentId) {
      return NextResponse.json({ ok: true, ignored: true })
    }

    // só processa pagamentos
    if (type && String(type).toLowerCase() !== 'payment') {
      return NextResponse.json({ ok: true, ignored: true })
    }

    const payment = new Payment(client)
    const mp = await payment.get({ id: paymentId })

    const status = mp?.status || 'unknown'
    const email = mp?.payer?.email || null
    const external_reference = mp?.external_reference || null

    const supabase = supabaseAdmin()

    // atualiza tabela pagamentos
    await supabase.from('pagamentos')
      .update({ status })
      .eq('mp_payment_id', String(paymentId))

    // ✅ Se aprovado, marcar equipe como paga
    if (status === 'approved') {
      // tenta achar equipe pelo email (seu fluxo usa email como login)
      if (email) {
        await supabase.from('equipes')
          .update({ pago: true })
          .eq('email', String(email).toLowerCase())
      }
    }

    return NextResponse.json({ ok: true })
  } catch (e) {
    console.error('Webhook MP erro:', e)
    // responder 200 mesmo assim evita reentregas infinitas em testes
    return NextResponse.json({ ok: true })
  }
}
