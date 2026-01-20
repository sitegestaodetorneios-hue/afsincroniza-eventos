'use client'
import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { ArrowLeft, Trophy, Info, Loader2, ChevronDown, Volume2, ShieldCheck } from 'lucide-react'

function escudo(u) {
  return (u && String(u).length > 5) ? u : ''
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
      const url = targetId ? `/api/tabela?etapa_id=${targetId}` : `/api/tabela`

      const [res, resPatro] = await Promise.all([
        fetch(url),
        fetch('/api/admin/patrocinios')
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

      if (!targetId && json?.etapa?.id) setFiltroId(String(json.etapa.id))
    } catch (e) {
      console.error('Erro Tabela:', e)
    } finally {
      if (!isBackground) setLoading(false)
    }
  }

  useEffect(() => {
    loadTabela(filtroId)
    const intervalo = setInterval(() => {
      loadTabela(filtroId, true)
    }, 30000)
    return () => clearInterval(intervalo)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filtroId])

  useEffect(() => {
    const carrosselItems = patrocinios.filter(p => p.cota === 'CARROSSEL')
    if (carrosselItems.length > 1) {
      const interval = setInterval(() => {
        setIndexCarrossel(prev => (prev + 1) % carrosselItems.length)
      }, 5000)
      return () => clearInterval(interval)
    } else {
      setIndexCarrossel(0)
    }
  }, [patrocinios])

  const patrocinadorMaster = useMemo(
    () => patrocinios.find(p => p.cota === 'MASTER' && (p.banner_url || p.video_url)) || null,
    [patrocinios]
  )
  const patrocinadoresCarrossel = useMemo(
    () => patrocinios.filter(p => p.cota === 'CARROSSEL' && p.banner_url),
    [patrocinios]
  )
  const patrocinadoresRodape = useMemo(
    () => patrocinios.filter(p => p.cota === 'RODAPE' && p.banner_url),
    [patrocinios]
  )

  const gruposList = useMemo(() => {
    const lista = data.classificacao || []
    if (lista.length === 0) return []
    const gruposObj = {}
    lista.forEach(time => {
      const letra = (time.grupo || 'U').toUpperCase().trim()
      if (!gruposObj[letra]) gruposObj[letra] = []
      gruposObj[letra].push(time)
    })
    const letrasOrdenadas = Object.keys(gruposObj).sort()
    return letrasOrdenadas.map(letra => ({
      letra,
      titulo:
        (letra === 'U' || (letrasOrdenadas.length === 1 && letra === 'A'))
          ? 'Classificação Geral'
          : `Grupo ${letra}`,
      times: gruposObj[letra]
    }))
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
            <Link
              href="/"
              className="flex items-center gap-2 text-slate-500 hover:text-blue-600 font-bold text-sm uppercase transition-colors"
            >
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
                  <option key={item.id} value={item.id}>
                    {item.titulo} {item.status === 'EM_ANDAMENTO' ? '(Ao Vivo)' : ''}
                  </option>
                ))}
              </select>
              <ChevronDown className="absolute right-3 top-2.5 text-slate-400 pointer-events-none" size={16} />
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
            <a
              href={patrocinadorMaster.link_destino || '#'}
              target="_blank"
              rel="noopener noreferrer"
            >
              {patrocinadorMaster.video_url ? (
                <div className="relative aspect-[4/1] md:aspect-[5/1] max-h-[220px] w-full">
                  <video
                    src={patrocinadorMaster.video_url}
                    autoPlay
                    loop
                    muted
                    playsInline
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute top-3 right-3 bg-black/40 backdrop-blur-sm p-1.5 rounded-full text-white/70">
                    <Volume2 size={14} />
                  </div>
                </div>
              ) : (
                <img
                  src={patrocinadorMaster.banner_url}
                  className="w-full h-auto max-h-[220px] object-cover transition-transform duration-1000 group-hover:scale-105"
                  alt="Sponsor"
                />
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
                <p className="font-bold mb-1 flex items-center gap-2 text-slate-500">
                  <Info size={14} /> Critérios de Desempate (FIFA)
                </p>
                <p>1. Pontos | 2. Saldo de Gols | 3. Gols Pró | 4. Cartões</p>
              </div>
            </div>

            {/* ✅ TABELAS DINÂMICAS */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {gruposList.map((g, idx) => (
                <TabelaCard
                  key={g.titulo}
                  titulo={g.titulo}
                  times={g.times}
                  cor={idx % 2 === 0 ? 'blue' : 'yellow'}
                />
              ))}
            </div>

            {/* ✅ FINAIS E MATA-MATA */}
            {data.finais?.length > 0 && (
              <div className="pt-8">
                <h2 className="text-xl font-black uppercase text-slate-900 mb-6 flex items-center gap-2">
                  <Trophy className="text-yellow-500" /> Finais & Decisões
                </h2>
                <div className="grid md:grid-cols-2 gap-6">
                  {data.finais.map(jogo => {
                    const tipo = jogo.tipo_jogo?.toUpperCase() || ''
                    const obs = jogo.obs_publica?.toUpperCase() || ''
                    const isFinal = tipo === 'FINAL' || (obs.includes('FINAL') && !obs.includes('SEMI') && !obs.includes('3º'))
                    const gA = Number(jogo.gols_a || 0)
                    const gB = Number(jogo.gols_b || 0)
                    const pA = jogo.penaltis_a
                    const pB = jogo.penaltis_b
                    const isEncerrado = jogo.finalizado || jogo.status === 'FINALIZADO'

                    let vencedor = null
                    if (isFinal && isEncerrado) {
                      if (gA > gB) vencedor = 'A'
                      else if (gB > gA) vencedor = 'B'
                      else if (pA !== null && pB !== null) {
                        if (Number(pA) > Number(pB)) vencedor = 'A'
                        else if (Number(pB) > Number(pA)) vencedor = 'B'
                      }
                    }

                    const escA = escudo(jogo.equipeA?.escudo_url)
                    const escB = escudo(jogo.equipeB?.escudo_url)

                    return (
                      <div
                        key={jogo.id}
                        className={`bg-white rounded-3xl p-6 border shadow-lg flex justify-between items-center group transition-all ${
                          vencedor ? 'border-yellow-400 shadow-yellow-100 ring-1 ring-yellow-400' : 'border-slate-200 hover:border-blue-500'
                        }`}
                      >
                        <div className={`w-1/3 flex items-center justify-end gap-2 ${vencedor === 'A' ? 'text-yellow-600' : 'text-slate-800'}`}>
                          {vencedor === 'A' && (
                            <Trophy size={16} className="text-yellow-500 fill-yellow-500 animate-bounce flex-shrink-0" />
                          )}
                          <span className="font-black text-sm uppercase tracking-tighter truncate text-right" title={jogo.equipeA?.nome_equipe}>
                            {jogo.equipeA?.nome_equipe}
                          </span>
                          {escA ? (
                            <img src={escA} alt="" className="h-8 w-8 rounded-lg border border-slate-200 bg-white object-cover flex-shrink-0" loading="lazy" />
                          ) : (
                            <div className="h-8 w-8 rounded-lg bg-slate-100 border border-slate-200 flex-shrink-0" />
                          )}
                        </div>

                        <div className="flex flex-col items-center justify-center w-1/3 px-1">
                          <span
                            className={`bg-slate-900 text-white px-3 py-1 rounded-lg font-black shadow-md whitespace-nowrap text-lg ${
                              vencedor ? 'bg-gradient-to-r from-yellow-500 to-amber-500' : ''
                            }`}
                          >
                            {jogo.gols_a ?? 0} : {jogo.gols_b ?? 0}
                          </span>

                          {(jogo.penaltis_a !== null && jogo.penaltis_b !== null) && (
                            <div className="mt-2 flex flex-col items-center animate-in fade-in">
                              <span className="text-[10px] font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded border border-slate-200">Pênaltis</span>
                              <span className="text-[10px] font-black text-slate-700 mt-0.5">({jogo.penaltis_a} - {jogo.penaltis_b})</span>
                            </div>
                          )}

                          <span className="text-[9px] font-bold text-slate-300 mt-2 uppercase text-center leading-tight">
                            {jogo.obs_publica || jogo.tipo_jogo}
                          </span>
                        </div>

                        <div className={`w-1/3 flex items-center justify-start gap-2 ${vencedor === 'B' ? 'text-yellow-600' : 'text-slate-800'}`}>
                          {escB ? (
                            <img src={escB} alt="" className="h-8 w-8 rounded-lg border border-slate-200 bg-white object-cover flex-shrink-0" loading="lazy" />
                          ) : (
                            <div className="h-8 w-8 rounded-lg bg-slate-100 border border-slate-200 flex-shrink-0" />
                          )}
                          <span className="font-black text-sm uppercase tracking-tighter truncate text-left" title={jogo.equipeB?.nome_equipe}>
                            {jogo.equipeB?.nome_equipe}
                          </span>
                          {vencedor === 'B' && (
                            <Trophy size={16} className="text-yellow-500 fill-yellow-500 animate-bounce flex-shrink-0" />
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}
          </div>

          {/* BARRA LATERAL */}
          <div className="lg:col-span-1 space-y-8">
            <div className="bg-slate-900 text-white rounded-3xl p-6 shadow-xl border border-slate-800">
              <h3 className="font-black uppercase tracking-widest text-sm mb-6 flex items-center gap-2 text-yellow-400 border-b border-white/10 pb-4">
                <Trophy size={16} /> Artilharia
              </h3>
              <ul className="space-y-4">
                {data.artilharia?.map((atleta, i) => (
                  <li key={i} className="flex justify-between items-center group">
                    <div className="flex items-center gap-3">
                      <span
                        className={`w-6 h-6 flex items-center justify-center rounded-full text-[10px] font-black ${
                          i < 3 ? 'bg-yellow-500 text-black shadow-lg shadow-yellow-500/20' : 'bg-slate-700 text-slate-300'
                        }`}
                      >
                        {i + 1}
                      </span>
                      <div>
                        <p className="font-bold text-sm leading-none group-hover:text-yellow-400 transition-colors">{atleta.nome}</p>
                        <p className="text-[9px] text-slate-500 uppercase font-bold">{atleta.equipe}</p>
                      </div>
                    </div>
                    <span className="font-black text-lg text-yellow-400">{atleta.gols}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="bg-white text-slate-900 rounded-3xl p-6 shadow-xl border border-slate-200 relative overflow-hidden">
              <div className="absolute top-0 right-0 p-4 opacity-5"><ShieldCheck size={80} /></div>
              <h3 className="font-black uppercase tracking-widest text-sm mb-6 flex items-center gap-2 text-blue-600 border-b border-slate-100 pb-4">
                <ShieldCheck size={16} /> Melhor Defesa
              </h3>
              <ul className="space-y-4">
                {data.defesa?.map((time, i) => {
                  const logo = escudo(time.escudo_url)
                  return (
                    <li key={i} className="flex justify-between items-center">
                      <div className="flex items-center gap-3">
                        <span className="text-slate-300 font-black text-xs">#{i + 1}</span>

                        {logo ? (
                          <img src={logo} alt="" className="h-7 w-7 rounded-lg border border-slate-200 bg-white object-cover" loading="lazy" />
                        ) : (
                          <div className="h-7 w-7 rounded-lg bg-slate-100 border border-slate-200" />
                        )}

                        <div>
                          <p className="font-bold text-sm leading-none uppercase tracking-tighter">{time.nome_equipe}</p>
                          <p className="text-[9px] text-slate-400 uppercase font-bold">
                            Média: {(time.gc / (time.j || 1)).toFixed(2)}
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <span className="font-black text-lg text-blue-600">{time.gc}</span>
                        <p className="text-[8px] font-black text-slate-400 uppercase">Gols C.</p>
                      </div>
                    </li>
                  )
                })}
              </ul>
            </div>

            {patrocinadoresCarrossel.length > 0 && (
              <div className="animate-in fade-in duration-700">
                <a
                  href={patrocinadoresCarrossel[indexCarrossel].link_destino || '#'}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block rounded-2xl border border-slate-200 overflow-hidden shadow-md group"
                >
                  <img
                    src={patrocinadoresCarrossel[indexCarrossel].banner_url}
                    className="w-full h-32 object-cover transition-transform group-hover:scale-105"
                    alt="Sponsor"
                  />
                </a>
              </div>
            )}
          </div>
        </div>

        {/* RODAPÉ */}
        <footer className="mt-20 pt-10 border-t border-slate-200">
          {patrocinadoresRodape.length > 0 && (
            <>
              <div className="text-center mb-8">
                <p className="text-[10px] font-black uppercase tracking-[0.35em] text-slate-500">
                  Parceiros Oficiais
                </p>
                <p className="text-[10px] font-bold text-slate-400 mt-1">
                  Clique para conhecer os patrocinadores
                </p>
              </div>

              <div className="mb-10 flex flex-wrap justify-center items-center gap-8 md:gap-12">
                {patrocinadoresRodape.map(p => (
                  <a
                    key={p.id}
                    href={p.link_destino || '#'}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="group"
                  >
                    <div className="bg-white border border-slate-200 rounded-2xl px-5 py-4 shadow-sm hover:shadow-xl hover:border-blue-300 transition-all duration-300">
                      <img
                        src={p.banner_url}
                        alt={p.nome_empresa || 'Parceiro'}
                        className="h-10 md:h-14 w-auto object-contain transition-transform duration-300 group-hover:scale-110"
                      />
                    </div>
                  </a>
                ))}
              </div>
            </>
          )}

          <div className="pt-8 border-t border-slate-100 flex flex-col md:flex-row justify-between items-center gap-4">
            <p className="text-[10px] text-slate-400 font-mono uppercase tracking-widest font-bold">
              © 2026 GESTÃO ESPORTIVA PREMIUM
            </p>
            <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-slate-500">
              <span>Tecnologia por</span>
              <a
                href="https://wa.me/5547997037512"
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-500 flex items-center gap-2 group font-black"
              >
                <span className="tracking-tighter border-b-2 border-blue-500/10 group-hover:border-blue-500 transition-all">
                  RC ENTERPRISE
                </span>
                <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse shadow-[0_0_8px_#22c55e]"></div>
              </a>
            </div>
          </div>
        </footer>
      </div>
    </main>
  )
}

function TabelaCard({ titulo, times, cor }) {
  return (
    <div className="bg-white rounded-3xl shadow-lg border border-slate-200 overflow-hidden flex flex-col h-full hover:shadow-xl transition-shadow duration-300">
      <div className={`p-4 text-center ${cor === 'blue' ? 'bg-blue-600' : 'bg-yellow-500'} text-white`}>
        <h3 className="font-black uppercase tracking-widest text-sm italic">{titulo}</h3>
      </div>
      <div className="overflow-x-auto flex-1">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="bg-slate-50 text-[10px] font-black uppercase text-slate-400 border-b border-slate-100">
              <th className="p-3 text-center w-10">#</th>
              <th className="p-3">Equipe</th>
              <th className="p-3 text-center text-slate-900" title="Pontos">PTS</th>
              <th className="p-3 text-center text-slate-400" title="Jogos">J</th>
              <th className="p-3 text-center text-slate-700 font-bold" title="Saldo de Gols">SG</th>
              <th className="p-3 text-center text-red-500 bg-red-50/20 font-black" title="Gols Contra">GC</th>
              <th className="p-3 text-center text-yellow-600" title="Amarelos">CA</th>
              <th className="p-3 text-center text-red-700" title="Vermelhos">CV</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {times.map((time, i) => {
              const saldo = time.sg !== undefined ? time.sg : (time.gp || 0) - (time.gc || 0)
              const logo = escudo(time.escudo_url)

              return (
                <tr key={time.equipe_id || i} className="hover:bg-slate-50 transition-colors group">
                  <td className={`p-3 text-center font-black ${i < 4 ? 'text-green-600' : 'text-slate-300'}`}>{i + 1}</td>

                  <td className="p-3">
                    <div className="flex items-center gap-2 min-w-0">
                      {logo ? (
                        <img
                          src={logo}
                          alt=""
                          className="h-7 w-7 rounded-lg border border-slate-200 bg-white object-cover flex-shrink-0"
                          loading="lazy"
                        />
                      ) : (
                        <div className="h-7 w-7 rounded-lg bg-slate-100 border border-slate-200 flex-shrink-0" />
                      )}

                      <span className="font-bold text-slate-700 uppercase tracking-tighter truncate group-hover:text-blue-600 transition-colors">
                        {time.nome_equipe}
                      </span>
                    </div>
                  </td>

                  <td className="p-3 text-center font-black text-slate-900 text-base">{time.pts}</td>
                  <td className="p-3 text-center text-slate-400 font-medium">{time.j}</td>
                  <td className="p-3 text-center font-bold text-slate-600">{saldo}</td>
                  <td className="p-3 text-center text-red-400 font-bold bg-red-50/10">{time.gc || 0}</td>
                  <td className="p-3 text-center font-bold text-yellow-600">{time.ca || 0}</td>
                  <td className="p-3 text-center font-bold text-red-700">{time.cv || 0}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
