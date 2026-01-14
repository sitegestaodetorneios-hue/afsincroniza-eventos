'use client'
import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { ArrowLeft, Trophy, Info, Loader2, ChevronDown } from 'lucide-react'

export default function Tabela() {
  const [loading, setLoading] = useState(true)
  const [data, setData] = useState({ 
      etapa: null, 
      classificacao: [], 
      finais: [], 
      menu: [], 
      artilharia: [] 
  })
  const [filtroId, setFiltroId] = useState('')

  async function loadTabela(id = '', isBackground = false) {
    if (!isBackground) setLoading(true)
    try {
      const targetId = id || filtroId
      const url = targetId ? `/api/tabela?etapa_id=${targetId}` : '/api/tabela'
      
      const res = await fetch(url)
      if (!res.ok) throw new Error('Erro')
      
      const json = await res.json()
      setData(json)
      
      if (!targetId && json.etapa) setFiltroId(json.etapa.id)
    } catch (e) { 
        console.error(e) 
    } finally {
        if (!isBackground) setLoading(false)
    }
  }

  // Auto-refresh a cada 10s
  useEffect(() => {
    loadTabela(filtroId)
    const intervalo = setInterval(() => { loadTabela(filtroId, true) }, 10000)
    return () => clearInterval(intervalo)
  }, [filtroId])

  function handleTrocarEtapa(e) {
      const novoId = e.target.value
      setFiltroId(novoId)
  }

  const grupos = useMemo(() => {
    const lista = data.classificacao || []
    const gA = lista.filter(t => t.grupo === 'A')
    const gB = lista.filter(t => t.grupo === 'B')
    if (gB.length > 0) return { A: gA, B: gB, modo: 'DUPLO' }
    return { A: lista, modo: 'UNICO' }
  }, [data.classificacao])

  return (
    <main className="min-h-screen bg-slate-50 py-10 px-4 md:px-10 font-sans text-slate-800">
      <div className="max-w-7xl mx-auto">
        
        {/* HEADER */}
        <div className="flex flex-col md:flex-row justify-between items-center mb-8 gap-4">
          <div className="flex items-center gap-4 w-full md:w-auto">
              <Link href="/" className="flex items-center gap-2 text-slate-500 hover:text-blue-600 font-bold text-sm uppercase transition-colors">
                <ArrowLeft size={18} /> Início
              </Link>
              <div className="relative group">
                  <select 
                    value={filtroId} 
                    onChange={handleTrocarEtapa} 
                    className="appearance-none bg-white border-2 border-slate-200 text-slate-900 font-black text-sm uppercase py-2 pl-4 pr-10 rounded-xl cursor-pointer hover:border-blue-500 outline-none shadow-sm min-w-[200px]"
                    disabled={loading && !data.etapa}
                  >
                      {data.menu?.length > 0 ? (
                          data.menu.map(item => (
                              <option key={item.id} value={item.id}>{item.titulo} {item.status === 'EM_ANDAMENTO' ? '(Ao Vivo)' : ''}</option>
                          ))
                      ) : (
                          <option>Carregando...</option>
                      )}
                  </select>
                  <ChevronDown className="absolute right-3 top-2.5 text-slate-400 pointer-events-none" size={16}/>
              </div>
          </div>
          <div className="flex items-center gap-2 text-blue-600">
            {data.etapa?.status === 'EM_ANDAMENTO' && (
                <span className="flex h-3 w-3 relative mr-1">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500"></span>
                </span>
            )}
            <Trophy size={24} />
            <h1 className="text-2xl font-black uppercase italic tracking-tighter text-slate-900">Classificação</h1>
          </div>
        </div>

        {loading && !data.etapa ? <div className="text-center p-20 text-slate-400 font-bold"><Loader2 className="animate-spin mx-auto mb-2"/> Carregando...</div> : !data.etapa ? <div className="text-center p-20 text-slate-400 font-bold bg-white rounded-3xl border border-slate-200">Sem dados.</div> : (
            <>
                {/* INFO DA ETAPA */}
                <div className="bg-white border border-slate-200 rounded-2xl p-6 mb-8 flex flex-col md:flex-row gap-6 items-center shadow-sm">
                    <div className="flex-1">
                        <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Torneio Oficial</p>
                        <h2 className="text-2xl font-black text-slate-900">{data.etapa.titulo}</h2>
                        <p className="text-sm font-bold text-slate-500 mt-1 flex items-center gap-2">
                            <span className="bg-blue-100 text-blue-700 px-2 py-1 rounded text-xs uppercase">{data.etapa.modalidade}</span>
                            {data.etapa.status === 'EM_ANDAMENTO' && <span className="text-green-600 flex items-center gap-1 text-xs"><span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span> Em Andamento</span>}
                        </p>
                    </div>
                    <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 max-w-sm w-full text-xs text-slate-500">
                        <p className="font-bold mb-1 flex items-center gap-2"><Info size={14}/> Critérios de Desempate (FIFA)</p>
                        <ol className="list-decimal pl-4 space-y-1 text-[10px] uppercase font-medium text-slate-400">
                            <li>Pontos Ganhos</li>
                            <li>Saldo de Gols (SG)</li>
                            <li>Gols Pró (GP)</li>
                            <li>Menos Cartões (Fair Play)</li>
                        </ol>
                    </div>
                </div>

                <div className="grid lg:grid-cols-3 gap-8 mb-12">
                    {/* TABELAS LADO A LADO */}
                    <div className="lg:col-span-2">
                        {grupos.A.length > 0 ? (
                            <div className={`grid gap-6 ${grupos.modo === 'DUPLO' ? 'md:grid-cols-2' : 'grid-cols-1'}`}>
                                <TabelaCard titulo={grupos.modo === 'DUPLO' ? "Grupo A" : "Classificação Geral"} times={grupos.A} cor="blue" />
                                {grupos.modo === 'DUPLO' && <TabelaCard titulo="Grupo B" times={grupos.B} cor="yellow" />}
                            </div>
                        ) : (
                            <div className="bg-white p-10 rounded-3xl text-center border border-dashed border-slate-300 text-slate-400 font-bold">Aguardando início dos jogos.</div>
                        )}
                    </div>

                    {/* ARTILHARIA */}
                    <div className="lg:col-span-1">
                        <div className="bg-slate-900 text-white rounded-3xl p-6 shadow-xl border border-slate-800 h-full max-h-[600px] flex flex-col">
                            <h3 className="font-black uppercase tracking-widest text-sm mb-4 flex items-center gap-2 text-yellow-400 border-b border-white/10 pb-4"><Trophy size={16}/> Top Artilheiros</h3>
                            {data.artilharia?.length === 0 ? (
                                <div className="text-center py-10 text-slate-500"><p className="text-xs font-bold uppercase">Nenhum gol marcado.</p></div>
                            ) : (
                                <ul className="space-y-3 overflow-y-auto flex-1 pr-2 custom-scrollbar">
                                    {data.artilharia.map((atleta, i) => (
                                        <li key={i} className="flex justify-between items-center group p-2 rounded-lg hover:bg-white/5 transition-colors">
                                            <div className="flex items-center gap-3">
                                                <span className={`w-6 h-6 flex items-center justify-center rounded-full text-[10px] font-black ${i<3 ? 'bg-yellow-500 text-black shadow-lg shadow-yellow-500/20' : 'bg-slate-700 text-slate-300'}`}>{i+1}</span>
                                                <div><p className="font-bold text-sm leading-none group-hover:text-yellow-400 transition-colors">{atleta.nome}</p><p className="text-[10px] text-slate-400 uppercase mt-0.5 font-bold tracking-wider">{atleta.equipe}</p></div>
                                            </div>
                                            <div className="text-right"><span className="font-black text-xl">{atleta.gols}</span><span className="text-[8px] block text-slate-500 uppercase font-bold">Gols</span></div>
                                        </li>
                                    ))}
                                </ul>
                            )}
                        </div>
                    </div>
                </div>

                {/* FINAIS */}
                {data.finais?.length > 0 && (
                    <div className="mb-12 animate-in fade-in slide-in-from-bottom-8 duration-700">
                        <h2 className="text-xl font-black uppercase text-slate-900 mb-6 flex items-center gap-2"><Trophy className="text-yellow-500"/> Finais & Decisões</h2>
                        <div className="grid md:grid-cols-2 gap-6">
                            {data.finais.map(jogo => {
                                const hasPens = jogo.penaltis_a !== null && jogo.penaltis_b !== null
                                return (
                                    <div key={jogo.id} className="bg-white rounded-3xl p-6 border border-slate-200 shadow-lg relative overflow-hidden group hover:shadow-xl transition-all">
                                        <div className={`absolute top-0 left-0 w-full h-1 ${jogo.tipo_jogo === 'FINAL' ? 'bg-yellow-500' : 'bg-slate-300'}`}></div>
                                        <div className="text-center mb-6"><span className={`text-[10px] font-black uppercase tracking-widest px-3 py-1 rounded-full ${jogo.tipo_jogo === 'FINAL' ? 'bg-yellow-100 text-yellow-700' : 'bg-slate-100 text-slate-500'}`}>{jogo.tipo_jogo.replace(/_/g, ' ')}</span></div>
                                        <div className="flex justify-between items-center">
                                            <div className="text-center w-1/3"><p className="font-black text-slate-900 text-base md:text-lg leading-tight">{jogo.equipeA?.nome_equipe || 'A definir'}</p></div>
                                            <div className="text-center w-1/3 flex flex-col items-center">
                                                <div className="inline-flex items-center justify-center bg-slate-900 text-white rounded-xl px-4 py-2 font-black text-2xl shadow-lg mb-2">{jogo.gols_a ?? 0} <span className="mx-1 text-slate-500">:</span> {jogo.gols_b ?? 0}</div>
                                                {hasPens && <div className="text-[10px] font-bold text-slate-600 bg-slate-100 px-3 py-1 rounded-lg border border-slate-200">Pen: ({jogo.penaltis_a}) - ({jogo.penaltis_b})</div>}
                                                {jogo.status === 'EM_ANDAMENTO' && <p className="text-[9px] text-red-500 font-black mt-2 uppercase animate-pulse">● Ao Vivo</p>}
                                                {jogo.status === 'FINALIZADO' && <p className="text-[9px] text-slate-400 font-bold mt-2 uppercase">Encerrado</p>}
                                            </div>
                                            <div className="text-center w-1/3"><p className="font-black text-slate-900 text-base md:text-lg leading-tight">{jogo.equipeB?.nome_equipe || 'A definir'}</p></div>
                                        </div>
                                    </div>
                                )
                            })}
                        </div>
                    </div>
                )}
            </>
        )}
      </div>
    </main>
  )
}

