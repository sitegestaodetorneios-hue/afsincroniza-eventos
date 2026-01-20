'use client'

import { useState, useRef, useEffect, useCallback, useMemo } from 'react'
import {
  UserPlus, Users, ArrowLeft, Mail, Lock, FileText, Upload,
  CheckCircle, AlertTriangle, GraduationCap, Printer,
  Clock, DollarSign, MessageSquare, Copy, Loader2, ChevronRight,
  Trash2, Pencil, X, Save, Camera
} from 'lucide-react'
import Link from 'next/link'

async function safeJson(res) {
  try { return await res.json() } catch { return { error: 'Erro de resposta' } }
}

const TIPOS = [
  { value: 'ATLETA', label: 'Atleta' },
  { value: 'TECNICO', label: 'Técnico' },
  { value: 'AUX_TECNICO', label: 'Auxiliar Técnico' },
  { value: 'PREP_GOLEIRO', label: 'Preparador de Goleiro' },
  { value: 'PREP_FISICO', label: 'Preparador Físico' },
]

const LIMITES = {
  ATLETA: 16,
  TECNICO: 1,
  AUX_TECNICO: 1,
  PREP_GOLEIRO: 1,
  PREP_FISICO: 1,
}

function onlyDigits(s) {
  return String(s || '').replace(/\D/g, '')
}

function isValidCPF(cpf) {
  const v = onlyDigits(cpf)
  if (v.length !== 11) return false
  if (/^(\d)\1{10}$/.test(v)) return false

  let sum = 0
  for (let i = 0; i < 9; i++) sum += parseInt(v[i], 10) * (10 - i)
  let d1 = 11 - (sum % 11)
  if (d1 >= 10) d1 = 0
  if (d1 !== parseInt(v[9], 10)) return false

  sum = 0
  for (let i = 0; i < 10; i++) sum += parseInt(v[i], 10) * (11 - i)
  let d2 = 11 - (sum % 11)
  if (d2 >= 10) d2 = 0
  if (d2 !== parseInt(v[10], 10)) return false

  return true
}

function maskCPF(raw) {
  const d = onlyDigits(raw).slice(0, 11)
  const p1 = d.slice(0, 3)
  const p2 = d.slice(3, 6)
  const p3 = d.slice(6, 9)
  const p4 = d.slice(9, 11)

  let out = p1
  if (p2) out += '.' + p2
  if (p3) out += '.' + p3
  if (p4) out += '-' + p4
  return out
}

function maskRG(raw) {
  const d = onlyDigits(raw).slice(0, 9)
  const p1 = d.slice(0, 2)
  const p2 = d.slice(2, 5)
  const p3 = d.slice(5, 8)
  const p4 = d.slice(8, 9)

  let out = p1
  if (p2) out += '.' + p2
  if (p3) out += '.' + p3
  if (p4) out += '-' + p4
  return out
}

function maskDoc(raw) {
  const d = onlyDigits(raw)
  if (d.length >= 10) return maskCPF(raw)
  return maskRG(raw)
}

function tipoLabel(tipo) {
  return TIPOS.find(t => t.value === tipo)?.label || tipo
}

