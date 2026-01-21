import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function supabaseAnon() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    { auth: { persistSession: false } }
  )
}

function supabaseService() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = String(process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim()
  return createClient(url, key, { auth: { persistSession: false } })
}

function asArray(v) { return Array.isArray(v) ? v : [] }
function maskCpfLast4(last4) {
  const s = String(last4 || '').replace(/\D/g, '').slice(-4)
  return s ? `***-${s}` : ''
}
function fmtDateBR(d) {
  if (!d) return ''
  try { return new Date(d).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' }) }
  catch { return String(d) }
}
function originFromReq(req) { return new URL(req.url).origin }

// ✅ MESMA LÓGICA DA /api/partida (igual seu GET)
async function getPartidaCompleta({ supabase, id }) {
  const { data: jogo, error: errJogo } = await supabase
    .from('jogos')
    .select('*')
    .eq('id', id)
    .maybeSingle()

  if (errJogo) throw errJogo
  if (!jogo) return { error: 'Jogo não encontrado', status: 404 }

  let timeA = { id: 0, nome_equipe: 'Time A', logo_url: null }
  let timeB = { id: 0, nome_equipe: 'Time B', logo_url: null }

  const idsTimes = []
  if (jogo.equipe_a_id) idsTimes.push(jogo.equipe_a_id)
  if (jogo.equipe_b_id) idsTimes.push(jogo.equipe_b_id)

  if (idsTimes.length > 0) {
    const { data: times, error: errTimes } = await supabase
      .from('equipes')
      .select('id, nome_equipe, escudo_url')
      .in('id', idsTimes)

    if (errTimes) throw errTimes

    const idBuscaA = String(jogo.equipe_a_id)
    const idBuscaB = String(jogo.equipe_b_id)

    const tA = (times || []).find(t => String(t.id) === idBuscaA)
    if (tA) timeA = { ...tA, logo_url: tA.escudo_url || null }

    const tB = (times || []).find(t => String(t.id) === idBuscaB)
    if (tB) timeB = { ...tB, logo_url: tB.escudo_url || null }
  }

  const { data: eventos, error: errEv } = await supabase
    .from('jogo_eventos')
    .select('*')
    .eq('jogo_id', id)
    .order('created_at', { ascending: true })

  if (errEv) throw errEv

  const { data: atletas, error: errAt } = await supabase
    .from('atletas')
    .select('id, nome, numero_camisa, equipe_id')
    .in('equipe_id', idsTimes)

  if (errAt) throw errAt

  const listaAtletas = atletas || []
  const atletaMap = new Map()
  listaAtletas.forEach(a => atletaMap.set(a.id, a))

  const eventosFormatados = (eventos || []).map(ev => {
    const isTimeA = String(ev.equipe_id) === String(jogo.equipe_a_id)
    const teamName = isTimeA ? timeA.nome_equipe : timeB.nome_equipe
    const atleta = ev.atleta_id ? atletaMap.get(ev.atleta_id) : null
    const camisa = ev.camisa_no_jogo ?? atleta?.numero_camisa ?? '-'
    const atletaLabel = atleta ? `#${camisa} ${atleta.nome}` : `#${camisa} Jogador`
    return { ...ev, team_name: teamName, atleta_label: atletaLabel }
  })

  const jogoCompleto = { ...jogo, equipeA: timeA, equipeB: timeB }
  const atletasA = listaAtletas.filter(a => String(a.equipe_id) === String(jogo.equipe_a_id))
  const atletasB = listaAtletas.filter(a => String(a.equipe_id) === String(jogo.equipe_b_id))

  return { status: 200, jogo: jogoCompleto, eventos: eventosFormatados, atletasA, atletasB }
}

// ✅ helper wrap
function wrapByWidth(text, font, size, maxWidth) {
  const words = String(text || '').split(/\s+/).filter(Boolean)
  const lines = []
  let line = ''

  for (const w of words) {
    const test = line ? `${line} ${w}` : w
    const width = font.widthOfTextAtSize(test, size)
    if (width <= maxWidth) {
      line = test
    } else {
      if (line) lines.push(line)
      line = w
    }
  }
  if (line) lines.push(line)
  return lines
}

async function buildPdfBytes({ jogo, eventos, atletasA, atletasB, assinaturas }) {
  const pdfDoc = await PDFDocument.create()
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica)
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold)

  const page = pdfDoc.addPage([595.28, 841.89]) // A4
  const { width, height } = page.getSize()

  const margin = 40
  let y = height - margin

  const drawCenter = (text, size, bold = false) => {
    const f = bold ? fontBold : font
    const w = f.widthOfTextAtSize(text, size)
    page.drawText(text, { x: (width - w) / 2, y, size, font: f, color: rgb(0, 0, 0) })
    y -= size + 6
  }

  const drawLeft = (text, size, bold = false, indent = 0, color = rgb(0,0,0)) => {
    const f = bold ? fontBold : font
    page.drawText(text, { x: margin + indent, y, size, font: f, color })
    y -= size + 4
  }

  const nomeA = jogo?.equipeA?.nome_equipe || 'Equipe A'
  const nomeB = jogo?.equipeB?.nome_equipe || 'Equipe B'
  const placar = `${jogo?.gols_a ?? 0} x ${jogo?.gols_b ?? 0}`
  const data = jogo?.data_jogo ? new Date(jogo.data_jogo + 'T00:00:00').toLocaleDateString('pt-BR') : '--/--/----'
  const hora = jogo?.horario ? String(jogo.horario).slice(0, 5) : '--:--'
  const local = jogo?.local ? String(jogo.local) : ''
  const tipo = jogo?.tipo_jogo ? String(jogo.tipo_jogo).replace(/_/g, ' ') : ''
  const rodada = jogo?.rodada != null ? String(jogo.rodada) : ''
  const status = jogo?.finalizado ? 'FINALIZADO' : (jogo?.status || '—')

  drawCenter('SÚMULA OFICIAL', 18, true)
  drawCenter(`Jogo ID: ${jogo?.id} • Status: ${status}`, 10, false)
  y -= 6
  drawCenter(`${nomeA}  ${placar}  ${nomeB}`, 14, true)
  drawCenter(`Data: ${data} • Hora: ${hora}`, 10, false)
  if (local) drawCenter(`Local: ${local}`, 10, false)
  drawCenter(`Tipo: ${tipo}${rodada ? ` • Rodada ${rodada}` : ''}`, 10, false)
  y -= 10
  drawCenter('LGPD: dados sensíveis mascarados neste PDF.', 9, false)

  y -= 14
  drawLeft('ELENCOS', 12, true)

  const colGap = 20
  const colW = (width - margin*2 - colGap) / 2
  const xA = margin
  const xB = margin + colW + colGap
  const startY = y

  const drawTeam = (title, list, x) => {
    let yy = startY
    page.drawText(title, { x, y: yy, size: 10, font: fontBold })
    yy -= 14

    const arr = asArray(list)
    if (!arr.length) {
      page.drawText('Sem escalação disponível.', { x, y: yy, size: 9, font, color: rgb(0.4,0.4,0.4) })
      yy -= 12
      return yy
    }

    for (const a of arr.slice(0, 30)) {
      const nome = String(a?.nome || '').toUpperCase()
      const num = a?.numero_camisa ?? '-'
      page.drawText(`#${num} ${nome}`, { x, y: yy, size: 9, font })
      yy -= 12
      if (yy < 160) break
    }
    return yy
  }

  const yEndA = drawTeam(`Time A: ${nomeA}`, atletasA, xA)
  const yEndB = drawTeam(`Time B: ${nomeB}`, atletasB, xB)
  y = Math.min(yEndA, yEndB) - 10

  drawLeft('TIMELINE / OCORRÊNCIAS', 12, true)
  y -= 6

  const maxWidth = width - margin*2
  const evs = asArray(eventos)
  if (!evs.length) {
    drawLeft('Nenhum evento registrado.', 9, false, 0, rgb(0.4,0.4,0.4))
  } else {
    for (const ev of evs.slice(0, 70)) {
      const minuto = ev?.minuto ? `${ev.minuto}'` : '--'
      const tipoEv = String(ev?.tipo || '').toUpperCase()
      const team = String(ev?.team_name || '').toUpperCase()
      const atleta = String(ev?.atleta_label || '').toUpperCase()
      const obs = ev?.observacao ? String(ev.observacao) : ''

      const line1 = `${minuto} • ${tipoEv} • ${team}`
      const lines1 = wrapByWidth(line1, fontBold, 9, maxWidth)
      for (const ln of lines1) {
        if (y < 120) break
        page.drawText(ln, { x: margin, y, size: 9, font: fontBold })
        y -= 12
      }

      if (atleta && y >= 120) {
        const linesA = wrapByWidth(atleta, font, 9, maxWidth - 14)
        for (const ln of linesA) {
          if (y < 120) break
          page.drawText(ln, { x: margin + 14, y, size: 9, font })
          y -= 12
        }
      }

      if (obs && y >= 120) {
        const obsTxt = `"${obs}"`
        const linesO = wrapByWidth(obsTxt, font, 9, maxWidth - 14)
        for (const ln of linesO) {
          if (y < 120) break
          page.drawText(ln, { x: margin + 14, y, size: 9, font, color: rgb(0.35,0.35,0.35) })
          y -= 12
        }
      }

      y -= 4
      if (y < 120) break
    }
  }

  y -= 8
  drawLeft('ASSINATURAS (Registro)', 12, true)
  y -= 6

  const sigs = asArray(assinaturas)
  if (!sigs.length) {
    drawLeft('Nenhuma assinatura registrada.', 9, false, 0, rgb(0.4,0.4,0.4))
  } else {
    for (const s of sigs.slice(0, 40)) {
      if (y < 80) break
      const nome = String(s?.nome || '').toUpperCase()
      const role = String(s?.role || '').toUpperCase()
      const when = fmtDateBR(s?.signed_at)
      const cpfMask = maskCpfLast4(s?.cpf_last4)

      const l1 = `• ${role} — ${nome}${cpfMask ? ` (CPF: ${cpfMask})` : ''}`
      const lines = wrapByWidth(l1, font, 9, maxWidth)
      for (const ln of lines) {
        if (y < 80) break
        page.drawText(ln, { x: margin, y, size: 9, font })
        y -= 12
      }
      if (when && y >= 80) {
        page.drawText(`Assinado em: ${when}`, { x: margin + 14, y, size: 9, font, color: rgb(0.35,0.35,0.35) })
        y -= 12
      }
      y -= 2
    }
  }

  page.drawText(`Gerado em: ${fmtDateBR(new Date())}`, {
    x: margin,
    y: 30,
    size: 8,
    font,
    color: rgb(0.4,0.4,0.4)
  })

  return await pdfDoc.save()
}

