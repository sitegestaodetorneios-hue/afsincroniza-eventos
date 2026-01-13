import { MercadoPagoConfig, Payment } from 'mercadopago'
import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

export async function GET(request) {
  const { searchParams } = new URL(request.url)
  const id = searchParams.get('id')
  const token = searchParams.get('token')

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
    return NextResponse.json({
      status: response.status,
      status_detail: response.status_detail,
    })
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
