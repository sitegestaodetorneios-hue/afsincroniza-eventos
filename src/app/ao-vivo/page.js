'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { ArrowLeft, Loader2, Radio, Goal, AlertTriangle, Calendar, Clock, Trophy, User, CheckCircle } from 'lucide-react'

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

  async function load() {
    if (!payload) setLoading(true)
    try {
        const res = await fetch(`/api/ao-vivo?t=${Date.now()}`, { cache: 'no-store' })
        const data = await safeJson(res)
        if (res.ok) setPayload(data)
    } catch(e) { console.error(e) } 
    finally { setLoading(false) }
  }

  useEffect(() => {
    load()
    const t = setInterval(load, 5000) 
    return () => clearInterval(t)
  }, [])

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
    ;(payload?.eventos || []).forEach((ev) => {
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
          if (listas.aoVivo.length === 0) return listas.agendados;
          return listas.aoVivo;
      }
      if (aba === 'AGENDADO') return listas.agendados;
      if (aba === 'FINALIZADO') return listas.finalizados;
      return []
  }, [aba, listas])

  if (loading && !payload) {
    return (
      <main className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3 text-slate-400 font-bold">
          <Loader2 className="animate-spin text-blue-600" size={40} />
          <p className="text-xs uppercase tracking-widest">Sintonizando...</p>
        </div>
      </main>
    )
  }

  const etapa = payload?.etapa

  return (
    <main className="min-h-screen bg-slate-50 pb-20">
      
      {/* HEADER */}
      <div className="bg-slate-900 text-white pt-8 pb-16 px-4 md:px-10 shadow-lg relative overflow-hidden">
          <div className="max-w-6xl mx-auto relative z-10">
            <div className="flex justify-between items-center mb-6">
                <Link href="/" className="flex items-center gap-2 text-slate-400 hover:text-white font-bold text-xs uppercase transition-colors">
                    <ArrowLeft size={16} /> Voltar ao Início
                </Link>
                <div className="flex items-center gap-2">
                    <span className="w-2 h-2 bg-red-500 rounded-full animate-pulse"></span>
                    <span className="text-[10px] font-black uppercase tracking-widest text-slate-300">Tempo Real</span>
                </div>
            </div>
            
            <div className="flex items-center gap-3 mb-2">
                <Trophy className="text-yellow-500" size={24}/>
                <h1 className="text-2xl md:text-3xl font-black uppercase italic tracking-tighter">
                    {etapa ? etapa.titulo : 'Competição'}
                </h1>
            </div>
            <p className="text-slate-400 text-xs font-bold uppercase tracking-wide ml-9">
                {etapa ? etapa.modalidade : 'Futsal'}
            </p>
          </div>
          <div className="absolute -right-10 -bottom-20 opacity-5 rotate-12"><Trophy size={300} /></div>
      </div>

      <div className="max-w-6xl mx-auto px-4 md:px-10 -mt-8 relative z-20">
        
        <div className="flex gap-2 mb-8 overflow-x-auto pb-2 scrollbar-hide">
            <button onClick={() => setAba('AO_VIVO')} className={`px-6 py-3 rounded-xl font-black text-xs uppercase whitespace-nowrap transition-all shadow-md flex items-center gap-2 ${aba === 'AO_VIVO' ? 'bg-red-600 text-white scale-105 ring-2 ring-red-300' : 'bg-white text-slate-500 hover:bg-slate-100'}`}><Radio size={16} className={listas.aoVivo.length > 0 ? 'animate-pulse' : ''} /> Ao Vivo <span className="bg-black/20 px-1.5 py-0.5 rounded text-[9px]">{listas.aoVivo.length}</span></button>
            <button onClick={() => setAba('AGENDADO')} className={`px-6 py-3 rounded-xl font-black text-xs uppercase whitespace-nowrap transition-all shadow-md flex items-center gap-2 ${aba === 'AGENDADO' ? 'bg-blue-600 text-white scale-105 ring-2 ring-blue-300' : 'bg-white text-slate-500 hover:bg-slate-100'}`}><Calendar size={16} /> Agendados <span className="bg-black/10 px-1.5 py-0.5 rounded text-[9px]">{listas.agendados.length}</span></button>
            <button onClick={() => setAba('FINALIZADO')} className={`px-6 py-3 rounded-xl font-black text-xs uppercase whitespace-nowrap transition-all shadow-md flex items-center gap-2 ${aba === 'FINALIZADO' ? 'bg-slate-800 text-white scale-105 ring-2 ring-slate-500' : 'bg-white text-slate-500 hover:bg-slate-100'}`}><CheckCircle size={16} /> Finalizados <span className="bg-black/10 px-1.5 py-0.5 rounded text-[9px]">{listas.finalizados.length}</span></button>
        </div>

        {aba === 'AO_VIVO' && listas.aoVivo.length === 0 && listas.agendados.length > 0 && (
            <div className="mb-6 flex items-center gap-2 text-slate-500"><Clock size={16} className="text-blue-500"/><p className="text-xs font-bold uppercase tracking-wide">Aguardando início. Veja a sequência:</p></div>
        )}

        {jogosParaMostrar.length === 0 ? (
          <div className="bg-white rounded-3xl p-16 text-center border border-slate-200 shadow-sm animate-in fade-in zoom-in duration-300">
            <Trophy className="mx-auto text-slate-200 mb-4" size={48}/>
            <p className="text-slate-400 font-bold text-sm uppercase tracking-wide">
                Nenhum jogo nesta lista.
            </p>
          </div>
        ) : (
          <div className="space-y-6">
            {jogosParaMostrar.map((j) => {
              const a = equipeMap.get(j.equipe_a_id)?.nome_equipe || `Time A`
              const b = equipeMap.get(j.equipe_b_id)?.nome_equipe || `Time B`
              const evs = eventosByJogo.get(j.id) || []
              const ga = j.gols_a ?? 0
              const gb = j.gols_b ?? 0
              const isLive = j.status === 'EM_ANDAMENTO'
              
              const tipoRaw = j.tipo_jogo || 'JOGO'
              const tipoLabel = tipoRaw === 'GRUPO' ? `Rodada ${j.rodada || '-'}` : tipoRaw.replace(/_/g, ' ')
              const horaDisplay = j.horario ? String(j.horario).slice(0, 5) : '--:--'
              const dataDisplay = j.data_jogo ? new Date(j.data_jogo + 'T00:00:00').toLocaleDateString('pt-BR', {day:'2-digit', month:'2-digit'}) : 'Data a definir'
              const hasPenalties = j.penaltis_a !== null && j.penaltis_b !== null

              return (
                <div key={j.id} className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden transition-all hover:shadow-md animate-in fade-in slide-in-from-bottom-4 duration-500">
                  
                  <div className="bg-slate-50/50 p-4 border-b border-slate-100 flex justify-between items-center text-[10px] font-black uppercase text-slate-400 tracking-widest">
                      <span className="flex items-center gap-1"><Trophy size={12} className="text-yellow-600"/> {tipoLabel}</span>
                      <div className="flex items-center gap-3">
                          <span className="flex items-center gap-1"><Calendar size={12}/> {dataDisplay}</span>
                          <span className={`flex items-center gap-1 px-2 py-1 rounded-md border ${j.horario ? 'bg-blue-50 text-blue-700 border-blue-100' : 'bg-slate-100 text-slate-400 border-slate-200'}`}><Clock size={12}/> {horaDisplay}</span>
                      </div>
                  </div>

                  <div className="p-6 md:p-8 flex flex-col md:flex-row items-center justify-between gap-6">
                    <div className="flex-1 text-center md:text-right w-full"><p className="text-lg md:text-xl font-black text-slate-900 leading-tight">{a}</p></div>
                    <div className="flex flex-col items-center">
                        <div className={`flex items-center gap-4 text-white px-6 py-3 rounded-2xl shadow-lg relative ${isLive ? 'bg-slate-900' : 'bg-slate-700'}`}>
                            {isLive && <span className="absolute -top-2 -right-2 w-4 h-4 bg-red-500 rounded-full animate-pulse border-2 border-white"></span>}
                            <span className="text-3xl font-black min-w-[30px] text-center">{ga}</span>
                            <span className="text-slate-400 text-xl font-light">×</span>
                            <span className="text-3xl font-black min-w-[30px] text-center">{gb}</span>
                        </div>
                        {hasPenalties && <div className="mt-2 text-[10px] font-black uppercase tracking-widest text-slate-500 bg-slate-100 px-2 py-1 rounded border border-slate-200">Pen: ({j.penaltis_a}) - ({j.penaltis_b})</div>}
                    </div>
                    <div className="flex-1 text-center md:text-left w-full"><p className="text-lg md:text-xl font-black text-slate-900 leading-tight">{b}</p></div>
                  </div>

                  {evs.length > 0 && (
                      <div className="bg-slate-50 p-4 border-t border-slate-100">
                        <div className="flex items-center gap-2 mb-3 px-2"><Goal size={14} className="text-slate-400" /><p className="font-black uppercase text-slate-400 text-[10px] tracking-widest">Lance a Lance</p></div>
                        <div className="space-y-2 max-h-60 overflow-y-auto pr-2 custom-scrollbar">
                            {evs.map((ev) => {
                                const badge = badgeFor(ev.tipo)
                                const teamName = ev.equipe_id === j.equipe_a_id ? a : b
                                const atleta = ev.atleta_id ? atletaMap.get(ev.atleta_id) : null
                                const nomeAtleta = atleta ? atleta.nome.split(' ')[0] : 'Atleta' 
                                const tempo = ev.minuto ? `${ev.minuto}'` : ''
                                const obs = ev.observacao ? ` - ${ev.observacao}` : ''
                                return (
                                    <div key={ev.id} className="bg-white border border-slate-200 p-2 rounded-xl flex items-center justify-between text-xs shadow-sm">
                                        <div className="flex items-center gap-2"><span className={`font-black px-2 py-0.5 rounded text-[9px] border ${badge.cls}`}>{badge.label}</span><span className="font-bold text-slate-700">{teamName}</span></div>
                                        <div className="flex items-center gap-2 text-slate-500 font-medium"><span>{nomeAtleta} {ev.camisa_no_jogo ? `(#${ev.camisa_no_jogo})` : ''}{obs}</span>{tempo && <span className="font-black text-slate-900 bg-slate-100 px-1.5 rounded">{tempo}</span>}</div>
                                    </div>
                                )
                            })}
                        </div>
                      </div>
                  )}

                  {j.arbitro && <div className="bg-slate-50 px-6 py-2 border-t border-slate-100 text-center"><p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest flex items-center justify-center gap-1"><span className="bg-slate-200 rounded-full p-1"><User size={10} className="text-slate-500"/></span> Árbitro: {j.arbitro}</p></div>}
                </div>
              )
            })}
          </div>
        )}
      </div>
    </main>
  )
}