export async function POST(request) {
  try {
    const body = await request.json()
    const jogo_id = String(body?.jogo_id || '').trim()
    const auth = body?.auth || {}

    if (!jogo_id) return NextResponse.json({ error: 'jogo_id obrigatório' }, { status: 400 })

    // 1) dados partida (mesma lógica da /api/partida)
    const supa = supabaseAnon()
    const partida = await getPartidaCompleta({ supabase: supa, id: jogo_id })
    if (partida?.error) return NextResponse.json({ error: partida.error }, { status: partida.status || 500 })

    const jogo = partida.jogo
    const equipeAId = String(jogo?.equipe_a_id || jogo?.equipeA?.id || '')
    const equipeBId = String(jogo?.equipe_b_id || jogo?.equipeB?.id || '')

    // 2) AUTH
    if (auth?.tipo === 'ADMIN') {
      const expected = String(process.env.ADMIN_SUMULA_PASSWORD || '')
      const provided = String(auth?.senha_admin || '')
      if (!expected) return NextResponse.json({ error: 'ADMIN_SUMULA_PASSWORD não configurada.' }, { status: 500 })
      if (!provided || provided !== expected) return NextResponse.json({ error: 'Senha de Admin inválida.' }, { status: 401 })
    } else if (auth?.tipo === 'PROFESSOR') {
      const email = String(auth?.email || '').trim()
      const senha = String(auth?.senha || '')
      if (!email || !senha) return NextResponse.json({ error: 'E-mail e senha obrigatórios.' }, { status: 400 })

      const origin = originFromReq(request)
      const loginRes = await fetch(`${origin}/api/capitao/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        cache: 'no-store',
        body: JSON.stringify({ email, senha })
      })
      const login = await loginRes.json().catch(() => ({}))

      if (!loginRes.ok || !login?.ok || !login?.equipe?.id) {
        return NextResponse.json({ error: 'Credenciais do Professor inválidas.' }, { status: 401 })
      }

      const equipeProfessor = String(login.equipe.id)
      if (!(equipeProfessor === equipeAId || equipeProfessor === equipeBId)) {
        return NextResponse.json({ error: 'Professor não pertence a nenhuma equipe desta partida.' }, { status: 403 })
      }
    } else {
      return NextResponse.json({ error: 'Tipo de autenticação inválido.' }, { status: 400 })
    }

    // 3) assinaturas
    const supaSrv = supabaseService()
    let assinaturas = []
    const { data: sigs, error: sigErr } = await supaSrv
      .from('sumula_assinaturas')
      .select('id,etapa_id,jogo_id,user_id,nome,role,signed_at,signature_hash,cpf_last4,role_slot')
      .eq('jogo_id', Number(jogo_id))
      .order('role_slot', { ascending: true })
      .order('signed_at', { ascending: true })

    if (sigErr) console.error('Erro sumula_assinaturas:', sigErr)
    assinaturas = asArray(sigs)

    // 4) PDF bytes
    const pdfBytes = await buildPdfBytes({
      jogo,
      eventos: partida.eventos,
      atletasA: partida.atletasA,
      atletasB: partida.atletasB,
      assinaturas
    })

    return new Response(Buffer.from(pdfBytes), {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="sumula_jogo_${jogo_id}.pdf"`,
        'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0',
        'Pragma': 'no-cache',
      }
    })
  } catch (e) {
    console.error('POST /api/sumula/baixar ERRO:', e)
    return NextResponse.json({ error: `Erro ao gerar súmula: ${e?.message || 'desconhecido'}` }, { status: 500 })
  }
}
