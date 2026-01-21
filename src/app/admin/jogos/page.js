'use client'

import { useEffect, useMemo, useState, useRef } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  ArrowLeft, PlusCircle, Save, CheckCircle, Loader2,
  Trash2, Trophy, Clock, Calendar,
  StopCircle, Edit3, X, User, Lock, RotateCcw,
  ExternalLink, RefreshCcw, Settings
} from 'lucide-react'

// Função auxiliar segura para ler JSON
async function safeJson(res) {
  try {
    const text = await res.text()
    try { return JSON.parse(text) } catch { return { error: text || `Erro ${res.status}` } }
  } catch (e) { return { error: 'Falha na conexão' } }
}

// Labels de status (Etapa)
const ETAPA_STATUS = [
  { value: 'AGUARDANDO', label: 'Aguardando' },
  { value: 'EM_ANDAMENTO', label: 'Em andamento' },
  { value: 'FINALIZADA', label: 'Finalizada' }
]

// Labels de status (Jogo) — backend: EM_BREVE/EM_ANDAMENTO/FINALIZADO
const JOGO_STATUS_LABEL = {
  EM_BREVE: 'Aguardando',
  EM_ANDAMENTO: 'Em andamento',
  FINALIZADO: 'Finalizada'
}

export default function AdminJogosAoVivo() {
  const [pin, setPin] = useState('')
  const [authed, setAutenticado] = useState(false)
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  // Dados Globais
  const [etapas, setEtapas] = useState([])
  const [etapaId, setEtapaId] = useState('')
  const [jogos, setJogos] = useState([])
  const [timesDaEtapa, setTimesDaEtapa] = useState([])

  // ✅ Status editável da etapa selecionada
  const [etapaSelecionada, setEtapaSelecionada] = useState(null)
  const [etapaStatusDraft, setEtapaStatusDraft] = useState('AGUARDANDO')

  // UI
  const [autoRefresh, setAutoRefresh] = useState(true)
  const refreshTimerRef = useRef(null)

  // Criação de Nova Etapa
  const [novaEtapa, setNovaEtapa] = useState({
    modalidade: 'FUTSAL',
    titulo: '',
    status: 'AGUARDANDO'
  })

  function auth() {
    if (pin === '2026') setAutenticado(true)
    else alert('PIN incorreto')
  }

  // --- CARREGAMENTO INICIAL ---
  async function loadAll() {
    setLoading(true)
    try {
      const etRes = await fetch('/api/admin/etapas', { headers: { 'x-admin-pin': pin }, cache: 'no-store' })
      const etData = await safeJson(etRes)
      setEtapas(Array.isArray(etData) ? etData : [])
    } catch (e) {
      setEtapas([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (authed) loadAll()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authed])

  // --- SELEÇÃO DE ETAPA ---
  async function selecionarEtapa(id) {
    if (!id) return
    const idStr = String(id)
    setEtapaId(idStr)
    setLoading(true)

    // ✅ set etapa selecionada (para editar status)
    const eLocal = (Array.isArray(etapas) ? etapas : []).find(x => String(x.id) === idStr) || null
    setEtapaSelecionada(eLocal)
    setEtapaStatusDraft((eLocal?.status || 'AGUARDANDO').toUpperCase())

    try {
      // 1) Jogos
      const resJogos = await fetch(`/api/admin/jogos?etapa_id=${idStr}`, {
        headers: { 'x-admin-pin': pin },
        cache: 'no-store'
      })
      const dataJogos = await safeJson(resJogos)
      setJogos(Array.isArray(dataJogos) ? dataJogos : [])

      // 2) Times da Etapa (mantém só para contador)
      const resTimes = await fetch(`/api/admin/etapas/gerenciar-times?etapa_id=${idStr}`, {
        headers: { 'x-admin-pin': pin },
        cache: 'no-store'
      })
      const dataTimes = await safeJson(resTimes)
      setTimesDaEtapa(Array.isArray(dataTimes) ? dataTimes : [])
    } catch (e) {
      setJogos([])
      setTimesDaEtapa([])
    } finally {
      setLoading(false)
    }
  }

  // ✅ mantém etapa selecionada sincronizada se a lista de etapas atualizar
  useEffect(() => {
    if (!etapaId) return
    const e = (Array.isArray(etapas) ? etapas : []).find(x => String(x.id) === String(etapaId)) || null
    setEtapaSelecionada(e)
    if (e?.status) setEtapaStatusDraft(String(e.status).toUpperCase())
  }, [etapas, etapaId])

  // --- AUTO REFRESH ---
  useEffect(() => {
    if (!authed || !etapaId) return
    if (!autoRefresh) return

    if (refreshTimerRef.current) clearInterval(refreshTimerRef.current)
    refreshTimerRef.current = setInterval(() => {
      selecionarEtapa(etapaId)
    }, 5000)

    return () => {
      if (refreshTimerRef.current) clearInterval(refreshTimerRef.current)
      refreshTimerRef.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authed, etapaId, autoRefresh])

  // --- AÇÕES GERAIS ---
  async function criarEtapa() {
    if (!novaEtapa.titulo) return alert('Digite um nome para a etapa')
    setLoading(true)
    try {
      const res = await fetch('/api/admin/etapas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-admin-pin': pin },
        body: JSON.stringify(novaEtapa)
      })
      const data = await safeJson(res)
      if (!res.ok || data?.error) {
        alert(`Erro: ${data?.error || 'Falha ao criar etapa'}`)
        return
      }

      await loadAll()
      setNovaEtapa({ ...novaEtapa, titulo: '' })
      alert('Etapa criada com sucesso!')
      setEtapaId('')
      setEtapaSelecionada(null)
      setJogos([])
      setTimesDaEtapa([])
    } finally {
      setLoading(false)
    }
  }

  async function excluirEtapa(id_para_excluir) {
    if (!confirm('TEM CERTEZA? Isso apagará a etapa, todos os jogos e a classificação.')) return
    setLoading(true)
    try {
      await fetch(`/api/admin/etapas?id=${id_para_excluir}`, {
        method: 'DELETE',
        headers: { 'x-admin-pin': pin }
      })

      if (String(etapaId) === String(id_para_excluir)) {
        setEtapaId('')
        setEtapaSelecionada(null)
        setJogos([])
        setTimesDaEtapa([])
      }
      await loadAll()
    } finally {
      setLoading(false)
    }
  }

  // ✅ ATUALIZAR STATUS DA ETAPA (já criada)
  async function salvarStatusEtapa() {
    if (!etapaId) return alert('Selecione uma etapa.')
    if (!etapaStatusDraft) return

    setLoading(true)
    try {
      const res = await fetch('/api/admin/etapas', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'x-admin-pin': pin },
        body: JSON.stringify({ id: Number(etapaId), status: etapaStatusDraft })
      })
      const data = await safeJson(res)
      if (!res.ok || data?.error) {
        alert(`Erro: ${data?.error || 'Falha ao atualizar status'}`)
        return
      }

      await loadAll()
      await selecionarEtapa(etapaId)
      alert('Status da etapa atualizado!')
    } finally {
      setLoading(false)
    }
  }

  async function atualizarJogo(payload) {
    await fetch('/api/admin/jogos', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', 'x-admin-pin': pin },
      body: JSON.stringify(payload)
    })
    await selecionarEtapa(etapaId)
  }

  // --- Jogos AO VIVO (somente EM_ANDAMENTO) ---
  const jogosAoVivo = useMemo(() => {
    return (Array.isArray(jogos) ? jogos : []).filter(j => j.status === 'EM_ANDAMENTO')
  }, [jogos])

  // --- LOGIN ---
  if (!authed) {
    return (
      <main className="min-h-screen bg-slate-950 flex items-center justify-center p-6">
        <div className="bg-slate-900 p-12 rounded-[2rem] border border-slate-800 text-center max-w-sm w-full shadow-2xl">
          <div className="w-20 h-20 bg-blue-600 rounded-3xl rotate-6 flex items-center justify-center mx-auto mb-8 shadow-lg">
            <Lock className="text-white" size={36} />
          </div>
          <h1 className="text-2xl font-black text-white uppercase mb-2">Gestão de etapas</h1>
          <p className="text-xs text-slate-400 font-bold mb-6 uppercase tracking-widest">
            Cria Etapa, altera para em andamento e finaliza
          </p>

          <input
            type="password"
            placeholder="PIN"
            className="w-full p-4 bg-slate-950 border border-slate-700 rounded-xl text-center text-white font-black text-4xl mb-6 outline-none focus:border-blue-600"
            value={pin}
            onChange={(e) => setPin(e.target.value)}
            maxLength={4}
          />

          <button
            onClick={auth}
            className="w-full bg-blue-600 text-white font-black py-4 rounded-xl uppercase hover:bg-blue-500 shadow-xl"
          >
            Entrar
          </button>
        </div>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-slate-50 py-10 px-4 md:px-10 relative text-slate-800">
      <div className="max-w-7xl mx-auto">

        {/* HEADER */}
        <div className="flex justify-between items-center mb-8">
          <Link href="/admin" className="flex items-center gap-2 text-slate-500 hover:text-blue-600 font-bold text-sm uppercase">
            <ArrowLeft size={18} /> Voltar
          </Link>

          <div className="flex items-center gap-3">
            <button
              onClick={() => router.push('/admin/jogos-novo')}
              className="bg-white border border-slate-200 hover:border-blue-300 hover:text-blue-600 text-slate-600 font-black px-4 py-2 rounded-xl text-xs uppercase flex items-center gap-2 shadow-sm"
              title="Abrir gestão completa"
            >
              <ExternalLink size={14} /> Ir para Jogos-Novo
            </button>

            <button
              onClick={() => selecionarEtapa(etapaId)}
              disabled={!etapaId || loading}
              className="bg-slate-900 text-white hover:bg-black font-black px-4 py-2 rounded-xl text-xs uppercase flex items-center gap-2"
              title="Atualizar agora"
            >
              <RefreshCcw size={14} className={loading ? 'animate-spin' : ''} /> Atualizar
            </button>

            <label className="flex items-center gap-2 bg-white border border-slate-200 px-3 py-2 rounded-xl text-xs font-black uppercase text-slate-600">
              <input
                type="checkbox"
                checked={autoRefresh}
                onChange={(e) => setAutoRefresh(e.target.checked)}
                className="accent-blue-600"
              />
              Auto
            </label>

            <div className="text-right">
              <p className="text-xs font-black uppercase text-slate-400 tracking-widest">Tela</p>
              <h1 className="text-3xl font-black uppercase italic tracking-tighter text-slate-900">
                Ao Vivo
              </h1>
            </div>
          </div>
        </div>

        {/* 1) ETAPAS */}
        <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-8 mb-8">
          <div className="flex justify-between items-center mb-6">
            <h2 className="font-black uppercase text-slate-900 text-lg flex items-center gap-2">
              <Trophy className="text-yellow-500" size={20} /> Etapas
            </h2>
            {loading && <Loader2 className="animate-spin text-slate-400" />}
          </div>

          {/* CRIAR ETAPA */}
          <div className="grid md:grid-cols-6 gap-4 mb-6 p-4 bg-slate-50 rounded-2xl border border-slate-100">
            <select
              className="p-3 rounded-xl border bg-white font-bold text-slate-700 outline-none"
              value={novaEtapa.modalidade}
              onChange={(e) => setNovaEtapa({ ...novaEtapa, modalidade: e.target.value })}
            >
              <option value="FUTSAL">FUTSAL</option>
              <option value="SUICO">SUÍÇO</option>
            </select>

            <input
              className="p-3 rounded-xl border bg-white font-bold md:col-span-2 text-slate-700 outline-none"
              value={novaEtapa.titulo}
              onChange={(e) => setNovaEtapa({ ...novaEtapa, titulo: e.target.value })}
              placeholder="Nome da Etapa (Ex: Copa Verão)"
            />

            <select
              className="p-3 rounded-xl border bg-white font-bold text-slate-700 outline-none"
              value={novaEtapa.status}
              onChange={(e) => setNovaEtapa({ ...novaEtapa, status: e.target.value })}
              title="Status da etapa"
            >
              {ETAPA_STATUS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
            </select>

            <button
              onClick={criarEtapa}
              className="bg-slate-900 text-white font-black rounded-xl px-4 uppercase text-xs hover:bg-blue-600 transition-colors shadow-lg md:col-span-2"
              title="Criar etapa"
              disabled={loading}
            >
              <PlusCircle size={16} className="inline mr-2" /> Criar Etapa
            </button>
          </div>

          {/* ✅ EDITAR STATUS DA ETAPA SELECIONADA */}
          <div className="mb-8 p-4 rounded-2xl border border-slate-200 bg-white flex flex-col md:flex-row md:items-center gap-3 justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-slate-900 text-white flex items-center justify-center">
                <Settings size={18} />
              </div>

              <div>
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Status da etapa selecionada</p>
                <p className="font-black text-slate-900">
                  {etapaSelecionada?.titulo ? etapaSelecionada.titulo : 'Selecione uma etapa abaixo'}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <select
                className="p-3 rounded-xl border bg-white font-black text-slate-700 outline-none"
                value={etapaStatusDraft}
                onChange={(e) => setEtapaStatusDraft(e.target.value)}
                disabled={!etapaId || loading}
                title="Alterar status da etapa"
              >
                {ETAPA_STATUS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
              </select>

              <button
                onClick={salvarStatusEtapa}
                disabled={!etapaId || loading}
                className="bg-blue-600 hover:bg-blue-500 text-white font-black px-5 py-3 rounded-xl text-xs uppercase flex items-center gap-2"
                title="Salvar status da etapa"
              >
                <Save size={14} /> Salvar Status
              </button>

              <button
                onClick={() => { setEtapaStatusDraft('EM_ANDAMENTO') }}
                disabled={!etapaId || loading}
                className="bg-green-50 border border-green-200 text-green-700 font-black px-4 py-3 rounded-xl text-[10px] uppercase"
                title="Preparar para Em andamento"
              >
                Iniciar
              </button>
              <button
                onClick={() => { setEtapaStatusDraft('FINALIZADA') }}
                disabled={!etapaId || loading}
                className="bg-slate-100 border border-slate-200 text-slate-700 font-black px-4 py-3 rounded-xl text-[10px] uppercase"
                title="Preparar para Finalizada"
              >
                Finalizar
              </button>
            </div>
          </div>

          {/* LISTA DE ETAPAS */}
          <div className="grid md:grid-cols-3 gap-3">
            {Array.isArray(etapas) && etapas.map((e) => (
              <div key={e.id} className="relative group">
                <button
                  onClick={() => selecionarEtapa(e.id)}
                  className={`w-full text-left p-5 rounded-2xl border font-bold transition-all hover:scale-[1.02] ${
                    String(etapaId) === String(e.id)
                      ? 'border-blue-600 bg-blue-50 ring-2 ring-blue-200 shadow-md'
                      : 'border-slate-200 bg-white hover:bg-slate-50'
                  }`}
                >
                  <div className="text-[10px] uppercase font-black tracking-widest text-slate-400 mb-1">
                    {e.modalidade} • {String(e.status || 'AGUARDANDO').toUpperCase()}
                  </div>
                  <div className="text-slate-900 font-black truncate text-lg pr-10">
                    {e.titulo}
                  </div>
                </button>

                <button
                  onClick={(event) => { event.stopPropagation(); excluirEtapa(e.id) }}
                  className="absolute top-4 right-4 text-red-300 hover:text-red-600 opacity-0 group-hover:opacity-100 transition-opacity p-2"
                  title="Excluir Etapa"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* 2) AO VIVO — somente EM_ANDAMENTO */}
        {etapaId ? (
          <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-300">

            {/* CARD RESUMO (SEM BOTÕES, SEM GRUPOS) */}
            <div className="bg-slate-900 text-white rounded-3xl shadow-2xl shadow-slate-400 p-8 relative overflow-hidden">
              <div className="absolute top-0 right-0 p-8 opacity-5"><Trophy size={200} /></div>

              <div className="grid lg:grid-cols-3 gap-8 relative z-10">
                <div className="bg-white/5 p-6 rounded-3xl border border-white/10">
                  <p className="text-blue-400 text-[10px] font-black uppercase tracking-widest mb-4">Times</p>
                  <div className="flex justify-between items-end mb-2">
                    <span className="text-4xl font-black">{timesDaEtapa.length}</span>
                    <span className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">Na etapa</span>
                  </div>
                  <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                    Gerencie times / grupos / sorteio em Jogos-Novo
                  </div>
                </div>

                <div className="lg:col-span-2 bg-white/5 p-6 rounded-3xl border border-white/10">
                  <p className="text-yellow-400 text-[10px] font-black uppercase tracking-widest mb-3 border-b border-white/10 pb-2">
                    Gestão completa
                  </p>
                  <div className="text-xs font-bold text-slate-300">
                    Abra <span className="text-white">Jogos-Novo</span> para editar grupos, importar times, gerar jogos e sorteios.
                  </div>
                </div>
              </div>
            </div>

            <div className="space-y-6">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <h2 className="font-black uppercase text-slate-900 text-2xl tracking-tight">Jogos Ao Vivo</h2>
                  <span className="bg-green-100 text-green-700 px-3 py-1 rounded-full text-xs font-black shadow-inner">
                    {jogosAoVivo.length}
                  </span>
                </div>

                <p className="text-xs font-bold text-slate-500 uppercase tracking-widest">
                  Mostrando somente status: <span className="text-green-700">EM ANDAMENTO</span>
                </p>
              </div>

              {jogosAoVivo.length === 0 ? (
                <div className="bg-white rounded-3xl p-16 text-center border border-slate-200 shadow-sm">
                  <p className="text-slate-500 font-black uppercase">Nenhum jogo em andamento.</p>
                  <p className="text-slate-400 text-xs font-bold mt-2">
                    Inicie um jogo na gestão completa (Jogos-Novo).
                  </p>
                  <button
                    onClick={() => router.push('/admin/jogos-novo')}
                    className="mt-6 bg-slate-900 text-white px-6 py-3 rounded-xl font-black text-xs uppercase inline-flex items-center gap-2"
                  >
                    <ExternalLink size={14} /> Abrir Jogos-Novo
                  </button>
                </div>
              ) : (
                <div className="grid md:grid-cols-2 gap-6">
                  {jogosAoVivo.map((j) => (
                    <GameCardAoVivo key={j.id} jogo={j} onUpdate={atualizarJogo} busy={loading} />
                  ))}
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="text-center p-20 bg-slate-100 rounded-3xl border border-dashed border-slate-300">
            <Trophy className="mx-auto text-slate-300 mb-4" size={64} />
            <p className="text-slate-500 font-bold text-lg">Selecione ou Crie uma Etapa acima para começar.</p>
          </div>
        )}
      </div>
    </main>
  )
}

// ======================================================
// CARD AO VIVO — só mostra EM_ANDAMENTO (ações essenciais)
// ======================================================
function GameCardAoVivo({ jogo, onUpdate, busy }) {
  const [ga, setGa] = useState(jogo.gols_a ?? '')
  const [gb, setGb] = useState(jogo.gols_b ?? '')
  const [pa, setPa] = useState(jogo.penaltis_a ?? '')
  const [pb, setPb] = useState(jogo.penaltis_b ?? '')
  const [showPenalties, setShowPenalties] = useState(jogo.penaltis_a !== null || jogo.penaltis_b !== null)

  const [editData, setEditData] = useState(jogo.data_jogo ?? '')
  const [editHora, setEditHora] = useState(jogo.horario ? String(jogo.horario).slice(0, 5) : '')
  const [editJuiz, setEditJuiz] = useState(jogo.arbitro ?? '')
  const [isEditing, setIsEditing] = useState(false)

  const nomeA = jogo?.equipeA?.nome_equipe || 'Equipe A'
  const nomeB = jogo?.equipeB?.nome_equipe || 'Equipe B'

  const dataFormatada = jogo.data_jogo
    ? new Date(jogo.data_jogo + 'T00:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })
    : ''

  const horaFormatada = jogo.horario ? String(jogo.horario).slice(0, 5) : '--:--'

  const labelTipo =
    jogo.tipo_jogo === 'FINAL' ? '🏆 FINAL'
      : jogo.tipo_jogo === 'DISPUTA_3' ? '🥉 3º LUGAR'
        : `RODADA ${jogo.rodada}`

  function saveInfo() {
    onUpdate({ action: 'update_info', id: jogo.id, data_jogo: editData, horario: editHora, arbitro: editJuiz })
    setIsEditing(false)
  }

  function saveScore() {
    const payload = {
      action: 'set_score',
      id: jogo.id,
      gols_a: ga,
      gols_b: gb,
      penaltis_a: showPenalties && pa !== '' ? pa : null,
      penaltis_b: showPenalties && pb !== '' ? pb : null
    }
    onUpdate(payload)
  }

  return (
    <div className="rounded-[2rem] border transition-all shadow-sm hover:shadow-lg bg-white border-slate-200">
      <div className="p-5 border-b border-slate-100 flex justify-between items-center bg-slate-50/50 rounded-t-[2rem]">
        <div className="flex items-center gap-3">
          <span className="px-3 py-1.5 rounded-lg text-[10px] font-black uppercase border bg-green-100 text-green-700 border-green-200 shadow-sm animate-pulse">
            Ao Vivo ●
          </span>
          <span className="text-xs font-bold text-slate-400 uppercase tracking-wide">{labelTipo}</span>
        </div>

        <div className="flex items-center gap-2">
          {isEditing ? (
            <div className="flex items-center gap-1 bg-white p-1 rounded-xl border border-slate-200 shadow-lg absolute right-12 z-10">
              <input className="border rounded-lg p-2 text-xs w-24 outline-none focus:border-blue-500 font-bold" type="text" placeholder="Juiz" value={editJuiz} onChange={e => setEditJuiz(e.target.value)} />
              <input className="border rounded-lg p-2 text-xs w-28 outline-none focus:border-blue-500 font-bold" type="date" value={editData} onChange={e => setEditData(e.target.value)} />
              <input className="border rounded-lg p-2 text-xs w-20 outline-none focus:border-blue-500 font-bold" type="time" value={editHora} onChange={e => setEditHora(e.target.value)} />
              <button onClick={saveInfo} className="bg-blue-600 text-white p-2 rounded-lg hover:bg-blue-700 shadow-md">
                <CheckCircle size={14} />
              </button>
              <button onClick={() => setIsEditing(false)} className="bg-slate-100 text-slate-600 p-2 rounded-lg hover:bg-slate-200">
                <X size={14} />
              </button>
            </div>
          ) : (
            <div
              className="flex items-center gap-3 group cursor-pointer hover:bg-slate-100 px-3 py-2 rounded-xl transition-all"
              onClick={() => setIsEditing(true)}
              title="Editar juiz/data/hora"
            >
              {jogo.arbitro && (
                <span className="text-[10px] font-bold text-slate-400 uppercase flex items-center gap-1">
                  <User size={10} /> {jogo.arbitro}
                </span>
              )}
              <span className="text-xs font-bold text-slate-600 flex items-center gap-1">
                <Calendar size={12} className="text-blue-500" /> {dataFormatada || '--/--'}
              </span>
              <span className="text-xs font-bold text-slate-600 flex items-center gap-1">
                <Clock size={12} className="text-blue-500" /> {horaFormatada}
              </span>
              <Edit3 size={12} className="text-slate-300 opacity-0 group-hover:opacity-100 transition-opacity" />
            </div>
          )}
        </div>
      </div>

      <div className="p-8 relative">
        <button
          onClick={() => setShowPenalties(!showPenalties)}
          className={`absolute top-2 right-2 text-[10px] font-black px-2 py-1 rounded uppercase border transition-colors ${
            showPenalties ? 'bg-slate-800 text-white border-slate-800' : 'bg-white text-slate-300 border-slate-200 hover:text-slate-500'
          }`}
        >
          Pênaltis
        </button>

        <div className="flex justify-between items-center mb-8">
          <p className="font-black text-slate-800 text-center w-1/3 text-sm md:text-lg leading-tight">{nomeA}</p>

          <div className="text-center w-1/3 flex flex-col items-center justify-center gap-2">
            <div className="flex items-center gap-3">
              <input
                className="w-14 h-14 text-center text-3xl font-black bg-slate-50 rounded-2xl border border-slate-200 focus:border-blue-500 outline-none text-slate-900"
                value={ga}
                onChange={e => setGa(e.target.value)}
                placeholder="0"
              />
              <span className="text-slate-300 font-black text-xl">:</span>
              <input
                className="w-14 h-14 text-center text-3xl font-black bg-slate-50 rounded-2xl border border-slate-200 focus:border-blue-500 outline-none text-slate-900"
                value={gb}
                onChange={e => setGb(e.target.value)}
                placeholder="0"
              />
            </div>

            {showPenalties && (
              <div className="flex items-center gap-2 animate-in fade-in slide-in-from-top-1">
                <input
                  className="w-8 h-8 text-center text-xs font-bold bg-slate-100 rounded-lg border border-slate-300 focus:border-blue-500 outline-none text-slate-600"
                  value={pa}
                  onChange={e => setPa(e.target.value)}
                  placeholder="P"
                />
                <span className="text-[10px] font-bold text-slate-400 uppercase">Pênaltis</span>
                <input
                  className="w-8 h-8 text-center text-xs font-bold bg-slate-100 rounded-lg border border-slate-300 focus:border-blue-500 outline-none text-slate-600"
                  value={pb}
                  onChange={e => setPb(e.target.value)}
                  placeholder="P"
                />
              </div>
            )}
          </div>

          <p className="font-black text-slate-800 text-center w-1/3 text-sm md:text-lg leading-tight">{nomeB}</p>
        </div>

        <div className="flex justify-center gap-3">
          <button
            onClick={saveScore}
            disabled={busy}
            className="bg-slate-100 p-3 rounded-xl text-slate-600 hover:bg-slate-200 hover:text-blue-600 transition-colors"
            title="Salvar Placar"
          >
            <Save size={20} />
          </button>

          <button
            onClick={() => onUpdate({ action: 'set_status', id: jogo.id, status: 'FINALIZADO' })}
            disabled={busy}
            className="bg-slate-900 text-white px-6 py-2 rounded-xl font-black text-xs uppercase flex items-center gap-2 hover:bg-black shadow-lg shadow-slate-900/20 transition-all hover:scale-105"
            title="Encerrar partida"
          >
            <StopCircle size={18} /> Encerrar
          </button>

          <button
            onClick={() => onUpdate({ action: 'set_status', id: jogo.id, status: 'EM_BREVE' })}
            disabled={busy}
            className="bg-white border border-slate-200 text-slate-600 px-6 py-2 rounded-xl font-black text-xs uppercase flex items-center gap-2 hover:bg-slate-50"
            title={`Voltar para "${JOGO_STATUS_LABEL.EM_BREVE}"`}
          >
            <RotateCcw size={18} /> Aguardando
          </button>
        </div>
      </div>
    </div>
  )
}
