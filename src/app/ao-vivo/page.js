'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { ArrowLeft, Loader2, Radio, Goal, AlertTriangle } from 'lucide-react'

async function safeJson(res) {
  try { return await res.json() } catch { return {} }
}

function badgeFor(tipo) {
  if (tipo === 'GOL') return { label: 'GOL', cls: 'bg-green-100 text-green-700' }
  if (tipo === 'AMARELO') return { label: 'AMARELO', cls: 'bg-yellow-100 text-yellow-800' }
  if (tipo === 'VERMELHO') return { label: 'VERMELHO', cls: 'bg-red-100 text-red-700' }
  return { label: tipo, cls: 'bg-slate-100 text-slate-700' }
}

export default function AoVivo() {
  const [loading, setLoading] = useState(true)
  const [payload, setPayload] = useState(null)

  async function load() {
    setLoading(true)
    const res = await fetch('/api/ao-vivo', { cache: 'no-store' })
    const data = await safeJson(res)
    if (!res.ok) {
      setPayload({ error: data?.error || 'Erro ao carregar' })
      setLoading(false)
      return
    }
    setPayload(data)
    setLoading(false)
  }

  useEffect(() => {
    load()
    const t = setInterval(load, 5000) // “tempo real” por refresh (pode virar realtime depois)
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

  if (loading && !payload) {
    return (
      <main className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="flex items-center gap-3 text-slate-400 font-bold">
          <Loader2 className="animate-spin" /> Carregando ao vivo…
        </div>
      </main>
    )
  }

  if (payload?.error) {
    return (
      <main className="min-h-screen bg-slate-50 p-10">
        <Link href="/" className="inline-flex items-center gap-2 text-slate-500 hover:text-blue-600 font-bold text-sm uppercase">
          <ArrowLeft size={18} /> Voltar
        </Link>
        <div className="mt-8 bg-white border border-slate-200 rounded-3xl p-8">
          <p className="font-black text-red-600">Erro</p>
          <p className="text-slate-700 font-bold">{payload.error}</p>
        </div>
      </main>
    )
  }

  const etapa = payload?.etapa
  const jogos = payload?.jogos || []

  return (
    <main className="min-h-screen bg-slate-50 py-10 px-4 md:px-10">
      <div className="max-w-6xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <Link href="/" className="flex items-center gap-2 text-slate-500 hover:text-blue-600 font-bold text-sm uppercase transition-colors">
            <ArrowLeft size={18} /> Voltar
          </Link>

          <div className="flex items-center gap-2">
            <div className="inline-flex items-center gap-2 bg-red-50 border border-red-100 px-3 py-2 rounded-full">
              <Radio size={16} className="text-red-600" />
              <span className="text-[10px] font-black uppercase tracking-widest text-red-700">Ao vivo</span>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-6 mb-8">
          <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Etapa atual</p>
          <h1 className="text-2xl font-black text-slate-900 uppercase italic tracking-tighter">
            {etapa ? `${etapa.modalidade} • ${etapa.titulo}` : 'Nenhuma etapa cadastrada'}
          </h1>
          <p className="text-xs font-bold text-slate-500 mt-1">
            Atualiza automaticamente a cada 5 segundos • Última atualização: {payload?.now}
          </p>
        </div>

        {jogos.length === 0 ? (
          <div className="p-10 text-center text-slate-400 font-bold bg-white rounded-3xl border border-slate-200">
            Nenhum jogo cadastrado nesta etapa.
          </div>
        ) : (
          <div className="space-y-6">
            {jogos.map((j) => {
              const a = equipeMap.get(j.equipe_a_id)?.nome_equipe || `Equipe ${j.equipe_a_id}`
              const b = equipeMap.get(j.equipe_b_id)?.nome_equipe || `Equipe ${j.equipe_b_id}`
              const evs = eventosByJogo.get(j.id) || []
              const ga = j.gols_a ?? 0
              const gb = j.gols_b ?? 0

              return (
                <div key={j.id} className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
                  <div className="p-6 flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-b border-slate-100">
                    <div>
                      <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                        Rodada {j.rodada ?? '-'} • {j.data_jogo ?? 'Data a definir'} • Jogo #{j.id}
                      </p>
                      <p className="text-xl font-black text-slate-900">
                        {a} <span className="text-slate-300">vs</span> {b}
                      </p>
                    </div>

                    <div className="flex items-center gap-4">
                      <div className="text-center">
                        <p className="text-[10px] font-black uppercase text-slate-400">Placar</p>
                        <p className="text-3xl font-black text-slate-900">{ga} <span className="text-slate-300">x</span> {gb}</p>
                      </div>

                      <div className={`text-[10px] font-black uppercase tracking-widest px-3 py-2 rounded-full ${
                        j.finalizado ? 'bg-green-100 text-green-700' : 'bg-blue-50 text-blue-700'
                      }`}>
                        {j.finalizado ? 'Finalizado' : 'Em andamento'}
                      </div>
                    </div>
                  </div>

                  <div className="p-6">
                    <div className="flex items-center gap-2 mb-4">
                      <Goal size={16} className="text-slate-500" />
                      <p className="font-black uppercase text-slate-900 text-sm">Timeline da súmula</p>
                    </div>

                    {evs.length === 0 ? (
                      <div className="text-slate-400 font-bold text-sm">
                        Nenhum evento lançado ainda.
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {evs.map((ev) => {
                          const badge = badgeFor(ev.tipo)
                          const teamName = ev.equipe_id === j.equipe_a_id ? a : b
                          const atleta = ev.atleta_id ? atletaMap.get(ev.atleta_id) : null
                          const camisa = ev.camisa_no_jogo ?? atleta?.numero_camisa ?? '-'
                          const atletaTxt = atleta ? `#${camisa} ${atleta.nome}` : `#${camisa} —`
                          const when = `${ev.minuto ? `${ev.minuto}' ` : ''}${ev.tempo ? `(${ev.tempo})` : ''}`.trim()

                          return (
                            <div key={ev.id} className="bg-slate-50 border border-slate-200 rounded-2xl p-3 flex items-center justify-between">
                              <div>
                                <div className="flex items-center gap-2">
                                  <span className={`text-[10px] font-black px-2 py-1 rounded-full ${badge.cls}`}>
                                    {badge.label}
                                  </span>
                                  <span className="text-xs font-black text-slate-700">
                                    {when ? `${when} • ` : ''}{teamName} • {atletaTxt}
                                  </span>
                                </div>
                                {ev.observacao ? (
                                  <p className="text-xs font-bold text-slate-400 mt-1">{ev.observacao}</p>
                                ) : null}
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    )}

                    {!j.finalizado ? (
                      <div className="mt-4 flex items-start gap-2 text-[10px] font-bold text-slate-400 uppercase">
                        <AlertTriangle size={14} className="mt-0.5" />
                        O placar muda automaticamente quando a organização lança gols na súmula (evento GOL).
                      </div>
                    ) : null}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </main>
  )
}