export default function PainelProfessor() {
  const [acessoLiberado, setAcessoLiberado] = useState(false)
  const [pixStatusMsg, setPixStatusMsg] = useState('')
  const [emailBusca, setEmailBusca] = useState('')
  const [senhaBusca, setSenhaBusca] = useState('')
  const [credenciaisSalvas, setCredenciaisSalvas] = useState(null)
  const [loading, setLoading] = useState(false)
  const [pixLoading, setPixLoading] = useState(false)
  const [pixData, setPixData] = useState(null)
  const [equipe, setEquipe] = useState(null)

  const [atletas, setAtletas] = useState([])

  // Agora é "membro" (atleta + comissão)
  const [novoMembro, setNovoMembro] = useState({
    tipo: 'ATLETA',
    nome: '',
    rg: '',
    camisa: '',
  })

  const [editId, setEditId] = useState(null)
  const [editMembro, setEditMembro] = useState({
    tipo: 'ATLETA',
    nome: '',
    rg: '',
    camisa: '',
  })

  const [termoFile, setTermoFile] = useState(null)
  const [uploading, setUploading] = useState(false)
  const fileInputRef = useRef(null)

  // ==========================
  // ✅ MIDIAS EQUIPE (ESCUDO / FOTO)
  // ==========================
  const [midiaUploading, setMidiaUploading] = useState(false)

  const escudoInputRef = useRef(null)
  const escudoCameraRef = useRef(null)
  const fotoInputRef = useRef(null)
  const fotoCameraRef = useRef(null)

  async function uploadMidiaEquipe(tipo, file) {
    if (!file) return
    if (!equipe?.id) return alert('Equipe não carregada.')

    const okTypes = ['image/jpeg', 'image/jpg', 'image/png']
    // alguns browsers retornam image/jpeg mesmo quando é .jpg/.jpeg
    if (!okTypes.includes(String(file.type || '').toLowerCase())) {
      return alert('Formato inválido. Use JPG/JPEG/PNG.')
    }

    const max = 8 * 1024 * 1024
    if (file.size > max) return alert('Arquivo muito grande. Limite: 8MB.')

    setMidiaUploading(true)
    try {
      const reader = new FileReader()

      reader.onerror = () => {
        setMidiaUploading(false)
        alert('Erro ao ler arquivo.')
      }

      reader.onload = async () => {
        try {
          const res = await fetch('/api/capitao/upload-midia-equipe', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              equipe_id: equipe.id,
              tipo, // 'escudo' | 'foto_equipe'
              arquivo_base64: reader.result,
              nome_arquivo: file.name,
            })
          })

          const data = await safeJson(res)
          if (!res.ok) {
            alert(data?.error || 'Falha no upload')
            return
          }

          await acessarPainel(true) // atualiza equipe.escudo_url / foto_equipe_url
          alert('Imagem atualizada!')
        } finally {
          setMidiaUploading(false)
          // limpa input para permitir reenviar o mesmo arquivo
          if (tipo === 'escudo') {
            if (escudoInputRef.current) escudoInputRef.current.value = ''
            if (escudoCameraRef.current) escudoCameraRef.current.value = ''
          } else {
            if (fotoInputRef.current) fotoInputRef.current.value = ''
            if (fotoCameraRef.current) fotoCameraRef.current.value = ''
          }
        }
      }

      reader.readAsDataURL(file)
    } catch (e) {
      setMidiaUploading(false)
      alert('Erro no upload.')
    }
  }

  // --- Helpers de elenco ---
  const membros = useMemo(() => {
    // Normaliza: caso backend traga tipo nulo, assume ATLETA
    return (Array.isArray(atletas) ? atletas : []).map(m => ({
      ...m,
      tipo: (m.tipo || 'ATLETA').toUpperCase(),
      numero_camisa: m.numero_camisa ?? m.camisa ?? '',
    }))
  }, [atletas])

  const atletasList = useMemo(() => membros.filter(m => (m.tipo || 'ATLETA') === 'ATLETA'), [membros])
  const staffList = useMemo(() => membros.filter(m => (m.tipo || 'ATLETA') !== 'ATLETA'), [membros])

  const countByTipo = useMemo(() => {
    const c = { ATLETA: 0, TECNICO: 0, AUX_TECNICO: 0, PREP_GOLEIRO: 0, PREP_FISICO: 0 }
    for (const m of membros) {
      const t = (m.tipo || 'ATLETA').toUpperCase()
      if (c[t] === undefined) c[t] = 0
      c[t] += 1
    }
    return c
  }, [membros])

  function validarMembro({ tipo, nome, rg, camisa }, { isEdit = false, currentId = null } = {}) {
    const t = (tipo || 'ATLETA').toUpperCase()
    const nomeOk = String(nome || '').trim().length >= 3
    if (!nomeOk) return 'Informe o nome completo (mín. 3 letras).'

    const docDigits = onlyDigits(rg)
    if (docDigits.length < 7) return 'Informe RG/CPF (mín. 7 dígitos).'
    if (docDigits.length === 11 && !isValidCPF(docDigits)) return 'CPF inválido.'

    // Camisa obrigatória para ATLETA
    const camisaDigits = onlyDigits(camisa)
    if (t === 'ATLETA') {
      if (!camisaDigits) return 'Para ATLETA, o número da camisa é obrigatório.'
      // impede duplicado entre atletas
      const dup = atletasList.some(a =>
        String(onlyDigits(a.numero_camisa)) === String(camisaDigits) &&
        (currentId ? String(a.id) !== String(currentId) : true)
      )
      if (dup) return `Já existe ATLETA com a camisa ${camisaDigits}.`
    }

    // Limites por tipo (para add; no edit não bloqueia se já existe)
    if (!isEdit) {
      const atual = countByTipo[t] || 0
      const limite = LIMITES[t] ?? Infinity
      if (atual >= limite) return `Limite atingido para ${tipoLabel(t)} (${limite}).`
    }

    return null
  }

  // --- 1. LOGIN E ATUALIZAÇÃO ---
  const acessarPainel = useCallback(async (isSilent = false) => {
    const dadosLogin = isSilent ? credenciaisSalvas : { email: emailBusca.trim(), senha: senhaBusca }
    if (!dadosLogin?.email || !dadosLogin?.senha) return
    if (!isSilent) setLoading(true)

    try {
      const res = await fetch('/api/capitao/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(dadosLogin),
      })
      const data = await safeJson(res)

      if (res.ok && data?.ok) {
        const equipeComStatusCorreto = {
          ...data.equipe,
          termo_assinado: data.equipe.termo_assinado === true || data.equipe.termo_assinado === 'true',
          pago: data.equipe.pago === true || data.equipe.pago === 'true',
        }

        setEquipe(equipeComStatusCorreto)

        if (!acessoLiberado) {
          setAcessoLiberado(true)
          setCredenciaisSalvas(dadosLogin)
        }

        if (equipeComStatusCorreto.pago) await carregarAtletas(data.equipe.id)
      } else if (!isSilent) {
        alert(data?.error || 'Dados incorretos!')
      }
    } catch (e) {
      if (!isSilent) alert('Erro de conexão.')
    } finally {
      if (!isSilent) setLoading(false)
    }
  }, [emailBusca, senhaBusca, acessoLiberado, credenciaisSalvas])

  // --- 2. AUTO REFRESH ---
  useEffect(() => {
    let intervalo
    if (acessoLiberado && credenciaisSalvas && !uploading) {
      intervalo = setInterval(() => {
        if (typeof document !== 'undefined' && document.hidden) return
        acessarPainel(true)
      }, 5000)
    }
    return () => clearInterval(intervalo)
  }, [acessoLiberado, credenciaisSalvas, acessarPainel, uploading])

  // --- 2.1 POLLING STATUS PIX ---
  useEffect(() => {
    let t = null
    let attempts = 0
    const MAX_ATTEMPTS = 180 // ~12 min

    async function checar() {
      if (!pixData?.id || !equipe?.id) return

      if (equipe?.pago) {
        setPixStatusMsg('')
        setPixData(null)
        if (t) clearInterval(t)
        return
      }

      attempts += 1
      if (attempts >= MAX_ATTEMPTS) {
        setPixStatusMsg('⏳ Tempo excedido. Se já pagou, chame o suporte para liberar.')
        if (t) clearInterval(t)
        return
      }

      try {
        const token = process.env.NEXT_PUBLIC_STATUS_TOKEN || ''
        const qs = new URLSearchParams({
          id: String(pixData.id),
          equipe_id: String(equipe.id),
        })
        if (token) qs.set('token', token)

        const res = await fetch(`/api/status?${qs.toString()}`, { cache: 'no-store' })
        const data = await safeJson(res)

        if (!res.ok) {
          setPixStatusMsg(data?.error || 'Falha ao consultar status do PIX')
          return
        }

        const st = String(data?.status || '').toLowerCase()
        const liberouDb = data?.liberou_db === true

        if (st === 'approved') {
          setPixStatusMsg(liberouDb
            ? '✅ Pagamento aprovado e liberado! Atualizando...'
            : '✅ Pagamento aprovado! Aguardando liberação no sistema...'
          )
          await acessarPainel(true)
          return
        }

        if (st) setPixStatusMsg(`Aguardando pagamento... (${st})`)
        else setPixStatusMsg('Aguardando pagamento...')
      } catch (e) {
        setPixStatusMsg('Aguardando pagamento... (sem conexão)')
      }
    }

    if (pixData?.id && equipe?.id && !equipe?.pago) {
      attempts = 0
      setPixStatusMsg('Aguardando pagamento...')
      t = setInterval(checar, 4000)
      checar()
    }

    return () => { if (t) clearInterval(t) }
  }, [pixData, equipe?.id, equipe?.pago, acessarPainel])

  // --- 3. CARREGAR MEMBROS ---
  async function carregarAtletas(equipeId) {
    try {
      const res = await fetch(`/api/atletas?equipe_id=${equipeId}`)
      const data = await safeJson(res)
      if (res.ok) setAtletas(Array.isArray(data) ? data : [])
    } catch (e) {
      console.error(e)
    }
  }

  // --- 4. GERAÇÃO DE PIX ---
  async function gerarPixPagamento() {
    if (!equipe?.id) return alert('Equipe não carregada.')
    setPixLoading(true)
    setPixStatusMsg('')
    setPixData(null)

    try {
      const res = await fetch('/api/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          equipe_id: equipe.id,
          nome_equipe: equipe.nome_equipe,
          email: equipe.email,
          nome_capitao: equipe.nome_capitao,
          modalidade: equipe.modalidade
        })
      })

      const data = await safeJson(res)
      if (!res.ok) {
        alert(data?.error || 'Erro ao gerar PIX')
        return
      }

      if (data?.qr_code) setPixData(data)
      else alert('Erro ao gerar PIX')
    } catch (e) {
      alert('Falha na conexão')
    } finally {
      setPixLoading(false)
    }
  }

  // --- 5. ADICIONAR MEMBRO ---
  async function adicionarMembro(e) {
    e.preventDefault()
    if (!equipe?.pago) return alert('Acesso bloqueado: Realize o pagamento da inscrição primeiro.')

    const err = validarMembro(novoMembro, { isEdit: false })
    if (err) return alert(err)

    setLoading(true)
    try {
      const payload = {
        equipe_id: equipe.id,
        tipo: (novoMembro.tipo || 'ATLETA').toUpperCase(),
        nome: String(novoMembro.nome || '').trim(),
        rg: maskDoc(novoMembro.rg),
        numero_camisa: onlyDigits(novoMembro.camisa),
      }

      if (payload.tipo !== 'ATLETA' && !payload.numero_camisa) payload.numero_camisa = ''

      const res = await fetch('/api/atletas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      if (res.ok) {
        setNovoMembro({ tipo: 'ATLETA', nome: '', rg: '', camisa: '' })
        await carregarAtletas(equipe.id)
      } else {
        const data = await safeJson(res)
        alert(data?.error || 'Falha ao salvar.')
      }
    } catch (e2) {
      alert('Falha ao salvar.')
    } finally {
      setLoading(false)
    }
  }

  // --- 5.1 EDITAR / SALVAR ---
  function iniciarEdicao(m) {
    setEditId(m.id)
    setEditMembro({
      tipo: (m.tipo || 'ATLETA').toUpperCase(),
      nome: m.nome || '',
      rg: m.rg || '',
      camisa: String(m.numero_camisa || ''),
    })
  }

  function cancelarEdicao() {
    setEditId(null)
    setEditMembro({ tipo: 'ATLETA', nome: '', rg: '', camisa: '' })
  }

  async function salvarEdicao() {
    if (!equipe?.pago) return
    const err = validarMembro(editMembro, { isEdit: true, currentId: editId })
    if (err) return alert(err)

    setLoading(true)
    try {
      const payload = {
        id: editId,
        equipe_id: equipe.id,
        tipo: (editMembro.tipo || 'ATLETA').toUpperCase(),
        nome: String(editMembro.nome || '').trim(),
        rg: maskDoc(editMembro.rg),
        numero_camisa: onlyDigits(editMembro.camisa),
      }
      if (payload.tipo !== 'ATLETA' && !payload.numero_camisa) payload.numero_camisa = ''

      const res = await fetch('/api/atletas', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      const data = await safeJson(res)
      if (!res.ok) {
        alert(data?.error || 'Falha ao atualizar.')
      } else {
        cancelarEdicao()
        await carregarAtletas(equipe.id)
      }
    } catch (e) {
      alert('Falha ao atualizar.')
    } finally {
      setLoading(false)
    }
  }

  // --- 5.2 REMOVER ---
  async function removerMembro(m) {
    if (!equipe?.pago) return
    const ok = confirm(`Remover "${m.nome}" (${tipoLabel(m.tipo)}) do elenco?`)
    if (!ok) return

    setLoading(true)
    try {
      const res = await fetch('/api/atletas', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: m.id, equipe_id: equipe.id }),
      })
      const data = await safeJson(res)
      if (!res.ok) {
        alert(data?.error || 'Falha ao remover.')
      } else {
        if (String(editId) === String(m.id)) cancelarEdicao()
        await carregarAtletas(equipe.id)
      }
    } catch (e) {
      alert('Falha ao remover.')
    } finally {
      setLoading(false)
    }
  }

  // --- 6. PDF TERMO PADRÃO FIFA ---
  function gerarTermo() {
    if (atletasList.length === 0) return alert('Cadastre os atletas antes de gerar o termo.')
    const printWindow = window.open('', '_blank')
    if (!printWindow) return alert('Pop-up bloqueado.')

    const html = `
      <html>
        <head>
          <title>Ficha Oficial - ${equipe.nome_equipe}</title>
          <style>
            body { font-family: Helvetica, Arial; padding: 40px; color: #000; line-height: 1.4; }
            .header { text-align: center; border-bottom: 2px solid #000; padding-bottom: 10px; margin-bottom: 20px; }
            .dados { margin-bottom: 14px; font-size: 13px; border: 1px solid #eee; padding: 10px; border-radius: 8px; }
            .clausulas { font-size: 10px; text-align: justify; background: #f8f8f8; padding: 15px; border: 1px solid #ddd; margin-bottom: 16px; }
            .staff { font-size: 11px; border: 1px solid #eee; padding: 10px; border-radius: 8px; margin-bottom: 16px; }
            table { width: 100%; border-collapse: collapse; margin-bottom: 30px; }
            th, td { border: 1px solid #000; padding: 8px; text-align: left; font-size: 11px; }
            th { background: #eee; text-transform: uppercase; }
            .assinatura { margin-top: 50px; border-top: 1px solid #000; width: 300px; text-align: center; float: right; font-size: 12px; font-weight: bold; }
          </style>
        </head>
        <body>
          <div class="header"><h1>FICHA DE INSCRIÇÃO E TERMO DE RESPONSABILIDADE</h1><h2>TEMPORADA 2026</h2></div>
          <div class="dados">
            <p><b>EQUIPE:</b> ${String(equipe.nome_equipe || '').toUpperCase()} | <b>MODALIDADE:</b> ${equipe.modalidade}</p>
            <p><b>PROFESSOR RESPONSÁVEL:</b> ${String(equipe.nome_capitao || '').toUpperCase()} | <b>CIDADE:</b> ${equipe.cidade}</p>
          </div>

          <div class="staff">
            <b>COMISSÃO TÉCNICA</b><br/>
            ${(staffList.length ? staffList : []).map(s => `
              • ${tipoLabel(s.tipo)}: ${String(s.nome || '').toUpperCase()} ${s.rg ? `(${s.rg})` : ''}<br/>
            `).join('') || '—'}
          </div>

          <div class="clausulas">
            <p><b>1. SAÚDE E RISCO:</b> O responsável técnico declara que todos os atletas abaixo relacionados estão em plenas condições físicas e mentais para a prática esportiva, isentando a organização de qualquer responsabilidade por incidentes médicos durante o certame.</p>
            <p><b>2. DIREITO DE IMAGEM:</b> Os atletas e seus responsáveis autorizam o uso de imagem e voz em fotos, vídeos e transmissões oficiais do evento para fins de divulgação e publicidade.</p>
            <p><b>3. REGULAMENTO:</b> A equipe declara estar ciente de todas as normas e punições previstas no regulamento oficial da competição.</p>
          </div>

          <table>
            <thead><tr><th style="width:30px">Nº</th><th>NOME COMPLETO DO ATLETA</th><th>RG / DOCUMENTO</th><th>ASSINATURA OU RESPONSÁVEL</th></tr></thead>
            <tbody>
              ${atletasList.map(a => `<tr><td style="text-align:center">${a.numero_camisa || '-'}</td><td>${String(a.nome || '').toUpperCase()}</td><td>${a.rg || ''}</td><td style="width:180px"></td></tr>`).join('')}
              ${Array.from({ length: Math.max(0, 16 - atletasList.length) }).map(() => `<tr><td style="height:25px"></td><td></td><td></td><td></td></tr>`).join('')}
            </tbody>
          </table>
          <div class="assinatura">${String(equipe.nome_capitao || '').toUpperCase()}<br>Assinatura do Professor / Responsável</div>
          <script>window.onload = function() { window.print(); setTimeout(window.close, 500); };</script>
        </body>
      </html>`

    printWindow.document.write(html)
    printWindow.document.close()
  }

  // --- 7. UPLOAD TERMO ---
  async function enviarTermo() {
    if (!termoFile) return alert('Selecione o arquivo.')
    if (!equipe?.id) return alert('Equipe não carregada.')

    setUploading(true)

    try {
      const reader = new FileReader()

      reader.onerror = () => {
        setUploading(false)
        alert('Erro ao ler arquivo.')
      }

      reader.onload = async () => {
        try {
          const res = await fetch('/api/capitao/upload-termo', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              equipe_id: equipe.id,
              arquivo_base64: reader.result,
              nome_arquivo: termoFile.name
            })
          })

          if (res.ok) {
            alert('Documento enviado!')
            setTermoFile(null)
            await acessarPainel(false)
          } else {
            const data = await safeJson(res)
            alert(data?.error || 'Falha ao enviar documento.')
          }
        } finally {
          setUploading(false)
        }
      }

      reader.readAsDataURL(termoFile)
    } catch (e) {
      setUploading(false)
      alert('Erro no upload.')
    }
  }

  // --- LOGIN VIEW ---
  if (!acessoLiberado) {
    return (
      <main className="min-h-screen bg-slate-950 flex items-center justify-center p-6 font-sans">
        <div className="bg-white p-10 rounded-[2rem] max-w-md w-full shadow-2xl relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-2 bg-blue-600"></div>
          <div className="text-center mb-10 text-slate-900">
            <div className="w-16 h-16 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-sm">
              <GraduationCap size={32} />
            </div>
            <h1 className="text-2xl font-black uppercase italic tracking-tight leading-none">
              Acesso do<br /><span className="text-blue-600">Professor</span>
            </h1>
          </div>

          <div className="space-y-5">
            <div className="relative group text-slate-900">
              <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
              <input
                type="email"
                placeholder="E-mail"
                className="w-full p-4 pl-12 bg-slate-50 border-2 border-slate-100 rounded-xl font-bold outline-none focus:border-blue-600 transition-all"
                value={emailBusca}
                onChange={(e) => setEmailBusca(e.target.value)}
              />
            </div>

            <div className="relative group text-slate-900">
              <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
              <input
                type="password"
                placeholder="Senha"
                className="w-full p-4 pl-12 bg-slate-50 border-2 border-slate-100 rounded-xl font-bold outline-none focus:border-blue-600 transition-all"
                value={senhaBusca}
                onChange={(e) => setSenhaBusca(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && acessarPainel()}
              />
            </div>

            <button
              onClick={() => acessarPainel(false)}
              disabled={loading}
              className="w-full bg-slate-900 text-white font-black py-4 rounded-xl hover:bg-blue-600 transition-all uppercase tracking-widest text-xs shadow-lg disabled:opacity-60"
            >
              {loading ? 'Acessando...' : 'Entrar no Painel'}
            </button>

            <Link
              href="/"
              className="flex items-center justify-center gap-2 text-xs font-bold text-slate-400 hover:text-slate-600 mt-6 uppercase tracking-wide"
            >
              <ArrowLeft size={14} /> Voltar ao site
            </Link>
          </div>
        </div>
      </main>
    )
  }

  // --- STATUS DOC ---
  const docEnviado = equipe?.termo_url && equipe.termo_url.length > 5
  const docAprovado = equipe?.termo_assinado === true

  return (
    <main className="min-h-screen bg-slate-50 py-8 px-4 md:px-8 font-sans text-slate-900">
      <div className="max-w-6xl mx-auto">

        {/* INPUTS MIDIA (ESCUDO/FOTO) */}
        <input
          ref={escudoInputRef}
          type="file"
          accept="image/png,image/jpeg"
          className="hidden"
          onChange={(e) => uploadMidiaEquipe('escudo', e.target.files?.[0])}
        />
        <input
          ref={escudoCameraRef}
          type="file"
          accept="image/png,image/jpeg"
          capture="environment"
          className="hidden"
          onChange={(e) => uploadMidiaEquipe('escudo', e.target.files?.[0])}
        />
        <input
          ref={fotoInputRef}
          type="file"
          accept="image/png,image/jpeg"
          className="hidden"
          onChange={(e) => uploadMidiaEquipe('foto_equipe', e.target.files?.[0])}
        />
        <input
          ref={fotoCameraRef}
          type="file"
          accept="image/png,image/jpeg"
          capture="environment"
          className="hidden"
          onChange={(e) => uploadMidiaEquipe('foto_equipe', e.target.files?.[0])}
        />

        {/* HEADER */}
        <div className="bg-slate-900 rounded-[2rem] p-8 md:p-10 text-white shadow-2xl mb-6 relative overflow-hidden">
          <div className="absolute top-0 right-0 p-10 opacity-5 pointer-events-none"><Users size={300} /></div>
          <div className="relative z-10 flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <div className="bg-blue-600 px-3 py-1 rounded text-[10px] font-black uppercase tracking-widest">Professor</div>
                <span className="text-slate-400 text-xs font-bold uppercase tracking-widest">{equipe?.modalidade}</span>
              </div>

              <div className="flex items-center gap-3">
                {equipe?.escudo_url ? (
                  <img
                    src={equipe.escudo_url}
                    alt="Escudo"
                    className="h-12 w-12 rounded-2xl object-cover border border-white/10"
                  />
                ) : null}

                <h1 className="text-3xl md:text-5xl font-black uppercase italic tracking-tighter text-white leading-none">
                  {equipe?.nome_equipe}
                </h1>
              </div>

              <p className="text-slate-300 font-medium mt-2 flex items-center gap-2">
                <GraduationCap size={18} className="text-yellow-500" /> Resp: {equipe?.nome_capitao}
              </p>
            </div>

            <div className="flex items-center gap-6 bg-white/10 p-4 rounded-2xl border border-white/10 backdrop-blur-sm">
              <div className="text-center">
                <p className="text-[10px] font-black uppercase text-blue-300 mb-1">Status Pagamento</p>
                {equipe?.pago
                  ? <p className="text-green-400 font-bold text-sm flex items-center gap-1 uppercase"><CheckCircle size={14} /> Liberado</p>
                  : <p className="text-red-400 font-bold text-sm flex items-center gap-1 animate-pulse uppercase"><AlertTriangle size={14} /> Pendente</p>
                }
              </div>

              <div className="h-10 w-px bg-white/10"></div>

              <div className="text-right">
                <p className="text-[10px] font-black uppercase text-blue-300 mb-1">Atletas</p>
                <p className="text-3xl font-black text-white leading-none">
                  {atletasList.length}<span className="text-lg text-slate-400">/16</span>
                </p>
                <p className="text-[10px] text-slate-400 font-bold uppercase mt-1">
                  Comissão: {staffList.length}/4
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* SUPORTE */}
        <div className="mb-6">
          <a
            href="https://wa.me/5547999998888"
            target="_blank"
            rel="noreferrer"
            className="flex items-center justify-between p-4 bg-green-50 border border-green-100 rounded-2xl hover:bg-green-100 transition-all group shadow-sm"
          >
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 bg-green-500 text-white rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform">
                <MessageSquare size={20} />
              </div>
              <div>
                <p className="text-[10px] font-black uppercase text-green-600">Suporte Direto</p>
                <p className="text-xs font-bold text-slate-700">Dúvidas ou pagamento manual? Fale conosco no WhatsApp.</p>
              </div>
            </div>
            <ChevronRight className="text-green-300 group-hover:translate-x-1 transition-all" size={20} />
          </a>
        </div>

        {/* ✅ IDENTIDADE DA EQUIPE (ESCUDO / FOTO) */}
        <div className="mb-8">
          <div className="bg-white p-6 rounded-[2rem] shadow-sm border border-slate-200">
            <h2 className="flex items-center gap-2 font-black uppercase text-xs text-slate-400 mb-6 border-b pb-2 tracking-widest">
              <Users size={16} className="text-blue-600" /> Identidade da Equipe
            </h2>

            <div className="grid md:grid-cols-2 gap-6">
              {/* ESCUDO */}
              <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-[10px] font-black uppercase text-slate-500">Escudo / Logo</p>
                    {!equipe?.escudo_url ? (
                      <p className="text-[10px] font-black uppercase text-yellow-600 mt-1">Recomendado</p>
                    ) : (
                      <p className="text-[10px] font-bold text-green-700 mt-1">OK</p>
                    )}
                  </div>

                  {equipe?.escudo_url ? (
                    <img src={equipe.escudo_url} alt="Escudo" className="h-16 w-16 rounded-2xl object-cover border" />
                  ) : (
                    <div className="h-16 w-16 rounded-2xl bg-white border flex items-center justify-center text-slate-300 font-black">
                      —
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-2 mt-3">
                  <button
                    type="button"
                    disabled={midiaUploading}
                    onClick={() => escudoCameraRef.current?.click()}
                    className="w-full bg-slate-900 text-white font-black py-3 rounded-xl uppercase text-[10px] tracking-widest disabled:opacity-60 flex items-center justify-center gap-2"
                  >
                    <Camera size={14} /> Tirar Foto
                  </button>
                  <button
                    type="button"
                    disabled={midiaUploading}
                    onClick={() => escudoInputRef.current?.click()}
                    className="w-full bg-blue-600 text-white font-black py-3 rounded-xl uppercase text-[10px] tracking-widest disabled:opacity-60 flex items-center justify-center gap-2"
                  >
                    <Upload size={14} /> Selecionar
                  </button>
                </div>

                <p className="text-[10px] text-slate-400 font-bold mt-2">
                  JPG/JPEG/PNG. Será comprimido e convertido para WEBP (ideal: imagem quadrada 1:1).
                </p>
              </div>

              {/* FOTO EQUIPE */}
              <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-[10px] font-black uppercase text-slate-500">Foto da Equipe</p>
                    {!equipe?.foto_equipe_url ? (
                      <p className="text-[10px] font-bold text-slate-400 mt-1">Opcional</p>
                    ) : (
                      <p className="text-[10px] font-bold text-green-700 mt-1">OK</p>
                    )}
                  </div>

                  {equipe?.foto_equipe_url ? (
                    <img src={equipe.foto_equipe_url} alt="Foto equipe" className="h-16 w-28 rounded-2xl object-cover border" />
                  ) : (
                    <div className="h-16 w-28 rounded-2xl bg-white border flex items-center justify-center text-slate-300 font-black">
                      —
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-2 mt-3">
                  <button
                    type="button"
                    disabled={midiaUploading}
                    onClick={() => fotoCameraRef.current?.click()}
                    className="w-full bg-slate-900 text-white font-black py-3 rounded-xl uppercase text-[10px] tracking-widest disabled:opacity-60 flex items-center justify-center gap-2"
                  >
                    <Camera size={14} /> Tirar Foto
                  </button>
                  <button
                    type="button"
                    disabled={midiaUploading}
                    onClick={() => fotoInputRef.current?.click()}
                    className="w-full bg-blue-600 text-white font-black py-3 rounded-xl uppercase text-[10px] tracking-widest disabled:opacity-60 flex items-center justify-center gap-2"
                  >
                    <Upload size={14} /> Selecionar
                  </button>
                </div>

                <p className="text-[10px] text-slate-400 font-bold mt-2">
                  JPG/JPEG/PNG. Será comprimido e convertido para WEBP (ideal: foto 16:9).
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* BLOCO DE PAGAMENTO */}
        {!equipe?.pago && (
          <div className="mb-10 animate-in slide-in-from-top duration-500">
            <div className="bg-white p-8 rounded-[2.5rem] shadow-xl border-2 border-blue-100 flex flex-col items-center text-center">
              <div className="w-14 h-14 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center mb-4">
                <DollarSign size={28} />
              </div>
              <h2 className="text-xl font-black text-slate-900 uppercase tracking-tighter mb-2">Pagar Inscrição</h2>
              <p className="text-slate-500 text-xs mb-6 max-w-xs font-medium">
                Liberação automática em segundos após o pagamento. <b>Se o PIX não atualizar sozinho, chame no suporte acima.</b>
              </p>

              {!pixData ? (
                <button
                  onClick={gerarPixPagamento}
                  disabled={pixLoading}
                  className="w-full max-w-xs bg-blue-600 text-white font-black py-4 rounded-xl uppercase text-xs flex items-center justify-center gap-2 hover:bg-blue-700 transition-all shadow-lg shadow-blue-100 disabled:opacity-60"
                >
                  {pixLoading ? <Loader2 className="animate-spin" size={18} /> : <DollarSign size={18} />} Gerar PIX Automático
                </button>
              ) : (
                <div className="w-full space-y-4">
                  <div className="bg-slate-50 p-4 rounded-2xl inline-block border border-slate-100 shadow-inner">
                    <img
                      src={`data:image/png;base64,${pixData.qr_code_base64}`}
                      className="w-40 h-40 mx-auto"
                      alt="Pix"
                    />
                  </div>

                  <button
                    onClick={() => { navigator.clipboard.writeText(pixData.qr_code); alert('Copiado!') }}
                    className="w-full max-w-xs mx-auto bg-slate-100 text-slate-600 font-bold py-3 rounded-xl text-[10px] uppercase flex items-center gap-2 justify-center hover:bg-slate-200 transition-all"
                  >
                    <Copy size={14} /> Copiar Código PIX
                  </button>

                  {pixStatusMsg && (
                    <div className="text-center text-[10px] font-black uppercase tracking-widest text-slate-500">
                      {pixStatusMsg}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ÁREA PRINCIPAL */}
        <div className="grid lg:grid-cols-3 gap-8">
          <div className={`lg:col-span-1 space-y-8 ${!equipe?.pago ? 'opacity-30 pointer-events-none grayscale' : ''}`}>

            {/* ADICIONAR MEMBRO */}
            <div className="bg-white p-6 rounded-[2rem] shadow-sm border border-slate-200">
              <h2 className="flex items-center gap-2 font-black uppercase text-xs text-slate-400 mb-6 border-b pb-2 tracking-widest">
                <UserPlus size={16} className="text-blue-600" /> Elenco
              </h2>

              <form onSubmit={adicionarMembro} className="space-y-4">
                <div>
                  <label className="text-[9px] font-black uppercase text-slate-400 ml-2">Tipo</label>
                  <select
                    className="w-full p-3 bg-slate-50 border-2 rounded-xl font-bold text-sm"
                    value={novoMembro.tipo}
                    onChange={(e) => setNovoMembro({ ...novoMembro, tipo: e.target.value })}
                  >
                    {TIPOS.map(t => (
                      <option key={t.value} value={t.value}>{t.label}</option>
                    ))}
                  </select>
                  <p className="text-[10px] text-slate-400 font-bold mt-2 ml-2">
                    Limites: Atletas 16 | Técnico 1 | Aux. Técnico 1 | Prep. Goleiro 1 | Prep. Físico 1
                  </p>
                </div>

                <div>
                  <label className="text-[9px] font-black uppercase text-slate-400 ml-2">Nome Completo</label>
                  <input
                    className="w-full p-3 bg-slate-50 border-2 rounded-xl font-bold text-sm"
                    value={novoMembro.nome}
                    onChange={(e) => setNovoMembro({ ...novoMembro, nome: e.target.value })}
                  />
                </div>

                <div className="grid grid-cols-3 gap-3">
                  <div className="col-span-2">
                    <label className="text-[9px] font-black uppercase text-slate-400 ml-2">RG / CPF</label>
                    <input
                      className="w-full p-3 bg-slate-50 border-2 rounded-xl font-bold text-sm"
                      value={novoMembro.rg}
                      onChange={(e) => setNovoMembro({ ...novoMembro, rg: maskDoc(e.target.value) })}
                      placeholder="00.000.000-0 ou 000.000.000-00"
                    />
                  </div>

                  <div>
                    <label className="text-[9px] font-black uppercase text-slate-400 ml-2">
                      Nº Camisa {novoMembro.tipo === 'ATLETA' ? '(obrig.)' : '(opcional)'}
                    </label>
                    <input
                      className="w-full p-3 bg-slate-50 border-2 rounded-xl font-bold text-sm text-center"
                      type="text"
                      inputMode="numeric"
                      value={novoMembro.camisa}
                      onChange={(e) => setNovoMembro({ ...novoMembro, camisa: e.target.value.replace(/[^\d]/g, '') })}
                      placeholder={novoMembro.tipo === 'ATLETA' ? 'Ex: 10' : '—'}
                    />
                  </div>
                </div>

                <button
                  disabled={loading}
                  className="w-full bg-blue-600 text-white font-black py-3 rounded-xl uppercase text-xs hover:bg-slate-900 transition-all shadow-lg shadow-blue-100 disabled:opacity-60"
                >
                  {loading ? 'Salvando...' : 'Adicionar ao Elenco'}
                </button>
              </form>
            </div>

            {/* DOCUMENTOS */}
            <div className="bg-slate-800 p-6 rounded-[2rem] shadow-xl text-white">
              <h2 className="flex items-center gap-2 font-black uppercase text-xs text-slate-400 mb-4 border-b border-slate-700 pb-2 tracking-widest">
                <FileText size={16} className="text-yellow-400" /> Documentos
              </h2>

              <div className="space-y-4">
                <p className="text-[10px] text-slate-400 leading-tight">
                  Gere a ficha oficial (padrão FIFA), colha as assinaturas dos responsáveis e anexe a foto/PDF abaixo.
                </p>

                <button
                  onClick={gerarTermo}
                  className="w-full bg-white text-slate-900 font-bold py-3 rounded-xl uppercase text-[10px] tracking-widest flex items-center justify-center gap-2 hover:bg-slate-200 transition-all"
                >
                  <Printer size={14} /> Imprimir Termo FIFA
                </button>

                <input
                  type="file"
                  accept="image/*,application/pdf"
                  ref={fileInputRef}
                  onChange={(e) => setTermoFile(e.target.files?.[0] || null)}
                  className="hidden"
                />

                {!termoFile ? (
                  docAprovado ? (
                    <div className="text-center p-3 bg-green-500/20 border border-green-500/50 rounded-xl text-green-400 font-bold text-[10px] uppercase flex items-center justify-center gap-2">
                      <CheckCircle size={14} /> Ficha Aceita
                    </div>
                  ) : docEnviado ? (
                    <div className="text-center p-3 bg-yellow-500/20 border border-yellow-500/50 rounded-xl text-yellow-400 font-bold text-[10px] uppercase flex items-center justify-center gap-2 animate-pulse">
                      <Clock size={14} /> Em Análise
                    </div>
                  ) : (
                    <button
                      onClick={() => fileInputRef.current?.click()}
                      className="w-full border-2 border-dashed border-slate-600 text-slate-400 font-bold py-3 rounded-xl uppercase text-[10px] tracking-widest hover:border-blue-400 hover:text-blue-300 transition-all flex items-center justify-center gap-2"
                    >
                      <Upload size={14} /> Enviar Ficha Assinada
                    </button>
                  )
                ) : (
                  <div className="space-y-2">
                    <div className="bg-green-900/30 p-2 rounded-lg text-[10px] truncate text-green-300 border border-green-900/50">
                      {termoFile.name}
                    </div>
                    <button
                      onClick={enviarTermo}
                      disabled={uploading}
                      className="w-full bg-green-600 text-white font-black py-3 rounded-xl text-[10px] uppercase tracking-widest hover:bg-green-500 shadow-lg disabled:opacity-60"
                    >
                      {uploading ? 'Enviando...' : 'Confirmar Envio'}
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* LISTA ELENCO */}
          <div className={`lg:col-span-2 ${!equipe?.pago ? 'opacity-30 grayscale' : ''}`}>
            <h3 className="text-sm font-black uppercase text-slate-400 tracking-widest mb-6">Elenco Oficial</h3>

            {/* Comissão técnica */}
            <div className="mb-6 bg-white rounded-3xl border border-slate-200 p-5">
              <div className="flex items-center justify-between">
                <p className="text-xs font-black uppercase text-slate-400 tracking-widest">Comissão Técnica</p>
                <p className="text-[10px] font-black uppercase text-slate-500">({staffList.length}/4)</p>
              </div>

              {staffList.length === 0 ? (
                <p className="text-slate-400 text-sm font-bold mt-4">Nenhum membro de comissão cadastrado.</p>
              ) : (
                <div className="mt-4 grid md:grid-cols-2 gap-3">
                  {staffList.map(m => {
                    const editing = String(editId) === String(m.id)
                    return (
                      <div key={m.id} className="bg-slate-50 p-4 rounded-2xl border border-slate-200 flex justify-between items-center">
                        {!editing ? (
                          <>
                            <div>
                              <p className="text-[10px] font-black uppercase text-blue-600">{tipoLabel(m.tipo)}</p>
                              <p className="font-black text-slate-800 uppercase text-xs leading-tight">{m.nome}</p>
                              <p className="text-[9px] text-slate-400 font-bold uppercase mt-0.5">Doc: {m.rg || '-'}</p>
                              {m.numero_camisa ? (
                                <p className="text-[9px] text-slate-400 font-bold uppercase mt-0.5">Nº: {m.numero_camisa}</p>
                              ) : null}
                            </div>

                            <div className="flex items-center gap-2">
                              <button
                                type="button"
                                onClick={() => iniciarEdicao(m)}
                                className="p-2 rounded-xl bg-white border border-slate-200 hover:bg-slate-100"
                                title="Editar"
                              >
                                <Pencil size={16} />
                              </button>
                              <button
                                type="button"
                                onClick={() => removerMembro(m)}
                                className="p-2 rounded-xl bg-white border border-slate-200 hover:bg-red-50 hover:border-red-200"
                                title="Remover"
                              >
                                <Trash2 size={16} className="text-red-600" />
                              </button>
                            </div>
                          </>
                        ) : (
                          <div className="w-full space-y-3">
                            <div className="grid grid-cols-2 gap-2">
                              <select
                                className="w-full p-2 bg-white border-2 rounded-xl font-bold text-sm"
                                value={editMembro.tipo}
                                onChange={(e) => setEditMembro({ ...editMembro, tipo: e.target.value })}
                              >
                                {TIPOS.filter(t => t.value !== 'ATLETA').map(t => (
                                  <option key={t.value} value={t.value}>{t.label}</option>
                                ))}
                              </select>
                              <input
                                className="w-full p-2 bg-white border-2 rounded-xl font-bold text-sm"
                                value={editMembro.camisa}
                                onChange={(e) => setEditMembro({ ...editMembro, camisa: e.target.value.replace(/[^\d]/g, '') })}
                                placeholder="Nº (opcional)"
                              />
                            </div>
                            <input
                              className="w-full p-2 bg-white border-2 rounded-xl font-bold text-sm"
                              value={editMembro.nome}
                              onChange={(e) => setEditMembro({ ...editMembro, nome: e.target.value })}
                              placeholder="Nome"
                            />
                            <input
                              className="w-full p-2 bg-white border-2 rounded-xl font-bold text-sm"
                              value={editMembro.rg}
                              onChange={(e) => setEditMembro({ ...editMembro, rg: maskDoc(e.target.value) })}
                              placeholder="RG/CPF"
                            />

                            <div className="flex gap-2">
                              <button
                                type="button"
                                onClick={salvarEdicao}
                                disabled={loading}
                                className="flex-1 bg-blue-600 text-white font-black py-2 rounded-xl uppercase text-[10px] tracking-widest disabled:opacity-60 flex items-center justify-center gap-2"
                              >
                                <Save size={14} /> Salvar
                              </button>
                              <button
                                type="button"
                                onClick={cancelarEdicao}
                                className="flex-1 bg-slate-200 text-slate-700 font-black py-2 rounded-xl uppercase text-[10px] tracking-widest flex items-center justify-center gap-2"
                              >
                                <X size={14} /> Cancelar
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}
            </div>

            {/* Atletas */}
            <div className="space-y-3">
              {atletasList.length === 0 ? (
                <p className="text-center py-10 bg-white rounded-3xl text-slate-400 font-bold border-2 border-dashed border-slate-200">
                  Nenhum atleta inscrito no elenco.
                </p>
              ) : (
                <div className="grid md:grid-cols-2 gap-3">
                  {atletasList.map(a => {
                    const editing = String(editId) === String(a.id)
                    return (
                      <div key={a.id} className="bg-white p-4 rounded-2xl border border-slate-100 flex justify-between items-center shadow-sm hover:shadow-md transition-all group">
                        {!editing ? (
                          <>
                            <div className="flex items-center gap-3">
                              <div className="h-10 w-10 bg-slate-50 rounded-lg flex items-center justify-center font-black text-slate-300 group-hover:bg-blue-600 group-hover:text-white transition-colors">
                                {a.numero_camisa || '-'}
                              </div>
                              <div>
                                <p className="font-black text-slate-800 uppercase text-xs leading-tight">{a.nome}</p>
                                <p className="text-[9px] text-slate-400 font-bold uppercase mt-0.5">Doc: {a.rg}</p>
                              </div>
                            </div>

                            <div className="flex items-center gap-2">
                              <button
                                type="button"
                                onClick={() => iniciarEdicao(a)}
                                className="p-2 rounded-xl bg-slate-50 border border-slate-100 hover:bg-slate-100"
                                title="Editar"
                              >
                                <Pencil size={16} />
                              </button>
                              <button
                                type="button"
                                onClick={() => removerMembro(a)}
                                className="p-2 rounded-xl bg-slate-50 border border-slate-100 hover:bg-red-50 hover:border-red-200"
                                title="Remover"
                              >
                                <Trash2 size={16} className="text-red-600" />
                              </button>
                            </div>
                          </>
                        ) : (
                          <div className="w-full space-y-3">
                            <div className="grid grid-cols-3 gap-2">
                              <select
                                className="col-span-1 w-full p-2 bg-white border-2 rounded-xl font-bold text-sm"
                                value={editMembro.tipo}
                                onChange={(e) => setEditMembro({ ...editMembro, tipo: e.target.value })}
                              >
                                <option value="ATLETA">Atleta</option>
                              </select>

                              <input
                                className="col-span-2 w-full p-2 bg-white border-2 rounded-xl font-bold text-sm"
                                value={editMembro.camisa}
                                onChange={(e) => setEditMembro({ ...editMembro, camisa: e.target.value.replace(/[^\d]/g, '') })}
                                placeholder="Camisa (obrig.)"
                              />
                            </div>

                            <input
                              className="w-full p-2 bg-white border-2 rounded-xl font-bold text-sm"
                              value={editMembro.nome}
                              onChange={(e) => setEditMembro({ ...editMembro, nome: e.target.value })}
                              placeholder="Nome"
                            />
                            <input
                              className="w-full p-2 bg-white border-2 rounded-xl font-bold text-sm"
                              value={editMembro.rg}
                              onChange={(e) => setEditMembro({ ...editMembro, rg: maskDoc(e.target.value) })}
                              placeholder="RG/CPF"
                            />

                            <div className="flex gap-2">
                              <button
                                type="button"
                                onClick={salvarEdicao}
                                disabled={loading}
                                className="flex-1 bg-blue-600 text-white font-black py-2 rounded-xl uppercase text-[10px] tracking-widest disabled:opacity-60 flex items-center justify-center gap-2"
                              >
                                <Save size={14} /> Salvar
                              </button>
                              <button
                                type="button"
                                onClick={cancelarEdicao}
                                className="flex-1 bg-slate-200 text-slate-700 font-black py-2 rounded-xl uppercase text-[10px] tracking-widest flex items-center justify-center gap-2"
                              >
                                <X size={14} /> Cancelar
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}
            </div>

          </div>
        </div>

      </div>
    </main>
  )
}
