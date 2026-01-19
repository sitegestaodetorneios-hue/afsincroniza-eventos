import { MercadoPagoConfig, Payment } from 'mercadopago'
import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'

function supabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const svc = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !svc) throw new Error('Env ausente: NEXT_PUBLIC_SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY')
  return createClient(url, svc, { auth: { persistSession: false } })
}

export async function GET(request) {
  const { searchParams } = new URL(request.url)
  const id = searchParams.get('id') // mp payment id
  const token = searchParams.get('token')
  const equipeIdParam = searchParams.get('equipe_id') // ✅ usado para liberar

  if (!id) return NextResponse.json({ error: 'ID faltando' }, { status: 400 })

  // trava em produção
  const expected = process.env.STATUS_TOKEN
  if (process.env.NODE_ENV === 'production' && expected && token !== expected) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  }

  if (!process.env.MP_ACCESS_TOKEN) {
    return NextResponse.json({ error: 'MP_ACCESS_TOKEN não configurado' }, { status: 500 })
  }

  const client = new MercadoPagoConfig({ accessToken: process.env.MP_ACCESS_TOKEN })
  const payment = new Payment(client)

  try {
    const response = await payment.get({ id })
    const status = String(response?.status || '').toLowerCase()
    const status_detail = response?.status_detail || null

    // ✅ libera no banco quando aprovado (sem depender do webhook)
    let liberou_db = false
    if (status === 'approved' && equipeIdParam) {
      const equipeId = Number(String(equipeIdParam).trim())
      if (Number.isFinite(equipeId) && equipeId > 0) {
        try {
          const supabase = supabaseAdmin()
          const r = await supabase
            .from('equipes')
            .update({ pago: true, mp_payment_id: String(id), mp_status: 'approved' })
            .eq('id', equipeId)

          if (r?.error) {
            console.error('Erro ao liberar equipe via /api/status:', r.error.message)
          } else {
            liberou_db = true
          }
        } catch (e) {
          console.error('Erro crítico ao liberar equipe via /api/status:', e?.message || e)
        }
      }
    }

    return NextResponse.json({ status, status_detail, liberou_db })
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
