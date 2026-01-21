'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import {
  ArrowLeft, Save, Loader2,
  Trophy, Clock, Calendar, Lock, Shield, ClipboardList, Target, Trash2, CheckCircle2
} from 'lucide-react'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
)

const onlyDigits = (s) => String(s || '').replace(/\D/g, '')

function defaultStageCfg(regras) {
  const tempos = Array.isArray(regras?.sumula?.tempos) && regras.sumula.tempos.length
    ? regras.sumula.tempos
    : ['1T', '2T']

  const eventos = Array.isArray(regras?.sumula?.eventos) && regras.sumula.eventos.length
    ? regras.sumula.eventos.map(x => x.code || x).filter(Boolean)
    : ['GOL', 'AMARELO', 'VERMELHO']

  return { tempos, eventos }
}

async function safeJson(res) {
  const text = await res.text()
  try { return JSON.parse(text) } catch { return { error: text?.slice(0, 140) || 'Resposta inválida' } }
}

async function sha256(text) {
  const enc = new TextEncoder().encode(text)
  const buf = await crypto.subtle.digest('SHA-256', enc)
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('')
}

export default function Arbitragem() {
  const [session, setSession] = useState(null)

  // login/cadastro por CPF
  const [cpf, setCpf] = useState('')
  const [pass, setPass] = useState('')
  const [authLoading, setAuthLoading] = useState(false)

  // cadastro
  const [isRegister, setIsRegister] = useState(false)
  const [nomeCadastro, setNomeCadastro] = useState('')
  const [roleCadastro, setRoleCadastro] = useState('ARBITRO')
  const [pass2, setPass2] = useState('')

  // staff + etapas
  const [loading, setLoading] = useState(false)
  const [etapas, setEtapas] = useState([])
  const [etapaId, setEtapaId] = useState('')
  const [jogos, setJogos] = useState([])
  const [stageCfg, setStageCfg] = useState(defaultStageCfg(null))

  useEffect(() => {
    ; (async () => {
      const { data } = await supabase.auth.getSession()
      setSession(data.session || null)
    })()

    const { data: sub } = supabase.auth.onAuthStateChange((_evt, s) => setSession(s))
    return () => sub?.subscription?.unsubscribe?.()
  }, [])

  const token = session?.access_token || ''

  async function loginCPF() {
    setAuthLoading(true)
    try {
      const cpfDigits = onlyDigits(cpf)
      if (cpfDigits.length !== 11) throw new Error('CPF inválido (11 dígitos)')

      const r = await fetch('/api/staff/resolve-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cpf: cpfDigits })
      })
      const j = await safeJson(r)
      if (!r.ok) throw new Error(j.error || 'Falha')

      const { error } = await supabase.auth.signInWithPassword({
        email: j.email,
        password: pass
      })
      if (error) throw error
    } catch (e) {
      alert(e.message || 'Falha no login')
    } finally {
      setAuthLoading(false)
    }
  }

  async function cadastrarCPF() {
    setAuthLoading(true)
    try {
      const cpfDigits = onlyDigits(cpf)
      if (cpfDigits.length !== 11) throw new Error('CPF inválido (11 dígitos)')
      if (!nomeCadastro.trim() || nomeCadastro.trim().length < 3) throw new Error('Informe seu nome')
      if (!pass || pass.length < 6) throw new Error('Senha mínima 6 caracteres')
      if (pass !== pass2) throw new Error('As senhas não conferem')

      const r = await fetch('/api/staff/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          cpf: cpfDigits,
          nome: nomeCadastro.trim(),
          password: pass,
          role: roleCadastro
        })
      })
      const j = await safeJson(r)
      if (!r.ok) throw new Error(j.error || 'Falha no cadastro')

      const { error } = await supabase.auth.signInWithPassword({
        email: j.email,
        password: pass
      })
      if (error) throw error
    } catch (e) {
      alert(e.message || 'Falha no cadastro')
    } finally {
      setAuthLoading(false)
    }
  }

  async function logout() {
    await supabase.auth.signOut()
    setEtapas([])
    setEtapaId('')
    setJogos([])
  }

  async function carregarEtapas() {
    setLoading(true)
    try {
      const r = await fetch('/api/arbitragem/etapas', {
        headers: { Authorization: `Bearer ${token}` }
      })
      const j = await safeJson(r)
      if (!r.ok) throw new Error(j.error || 'Erro etapas')

      setEtapas(j.etapas || [])
      if (!etapaId && (j.etapas || []).length) setEtapaId(String(j.etapas[0].id))
    } catch (e) {
      alert(e.message || 'Erro ao carregar etapas')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (token) carregarEtapas()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token])

  useEffect(() => {
    if (token && etapaId) selecionarEtapa(etapaId)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, etapaId])

  async function selecionarEtapa(id) {
    setLoading(true)
    try {
      const r = await fetch(`/api/arbitragem/etapa?etapa_id=${id}`, {
        headers: { Authorization: `Bearer ${token}` }
      })
      const j = await safeJson(r)
      if (!r.ok) throw new Error(j.error || 'Erro etapa')

      setJogos(j.jogos || [])
      setStageCfg(defaultStageCfg(j.etapa?.regras || null))
    } catch (e) {
      alert(e.message || 'Erro ao selecionar etapa')
    } finally {
      setLoading(false)
    }
  }

  if (!session) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="bg-slate-900 p-8 rounded-2xl text-center w-full max-w-sm">
          <Lock className="mx-auto text-yellow-500 mb-4" />
          <h1 className="text-white font-black mb-2 uppercase">Árbitro / Mesário</h1>

          <p className="text-slate-400 text-xs font-bold mb-4">
            {isRegister
              ? 'Crie seu cadastro. Depois o admin te vincula nas etapas.'
              : 'Entre com CPF e senha.'}
          </p>

          {isRegister && (
            <>
              <input
                value={nomeCadastro}
                onChange={e => setNomeCadastro(e.target.value)}
                className="bg-black text-white p-3 rounded mb-3 w-full text-center font-bold"
                placeholder="Seu nome"
                autoComplete="off"
              />

              <select
                value={roleCadastro}
                onChange={e => setRoleCadastro(e.target.value)}
                className="bg-black text-white p-3 rounded mb-3 w-full text-center font-bold"
              >
                <option value="ARBITRO">ÁRBITRO</option>
                <option value="ASSISTENTE">ASSISTENTE</option>
                <option value="MESARIO">MESÁRIO</option>
              </select>
            </>
          )}

          <input
            value={cpf}
            onChange={e => setCpf(e.target.value)}
            className="bg-black text-white p-3 rounded mb-3 w-full text-center font-bold"
            placeholder="CPF (11 dígitos)"
            inputMode="numeric"
            autoComplete="off"
            autoCorrect="off"
            autoCapitalize="off"
            spellCheck={false}
          />

          <input
            type="password"
            value={pass}
            onChange={e => setPass(e.target.value)}
            className="bg-black text-white p-3 rounded mb-3 w-full text-center font-bold"
            placeholder="Senha"
            autoComplete={isRegister ? 'new-password' : 'current-password'}
          />

          {isRegister && (
            <input
              type="password"
              value={pass2}
              onChange={e => setPass2(e.target.value)}
              className="bg-black text-white p-3 rounded mb-4 w-full text-center font-bold"
              placeholder="Confirmar senha"
              autoComplete="new-password"
            />
          )}

          <button
            onClick={isRegister ? cadastrarCPF : loginCPF}
            disabled={authLoading}
            className="bg-yellow-500 hover:bg-yellow-400 w-full p-3 rounded font-black text-slate-900 uppercase"
          >
            {authLoading
              ? (isRegister ? 'Cadastrando...' : 'Entrando...')
              : (isRegister ? 'Cadastrar' : 'Entrar')}
          </button>

          <button
            type="button"
            onClick={() => setIsRegister(v => !v)}
            className="w-full mt-3 text-xs font-black uppercase text-slate-300 hover:text-white"
          >
            {isRegister ? 'Já tenho cadastro → entrar' : 'Não tenho cadastro → criar conta'}
          </button>
        </div>
      </div>
    )
  }

  return (
    <main className="min-h-screen bg-slate-50 py-8 px-4 md:px-8 text-slate-800">
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center gap-4 mb-6">
          <Link href="/" className="bg-white p-3 rounded-full shadow hover:scale-105"><ArrowLeft /></Link>
          <div className="flex-1">
            <h1 className="text-2xl font-black uppercase text-slate-800 flex items-center gap-2">
              <Trophy className="text-yellow-500 fill-yellow-500" /> Painel Arbitragem
            </h1>
            <p className="text-slate-500 text-xs font-bold">
              Tempos: {stageCfg.tempos.join(' / ')} • Eventos: {stageCfg.eventos.join(', ')}
            </p>
          </div>

          <button
            onClick={logout}
            className="bg-slate-900 text-white px-4 py-2 rounded-xl text-xs font-black uppercase"
          >
            Sair
          </button>
        </div>

        <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100 mb-6 flex gap-2 overflow-x-auto">
          {etapas.map(e => (
            <button
              key={e.id}
              onClick={() => setEtapaId(String(e.id))}
              className={`px-4 py-2 rounded-lg font-bold text-xs uppercase whitespace-nowrap border transition-all ${String(etapaId) === String(e.id)
                ? 'bg-slate-900 text-white border-slate-900 shadow-lg'
                : 'bg-white border-slate-200 text-slate-400 hover:border-slate-400'
                }`}
            >
              {e.titulo}
            </button>
          ))}
        </div>

        {loading && (
          <div className="mb-4 text-slate-500 text-xs font-bold flex items-center gap-2">
            <Loader2 className="animate-spin" size={14} /> Carregando...
          </div>
        )}

        <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-4">
          {jogos.map(j => (
            <GameCardArbitro
              key={j.id}
              jogo={j}
              token={token}
              stageCfg={stageCfg}
              onRefresh={() => selecionarEtapa(etapaId)}
            />
          ))}
        </div>
      </div>
    </main>
  )
}

