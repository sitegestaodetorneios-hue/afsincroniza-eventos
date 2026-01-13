'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import {
  ArrowLeft,
  PlusCircle,
  Save,
  CheckCircle,
  XCircle,
  Loader2,
  ClipboardList,
  Trash2,
} from 'lucide-react'

async function safeJson(res) {
  try {
    return await res.json()
  } catch {
    const text = await res.text().catch(() => '')
    return { error: text || `Erro ${res.status}` }
  }
}

export default function AdminJogos() {
  const [pin, setPin] = useState('')
  const [authed, setAuthed] = useState(false)
  const [loading, setLoading] = useState(false)

  // ✅ Horários automáticos
  const [horData, setHorData] = useState('') // "2026-03-07" (opcional) — filtra só jogos desta data
  const [horInicio, setHorInicio] = useState('08:00') // HH:MM
  const [horDuracao, setHorDuracao] = useState(20) // min
  const [horIntervalo, setHorIntervalo] = useState(10) // min

  const [etapas, setEtapas] = useState([])
  const [etapaId, setEtapaId] = useState('')
  const [equipes, setEquipes] = useState([])
  const [jogos, setJogos] = useState([])

  // ✅ Sorteio (Bingo)
  const [sorteioDataBase, setSorteioDataBase] = useState('') // AAAA-MM-DD (sábado base)
  const [sorteioDias, setSorteioDias] = useState('SAB_DOM') // SAB_DOM | SAB | DOM
  const [sorteioLimpar, setSorteioLimpar] = useState(true) // apagar jogos existentes antes de gerar

  const [novaEtapa, setNovaEtapa] = useState({
    modalidade: 'FUTSAL',
    titulo: 'Liga - 6 times (todos contra todos)',
    tipo: 'LIGA',
    status: 'EM_ANDAMENTO',
  })

  const [novoJogo, setNovoJogo] = useState({
    rodada: '',
    data_jogo: '',
    equipe_a_id: '',
    equipe_b_id: '',
  })

  function auth() {
    if (pin === '2026') setAuthed(true)
    else alert('PIN incorreto')
  }

  async function loadAll() {
    setLoading(true)
    try {
      const [etRes, teamsRes] = await Promise.all([
        fetch('/api/admin/etapas', { headers: { 'x-admin-pin': pin } }),
        fetch('/api/admin/teams', { headers: { 'x-admin-pin': pin } }),
      ])
      const et = await safeJson(etRes)
      const teams = await safeJson(teamsRes)

      if (!etRes.ok) alert(et?.error || 'Erro ao carregar etapas')
      if (!teamsRes.ok) alert(teams?.error || 'Erro ao carregar equipes')

      setEtapas(Array.isArray(et) ? et : [])
      setEquipes(Array.isArray(teams) ? teams : [])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (authed) loadAll()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authed])

  async function criarEtapa() {
    setLoading(true)
    try {
      const res = await fetch('/api/admin/etapas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-admin-pin': pin },
        body: JSON.stringify(novaEtapa),
      })
      const data = await safeJson(res)
      if (!res.ok) return alert(data?.error || 'Erro ao criar etapa')
      await loadAll()
      alert('Etapa criada!')
    } finally {
      setLoading(false)
    }
  }

  async function loadJogos(etapa_id) {
    setLoading(true)
    try {
      const res = await fetch(`/api/admin/jogos?etapa_id=${etapa_id}`, {
        headers: { 'x-admin-pin': pin },
      })
      const data = await safeJson(res)
      if (!res.ok) return alert(data?.error || 'Erro ao carregar jogos')
      setJogos(Array.isArray(data) ? data : [])
    } finally {
      setLoading(false)
    }
  }

  async function selecionarEtapa(id) {
    setEtapaId(String(id))
    await loadJogos(id)
  }

  // ✅ GERAR SORTEIO (Bingo FIFA) – 6 times → 15 jogos
  async function gerarSorteio() {
    if (!etapaId) return alert('Selecione uma etapa primeiro.')

    const dias = sorteioDias === 'SAB_DOM' ? ['SAB', 'DOM'] : [sorteioDias]

    setLoading(true)
    try {
      const res = await fetch('/api/admin/sorteio', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-admin-pin': pin },
        body: JSON.stringify({
          etapa_id: Number(etapaId),
          data_base: sorteioDataBase || null,
          dias,
          modo: 'BINGO',
          limpar_existentes: sorteioLimpar,
        }),
      })

      const data = await safeJson(res)
      if (!res.ok) return alert(data?.error || 'Erro ao gerar sorteio.')

      alert(`Sorteio concluído! Jogos criados: ${data?.jogos_criados ?? 'OK'}`)
      await loadJogos(etapaId)
    } finally {
      setLoading(false)
    }
  }

  // ✅ GERAR HORÁRIOS para os jogos da etapa (ou só de uma data)
  async function gerarHorarios() {
    if (!etapaId) return alert('Selecione uma etapa')

    setLoading(true)
    try {
      const res = await fetch('/api/admin/horarios', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-admin-pin': pin },
        body: JSON.stringify({
          etapa_id: Number(etapaId),
          data_jogo: horData || null,
          hora_inicio_base: horInicio,
          duracao_min: Number(horDuracao),
          intervalo_min: Number(horIntervalo),
        }),
      })

      const data = await safeJson(res)
      if (!res.ok) return alert(data?.error || 'Erro ao gerar horários')

      alert(`Horários gerados! Jogos atualizados: ${data?.jogos_atualizados ?? 'OK'}`)
      await loadJogos(etapaId)
    } finally {
      setLoading(false)
    }
  }

  async function criarJogo() {
    if (!etapaId) return alert('Selecione uma etapa')
    if (!novoJogo.equipe_a_id || !novoJogo.equipe_b_id) return alert('Selecione os dois times')
    if (novoJogo.equipe_a_id === novoJogo.equipe_b_id) return alert('Times devem ser diferentes')

    setLoading(true)
    try {
      const res = await fetch('/api/admin/jogos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-admin-pin': pin },
        body: JSON.stringify({
          etapa_id: Number(etapaId),
          rodada: novoJogo.rodada ? Number(novoJogo.rodada) : null,
          data_jogo: novoJogo.data_jogo || null,
          equipe_a_id: Number(novoJogo.equipe_a_id),
          equipe_b_id: Number(novoJogo.equipe_b_id),
        }),
      })
      const data = await safeJson(res)
      if (!res.ok) return alert(data?.error || 'Erro ao criar jogo')

      setNovoJogo({ rodada: '', data_jogo: '', equipe_a_id: '', equipe_b_id: '' })
      await loadJogos(etapaId)
    } finally {
      setLoading(false)
    }
  }

  async function salvarPlacar(id, gols_a, gols_b) {
    setLoading(true)
    try {
      const res = await fetch('/api/admin/jogos', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'x-admin-pin': pin },
        body: JSON.stringify({ action: 'set_score', id, gols_a, gols_b }),
      })
      const data = await safeJson(res)
      if (!res.ok) return alert(data?.error || 'Erro ao salvar placar')
      await loadJogos(etapaId)
    } finally {
      setLoading(false)
    }
  }

  async function finalizarJogo(id, finalizado) {
    setLoading(true)
    try {
      const res = await fetch('/api/admin/jogos', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'x-admin-pin': pin },
        body: JSON.stringify({ action: 'finalize', id, finalizado }),
      })
      const data = await safeJson(res)
      if (!res.ok) return alert(data?.error || 'Erro ao finalizar')
      await loadJogos(etapaId)
    } finally {
      setLoading(false)
    }
  }

  const equipesOptions = useMemo(() => {
    return equipes.map((e) => ({ id: e.id, nome: e.nome_equipe }))
  }, [equipes])

  if (!authed) {
    return (
      <main className="min-h-screen bg-slate-950 flex items-center justify-center p-6">
        <div className="bg-slate-900 p-10 rounded-2xl border border-slate-800 text-center max-w-sm w-full">
          <h1 className="text-2xl font-black text-white uppercase mb-6">Admin • Jogos</h1>
          <input
            type="password"
            placeholder="PIN"
            className="w-full p-4 bg-slate-950 border border-slate-800 rounded-xl text-center text-white font-bold text-xl mb-4"
            value={pin}
            onChange={(e) => setPin(e.target.value)}
          />
          <button onClick={auth} className="w-full bg-blue-600 text-white font-bold py-4 rounded-xl uppercase">
            Entrar
          </button>
          <Link href="/admin" className="block mt-4 text-xs font-bold text-slate-400 hover:text-slate-200 uppercase">
            Voltar ao Admin
          </Link>
        </div>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-slate-50 py-10 px-4 md:px-10">
      <div className="max-w-6xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <Link href="/admin" className="flex items-center gap-2 text-slate-500 hover:text-blue-600 font-bold text-sm uppercase transition-colors">
            <ArrowLeft size={18} /> Voltar
          </Link>

          <div className="text-right">
            <p className="text-xs font-black uppercase text-slate-400">Gerenciar jogos, sorteio, horários e súmula</p>
            <h1 className="text-2xl font-black uppercase italic tracking-tighter text-slate-900">
              Jogos & Súmula
            </h1>
          </div>
        </div>

        {/* Etapas */}
        <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-6 mb-8">
          <div className="flex items-center justify-between">
            <h2 className="font-black uppercase text-slate-900">Etapas</h2>
            {loading && (
              <span className="text-slate-400 font-bold text-xs inline-flex items-center gap-2">
                <Loader2 className="animate-spin" size={14} /> carregando
              </span>
            )}
          </div>

          <div className="grid md:grid-cols-5 gap-3 mt-4">
            <select className="p-3 rounded-xl border bg-slate-50 font-bold" value={novaEtapa.modalidade} onChange={(e) => setNovaEtapa({ ...novaEtapa, modalidade: e.target.value })}>
              <option value="FUTSAL">FUTSAL</option>
              <option value="SUICO">SUÍÇO</option>
            </select>

            <input className="p-3 rounded-xl border bg-slate-50 font-bold md:col-span-2" value={novaEtapa.titulo} onChange={(e) => setNovaEtapa({ ...novaEtapa, titulo: e.target.value })} />

            <select className="p-3 rounded-xl border bg-slate-50 font-bold" value={novaEtapa.status} onChange={(e) => setNovaEtapa({ ...novaEtapa, status: e.target.value })}>
              <option value="RASCUNHO">RASCUNHO</option>
              <option value="EM_BREVE">EM BREVE</option>
              <option value="EM_ANDAMENTO">EM ANDAMENTO</option>
              <option value="ENCERRADA">ENCERRADA</option>
            </select>

            <button onClick={criarEtapa} className="bg-slate-900 text-white font-black rounded-xl px-4 py-3 uppercase text-xs flex items-center justify-center gap-2 hover:bg-blue-600">
              <PlusCircle size={16} /> Criar etapa
            </button>
          </div>

          <div className="mt-5 grid md:grid-cols-2 gap-3">
            {etapas.map((e) => (
              <button
                key={e.id}
                onClick={() => selecionarEtapa(e.id)}
                className={`text-left p-4 rounded-2xl border font-bold transition ${
                  String(etapaId) === String(e.id)
                    ? 'border-blue-600 bg-blue-50'
                    : 'border-slate-200 bg-white hover:bg-slate-50'
                }`}
              >
                <div className="text-[10px] uppercase tracking-widest text-slate-400">{e.modalidade} • {e.status}</div>
                <div className="text-slate-900 font-black">{e.titulo}</div>
                <div className="text-xs text-slate-500 font-bold">Etapa ID: {e.id}</div>
              </button>
            ))}
          </div>
        </div>

        {/* Sorteio */}
        <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-6 mb-8">
          <h2 className="font-black uppercase text-slate-900">Sorteio automático (Bingo FIFA)</h2>
          <p className="text-slate-500 text-sm font-bold mt-1">
            Gera automaticamente 15 jogos (6 times jogam entre si). Requer 6 equipes vinculadas na etapa.
          </p>

          <div className="grid md:grid-cols-4 gap-3 mt-4">
            <input className="p-3 rounded-xl border bg-slate-50 font-bold" placeholder="Data base (sábado) AAAA-MM-DD" value={sorteioDataBase} onChange={(e) => setSorteioDataBase(e.target.value)} />

            <select className="p-3 rounded-xl border bg-slate-50 font-bold" value={sorteioDias} onChange={(e) => setSorteioDias(e.target.value)}>
              <option value="SAB_DOM">Sábado + Domingo</option>
              <option value="SAB">Somente Sábado</option>
              <option value="DOM">Somente Domingo</option>
            </select>

            <label className="flex items-center gap-2 p-3 rounded-xl border bg-slate-50 font-bold text-slate-700">
              <input type="checkbox" checked={sorteioLimpar} onChange={(e) => setSorteioLimpar(e.target.checked)} />
              Limpar jogos existentes
            </label>

            <button onClick={gerarSorteio} disabled={loading} className="bg-blue-600 text-white font-black rounded-xl px-4 py-3 uppercase text-xs hover:bg-blue-700 disabled:opacity-60">
              GERAR JOGOS (SORTEIO)
            </button>
          </div>

          <p className="text-[10px] font-bold uppercase text-slate-400 mt-3">
            Se deixar a data base vazia, você pode definir datas depois.
          </p>
        </div>

        {/* ✅ Horários automáticos */}
        <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-6 mb-8">
          <h2 className="font-black uppercase text-slate-900">Horários automáticos</h2>
          <p className="text-slate-500 text-sm font-bold mt-1">
            Informe o início do 1º jogo + duração + intervalo. O sistema calcula e salva os horários de todos os jogos.
          </p>

          <div className="grid md:grid-cols-5 gap-3 mt-4">
            <input
              className="p-3 rounded-xl border bg-slate-50 font-bold"
              placeholder="Data (opcional) AAAA-MM-DD"
              value={horData}
              onChange={(e) => setHorData(e.target.value)}
            />
            <input
              className="p-3 rounded-xl border bg-slate-50 font-bold"
              placeholder="Início (HH:MM)"
              value={horInicio}
              onChange={(e) => setHorInicio(e.target.value)}
            />
            <input
              type="number"
              className="p-3 rounded-xl border bg-slate-50 font-bold"
              placeholder="Duração (min)"
              value={horDuracao}
              onChange={(e) => setHorDuracao(e.target.value)}
            />
            <input
              type="number"
              className="p-3 rounded-xl border bg-slate-50 font-bold"
              placeholder="Intervalo (min)"
              value={horIntervalo}
              onChange={(e) => setHorIntervalo(e.target.value)}
            />
            <button
              onClick={gerarHorarios}
              disabled={loading}
              className="bg-slate-900 text-white font-black rounded-xl px-4 py-3 uppercase text-xs hover:bg-blue-600 disabled:opacity-60"
            >
              GERAR HORÁRIOS
            </button>
          </div>

          <p className="text-[10px] font-bold uppercase text-slate-400 mt-3">
            Se preencher a data, ele atualiza somente os jogos daquele dia.
          </p>
        </div>

        {/* Criar jogo manual */}
        <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-6 mb-8">
          <h2 className="font-black uppercase text-slate-900">Criar jogo (manual)</h2>
          <div className="grid md:grid-cols-6 gap-3 mt-4">
            <input className="p-3 rounded-xl border bg-slate-50 font-bold" placeholder="Rodada" value={novoJogo.rodada} onChange={(e) => setNovoJogo({ ...novoJogo, rodada: e.target.value })} />
            <input className="p-3 rounded-xl border bg-slate-50 font-bold" placeholder="Data (YYYY-MM-DD)" value={novoJogo.data_jogo} onChange={(e) => setNovoJogo({ ...novoJogo, data_jogo: e.target.value })} />

            <select className="p-3 rounded-xl border bg-slate-50 font-bold md:col-span-2" value={novoJogo.equipe_a_id} onChange={(e) => setNovoJogo({ ...novoJogo, equipe_a_id: e.target.value })}>
              <option value="">Time A</option>
              {equipesOptions.map((t) => (
                <option key={t.id} value={t.id}>{t.nome}</option>
              ))}
            </select>

            <select className="p-3 rounded-xl border bg-slate-50 font-bold md:col-span-2" value={novoJogo.equipe_b_id} onChange={(e) => setNovoJogo({ ...novoJogo, equipe_b_id: e.target.value })}>
              <option value="">Time B</option>
              {equipesOptions.map((t) => (
                <option key={t.id} value={t.id}>{t.nome}</option>
              ))}
            </select>

            <button onClick={criarJogo} className="bg-blue-600 text-white font-black rounded-xl px-4 py-3 uppercase text-xs flex items-center justify-center gap-2 hover:bg-blue-700 md:col-span-6">
              <PlusCircle size={16} /> Adicionar jogo à etapa selecionada
            </button>
          </div>
        </div>

        {/* Lista jogos */}
        <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="p-6 border-b border-slate-200 flex items-center justify-between">
            <h2 className="font-black uppercase text-slate-900">Jogos da etapa</h2>
            {!etapaId && <span className="text-slate-400 font-bold text-xs uppercase">Selecione uma etapa</span>}
          </div>

          {!etapaId ? (
            <div className="p-10 text-center text-slate-400 font-bold">Selecione uma etapa para ver os jogos.</div>
          ) : jogos.length === 0 ? (
            <div className="p-10 text-center text-slate-400 font-bold">Nenhum jogo cadastrado.</div>
          ) : (
            <div className="divide-y">
              {jogos.map((j) => (
                <JogoRow
                  key={j.id}
                  jogo={j}
                  onSave={salvarPlacar}
                  onFinalize={finalizarJogo}
                  busy={loading}
                  pin={pin}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </main>
  )
}

function JogoRow({ jogo, onSave, onFinalize, busy, pin }) {
  const [ga, setGa] = useState(jogo.gols_a ?? '')
  const [gb, setGb] = useState(jogo.gols_b ?? '')
  const [open, setOpen] = useState(false)

  const [eventos, setEventos] = useState([])
  const [loadingEv, setLoadingEv] = useState(false)

  const [atletasA, setAtletasA] = useState([])
  const [atletasB, setAtletasB] = useState([])

  const [novo, setNovo] = useState({
    tipo: 'GOL',
    equipe: 'A',
    atleta_id: '',
    minuto: '',
    tempo: '1T',
    camisa_no_jogo: '',
    observacao: '',
  })

  const nomeA = jogo?.equipeA?.nome_equipe || `Equipe ${jogo.equipe_a_id}`
  const nomeB = jogo?.equipeB?.nome_equipe || `Equipe ${jogo.equipe_b_id}`

  const atletaMap = useMemo(() => {
    const m = new Map()
    ;[...(atletasA || []), ...(atletasB || [])].forEach((a) => m.set(a.id, a))
    return m
  }, [atletasA, atletasB])

  async function loadSumula() {
    setLoadingEv(true)
    try {
      const [evRes, ra, rb] = await Promise.all([
        fetch(`/api/admin/jogos/eventos?jogo_id=${jogo.id}`, { headers: { 'x-admin-pin': pin } }),
        fetch(`/api/admin/atletas?equipe_id=${jogo.equipe_a_id}`, { headers: { 'x-admin-pin': pin } }),
        fetch(`/api/admin/atletas?equipe_id=${jogo.equipe_b_id}`, { headers: { 'x-admin-pin': pin } }),
      ])

      const ev = await safeJson(evRes)
      const aA = await safeJson(ra)
      const aB = await safeJson(rb)

      if (!evRes.ok) alert(ev?.error || 'Erro ao carregar eventos')
      if (!ra.ok) alert(aA?.error || 'Erro ao carregar atletas A')
      if (!rb.ok) alert(aB?.error || 'Erro ao carregar atletas B')

      setEventos(Array.isArray(ev) ? ev : [])
      setAtletasA(Array.isArray(aA) ? aA : [])
      setAtletasB(Array.isArray(aB) ? aB : [])
    } finally {
      setLoadingEv(false)
    }
  }

  async function toggleOpen() {
    const next = !open
    setOpen(next)
    if (next) await loadSumula()
  }

  async function addEvento() {
    const equipe_id = novo.equipe === 'A' ? jogo.equipe_a_id : jogo.equipe_b_id
    const atleta_id = novo.atleta_id ? Number(novo.atleta_id) : null

    setLoadingEv(true)
    try {
      const res = await fetch('/api/admin/jogos/eventos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-admin-pin': pin },
        body: JSON.stringify({
          jogo_id: jogo.id,
          equipe_id,
          atleta_id,
          tipo: novo.tipo,
          minuto: novo.minuto ? Number(novo.minuto) : null,
          tempo: novo.tempo,
          camisa_no_jogo: novo.camisa_no_jogo ? Number(novo.camisa_no_jogo) : null,
          observacao: novo.observacao || null,
        }),
      })
      const data = await safeJson(res)
      if (!res.ok) return alert(data?.error || 'Erro ao salvar evento')

      await loadSumula()
      setNovo({ ...novo, atleta_id: '', minuto: '', camisa_no_jogo: '', observacao: '' })
    } finally {
      setLoadingEv(false)
    }
  }

  async function delEvento(id) {
    if (!confirm('Excluir este evento?')) return
    setLoadingEv(true)
    try {
      const res = await fetch(`/api/admin/jogos/eventos?id=${id}`, {
        method: 'DELETE',
        headers: { 'x-admin-pin': pin },
      })
      const data = await safeJson(res)
      if (!res.ok) return alert(data?.error || 'Erro ao excluir')
      await loadSumula()
    } finally {
      setLoadingEv(false)
    }
  }

  const elenco = novo.equipe === 'A' ? atletasA : atletasB

  function renderEvento(ev) {
    const teamName = ev.equipe_id === jogo.equipe_a_id ? nomeA : nomeB
    const atleta = ev.atleta_id ? atletaMap.get(ev.atleta_id) : null
    const camisa = ev.camisa_no_jogo ?? atleta?.numero_camisa ?? '-'
    const atletaTxt = atleta ? `#${camisa} ${atleta.nome}` : `#${camisa} —`
    const when = `${ev.minuto ? `${ev.minuto}' ` : ''}${ev.tempo ? `(${ev.tempo})` : ''}`.trim()
    return `${ev.tipo} ${when ? `• ${when}` : ''} • ${teamName} • ${atletaTxt}`
  }

  const hora = jogo.hora_inicio ? String(jogo.hora_inicio).slice(0, 5) : ''

  return (
    <div className="p-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <p className="text-[10px] uppercase tracking-widest text-slate-400 font-black">
            Rodada {jogo.rodada ?? '-'} • {jogo.data_jogo ?? 'Data a definir'}{hora ? ` • ${hora}` : ''}
          </p>
          <p className="text-slate-900 font-black text-lg">
            {nomeA} <span className="text-slate-400">vs</span> {nomeB}
          </p>
          <p className="text-xs font-bold text-slate-500">Jogo ID: {jogo.id}</p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <input className="w-16 p-3 rounded-xl border bg-slate-50 font-black text-center" value={ga} onChange={(e) => setGa(e.target.value)} placeholder="0" />
          <span className="font-black text-slate-400">x</span>
          <input className="w-16 p-3 rounded-xl border bg-slate-50 font-black text-center" value={gb} onChange={(e) => setGb(e.target.value)} placeholder="0" />

          <button disabled={busy} onClick={() => onSave(jogo.id, Number(ga || 0), Number(gb || 0))} className="bg-slate-900 text-white font-black rounded-xl px-4 py-3 uppercase text-xs flex items-center gap-2 hover:bg-blue-600 disabled:opacity-60">
            <Save size={16} /> Salvar
          </button>

          {!jogo.finalizado ? (
            <button disabled={busy} onClick={() => onFinalize(jogo.id, true)} className="bg-green-600 text-white font-black rounded-xl px-4 py-3 uppercase text-xs flex items-center gap-2 hover:bg-green-700 disabled:opacity-60">
              <CheckCircle size={16} /> Finalizar
            </button>
          ) : (
            <button disabled={busy} onClick={() => onFinalize(jogo.id, false)} className="bg-red-600 text-white font-black rounded-xl px-4 py-3 uppercase text-xs flex items-center gap-2 hover:bg-red-700 disabled:opacity-60">
              <XCircle size={16} /> Reabrir
            </button>
          )}

          <button onClick={toggleOpen} className="bg-blue-50 text-blue-700 border border-blue-200 font-black rounded-xl px-4 py-3 uppercase text-xs flex items-center gap-2 hover:bg-blue-100">
            <ClipboardList size={16} /> Súmula
          </button>
        </div>
      </div>

      {open && (
        <div className="mt-6 bg-slate-50 border border-slate-200 rounded-2xl p-5">
          <div className="flex items-center justify-between mb-4">
            <p className="font-black uppercase text-slate-900">Eventos (Gols e Cartões)</p>
            {loadingEv && <span className="text-xs font-bold text-slate-400">carregando…</span>}
          </div>

          <div className="grid md:grid-cols-7 gap-3">
            <select className="p-3 rounded-xl border bg-white font-bold" value={novo.tipo} onChange={(e) => setNovo({ ...novo, tipo: e.target.value })}>
              <option value="GOL">GOL</option>
              <option value="AMARELO">AMARELO</option>
              <option value="VERMELHO">VERMELHO</option>
            </select>

            <select className="p-3 rounded-xl border bg-white font-bold" value={novo.equipe} onChange={(e) => setNovo({ ...novo, equipe: e.target.value, atleta_id: '' })}>
              <option value="A">{nomeA}</option>
              <option value="B">{nomeB}</option>
            </select>

            <select className="p-3 rounded-xl border bg-white font-bold md:col-span-2" value={novo.atleta_id} onChange={(e) => setNovo({ ...novo, atleta_id: e.target.value })}>
              <option value="">Atleta (camisa + nome)</option>
              {Array.isArray(elenco) && elenco.map((a) => (
                <option key={a.id} value={a.id}>#{a.numero_camisa ?? '-'} • {a.nome}</option>
              ))}
            </select>

            <input className="p-3 rounded-xl border bg-white font-bold" placeholder="Min" value={novo.minuto} onChange={(e) => setNovo({ ...novo, minuto: e.target.value })} />
            <input className="p-3 rounded-xl border bg-white font-bold" placeholder="Camisa" value={novo.camisa_no_jogo} onChange={(e) => setNovo({ ...novo, camisa_no_jogo: e.target.value })} />
            <select className="p-3 rounded-xl border bg-white font-bold" value={novo.tempo} onChange={(e) => setNovo({ ...novo, tempo: e.target.value })}>
              <option value="1T">1T</option>
              <option value="2T">2T</option>
              <option value="PR">PR</option>
              <option value="SEG">SEG</option>
            </select>

            <input className="p-3 rounded-xl border bg-white font-bold md:col-span-6" placeholder="Observação (opcional)" value={novo.observacao} onChange={(e) => setNovo({ ...novo, observacao: e.target.value })} />

            <button onClick={addEvento} className="bg-slate-900 text-white font-black rounded-xl px-4 py-3 uppercase text-xs hover:bg-blue-600">
              + Adicionar
            </button>
          </div>

          <div className="mt-5 space-y-2">
            {eventos.length === 0 ? (
              <p className="text-slate-400 font-bold text-sm">Nenhum evento lançado.</p>
            ) : (
              eventos.map((ev) => (
                <div key={ev.id} className="bg-white border border-slate-200 rounded-xl p-3 flex items-center justify-between">
                  <div className="text-sm font-bold text-slate-700">
                    {renderEvento(ev)}
                    {ev.observacao ? <span className="text-slate-400"> — {ev.observacao}</span> : null}
                  </div>
                  <button onClick={() => delEvento(ev.id)} className="p-2 bg-red-100 text-red-600 rounded-lg">
                    <Trash2 size={16} />
                  </button>
                </div>
              ))
            )}
          </div>

          <p className="mt-4 text-[10px] font-bold uppercase text-slate-400">
            Gols lançados aqui atualizam o placar automaticamente (trigger). Depois use “Horários automáticos” para montar a agenda do dia.
          </p>
        </div>
      )}
    </div>
  )
}
