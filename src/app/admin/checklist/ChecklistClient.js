'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import {
  ClipboardList, Plus, Download, Upload, Printer, RotateCcw, Search,
  Trash2, ChevronDown, ChevronUp, ArrowUp, ArrowDown, X, Link as LinkIcon
} from 'lucide-react'

const STATUS = {
  SEM_UTILIDADE: 'sem utilidade',
  AGUARDANDO: 'aguardando',
  EM_ANDAMENTO: 'em andamento',
  OK: 'ok',
}

const STATUS_LIST = [
  STATUS.SEM_UTILIDADE,
  STATUS.AGUARDANDO,
  STATUS.EM_ANDAMENTO,
  STATUS.OK,
]

// Template determinístico (sem random/Date.now) => evita mismatch
const DEFAULT_DATA = [
  {
    id: 'sec_escopo',
    title: '1) Escopo e planejamento',
    open: true,
    items: [
      { id: 'escopo_objetivo', label: 'Definir objetivo do evento (base/adulto/beneficente/ranking etc.)', status: STATUS.AGUARDANDO, owner: '', due: '', notes: '' },
      { id: 'escopo_categorias', label: 'Definir categorias (idade, série, masc/fem, prata/ouro etc.)', status: STATUS.AGUARDANDO, owner: '', due: '', notes: '' },
      { id: 'escopo_limite', label: 'Definir limite de times por categoria', status: STATUS.AGUARDANDO, owner: '', due: '', notes: '' },
      { id: 'escopo_formato', label: 'Definir formato (grupos/mata-mata, tempo, critérios)', status: STATUS.AGUARDANDO, owner: '', due: '', notes: '' },
      { id: 'escopo_cronograma', label: 'Cronograma macro (inscrições → congresso técnico → tabela → jogos → premiação)', status: STATUS.AGUARDANDO, owner: '', due: '', notes: '' },
    ],
  },
  {
    id: 'sec_local_data',
    title: '2) Local e data',
    open: true,
    items: [
      { id: 'local_confirmado', label: 'Local confirmado (estrutura, banheiros, energia, iluminação, estacionamento)', status: STATUS.OK, owner: '', due: '', notes: 'Você disse que já tem' },
      { id: 'data_definir', label: 'Data definida (dia(s) e horários de montagem, jogos e desmontagem)', status: STATUS.AGUARDANDO, owner: '', due: '', notes: '' },
      { id: 'plano_b', label: 'Plano B (chuva/indisponível) + comunicação rápida', status: STATUS.AGUARDANDO, owner: '', due: '', notes: '' },
      { id: 'regras_local', label: 'Regras do local (som, bebidas, acesso, áreas restritas)', status: STATUS.AGUARDANDO, owner: '', due: '', notes: '' },
    ],
  },
  {
    id: 'sec_regras',
    title: '3) Regras e regulamento',
    open: true,
    items: [
      { id: 'regulamento_pdf', label: 'Regulamento escrito (PDF + página no site)', status: STATUS.AGUARDANDO, owner: '', due: '', notes: '' },
      { id: 'cartoes', label: 'Cartões e suspensão (amarelo/vermelho/agressão)', status: STATUS.AGUARDANDO, owner: '', due: '', notes: '' },
      { id: 'wo_atrasos', label: 'WO / atrasos / tolerância (tempo de espera e penalidades)', status: STATUS.AGUARDANDO, owner: '', due: '', notes: '' },
      { id: 'desempate', label: 'Critérios de desempate (saldo, confronto, cartões, sorteio)', status: STATUS.AGUARDANDO, owner: '', due: '', notes: '' },
      { id: 'docs_atletas', label: 'Documentos/inscrição de atletas (idade, lista, autorização menores)', status: STATUS.AGUARDANDO, owner: '', due: '', notes: '' },
      { id: 'uniformes', label: 'Uniformes (camisa igual, numeração, coletes reserva)', status: STATUS.AGUARDANDO, owner: '', due: '', notes: '' },
      { id: 'termo_imagem', label: 'Termo de responsabilidade e uso de imagem (principalmente menores)', status: STATUS.AGUARDANDO, owner: '', due: '', notes: '' },
    ],
  },
  {
    id: 'sec_financas',
    title: '4) Orçamentos, inscrição e pagamentos',
    open: true,
    items: [
      { id: 'orcamentos', label: 'Orçamentos validados (arbitragem, premiação, som, materiais, divulgação)', status: STATUS.AGUARDANDO, owner: '', due: '', notes: '' },
      { id: 'valor_inscricao', label: 'Definir valor de inscrição (aceitável ao público)', status: STATUS.AGUARDANDO, owner: '', due: '', notes: '' },
      { id: 'concorrentes', label: 'Pesquisar concorrentes (taxa, premiação, o que inclui, público)', status: STATUS.AGUARDANDO, owner: '', due: '', notes: '' },
      { id: 'conta_mp', label: 'Conta Mercado Pago criada/validada', status: STATUS.AGUARDANDO, owner: '', due: '', notes: '' },
      { id: 'integracao_mp', label: 'Integração MP no site (Pix/cartão + confirmação automática)', status: STATUS.AGUARDANDO, owner: '', due: '', notes: '' },
      { id: 'reembolso', label: 'Política de cancelamento/reembolso definida', status: STATUS.AGUARDANDO, owner: '', due: '', notes: '' },
    ],
  },
  {
    id: 'sec_contratos',
    title: '5) Contratos e acordos',
    open: true,
    items: [
      { id: 'contrato_locacao', label: 'Contrato de locação (final de semana)', status: STATUS.AGUARDANDO, owner: '', due: '', notes: '' },
      { id: 'acordo_bar', label: 'Acordo por escrito: não pagamos nada / local fica com bar e cozinha', status: STATUS.AGUARDANDO, owner: '', due: '', notes: '' },
      { id: 'limpeza_seguranca', label: 'Definir limpeza, segurança, energia, horários, acesso/chave', status: STATUS.AGUARDANDO, owner: '', due: '', notes: '' },
      { id: 'responsabilidade', label: 'Responsabilidade por danos / multa por cancelamento', status: STATUS.AGUARDANDO, owner: '', due: '', notes: '' },
    ],
  },
  {
    id: 'sec_site',
    title: '6) Site e tecnologia',
    open: true,
    items: [
      { id: 'site_ok', label: 'Site OK (testar no PC e no celular)', status: STATUS.AGUARDANDO, owner: '', due: '', notes: '' },
      { id: 'inscricao_ok', label: 'Inscrição funcionando (time/atletas/categoria)', status: STATUS.AGUARDANDO, owner: '', due: '', notes: '' },
      { id: 'regras_site', label: 'Página de regulamento publicada no site', status: STATUS.AGUARDANDO, owner: '', due: '', notes: '' },
      { id: 'tabela_site', label: 'Tabela/jogos/resultados no site', status: STATUS.AGUARDANDO, owner: '', due: '', notes: '' },
      { id: 'contato_maps', label: 'Contato/WhatsApp + mapa do local', status: STATUS.AGUARDANDO, owner: '', due: '', notes: '' },
    ],
  },
  {
    id: 'sec_marketing',
    title: '7) Redes sociais e divulgação',
    open: true,
    items: [
      { id: 'criar_redes', label: 'Criar/organizar redes sociais (Instagram/WhatsApp/etc.)', status: STATUS.AGUARDANDO, owner: '', due: '', notes: '' },
      { id: 'calendario_posts', label: 'Calendário de posts (teaser → inscrições → tabela → ao vivo → campeões)', status: STATUS.AGUARDANDO, owner: '', due: '', notes: '' },
      { id: 'kit_divulgacao', label: 'Kit de divulgação (arte/story/banner/textos)', status: STATUS.AGUARDANDO, owner: '', due: '', notes: '' },
      { id: 'patrocinios', label: 'Plano de patrocínios (cotas, entregas, prazos)', status: STATUS.AGUARDANDO, owner: '', due: '', notes: '' },
    ],
  },
  {
    id: 'sec_operacao',
    title: '8) Operação do dia',
    open: false,
    items: [
      { id: 'equipe', label: 'Equipe definida (mesa/secretaria/locução)', status: STATUS.AGUARDANDO, owner: '', due: '', notes: '' },
      { id: 'arbitragem', label: 'Arbitragem escalada (contatos, horários, pagamento)', status: STATUS.AGUARDANDO, owner: '', due: '', notes: '' },
      { id: 'materiais', label: 'Materiais (bolas, súmulas, canetas, pranchetas, fita, coletes)', status: STATUS.AGUARDANDO, owner: '', due: '', notes: '' },
      { id: 'premiacao', label: 'Premiação comprada e conferida', status: STATUS.AGUARDANDO, owner: '', due: '', notes: '' },
      { id: 'checkin', label: 'Credenciamento/check-in (pagamento, lista, pulseira/crachá)', status: STATUS.AGUARDANDO, owner: '', due: '', notes: '' },
    ],
  },
]

