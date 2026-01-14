'use client'
import { useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { ArrowLeft, Trophy, Info, Loader2, RefreshCcw } from 'lucide-react'

async function safeJson(res) {
  try {
    return await res.json()
  } catch {
    const txt = await res.text().catch(() => '')
    return { error: txt || `Erro ${res.status}` }
  }
}

export default function Tabela() {
  const [siteData, setSiteData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [payload, setPayload] = useState(null)
  const [lastUpdate, setLastUpdate] = useState(null)

  const mountedRef = useRef(true)

  useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
    }
  }, [])

  useEffect(() => {
    fetch('/api/config', { cache: 'no-store' })
      .then((r) => safeJson(r))
      .then((d) => {
        if (!mountedRef.current) return
        setSiteData(d && typeof d === 'object' ? d : {})
      })
      .catch(() => setSiteData({}))
  }, [])

  async function loadTabela(silent = false) {
    if (!silent) setLoading(true)

    try {
      const res = await fetch('/api/tabela', { cache: 'no-store' })
      const data = await safeJson(res)

      if (!mountedRef.current) return

      if (!res.ok) {
        console.error('Erro /api/tabela:', data)
        setPayload({ etapa: null, classificacao: [], vagas_grande_final: 1, error: data?.error || 'Erro' })
      } else {
        setPayload(data)
      }

      setLastUpdate(new Date())
    } catch (e) {
      console.error(e)
      if (!mountedRef.current) return
      setPayload({ etapa: null, classificacao: [], vagas_grande_final: 1, error: 'Falha de conexão' })
    } finally {
      if (!mountedRef.current) return
      if (!silent) setLoading(false)
    }
  }

  useEffect(() => {
    loadTabela(false)
    // refresh leve
    const t = setInterval(() => loadTabela(true), 8000)
    return () => clearInterval(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const competencia = useMemo(
    () => siteData?.nome_competicao || 'Taça Pérolas do Vale do Itajaí',
    [siteData]
  )
  const empresa = useMemo(
    () => siteData?.nome_empresa || 'A&F Sincroniza Eventos Esportivos',
    [siteData]
  )

  const etapa = payload?.etapa
  const classificacao = Array.isArray(payload?.classificacao) ? payload.classificacao : []
  const vagas = Number(payload?.vagas_grande_final || 1)
  const erro = payload?.error

  return (
    <main className="min-h-screen bg-slate-50 py-10 px-4 md:px-10">
      <div className="max-w-5xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <Link
            href="/"
            className="flex items-center gap-2 text-slate-500 hover:text-blue-600 font-bold text-sm uppercase transition-colors"
          >
            <ArrowLeft size={18} /> Voltar
          </Link>

          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 text-blue-600">
              <Trophy size={24} />
              <h1 className="text-2xl font-black uppercase italic tracking-tighter text-slate-900">
                Classificação
              </h1>
            </div>

            <button
              onClick={() => loadTabela(false)}
              className="hidden md:inline-flex items-center gap-2 text-xs font-black uppercase tracking-widest px-4 py-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50"
              title="Atualizar agora"
            >
              <RefreshCcw size={14} /> Atualizar
            </button>
          </div>
        </div>

        <div className="mb-6 bg-white border border-slate-200 rounded-2xl p-5 flex flex-col md:flex-row gap-4 md:items-center md:justify-between">
          <div>
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">{competencia}</p>
            <p className="text-slate-900 font-black text-lg">{empresa}</p>

            {etapa ? (
              <p className="text-slate-500 text-sm font-bold mt-1">
                {etapa.modalidade} • {etapa.titulo} • Status: {etapa.status}
              </p>
            ) : (
              <p className="text-slate-500 text-sm font-bold mt-1">
                Nenhuma etapa cadastrada ainda.
              </p>
            )}

            <p className="text-[10px] font-bold uppercase text-slate-400 mt-2">
              {lastUpdate ? `Última atualização: ${lastUpdate.toLocaleTimeString()}` : 'Atualizando…'}
            </p>

            {erro ? (
              <p className="mt-2 text-xs font-black uppercase text-red-600">
                Erro: {erro}
              </p>
            ) : null}
          </div>

          <div className="flex items-start gap-3 bg-amber-50 border border-amber-100 rounded-2xl p-4 max-w-xl">
            <Info className="text-amber-600 mt-0.5" size={18} />
            <div>
              <p className="text-slate-900 font-black text-sm">
                Formato: 6 times • todos contra todos
              </p>
              <p className="text-slate-600 text-xs font-medium">
                Quem fizer mais pontos garante vaga na <b>Grande Final</b> (data e local a definir).
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-3xl shadow-xl overflow-hidden border border-slate-200">
          {loading ? (
            <div className="p-12 flex items-center justify-center gap-3 text-slate-400 font-bold">
              <Loader2 className="animate-spin" /> Carregando tabela…
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-900 text-white text-[10px] font-black uppercase tracking-widest">
                    <th className="p-5 text-center w-16">Pos</th>
                    <th className="p-5">Equipe</th>
                    <th className="p-5 text-center">PTS</th>
                    <th className="p-5 text-center hidden md:table-cell">J</th>
                    <th className="p-5 text-center hidden md:table-cell">V</th>
                    <th className="p-5 text-center hidden md:table-cell">E</th>
                    <th className="p-5 text-center hidden md:table-cell">D</th>
                    <th className="p-5 text-center hidden md:table-cell">SG</th>
                    <th className="p-5 text-center">Status</th>
                  </tr>
                </thead>

                <tbody>
                  {classificacao.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="p-10 text-center text-slate-400 font-bold">
                        Sem dados ainda (cadastre as 6 equipes da etapa e/ou finalize jogos).
                      </td>
                    </tr>
                  ) : (
                    classificacao.map((row, idx) => {
                      const classificado = idx < vagas
                      return (
                        <tr
                          key={row.equipe_id ?? `${row.nome_equipe}-${idx}`}
                          className={`border-b border-slate-100 transition-colors font-bold text-slate-700 ${
                            classificado ? 'bg-green-50 hover:bg-green-100' : 'hover:bg-blue-50'
                          }`}
                        >
                          <td className="p-5 text-center">
                            <span
                              className={`inline-block w-8 h-8 leading-8 rounded-full text-xs ${
                                classificado
                                  ? 'bg-green-100 text-green-700'
                                  : 'bg-slate-100 text-slate-500'
                              }`}
                            >
                              {row.pos ?? idx + 1}º
                            </span>
                          </td>

                          <td className="p-5">{row.nome_equipe}</td>
                          <td className="p-5 text-center font-black text-slate-900">{row.pts ?? 0}</td>

                          <td className="p-5 text-center hidden md:table-cell text-slate-400">{row.j ?? 0}</td>
                          <td className="p-5 text-center hidden md:table-cell text-slate-400">{row.v ?? 0}</td>
                          <td className="p-5 text-center hidden md:table-cell text-slate-400">{row.e ?? 0}</td>
                          <td className="p-5 text-center hidden md:table-cell text-slate-400">{row.d ?? 0}</td>
                          <td className="p-5 text-center hidden md:table-cell text-slate-400">{row.sg ?? 0}</td>

                          <td className="p-5 text-center">
                            {classificado ? (
                              <span className="text-[10px] bg-green-100 text-green-700 px-3 py-1 rounded-full font-black uppercase">
                                Classificado
                              </span>
                            ) : (
                              <span className="text-[10px] bg-slate-100 text-slate-500 px-3 py-1 rounded-full font-black uppercase">
                                Em disputa
                              </span>
                            )}
                          </td>
                        </tr>
                      )
                    })
                  )}
                </tbody>
              </table>
            </div>
          )}

          <div className="bg-slate-50 p-4 border-t border-slate-200">
            <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">
              Critérios: Pontos → Vitórias → Saldo de Gols → Gols Pró → Nome (ordem alfabética).
            </p>
          </div>
        </div>
      </div>
    </main>
  )
}