function TabelaCard({ titulo, times, cor }) {
    return (
        <div className="bg-white rounded-3xl shadow-lg border border-slate-200 overflow-hidden flex flex-col h-full hover:shadow-xl transition-shadow duration-300">
            <div className={`p-4 text-center ${cor === 'blue' ? 'bg-blue-600' : 'bg-yellow-500'} text-white`}><h3 className="font-black uppercase tracking-widest text-sm">{titulo}</h3></div>
            <div className="overflow-x-auto flex-1">
                <table className="w-full text-left text-sm">
                    <thead>
                        <tr className="bg-slate-50 text-[10px] font-black uppercase text-slate-400 border-b border-slate-100">
                            <th className="p-3 text-center w-10">#</th><th className="p-3">Equipe</th><th className="p-3 text-center" title="Pontos">PTS</th><th className="p-3 text-center text-slate-400" title="Jogos">J</th><th className="p-3 text-center text-slate-400 hidden sm:table-cell" title="Vitórias">V</th><th className="p-3 text-center text-slate-400 hidden sm:table-cell" title="Saldo">SG</th>
                            <th className="p-3 text-center text-yellow-600 bg-yellow-50/30" title="Amarelos">CA</th><th className="p-3 text-center text-red-600 bg-red-50/30" title="Vermelhos">CV</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                        {times.map((time, i) => (
                            <tr key={time.equipe_id} className="hover:bg-slate-50 transition-colors group">
                                {/* CORREÇÃO AQUI: Top 2 sempre verdes (i < 2) */}
                                <td className={`p-3 text-center font-black ${i < 2 ? 'text-green-600' : 'text-slate-300'}`}>{i + 1}</td>
                                <td className="p-3 font-bold text-slate-700 truncate max-w-[140px] group-hover:text-blue-600 transition-colors">{time.nome_equipe}</td>
                                <td className="p-3 text-center font-black text-slate-900 text-base">{time.pts}</td>
                                <td className="p-3 text-center text-slate-400 font-medium">{time.j}</td>
                                <td className="p-3 text-center text-slate-400 font-medium hidden sm:table-cell">{time.v}</td>
                                <td className="p-3 text-center text-slate-400 font-medium hidden sm:table-cell">{time.gp - time.gc}</td>
                                <td className="p-3 text-center font-bold text-yellow-600 bg-yellow-50/30 text-xs">{time.ca || 0}</td>
                                <td className="p-3 text-center font-bold text-red-600 bg-red-50/30 text-xs">{time.cv || 0}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
            <div className="p-3 bg-slate-50 border-t border-slate-100 flex justify-center gap-4 text-[9px] font-bold uppercase text-slate-400">
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-green-500"></span> Classifica</span>
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-slate-300"></span> Eliminado</span>
            </div>
        </div>
    )
}