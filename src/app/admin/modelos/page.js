'use client'

import React, { useEffect, useState } from 'react'
import Link from 'next/link'
import {
  ArrowLeft, Plus, Trash2, Save, PenTool,
  LayoutTemplate, Shield, Wand2, Calculator, Trophy, Info
} from 'lucide-react'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
)

export default function GestorModelos() {
  const [pin, setPin] = useState('')
  const [authed, setAutenticado] = useState(false)
  const [loading, setLoading] = useState(false)

  const [modelos, setModelos] = useState([])
  const [editMode, setEditMode] = useState(false)

  const defaultModelo = {
    nome: '',
    descricao: '',
    regras: { vitoria: 3, empate: 1, cartao_amarelo: -1, cartao_vermelho: -3, criterio_desempate: 'FIFA' },
    estrutura: []
  }

  const [novoModelo, setNovoModelo] = useState(defaultModelo)

  // CONFIGURAÇÃO LIVRE DO WIZARD
  const [configGrupos, setConfigGrupos] = useState({
    qtdGrupos: 2,
    classificamPorGrupo: 2,
    tipoCruzamento: 'GERAL',     // GERAL é mais seguro para formatos malucos
    modoFinal: 'ARVORE'          // ✅ NOVO: ARVORE (mata-mata) OU FINAL_DIRETA (final+3º sem semi)
  })

  function auth() {
    if (pin === '2026') setAutenticado(true)
    else alert('PIN Inválido')
  }

  useEffect(() => { if (authed) carregarModelos() }, [authed])

  async function carregarModelos() {
    setLoading(true)
    const { data } = await supabase
      .from('modelos_campeonato')
      .select('*')
      .order('id', { ascending: false })
    setModelos(data || [])
    setLoading(false)
  }

  // --- GERADOR DE FLUXO INTELIGENTE ---
  function gerarFluxoCompleto() {
    const { qtdGrupos, classificamPorGrupo, tipoCruzamento, modoFinal } = configGrupos

    const totalClassificados = qtdGrupos * classificamPorGrupo
    let estrutura = []

    // ✅ MODO ESPECIAL: FINAL DIRETA + 3º LUGAR (SEM SEMIFINAL)
    // Exemplo clássico: 2 grupos, passam 2 por grupo.
    // 1ºA x 1ºB = FINAL
    // 2ºA x 2ºB = 3º/4º
    if (modoFinal === 'FINAL_DIRETA') {
      // Regra de ouro: precisa ter no mínimo 2 grupos e 2 classificados por grupo
      if (qtdGrupos !== 2 || classificamPorGrupo < 2) {
        alert('FINAL DIRETA funciona para: 2 grupos e pelo menos 2 classificados por grupo. Ex.: 2 grupos / passam 2.')
        return
      }

      // Disputa de 3º
      estrutura.push({
        fase: 'TERCEIRO',
        obs: '2º A x 2º B (Disputa 3º/4º)',
        ruleA: 'RANKING|A:1',
        ruleB: 'RANKING|B:1'
      })

      // Final
      estrutura.push({
        fase: 'FINAL',
        obs: '1º A x 1º B (Final)',
        ruleA: 'RANKING|A:0',
        ruleB: 'RANKING|B:0'
      })

      setNovoModelo(prev => ({
        ...prev,
        estrutura,
        descricao: `Gerado: FINAL DIRETA (sem semifinal) — ${qtdGrupos} grupos, passam ${classificamPorGrupo}. Final: 1ºA x 1ºB | 3º: 2ºA x 2ºB.`
      }))
      return
    }

    // --- MODO PADRÃO: ARVORE (mata-mata) ---
    // 1. Define Nome da Fase Inicial baseada no Total
    let nomeFase = 'MATA-MATA'
    if (totalClassificados > 32) nomeFase = '32_AVOS' // 64 times
    else if (totalClassificados > 16) nomeFase = '16_AVOS' // 32 times
    else if (totalClassificados > 8) nomeFase = 'OITAVAS' // 16 times
    else if (totalClassificados > 4) nomeFase = 'QUARTAS' // 8 times
    else if (totalClassificados > 2) nomeFase = 'SEMI' // 4 times
    else nomeFase = 'FINAL' // 2 times

    // Arredonda para cima se for impar (cria um slot a mais que ficará vazio/bye)
    const qtdJogosIniciais = Math.ceil(totalClassificados / 2)

    // 2. Gerar a 1ª Rodada (Conectando aos Grupos ou Geral)
    for (let i = 0; i < qtdJogosIniciais; i++) {
      let ruleA, ruleB, obs

      // MODO 1: RANKING GERAL (Cobra / Padrão)
      if (tipoCruzamento === 'GERAL') {
        ruleA = `RANKING_GERAL:${i}`

        const indiceOponente = totalClassificados - 1 - i
        ruleB = `RANKING_GERAL:${indiceOponente}`

        obs = `${i + 1}º Melhor Geral x ${i + 1}º Pior Geral`
      }

      // MODO 2: OLÍMPICO (A x B, C x D...)
      else {
        const letras = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H']

        const parGrupo = Math.floor(i / classificamPorGrupo)
        const indexNoConfronto = i % classificamPorGrupo

        const g1 = letras[parGrupo * 2] || '?'
        const g2 = letras[(parGrupo * 2) + 1] || '?'

        ruleA = `RANKING|${g1}:${indexNoConfronto}`
        ruleB = `RANKING|${g2}:${classificamPorGrupo - 1 - indexNoConfronto}`

        obs = `${indexNoConfronto + 1}º ${g1} x ${classificamPorGrupo - indexNoConfronto}º ${g2}`
      }

      estrutura.push({ fase: nomeFase, obs, ruleA, ruleB })
    }

    // 3. Gerar o Resto da Árvore Automaticamente
    let jogosNivelAnterior = qtdJogosIniciais
    let indexOffset = 0

    while (jogosNivelAnterior > 1) {
      const proxQtd = Math.ceil(jogosNivelAnterior / 2)
      let proxFase = ''

      // Nomes baseados em qtd de jogos no próximo nível
      if (jogosNivelAnterior === 16) proxFase = 'OITAVAS'
      else if (jogosNivelAnterior === 8) proxFase = 'QUARTAS'
      else if (jogosNivelAnterior === 4) proxFase = 'SEMI'
      else proxFase = 'FINAL'

      for (let k = 0; k < proxQtd; k++) {
        const idJogo1 = indexOffset + (k * 2)
        const idJogo2 = indexOffset + (k * 2) + 1

        estrutura.push({
          fase: proxFase,
          obs: `Vencedor Jogo ${idJogo1 + 1} x Vencedor Jogo ${idJogo2 + 1}`,
          ruleA: `JOGO_VENC|INDEX:${idJogo1}`,
          ruleB: `JOGO_VENC|INDEX:${idJogo2}`
        })
      }

      indexOffset += jogosNivelAnterior
      jogosNivelAnterior = proxQtd
    }

    setNovoModelo(prev => ({
      ...prev,
      estrutura,
      descricao: `Gerado Automático (Árvore): ${qtdGrupos} grupos, passam ${classificamPorGrupo}. Total ${totalClassificados} times.`
    }))
  }

  async function salvarModelo() {
    if (!novoModelo.nome) return alert('Dê um nome para o modelo')
    setLoading(true)
    const { error } = await supabase.from('modelos_campeonato').insert(novoModelo)
    if (error) alert('Erro: ' + error.message)
    else {
      alert('Modelo salvo!')
      setEditMode(false)
      carregarModelos()
    }
    setLoading(false)
  }

  async function apagarModelo(id) {
    if (confirm('Apagar?')) {
      await supabase.from('modelos_campeonato').delete().eq('id', id)
      carregarModelos()
    }
  }

  if (!authed) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="bg-slate-900 p-8 rounded-2xl text-center">
          <h1 className="text-white font-black mb-4">EDITOR MODELOS</h1>
          <input
            type="password"
            value={pin}
            onChange={e => setPin(e.target.value)}
            className="bg-black text-white p-3 rounded mb-4 w-full text-center"
          />
          <button onClick={auth} className="bg-blue-600 w-full p-3 rounded font-bold text-white">ENTRAR</button>
        </div>
      </div>
    )
  }

  return (
    <main className="min-h-screen bg-slate-50 text-slate-900 p-4 md:p-8">
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center gap-4 mb-8">
          <Link href="/admin" className="bg-white p-3 rounded-full shadow hover:scale-105"><ArrowLeft /></Link>
          <div>
            <h1 className="text-3xl font-black uppercase text-slate-800 flex items-center gap-2">
              <PenTool className="text-blue-600" /> Fábrica de Modelos
            </h1>
            <p className="text-slate-500 font-bold">Crie qualquer formato. Sem limites.</p>
          </div>
        </div>

        {!editMode ? (
          <div className="grid lg:grid-cols-3 gap-6">
            <button
              onClick={() => { setNovoModelo(defaultModelo); setEditMode(true) }}
              className="bg-blue-600 hover:bg-blue-500 text-white rounded-2xl p-8 flex flex-col items-center justify-center gap-4 shadow-xl transition-transform hover:scale-[1.02]"
            >
              <Plus size={48} className="opacity-50" />
              <span className="font-black uppercase text-lg">Criar Novo Modelo</span>
            </button>

            {modelos.map(m => (
              <div key={m.id} className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm relative group">
                <h3 className="font-black text-lg text-slate-800 mb-1">{m.nome}</h3>
                <p className="text-xs text-slate-500 mb-4 h-10 overflow-hidden">{m.descricao}</p>
                <div className="bg-slate-50 p-2 rounded text-[10px] font-mono text-slate-600">
                  <strong>{m.estrutura?.length || 0} Jogos no fluxo</strong>
                </div>
                <button onClick={() => apagarModelo(m.id)} className="absolute top-4 right-4 text-slate-200 hover:text-red-500">
                  <Trash2 size={18} />
                </button>
              </div>
            ))}
          </div>
        ) : (
          <div className="grid lg:grid-cols-12 gap-8 animate-in fade-in">

            {/* COLUNA 1: DADOS */}
            <div className="lg:col-span-4 space-y-6">
              <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
                <h2 className="text-xs font-black uppercase mb-4 text-slate-400 flex items-center gap-2">
                  <LayoutTemplate size={14} /> Identificação
                </h2>
                <div className="space-y-3">
                  <input
                    className="w-full bg-slate-50 border border-slate-200 p-3 rounded-xl text-sm font-bold"
                    placeholder="Nome (Ex: Super Copa 32)"
                    value={novoModelo.nome}
                    onChange={e => setNovoModelo({ ...novoModelo, nome: e.target.value })}
                  />
                  <textarea
                    className="w-full bg-slate-50 border border-slate-200 p-3 rounded-xl text-xs font-bold"
                    placeholder="Descrição..."
                    value={novoModelo.descricao}
                    onChange={e => setNovoModelo({ ...novoModelo, descricao: e.target.value })}
                  />
                </div>
              </div>

              <div className="bg-slate-900 text-white p-6 rounded-3xl shadow-lg">
                <h2 className="text-xs font-black uppercase mb-4 text-yellow-500 flex items-center gap-2">
                  <Shield size={14} /> Regras FIFA
                </h2>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-[9px] uppercase font-bold text-slate-400">Vitória</label>
                    <input
                      type="number"
                      className="w-full bg-slate-800 border-slate-700 p-2 rounded font-bold text-center"
                      value={novoModelo.regras.vitoria}
                      onChange={e => setNovoModelo({ ...novoModelo, regras: { ...novoModelo.regras, vitoria: Number(e.target.value) } })}
                    />
                  </div>
                  <div>
                    <label className="text-[9px] uppercase font-bold text-slate-400">Empate</label>
                    <input
                      type="number"
                      className="w-full bg-slate-800 border-slate-700 p-2 rounded font-bold text-center"
                      value={novoModelo.regras.empate}
                      onChange={e => setNovoModelo({ ...novoModelo, regras: { ...novoModelo.regras, empate: Number(e.target.value) } })}
                    />
                  </div>
                  <div>
                    <label className="text-[9px] uppercase font-bold text-slate-400">Amarelo</label>
                    <input
                      type="number"
                      className="w-full bg-slate-800 border-slate-700 p-2 rounded text-red-300 font-bold text-center"
                      value={novoModelo.regras.cartao_amarelo}
                      onChange={e => setNovoModelo({ ...novoModelo, regras: { ...novoModelo.regras, cartao_amarelo: Number(e.target.value) } })}
                    />
                  </div>
                  <div>
                    <label className="text-[9px] uppercase font-bold text-slate-400">Vermelho</label>
                    <input
                      type="number"
                      className="w-full bg-slate-800 border-slate-700 p-2 rounded text-red-500 font-bold text-center"
                      value={novoModelo.regras.cartao_vermelho}
                      onChange={e => setNovoModelo({ ...novoModelo, regras: { ...novoModelo.regras, cartao_vermelho: Number(e.target.value) } })}
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* COLUNA 2: GERADOR LIVRE */}
            <div className="lg:col-span-8 flex flex-col h-full">
              <div className="bg-white border border-slate-200 rounded-3xl p-6 flex-1 flex flex-col shadow-xl">

                <div className="bg-indigo-50 p-5 rounded-2xl border border-indigo-100 mb-6">
                  <h2 className="text-sm font-black uppercase text-indigo-800 flex items-center gap-2 mb-3">
                    <Calculator size={16} /> Calculadora de Fases
                  </h2>

                  <div className="grid grid-cols-1 md:grid-cols-5 gap-4 items-end">
                    <div>
                      <label className="text-[10px] font-bold text-indigo-400 uppercase">Qtd Grupos</label>
                      <input
                        type="number"
                        min="1"
                        className="w-full p-2.5 rounded-lg border border-indigo-200 font-bold text-lg bg-white text-center"
                        value={configGrupos.qtdGrupos}
                        onChange={e => setConfigGrupos({ ...configGrupos, qtdGrupos: Number(e.target.value) })}
                      />
                    </div>

                    <div>
                      <label className="text-[10px] font-bold text-indigo-400 uppercase">Classificam</label>
                      <input
                        type="number"
                        min="1"
                        className="w-full p-2.5 rounded-lg border border-indigo-200 font-bold text-lg bg-white text-center"
                        value={configGrupos.classificamPorGrupo}
                        onChange={e => setConfigGrupos({ ...configGrupos, classificamPorGrupo: Number(e.target.value) })}
                      />
                    </div>

                    <div>
                      <label className="text-[10px] font-bold text-indigo-400 uppercase">Formato Final</label>
                      <select
                        className="w-full p-2.5 rounded-lg border border-indigo-200 font-bold text-xs bg-white"
                        value={configGrupos.modoFinal}
                        onChange={e => setConfigGrupos({ ...configGrupos, modoFinal: e.target.value })}
                      >
                        <option value="ARVORE">Árvore (mata-mata)</option>
                        <option value="FINAL_DIRETA">Final Direta + 3º (sem semi)</option>
                      </select>
                    </div>

                    <div>
                      <label className="text-[10px] font-bold text-indigo-400 uppercase">Cruzamento</label>
                      <select
                        className="w-full p-2.5 rounded-lg border border-indigo-200 font-bold text-xs bg-white"
                        value={configGrupos.tipoCruzamento}
                        onChange={e => setConfigGrupos({ ...configGrupos, tipoCruzamento: e.target.value })}
                        disabled={configGrupos.modoFinal === 'FINAL_DIRETA'}
                        title={configGrupos.modoFinal === 'FINAL_DIRETA' ? 'Final Direta é baseada em grupos (A/B).' : ''}
                      >
                        <option value="GERAL">Ranking Geral (Todos)</option>
                        <option value="OLIMPICO">Olímpico (A x B)</option>
                      </select>
                    </div>

                    <button
                      onClick={gerarFluxoCompleto}
                      className="bg-indigo-600 text-white px-4 py-3 rounded-xl font-black text-xs uppercase hover:bg-indigo-700 shadow-lg active:scale-95 flex items-center justify-center gap-2"
                    >
                      <Wand2 size={16} /> Gerar
                    </button>
                  </div>

                  <div className="mt-3 flex items-center gap-2 text-indigo-800 text-xs font-bold bg-white/50 p-2 rounded-lg">
                    <Info size={14} />
                    <span>Total de Classificados: {configGrupos.qtdGrupos * configGrupos.classificamPorGrupo} times</span>
                  </div>
                </div>

                {/* PREVIEW */}
                <div className="flex-1 bg-slate-100 rounded-xl p-4 overflow-y-auto max-h-[500px] custom-scrollbar space-y-2 border border-slate-200">
                  {novoModelo.estrutura.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center text-slate-400 opacity-50">
                      <Trophy size={48} className="mb-2" />
                      <p className="font-bold text-sm">Configure acima e clique em Gerar.</p>
                    </div>
                  ) : (
                    novoModelo.estrutura.map((jogo, idx) => (
                      <div key={idx} className="bg-white p-3 rounded-lg border border-slate-200 flex items-center gap-4 shadow-sm">
                        <span className="bg-indigo-100 text-indigo-600 px-2 py-1 rounded text-[10px] font-black w-20 text-center">
                          {jogo.fase}
                        </span>
                        <div className="flex-1 text-xs font-bold text-slate-700">{jogo.obs}</div>
                        <div className="text-[9px] font-mono text-slate-400 flex flex-col items-end gap-1">
                          <span className="bg-slate-50 px-1 rounded border">A: {jogo.ruleA}</span>
                          <span className="bg-slate-50 px-1 rounded border">B: {jogo.ruleB}</span>
                        </div>
                      </div>
                    ))
                  )}
                </div>

                <div className="flex justify-between items-center mt-6 pt-6 border-t border-slate-100">
                  <button onClick={() => setEditMode(false)} className="text-xs font-bold text-slate-400 hover:text-slate-600">
                    Cancelar
                  </button>
                  <button
                    onClick={salvarModelo}
                    disabled={loading}
                    className="bg-green-600 hover:bg-green-500 text-white px-8 py-3 rounded-xl text-sm font-black uppercase flex items-center gap-2 shadow-xl hover:scale-105 transition-all disabled:opacity-60"
                  >
                    <Save size={18} /> Salvar Modelo Definitivo
                  </button>
                </div>

              </div>
            </div>
          </div>
        )}
      </div>
    </main>
  )
}
