'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { ArrowLeft, Loader2, Radio, Goal, Calendar, Clock, Trophy, User, CheckCircle, Volume2 } from 'lucide-react'

async function safeJson(res) {
  try { return await res.json() } catch { return {} }
}

function badgeFor(tipo) {
  if (tipo === 'GOL') return { label: '⚽ GOL', cls: 'bg-green-100 text-green-800 border-green-200' }
  if (tipo === 'AMARELO') return { label: '🟨 AMARELO', cls: 'bg-yellow-100 text-yellow-800 border-yellow-200' }
  if (tipo === 'VERMELHO') return { label: '🟥 VERMELHO', cls: 'bg-red-100 text-red-800 border-red-200' }
  return { label: tipo, cls: 'bg-slate-100 text-slate-700 border-slate-200' }
}

export default function AoVivo() {
  const [loading, setLoading] = useState(true)
  const [payload, setPayload] = useState(null)
  const [aba, setAba] = useState('AO_VIVO')
  const [patrocinios, setPatrocinios] = useState([])
  const [indexCarrossel, setIndexCarrossel] = useState(0)

  async function load() {
    if (!payload) setLoading(true)
    try {
      const [res, resPatro] = await Promise.all([
        fetch(`/api/ao-vivo`, { cache: 'no-store' }),
        fetch('/api/admin/patrocinios', { cache: 'no-store' }) // ✅ sem PIN (ok)
      ])

      const data = await safeJson(res)
      const dataPatro = await safeJson(resPatro)

      if (res.ok) setPayload(data)
      if (resPatro.ok) setPatrocinios(Array.isArray(dataPatro) ? dataPatro : [])
    } catch (e) {
      console.error('Erro ao sintonizar:', e)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
    const t = setInterval(load, 20000)
    return () => clearInterval(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ✅ Filtra patrocinadores com dados válidos
  const patrocinadorMaster = useMemo(() => {
    const m = patrocinios.find(p => p.cota === 'MASTER' && (p.banner_url || p.video_url))
    return m || null
  }, [patrocinios])

  const patrocinadoresCarrossel = useMemo(() => {
    return patrocinios.filter(p => p.cota === 'CARROSSEL' && p.banner_url)
  }, [patrocinios])

  const patrocinadoresRodape = useMemo(() => {
    return patrocinios.filter(p => p.cota === 'RODAPE' && p.banner_url)
  }, [patrocinios])

  // ✅ Carrossel: índice sempre válido
  useEffect(() => {
    if (patrocinadoresCarrossel.length <= 1) {
      setIndexCarrossel(0)
      return
    }
    const interval = setInterval(() => {
      setIndexCarrossel(prev => (prev + 1) % patrocinadoresCarrossel.length)
    }, 5000)
    return () => clearInterval(interval)
  }, [patrocinadoresCarrossel])

  const equipeMap = useMemo(() => {
    const m = new Map()
    ;(payload?.equipes || []).forEach((e) => m.set(e.id, e))
    return m
  }, [payload])

  const atletaMap = useMemo(() => {
    const m = new Map()
    ;(payload?.atletas || []).forEach((a) => m.set(a.id, a))
    return m
  }, [payload])

  const eventosByJogo = useMemo(() => {
    const m = new Map()
    const eventos = Array.isArray(payload?.eventos) ? payload.eventos : []
    eventos.forEach((ev) => {
      if (!m.has(ev.jogo_id)) m.set(ev.jogo_id, [])
      m.get(ev.jogo_id).push(ev)
    })
    return m
  }, [payload])

  const listas = useMemo(() => {
    const todos = payload?.jogos || []
    const aoVivo = todos.filter(j => j.status === 'EM_ANDAMENTO')
    const finalizados = todos.filter(j => j.status === 'FINALIZADO' || j.finalizado)
    const agendados = todos.filter(j => (j.status === 'EM_BREVE' || !j.status) && !j.finalizado)
    return { aoVivo, agendados, finalizados }
  }, [payload])

  const jogosParaMostrar = useMemo(() => {
    if (aba === 'AO_VIVO') {
      return listas.aoVivo.length > 0 ? listas.aoVivo : listas.agendados
    }
    if (aba === 'AGENDADO') return listas.agendados
    if (aba === 'FINALIZADO') return listas.finalizados
    return []
  }, [aba, listas])

  if (loading && !payload) {
    return (
      <main className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3 text-slate-400 font-bold">
          <Loader2 className="animate-spin text-blue-600" size={40} />
          <p className="text-[10px] uppercase tracking-[0.3em]">Sintonizando Transmissão...</p>
        </div>
      </main>
    )
  }

  const etapa = payload?.etapa

  return (
    <main className="min-h-screen bg-slate-50 pb-20">
      {/* HEADER FIFA STYLE */}
      <div className="bg-slate-900 text-white pt-8 pb-16 px-4 md:px-10 shadow-lg relative overflow-hidden">
        <div className="max-w-6xl mx-auto relative z-10">
          <div className="flex justify-between items-center mb-6">
            <Link href="/" className="flex items-center gap-2 text-slate-400 hover:text-white font-bold text-xs uppercase transition-colors">
              <ArrowLeft size={16} /> Voltar ao Início
            </Link>
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 bg-red-500 rounded-full animate-pulse"></span>
              <span className="text-[10px] font-black uppercase tracking-widest text-slate-300">Tempo Real (Live)</span>
            </div>
          </div>

          <div className="flex items-center gap-3 mb-2">
            <Trophy className="text-yellow-500" size={24} />
            <h1 className="text-2xl md:text-3xl font-black uppercase italic tracking-tighter">
              {etapa ? etapa.titulo : 'Torneio'}
            </h1>
          </div>
          <p className="text-slate-400 text-xs font-bold uppercase tracking-wide ml-9">
            {etapa?.modalidade || 'Competição Oficial'}
          </p>
        </div>
        <div className="absolute -right-10 -bottom-20 opacity-5 rotate-12"><Trophy size={300} /></div>
      </div>

      <div className="max-w-6xl mx-auto px-4 md:px-10 -mt-8 relative z-20">

        {/* BANNER MASTER DINÂMICO */}
        {patrocinadorMaster && (
          <div className="mb-8 rounded-[2rem] overflow-hidden shadow-2xl border-4 border-white bg-black group relative aspect-video max-h-[250px] w-full">
            {patrocinadorMaster.link_destino ? (
              <a
                href={patrocinadorMaster.link_destino}
                target="_blank"
                rel="noopener noreferrer"
                className="block w-full h-full"
              >
                {patrocinadorMaster.video_url ? (
                  <div className="w-full h-full">
                    <video
                      src={patrocinadorMaster.video_url}
                      autoPlay
                      loop
                      muted
                      playsInline
                      className="w-full h-full object-cover"
                    />
                    <div className="absolute top-4 right-4 bg-black/50 backdrop-blur-md p-2 rounded-full text-white">
                      <Volume2 size={16} className="animate-pulse" />
                    </div>
                  </div>
                ) : (
                  <img
                    src={patrocinadorMaster.banner_url}
                    className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
                    alt="Sponsor Master"
                  />
                )}
                <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-4">
                  <span className="text-[9px] font-black text-white/60 uppercase tracking-[0.2em]">Patrocinador Master Oficial</span>
                </div>
              </a>
            ) : (
              <div className="block w-full h-full">
                {patrocinadorMaster.video_url ? (
                  <div className="w-full h-full">
                    <video
                      src={patrocinadorMaster.video_url}
                      autoPlay
                      loop
                      muted
                      playsInline
                      className="w-full h-full object-cover"
                    />
                    <div className="absolute top-4 right-4 bg-black/50 backdrop-blur-md p-2 rounded-full text-white">
                      <Volume2 size={16} className="animate-pulse" />
                    </div>
                  </div>
                ) : (
                  <img
                    src={patrocinadorMaster.banner_url}
                    className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
                    alt="Sponsor Master"
                  />
                )}
                <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-4">
                  <span className="text-[9px] font-black text-white/60 uppercase tracking-[0.2em]">Patrocinador Master Oficial</span>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ABAS DE NAVEGAÇÃO */}
        <div className="flex gap-2 mb-8 overflow-x-auto pb-2 scrollbar-hide">
          <button
            onClick={() => setAba('AO_VIVO')}
            className={`px-6 py-3 rounded-xl font-black text-xs uppercase whitespace-nowrap transition-all shadow-md flex items-center gap-2 ${
              aba === 'AO_VIVO' ? 'bg-red-600 text-white scale-105 ring-2 ring-red-300' : 'bg-white text-slate-500 hover:bg-slate-100'
            }`}
          >
            <Radio size={16} className={listas.aoVivo.length > 0 ? 'animate-pulse' : ''} />
            Jogos Hoje <span className="bg-black/20 px-1.5 py-0.5 rounded text-[9px]">{listas.aoVivo.length}</span>
          </button>

          <button
            onClick={() => setAba('AGENDADO')}
            className={`px-6 py-3 rounded-xl font-black text-xs uppercase whitespace-nowrap transition-all shadow-md flex items-center gap-2 ${
              aba === 'AGENDADO' ? 'bg-blue-600 text-white scale-105 ring-2 ring-blue-300' : 'bg-white text-slate-500 hover:bg-slate-100'
            }`}
          >
            <Calendar size={16} /> Futuros <span className="bg-black/10 px-1.5 py-0.5 rounded text-[9px]">{listas.agendados.length}</span>
          </button>

          <button
            onClick={() => setAba('FINALIZADO')}
            className={`px-6 py-3 rounded-xl font-black text-xs uppercase whitespace-nowrap transition-all shadow-md flex items-center gap-2 ${
              aba === 'FINALIZADO' ? 'bg-slate-800 text-white scale-105 ring-2 ring-slate-500' : 'bg-white text-slate-500 hover:bg-slate-100'
            }`}
          >
            <CheckCircle size={16} /> Resultados <span className="bg-black/10 px-1.5 py-0.5 rounded text-[9px]">{listas.finalizados.length}</span>
          </button>
        </div>

        {/* CARROSSEL DE PARCEIROS */}
        {patrocinadoresCarrossel.length > 0 && (
          <div className="mb-6">
            <a
              href={patrocinadoresCarrossel[indexCarrossel]?.link_destino || '#'}
              target="_blank"
              rel="noopener noreferrer"
              className="block relative group overflow-hidden rounded-2xl shadow-inner border border-slate-200"
            >
              <img
                src={patrocinadoresCarrossel[indexCarrossel]?.banner_url}
                className="w-full h-20 md:h-24 object-cover"
                alt="Partner"
              />
              <div className="absolute top-2 right-4 flex gap-1">
                {patrocinadoresCarrossel.map((_, idx) => (
                  <div
                    key={idx}
                    className={`w-1 h-1 rounded-full transition-all ${idx === indexCarrossel ? 'bg-white w-4' : 'bg-white/40'}`}
                  ></div>
                ))}
              </div>
            </a>
          </div>
        )}

        {/* LISTAGEM DE JOGOS */}
        {jogosParaMostrar.length === 0 ? (
          <div className="bg-white rounded-[2rem] p-16 text-center border border-slate-200 shadow-sm">
            <Trophy className="mx-auto text-slate-100 mb-4" size={60} />
            <p className="text-slate-400 font-black text-xs uppercase tracking-widest">Nenhum registro encontrado</p>
          </div>
        ) : (
          <div className="grid gap-6">
            {jogosParaMostrar.map((j) => {
              const a = equipeMap.get(j.equipe_a_id)?.nome_equipe || `Equipe A`
              const b = equipeMap.get(j.equipe_b_id)?.nome_equipe || `Equipe B`
              const evs = eventosByJogo.get(j.id) || []
              const isLive = j.status === 'EM_ANDAMENTO'

              return (
                <div key={j.id} className="bg-white rounded-[2rem] border border-slate-200 shadow-sm overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-500">
                  <div className="bg-slate-50/80 p-4 border-b border-slate-100 flex justify-between items-center text-[10px] font-black uppercase text-slate-400 tracking-tighter">
                    <span className="flex items-center gap-1"><Trophy size={12} className="text-yellow-600" /> {j.tipo_jogo?.replace(/_/g, ' ')}</span>
                    <div className="flex items-center gap-3">
                      <span className="flex items-center gap-1"><Calendar size={12} /> {j.data_jogo ? new Date(j.data_jogo + 'T00:00:00').toLocaleDateString('pt-BR') : '--/--'}</span>
                      <span className="flex items-center gap-1 text-blue-600"><Clock size={12} /> {j.horario ? String(j.horario).slice(0, 5) : '--:--'}</span>
                    </div>
                  </div>

                  <div className="p-6 md:p-10 flex flex-col md:flex-row items-center justify-between gap-6">
                    <div className="flex-1 text-center md:text-right order-2 md:order-1 w-full"><p className="text-xl font-black text-slate-900 uppercase italic tracking-tighter">{a}</p></div>
                    <div className="flex flex-col items-center order-1 md:order-2">
                      <div className={`flex items-center gap-6 text-white px-8 py-4 rounded-3xl shadow-xl relative ${isLive ? 'bg-slate-900 ring-4 ring-red-500/20' : 'bg-slate-700'}`}>
                        {isLive && <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 rounded-full animate-pulse border-2 border-white"></span>}
                        <span className="text-4xl font-black">{j.gols_a ?? 0}</span>
                        <span className="text-slate-400 text-2xl font-light">×</span>
                        <span className="text-4xl font-black">{j.gols_b ?? 0}</span>
                      </div>
                      {j.penaltis_a !== null && (
                        <div className="mt-3 text-[10px] font-black text-slate-500 bg-slate-100 px-3 py-1 rounded-full border border-slate-200">
                          Decisão por Pênaltis: ({j.penaltis_a}) - ({j.penaltis_b})
                        </div>
                      )}
                    </div>
                    <div className="flex-1 text-center md:text-left order-3 w-full"><p className="text-xl font-black text-slate-900 uppercase italic tracking-tighter">{b}</p></div>
                  </div>

                  {evs.length > 0 && (
                    <div className="bg-slate-50 p-6 border-t border-slate-100">
                      <div className="flex items-center gap-2 mb-4"><Goal size={16} className="text-slate-400" /><p className="font-black uppercase text-slate-400 text-[11px] tracking-widest italic">Acontecimentos da Partida</p></div>
                      <div className="grid gap-2 max-h-72 overflow-y-auto pr-2 custom-scrollbar">
                        {evs.map((ev) => {
                          const badge = badgeFor(ev.tipo)
                          const teamName = ev.equipe_id === j.equipe_a_id ? a : b
                          const atleta = atletaMap.get(ev.atleta_id)
                          return (
                            <div key={ev.id} className="bg-white border border-slate-200 p-3 rounded-2xl flex items-center justify-between text-xs shadow-sm hover:border-blue-200 transition-colors">
                              <div className="flex items-center gap-3">
                                <span className={`font-black px-2.5 py-1 rounded-lg text-[10px] border shadow-sm ${badge.cls}`}>{badge.label}</span>
                                <div>
                                  <p className="font-black text-slate-900 leading-none mb-0.5">{atleta?.nome || 'Atleta não informado'}</p>
                                  <p className="text-[9px] font-bold text-slate-400 uppercase tracking-tighter">
                                    {teamName} {ev.camisa_no_jogo ? `• Camisa ${ev.camisa_no_jogo}` : ''}
                                  </p>
                                </div>
                              </div>
                              {ev.minuto && <span className="font-black text-slate-900 bg-slate-100 px-2.5 py-1 rounded-lg shadow-inner">{ev.minuto}'</span>}
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  )}
                  {j.arbitro && (
                    <div className="bg-slate-50 px-6 py-3 border-t border-slate-100 text-center">
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center justify-center gap-2 italic">
                        Quadro de Arbitragem: {j.arbitro}
                      </p>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}

        {/* FOOTER RC ENTERPRISE */}
        <footer className="mt-20 pt-10 border-t border-slate-200">
          {patrocinadoresRodape.length > 0 && (
            <div className="mb-12">
              <p className="text-center text-[10px] font-black uppercase text-slate-400 tracking-[0.4em] mb-10 italic">Parceiros de Tecnologia e Realização</p>
              <div className="flex flex-wrap justify-center items-center gap-10 md:gap-16 opacity-60 grayscale hover:grayscale-0 transition-all duration-700">
                {patrocinadoresRodape.map(p => (
                  <a key={p.id} href={p.link_destino || '#'} target="_blank" rel="noopener noreferrer">
                    <img src={p.banner_url} alt={p.nome_empresa} className="h-10 md:h-14 w-auto object-contain hover:scale-110 transition-transform" />
                  </a>
                ))}
              </div>
            </div>
          )}

          <div className="pt-8 border-t border-slate-100 flex flex-col md:flex-row justify-between items-center gap-4">
            <p className="text-[10px] text-slate-400 font-mono uppercase tracking-widest font-bold">© 2026 GESTÃO ESPORTIVA PREMIUM</p>
            <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-slate-500">
              <span>Desenvolvido por</span>
              <a href="https://wa.me/5547997037512" target="_blank" rel="noopener noreferrer" className="text-blue-600 flex items-center gap-2 group">
                <span className="border-b-2 border-blue-600/10 group-hover:border-blue-600 transition-all tracking-tighter">RC ENTERPRISE</span>
                <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></div>
              </a>
            </div>
          </div>
        </footer>
      </div>
    </main>
  )
}
