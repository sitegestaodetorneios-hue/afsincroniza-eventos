'use client'

import React, { useEffect, useState } from 'react'
import Link from 'next/link'
import { 
  ArrowLeft, Plus, Trash2, Save, Link as LinkIcon, 
  Shuffle, BookOpen, Download, Loader2, Grid, RefreshCw, Zap, Users 
} from 'lucide-react'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)

export default function ArquitetoCompleto() {
  const [pin, setPin] = useState('')
  const [authed, setAutenticado] = useState(false)
  const [loading, setLoading] = useState(false)
  const [processing, setProcessing] = useState(false)
  
  const [etapas, setEtapas] = useState([])
  const [etapaId, setEtapaId] = useState('')
  
  const [jogos, setJogos] = useState([])
  const [ranking, setRanking] = useState([])
  const [modelos, setModelos] = useState([]) 
  const [times, setTimes] = useState([])

  // Construtores
  const [construtor, setConstrutor] = useState({ nomeFase: 'MATA-MATA', qtdJogos: 1, obs: 'A definir' })
  const [configGrupos, setConfigGrupos] = useState({ limpar: true, modo: 'BINGO' })
  const [nomeNovoModelo, setNomeNovoModelo] = useState('')

  function auth() { if (pin === '2026') setAutenticado(true); else alert('PIN Inválido'); }

  useEffect(() => {
    if(authed) { carregarEtapas(); carregarModelos(); }
  }, [authed])

  useEffect(() => { 
      if(etapaId) {
          carregarDadosEtapa()
          carregarTimesDaEtapa()
      }
  }, [etapaId])

  async function carregarEtapas() {
    const { data } = await supabase.from('etapas').select('*').order('created_at', { ascending: false })
    setEtapas(data || [])
  }
  
  async function carregarTimesDaEtapa() {
    const { data } = await supabase.from('etapa_equipes').select('equipe_id').eq('etapa_id', etapaId)
    setTimes(data || [])
  }

  async function carregarModelos() {
    const { data } = await supabase.from('modelos_campeonato').select('*').order('id')
    setModelos(data || [])
  }

  async function carregarDadosEtapa() {
    setLoading(true)
    const { data: j } = await supabase.from('jogos')
        .select('*, equipeA:equipes!equipe_a_id(nome_equipe), equipeB:equipes!equipe_b_id(nome_equipe)')
        .eq('etapa_id', etapaId)
        .order('rodada', {ascending: true}) // Ordena por rodada para ficar cronológico
        .order('id', {ascending: true})
    setJogos(j || [])
    
    const { data: r } = await supabase.from('vw_tabela_oficial').select('*').eq('etapa_id', etapaId)
    if(r) setRanking(r.sort((a,b) => b.pts - a.pts || b.v - a.v || b.sg - a.sg))
    setLoading(false)
  }

  // --- 1. GERADOR DE GRUPOS (SORTEIO INTEGRADO) ---
  async function gerarFaseGrupos() {
      if(!etapaId) return alert("Selecione etapa");
      if(times.length < 2) return alert("Essa etapa tem poucos times cadastrados. Adicione times primeiro.");
      
      if(!confirm(`Gerar sorteio para ${times.length} times? Isso vai criar os jogos da Fase de Grupos.`)) return;
      
      setLoading(true)
      try {
          const res = await fetch('/api/admin/sorteio', { 
              method: 'POST', 
              headers: { 'Content-Type': 'application/json', 'x-admin-pin': pin }, 
              body: JSON.stringify({ 
                  etapa_id: Number(etapaId), 
                  modo: configGrupos.modo, 
                  limpar_existentes: configGrupos.limpar 
              }) 
          })
          const data = await res.json()
          
          if(data.error) throw new Error(data.error)
          
          alert(`Sucesso! ${data.jogos_criados} jogos de grupo criados via Sorteio.`)
          await carregarDadosEtapa()
      } catch (e) {
          alert("Erro no Sorteio: " + e.message)
      } finally {
          setLoading(false)
      }
  }

  // --- 2. APLICAR MODELO MATA-MATA ---
  async function aplicarModelo(modelo) {
      if(!etapaId) return alert("Selecione uma etapa!");
      if(!confirm(`Adicionar a estrutura de "${modelo.nome}"?`)) return;
      
      setLoading(true)
      try {
        const rodadasAtuais = jogos.map(j => Number(j.rodada) || 0)
        const maiorRodada = Math.max(9, ...rodadasAtuais)
        
        const inserts = modelo.estrutura.map((item, idx) => ({
            etapa_id: Number(etapaId),
            tipo_jogo: item.fase,
            obs_publica: item.obs,
            origem_a: item.ruleA || null,
            origem_b: item.ruleB || null,
            rodada: maiorRodada + 1 + Math.floor(idx/2),
            status: 'EM_BREVE',
            finalizado: false
        }))

        const { error } = await supabase.from('jogos').insert(inserts)
        if(error) throw error
        await carregarDadosEtapa()
      } catch (e) { alert("Erro: " + e.message) }
      setLoading(false)
  }

  // --- 3. PROCESSADOR DE REGRAS (AUTOMÁTICO) ---
  async function processarFluxoAutomatico() {
      setProcessing(true)
      let updates = 0
      try {
          const { data: rRank } = await supabase.from('vw_tabela_oficial').select('*').eq('etapa_id', etapaId)
          const rankAtual = rRank ? rRank.sort((a,b) => b.pts - a.pts || b.v - a.v || b.sg - a.sg) : []
          const { data: jAtual } = await supabase.from('jogos').select('*').eq('etapa_id', etapaId).order('id')
          
          for (const jogo of jAtual) {
              if (jogo.finalizado) continue;
              
              const resolverRegra = (regra) => {
                  if(!regra) return null
                  // Regra Ranking (Grupos)
                  if(regra.startsWith('RANKING')) {
                      const [grp, idx] = regra.split('|')[1].split(':')
                      const time = rankAtual.filter(t => t.grupo === grp)[Number(idx)]
                      return time ? time.equipe_id : null
                  }
                  // Regra Jogo Anterior
                  if(regra.startsWith('JOGO')) {
                      const [tipo, ref] = regra.split('|')
                      let jogoRef = null
                      if(ref.startsWith('INDEX:')) {
                          // Lógica complexa de índice relativo, simplificada aqui
                          // (Modelos complexos usam IDs diretos ou placeholders)
                          return null 
                      } else {
                          jogoRef = jAtual.find(x => String(x.id) === String(ref))
                      }

                      if(jogoRef && jogoRef.finalizado) {
                          const sA = (jogoRef.gols_a||0) + ((jogoRef.penaltis_a||0)/100)
                          const sB = (jogoRef.gols_b||0) + ((jogoRef.penaltis_b||0)/100)
                          const w = sA > sB ? jogoRef.equipe_a_id : jogoRef.equipe_b_id
                          const l = sA > sB ? jogoRef.equipe_b_id : jogoRef.equipe_a_id
                          return tipo === 'JOGO_VENC' ? w : l
                      }
                  }
                  return null
              }

              if (!jogo.equipe_a_id && jogo.origem_a) {
                  const idA = resolverRegra(jogo.origem_a)
                  if (idA) { await supabase.from('jogos').update({ equipe_a_id: idA }).eq('id', jogo.id); updates++; }
              }
              if (!jogo.equipe_b_id && jogo.origem_b) {
                  const idB = resolverRegra(jogo.origem_b)
                  if (idB) { await supabase.from('jogos').update({ equipe_b_id: idB }).eq('id', jogo.id); updates++; }
              }
          }
          
          if(updates > 0) {
              alert(`Fluxo Processado! ${updates} novos confrontos definidos.`)
              await carregarDadosEtapa()
          } else {
              alert("Nenhum novo confronto pôde ser definido agora.")
          }
      } catch (e) { alert("Erro: " + e.message) }
      setProcessing(false)
  }

  // --- FUNÇÕES DE EDIÇÃO ---
  async function definirRegra(jogoId, lado, regraString) {
      setLoading(true)
      const update = lado === 'A' ? { origem_a: regraString } : { origem_b: regraString }
      if(regraString === 'LIMPAR') {
          update[lado === 'A' ? 'equipe_a_id' : 'equipe_b_id'] = null
          update[lado === 'A' ? 'origem_a' : 'origem_b'] = null
      }
      await supabase.from('jogos').update(update).eq('id', jogoId)
      await carregarDadosEtapa()
      setLoading(false)
  }

  const SeletorRegra = ({ jogoAtual, lado, valorAtual }) => {
    const jogosAnteriores = jogos.filter(j => j.id !== jogoAtual.id) // Evita auto-referência
    
    return (
        <select 
            className={`w-full text-[10px] p-2 rounded border font-bold mb-1 truncate cursor-pointer outline-none
                ${valorAtual ? 'bg-blue-100 border-blue-300 text-blue-800' : 'bg-white border-slate-300 text-slate-900'}
            `} 
            onChange={(e) => definingRegra(e.target.value)} 
            value={valorAtual || ""}
        >
            <option value="">⚡ Conectar...</option>
            <optgroup label="Fase de Grupos">
                {['A','B','C','D','E','F'].map(grp => (
                    <React.Fragment key={grp}>
                        {[0,1,2,3].map(i => <option key={`${grp}${i}`} value={`RANKING|${grp}:${i}`}>{i+1}º do Grupo {grp}</option>)}
                    </React.Fragment>
                ))}
            </optgroup>
            <optgroup label="Jogos Anteriores">
                {jogosAnteriores.map(j => (
                    <React.Fragment key={j.id}>
                        <option value={`JOGO_VENC|${j.id}`}>Vencedor Jogo {j.tipo_jogo} ({j.id})</option>
                        <option value={`JOGO_PERD|${j.id}`}>Perdedor Jogo {j.tipo_jogo} ({j.id})</option>
                    </React.Fragment>
                ))}
            </optgroup>
            <option value="LIMPAR" className="text-red-500">❌ Limpar Regra</option>
        </select>
    )
    function definingRegra(val) { if(val) definirRegra(jogoAtual.id, lado, val) }
  }

  // --- SALVAR MODELO ---
  async function salvarComoModelo() {
      if(!nomeNovoModelo) return alert("Dê um nome.")
      if(jogos.length === 0) return alert("Sem jogos para salvar.")
      if(!confirm(`Salvar template "${nomeNovoModelo}"?`)) return;

      setLoading(true)
      try {
        const estruturaInteligente = jogos.map(j => ({
            fase: j.tipo_jogo,
            obs: j.obs_publica,
            ruleA: j.origem_a, // Salva a regra!
            ruleB: j.origem_b
        }))

        await supabase.from('modelos_campeonato').insert({
            nome: nomeNovoModelo,
            descricao: `Modelo Customizado (${jogos.length} jogos)`,
            estrutura: estruturaInteligente
        })
        alert("Modelo salvo!")
        setNomeNovoModelo(''); await carregarModelos();
      } catch (e) { alert("Erro: " + e.message) }
      setLoading(false)
  }

  async function criarManual() {
      setLoading(true)
      const maiorRodada = jogos.reduce((acc,cur) => Math.max(acc, Number(cur.rodada)||0), 9) + 1
      const inserts = Array(Number(construtor.qtdJogos)).fill(0).map(() => ({
          etapa_id: Number(etapaId),
          tipo_jogo: construtor.nomeFase.toUpperCase().replace(/\s/g, '_'),
          obs_publica: construtor.obs,
          rodada: maiorRodada,
          status: 'EM_BREVE'
      }))
      await supabase.from('jogos').insert(inserts)
      await carregarDadosEtapa()
      setLoading(false)
  }

  async function apagarJogo(id) {
    if(confirm("Apagar?")) {
        await supabase.from('jogos').delete().eq('id', id)
        carregarDadosEtapa()
    }
  }

  if (!authed) return <div className="min-h-screen bg-slate-950 flex items-center justify-center"><div className="bg-slate-900 p-8 rounded-2xl text-center"><h1 className="text-white font-black mb-4">ACESSO ARQUITETO</h1><input type="password" value={pin} onChange={e=>setPin(e.target.value)} className="bg-black text-white p-3 rounded mb-4 w-full text-center"/><button onClick={auth} className="bg-blue-600 w-full p-3 rounded font-bold text-white">ENTRAR</button></div></div>

  return (
    <main className="min-h-screen bg-slate-50 text-slate-900 p-4 md:p-8">
        <div className="max-w-[1400px] mx-auto">
            <div className="flex items-center gap-4 mb-8">
                <Link href="/admin" className="bg-white p-3 rounded-full shadow hover:scale-105"><ArrowLeft/></Link>
                <div>
                    <h1 className="text-2xl font-black uppercase text-slate-800 flex items-center gap-2"><Zap className="text-yellow-500 fill-yellow-500"/> Arquiteto Completo</h1>
                    <p className="text-slate-500 text-sm font-bold">Grupos + Mata-Mata + Automação</p>
                </div>
            </div>

            <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100 mb-6 flex gap-2 overflow-x-auto">
                {etapas.map(e => (
                    <button key={e.id} onClick={() => setEtapaId(e.id)} className={`px-4 py-2 rounded-lg font-bold text-xs uppercase whitespace-nowrap border ${etapaId === e.id ? 'bg-slate-900 text-white border-slate-900' : 'bg-white border-slate-200 text-slate-500'}`}>{e.titulo}</button>
                ))}
            </div>

            {etapaId && (
                <div className="grid lg:grid-cols-12 gap-6 animate-in fade-in">
                    
                    {/* ESQUERDA: FERRAMENTAS (3 COLUNAS) */}
                    <div className="lg:col-span-3 space-y-6">
                        
                        {/* 1. GERADOR DE GRUPOS */}
                        <div className="bg-indigo-600 text-white p-5 rounded-3xl shadow-lg shadow-indigo-500/30">
                            <h2 className="text-sm font-black uppercase mb-3 flex items-center gap-2"><Users size={16}/> 1. Fase de Grupos</h2>
                            <p className="text-indigo-200 text-[10px] mb-3 leading-tight">Gera os jogos de grupo usando os times cadastrados na etapa.</p>
                            <div className="flex items-center gap-2 mb-3 bg-indigo-800/50 p-2 rounded-lg">
                                <span className="text-[10px] font-bold">Limpar jogos antigos?</span>
                                <input type="checkbox" checked={configGrupos.limpar} onChange={e=>setConfigGrupos({...configGrupos, limpar: e.target.checked})} className="w-4 h-4"/>
                            </div>
                            <button onClick={gerarFaseGrupos} disabled={loading} className="w-full bg-white text-indigo-700 font-black py-3 rounded-xl uppercase hover:bg-indigo-50 text-xs flex items-center justify-center gap-2">
                                <Shuffle size={14}/> Sortear Grupos
                            </button>
                        </div>

                        {/* 2. AUTOMACAO */}
                        <div className="bg-blue-600 text-white p-5 rounded-3xl shadow-lg shadow-blue-500/30">
                            <h2 className="text-sm font-black uppercase mb-3 flex items-center gap-2"><RefreshCw size={16} className={processing ? "animate-spin" : ""}/> 2. Automação</h2>
                            <p className="text-blue-200 text-[10px] mb-3 leading-tight">Durante o campeonato, clique aqui para avançar os times classificados.</p>
                            <button onClick={processarFluxoAutomatico} disabled={processing} className="w-full bg-white text-blue-700 font-black py-3 rounded-xl uppercase hover:bg-blue-50 text-xs flex items-center justify-center gap-2">
                                {processing ? 'Processando...' : 'Processar Fluxo'}
                            </button>
                        </div>

                        {/* 3. CRIAR FASE MATA-MATA */}
                        <div className="bg-slate-900 text-white p-5 rounded-3xl">
                             <h2 className="text-sm font-black uppercase mb-3 flex items-center gap-2"><Plus className="text-green-400" size={16}/> 3. Adicionar Fase</h2>
                             <div className="space-y-2">
                                <input className="w-full bg-slate-800 border border-slate-700 p-2 rounded text-xs font-bold text-white" value={construtor.nomeFase} onChange={e=>setConstrutor({...construtor, nomeFase: e.target.value})} placeholder="Nome (Ex: FINAL)"/>
                                <div className="flex gap-2">
                                    <input type="number" className="w-full bg-slate-800 border border-slate-700 p-2 rounded text-xs font-bold text-white" value={construtor.qtdJogos} onChange={e=>setConstrutor({...construtor, qtdJogos: e.target.value})} placeholder="Qtd"/>
                                    <button onClick={criarManual} disabled={loading} className="w-full bg-green-600 font-bold py-2 rounded-lg text-xs uppercase hover:bg-green-500">Add</button>
                                </div>
                             </div>
                             
                             {/* MODELOS PRONTOS */}
                             <div className="mt-6 pt-6 border-t border-slate-700">
                                <h3 className="text-[10px] font-bold text-slate-400 uppercase mb-2">Ou use um modelo:</h3>
                                <div className="space-y-2 max-h-[150px] overflow-y-auto custom-scrollbar pr-1">
                                    {modelos.map(m => (
                                        <button key={m.id} onClick={() => aplicarModelo(m)} disabled={loading} className="w-full text-left bg-slate-800 hover:bg-slate-700 border border-slate-700 p-2 rounded text-[10px] font-bold uppercase truncate">
                                            {m.nome}
                                        </button>
                                    ))}
                                </div>
                             </div>
                        </div>
                    </div>

                    {/* DIREITA: MESA DE JOGOS (9 COLUNAS) */}
                    <div className="lg:col-span-9 space-y-4">
                        <div className="flex flex-col md:flex-row justify-between items-center gap-4 bg-slate-100 p-4 rounded-2xl border border-slate-200">
                            <div>
                                <h2 className="text-lg font-black uppercase text-slate-800 flex items-center gap-2"><Grid className="text-slate-500"/> Mesa de Jogos</h2>
                                <p className="text-[10px] text-slate-500 font-bold">Total: {jogos.length} jogos | Grupos + Mata-Mata</p>
                            </div>
                            
                            {/* SALVAR MODELO */}
                            {jogos.length > 0 && (
                                <div className="flex gap-2 w-full md:w-auto">
                                    <input className="bg-white border border-slate-300 rounded-lg p-2 text-xs font-bold flex-1 md:w-56" placeholder="Nome do Modelo (Ex: Meu Camp)" value={nomeNovoModelo} onChange={e => setNomeNovoModelo(e.target.value)}/>
                                    <button onClick={salvarComoModelo} disabled={loading} className="bg-slate-800 hover:bg-black text-white px-4 py-2 rounded-lg text-xs font-black uppercase flex items-center gap-2 whitespace-nowrap">
                                        <Download size={14}/> Salvar Template
                                    </button>
                                </div>
                            )}
                        </div>
                        
                        {jogos.length === 0 && <div className="p-20 text-center text-slate-400 bg-white rounded-2xl border border-dashed border-slate-300">
                            <Grid className="mx-auto mb-4 opacity-20" size={48}/>
                            <p className="font-bold">Comece clicando em "Sortear Grupos" na esquerda.</p>
                        </div>}
                        
                        {/* LISTA DE JOGOS - VISUAL MELHORADO */}
                        <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-4">
                            {jogos.map(jogo => (
                                <div key={jogo.id} className={`border p-4 rounded-2xl shadow-sm relative group transition-all ${jogo.tipo_jogo === 'GRUPO' ? 'bg-slate-50 border-slate-200 opacity-80 hover:opacity-100' : 'bg-white border-blue-200 shadow-md ring-1 ring-blue-50'}`}>
                                    
                                    <div className="flex justify-between items-center mb-3 pb-2 border-b border-slate-200/50">
                                        <div className="flex items-center gap-2">
                                            <span className="bg-slate-200 text-slate-600 px-1.5 py-0.5 rounded text-[9px] font-black">{jogo.id}</span>
                                            <span className={`font-black text-xs uppercase ${jogo.tipo_jogo === 'GRUPO' ? 'text-slate-500' : 'text-blue-700'}`}>{jogo.tipo_jogo}</span>
                                        </div>
                                        <button onClick={()=>apagarJogo(jogo.id)} className="text-red-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"><Trash2 size={12}/></button>
                                    </div>

                                    <div className="space-y-2">
                                        {/* TIME A */}
                                        <div>
                                            {jogo.tipo_jogo !== 'GRUPO' && (
                                                <div className="mb-1">
                                                    <SeletorRegra jogoAtual={jogo} lado="A" valorAtual={jogo.origem_a}/>
                                                </div>
                                            )}
                                            <div className={`p-2 rounded-lg border text-xs font-bold truncate flex items-center gap-2 ${jogo.equipe_a_id ? 'bg-white border-slate-200 text-slate-900' : 'bg-slate-100 text-slate-400 border-dashed'}`}>
                                                {jogo.equipeA?.logo_url && <img src={jogo.equipeA.logo_url} className="w-4 h-4 object-contain"/>}
                                                {jogo.equipe_a_id ? jogo.equipeA?.nome_equipe : (jogo.origem_a ? '🔄 Aguardando...' : 'Vazio')}
                                            </div>
                                        </div>
                                        
                                        {/* TIME B */}
                                        <div>
                                            {jogo.tipo_jogo !== 'GRUPO' && (
                                                <div className="mb-1">
                                                    <SeletorRegra jogoAtual={jogo} lado="B" valorAtual={jogo.origem_b}/>
                                                </div>
                                            )}
                                            <div className={`p-2 rounded-lg border text-xs font-bold truncate flex items-center gap-2 ${jogo.equipe_b_id ? 'bg-white border-slate-200 text-slate-900' : 'bg-slate-100 text-slate-400 border-dashed'}`}>
                                                {jogo.equipeB?.logo_url && <img src={jogo.equipeB.logo_url} className="w-4 h-4 object-contain"/>}
                                                {jogo.equipe_b_id ? jogo.equipeB?.nome_equipe : (jogo.origem_b ? '🔄 Aguardando...' : 'Vazio')}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                </div>
            )}
        </div>
    </main>
  )
}