function uid() {
  try {
    return crypto.randomUUID()
  } catch {
    return `id_${Math.random().toString(16).slice(2)}_${Date.now()}`
  }
}

function clampIndex(i, len) {
  return Math.max(0, Math.min(len - 1, i))
}

function pct(done, total) {
  if (!total) return 0
  return Math.round((done / total) * 100)
}

function downloadText(filename, text) {
  const blob = new Blob([text], { type: 'application/json;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}

function badgeClass(status) {
  switch (status) {
    case STATUS.OK:
      return 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200'
    case STATUS.EM_ANDAMENTO:
      return 'bg-amber-50 text-amber-700 ring-1 ring-amber-200'
    case STATUS.AGUARDANDO:
      return 'bg-sky-50 text-sky-700 ring-1 ring-sky-200'
    case STATUS.SEM_UTILIDADE:
    default:
      return 'bg-slate-100 text-slate-600 ring-1 ring-slate-200'
  }
}

export default function ChecklistClient() {
  const sp = useSearchParams()
  const router = useRouter()

  const cid = sp.get('cid') || ''
  const token = sp.get('t') || ''

  const fileInputRef = useRef(null)
  const saveTimer = useRef(null)

  const [title, setTitle] = useState('Checklist TOTAL do Torneio')
  const [data, setData] = useState(DEFAULT_DATA)
  const [loading, setLoading] = useState(!!cid)
  const [saving, setSaving] = useState(false)
  const [saveMsg, setSaveMsg] = useState('')
  const [query, setQuery] = useState('')
  const [hideSemUtilidade, setHideSemUtilidade] = useState(false)
  const [shareUrl, setShareUrl] = useState('')

  // shareUrl client-only
  useEffect(() => {
    if (!cid || !token) return setShareUrl('')
    const u = new URL(window.location.href)
    u.searchParams.set('cid', cid)
    u.searchParams.set('t', token)
    setShareUrl(u.toString())
  }, [cid, token])

  // rascunho local antes de criar online
  useEffect(() => {
    if (cid) return
    try {
      const raw = localStorage.getItem('checklist_draft_v1')
      if (!raw) return
      const parsed = JSON.parse(raw)
      if (parsed?.title) setTitle(parsed.title)
      if (Array.isArray(parsed?.data)) setData(parsed.data)
    } catch {}
  }, [cid])

  useEffect(() => {
    if (cid) return
    try {
      localStorage.setItem('checklist_draft_v1', JSON.stringify({ title, data }))
    } catch {}
  }, [cid, title, data])

  // carrega do banco
  useEffect(() => {
    if (!cid || cid === 'undefined' || cid === 'null') {
      setLoading(false)
      return
    }

    let cancelled = false
    ;(async () => {
      setLoading(true)
      setSaveMsg('')
      try {
        const res = await fetch(`/api/checklists/${cid}?t=${encodeURIComponent(token)}`, { cache: 'no-store' })
        const json = await res.json()
        if (!res.ok) throw new Error(json?.error || 'Erro ao carregar')

        if (cancelled) return
        setTitle(json.title || 'Checklist TOTAL do Torneio')
        setData(Array.isArray(json.data) ? json.data : DEFAULT_DATA)
        setSaveMsg('Online ✓')
      } catch (e) {
        if (!cancelled) setSaveMsg(String(e.message || e))
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()

    return () => { cancelled = true }
  }, [cid, token])

  // Summary
  const allItems = useMemo(() => (data || []).flatMap(s => (s.items || [])), [data])

  const summary = useMemo(() => {
    const counts = Object.fromEntries(STATUS_LIST.map(s => [s, 0]))
    for (const it of allItems) counts[it.status] = (counts[it.status] || 0) + 1
    const consideredTotal = counts[STATUS.AGUARDANDO] + counts[STATUS.EM_ANDAMENTO] + counts[STATUS.OK]
    const done = counts[STATUS.OK]
    return { counts, consideredTotal, done, percent: pct(done, consideredTotal), total: allItems.length }
  }, [allItems])

  // Filtro
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return (data || [])
      .map(sec => {
        let items = sec.items || []
        if (hideSemUtilidade) items = items.filter(it => it.status !== STATUS.SEM_UTILIDADE)
        if (q) items = items.filter(it => (`${sec.title} ${it.label} ${it.owner} ${it.notes} ${it.status}`.toLowerCase()).includes(q))
        return { ...sec, items }
      })
      .filter(sec => (sec.items || []).length > 0)
  }, [data, query, hideSemUtilidade])

  // Autosave
  function scheduleSave(nextData, nextTitle = title) {
  // ✅ NÃO salva se não existe checklist online
  if (!cid || cid === 'undefined' || cid === 'null') return
  if (!token || token === 'undefined' || token === 'null') return
  if (!nextData) return

  if (saveTimer.current) clearTimeout(saveTimer.current)

  saveTimer.current = setTimeout(async () => {
    setSaving(true)
    setSaveMsg('Salvando…')
    try {
      const res = await fetch(`/api/checklists/${cid}?t=${encodeURIComponent(token)}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: nextTitle, data: nextData }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json?.error || 'Erro ao salvar')
      setSaveMsg('Salvo ✓')
    } catch (e) {
      setSaveMsg(`Falha ao salvar: ${String(e.message || e)}`)
    } finally {
      setSaving(false)
    }
  }, 700)
}


  // CRUD
  function updateSection(sectionId, patch) {
    setData(prev => {
      const next = prev.map(s => (s.id === sectionId ? { ...s, ...patch } : s))
      scheduleSave(next)
      return next
    })
  }

  function updateItem(sectionId, itemId, patch) {
    setData(prev => {
      const next = prev.map(sec => {
        if (sec.id !== sectionId) return sec
        return { ...sec, items: (sec.items || []).map(it => (it.id === itemId ? { ...it, ...patch } : it)) }
      })
      scheduleSave(next)
      return next
    })
  }

  function addSection(t) {
    const tt = (t || '').trim()
    if (!tt) return
    setData(prev => {
      const next = [...prev, { id: uid(), title: tt, open: true, items: [] }]
      scheduleSave(next)
      return next
    })
  }

  function removeSection(sectionId) {
    setData(prev => {
      const next = prev.filter(s => s.id !== sectionId)
      scheduleSave(next)
      return next
    })
  }

  function addItem(sectionId, label) {
    const t = (label || '').trim()
    if (!t) return
    setData(prev => {
      const next = prev.map(sec => {
        if (sec.id !== sectionId) return sec
        return {
          ...sec,
          open: true,
          items: [
            ...(sec.items || []),
            { id: uid(), label: t, status: STATUS.AGUARDANDO, owner: '', due: '', notes: '' },
          ],
        }
      })
      scheduleSave(next)
      return next
    })
  }

  function removeItem(sectionId, itemId) {
    setData(prev => {
      const next = prev.map(sec => {
        if (sec.id !== sectionId) return sec
        return { ...sec, items: (sec.items || []).filter(it => it.id !== itemId) }
      })
      scheduleSave(next)
      return next
    })
  }

  function moveItem(sectionId, itemId, dir) {
    setData(prev => {
      const next = prev.map(sec => {
        if (sec.id !== sectionId) return sec
        const items = [...(sec.items || [])]
        const idx = items.findIndex(it => it.id === itemId)
        if (idx < 0) return sec
        const nextIdx = clampIndex(idx + dir, items.length)
        if (nextIdx === idx) return sec
        const [sp] = items.splice(idx, 1)
        items.splice(nextIdx, 0, sp)
        return { ...sec, items }
      })
      scheduleSave(next)
      return next
    })
  }

  function bulkStatus(sectionId, st) {
    setData(prev => {
      const next = prev.map(sec => {
        if (sec.id !== sectionId) return sec
        return { ...sec, items: (sec.items || []).map(it => ({ ...it, status: st })) }
      })
      scheduleSave(next)
      return next
    })
  }

  async function createOnline() {
    setSaving(true)
    setSaveMsg('Criando checklist online…')
    try {
      const res = await fetch('/api/checklists', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, data }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json?.error || 'Erro ao criar')

      try { localStorage.removeItem('checklist_draft_v1') } catch {}

      router.replace(`/admin/checklist?cid=${json.id}&t=${json.token}`)
      setSaveMsg('Criado ✓')
    } catch (e) {
      setSaveMsg(`Falha: ${String(e.message || e)}`)
    } finally {
      setSaving(false)
    }
  }

  function exportJson() {
    const stamp = new Date().toISOString().slice(0, 10)
    downloadText(`checklist_total_${stamp}.json`, JSON.stringify({ title, data }, null, 2))
  }

  function importJson(file) {
    const reader = new FileReader()
    reader.onload = () => {
      try {
        const parsed = JSON.parse(String(reader.result || ''))
        const nextTitle = (parsed?.title || title).trim()
        const nextData = Array.isArray(parsed?.data) ? parsed.data : null
        if (!nextData) return alert('JSON inválido (esperado {title, data})')
        setTitle(nextTitle)
        setData(nextData)
        scheduleSave(nextData, nextTitle)
      } catch {
        alert('Arquivo inválido. Importe um JSON exportado por esta página.')
      }
    }
    reader.readAsText(file)
  }

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(shareUrl)
      setSaveMsg('Link copiado ✓')
    } catch {
      setSaveMsg('Não consegui copiar (copie manualmente da barra de endereço).')
    }
  }

  const showCreateBanner = !cid

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-64 bg-gradient-to-b from-indigo-50 to-transparent" />

      <div className="relative mx-auto max-w-6xl px-4 py-6">
        {/* Header */}
        <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div className="flex items-start gap-3">
            <div className="rounded-2xl bg-white p-3 shadow-sm ring-1 ring-slate-200">
              <ClipboardList className="h-6 w-6 text-indigo-700" />
            </div>
            <div className="min-w-0">
              <input
                value={title}
                onChange={(e) => {
                  setTitle(e.target.value)
                  scheduleSave(data, e.target.value)
                }}
                className="w-full min-w-0 rounded-xl border border-slate-200 bg-white px-3 py-2 text-2xl font-semibold outline-none focus:border-indigo-300 focus:ring-4 focus:ring-indigo-100"
              />
              <div className="mt-1 text-sm text-slate-600">
                Status: <b>sem utilidade</b> • <b>aguardando</b> • <b>em andamento</b> • <b>ok</b>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap gap-2 no-print">
            <button
              onClick={() => window.print()}
              className="inline-flex items-center gap-2 rounded-xl bg-white px-4 py-2 text-sm shadow-sm ring-1 ring-slate-200 hover:bg-slate-50"
            >
              <Printer className="h-4 w-4" /> Imprimir
            </button>

            <button
              onClick={exportJson}
              className="inline-flex items-center gap-2 rounded-xl bg-white px-4 py-2 text-sm shadow-sm ring-1 ring-slate-200 hover:bg-slate-50"
            >
              <Download className="h-4 w-4" /> Exportar
            </button>

            <input
              ref={fileInputRef}
              type="file"
              accept="application/json"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0]
                if (f) importJson(f)
                e.target.value = ''
              }}
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              className="inline-flex items-center gap-2 rounded-xl bg-white px-4 py-2 text-sm shadow-sm ring-1 ring-slate-200 hover:bg-slate-50"
            >
              <Upload className="h-4 w-4" /> Importar
            </button>

            <button
              onClick={() => { setData(DEFAULT_DATA); scheduleSave(DEFAULT_DATA, title) }}
              className="inline-flex items-center gap-2 rounded-xl bg-rose-50 px-4 py-2 text-sm text-rose-700 shadow-sm ring-1 ring-rose-200 hover:bg-rose-100"
              title="Voltar para o checklist padrão (substitui os itens)"
            >
              <RotateCcw className="h-4 w-4" /> Padrão
            </button>
          </div>
        </div>

        {/* Banner criar online */}
        {showCreateBanner && (
          <div className="mt-5 rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200 no-print">
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div className="text-sm text-slate-700">
                Este checklist está como <b>rascunho local</b>. Clique para criar a versão <b>online</b> no SQL e abrir em qualquer PC.
              </div>
              <button
                onClick={createOnline}
                disabled={saving}
                className="rounded-xl bg-indigo-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-indigo-700 disabled:opacity-60"
              >
                {saving ? 'Criando…' : 'Criar checklist online'}
              </button>
            </div>
          </div>
        )}

        {/* Link secreto */}
        {cid && token && shareUrl && (
          <div className="mt-4 rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200 no-print">
            <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
              <div className="text-xs text-slate-600">
                Link secreto (abre/edita em qualquer PC):{' '}
                <span className="font-medium text-slate-900 break-all">{shareUrl}</span>
              </div>
              <button
                onClick={copyLink}
                className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-3 py-2 text-xs font-medium text-white hover:bg-slate-800"
              >
                <LinkIcon className="h-4 w-4" /> Copiar link
              </button>
            </div>
          </div>
        )}

        {/* Barra de resumo */}
        <div className="mt-6 grid grid-cols-1 gap-3 md:grid-cols-3">
          <div className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200 md:col-span-2">
            <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
              <div className="text-sm text-slate-700">
                Progresso (desconsidera “sem utilidade”):{' '}
                <span className="font-semibold text-slate-900">{summary.percent}%</span>{' '}
                <span className="text-slate-500">({summary.done}/{summary.consideredTotal})</span>
              </div>
              <div className="flex flex-wrap gap-2 text-xs">
                {STATUS_LIST.map(st => (
                  <span key={st} className={`inline-flex items-center gap-2 rounded-full px-3 py-1 ${badgeClass(st)}`}>
                    <span className="capitalize">{st}</span>
                    <span className="font-semibold">{summary.counts[st] || 0}</span>
                  </span>
                ))}
              </div>
            </div>

            <div className="mt-3 h-3 w-full overflow-hidden rounded-full bg-slate-100 ring-1 ring-slate-200">
              <div className="h-full rounded-full bg-indigo-600" style={{ width: `${summary.percent}%` }} />
            </div>

            <div className="mt-2 text-xs text-slate-500">
              {loading ? 'Carregando…' : (saveMsg || (cid ? 'Online ✓' : 'Rascunho local'))}
            </div>
          </div>

          <div className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200 no-print">
            <div className="flex items-center gap-2 text-sm text-slate-700">
              <Search className="h-4 w-4" />
              <span>Buscar</span>
            </div>
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Ex.: contrato, MP, cartões..."
              className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-indigo-300 focus:ring-4 focus:ring-indigo-100"
            />
            <label className="mt-3 flex cursor-pointer items-center gap-2 text-xs text-slate-700">
              <input
                type="checkbox"
                checked={hideSemUtilidade}
                onChange={(e) => setHideSemUtilidade(e.target.checked)}
              />
              Ocultar “sem utilidade”
            </label>
          </div>
        </div>

        {/* Add section */}
        <AddSection onAdd={addSection} />

        {/* Sections */}
        <div className="mt-4 space-y-4">
          {filtered.map(sec => (
            <Section
              key={sec.id}
              sec={sec}
              onToggleOpen={() => updateSection(sec.id, { open: !sec.open })}
              onRename={(t) => updateSection(sec.id, { title: t })}
              onRemove={() => removeSection(sec.id)}
              onAddItem={(label) => addItem(sec.id, label)}
              onBulkStatus={(st) => bulkStatus(sec.id, st)}
              onUpdateItem={(itemId, patch) => updateItem(sec.id, itemId, patch)}
              onRemoveItem={(itemId) => removeItem(sec.id, itemId)}
              onMoveItem={(itemId, dir) => moveItem(sec.id, itemId, dir)}
            />
          ))}

          {filtered.length === 0 && (
            <div className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
              <div className="text-slate-700">
                Nada encontrado para <span className="font-semibold text-slate-900">“{query}”</span>.
              </div>
            </div>
          )}
        </div>
      </div>

      <style>{`
        @media print {
          .no-print { display: none !important; }
          body { background: #fff !important; }
        }
      `}</style>
    </div>
  )
}

function AddSection({ onAdd }) {
  const [title, setTitle] = useState('')
  return (
    <div className="mt-6 rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200 no-print">
      <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
        <div className="min-w-0">
          <div className="text-sm font-semibold text-slate-900">Adicionar nova seção</div>
          <div className="text-xs text-slate-500">Ex.: “Patrocínios”, “Ambulância”, “Som/Locução”, “Alvarás”</div>
        </div>
        <div className="flex w-full gap-2 md:w-[520px]">
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Título da seção"
            className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-indigo-300 focus:ring-4 focus:ring-indigo-100"
          />
          <button
            onClick={() => { onAdd(title); setTitle('') }}
            className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-indigo-700"
          >
            <Plus className="h-4 w-4" /> Criar
          </button>
        </div>
      </div>
    </div>
  )
}

function Section({
  sec,
  onToggleOpen,
  onRename,
  onRemove,
  onAddItem,
  onBulkStatus,
  onUpdateItem,
  onRemoveItem,
  onMoveItem,
}) {
  const [newItem, setNewItem] = useState('')

  const stats = useMemo(() => {
    const c = Object.fromEntries(STATUS_LIST.map(s => [s, 0]))
    for (const it of (sec.items || [])) c[it.status] = (c[it.status] || 0) + 1
    const consideredTotal = c[STATUS.AGUARDANDO] + c[STATUS.EM_ANDAMENTO] + c[STATUS.OK]
    const done = c[STATUS.OK]
    return { c, consideredTotal, done, percent: pct(done, consideredTotal) }
  }, [sec.items])

  return (
    <div className="rounded-2xl bg-white shadow-sm ring-1 ring-slate-200">
      <div className="border-b border-slate-100 p-4">
        <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <button
                onClick={onToggleOpen}
                className="rounded-xl bg-slate-100 p-2 hover:bg-slate-200 no-print"
                title={sec.open ? 'Recolher' : 'Expandir'}
              >
                {sec.open ? <ChevronUp className="h-4 w-4 text-slate-700" /> : <ChevronDown className="h-4 w-4 text-slate-700" />}
              </button>

              <input
                defaultValue={sec.title}
                onBlur={(e) => onRename(e.target.value)}
                className="w-full min-w-0 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold outline-none focus:border-indigo-300 focus:ring-4 focus:ring-indigo-100"
              />
            </div>

            <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
              <span className="text-slate-600">
                Progresso: <b className="text-slate-900">{stats.percent}%</b>{' '}
                <span className="text-slate-500">({stats.done}/{stats.consideredTotal})</span>
              </span>
              {STATUS_LIST.map(st => (
                <span key={st} className={`rounded-full px-3 py-1 ${badgeClass(st)}`}>
                  <span className="capitalize">{st}</span> <span className="font-semibold">{stats.c[st] || 0}</span>
                </span>
              ))}
            </div>

            <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-slate-100 ring-1 ring-slate-200">
              <div className="h-full rounded-full bg-indigo-600" style={{ width: `${stats.percent}%` }} />
            </div>
          </div>

          <div className="flex flex-wrap gap-2 no-print">
            <button onClick={() => onBulkStatus(STATUS.OK)} className="rounded-xl bg-emerald-600 px-3 py-2 text-xs font-medium text-white hover:bg-emerald-700">Tudo OK</button>
            <button onClick={() => onBulkStatus(STATUS.EM_ANDAMENTO)} className="rounded-xl bg-amber-600 px-3 py-2 text-xs font-medium text-white hover:bg-amber-700">Tudo em andamento</button>
            <button onClick={() => onBulkStatus(STATUS.AGUARDANDO)} className="rounded-xl bg-sky-600 px-3 py-2 text-xs font-medium text-white hover:bg-sky-700">Tudo aguardando</button>
            <button onClick={() => onBulkStatus(STATUS.SEM_UTILIDADE)} className="rounded-xl bg-slate-600 px-3 py-2 text-xs font-medium text-white hover:bg-slate-700">Tudo sem utilidade</button>

            <button onClick={onRemove} className="rounded-xl bg-rose-50 px-3 py-2 text-xs text-rose-700 ring-1 ring-rose-200 hover:bg-rose-100" title="Excluir seção">
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        </div>

        <div className="mt-4 flex flex-col gap-2 md:flex-row no-print">
          <input
            value={newItem}
            onChange={(e) => setNewItem(e.target.value)}
            placeholder="Adicionar item nesta seção"
            className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-indigo-300 focus:ring-4 focus:ring-indigo-100"
          />
          <button
            onClick={() => { onAddItem(newItem); setNewItem('') }}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800"
          >
            <Plus className="h-4 w-4" /> Adicionar
          </button>
        </div>
      </div>

      {sec.open && (
        <div className="divide-y divide-slate-100">
          {(sec.items || []).map((it) => (
            <div key={it.id} className="p-4">
              <div className="grid grid-cols-1 gap-3 md:grid-cols-12 md:items-start">
                <div className="md:col-span-5">
                  <div className="mb-1 flex items-center justify-between">
                    <span className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs ${badgeClass(it.status)}`}>
                      <span className="capitalize">{it.status}</span>
                    </span>

                    <div className="flex items-center gap-1 no-print">
                      <button onClick={() => onMoveItem(it.id, -1)} className="rounded-lg bg-slate-100 p-2 hover:bg-slate-200" title="Subir">
                        <ArrowUp className="h-4 w-4 text-slate-700" />
                      </button>
                      <button onClick={() => onMoveItem(it.id, +1)} className="rounded-lg bg-slate-100 p-2 hover:bg-slate-200" title="Descer">
                        <ArrowDown className="h-4 w-4 text-slate-700" />
                      </button>
                      <button onClick={() => onRemoveItem(it.id)} className="rounded-lg bg-rose-50 p-2 hover:bg-rose-100" title="Excluir item">
                        <Trash2 className="h-4 w-4 text-rose-700" />
                      </button>
                    </div>
                  </div>

                  <textarea
                    value={it.label}
                    onChange={(e) => onUpdateItem(it.id, { label: e.target.value })}
                    className="min-h-[54px] w-full resize-y rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-indigo-300 focus:ring-4 focus:ring-indigo-100"
                  />
                </div>

                <div className="md:col-span-2">
                  <div className="mb-1 text-xs text-slate-500">Status</div>
                  <select
                    value={it.status}
                    onChange={(e) => onUpdateItem(it.id, { status: e.target.value })}
                    className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-indigo-300 focus:ring-4 focus:ring-indigo-100"
                  >
                    {STATUS_LIST.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>

                <div className="md:col-span-2">
                  <div className="mb-1 text-xs text-slate-500">Responsável</div>
                  <input
                    value={it.owner}
                    onChange={(e) => onUpdateItem(it.id, { owner: e.target.value })}
                    placeholder="Nome"
                    className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-indigo-300 focus:ring-4 focus:ring-indigo-100"
                  />
                </div>

                <div className="md:col-span-2">
                  <div className="mb-1 text-xs text-slate-500">Prazo</div>
                  <input
                    type="date"
                    value={it.due}
                    onChange={(e) => onUpdateItem(it.id, { due: e.target.value })}
                    className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-indigo-300 focus:ring-4 focus:ring-indigo-100"
                  />
                </div>

                <div className="md:col-span-12">
                  <div className="mb-1 flex items-center justify-between text-xs text-slate-500">
                    <span>Observações</span>
                    {it.notes ? (
                      <button
                        onClick={() => onUpdateItem(it.id, { notes: '' })}
                        className="inline-flex items-center gap-1 rounded-lg bg-slate-100 px-2 py-1 text-xs hover:bg-slate-200 no-print"
                      >
                        <X className="h-3.5 w-3.5" /> limpar
                      </button>
                    ) : null}
                  </div>
                  <input
                    value={it.notes}
                    onChange={(e) => onUpdateItem(it.id, { notes: e.target.value })}
                    placeholder="Links, valores, observações…"
                    className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-indigo-300 focus:ring-4 focus:ring-indigo-100"
                  />
                </div>
              </div>
            </div>
          ))}

          {(sec.items || []).length === 0 && (
            <div className="p-4 text-sm text-slate-500">Nenhum item nesta seção ainda.</div>
          )}
        </div>
      )}
    </div>
  )
}