// =============================
// GameCard do árbitro (FIFA style) — COMPLETO
// =============================
function GameCardArbitro({ jogo, token, stageCfg, onRefresh }) {
  const isFolga = String(jogo.tipo_jogo || '').toUpperCase() === 'FOLGA' || (jogo.equipe_a_id && !jogo.equipe_b_id)

  const [ga, setGa] = useState(jogo.gols_a ?? '')
  const [gb, setGb] = useState(jogo.gols_b ?? '')
  const [pa, setPa] = useState(jogo.penaltis_a ?? '')
  const [pb, setPb] = useState(jogo.penaltis_b ?? '')
  const [showPenalties, setShowPenalties] = useState(jogo.penaltis_a !== null || jogo.penaltis_b !== null)

  const [openSumula, setOpenSumula] = useState(false)
  const [eventos, setEventos] = useState([])
  const [atletasA, setAtletasA] = useState([])
  const [atletasB, setAtletasB] = useState([])

  const [assinOpen, setAssinOpen] = useState(false)
  const [assinaturas, setAssinaturas] = useState([])
  const [signPass, setSignPass] = useState('')
  const [signing, setSigning] = useState(false)
  const [assinRequired, setAssinRequired] = useState({ ARBITRO: 1, MESARIO: 1 })
  const [locked, setLocked] = useState(false)

  const [novoEvento, setNovoEvento] = useState({
    tipo: stageCfg.eventos?.[0] || 'GOL',
    tempo: stageCfg.tempos?.[0] || '1T',
    equipe: 'A',
    atleta_id: '',
    minuto: '',
    camisa_no_jogo: '',
    observacao: ''
  })

  useEffect(() => {
    setGa(jogo.gols_a ?? '')
    setGb(jogo.gols_b ?? '')
    setPa(jogo.penaltis_a ?? '')
    setPb(jogo.penaltis_b ?? '')
    setShowPenalties(jogo.penaltis_a !== null || jogo.penaltis_b !== null)
  }, [jogo.gols_a, jogo.gols_b, jogo.penaltis_a, jogo.penaltis_b])

  const nomeA = jogo.equipeA?.nome_equipe || (jogo.origem_a ? `( ${jogo.origem_a} )` : 'Aguardando...')
  const nomeB = isFolga ? 'FOLGA' : (jogo.equipeB?.nome_equipe || (jogo.origem_b ? `( ${jogo.origem_b} )` : 'Aguardando...'))

  async function loadSumula() {
    if (isFolga) return
    if (!jogo.equipe_a_id || !jogo.equipe_b_id) return

    const headers = { Authorization: `Bearer ${token}` }

    const [evRes, aRes, bRes] = await Promise.all([
      fetch(`/api/arbitragem/jogos/eventos?jogo_id=${jogo.id}`, { headers }),
      fetch(`/api/arbitragem/atletas?equipe_id=${jogo.equipe_a_id}`, { headers }),
      fetch(`/api/arbitragem/atletas?equipe_id=${jogo.equipe_b_id}`, { headers })
    ])

    const evJson = await safeJson(evRes)
    const aJson = await safeJson(aRes)
    const bJson = await safeJson(bRes)

    if (!evRes.ok) throw new Error(evJson?.error || 'Erro eventos')
    if (!aRes.ok) throw new Error(aJson?.error || 'Erro atletas A')
    if (!bRes.ok) throw new Error(bJson?.error || 'Erro atletas B')

    setEventos(Array.isArray(evJson) ? evJson : [])
    setAtletasA(Array.isArray(aJson) ? aJson : [])
    setAtletasB(Array.isArray(bJson) ? bJson : [])
  }

  async function loadAssinaturas() {
    const res = await fetch(`/api/arbitragem/assinaturas?jogo_id=${jogo.id}`, {
      headers: { Authorization: `Bearer ${token}` }
    })
    const j = await safeJson(res)
    if (!res.ok) throw new Error(j?.error || 'Erro assinaturas')

    setAssinaturas(j.assinaturas || [])
    setAssinRequired(j.required || { ARBITRO: 1, MESARIO: 1 })
    setLocked(Boolean(j.locked))
  }

  const slotsDoRole = useMemo(() => {
    return (role) => {
      const need = Number(assinRequired?.[role] || 0)
      const list = (assinaturas || []).filter(a => String(a.role).toUpperCase() === String(role).toUpperCase())
      const bySlot = new Map(list.map(a => [Number(a.role_slot || 0), a]))
      return Array.from({ length: need }, (_, i) => bySlot.get(i + 1) || null)
    }
  }, [assinaturas, assinRequired])

  async function toggleSumula() {
    if (isFolga) return
    try {
      if (!openSumula) await loadSumula()
      setOpenSumula(!openSumula)
    } catch (e) {
      alert(e.message || 'Erro ao abrir súmula')
    }
  }

  async function toggleAssin() {
    try {
      if (!assinOpen) await loadAssinaturas()
      setAssinOpen(!assinOpen)
    } catch (e) {
      alert(e.message || 'Erro assinaturas')
    }
  }

  const handleSelectAtleta = (e, listaAtletas) => {
    const selectedId = e.target.value
    const atleta = listaAtletas.find(a => String(a.id) === String(selectedId))
    const camisaAuto = atleta?.numero_camisa ? String(atleta.numero_camisa) : ''
    setNovoEvento(prev => ({ ...prev, atleta_id: selectedId, camisa_no_jogo: camisaAuto }))
  }

  function autoAtletaPorCamisa(camisa, lista) {
    const c = String(camisa || '').trim()
    if (!c) return null
    const a = (lista || []).find(x => String(x.numero_camisa || '') === c)
    return a ? String(a.id) : null
  }

  async function updateJogo(action, extra = {}) {
    const res = await fetch('/api/arbitragem/jogos/update', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({
        jogo_id: jogo.id,
        action,
        ...extra
      })
    })
    const j = await safeJson(res)
    if (!res.ok) {
      if (j?.error === 'SUMULA_ASSINADA_BLOQUEADA') return alert('🔒 Súmula assinada. Edição bloqueada.')
      return alert(j?.error || 'Erro jogo')
    }
    onRefresh?.()
  }

  async function addEvento() {
    if (isFolga) return
    const equipe_id = novoEvento.equipe === 'A' ? jogo.equipe_a_id : jogo.equipe_b_id
    const atleta_id = novoEvento.atleta_id ? Number(novoEvento.atleta_id) : null

    const res = await fetch('/api/arbitragem/jogos/eventos', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({
        jogo_id: jogo.id,
        equipe_id,
        atleta_id,
        tipo: novoEvento.tipo,
        tempo: novoEvento.tempo,
        minuto: novoEvento.minuto,
        camisa_no_jogo: novoEvento.camisa_no_jogo,
        observacao: novoEvento.observacao
      })
    })
    const j = await safeJson(res)
    if (!res.ok) {
      if (j?.error === 'SUMULA_ASSINADA_BLOQUEADA') return alert('🔒 Súmula assinada. Edição bloqueada.')
      return alert(j?.error || 'Erro ao salvar evento')
    }

    if (String(novoEvento.tipo).toUpperCase() === 'GOL') {
      if (novoEvento.equipe === 'A') setGa(Number(ga || 0) + 1)
      else setGb(Number(gb || 0) + 1)
      onRefresh?.()
    }

    await loadSumula()
    setNovoEvento(prev => ({ ...prev, atleta_id: '', minuto: '', camisa_no_jogo: '', observacao: '' }))
  }

  async function delEvento(id) {
    if (!confirm('Excluir evento?')) return
    const res = await fetch(`/api/arbitragem/jogos/eventos?id=${id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` }
    })
    const j = await safeJson(res)
    if (!res.ok) {
      if (j?.error === 'SUMULA_ASSINADA_BLOQUEADA') return alert('🔒 Súmula assinada. Edição bloqueada.')
      return alert(j?.error || 'Erro ao excluir')
    }
    await loadSumula()
    onRefresh?.()
  }

  async function assinarSumula() {
    if (String(jogo.status || '').toUpperCase() !== 'FINALIZADO') {
      return alert('Finalize o jogo antes de assinar.')
    }
    if (!signPass) return alert('Digite sua senha para assinar.')

    setSigning(true)
    try {
      const { data: u } = await supabase.auth.getUser()
      const emailInterno = u?.user?.email
      if (!emailInterno) throw new Error('Sessão inválida')

      const { error: reErr } = await supabase.auth.signInWithPassword({ email: emailInterno, password: signPass })
      if (reErr) throw reErr

      const signed_at = new Date().toISOString()
      const base = `${u.user.id}|${jogo.etapa_id}|${jogo.id}|${signed_at}|${ga}|${gb}`
      const signature_hash = await sha256(base)

      const res = await fetch('/api/arbitragem/assinaturas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ jogo_id: jogo.id, signed_at, signature_hash })
      })
      const j = await safeJson(res)
      if (!res.ok) throw new Error(j?.error || 'Erro assinatura')

      setSignPass('')
      await loadAssinaturas()
      alert('✅ Assinado!')
    } catch (e) {
      alert(e.message || 'Erro ao assinar')
    } finally {
      setSigning(false)
    }
  }

  return (
    <div className={`bg-white border rounded-2xl p-4 shadow-sm relative transition-all ${isFolga
      ? 'border-amber-300 ring-1 ring-amber-100'
      : (jogo.status === 'EM_ANDAMENTO' ? 'border-green-400 ring-1 ring-green-100' : 'border-slate-200')
      }`}>

      <div className="flex justify-between items-center mb-3">
        <div className="flex gap-2 items-center">
          <span className={`text-[10px] font-black uppercase px-2 py-1 rounded ${isFolga ? 'text-amber-700 bg-amber-100' : 'text-slate-500 bg-slate-100'}`}>
            {isFolga ? (jogo.obs_publica || 'FOLGA') : (jogo.obs_publica || jogo.tipo_jogo)}
          </span>

          <span className={jogo.status === 'EM_ANDAMENTO'
            ? 'text-green-600 animate-pulse text-[10px] font-bold'
            : 'text-slate-400 text-[10px] font-bold'}>
            {String(jogo.status || '').replace('_', ' ')}
          </span>

          {locked && (
            <span className="text-[10px] font-black uppercase px-2 py-1 rounded bg-red-100 text-red-700">
              SÚMULA TRAVADA
            </span>
          )}
        </div>
      </div>

      <div className="space-y-2 mb-4">
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-2 truncate">
            <div className="w-5 h-5 flex items-center justify-center bg-slate-50 rounded-full border border-slate-100 overflow-hidden">
              {jogo.equipeA?.escudo_url ? (
                <img src={jogo.equipeA.escudo_url} className="w-full h-full object-contain" />
              ) : (
                <Shield size={10} className="text-slate-300" />
              )}
            </div>
            <span className="font-bold text-sm text-slate-800 truncate">{nomeA}</span>
          </div>

          {!isFolga && (
            <div className="flex gap-1">
              <input className="w-10 p-1 text-center bg-slate-50 rounded border font-bold" value={ga} onChange={e => setGa(e.target.value)} disabled={locked} />
              {showPenalties && (
                <input className="w-8 p-1 text-center bg-yellow-50 rounded border border-yellow-300 font-bold text-xs" placeholder="PK" value={pa} onChange={e => setPa(e.target.value)} disabled={locked} />
              )}
            </div>
          )}
        </div>

        <div className="flex justify-between items-center">
          <div className="flex items-center gap-2 truncate">
            <div className="w-5 h-5 flex items-center justify-center bg-slate-50 rounded-full border border-slate-100 overflow-hidden">
              {!isFolga && jogo.equipeB?.escudo_url ? (
                <img src={jogo.equipeB.escudo_url} className="w-full h-full object-contain" />
              ) : (
                <Shield size={10} className="text-slate-300" />
              )}
            </div>
            <span className={`font-bold text-sm truncate ${isFolga ? 'text-amber-700' : 'text-slate-800'}`}>
              {nomeB}
            </span>
          </div>

          {!isFolga && (
            <div className="flex gap-1">
              <input className="w-10 p-1 text-center bg-slate-50 rounded border font-bold" value={gb} onChange={e => setGb(e.target.value)} disabled={locked} />
              {showPenalties && (
                <input className="w-8 p-1 text-center bg-yellow-50 rounded border border-yellow-300 font-bold text-xs" placeholder="PK" value={pb} onChange={e => setPb(e.target.value)} disabled={locked} />
              )}
            </div>
          )}
        </div>
      </div>

      <div className="pt-3 border-t border-slate-100 flex justify-between items-center">
        <div className="text-[10px] text-slate-400 flex flex-col">
          <span className="font-bold flex items-center gap-1">
            <Calendar size={10} />
            {jogo.data_jogo ? String(jogo.data_jogo).split('-').reverse().slice(0, 2).join('/') : '--/--'}
          </span>
          <span className="flex items-center gap-1">
            <Clock size={10} />
            {jogo.horario ? String(jogo.horario).slice(0, 5) : '--:--'} {jogo.arbitro && `• ${jogo.arbitro}`}
          </span>
        </div>

        <div className="flex gap-2">
          {!isFolga && (
            <button
              onClick={() => setShowPenalties(!showPenalties)}
              className={`p-1.5 rounded transition-colors ${showPenalties ? 'bg-yellow-100 text-yellow-700' : 'bg-slate-100 text-slate-600 hover:text-yellow-600'}`}
              title="Pênaltis"
            >
              <Target size={14} />
            </button>
          )}

          {!isFolga && (
            <button
              onClick={toggleSumula}
              className={`p-1.5 rounded transition-colors ${openSumula ? 'bg-blue-100 text-blue-600' : 'bg-slate-100 text-slate-600 hover:text-blue-600'}`}
              title="Súmula"
            >
              <ClipboardList size={14} />
            </button>
          )}
        </div>
      </div>

      {!isFolga && (
        <div className="mt-3 flex gap-2">
          {jogo.status === 'EM_BREVE' && (
            <button
              onClick={() => updateJogo('set_status', { status: 'EM_ANDAMENTO' })}
              className="flex-1 bg-green-600 text-white py-2 rounded-xl text-[10px] font-black uppercase hover:bg-green-500"
              disabled={locked}
            >
              INICIAR
            </button>
          )}

          {jogo.status === 'EM_ANDAMENTO' && (
            <>
              <button
                onClick={() => updateJogo('set_score', { gols_a: ga, gols_b: gb, penaltis_a: showPenalties ? pa : null, penaltis_b: showPenalties ? pb : null })}
                className="flex-1 bg-slate-100 text-slate-700 py-2 rounded-xl text-[10px] font-black uppercase hover:bg-slate-200 flex items-center justify-center gap-2"
                disabled={locked}
              >
                <Save size={14} /> SALVAR
              </button>

              <button
                onClick={() => updateJogo('set_status', {
                  status: 'FINALIZADO',
                  gols_a: ga,
                  gols_b: gb,
                  penaltis_a: showPenalties ? (pa === '' ? null : pa) : null,
                  penaltis_b: showPenalties ? (pb === '' ? null : pb) : null
                })}
                className="flex-1 bg-slate-900 text-white py-2 rounded-xl text-[10px] font-black uppercase hover:bg-black"
                disabled={locked}
              >
                ENCERRAR
              </button>
            </>
          )}

          {jogo.status === 'FINALIZADO' && (
            <button
              onClick={() => updateJogo('set_status', { status: 'EM_ANDAMENTO' })}
              className="flex-1 bg-blue-50 border border-blue-100 text-blue-700 py-2 rounded-xl text-[10px] font-black uppercase hover:bg-blue-100"
              disabled={locked}
            >
              REABRIR
            </button>
          )}
        </div>
      )}

      {!isFolga && (
        <div className="mt-3 bg-slate-50 border border-slate-100 rounded-2xl p-3">
          <button
            onClick={toggleAssin}
            className="w-full bg-white border border-slate-200 rounded-xl py-2 text-[10px] font-black uppercase hover:border-slate-400"
          >
            {assinOpen ? 'FECHAR ASSINATURAS' : 'ASSINAR SÚMULA'}
          </button>

          {assinOpen && (
            <div className="mt-3 space-y-3">
              <div className="space-y-3">
                {Object.keys(assinRequired || {}).map(role => (
                  <div key={role} className="space-y-1">
                    <div className="text-[10px] font-black uppercase text-slate-500">{role}</div>
                    <div className="grid grid-cols-1 gap-1">
                      {slotsDoRole(role).map((a, idx) => (
                        <div key={idx} className="bg-white border rounded-xl px-3 py-2 flex justify-between items-center">
                          <span className="text-[10px] font-black">{role} {idx + 1}</span>
                          <span className="text-[10px] font-bold text-slate-700">
                            {a ? a.nome : '— pendente —'}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>

              <div className="bg-white border border-slate-200 rounded-xl p-3">
                <div className="text-[10px] text-slate-500 font-bold mb-2">
                  Para assinar, digite sua senha (assinatura digital via login).
                </div>

                {locked ? (
                  <div className="text-[11px] font-bold text-red-700 bg-red-50 border border-red-200 rounded-xl p-2 flex items-center gap-2">
                    <CheckCircle2 size={14} /> Súmula já travada (assinaturas completas).
                  </div>
                ) : (
                  <>
                    <input
                      type="password"
                      value={signPass}
                      onChange={e => setSignPass(e.target.value)}
                      className="w-full border rounded-xl p-2 text-sm font-bold bg-slate-50"
                      placeholder="Senha"
                      autoComplete="current-password"
                    />
                    <button
                      onClick={assinarSumula}
                      disabled={signing}
                      className="w-full mt-2 bg-slate-900 text-white py-2 rounded-xl text-[10px] font-black uppercase hover:bg-black"
                    >
                      {signing ? 'ASSINANDO...' : 'ASSINAR AGORA'}
                    </button>
                  </>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {!isFolga && openSumula && (
        <div className="mt-4 pt-4 border-t border-dashed border-slate-200">
          <div className="bg-slate-50 p-3 rounded-xl border border-slate-100 mb-3">
            {locked && (
              <div className="mb-2 text-[10px] font-black uppercase text-red-700 bg-red-50 border border-red-200 rounded-xl p-2">
                🔒 Súmula travada — sem alterações.
              </div>
            )}

            <div className="grid grid-cols-2 gap-2 mb-2">
              <select
                className="p-1.5 rounded border text-[10px] font-bold"
                value={novoEvento.tipo}
                onChange={e => setNovoEvento(prev => ({ ...prev, tipo: e.target.value }))}
                disabled={locked}
              >
                {stageCfg.eventos.map(t => <option key={t} value={t}>{t}</option>)}
              </select>

              <select
                className="p-1.5 rounded border text-[10px] font-bold"
                value={novoEvento.equipe}
                onChange={e => setNovoEvento(prev => ({ ...prev, equipe: e.target.value, atleta_id: '' }))}
                disabled={locked}
              >
                <option value="A">{nomeA.substring(0, 12)}</option>
                <option value="B">{nomeB.substring(0, 12)}</option>
              </select>
            </div>

            <div className="grid grid-cols-2 gap-2 mb-2">
              <select
                className="p-1.5 rounded border text-[10px] font-bold"
                value={novoEvento.tempo}
                onChange={e => setNovoEvento(prev => ({ ...prev, tempo: e.target.value }))}
                disabled={locked}
              >
                {stageCfg.tempos.map(t => <option key={t} value={t}>{t}</option>)}
              </select>

              <input
                className="p-1.5 rounded border text-[10px] text-center font-bold"
                placeholder="Min"
                value={novoEvento.minuto}
                onChange={e => setNovoEvento(prev => ({ ...prev, minuto: e.target.value }))}
                disabled={locked}
              />
            </div>

            <select
              className="w-full p-1.5 rounded border text-[10px] font-bold mb-2"
              value={novoEvento.atleta_id}
              onChange={(e) => handleSelectAtleta(e, novoEvento.equipe === 'A' ? atletasA : atletasB)}
              disabled={locked}
            >
              <option value="">Selecione Atleta...</option>
              {(novoEvento.equipe === 'A' ? atletasA : atletasB).map(a => (
                <option key={a.id} value={a.id}>
                  {a.numero_camisa ? `#${a.numero_camisa} - ` : ''}{a.nome}
                </option>
              ))}
            </select>

            <div className="flex gap-2 mb-2">
              <input
                className="w-16 p-1.5 rounded border text-[10px] text-center font-bold"
                placeholder="Camisa"
                value={novoEvento.camisa_no_jogo}
                onChange={e => {
                  const val = e.target.value
                  const list = novoEvento.equipe === 'A' ? atletasA : atletasB
                  const found = autoAtletaPorCamisa(val, list)
                  setNovoEvento(prev => ({
                    ...prev,
                    camisa_no_jogo: val,
                    atleta_id: found ?? prev.atleta_id
                  }))
                }}
                disabled={locked}
              />
              <input
                className="flex-1 p-1.5 rounded border text-[10px]"
                placeholder="Obs (Ex: Falta)"
                value={novoEvento.observacao}
                onChange={e => setNovoEvento(prev => ({ ...prev, observacao: e.target.value }))}
                disabled={locked}
              />
            </div>

            <button
              onClick={addEvento}
              className="w-full bg-slate-900 text-white py-1.5 rounded text-[10px] font-bold uppercase hover:bg-black"
              disabled={locked}
            >
              Adicionar Evento
            </button>
          </div>

          <div className="space-y-1 max-h-[160px] overflow-y-auto custom-scrollbar">
            {eventos.map(ev => (
              <div key={ev.id} className="flex justify-between items-center bg-white p-2 rounded border border-slate-100 text-[9px] font-bold text-slate-600">
                <span className="flex items-center gap-2">
                  <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-700 font-black">
                    {ev.tempo || '--'} {ev.minuto ? `${ev.minuto}'` : ''}
                  </span>
                  <span className={`px-2 py-0.5 rounded ${
                    ev.tipo === 'GOL' ? 'bg-green-100 text-green-700' :
                      ev.tipo === 'VERMELHO' ? 'bg-red-100 text-red-700' :
                        'bg-yellow-100 text-yellow-700'
                  }`}>
                    {ev.tipo}
                  </span>
                  {ev.camisa_no_jogo && <span className="text-slate-900">#{ev.camisa_no_jogo}</span>}
                  {ev.observacao && <span className="text-slate-400">• {ev.observacao}</span>}
                </span>

                <button
                  onClick={() => delEvento(ev.id)}
                  className="text-red-300 hover:text-red-500"
                  disabled={locked}
                  title={locked ? 'Súmula travada' : 'Excluir'}
                >
                  <Trash2 size={12} />
                </button>
              </div>
            ))}
            {eventos.length === 0 && <p className="text-center text-[9px] text-slate-300">Nenhum evento.</p>}
          </div>
        </div>
      )}
    </div>
  )
}
