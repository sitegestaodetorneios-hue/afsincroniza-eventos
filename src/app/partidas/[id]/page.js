'use client'
import { useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { ArrowLeft, Loader2, ClipboardList, Shirt, RefreshCcw } from 'lucide-react'

async function safeJson(res) {
  try {
    return await res.json()
  } catch {
    const txt = await res.text().catch(() => '')
    return { error: txt || `Erro ${res.status}` }
  }
}

function asArray(v) {
  return Array.isArray(v) ? v : []
}

function badge(tipo) {
  const base = 'text-[10px] font-black uppercase px-3 py-1 rounded-full'
  if (tipo === 'GOL') return `${base} bg-green-100 text-green-700`
  if (tipo === 'AMARELO') return `${base} bg-amber-100 text-amber-800`
  if (tipo === 'VERMELHO') return `${base} bg-red-100 text-red-700`
  return `${base} bg-slate-100 text-slate-600`
}

export default function Partida({ params }) {
  const jogoId = params?.id

  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [lastUpdate, setLastUpdate] = useState(null)

  const mountedRef = useRef(true)
  useEffect(() => {
    mountedRef.current = true
    return () => (mountedRef.current = false)
  }, [])

  async function load(silent = false) {
    if (!silent) setLoading(true)
    try {
      const res = await fetch(`/api/partida?id=${jogoId}`, { cache: 'no-store' })
      const d = await safeJson(res)

      if (!mountedRef.current) return

      if (!res.ok) {
        console.error(d)
        setData({ error: d?.error || 'Erro ao carregar' })
      } else {
        setData(d)
      }
      setLastUpdate(new Date())
    } catch (e) {
      console.error(e)
      if (!mountedRef.current) return
      setData({ error: 'Falha de conexão' })
    } finally {
      if (!mountedRef.current) return
      if (!silent) setLoading(false)
    }
  }

  useEffect(() => {
    load(false)
    const t = setInterval(() => {
      if (document.visibilityState === 'visible') load(true)
    }, 6000)
    return () => clearInterval(t)
  }, [jogoId])

  const jogo = data?.jogo
  const eventos = asArray(data?.eventos)
  const atletasA = asArray(data?.atletasA)
  const atletasB = asArray(data?.atletasB)

  const nomeA = jogo?.equipeA?.nome_equipe || `Equipe ${jogo?.equipe_a_id || ''}`
  const nomeB = jogo?.equipeB?.nome_equipe || `Equipe ${jogo?.equipe_b_id || ''}`

  const placar = useMemo(() => {
    const ga = jogo?.gols_a
    const gb = jogo?.gols_b
    if (ga === null || ga === undefined || gb === null || gb === undefined) return '—  x  —'
    return `${ga}  x  ${gb}`
  }, [jogo])

  return (
    <main className="min-h-screen bg-slate-50 py-10 px-4 md:px-10">
      <div className="max-w-5xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <Link
            href="/partidas"
            className="flex items-center gap-2 text-slate-500 hover:text-blue-600 font-bold text-sm uppercase transition-colors"
          >
            <ArrowLeft size={18} /> Voltar
          </Link>

          <button
            onClick={() => load(false)}
            className="inline-flex items-center gap-2 text-xs font-black uppercase tracking-widest px-4 py-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50"
          >
            <RefreshCcw size={14} /> Atualizar
          </button>
        </div>

        <div className="bg-white rounded-3xl shadow-xl overflow-hidden border border-slate-200">
          {loading ? (
            <div className="p-12 flex items-center justify-center gap-3 text-slate-400 font-bold">
              <Loader2 className="animate-spin" /> Carregando partida…
            </div>
          ) : data?.error ? (
            <div className="p-12 text-center text-red-600 font-black uppercase">
              {data.error}
            </div>
          ) : (
            <>
              {/* Header FIFA */}
              <div className="bg-slate-900 text-white p-8">
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-300">
                  Rodada {jogo?.rodada ?? '—'} • {jogo?.finalizado ? 'FINAL' : 'EM ANDAMENTO'}
                </p>

                <div className="mt-3 flex flex-col md:flex-row md:items-center md:justify-between gap-6">
                  <div className="space-y-1">
                    <p className="text-2xl md:text-3xl font-black uppercase tracking-tight">
                      {nomeA} <span className="text-slate-400">vs</span> {nomeB}
                    </p>
                    <p className="text-slate-300 text-xs font-bold uppercase">
                      Jogo ID: {jogo?.id} • Última atualização: {lastUpdate ? lastUpdate.toLocaleTimeString() : '—'}
                    </p>
                  </div>

                  <div className="text-center md:text-right">
                    <p className="text-5xl md:text-6xl font-black tracking-tighter">{placar}</p>
                    <p className="text-[10px] font-black uppercase text-slate-300">
                      Placar (gols via súmula)
                    </p>
                  </div>
                </div>
              </div>

              {/* Conteúdo */}
              <div className="p-6 md:p-8 grid lg:grid-cols-2 gap-8">
                {/* Eventos */}
                <div className="bg-slate-50 border border-slate-200 rounded-2xl p-5">
                  <div className="flex items-center gap-2 mb-4">
                    <ClipboardList size={18} className="text-blue-600" />
                    <h2 className="font-black uppercase text-slate-900">Eventos</h2>
                  </div>

                  {eventos.length === 0 ? (
                    <p className="text-slate-400 font-bold">Nenhum evento lançado.</p>
                  ) : (
                    <div className="space-y-2">
                      {eventos.map((ev) => (
                        <div key={ev.id} className="bg-white border border-slate-200 rounded-xl p-3">
                          <div className="flex items-center justify-between gap-3">
                            <span className={badge(ev.tipo)}>{ev.tipo}</span>
                            <span className="text-[10px] font-black uppercase text-slate-400">
                              {ev.minuto ? `${ev.minuto}'` : ''} {ev.tempo ? `(${ev.tempo})` : ''}
                            </span>
                          </div>
                          <p className="mt-2 text-sm font-bold text-slate-800">
                            {ev.team_name || 'Equipe'} • {ev.atleta_label || '—'}
                          </p>
                          {ev.observacao ? (
                            <p className="text-xs font-bold text-slate-400 mt-1">{ev.observacao}</p>
                          ) : null}
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Elencos */}
                <div className="bg-slate-50 border border-slate-200 rounded-2xl p-5">
                  <div className="flex items-center gap-2 mb-4">
                    <Shirt size={18} className="text-blue-600" />
                    <h2 className="font-black uppercase text-slate-900">Elencos</h2>
                  </div>

                  <div className="grid md:grid-cols-2 gap-4">
                    <div className="bg-white border border-slate-200 rounded-2xl p-4">
                      <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Time A</p>
                      <p className="font-black text-slate-900">{nomeA}</p>
                      <div className="mt-3 space-y-2">
                        {atletasA.length === 0 ? (
                          <p className="text-slate-400 font-bold text-sm">Sem atletas cadastrados.</p>
                        ) : (
                          atletasA.map((a) => (
                            <div key={a.id} className="flex items-center justify-between text-sm font-bold">
                              <span className="text-slate-800">{a.nome}</span>
                              <span className="text-slate-500">#{a.numero_camisa ?? '-'}</span>
                            </div>
                          ))
                        )}
                      </div>
                    </div>

                    <div className="bg-white border border-slate-200 rounded-2xl p-4">
                      <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Time B</p>
                      <p className="font-black text-slate-900">{nomeB}</p>
                      <div className="mt-3 space-y-2">
                        {atletasB.length === 0 ? (
                          <p className="text-slate-400 font-bold text-sm">Sem atletas cadastrados.</p>
                        ) : (
                          atletasB.map((a) => (
                            <div key={a.id} className="flex items-center justify-between text-sm font-bold">
                              <span className="text-slate-800">{a.nome}</span>
                              <span className="text-slate-500">#{a.numero_camisa ?? '-'}</span>
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  </div>

                  <p className="mt-4 text-[10px] font-bold uppercase text-slate-400">
                    Observação: a camisa do gol pode ser diferente (camisa_no_jogo) e aparece na súmula/eventos.
                  </p>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </main>
  )
}
