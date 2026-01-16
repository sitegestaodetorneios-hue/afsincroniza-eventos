'use client'
import { useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { ArrowLeft, Loader2, ClipboardList, Shirt, RefreshCcw, Trophy, Volume2, Calendar, Clock } from 'lucide-react'

async function safeJson(res) {
  try {
    return await res.json()
  } catch {
    const txt = await res.text().catch(() => '')
    return { error: txt || `Erro ${res.status}` }
  }
}

function asArray(v) { return Array.isArray(v) ? v : [] }

function badge(tipo) {
  const base = 'text-[10px] font-black uppercase px-3 py-1 rounded-full border shadow-sm'
  if (tipo === 'GOL') return `${base} bg-green-100 text-green-700 border-green-200`
  if (tipo === 'AMARELO') return `${base} bg-amber-100 text-amber-800 border-amber-200`
  if (tipo === 'VERMELHO') return `${base} bg-red-100 text-red-700 border-red-200`
  return `${base} bg-slate-100 text-slate-600 border-slate-200`
}

export default function Partida({ params }) {
  const jogoId = params?.id

  const [data, setData] = useState(null)
  const [patrocinios, setPatrocinios] = useState([])
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
      // ✅ BUSCA SINCRONIZADA COM CACHE ON-DEMAND
      const [res, resPatro] = await Promise.all([
        fetch(`/api/partida?id=${jogoId}`, { cache: 'no-store' }), // Detalhe específico sempre novo ou via Tag
        fetch('/api/admin/patrocinios', { cache: 'no-store' })
      ])
      
      const d = await safeJson(res)
      const p = await safeJson(resPatro)

      if (!mountedRef.current) return

      if (!res.ok) {
        setData({ error: d?.error || 'Erro ao carregar partida' })
      } else {
        setData(d)
      }
      setPatrocinios(asArray(p))
      setLastUpdate(new Date())
    } catch (e) {
      console.error(e)
      if (mountedRef.current) setData({ error: 'Falha de conexão com o servidor' })
    } finally {
      if (mountedRef.current && !silent) setLoading(false)
    }
  }

  useEffect(() => {
    load(false)
    const t = setInterval(() => {
      if (document.visibilityState === 'visible') load(true)
    }, 15000) // 15 segundos para não pesar o banco
    return () => clearInterval(t)
  }, [jogoId])

  const jogo = data?.jogo
  const eventos = asArray(data?.eventos)
  const atletasA = asArray(data?.atletasA)
  const atletasB = asArray(data?.atletasB)
  const patrocinadorMaster = useMemo(() => patrocinios.find(p => p.cota === 'MASTER'), [patrocinios])
  const patrocinadoresRodape = useMemo(() => patrocinios.filter(p => p.cota === 'RODAPE'), [patrocinios])

  const nomeA = jogo?.equipeA?.nome_equipe || `Equipe A`
  const nomeB = jogo?.equipeB?.nome_equipe || `Equipe B`

  if (loading && !data) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center gap-4">
        <Loader2 className="animate-spin text-blue-600" size={40} />
        <p className="text-xs font-black text-slate-400 uppercase tracking-widest">Acessando Súmula Eletrônica...</p>
      </div>
    )
  }

  return (
    <main className="min-h-screen bg-slate-50 py-10 px-4 md:px-10">
      <div className="max-w-5xl mx-auto">
        
        {/* Header de Navegação */}
        <div className="flex justify-between items-center mb-8">
          <Link href="/partidas" className="flex items-center gap-2 text-slate-500 hover:text-blue-600 font-bold text-sm uppercase transition-colors">
            <ArrowLeft size={18} /> Voltar ao Calendário
          </Link>

          <button onClick={() => load(false)} className="inline-flex items-center gap-2 text-[10px] font-black uppercase tracking-widest px-4 py-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 transition-all shadow-sm">
            <RefreshCcw size={14} className={loading ? "animate-spin" : ""} /> {loading ? "Sincronizando..." : "Atualizar"}
          </button>
        </div>

        {/* BANNER MASTER */}
        {patrocinadorMaster && (
          <div className="mb-10 rounded-3xl overflow-hidden shadow-xl border-4 border-white bg-slate-900 relative group aspect-[16/5] md:aspect-[21/6]">
            <a href={patrocinadorMaster.link_destino || '#'} target="_blank">
              {patrocinadorMaster.video_url ? (
                <div className="w-full h-full relative">
                  <video src={patrocinadorMaster.video_url} autoPlay loop muted playsInline className="w-full h-full object-cover" />
                  <div className="absolute top-4 right-4 bg-black/40 backdrop-blur-md p-1.5 rounded-full text-white/80"><Volume2 size={14}/></div>
                </div>
              ) : (
                <img src={patrocinadorMaster.banner_url} className="w-full h-full object-cover transition-transform duration-1000 group-hover:scale-105" alt="Master Sponsor" />
              )}
            </a>
          </div>
        )}

        <div className="bg-white rounded-[2rem] shadow-2xl overflow-hidden border border-slate-200 transition-all">
          {data?.error ? (
            <div className="p-20 text-center">
              <p className="text-red-500 font-black uppercase tracking-widest mb-2">Ops! Ocorreu um erro</p>
              <p className="text-slate-400 text-sm">{data.error}</p>
            </div>
          ) : (
            <>
              {/* Placar FIFA Style */}
              <div className="bg-slate-900 text-white p-8 md:p-12 relative overflow-hidden">
                <div className="relative z-10">
                  <div className="flex items-center gap-2 mb-6">
                    <span className={`px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest ${jogo?.status === 'EM_ANDAMENTO' ? 'bg-red-600 animate-pulse' : 'bg-slate-700 text-slate-300'}`}>
                      {jogo?.status === 'EM_ANDAMENTO' ? '● Ao Vivo' : 'Partida Encerrada'}
                    </span>
                    <span className="text-slate-500 font-bold text-[9px]">ID #{jogo?.id}</span>
                  </div>

                  <div className="flex flex-col md:flex-row items-center justify-between gap-8">
                    <div className="flex-1 text-center md:text-left">
                      <h2 className="text-2xl md:text-4xl font-black uppercase italic tracking-tighter mb-2">{nomeA}</h2>
                      <p className="text-slate-400 text-[10px] font-bold uppercase tracking-widest">Mandante</p>
                    </div>

                    <div className="flex flex-col items-center">
                      <div className="text-6xl md:text-8xl font-black tracking-tighter flex items-center gap-4">
                        <span>{jogo?.gols_a ?? 0}</span>
                        <span className="text-slate-700 text-4xl md:text-5xl font-light">×</span>
                        <span>{jogo?.gols_b ?? 0}</span>
                      </div>
                      {jogo?.penaltis_a !== null && (
                        <div className="mt-4 bg-white/5 border border-white/10 px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest text-yellow-500">
                          Pênaltis: {jogo.penaltis_a} - {jogo.penaltis_b}
                        </div>
                      )}
                    </div>

                    <div className="flex-1 text-center md:text-right">
                      <h2 className="text-2xl md:text-4xl font-black uppercase italic tracking-tighter mb-2">{nomeB}</h2>
                      <p className="text-slate-400 text-[10px] font-bold uppercase tracking-widest">Visitante</p>
                    </div>
                  </div>
                </div>
                <div className="absolute right-0 bottom-0 opacity-5 transform translate-x-1/4 translate-y-1/4"><Trophy size={300} /></div>
              </div>

              {/* Informações de Campo */}
              <div className="bg-slate-50 border-y border-slate-100 px-8 py-4 flex flex-wrap justify-center gap-8 text-[10px] font-black uppercase tracking-widest text-slate-400">
                <div className="flex items-center gap-2"><Calendar size={14} className="text-blue-600"/> {jogo?.data_jogo ? new Date(jogo.data_jogo + 'T00:00:00').toLocaleDateString('pt-BR') : '--/--'}</div>
                <div className="flex items-center gap-2"><Clock size={14} className="text-blue-600"/> {jogo?.horario ? String(jogo.horario).slice(0,5) : '--:--'}</div>
                <div className="flex items-center gap-2"><Trophy size={14} className="text-yellow-600"/> {jogo?.tipo_jogo?.replace(/_/g, ' ')} • Rodada {jogo?.rodada}</div>
              </div>

              {/* Grid de Detalhes */}
              <div className="p-6 md:p-10 grid lg:grid-cols-2 gap-10">
                {/* LANCE A LANCE */}
                <div>
                  <div className="flex items-center gap-3 mb-6 border-b border-slate-100 pb-4">
                    <div className="p-2 bg-blue-100 rounded-lg text-blue-600"><ClipboardList size={20} /></div>
                    <h3 className="font-black uppercase text-slate-900 tracking-tight">Súmula de Eventos</h3>
                  </div>

                  {eventos.length === 0 ? (
                    <div className="py-10 text-center border-2 border-dashed border-slate-100 rounded-2xl">
                      <p className="text-slate-300 font-bold text-xs uppercase italic">Aguardando lances da partida...</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {eventos.map((ev) => (
                        <div key={ev.id} className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm hover:shadow-md transition-shadow">
                          <div className="flex items-center justify-between mb-2">
                            <span className={badge(ev.tipo)}>{ev.tipo}</span>
                            {ev.minuto && <span className="text-[11px] font-black text-slate-900 bg-slate-100 px-2 py-1 rounded-md">{ev.minuto}'</span>}
                          </div>
                          <p className="font-black text-slate-800 text-sm uppercase tracking-tighter">{ev.atleta_label || 'Atleta não identificado'}</p>
                          <p className="text-[10px] font-bold text-slate-400 uppercase mt-1">{ev.team_name}</p>
                          {ev.observacao && <p className="mt-2 text-[10px] italic text-slate-500 bg-slate-50 p-2 rounded-lg border border-slate-100">"{ev.observacao}"</p>}
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* ESCALAÇÕES */}
                <div>
                  <div className="flex items-center gap-3 mb-6 border-b border-slate-100 pb-4">
                    <div className="p-2 bg-blue-100 rounded-lg text-blue-600"><Shirt size={20} /></div>
                    <h3 className="font-black uppercase text-slate-900 tracking-tight">Elencos em Campo</h3>
                  </div>

                  <div className="grid gap-6">
                    {/* TIME A */}
                    <div className="bg-slate-50 rounded-2xl p-5 border border-slate-200">
                      <p className="text-[10px] font-black uppercase text-blue-600 mb-3 tracking-widest">{nomeA}</p>
                      <div className="space-y-1.5">
                        {atletasA.length === 0 ? <p className="text-slate-300 text-[10px] font-bold">Sem escalação disponível.</p> : 
                          atletasA.map(a => (
                            <div key={a.id} className="flex items-center justify-between bg-white p-2 rounded-lg border border-slate-100 text-xs font-bold">
                              <span className="text-slate-700 uppercase">{a.nome}</span>
                              <span className="text-blue-600 font-black">#{a.numero_camisa ?? '-'}</span>
                            </div>
                          ))
                        }
                      </div>
                    </div>

                    {/* TIME B */}
                    <div className="bg-slate-50 rounded-2xl p-5 border border-slate-200">
                      <p className="text-[10px] font-black uppercase text-blue-600 mb-3 tracking-widest">{nomeB}</p>
                      <div className="space-y-1.5">
                        {atletasB.length === 0 ? <p className="text-slate-300 text-[10px] font-bold">Sem escalação disponível.</p> : 
                          atletasB.map(a => (
                            <div key={a.id} className="flex items-center justify-between bg-white p-2 rounded-lg border border-slate-100 text-xs font-bold">
                              <span className="text-slate-700 uppercase">{a.nome}</span>
                              <span className="text-blue-600 font-black">#{a.numero_camisa ?? '-'}</span>
                            </div>
                          ))
                        }
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>

        {/* FOOTER RC ENTERPRISE */}
        <footer className="mt-20 pt-10 border-t border-slate-200">
          {patrocinadoresRodape.length > 0 && (
            <div className="mb-12 text-center">
              <p className="text-[10px] font-black uppercase text-slate-400 tracking-[0.4em] mb-10 italic">Apoio Tecnológico e Realização</p>
              <div className="flex flex-wrap justify-center items-center gap-10 md:gap-16 opacity-60 grayscale hover:grayscale-0 transition-all duration-700">
                {patrocinadoresRodape.map(p => (
                  <a key={p.id} href={p.link_destino || '#'} target="_blank"><img src={p.banner_url} alt={p.nome_empresa} className="h-10 md:h-12 w-auto object-contain hover:scale-110 transition-transform" /></a>
                ))}
              </div>
            </div>
          )}

          <div className="pt-8 border-t border-slate-100 flex flex-col md:flex-row justify-between items-center gap-4">
            <p className="text-[10px] text-slate-400 font-mono uppercase tracking-widest font-bold">© 2026 GESTÃO ESPORTIVA INTEGRADA</p>
            <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-slate-500">
              <span>Súmula Digital por</span>
              <a href="https://wa.me/5547997037512" target="_blank" className="text-blue-600 flex items-center gap-2 group">
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