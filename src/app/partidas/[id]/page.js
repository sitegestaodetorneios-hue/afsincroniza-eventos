'use client'
import { use, useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import {
  ArrowLeft, Loader2, ClipboardList, Shirt, RefreshCcw, Trophy, Volume2, Calendar, Clock, MapPin,
  Download, Lock, Mail, Shield, X
} from 'lucide-react'

async function safeJson(res) {
  try { return await res.json() } catch { return {} }
}

function asArray(v) { return Array.isArray(v) ? v : [] }

function badge(tipo) {
  const base = 'text-[10px] font-black uppercase px-3 py-1 rounded-full border shadow-sm'
  if (tipo === 'GOL') return `${base} bg-green-100 text-green-700 border-green-200`
  if (tipo === 'AMARELO') return `${base} bg-amber-100 text-amber-800 border-amber-200`
  if (tipo === 'VERMELHO') return `${base} bg-red-100 text-red-700 border-red-200`
  return `${base} bg-slate-100 text-slate-600 border-slate-200`
}

function logoUrl(team) {
  const u = team?.escudo_url || team?.logo_url || team?.escudo || team?.logo
  return (u && String(u).length > 5) ? u : ''
}

export default function PartidaDetalhe({ params }) {
  const resolvedParams = use(params)
  const jogoId = resolvedParams.id

  const [loading, setLoading] = useState(true)
  const [data, setData] = useState({ jogo: null, eventos: [], atletasA: [], atletasB: [] })
  const [patrocinios, setPatrocinios] = useState([])
  const mountedRef = useRef(true)

  // ✅ SUMULA (PDF) — modal + auth (Admin ou Professor)
  const [sumulaOpen, setSumulaOpen] = useState(false)
  const [sumulaMode, setSumulaMode] = useState('PROFESSOR') // 'PROFESSOR' | 'ADMIN'
  const [sumulaEmail, setSumulaEmail] = useState('')
  const [sumulaSenha, setSumulaSenha] = useState('')
  const [sumulaAdminSenha, setSumulaAdminSenha] = useState('')
  const [sumulaLoading, setSumulaLoading] = useState(false)
  const [sumulaError, setSumulaError] = useState('')

  useEffect(() => {
    mountedRef.current = true
    return () => (mountedRef.current = false)
  }, [])

  async function loadData(silent = false) {
    if (!silent) setLoading(true)

    try {
      const [res, resPatro] = await Promise.all([
        fetch(`/api/partida?id=${jogoId}`, { cache: 'no-store' }),
        fetch('/api/admin/patrocinios', { cache: 'no-store' })
      ])

      const d = await safeJson(res)
      const p = await safeJson(resPatro)

      if (!mountedRef.current) return

      if (d.error) {
        console.error("❌ Erro API:", d.error)
      } else {
        setData({
          jogo: d.jogo || null,
          eventos: asArray(d.eventos),
          atletasA: asArray(d.atletasA),
          atletasB: asArray(d.atletasB)
        })
      }
      setPatrocinios(asArray(p))

    } catch (e) {
      console.error("❌ Erro Conexão:", e)
    } finally {
      if (mountedRef.current && !silent) setLoading(false)
    }
  }

  useEffect(() => {
    if (jogoId) {
      loadData(false)
      const t = setInterval(() => { if (document.visibilityState === 'visible') loadData(true) }, 15000)
      return () => clearInterval(t)
    }
  }, [jogoId])

  const patrocinadorMaster = useMemo(() => patrocinios.find(p => p.cota === 'MASTER'), [patrocinios])
  const patrocinadoresRodape = useMemo(() => patrocinios.filter(p => p.cota === 'RODAPE'), [patrocinios])

  const jogo = data.jogo
  const eventos = data.eventos
  const nomeA = jogo?.equipeA?.nome_equipe || `Equipe A`
  const nomeB = jogo?.equipeB?.nome_equipe || `Equipe B`
  const logoA = logoUrl(jogo?.equipeA)
  const logoB = logoUrl(jogo?.equipeB)

  async function baixarSumulaPDF() {
    setSumulaError('')
    if (!jogoId) return

    if (sumulaMode === 'ADMIN') {
      if (!sumulaAdminSenha) {
        setSumulaError('Informe a senha de Admin.')
        return
      }
    } else {
      if (!sumulaEmail.trim() || !sumulaSenha) {
        setSumulaError('Informe e-mail e senha do Professor.')
        return
      }
    }

    setSumulaLoading(true)
    try {
      const res = await fetch('/api/sumula/baixar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        cache: 'no-store',
        body: JSON.stringify({
          jogo_id: String(jogoId),
          auth: sumulaMode === 'ADMIN'
            ? { tipo: 'ADMIN', senha_admin: sumulaAdminSenha }
            : { tipo: 'PROFESSOR', email: sumulaEmail.trim(), senha: sumulaSenha },
        })
      })

      if (!res.ok) {
        const d = await safeJson(res)
        setSumulaError(d?.error || 'Acesso negado.')
        return
      }

      const blob = await res.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `sumula_jogo_${jogoId}.pdf`
      document.body.appendChild(a)
      a.click()
      a.remove()
      window.URL.revokeObjectURL(url)

      // fecha modal e limpa senhas (LGPD/segurança)
      setSumulaOpen(false)
      setSumulaSenha('')
      setSumulaAdminSenha('')
    } catch (e) {
      setSumulaError('Falha de conexão.')
    } finally {
      setSumulaLoading(false)
    }
  }

  if (loading && !jogo) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center gap-4">
        <Loader2 className="animate-spin text-blue-600" size={40} />
        <p className="text-xs font-black text-slate-400 uppercase tracking-widest">Carregando Súmula...</p>
      </div>
    )
  }

  if (!jogo && !loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-10 text-center">
        <h1 className="text-2xl font-black text-slate-900 mb-2">Jogo não encontrado</h1>
        <p className="text-slate-500 mb-6">ID solicitado: {jogoId}</p>
        <Link href="/partidas" className="text-blue-600 font-bold hover:underline">Voltar para o calendário</Link>
      </div>
    )
  }

  return (
    <main className="min-h-screen bg-slate-50 py-10 px-4 md:px-10 font-sans text-slate-800">
      <div className="max-w-5xl mx-auto">

        {/* Header */}
        <div className="flex justify-between items-center mb-8">
          <Link href="/partidas" className="flex items-center gap-2 text-slate-500 hover:text-blue-600 font-bold text-sm uppercase transition-colors">
            <ArrowLeft size={18} /> Voltar
          </Link>

          <div className="flex items-center gap-2">
            {/* ✅ NOVO: Baixar Súmula */}
            <button
              onClick={() => { setSumulaOpen(true); setSumulaError('') }}
              className="inline-flex items-center gap-2 text-[10px] font-black uppercase tracking-widest px-4 py-2 rounded-xl border border-slate-200 bg-blue-600 text-white hover:bg-blue-700 transition-all shadow-sm"
            >
              <Download size={14} />
              Baixar Súmula (PDF)
            </button>

            <button
              onClick={() => loadData(false)}
              className="inline-flex items-center gap-2 text-[10px] font-black uppercase tracking-widest px-4 py-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 transition-all shadow-sm group"
            >
              <RefreshCcw size={14} className={`group-hover:rotate-180 transition-transform ${loading ? "animate-spin" : ""}`} />
              {loading ? "Atualizando..." : "Atualizar Placar"}
            </button>
          </div>
        </div>

        {/* BANNER MASTER */}
        {patrocinadorMaster && (
          <div className="mb-10 rounded-[2rem] overflow-hidden shadow-2xl border-4 border-white bg-slate-900 relative group aspect-[16/5] md:aspect-[21/6]">
            <a href={patrocinadorMaster.link_destino || '#'} target="_blank" rel="noreferrer">
              {patrocinadorMaster.video_url ? (
                <div className="w-full h-full relative">
                  <video src={patrocinadorMaster.video_url} autoPlay loop muted playsInline className="w-full h-full object-cover" />
                  <div className="absolute top-4 right-4 bg-black/40 backdrop-blur-md p-1.5 rounded-full text-white/80"><Volume2 size={14} /></div>
                </div>
              ) : (
                <img src={patrocinadorMaster.banner_url} className="w-full h-full object-cover transition-transform duration-1000 group-hover:scale-105" alt="Master Sponsor" />
              )}
            </a>
          </div>
        )}

        <div className="bg-white rounded-[2.5rem] shadow-2xl overflow-hidden border border-slate-200 transition-all">

          {/* PLACAR */}
          <div className="bg-slate-900 text-white p-6 md:p-12 relative overflow-hidden">
            <div className="relative z-10">
              <div className="flex items-center justify-center mb-8">
                <span className={`px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest border border-white/10 ${jogo?.status === 'EM_ANDAMENTO' ? 'bg-red-600 text-white animate-pulse shadow-red-900/50 shadow-lg' : 'bg-slate-800 text-slate-400'}`}>
                  {jogo?.status === 'EM_ANDAMENTO' ? '● AO VIVO AGORA' : (jogo?.finalizado ? 'FIM DE JOGO' : 'AGENDADO')}
                </span>
              </div>

              <div className="flex flex-col md:flex-row items-center justify-between gap-8 md:gap-0">
                <div className="flex-1 flex flex-col items-center md:items-start text-center md:text-left">
                  {logoA ? (
                    <img src={logoA} className="h-16 w-16 md:h-20 md:w-20 object-cover mb-4 bg-white rounded-full p-2 border border-white/10" alt="Logo A" />
                  ) : (
                    <div className="h-16 w-16 md:h-20 md:w-20 mb-4 bg-white/10 rounded-full border border-white/10" />
                  )}
                  <h2 className="text-2xl md:text-4xl font-black uppercase italic tracking-tighter leading-none">{nomeA}</h2>
                  <p className="text-slate-400 text-[10px] font-bold uppercase tracking-widest mt-2">Grupo A</p>
                </div>

                <div className="flex flex-col items-center px-8">
                  <div className="bg-white/10 backdrop-blur-sm px-8 py-4 rounded-3xl border border-white/10 flex items-center gap-6 md:gap-10">
                    <span className="text-6xl md:text-8xl font-black tracking-tighter">{jogo?.gols_a ?? 0}</span>
                    <span className="text-slate-400 text-4xl md:text-5xl font-light opacity-50">×</span>
                    <span className="text-6xl md:text-8xl font-black tracking-tighter">{jogo?.gols_b ?? 0}</span>
                  </div>
                  {jogo?.penaltis_a !== null && (
                    <div className="mt-4 bg-yellow-500/20 border border-yellow-500/50 px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest text-yellow-400">
                      Pênaltis: {jogo.penaltis_a} - {jogo.penaltis_b}
                    </div>
                  )}
                </div>

                <div className="flex-1 flex flex-col items-center md:items-end text-center md:text-right">
                  {logoB ? (
                    <img src={logoB} className="h-16 w-16 md:h-20 md:w-20 object-cover mb-4 bg-white rounded-full p-2 border border-white/10" alt="Logo B" />
                  ) : (
                    <div className="h-16 w-16 md:h-20 md:w-20 mb-4 bg-white/10 rounded-full border border-white/10" />
                  )}
                  <h2 className="text-2xl md:text-4xl font-black uppercase italic tracking-tighter leading-none">{nomeB}</h2>
                  <p className="text-slate-400 text-[10px] font-bold uppercase tracking-widest mt-2">Grupo B</p>
                </div>
              </div>
            </div>
            <div className="absolute top-0 left-0 w-full h-full bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-slate-800 to-slate-900 -z-10"></div>
            <div className="absolute right-0 bottom-0 opacity-5 transform translate-x-1/4 translate-y-1/4"><Trophy size={400} /></div>
          </div>

          {/* INFO TÉCNICA */}
          <div className="bg-slate-50 border-y border-slate-100 px-6 py-4 flex flex-wrap justify-center gap-6 md:gap-12 text-[10px] font-black uppercase tracking-widest text-slate-400">
            <div className="flex items-center gap-2"><Calendar size={14} className="text-blue-600" /> {jogo?.data_jogo ? new Date(jogo.data_jogo + 'T00:00:00').toLocaleDateString('pt-BR') : '--/--'}</div>
            <div className="flex items-center gap-2"><Clock size={14} className="text-blue-600" /> {jogo?.horario ? String(jogo.horario).slice(0, 5) : '--:--'}</div>
            <div className="flex items-center gap-2"><Trophy size={14} className="text-yellow-600" /> {jogo?.tipo_jogo?.replace(/_/g, ' ')} • Rodada {jogo?.rodada}</div>
            {jogo?.local && <div className="flex items-center gap-2"><MapPin size={14} className="text-red-500" /> {jogo.local}</div>}
          </div>

          {/* CONTEÚDO */}
          <div className="p-6 md:p-10 grid lg:grid-cols-2 gap-10">
            {/* LANCE A LANCE */}
            <div>
              <div className="flex items-center gap-3 mb-6 border-b border-slate-100 pb-4">
                <div className="p-2 bg-blue-100 rounded-lg text-blue-600"><ClipboardList size={20} /></div>
                <h3 className="font-black uppercase text-slate-900 tracking-tight">Timeline da Partida</h3>
              </div>

              {eventos.length === 0 ? (
                <div className="py-12 text-center border-2 border-dashed border-slate-100 rounded-2xl bg-slate-50/50">
                  <ClipboardList className="mx-auto text-slate-300 mb-3" size={32} />
                  <p className="text-slate-400 font-bold text-xs uppercase tracking-widest">Nenhum evento registrado</p>
                </div>
              ) : (
                <div className="space-y-3 relative">
                  <div className="absolute left-6 top-4 bottom-4 w-0.5 bg-slate-100 -z-10"></div>
                  {eventos.map((ev, idx) => (
                    <div key={ev.id || idx} className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm flex items-start gap-4 hover:shadow-md transition-shadow">
                      <div className="flex flex-col items-center min-w-[3rem]">
                        <span className="text-lg font-black text-slate-300">{ev.minuto || '-'}'</span>
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <span className={badge(ev.tipo)}>{ev.tipo}</span>
                          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">{ev.team_name}</span>
                        </div>
                        <p className="font-black text-slate-800 text-sm uppercase tracking-tighter">{ev.atleta_label}</p>
                        {ev.observacao && <p className="mt-2 text-[11px] italic text-slate-500 bg-slate-50 p-2 rounded-lg border border-slate-100">"{ev.observacao}"</p>}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* ESCALAÇÕES */}
            <div>
              <div className="flex items-center gap-3 mb-6 border-b border-slate-100 pb-4">
                <div className="p-2 bg-blue-100 rounded-lg text-blue-600"><Shirt size={20} /></div>
                <h3 className="font-black uppercase text-slate-900 tracking-tight">Elencos Relacionados</h3>
              </div>

              <div className="grid gap-6">
                {/* Time A */}
                <div className="bg-slate-50 rounded-2xl p-5 border border-slate-200">
                  <p className="text-[10px] font-black uppercase text-blue-600 mb-4 tracking-widest border-b border-slate-200 pb-2">{nomeA}</p>
                  <div className="space-y-1.5 max-h-[300px] overflow-y-auto pr-2 scrollbar-thin scrollbar-thumb-slate-200">
                    {data.atletasA.length === 0 ? <p className="text-slate-400 text-[10px] font-bold italic text-center py-4">Sem escalação disponível.</p> :
                      data.atletasA.map(a => (
                        <div key={a.id} className="flex items-center justify-between bg-white p-2.5 rounded-xl border border-slate-100 text-xs font-bold shadow-sm">
                          <span className="text-slate-700 uppercase truncate pr-2">{a.nome}</span>
                          <span className="text-blue-600 font-black bg-blue-50 px-2 py-0.5 rounded-md min-w-[24px] text-center">#{a.numero_camisa ?? '-'}</span>
                        </div>
                      ))
                    }
                  </div>
                </div>

                {/* Time B */}
                <div className="bg-slate-50 rounded-2xl p-5 border border-slate-200">
                  <p className="text-[10px] font-black uppercase text-blue-600 mb-4 tracking-widest border-b border-slate-200 pb-2">{nomeB}</p>
                  <div className="space-y-1.5 max-h-[300px] overflow-y-auto pr-2 scrollbar-thin scrollbar-thumb-slate-200">
                    {data.atletasB.length === 0 ? <p className="text-slate-400 text-[10px] font-bold italic text-center py-4">Sem escalação disponível.</p> :
                      data.atletasB.map(a => (
                        <div key={a.id} className="flex items-center justify-between bg-white p-2.5 rounded-xl border border-slate-100 text-xs font-bold shadow-sm">
                          <span className="text-slate-700 uppercase truncate pr-2">{a.nome}</span>
                          <span className="text-blue-600 font-black bg-blue-50 px-2 py-0.5 rounded-md min-w-[24px] text-center">#{a.numero_camisa ?? '-'}</span>
                        </div>
                      ))
                    }
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* FOOTER (banner rodapé vivo) */}
          <footer className="mt-20 pt-10 border-t border-slate-200">
            {patrocinadoresRodape.length > 0 && (
              <>
                <div className="text-center mb-8">
                  <p className="text-[10px] font-black uppercase tracking-[0.35em] text-slate-500">
                    Apoio Tecnológico e Realização
                  </p>
                  <p className="text-[10px] font-bold text-slate-400 mt-1">
                    Clique para conhecer os patrocinadores
                  </p>
                </div>

                <div className="mb-12 flex flex-wrap justify-center items-center gap-8 md:gap-12">
                  {patrocinadoresRodape.map(p => (
                    <a
                      key={p.id}
                      href={p.link_destino || '#'}
                      target="_blank"
                      rel="noreferrer"
                      className="group"
                    >
                      <div className="bg-white border border-slate-200 rounded-2xl px-5 py-4 shadow-sm hover:shadow-xl hover:border-blue-300 transition-all duration-300">
                        <img
                          src={p.banner_url}
                          alt={p.nome_empresa || 'Parceiro'}
                          className="h-10 md:h-12 w-auto object-contain transition-transform duration-300 group-hover:scale-110"
                        />
                      </div>
                    </a>
                  ))}
                </div>
              </>
            )}

            <div className="pt-8 border-t border-slate-100 flex flex-col md:flex-row justify-between items-center gap-4">
              <p className="text-[10px] text-slate-400 font-mono uppercase tracking-widest font-bold">© 2026 GESTÃO ESPORTIVA INTEGRADA</p>
              <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-slate-500">
                <span>Súmula Digital por</span>
                <a href="https://wa.me/5547997037512" target="_blank" rel="noreferrer" className="text-blue-600 flex items-center gap-2 group">
                  <span className="border-b-2 border-blue-600/10 group-hover:border-blue-600 transition-all tracking-tighter">RC ENTERPRISE</span>
                  <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></div>
                </a>
              </div>
            </div>
          </footer>

        </div>
      </div>

      {/* ✅ MODAL — Baixar Súmula (Admin OU Professor) */}
      {sumulaOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/50"
            onClick={() => !sumulaLoading && setSumulaOpen(false)}
          />

          <div className="relative w-full max-w-md bg-white rounded-[2rem] shadow-2xl border border-slate-200 overflow-hidden">
            <div className="bg-slate-900 text-white p-5 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Lock size={16} className="text-yellow-400" />
                <p className="font-black uppercase text-xs tracking-widest">Baixar Súmula (PDF)</p>
              </div>

              <button
                onClick={() => !sumulaLoading && setSumulaOpen(false)}
                className="p-2 rounded-xl hover:bg-white/10"
              >
                <X size={16} />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <p className="text-[11px] text-slate-500 font-bold">
                Acesso com <b>senha de Admin</b> ou <b>login do Professor</b> (de uma das equipes do jogo).
                <br />
                <span className="text-slate-400 font-bold">LGPD: documentos saem mascarados no PDF.</span>
              </p>

              {/* Modo */}
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => { setSumulaMode('PROFESSOR'); setSumulaError('') }}
                  className={`py-2 rounded-xl text-[10px] font-black uppercase tracking-widest border transition-all ${
                    sumulaMode === 'PROFESSOR'
                      ? 'bg-blue-600 text-white border-blue-600'
                      : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  <Mail size={14} className="inline -mt-0.5 mr-2" />
                  Professor
                </button>

                <button
                  type="button"
                  onClick={() => { setSumulaMode('ADMIN'); setSumulaError('') }}
                  className={`py-2 rounded-xl text-[10px] font-black uppercase tracking-widest border transition-all ${
                    sumulaMode === 'ADMIN'
                      ? 'bg-slate-900 text-white border-slate-900'
                      : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  <Shield size={14} className="inline -mt-0.5 mr-2" />
                  Admin
                </button>
              </div>

              {/* Campos */}
              {sumulaMode === 'PROFESSOR' ? (
                <>
                  <div className="relative">
                    <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                    <input
                      value={sumulaEmail}
                      onChange={(e) => setSumulaEmail(e.target.value)}
                      placeholder="E-mail do Professor"
                      className="w-full pl-11 pr-4 py-3 rounded-xl border-2 border-slate-100 bg-slate-50 font-bold text-sm outline-none focus:border-blue-600"
                    />
                  </div>

                  <div className="relative">
                    <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                    <input
                      type="password"
                      value={sumulaSenha}
                      onChange={(e) => setSumulaSenha(e.target.value)}
                      placeholder="Senha do Professor"
                      className="w-full pl-11 pr-4 py-3 rounded-xl border-2 border-slate-100 bg-slate-50 font-bold text-sm outline-none focus:border-blue-600"
                      onKeyDown={(e) => e.key === 'Enter' && baixarSumulaPDF()}
                    />
                  </div>
                </>
              ) : (
                <div className="relative">
                  <Shield className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                  <input
                    type="password"
                    value={sumulaAdminSenha}
                    onChange={(e) => setSumulaAdminSenha(e.target.value)}
                    placeholder="Senha de Admin"
                    className="w-full pl-11 pr-4 py-3 rounded-xl border-2 border-slate-100 bg-slate-50 font-bold text-sm outline-none focus:border-slate-900"
                    onKeyDown={(e) => e.key === 'Enter' && baixarSumulaPDF()}
                  />
                </div>
              )}

              {sumulaError && (
                <div className="text-[11px] font-black text-red-600 bg-red-50 border border-red-100 rounded-xl p-3">
                  {sumulaError}
                </div>
              )}

              <button
                onClick={baixarSumulaPDF}
                disabled={sumulaLoading}
                className="w-full bg-blue-600 text-white font-black py-3 rounded-xl uppercase text-xs tracking-widest hover:bg-blue-700 disabled:opacity-60 flex items-center justify-center gap-2"
              >
                {sumulaLoading ? <Loader2 className="animate-spin" size={16} /> : <Download size={16} />}
                Gerar e Baixar PDF
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  )
}
