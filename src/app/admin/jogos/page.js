'use client'

import { useEffect, useMemo, useState, useRef } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  ArrowLeft, PlusCircle, Save, CheckCircle, Loader2,
  ClipboardList, Trash2, Shuffle, Trophy, Clock, Users, Calendar,
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
  const [todosTimes, setTodosTimes] = useState([])
  const [timesDaEtapa, setTimesDaEtapa] = useState([])

  // ✅ Status editável da etapa selecionada
  const [etapaSelecionada, setEtapaSelecionada] = useState(null)
  const [etapaStatusDraft, setEtapaStatusDraft] = useState('AGUARDANDO')

  // Modal e Configurações
  const [showModalTimes, setShowModalTimes] = useState(false)
  const [selectedTeams, setSelectedTeams] = useState(new Set())

  // Backup (mantido)
  const [horData, setHorData] = useState('')
  const [horInicio, setHorInicio] = useState('08:00')
  const [horDuracao, setHorDuracao] = useState(50)
  const [horIntervalo, setHorIntervalo] = useState(5)

  const [sorteioDataBase, setSorteioDataBase] = useState('')
  const [sorteioLimpar, setSorteioLimpar] = useState(true)

  // Criação de Nova Etapa
  const [novaEtapa, setNovaEtapa] = useState({
    modalidade: 'FUTSAL',
    titulo: '',
    status: 'AGUARDANDO'
  })

  // Novo Jogo Manual (Backup)
  const [novoJogo, setNovoJogo] = useState({
    rodada: '',
    data_jogo: '',
    equipe_a_id: '',
    equipe_b_id: '',
    tipo_jogo: 'GRUPO'
  })

  // UI
  const [showBackup, setShowBackup] = useState(false)
  const [autoRefresh, setAutoRefresh] = useState(true)
  const refreshTimerRef = useRef(null)

  function auth() {
    if (pin === '2026') setAutenticado(true)
    else alert('PIN incorreto')
  }

  // --- CARREGAMENTO INICIAL ---
  async function loadAll() {
    setLoading(true)
    try {
      const [etRes, allTeamsRes] = await Promise.all([
        fetch('/api/admin/etapas', { headers: { 'x-admin-pin': pin }, cache: 'no-store' }),
        fetch('/api/admin/teams', { headers: { 'x-admin-pin': pin }, cache: 'no-store' })
      ])
      const etData = await safeJson(etRes)
      const teamsData = await safeJson(allTeamsRes)
      setEtapas(Array.isArray(etData) ? etData : [])
      setTodosTimes(Array.isArray(teamsData) ? teamsData : [])
    } catch (e) {
      setEtapas([])
      setTodosTimes([])
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

    // Reseta configurações de horário ao trocar de etapa para evitar erros
    setHorData('')

    // ✅ set etapa selecionada (para editar status) a partir da lista já carregada
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

      // 2) Times da Etapa
      const resGrupos = await fetch(`/api/admin/etapas/gerenciar-times?etapa_id=${idStr}`, {
        headers: { 'x-admin-pin': pin },
        cache: 'no-store'
      })
      const dataGrupos = await safeJson(resGrupos)
      setTimesDaEtapa(Array.isArray(dataGrupos) ? dataGrupos : [])
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
  // IMPORTANTE: esse endpoint precisa aceitar PUT com { id, status }
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
      // recarrega dados da etapa selecionada (jogos/times)
      await selecionarEtapa(etapaId)
      alert('Status da etapa atualizado!')
    } finally {
      setLoading(false)
    }
  }

  // --- IMPORTAÇÃO DE TIMES ---
  function abrirSelecaoTimes() {
    if (!etapaId) return alert('Selecione a etapa antes.')
    setSelectedTeams(new Set())
    setShowModalTimes(true)
  }

  async function confirmarImportacao() {
    if (selectedTeams.size === 0) return alert('Selecione pelo menos 1 time.')
    setLoading(true)
    try {
      const res = await fetch('/api/admin/etapas/gerenciar-times', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-admin-pin': pin },
        body: JSON.stringify({
          action: 'import_selected',
          etapa_id: etapaId,
          selected_ids: Array.from(selectedTeams)
        })
      })
      const data = await safeJson(res)
      if (!res.ok || data?.error) {
        alert(`Erro: ${data?.error || 'Falha ao importar'}`)
        return
      }

      setShowModalTimes(false)
      await selecionarEtapa(etapaId)
    } finally {
      setLoading(false)
    }
  }

  // --- GERAÇÃO DE JOGOS (AUTO / SORTEIO) ---
  async function gerarJogosAuto() {
    if (!etapaId) return alert('Selecione uma etapa!')

    if (confirm('Deseja ver a animação do sorteio dos jogos? OK = Sorteio Animado / Cancelar = gerar direto')) {
      router.push(`/admin/sorteio?etapa_id=${etapaId}`)
      return
    }

    setLoading(true)
    try {
      const res = await fetch('/api/admin/sorteio', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-admin-pin': pin },
        body: JSON.stringify({
          etapa_id: Number(etapaId),
          data_base: sorteioDataBase || null,
          modo: 'BINGO',
          limpar_existentes: sorteioLimpar
        })
      })
      const data = await safeJson(res)
      if (data?.error) alert(`ERRO: ${data.error}`)
      else {
        alert(`Sucesso! ${data.jogos_criados} jogos criados.`)
        await selecionarEtapa(etapaId)
      }
    } finally {
      setLoading(false)
    }
  }

  // --- BACKUP: AGENDA AUTOMÁTICA ---
  async function aplicarHorarios() {
    if (!etapaId) return alert('Selecione uma etapa!')
    if (!horData) return alert('Preencha a DATA DA RODADA.')
    setLoading(true)
    try {
      const res = await fetch('/api/admin/horarios', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-admin-pin': pin },
        body: JSON.stringify({
          etapa_id: Number(etapaId),
          data_jogo: horData,
          hora_inicio_base: horInicio,
          duracao_min: Number(horDuracao),
          intervalo_min: Number(horIntervalo)
        })
      })
      const data = await safeJson(res)
      alert(data.msg || data.error)
      await selecionarEtapa(etapaId)
    } finally {
      setLoading(false)
    }
  }

  // --- LIMPEZA E CRIAÇÃO MANUAL (BACKUP) ---
  async function limparEtapa() {
    if (!etapaId) return alert('Selecione uma etapa!')
    if (!confirm('ATENÇÃO: ISSO APAGA TUDO DA ETAPA (JOGOS E VÍNCULOS DE TIMES). Confirmar?')) return
    setLoading(true)
    try {
      await fetch('/api/admin/etapas/gerenciar-times', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-admin-pin': pin },
        body: JSON.stringify({ action: 'clear', etapa_id: etapaId })
      })
      await selecionarEtapa(etapaId)
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

  async function criarJogoManual() {
    if (!etapaId) return alert('Selecione uma etapa primeiro!')
    if (!novoJogo.equipe_a_id) return alert('Selecione o Time A!')
    if (!novoJogo.equipe_b_id) return alert('Selecione o Time B!')
    if (novoJogo.equipe_a_id === novoJogo.equipe_b_id) return alert('Os times devem ser diferentes!')

    setLoading(true)
    try {
      const payload = {
        ...novoJogo,
        etapa_id: Number(etapaId),
        equipe_a_id: parseInt(novoJogo.equipe_a_id),
        equipe_b_id: parseInt(novoJogo.equipe_b_id),
        rodada: novoJogo.rodada ? parseInt(novoJogo.rodada) : 1
      }
      const res = await fetch('/api/admin/jogos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-admin-pin': pin },
        body: JSON.stringify(payload)
      })
      const data = await safeJson(res)
      if (!res.ok || data?.error) alert(`Erro: ${data.error || 'Erro desconhecido'}`)
      else {
        setNovoJogo({ ...novoJogo, equipe_a_id: '', equipe_b_id: '', rodada: '' })
        await selecionarEtapa(etapaId)
      }
    } catch (e) {
      alert('Erro de conexão.')
    } finally {
      setLoading(false)
    }
  }

  // --- Grupos (visão rápida) ---
  const grupos = useMemo(() => {
    const lista = Array.isArray(timesDaEtapa) ? timesDaEtapa : []
    const a = lista.filter(t => t.grupo === 'A')
    const b = lista.filter(t => t.grupo === 'B')
    return { A: a, B: b }
  }, [timesDaEtapa])

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
          <h1 className="text-2xl font-black text-white uppercase mb-2">Tela Ao Vivo</h1>
          <p className="text-xs text-slate-400 font-bold mb-6 uppercase tracking-widest">
            Mostra somente jogos em andamento
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
      {/* MODAL DE SELEÇÃO DE TIMES */}
      {showModalTimes && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white w-full max-w-2xl rounded-3xl p-8 max-h-[80vh] flex flex-col shadow-2xl">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-2xl font-black text-slate-900 uppercase">Selecionar Times</h3>
              <button onClick={() => setShowModalTimes(false)} className="bg-slate-100 p-2 rounded-full">
                <X size={20} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto grid grid-cols-1 md:grid-cols-2 gap-3 p-2">
              {todosTimes.map(team => {
                const isSelected = selectedTeams.has(team.id)
                return (
                  <div
                    key={team.id}
                    onClick={() => {
                      const next = new Set(selectedTeams)
                      if (isSelected) next.delete(team.id)
                      else next.add(team.id)
                      setSelectedTeams(next)
                    }}
                    className={`p-4 rounded-xl border-2 cursor-pointer flex justify-between items-center ${
                      isSelected ? 'border-blue-600 bg-blue-50' : 'border-slate-100'
                    }`}
                  >
                    <div>
                      <p className="font-bold text-slate-800">{team.nome_equipe}</p>
                      <p className="text-[10px] uppercase font-bold text-slate-400">{team.modalidade} • {team.cidade}</p>
                    </div>
                    {isSelected && <CheckCircle className="text-blue-600" size={20} />}
                  </div>
                )
              })}
            </div>

            <div className="pt-6 border-t mt-4 flex justify-between items-center">
              <span className="font-bold text-slate-500">{selectedTeams.size} selecionados</span>
              <button
                onClick={confirmarImportacao}
                disabled={loading}
                className="bg-slate-900 text-white font-black py-3 px-8 rounded-xl hover:bg-black uppercase shadow-lg"
              >
                Confirmar Importação
              </button>
            </div>
          </div>
        </div>
      )}

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

        {/* 1) ETAPAS — criar, excluir, e ✅ alterar status da etapa já criada */}
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

              {/* atalhos rápidos */}
              <button
                onClick={() => { setEtapaStatusDraft('EM_ANDAMENTO'); }}
                disabled={!etapaId || loading}
                className="bg-green-50 border border-green-200 text-green-700 font-black px-4 py-3 rounded-xl text-[10px] uppercase"
                title="Preparar para Em andamento"
              >
                Iniciar
              </button>
              <button
                onClick={() => { setEtapaStatusDraft('FINALIZADA'); }}
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
            <div className="bg-slate-900 text-white rounded-3xl shadow-2xl shadow-slate-400 p-8 relative overflow-hidden">
              <div className="absolute top-0 right-0 p-8 opacity-5"><Trophy size={200} /></div>

              <div className="grid lg:grid-cols-3 gap-8 relative z-10">
                <div className="bg-white/5 p-6 rounded-3xl border border-white/10">
                  <p className="text-blue-400 text-[10px] font-black uppercase tracking-widest mb-4">Times</p>
                  <div className="flex justify-between items-end mb-6">
                    <span className="text-4xl font-black">{timesDaEtapa.length}</span>
                    <span className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">Na etapa</span>
                  </div>
                  <button
                    onClick={abrirSelecaoTimes}
                    className="w-full bg-blue-600 hover:bg-blue-500 py-3 rounded-xl font-bold text-xs uppercase flex items-center justify-center gap-2"
                  >
                    <Users size={16} /> Selecionar Times
                  </button>
                </div>

                <div className="lg:col-span-2 bg-white/5 p-6 rounded-3xl border border-white/10 grid grid-cols-2 gap-6 relative">
                  <div>
                    <p className="text-yellow-400 text-[10px] font-black uppercase tracking-widest mb-3 border-b border-white/10 pb-2">Grupo A</p>
                    <ul className="text-xs font-medium text-slate-300 space-y-1">
                      {grupos.A.map(t => <li key={t.id}>• {t.nome_equipe}</li>)}
                      {grupos.A.length === 0 && <li className="text-slate-500">—</li>}
                    </ul>
                  </div>
                  <div>
                    <p className="text-yellow-400 text-[10px] font-black uppercase tracking-widest mb-3 border-b border-white/10 pb-2">Grupo B</p>
                    <ul className="text-xs font-medium text-slate-300 space-y-1">
                      {grupos.B.map(t => <li key={t.id}>• {t.nome_equipe}</li>)}
                      {grupos.B.length === 0 && <li className="text-slate-500">—</li>}
                    </ul>
                  </div>

                  <Link
                    href={`/admin/sorteio?etapa_id=${etapaId}`}
                    className="absolute top-4 right-4 bg-slate-800 hover:bg-slate-700 py-2 px-4 rounded-lg font-bold text-[10px] uppercase flex items-center justify-center gap-2 border border-white/10 text-white"
                  >
                    <Shuffle size={12} /> Sorteio Animado
                  </Link>
                </div>
              </div>

              <div className="mt-8 flex justify-end gap-3 relative z-10">
                <button
                  onClick={gerarJogosAuto}
                  disabled={loading}
                  className="bg-white text-slate-900 hover:bg-slate-200 px-6 py-3 rounded-xl font-black text-xs uppercase flex items-center gap-2"
                  title="Gerar jogos da etapa"
                >
                  <ClipboardList size={16} /> Gerar Jogos
                </button>

                <button
                  onClick={limparEtapa}
                  disabled={loading}
                  className="bg-red-500/10 hover:bg-red-500/20 text-red-300 font-bold px-4 py-3 rounded-xl text-xs uppercase flex items-center gap-2 border border-red-500/30"
                  title="Apagar jogos e vínculos de times"
                >
                  <Trash2 size={14} /> Reset Etapa
                </button>

                <button
                  onClick={() => setShowBackup(v => !v)}
                  className="bg-slate-800 hover:bg-slate-700 text-white font-black px-4 py-3 rounded-xl text-xs uppercase flex items-center gap-2 border border-white/10"
                  title="Abrir/Fechar ferramentas de backup"
                >
                  {showBackup ? 'Ocultar backup' : 'Backup'}
                </button>
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
                    <GameCardAoVivo key={j.id} jogo={j} onUpdate={atualizarJogo} busy={loading} pin={pin} />
                  ))}
                </div>
              )}
            </div>

            {/* BACKUP (opcional) */}
            {showBackup && (
              <div className="space-y-6 animate-in fade-in duration-200">
                <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-8">
                  <h3 className="font-black uppercase text-slate-900 text-lg mb-4">Backup • Agenda automática</h3>
                  <div className="grid md:grid-cols-4 gap-4">
                    <div>
                      <label className="text-[10px] font-black uppercase text-slate-400">Data</label>
                      <input type="date" className="w-full mt-1 p-3 rounded-xl border bg-white font-bold"
                        value={horData} onChange={e => setHorData(e.target.value)} />
                    </div>
                    <div>
                      <label className="text-[10px] font-black uppercase text-slate-400">Início</label>
                      <input type="time" className="w-full mt-1 p-3 rounded-xl border bg-white font-bold text-center"
                        value={horInicio} onChange={e => setHorInicio(e.target.value)} />
                    </div>
                    <div>
                      <label className="text-[10px] font-black uppercase text-slate-400">Duração (min)</label>
                      <input type="number" className="w-full mt-1 p-3 rounded-xl border bg-white font-bold text-center"
                        value={horDuracao} onChange={e => setHorDuracao(e.target.value)} />
                    </div>
                    <div>
                      <label className="text-[10px] font-black uppercase text-slate-400">Intervalo (min)</label>
                      <input type="number" className="w-full mt-1 p-3 rounded-xl border bg-white font-bold text-center"
                        value={horIntervalo} onChange={e => setHorIntervalo(e.target.value)} />
                    </div>
                  </div>

                  <div className="mt-5 flex justify-end">
                    <button
                      onClick={aplicarHorarios}
                      disabled={loading}
                      className="bg-blue-600 hover:bg-blue-500 text-white font-black px-6 py-3 rounded-xl text-xs uppercase inline-flex items-center gap-2"
                    >
                      <Clock size={14} /> Aplicar Agenda
                    </button>
                  </div>
                </div>

                <div className="bg-slate-100 rounded-3xl p-6 border border-slate-200">
                  <div className="flex items-center justify-between mb-3">
                    <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Backup • Adição manual</p>
                    <label className="text-[10px] font-black uppercase text-slate-500 flex items-center gap-2">
                      <input type="checkbox" checked={sorteioLimpar} onChange={e => setSorteioLimpar(e.target.checked)} className="accent-blue-600" />
                      Limpar ao gerar
                    </label>
                  </div>

                  <div className="flex gap-3 items-center flex-wrap">
                    <select
                      className="p-3 rounded-xl border border-slate-200 text-xs font-bold uppercase bg-white outline-none"
                      value={novoJogo.tipo_jogo}
                      onChange={e => setNovoJogo({ ...novoJogo, tipo_jogo: e.target.value })}
                    >
                      <option value="GRUPO">Fase de Grupos</option>
                      <option value="FINAL">Grande Final</option>
                      <option value="DISPUTA_3">Disputa 3º Lugar</option>
                    </select>

                    <input
                      className="p-3 rounded-xl border border-slate-200 text-xs w-24 bg-white font-bold outline-none"
                      placeholder="Rodada"
                      value={novoJogo.rodada}
                      onChange={e => setNovoJogo({ ...novoJogo, rodada: e.target.value })}
                    />

                    <select
                      className="flex-1 p-3 rounded-xl border border-slate-200 text-xs bg-white font-bold outline-none"
                      value={novoJogo.equipe_a_id}
                      onChange={e => setNovoJogo({ ...novoJogo, equipe_a_id: e.target.value })}
                    >
                      <option value="">Time A</option>
                      {todosTimes.map(t => <option key={t.id} value={t.id}>{t.nome_equipe}</option>)}
                    </select>

                    <span className="font-black text-slate-300">VS</span>

                    <select
                      className="flex-1 p-3 rounded-xl border border-slate-200 text-xs bg-white font-bold outline-none"
                      value={novoJogo.equipe_b_id}
                      onChange={e => setNovoJogo({ ...novoJogo, equipe_b_id: e.target.value })}
                    >
                      <option value="">Time B</option>
                      {todosTimes.map(t => <option key={t.id} value={t.id}>{t.nome_equipe}</option>)}
                    </select>

                    <button
                      onClick={criarJogoManual}
                      disabled={loading}
                      className="bg-slate-900 text-white px-6 py-3 rounded-xl font-black text-xs hover:bg-black uppercase flex items-center gap-2"
                    >
                      {loading ? <Loader2 className="animate-spin" size={14} /> : <PlusCircle size={14} />} Adicionar
                    </button>
                  </div>
                </div>
              </div>
            )}
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
function GameCardAoVivo({ jogo, onUpdate, busy, pin }) {
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
