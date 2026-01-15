'use client'
import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { ArrowLeft, Loader2, Calendar, Trophy, Volume2, Clock } from 'lucide-react'

async function safeJson(res) {
  try { return await res.json() } catch { return {} }
}

export default function Partidas() {
  const [loading, setLoading] = useState(true)
  const [data, setData] = useState({ jogos: [], equipes: [] })
  const [patrocinios, setPatrocinios] = useState([])
  const [indexCarrossel, setIndexCarrossel] = useState(0)

  async function loadData() {
    try {
        const [res, resPatro] = await Promise.all([
          fetch('/api/ao-vivo?t=' + Date.now()),
          fetch('/api/admin/patrocinios')
        ])
        
        const json = await safeJson(res)
        const patroData = await resPatro.json().catch(() => [])
        
        setData(json)
        setPatrocinios(Array.isArray(patroData) ? patroData : [])
    } catch(e) {
        console.error(e)
    } finally { 
        setLoading(false) 
    }
  }

  useEffect(() => {
    loadData()
    const intervalo = setInterval(loadData, 30000)
    return () => clearInterval(intervalo)
  }, [])

  useEffect(() => {
    const carrosselItems = patrocinios.filter(p => p.cota === 'CARROSSEL')
    if (carrosselItems.length > 1) {
      const interval = setInterval(() => {
        setIndexCarrossel(prev => (prev + 1) % carrosselItems.length)
      }, 6000)
      return () => clearInterval(interval)
    }
  }, [patrocinios])

  const patrocinadorMaster = useMemo(() => patrocinios.find(p => p.cota === 'MASTER'), [patrocinios])
  const patrocinadoresCarrossel = useMemo(() => patrocinios.filter(p => p.cota === 'CARROSSEL'), [patrocinios])
  const patrocinadoresRodape = useMemo(() => patrocinios.filter(p => p.cota === 'RODAPE'), [patrocinios])

  const grupos = data.jogos ? data.jogos.reduce((acc, j) => {
      const key = j.tipo_jogo === 'GRUPO' ? `RODADA ${j.rodada}` : j.tipo_jogo
      if(!acc[key]) acc[key] = []
      acc[key].push(j)
      return acc
  }, {}) : {}

  const equipeMap = new Map((data.equipes || []).map(e => [e.id, e.nome_equipe]))

  return (
    <main className="min-h-screen bg-slate-50 py-10 px-4 md:px-10 font-sans">
      <div className="max-w-4xl mx-auto">
        
        <div className="flex justify-between items-center mb-8">
          <Link href="/" className="flex items-center gap-2 text-slate-500 hover:text-blue-600 font-bold text-sm uppercase transition-colors">
            <ArrowLeft size={18} /> Início
          </Link>
          <div className="flex items-center gap-2 text-blue-600">
            <Calendar size={24} />
            <h1 className="text-2xl font-black uppercase italic tracking-tighter text-slate-900">Calendário de Jogos</h1>
          </div>
        </div>

        {patrocinadorMaster && (
          <div className="mb-10 rounded-[2rem] overflow-hidden shadow-2xl border-4 border-white bg-slate-900 relative group animate-in fade-in zoom-in duration-700">
            <a href={patrocinadorMaster.link_destino || '#'} target="_blank">
              {patrocinadorMaster.video_url ? (
                <div className="relative aspect-[16/5] md:aspect-[21/6] w-full">
                  <video src={patrocinadorMaster.video_url} autoPlay loop muted playsInline className="w-full h-full object-cover" />
                  <div className="absolute top-4 right-4 bg-black/40 backdrop-blur-md p-1.5 rounded-full text-white/80"><Volume2 size={14}/></div>
                </div>
              ) : (
                <img src={patrocinadorMaster.banner_url} className="w-full h-auto object-cover transition-transform duration-1000 group-hover:scale-105" alt="Master Sponsor" />
              )}
            </a>
          </div>
        )}

        {loading ? (
            <div className="text-center p-20"><Loader2 className="animate-spin mx-auto text-blue-600" size={40}/></div>
        ) : Object.keys(grupos).length === 0 ? (
            <div className="text-center p-20 text-slate-400 font-bold bg-white rounded-3xl border border-dashed border-slate-300">Nenhum jogo agendado.</div>
        ) : (
            <div className="space-y-12">
                {Object.entries(grupos).map(([titulo, jogos], index) => (
                    <div key={titulo} className="animate-in fade-in slide-in-from-bottom-4 duration-500">
                        {index === 1 && patrocinadoresCarrossel.length > 0 && (
                          <div className="mb-8 rounded-2xl overflow-hidden border border-slate-200 shadow-sm">
                            <a href={patrocinadoresCarrossel[indexCarrossel].link_destino || '#'} target="_blank" className="relative block h-20 md:h-24">
                              <img src={patrocinadoresCarrossel[indexCarrossel].banner_url} className="w-full h-full object-cover" alt="Parceiro" />
                            </a>
                          </div>
                        )}
                        <h3 className="font-black text-slate-900 uppercase tracking-[0.2em] mb-6 flex items-center gap-3 text-sm md:text-base">
                            <span className="w-10 h-1 bg-blue-600 rounded-full"></span>
                            {titulo.replace(/_/g, ' ')}
                        </h3>
                        <div className="grid gap-4">
                            {jogos.map(j => (
                                <div key={j.id} className={`bg-white p-5 rounded-2xl border transition-all shadow-sm flex flex-col md:flex-row items-center justify-between gap-4 border-slate-200 ${j.status === 'EM_ANDAMENTO' ? 'ring-2 ring-red-500' : ''}`}>
                                    <div className="flex md:flex-col items-center md:items-start gap-3 md:gap-1 w-full md:w-32">
                                        <div className="text-[11px] font-black text-slate-400 uppercase tracking-tighter flex items-center gap-1"><Calendar size={12}/> {j.data_jogo ? new Date(j.data_jogo + 'T00:00:00').toLocaleDateString('pt-BR', {day:'2-digit', month:'2-digit'}) : '--/--'}</div>
                                        <div className="text-[11px] font-black text-blue-600 uppercase tracking-tighter flex items-center gap-1"><Clock size={12}/> {j.horario ? String(j.horario).slice(0,5) : '--:--'}</div>
                                    </div>
                                    <div className="flex-1 flex flex-col items-center w-full px-4">
                                        <div className="flex items-center justify-between w-full gap-2">
                                            <span className="font-black text-slate-800 text-xs md:text-sm text-right flex-1 truncate">{equipeMap.get(j.equipe_a_id) || 'A definir'}</span>
                                            <div className="flex items-center justify-center gap-2 px-4 py-1.5 rounded-xl font-black text-lg md:text-xl min-w-[80px] bg-slate-50 border border-slate-200">
                                                <span>{j.gols_a ?? 0}</span><span className="text-slate-400 text-xs font-light">×</span><span>{j.gols_b ?? 0}</span>
                                            </div>
                                            <span className="font-black text-slate-800 text-xs md:text-sm text-left flex-1 truncate">{equipeMap.get(j.equipe_b_id) || 'B definir'}</span>
                                        </div>
                                    </div>
                                    <div className="w-full md:w-32 flex justify-center md:justify-end">
                                        <Link href="/ao-vivo" className="text-[10px] font-black uppercase text-blue-600 border border-blue-600 px-4 py-2 rounded-xl hover:bg-blue-600 hover:text-white transition-all">Ver Detalhes</Link>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                ))}
            </div>
        )}

        <footer className="mt-20 pt-10 border-t border-slate-200">
          {patrocinadoresRodape.length > 0 && (
            <div className="mb-12 text-center">
              <h4 className="text-[10px] font-black uppercase text-slate-400 tracking-[0.4em] mb-8">Parceiros e Realização</h4>
              <div className="flex flex-wrap justify-center items-center gap-12 opacity-60 grayscale hover:grayscale-0 transition-all">
                {patrocinadoresRodape.map(p => (
                  <a key={p.id} href={p.link_destino || '#'} target="_blank"><img src={p.banner_url} alt={p.nome_empresa} className="h-8 md:h-12 w-auto object-contain" /></a>
                ))}
              </div>
            </div>
          )}

          {/* CRÉDITOS DO DESENVOLVEDOR - RC ENTERPRISE */}
          <div className="pt-8 border-t border-slate-100 flex flex-col md:flex-row justify-between items-center gap-4">
            <p className="text-[10px] text-slate-400 font-mono uppercase tracking-widest">© 2026 GESTÃO ESPORTIVA</p>
            <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-slate-500">
              <span>Desenvolvido por</span>
              <a href="https://wa.me/5547997037512?text=Olá Ronaldo! Gostaria de um orçamento para um sistema esportivo." target="_blank" className="text-blue-500 hover:text-blue-400 transition-colors flex items-center gap-1.5 group" title="RONALDO CESCON ENTERPRISE - ME">
                <span className="border-b border-blue-500/30 group-hover:border-blue-400 tracking-tighter">RC ENTERPRISE</span>
                <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse"></div>
              </a>
            </div>
          </div>
        </footer>
      </div>
    </main>
  )
}