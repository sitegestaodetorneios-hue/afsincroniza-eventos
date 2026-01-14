import { NextResponse } from 'next/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(request) {
  const body = await request.json().catch(() => null)
  console.log('WEBHOOK MP:', body)
  return NextResponse.json({ ok: true })
}
