import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'
import sharp from 'sharp'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function supabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new Error('Env ausente: NEXT_PUBLIC_SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY')
  return createClient(url, key, { auth: { persistSession: false } })
}

function json(data, init = {}) {
  const res = NextResponse.json(data, init)
  res.headers.set('Cache-Control', 'no-store')
  return res
}

function parseDataUrl(dataUrl) {
  // ex: data:image/jpeg;base64,AAA...
  const m = String(dataUrl || '').match(/^data:(image\/(png|jpeg|jpg));base64,(.+)$/i)
  if (!m) return null
  const mime = m[1].toLowerCase()
  const base64 = m[3]
  const buf = Buffer.from(base64, 'base64')
  return { mime, buf }
}

function clampInt(v) {
  const n = Number(v)
  if (!Number.isFinite(n)) return null
  return Math.trunc(n)
}

export async function POST(request) {
  try {
    const body = await request.json().catch(() => null)
    if (!body) return json({ error: 'JSON inválido' }, { status: 400 })

    const equipe_id = clampInt(body.equipe_id)
    if (!equipe_id || equipe_id <= 0) return json({ error: 'equipe_id obrigatório' }, { status: 400 })

    const tipo = String(body.tipo || '').toLowerCase().trim()
    if (!['escudo', 'foto_equipe'].includes(tipo)) {
      return json({ error: 'tipo inválido (use: escudo | foto_equipe)' }, { status: 400 })
    }

    const parsed = parseDataUrl(body.arquivo_base64)
    if (!parsed) return json({ error: 'arquivo_base64 inválido (use data:image/...;base64,...)' }, { status: 400 })

    // Limite de tamanho do arquivo original (antes de converter)
    const MAX_ORIGINAL = 8 * 1024 * 1024
    if (parsed.buf.length > MAX_ORIGINAL) {
      return json({ error: 'Arquivo muito grande. Limite: 8MB.' }, { status: 400 })
    }

    // Converte/comprime para WEBP
    let pipeline = sharp(parsed.buf, { failOn: 'none' }).rotate()

    if (tipo === 'escudo') {
      pipeline = pipeline
        .resize(512, 512, { fit: 'cover' })
        .webp({ quality: 82 })
    } else {
      pipeline = pipeline
        .resize(1600, 900, { fit: 'cover' })
        .webp({ quality: 80 })
    }

    const webpBuffer = await pipeline.toBuffer()

    // Segurança: limita tamanho final (webp geralmente fica bem menor)
    const MAX_FINAL = 2 * 1024 * 1024
    if (webpBuffer.length > MAX_FINAL) {
      const webp2 = await sharp(parsed.buf, { failOn: 'none' })
        .rotate()
        .resize(tipo === 'escudo' ? 512 : 1400, tipo === 'escudo' ? 512 : 788, { fit: 'cover' })
        .webp({ quality: 70 })
        .toBuffer()

      if (webp2.length > MAX_FINAL) {
        return json({ error: 'Não foi possível comprimir a imagem dentro do limite.' }, { status: 400 })
      }

      const result = await handleUpload({ equipe_id, tipo, buffer: webp2 })
      return json({ ok: true, ...result })
    }

    const result = await handleUpload({ equipe_id, tipo, buffer: webpBuffer })
    return json({ ok: true, ...result })
  } catch (e) {
    return json({ error: e?.message || 'Erro interno' }, { status: 500 })
  }
}

async function handleUpload({ equipe_id, tipo, buffer }) {
  const supabase = supabaseAdmin()
  const bucket = 'equipes-midias'
  const path = `equipes/${equipe_id}/${tipo}.webp`

  const { error: upErr } = await supabase
    .storage
    .from(bucket)
    .upload(path, buffer, {
      contentType: 'image/webp',
      upsert: true,
      cacheControl: '3600',
    })

  if (upErr) throw new Error(upErr.message)

  // bucket PUBLIC → pega URL pública
  const { data: pub } = supabase.storage.from(bucket).getPublicUrl(path)
  const publicUrl = pub?.publicUrl
  if (!publicUrl) throw new Error('Falha ao obter URL pública')

  // ✅ evita cache antigo quando trocar a imagem
  const publicUrlVersioned = `${publicUrl}?v=${Date.now()}`

  const field = (tipo === 'escudo') ? 'escudo_url' : 'foto_equipe_url'
  const { error: dbErr } = await supabase
    .from('equipes')
    .update({ [field]: publicUrlVersioned })
    .eq('id', equipe_id)

  if (dbErr) throw new Error(dbErr.message)

  // devolve pro front se quiser atualizar sem relogar
  return { url: publicUrlVersioned, path }
}
