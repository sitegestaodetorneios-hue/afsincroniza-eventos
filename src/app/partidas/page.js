'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { ArrowLeft, Loader2, Calendar } from 'lucide-react'

async function safeJson(res) {
  try { return await res.json() } catch { return {} }
}

export default function Partidas() {
  const [loading, setLoading] = useState(true)
  const [data, setData] = useState({ jogos: [] })

  useEffect(() => {
    async function load() {
        try {
            const res = await fetch('/api/ao-vivo?t=' + Date.now()) 
            const json = await safeJson(res)
            setData(json)
        } finally { setLoading(false) }
    }
    load()
  }, [])

  const grupos = data.jogos ? data.jogos.reduce((acc, j) => {
      // Agrupa por tipo de jogo (ex: RODADA 1, FINAL, etc)
      const key = j.tipo_jogo === 'GRUPO' ? `RODADA ${j.rodada}` : j.tipo_jogo
      if(!acc[key]) acc[key] = []
      acc[key].push(j)
      return acc
  }, {}) : {}

  const equipeMap = new Map((data.equipes || []).map(e => [e.id, e.nome_equipe]))

  return (
    <main className="min-h-screen bg-slate-50 py-10 px-4 md:px-10">
      <div className="max-w-4xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <Link href="/" className="flex items-center gap-2 text-slate-500 hover:text-blue-600 font-bold text-sm uppercase transition-colors"><ArrowLeft size={18} /> Início</Link>
          <div className="flex items-center gap-2 text-blue-600"><Calendar size={24} /><h1 className="text-2xl font-black uppercase italic tracking-tighter text-slate-900">Todos os Jogos</h1></div>
        </div>

        {loading ? (
            <div className="text-center p-20"><Loader2 className="animate-spin mx-auto text-slate-400"/></div>
        ) : Object.keys(grupos).length === 0 ? (
            <div className="text-center p-20 text-slate-400 font-bold">Nenhum jogo encontrado.</div>
        ) : (
            <div className="space-y-8">
                {Object.entries(grupos).map(([titulo, jogos]) => (
                    <div key={titulo}>
                        <h3 className="font-black text-slate-900 uppercase tracking-widest mb-4 border-l-4 border-blue-500 pl-3 text-lg">{titulo.replace('_', ' ')}</h3>
                        <div className="grid gap-3">
                            {jogos.map(j => {
                                const nomeA = equipeMap.get(j.equipe_a_id)
                                const nomeB = equipeMap.get(j.equipe_b_id)
                                const dataFormatada = j.data_jogo ? new Date(j.data_jogo + 'T00:00:00').toLocaleDateString('pt-BR') : ''
                                const hora = j.horario ? String(j.horario).slice(0,5) : ''
                                
                                // Verifica se teve pênaltis
                                const hasPens = j.penaltis_a !== null && j.penaltis_b !== null
                                
                                return (
                                    <div key={j.id} className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col md:flex-row items-center justify-between gap-4">
                                        
                                        {/* DATA E HORA */}
                                        <div className="text-center md:text-left text-xs text-slate-400 font-bold w-full md:w-32">
                                            {dataFormatada} {hora && `• ${hora}`}
                                            {j.status === 'FINALIZADO' && <span className="block text-green-600 mt-1 uppercase text-[10px]">Finalizado</span>}
                                        </div>

                                        {/* PLACAR CENTRAl */}
                                        <div className="flex-1 flex flex-col items-center justify-center w-full">
                                            <div className="flex items-center justify-center gap-4 w-full">
                                                <span className="font-black text-slate-800 text-right w-1/3 truncate">{nomeA}</span>
                                                <div className="bg-slate-100 px-3 py-1 rounded-lg font-black text-slate-900 min-w-[60px] text-center border border-slate-200">
                                                    {j.gols_a ?? 0} x {j.gols_b ?? 0}
                                                </div>
                                                <span className="font-black text-slate-800 text-left w-1/3 truncate">{nomeB}</span>
                                            </div>
                                            
                                            {/* EXIBIÇÃO DOS PÊNALTIS (NOVO) */}
                                            {hasPens && (
                                                <span className="text-[10px] font-bold bg-yellow-100 text-yellow-800 px-2 py-0.5 rounded mt-2 border border-yellow-200">
                                                    Pen: {j.penaltis_a}-{j.penaltis_b}
                                                </span>
                                            )}
                                        </div>

                                        {/* ESPAÇO VAZIO P/ ALINHAMENTO */}
                                        <div className="w-full md:w-32 text-center md:text-right"></div>
                                    </div>
                                )
                            })}
                        </div>
                    </div>
                ))}
            </div>
        )}
      </div>
    </main>
  )
}