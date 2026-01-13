import { NextResponse } from 'next/server'
import crypto from 'crypto'

export const dynamic = 'force-dynamic'

function verifySession(token) {
  const secret = process.env.SESSION_SECRET || 'change-me'
  if (!token) return null

  const [payload, sig] = token.split('.')
  if (!payload || !sig) return null

  const expected = crypto.createHmac('sha256', secret).update(payload).digest('base64url')
  if (expected !== sig) return null

  const obj = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'))
  if (!obj?.equipe_id) return null
  if (obj?.exp && Date.now() > obj.exp) return null

  return obj
}

export async function GET(request) {
  const token = request.cookies.get('cap_session')?.value
  const sess = verifySession(token)
  if (!sess) return NextResponse.json({ ok: false }, { status: 401 })
  return NextResponse.json({ ok: true, equipe_id: sess.equipe_id })
}
