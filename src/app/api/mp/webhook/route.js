import { NextResponse } from 'next/server'
import { MercadoPagoConfig, Payment } from 'mercadopago'
import { createClient } from '@supabase/supabase-js'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function supabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const svc = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !svc) throw new Error('Env ausente: NEXT_PUBLIC_SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY')
  return createClient(url, svc, { auth: { persistSession: false } })
}

const client = new MercadoPagoConfig({ accessToken: process.env.MP_ACCESS_TOKEN })

export async function POST(request) {
  try {
    const body = await request.json().catch(() => ({}))

    // MP geralmente manda { data: { id } } e topic/type
    const paymentId = body?.data?.id || body?.id
    const type = (body?.type || body?.topic || '').toString().toLowerCase()

    const allowed = ['payment', 'payment.updated', 'payment.created']
    if (!paymentId || (type && !allowed.includes(type))) {
      return NextResponse.json({ ok: true })
    }

    const payment = new Payment(client)
    const mp = await payment.get({ id: paymentId }).catch(() => null)

    const status = (mp?.status || mp?.body?.status || '').toString().toLowerCase()
    const ext = (mp?.external_reference || mp?.body?.external_reference || '').toString().trim() // ideal: equipe_id
    const supabase = supabaseAdmin()

    // ✅ Log (cria ou atualiza)
    // Se sua tabela "pagamentos" não existir, pode remover esse bloco.
    await supabase
      .from('pagamentos')
      .upsert(
        {
          mp_payment_id: String(paymentId),
          status: status || 'unknown',
          external_reference: ext || null,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'mp_payment_id' }
      )

    // Só libera quando aprovado
    if (status !== 'approved') return NextResponse.json({ ok: true })
    if (!ext) return NextResponse.json({ ok: true })

    // ✅ 1) tenta por ID
    let liberou = false
    const asNum = Number(ext)
    if (Number.isFinite(asNum) && asNum > 0) {
      const r1 = await supabase
        .from('equipes')
        .update({ pago: true, mp_payment_id: String(paymentId), mp_status: 'approved' })
        .eq('id', asNum)

      if (r1?.error) {
        console.error('Erro Supabase (liberar por id):', r1.error.message)
      } else {
        liberou = true
      }
    }

    // ✅ 2) fallback por email (se ext não for id ou não achou)
    if (!liberou) {
      const email = ext.toLowerCase()
      const r2 = await supabase
        .from('equipes')
        .update({ pago: true, mp_payment_id: String(paymentId), mp_status: 'approved' })
        .ilike('email', email)

      if (r2?.error) {
        console.error('Erro Supabase (liberar por email):', r2.error.message)
      } else {
        liberou = true
      }
    }

    if (liberou) {
      console.log(`✅ MP approved: equipe liberada. paymentId=${paymentId} ref=${ext}`)
    } else {
      console.warn(`⚠️ MP approved mas equipe NÃO encontrada. paymentId=${paymentId} ref=${ext}`)
    }

    return NextResponse.json({ ok: true })
  } catch (e) {
    console.error('Erro Crítico Webhook:', e?.message || e)
    return NextResponse.json({ ok: true })
  }
}
