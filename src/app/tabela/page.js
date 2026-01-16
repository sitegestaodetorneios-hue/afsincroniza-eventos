'use client'
import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { ArrowLeft, Trophy, Info, Loader2, ChevronDown, Volume2, ShieldCheck, User } from 'lucide-react'

async function safeJson(res) {
  try { return await res.json() } catch { return {} }
}

export default function Tabela() {
  const [loading, setLoading] = useState(true)
  const [data, setData] = useState({ 
      etapa: null, 
      classificacao: [], 
      finais: [], 
      menu: [], 
      artilharia: [],
      defesa: [] 
  })
  const [filtroId, setFiltroId] = useState('')
  const [patrocinios, setPatrocinios] = useState([])
  const [indexCarrossel, setIndexCarrossel] = useState(0)

  async function loadTabela(id = '', isBackground = false) {
    if (!isBackground) setLoading(true)
    try {
      const targetId = id || filtroId
      const url = targetId ? `/api/tabela?etapa_id=${targetId}` : '/api/tabela'
      
      const [res, resPatro] = await Promise.all([
        fetch(url, { cache: 'no-store' }), 
        fetch('/api/admin/patrocinios', { cache: 'no-store' })
      ])

      if (!res.ok) throw new Error('Falha na resposta da API')
      
      const json = await res.json()
      const patroData = await resPatro.json().catch(() => [])
      
      setData({
        etapa: json?.etapa || null,
        classificacao: Array.isArray(json?.classificacao) ? json.classificacao : [],
        finais: Array.isArray(json?.finais) ? json.finais : [],
        menu: Array.isArray(json?.menu) ? json.menu : [],
        artilharia: Array.isArray(json?.artilharia) ? json.artilharia : [],
        defesa: Array.isArray(json?.defesa) ? json.defesa : []
      })
      
      setPatrocinios(Array.isArray(patroData) ? patroData : [])
      
      if (!targetId && json?.etapa?.id) setFiltroId(json.etapa.id)
    } catch (e) { 
        console.error("Erro Tabela:", e) 
    } finally {
        if (!isBackground) setLoading(false)
    }
  }

  useEffect(() => {
    loadTabela(filtroId)
    const intervalo = setInterval(() => { loadTabela(filtroId, true) }, 30000)
    return () => clearInterval(intervalo)
  }, [filtroId])

  useEffect(() => {
    const carrosselItems = patrocinios.filter(p => p.cota === 'CARROSSEL')
    if (carrosselItems.length > 1) {
      const interval = setInterval(() => {
        setIndexCarrossel(prev => (prev + 1) % carrosselItems.length)
      }, 5000)
      return () => clearInterval(interval)
    }
  }, [patrocinios])

  const patrocinadorMaster = useMemo(() => patrocinios.find(p => p.cota === 'MASTER'), [patrocinios])
  const patrocinadoresCarrossel = useMemo(() => patrocinios.filter(p => p.cota === 'CARROSSEL'), [patrocinios])
  const patrocinadoresRodape = useMemo(() => patrocinios.filter(p => p.cota === 'RODAPE'), [patrocinios])

  const grupos = useMemo(() => {
    const lista = data.classificacao || []
    const gA = lista.filter(t => t.grupo === 'A')
    const gB = lista.filter(t => t.grupo === 'B')
    if (gB.length > 0) return { A: gA, B: gB, modo: 'DUPLO' }
    return { A: lista, modo: 'UNICO' }
  }, [data.classificacao])

  if (loading && !data.etapa) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <Loader2 className="animate-spin text-blue-600" size={40} />
      </div>
    )
  }

  return (
    <main className="min-h-screen bg-slate-50 py-10 px-4 md:px-10 font-sans text-slate-800 pb-20">
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
                    onChange={(e) => setFiltroId(e.target.value)} 
                    className="appearance-none bg-white border-2 border-slate-200 text-slate-900 font-black text-sm uppercase py-2 pl-4 pr-10 rounded-xl cursor-pointer hover:border-blue-500 outline-none shadow-sm min-w-[200px]"
                    disabled={loading && !data.etapa}
                  >
                      {data.menu?.map(item => (
                        <option key={item.id} value={item.id}>{item.titulo} {item.status === 'EM_ANDAMENTO' ? '(Ao Vivo)' : ''}</option>
                      ))}
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

        {/* BANNER MASTER */}
        {patrocinadorMaster && (
          <div className="mb-10 rounded-3xl overflow-hidden shadow-xl border-4 border-white bg-slate-900 relative group animate-in fade-in duration-700">
            <a href={patrocinadorMaster.link_destino || '#'} target="_blank">
              {patrocinadorMaster.video_url ? (
                <div className="relative aspect-[4/1] md:aspect-[5/1] max-h-[220px] w-full">
                  <video src={patrocinadorMaster.video_url} autoPlay loop muted playsInline className="w-full h-full object-cover" />
                  <div className="absolute top-3 right-3 bg-black/40 backdrop-blur-sm p-1.5 rounded-full text-white/70"><Volume2 size={14}/></div>
                </div>
              ) : (
                <img src={patrocinadorMaster.banner_url} className="w-full h-auto max-h-[220px] object-cover transition-transform duration-1000 group-hover:scale-105" alt="Sponsor" />
              )}
            </a>
          </div>
        )}

        <div className="grid lg:grid-cols-4 gap-8">
            <div className="lg:col-span-3 space-y-8">
                {/* INFO ETAPA */}
                <div className="bg-white border border-slate-200 rounded-2xl p-6 flex flex-col md:flex-row gap-6 items-center shadow-sm">
                    <div className="flex-1">
                        <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Torneio Oficial</p>
                        <h2 className="text-2xl font-black text-slate-900">{data.etapa?.titulo}</h2>
                        <p className="text-sm font-bold text-slate-500 mt-1 italic uppercase">{data.etapa?.modalidade}</p>
                    </div>
                    <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 max-w-sm w-full text-[10px] uppercase font-bold text-slate-400">
                        <p className="font-bold mb-1 flex items-center gap-2 text-slate-500"><Info size={14}/> Critérios de Desempate (FIFA)</p>
                        <p>1. Pontos | 2. Saldo de Gols | 3. Gols Pró | 4. Cartões</p>
                    </div>
                </div>

                {/* TABELAS DE GRUPOS */}
                <div className={`grid gap-6 ${grupos.modo === 'DUPLO' ? 'md:grid-cols-2' : 'grid-cols-1'}`}>
                    <TabelaCard titulo={grupos.modo === 'DUPLO' ? "Grupo A" : "Classificação Geral"} times={grupos.A} cor="blue" />
                    {grupos.modo === 'DUPLO' && <TabelaCard titulo="Grupo B" times={grupos.B} cor="yellow" />}
                </div>

                {/* FINAIS */}
                {data.finais?.length > 0 && (
                  <div className="pt-8">
                      <h2 className="text-xl font-black uppercase text-slate-900 mb-6 flex items-center gap-2"><Trophy className="text-yellow-500"/> Finais & Decisões</h2>
                      <div className="grid md:grid-cols-2 gap-6">
                          {data.finais.map(jogo => (
                              <div key={jogo.id} className="bg-white rounded-3xl p-6 border border-slate-200 shadow-lg flex justify-between items-center group hover:border-blue-500 transition-colors">
                                  <span className="font-black text-sm w-1/3 text-right uppercase tracking-tighter">{jogo.equipeA?.nome_equipe}</span>
                                  <span className="bg-slate-900 text-white px-3 py-1 rounded-lg font-black mx-4 shadow-md">{jogo.gols_a ?? 0}:{jogo.gols_b ?? 0}</span>
                                  <span className="font-black text-sm w-1/3 text-left uppercase tracking-tighter">{jogo.equipeB?.nome_equipe}</span>
                              </div>
                          ))}
                      </div>
                  </div>
                )}
            </div>

            {/* BARRA LATERAL */}
            <div className="lg:col-span-1 space-y-8">
                {/* TOP ARTILHEIROS */}
                <div className="bg-slate-900 text-white rounded-3xl p-6 shadow-xl border border-slate-800">
                    <h3 className="font-black uppercase tracking-widest text-sm mb-6 flex items-center gap-2 text-yellow-400 border-b border-white/10 pb-4"><Trophy size={16}/> Artilharia</h3>
                    <ul className="space-y-4">
                        {data.artilharia?.map((atleta, i) => (
                            <li key={i} className="flex justify-between items-center group">
                                <div className="flex items-center gap-3">
                                    <span className={`w-6 h-6 flex items-center justify-center rounded-full text-[10px] font-black ${i<3 ? 'bg-yellow-500 text-black shadow-lg shadow-yellow-500/20' : 'bg-slate-700 text-slate-300'}`}>{i+1}</span>
                                    <div><p className="font-bold text-sm leading-none group-hover:text-yellow-400 transition-colors">{atleta.nome}</p><p className="text-[9px] text-slate-500 uppercase font-bold">{atleta.equipe}</p></div>
                                </div>
                                <span className="font-black text-lg text-yellow-400">{atleta.gols}</span>
                            </li>
                        ))}
                    </ul>
                </div>

                {/* MELHOR DEFESA */}
                <div className="bg-white text-slate-900 rounded-3xl p-6 shadow-xl border border-slate-200 relative overflow-hidden">
                    <div className="absolute top-0 right-0 p-4 opacity-5"><ShieldCheck size={80}/></div>
                    <h3 className="font-black uppercase tracking-widest text-sm mb-6 flex items-center gap-2 text-blue-600 border-b border-slate-100 pb-4"><ShieldCheck size={16}/> Melhor Defesa</h3>
                    <ul className="space-y-4">
                        {data.defesa?.map((time, i) => (
                            <li key={i} className="flex justify-between items-center">
                                <div className="flex items-center gap-3">
                                    <span className="text-slate-300 font-black text-xs">#{i+1}</span>
                                    <div><p className="font-bold text-sm leading-none uppercase tracking-tighter">{time.nome_equipe}</p><p className="text-[9px] text-slate-400 uppercase font-bold">Média: {(time.gc / (time.j || 1)).toFixed(2)}</p></div>
                                </div>
                                <div className="text-right"><span className="font-black text-lg text-blue-600">{time.gc}</span><p className="text-[8px] font-black text-slate-400 uppercase">Gols C.</p></div>
                            </li>
                        ))}
                    </ul>
                </div>

                {/* CARROSSEL LATERAL */}
                {patrocinadoresCarrossel.length > 0 && (
                    <div className="animate-in fade-in duration-700">
                        <a href={patrocinadoresCarrossel[indexCarrossel].link_destino || '#'} target="_blank" className="block rounded-2xl border border-slate-200 overflow-hidden shadow-md group">
                            <img src={patrocinadoresCarrossel[indexCarrossel].banner_url} className="w-full h-32 object-cover transition-transform group-hover:scale-105" alt="Sponsor" />
                        </a>
                    </div>
                )}
            </div>
        </div>

        {/* RODAPÉ */}
        <footer className="mt-20 pt-10 border-t border-slate-200">
          {patrocinadoresRodape.length > 0 && (
            <div className="mb-12 text-center">
              <p className="text-[10px] font-black uppercase text-slate-400 tracking-[0.4em] mb-10">Apoio Institucional</p>
              <div className="flex flex-wrap justify-center items-center gap-12 opacity-60 grayscale hover:grayscale-0 transition-all duration-700">
                {patrocinadoresRodape.map(p => (
                  <a key={p.id} href={p.link_destino || '#'} target="_blank">
                    <img src={p.banner_url} alt={p.nome_empresa} className="h-10 md:h-14 w-auto object-contain hover:scale-110 transition-transform" />
                  </a>
                ))}
              </div>
            </div>
          )}
          <div className="pt-8 border-t border-slate-100 flex flex-col md:flex-row justify-between items-center gap-4">
            <p className="text-[10px] text-slate-400 font-mono uppercase tracking-widest font-bold">© 2026 GESTÃO ESPORTIVA PREMIUM</p>
            <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-slate-500">
              <span>Tecnologia por</span>
              <a href="https://wa.me/5547997037512" target="_blank" className="text-blue-500 flex items-center gap-2 group font-black">
                <span className="tracking-tighter border-b-2 border-blue-500/10 group-hover:border-blue-500 transition-all">RC ENTERPRISE</span>
                <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse"></div>
              </a>
            </div>
          </div>
        </footer>
      </div>
    </main>
  )
}

