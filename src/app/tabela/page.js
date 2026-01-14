'use client'
import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { ArrowLeft, Trophy, Info, Loader2, ChevronDown } from 'lucide-react'

export default function Tabela() {
  const [loading, setLoading] = useState(true)
  const [data, setData] = useState({ etapa: null, classificacao: [], finais: [], menu: [] })
  const [filtroId, setFiltroId] = useState('') // ID da etapa selecionada manualmente

  // Carrega dados (com filtro se houver)
  async function loadTabela(id = '') {
    setLoading(true)
    try {
      // Se tiver ID selecionado, manda na URL. Se não, a API decide a atual.
      const url = id ? `/api/tabela?etapa_id=${id}` : '/api/tabela'
      const res = await fetch(url)
      const json = await res.json()
      setData(json)
      // Se não tinha filtro, seta o ID que veio da API para o select ficar certo
      if (!id && json.etapa) setFiltroId(json.etapa.id)
    } catch (e) { console.error(e) }
    setLoading(false)
  }

  // Carga inicial
  useEffect(() => {
    loadTabela()
  }, [])

  // Quando troca o select
  function handleTrocarEtapa(e) {
      const novoId = e.target.value
      setFiltroId(novoId)
      loadTabela(novoId)
  }

  const grupos = useMemo(() => {
    const lista = data.classificacao || []
    const gA = lista.filter(t => t.grupo === 'A')
    const gB = lista.filter(t => t.grupo === 'B')
    if (gB.length > 0) return { A: gA, B: gB, modo: 'DUPLO' }
    return { A: lista, modo: 'UNICO' }
  }, [data.classificacao])

  return (
    <main className="min-h-screen bg-slate-50 py-10 px-4 md:px-10">
      <div className="max-w-6xl mx-auto">
        
        {/* HEADER COM SELETOR DE ETAPA */}
        <div className="flex flex-col md:flex-row justify-between items-center mb-8 gap-4">
          <div className="flex items-center gap-4 w-full md:w-auto">
              <Link href="/" className="flex items-center gap-2 text-slate-500 hover:text-blue-600 font-bold text-sm uppercase transition-colors">
                <ArrowLeft size={18} /> Início
              </Link>
              
              {/* SELETOR DE CAMPEONATO/ETAPA */}
              <div className="relative group">
                  <select 
                    value={filtroId} 
                    onChange={handleTrocarEtapa}
                    className="appearance-none bg-white border-2 border-slate-200 text-slate-900 font-black text-sm uppercase py-2 pl-4 pr-10 rounded-xl cursor-pointer hover:border-blue-500 outline-none shadow-sm min-w-[200px]"
                  >
                      {data.menu.map(item => (
                          <option key={item.id} value={item.id}>
                              {item.titulo} {item.status === 'EM_ANDAMENTO' ? '(Ao Vivo)' : ''}
                          </option>
                      ))}
                  </select>
                  <ChevronDown className="absolute right-3 top-2.5 text-slate-400 pointer-events-none" size={16}/>
              </div>
          </div>

          <div className="flex items-center gap-2 text-blue-600">
            <Trophy size={24} />
            <h1 className="text-2xl font-black uppercase italic tracking-tighter text-slate-900">Classificação</h1>
          </div>
        </div>

        {loading ? (
            <div className="text-center p-20 text-slate-400 font-bold"><Loader2 className="animate-spin mx-auto mb-2"/> Carregando dados...</div>
        ) : !data.etapa ? (
            <div className="text-center p-20 text-slate-400 font-bold">Nenhuma etapa encontrada.</div>
        ) : (
            <>
                {/* INFO DA ETAPA ATUAL */}
                <div className="bg-white border border-slate-200 rounded-2xl p-6 mb-8 flex flex-col md:flex-row gap-6 items-center shadow-sm animate-in fade-in slide-in-from-bottom-2">
                    <div className="flex-1">
                        <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Vendo dados de:</p>
                        <h2 className="text-2xl font-black text-slate-900">{data.etapa.titulo}</h2>
                        <p className="text-sm font-bold text-slate-500 mt-1 flex items-center gap-2">
                            <span className="bg-blue-100 text-blue-700 px-2 py-1 rounded text-xs uppercase">{data.etapa.modalidade}</span>
                            {data.etapa.status === 'EM_ANDAMENTO' ? 
                                <span className="text-green-600 flex items-center gap-1 text-xs"><span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span> Fase Atual</span> :
                                <span className="text-slate-400 text-xs bg-slate-100 px-2 py-1 rounded">Fase Encerrada</span>
                            }
                        </p>
                    </div>
                    <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 max-w-sm w-full">
                        <div className="flex items-start gap-3"><Info className="text-slate-400 mt-1" size={16}/><div><p className="font-bold text-slate-700 text-sm">Regulamento</p><p className="text-xs text-slate-500 mt-1">1º de cada grupo vai direto para a Grande Final. Os 2º colocados disputam o 3º lugar.</p></div></div>
                    </div>
                </div>

                {/* TABELAS (SÓ APARECE SE TIVER CLASSIFICAÇÃO) */}
                {grupos.A.length > 0 && (
                    <div className={`grid gap-8 ${grupos.modo === 'DUPLO' ? 'lg:grid-cols-2' : ''} mb-12 animate-in fade-in slide-in-from-bottom-4`}>
                        <TabelaCard titulo={grupos.modo === 'DUPLO' ? "Grupo A" : "Classificação Geral"} times={grupos.A} cor="blue" />
                        {grupos.modo === 'DUPLO' && <TabelaCard titulo="Grupo B" times={grupos.B} cor="yellow" />}
                    </div>
                )}

                {/* SEÇÃO MATA-MATA / FINAIS */}
                {data.finais && data.finais.length > 0 && (
                    <div className="animate-in fade-in slide-in-from-bottom-8 duration-700">
                        <h2 className="text-xl font-black uppercase text-slate-900 mb-6 flex items-center gap-2"><Trophy className="text-yellow-500"/> Jogos Decisivos</h2>
                        <div className="grid md:grid-cols-2 gap-6">
                            {data.finais.map(jogo => {
                                const hasPens = jogo.penaltis_a !== null && jogo.penaltis_b !== null
                                return (
                                    <div key={jogo.id} className="bg-white rounded-3xl p-6 border border-slate-200 shadow-lg relative overflow-hidden">
                                        <div className={`absolute top-0 left-0 w-full h-1 ${jogo.tipo_jogo === 'FINAL' ? 'bg-yellow-500' : 'bg-slate-300'}`}></div>
                                        <div className="text-center mb-6"><span className={`text-[10px] font-black uppercase tracking-widest px-3 py-1 rounded-full ${jogo.tipo_jogo === 'FINAL' ? 'bg-yellow-100 text-yellow-700' : 'bg-slate-100 text-slate-500'}`}>{jogo.tipo_jogo.replace('_', ' ')}</span></div>
                                        <div className="flex justify-between items-center">
                                            <div className="text-center w-1/3"><p className="font-black text-slate-900 text-lg leading-tight">{jogo.equipeA?.nome_equipe || 'A definir'}</p></div>
                                            <div className="text-center w-1/3 flex flex-col items-center">
                                                <div className="inline-flex items-center justify-center bg-slate-900 text-white rounded-xl px-4 py-2 font-black text-2xl shadow-lg">{jogo.gols_a ?? 0} <span className="mx-1 text-slate-500">:</span> {jogo.gols_b ?? 0}</div>
                                                {hasPens && <div className="mt-2 text-[10px] font-bold text-slate-500 bg-slate-100 px-3 py-1 rounded-lg border border-slate-200">Pen: ({jogo.penaltis_a}) - ({jogo.penaltis_b})</div>}
                                                {jogo.status === 'EM_ANDAMENTO' && <p className="text-[10px] text-green-600 font-bold mt-2 uppercase animate-pulse">● Em Jogo</p>}
                                                {jogo.status === 'FINALIZADO' && <p className="text-[10px] text-slate-400 font-bold mt-2 uppercase">Encerrado</p>}
                                            </div>
                                            <div className="text-center w-1/3"><p className="font-black text-slate-900 text-lg leading-tight">{jogo.equipeB?.nome_equipe || 'A definir'}</p></div>
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
    const bgHighlight = cor === 'blue' ? 'bg-blue-50' : 'bg-yellow-50';
    return (
        <div className="bg-white rounded-3xl shadow-lg border border-slate-200 overflow-hidden flex flex-col h-full">
            <div className="bg-slate-900 text-white p-4 text-center"><h3 className="font-black uppercase tracking-widest text-sm">{titulo}</h3></div>
            <div className="overflow-x-auto flex-1">
                <table className="w-full text-left text-sm">
                    <thead>
                        <tr className="bg-slate-50 text-[10px] font-black uppercase text-slate-400 border-b border-slate-100">
                            <th className="p-3 text-center w-10">#</th><th className="p-3">Equipe</th><th className="p-3 text-center">PTS</th><th className="p-3 text-center text-slate-300">J</th><th className="p-3 text-center text-slate-300 hidden sm:table-cell">V</th><th className="p-3 text-center text-slate-300 hidden sm:table-cell">SG</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                        {times.length === 0 ? (
                            <tr><td colSpan="6" className="p-6 text-center text-slate-400 text-xs font-bold">Aguardando sorteio...</td></tr>
                        ) : times.map((time, i) => (
                            <tr key={time.equipe_id} className={`hover:bg-slate-50 transition-colors ${i === 0 ? bgHighlight : ''}`}>
                                <td className="p-3 text-center font-black text-slate-300">{i + 1}</td>
                                <td className="p-3 font-bold text-slate-700 truncate max-w-[120px]">{time.nome_equipe}</td>
                                <td className="p-3 text-center font-black text-slate-900 text-base">{time.pts}</td>
                                <td className="p-3 text-center text-slate-400 font-medium">{time.j}</td>
                                <td className="p-3 text-center text-slate-400 font-medium hidden sm:table-cell">{time.v}</td>
                                <td className="p-3 text-center text-slate-400 font-medium hidden sm:table-cell">{time.gp - time.gc}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
            {times.length > 0 && (<div className="p-3 bg-slate-50 border-t border-slate-100 text-center"><p className="text-[10px] font-bold uppercase text-slate-400 flex items-center justify-center gap-2"><span className={`w-2 h-2 rounded-full ${cor === 'blue' ? 'bg-blue-500' : 'bg-yellow-500'}`}></span> 1º Lugar avança</p></div>)}
        </div>
    )
}