// ✅ COMPONENTE TABELACARD CORRIGIDO (PADRÃO FIFA)
function TabelaCard({ titulo, times, cor }) {
    return (
        <div className="bg-white rounded-3xl shadow-lg border border-slate-200 overflow-hidden flex flex-col h-full hover:shadow-xl transition-shadow duration-300">
            <div className={`p-4 text-center ${cor === 'blue' ? 'bg-blue-600' : 'bg-yellow-500'} text-white`}><h3 className="font-black uppercase tracking-widest text-sm italic">{titulo}</h3></div>
            <div className="overflow-x-auto flex-1">
                <table className="w-full text-left text-sm">
                    <thead>
                        <tr className="bg-slate-50 text-[10px] font-black uppercase text-slate-400 border-b border-slate-100">
                            <th className="p-3 text-center w-10">#</th>
                            <th className="p-3">Equipe</th>
                            <th className="p-3 text-center text-slate-900" title="Pontos">PTS</th>
                            <th className="p-3 text-center text-slate-400" title="Jogos">J</th>
                            <th className="p-3 text-center text-slate-400 hidden sm:table-cell" title="Vitórias">V</th>
                            {/* ✅ SALDO DE GOLS (SG) REINSERIDO AQUI */}
                            <th className="p-3 text-center text-slate-700 font-bold" title="Saldo de Gols">SG</th>
                            <th className="p-3 text-center text-red-500 bg-red-50/20 font-black" title="Gols Contra (Goleiro)">GC</th>
                            <th className="p-3 text-center text-yellow-600 bg-yellow-50/30" title="Cartões Amarelos">CA</th>
                            <th className="p-3 text-center text-red-700 bg-red-100/30" title="Cartões Vermelhos">CV</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                        {times.map((time, i) => {
                            // ✅ CÁLCULO SG NA HORA
                            const saldo = (time.gp || 0) - (time.gc || 0)
                            return (
                                <tr key={time.equipe_id || i} className="hover:bg-slate-50 transition-colors group">
                                    <td className={`p-3 text-center font-black ${i < 2 ? 'text-green-600' : 'text-slate-300'}`}>{i + 1}</td>
                                    <td className="p-3 font-bold text-slate-700 uppercase tracking-tighter truncate max-w-[120px] group-hover:text-blue-600 transition-colors">{time.nome_equipe}</td>
                                    <td className="p-3 text-center font-black text-slate-900 text-base">{time.pts}</td>
                                    <td className="p-3 text-center text-slate-400 font-medium">{time.j}</td>
                                    <td className="p-3 text-center text-slate-400 font-medium hidden sm:table-cell">{time.v}</td>
                                    {/* ✅ DADO SG */}
                                    <td className="p-3 text-center font-bold text-slate-600">{saldo}</td>
                                    <td className="p-3 text-center text-red-400 font-bold bg-red-50/10">{time.gc || 0}</td>
                                    <td className="p-3 text-center font-bold text-yellow-600 bg-yellow-50/10">{time.ca || 0}</td>
                                    <td className="p-3 text-center font-bold text-red-700 bg-red-100/10">{time.cv || 0}</td>
                                </tr>
                            )
                        })}
                    </tbody>
                </table>
            </div>
            {/* ✅ LEGENDA COMPLETA */}
            <div className="p-3 bg-slate-50 border-t border-slate-100 flex flex-wrap justify-center gap-4 text-[8px] font-bold uppercase text-slate-400">
                <span>SG: Saldo Gols</span>
                <span>GC: Gols Contra</span>
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-yellow-500"></span> CA: Amarelo</span>
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-red-600"></span> CV: Vermelho</span>
            </div>
        </div>
    )
}