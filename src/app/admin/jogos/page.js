'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import {
  ArrowLeft, PlusCircle, Save, CheckCircle, XCircle, Loader2, 
  ClipboardList, Trash2, Shuffle, Trophy, Clock, Users, Calendar, 
  PlayCircle, StopCircle, Edit3, AlertTriangle, X, User, Lock, FileText, RotateCcw
} from 'lucide-react'

// Função auxiliar segura para ler JSON
async function safeJson(res) {
  try {
    const text = await res.text()
    try { return JSON.parse(text) } catch { return { error: text || `Erro ${res.status}` } }
  } catch (e) { return { error: 'Falha na conexão' } }
}

export default function AdminJogos() {
  const [pin, setPin] = useState('')
  const [authed, setAutenticado] = useState(false) // Corrigido nome para consistência
  const [loading, setLoading] = useState(false)

  // Dados
  const [etapas, setEtapas] = useState([])
  const [etapaId, setEtapaId] = useState('')
  const [jogos, setJogos] = useState([])
  const [todosTimes, setTodosTimes] = useState([]) 
  const [timesDaEtapa, setTimesDaEtapa] = useState([]) 

  // Modal e Configs
  const [showModalTimes, setShowModalTimes] = useState(false)
  const [selectedTeams, setSelectedTeams] = useState(new Set())
  const [horData, setHorData] = useState('') 
  const [horInicio, setHorInicio] = useState('08:00')
  const [horDuracao, setHorDuracao] = useState(50) 
  const [horIntervalo, setHorIntervalo] = useState(5)
  const [sorteioDataBase, setSorteioDataBase] = useState('')
  const [sorteioLimpar, setSorteioLimpar] = useState(true)
  const [novaEtapa, setNovaEtapa] = useState({ modalidade: 'FUTSAL', titulo: '', status: 'EM_ANDAMENTO' })
  
  // Novo Jogo Manual
  const [novoJogo, setNovoJogo] = useState({ 
      rodada: '', data_jogo: '', equipe_a_id: '', equipe_b_id: '', tipo_jogo: 'GRUPO'
  })

  function auth() { if (pin === '2026') { setAutenticado(true) } else alert('PIN incorreto') }

  // --- CARREGAMENTO ---
  async function loadAll() {
    setLoading(true)
    try {
      const [etRes, allTeamsRes] = await Promise.all([
        fetch('/api/admin/etapas', { headers: { 'x-admin-pin': pin } }),
        fetch('/api/admin/teams', { headers: { 'x-admin-pin': pin } })
      ])
      const etData = await safeJson(etRes)
      const teamsData = await safeJson(allTeamsRes)
      setEtapas(Array.isArray(etData) ? etData : [])
      setTodosTimes(Array.isArray(teamsData) ? teamsData : [])
    } catch (e) {
      setEtapas([]); setTodosTimes([])
    } finally { setLoading(false) }
  }

  useEffect(() => { if (authed) loadAll() }, [authed])

  async function selecionarEtapa(id) {
    if (!id) return;
    setEtapaId(String(id))
    setLoading(true)
    try {
        const resJogos = await fetch(`/api/admin/jogos?etapa_id=${id}`, { headers: { 'x-admin-pin': pin } })
        const dataJogos = await safeJson(resJogos)
        setJogos(Array.isArray(dataJogos) ? dataJogos : [])

        const resGrupos = await fetch(`/api/admin/etapas/gerenciar-times?etapa_id=${id}`, { headers: { 'x-admin-pin': pin } })
        const dataGrupos = await safeJson(resGrupos)
        setTimesDaEtapa(Array.isArray(dataGrupos) ? dataGrupos : [])
    } catch (e) { setJogos([]) } finally { setLoading(false) }
  }

  // --- AÇÕES ---
  async function criarEtapa() {
    if(!novaEtapa.titulo) return alert("Digite um nome para a etapa")
    setLoading(true)
    try {
      const res = await fetch('/api/admin/etapas', { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-admin-pin': pin }, body: JSON.stringify(novaEtapa) })
      const data = await safeJson(res)
      
      await loadAll() // Recarrega lista de etapas
      
      setNovaEtapa({...novaEtapa, titulo: ''})
      alert('Etapa criada! Selecione-a na lista abaixo para começar a gerenciar.')
      // Não seleciona auto para evitar confusão, força o usuário a clicar na nova
      setEtapaId('') 
      setJogos([])
      setTimesDaEtapa([])
    } finally { setLoading(false) }
  }

  async function excluirEtapa(id_para_excluir) {
    if(!confirm("TEM CERTEZA? Isso apagará a etapa e TODOS os jogos/classificação dela.")) return;
    setLoading(true)
    try {
        await fetch(`/api/admin/etapas?id=${id_para_excluir}`, { method: 'DELETE', headers: { 'x-admin-pin': pin } })
        if(String(etapaId) === String(id_para_excluir)) {
            setEtapaId('')
            setJogos([])
            setTimesDaEtapa([])
        }
        await loadAll()
    } finally { setLoading(false) }
  }

  function abrirSelecaoTimes() {
    if(!etapaId) return alert("Selecione a etapa antes.");
    setSelectedTeams(new Set())
    setShowModalTimes(true)
  }

  async function confirmarImportacao() {
    if(selectedTeams.size === 0) return alert("Selecione pelo menos 1 time.");
    setLoading(true)
    try {
        await fetch('/api/admin/etapas/gerenciar-times', { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-admin-pin': pin }, body: JSON.stringify({ action: 'import_selected', etapa_id: etapaId, selected_ids: Array.from(selectedTeams) }) })
        setShowModalTimes(false)
        await selecionarEtapa(etapaId)
    } finally { setLoading(false) }
  }

  async function sortearGrupos() {
    setLoading(true)
    try {
      await fetch('/api/admin/etapas/sortear-grupos', { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-admin-pin': pin }, body: JSON.stringify({ etapa_id: Number(etapaId) }) })
      await selecionarEtapa(etapaId)
    } finally { setLoading(false) }
  }

  async function gerarJogosAuto() {
    if (!etapaId) return alert("Selecione uma etapa!");
    setLoading(true)
    try {
      const res = await fetch('/api/admin/sorteio', { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-admin-pin': pin }, body: JSON.stringify({ etapa_id: Number(etapaId), data_base: sorteioDataBase || null, modo: 'BINGO', limpar_existentes: sorteioLimpar }) })
      const data = await safeJson(res)
      if(data.error) alert(`ERRO: ${data.error}`)
      else { alert(`Sucesso! ${data.jogos_criados} jogos criados.`); await selecionarEtapa(etapaId) }
    } finally { setLoading(false) }
  }

  async function aplicarHorarios() {
    if (!etapaId) return alert("Selecione uma etapa!");
    if (!horData) return alert("Preencha a DATA DA RODADA.")
    setLoading(true)
    try {
      const res = await fetch('/api/admin/horarios', { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-admin-pin': pin }, body: JSON.stringify({ etapa_id: Number(etapaId), data_jogo: horData, hora_inicio_base: horInicio, duracao_min: Number(horDuracao), intervalo_min: Number(horIntervalo) }) })
      const data = await safeJson(res)
      alert(data.msg || data.error)
      await selecionarEtapa(etapaId)
    } finally { setLoading(false) }
  }

  async function limparEtapa() {
    if (!etapaId) return alert("Selecione uma etapa!");
    if(!confirm("ISSO APAGA TUDO DA ETAPA (JOGOS E TIMES). Confirmar?")) return;
    setLoading(true)
    try {
        await fetch('/api/admin/etapas/gerenciar-times', { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-admin-pin': pin }, body: JSON.stringify({ action: 'clear', etapa_id: etapaId }) })
        await selecionarEtapa(etapaId)
    } finally { setLoading(false) }
  }

  async function atualizarJogo(payload) {
    await fetch('/api/admin/jogos', { method: 'PUT', headers: { 'Content-Type': 'application/json', 'x-admin-pin': pin }, body: JSON.stringify(payload) })
    await selecionarEtapa(etapaId) 
  }

  async function criarJogoManual() {
    if (!etapaId) return alert("Selecione uma etapa primeiro!");
    if (!novoJogo.equipe_a_id) return alert("Selecione o Time A!");
    if (!novoJogo.equipe_b_id) return alert("Selecione o Time B!");
    if (novoJogo.equipe_a_id === novoJogo.equipe_b_id) return alert("Os times devem ser diferentes!");

    setLoading(true);
    try {
        const payload = { 
            ...novoJogo, 
            etapa_id: Number(etapaId), // Garante que vai para a etapa selecionada
            equipe_a_id: parseInt(novoJogo.equipe_a_id), 
            equipe_b_id: parseInt(novoJogo.equipe_b_id),
            rodada: novoJogo.rodada ? parseInt(novoJogo.rodada) : 1
        };
        const res = await fetch('/api/admin/jogos', { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-admin-pin': pin }, body: JSON.stringify(payload) });
        const data = await safeJson(res);
        if (!res.ok || data.error) alert(`Erro: ${data.error || 'Erro desconhecido'}`);
        else { setNovoJogo({...novoJogo, equipe_a_id: '', equipe_b_id: '', rodada: ''}); await selecionarEtapa(etapaId); }
    } catch(e) { alert("Erro de conexão."); } finally { setLoading(false); }
  }

  async function gerarFinais() {
    if (!etapaId) return alert("Selecione uma etapa!");
    if(!confirm("Gerar finais (1º vs 1º)?")) return;
    setLoading(true)
    try {
      const res = await fetch('/api/admin/etapas/gerar-finais', { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-admin-pin': pin }, body: JSON.stringify({ etapa_id: Number(etapaId) }) })
      const data = await safeJson(res)
      if(data.success) { alert("Finais Geradas!"); await selecionarEtapa(etapaId); }
      else alert(data.error)
    } finally { setLoading(false) }
  }

  const grupos = useMemo(() => {
    const lista = Array.isArray(timesDaEtapa) ? timesDaEtapa : []
    const a = lista.filter(t => t.grupo === 'A')
    const b = lista.filter(t => t.grupo === 'B')
    return { A: a, B: b }
  }, [timesDaEtapa])

  // --- LOGIN ---
  if (!authed) {
    return (
      <main className="min-h-screen bg-slate-950 flex items-center justify-center p-6">
        <div className="bg-slate-900 p-12 rounded-[2rem] border border-slate-800 text-center max-w-sm w-full shadow-2xl">
          <div className="w-20 h-20 bg-blue-600 rounded-3xl rotate-6 flex items-center justify-center mx-auto mb-8 shadow-lg">
             <Lock className="text-white" size={36}/>
          </div>
          <h1 className="text-2xl font-black text-white uppercase mb-2">Acesso Jogos</h1>
          <input type="password" placeholder="PIN" className="w-full p-4 bg-slate-950 border border-slate-700 rounded-xl text-center text-white font-black text-4xl mb-6 outline-none focus:border-blue-600" value={pin} onChange={(e) => setPin(e.target.value)} maxLength={4} />
          <button onClick={auth} className="w-full bg-blue-600 text-white font-black py-4 rounded-xl uppercase hover:bg-blue-500 shadow-xl">Entrar</button>
        </div>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-slate-50 py-10 px-4 md:px-10 relative text-slate-800">
      
      {/* MODAL */}
      {showModalTimes && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
            <div className="bg-white w-full max-w-2xl rounded-3xl p-8 max-h-[80vh] flex flex-col shadow-2xl">
                <div className="flex justify-between items-center mb-6">
                    <h3 className="text-2xl font-black text-slate-900 uppercase">Selecionar Times</h3>
                    <button onClick={() => setShowModalTimes(false)} className="bg-slate-100 p-2 rounded-full"><X size={20}/></button>
                </div>
                <div className="flex-1 overflow-y-auto grid grid-cols-1 md:grid-cols-2 gap-3 p-2">
                    {todosTimes.map(team => {
                        const isSelected = selectedTeams.has(team.id);
                        return (
                            <div key={team.id} onClick={() => { const next = new Set(selectedTeams); if(isSelected) next.delete(team.id); else next.add(team.id); setSelectedTeams(next); }} className={`p-4 rounded-xl border-2 cursor-pointer flex justify-between items-center ${isSelected ? 'border-blue-600 bg-blue-50' : 'border-slate-100'}`}>
                                <div><p className="font-bold text-slate-800">{team.nome_equipe}</p><p className="text-[10px] uppercase font-bold text-slate-400">{team.modalidade} • {team.cidade}</p></div>
                                {isSelected && <CheckCircle className="text-blue-600" size={20}/>}
                            </div>
                        )
                    })}
                </div>
                <div className="pt-6 border-t mt-4 flex justify-between items-center">
                    <span className="font-bold text-slate-500">{selectedTeams.size} selecionados</span>
                    <button onClick={confirmarImportacao} disabled={loading} className="bg-slate-900 text-white font-black py-3 px-8 rounded-xl hover:bg-black uppercase shadow-lg">Confirmar Importação</button>
                </div>
            </div>
        </div>
      )}

      <div className="max-w-7xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <Link href="/admin" className="flex items-center gap-2 text-slate-500 hover:text-blue-600 font-bold text-sm uppercase"><ArrowLeft size={18} /> Voltar</Link>
          <div className="text-right">
            <p className="text-xs font-black uppercase text-slate-400 tracking-widest">Painel Oficial</p>
            <h1 className="text-3xl font-black uppercase italic tracking-tighter text-slate-900">Gestão de Jogos</h1>
          </div>
        </div>

        {/* 1. SELEÇÃO DE ETAPA */}
        <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-8 mb-8">
          <div className="flex justify-between items-center mb-6"><h2 className="font-black uppercase text-slate-900 text-lg flex items-center gap-2"><Trophy className="text-yellow-500" size={20}/> 1. Selecione a Etapa</h2>{loading && <Loader2 className="animate-spin text-slate-400"/>}</div>
          <div className="grid md:grid-cols-5 gap-4 mb-8 p-4 bg-slate-50 rounded-2xl border border-slate-100">
            <select className="p-3 rounded-xl border bg-white font-bold text-slate-700 outline-none" value={novaEtapa.modalidade} onChange={(e) => setNovaEtapa({ ...novaEtapa, modalidade: e.target.value })}><option value="FUTSAL">FUTSAL</option><option value="SUICO">SUÍÇO</option></select>
            <input className="p-3 rounded-xl border bg-white font-bold md:col-span-2 text-slate-700 outline-none" value={novaEtapa.titulo} onChange={(e) => setNovaEtapa({ ...novaEtapa, titulo: e.target.value })} placeholder="Nome da Etapa (Ex: Copa Verão)" />
            <button onClick={criarEtapa} className="bg-slate-900 text-white font-black rounded-xl px-4 uppercase text-xs hover:bg-blue-600 transition-colors shadow-lg"><PlusCircle size={16} className="inline mr-2"/> Criar Nova</button>
          </div>
          <div className="grid md:grid-cols-3 gap-3">
            {Array.isArray(etapas) && etapas.map((e) => (
              <div key={e.id} className="relative group">
                  <button onClick={() => selecionarEtapa(e.id)} className={`w-full text-left p-5 rounded-2xl border font-bold transition-all hover:scale-[1.02] ${String(etapaId) === String(e.id) ? 'border-blue-600 bg-blue-50 ring-2 ring-blue-200 shadow-md' : 'border-slate-200 bg-white hover:bg-slate-50'}`}>
                    <div className="text-[10px] uppercase font-black tracking-widest text-slate-400 mb-1">{e.modalidade} • {e.status}</div>
                    <div className="text-slate-900 font-black truncate text-lg pr-6">{e.titulo}</div>
                  </button>
                  <button onClick={(event) => { event.stopPropagation(); excluirEtapa(e.id); }} className="absolute top-4 right-4 text-red-300 hover:text-red-600 opacity-0 group-hover:opacity-100 transition-opacity p-2" title="Excluir Etapa"><Trash2 size={16}/></button>
              </div>
            ))}
          </div>
        </div>

        {etapaId ? (
            <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
                {/* 2. PAINEL DE CONTROLE */}
                <div className="bg-slate-900 text-white rounded-3xl shadow-2xl shadow-slate-400 p-8 relative overflow-hidden">
                    <div className="absolute top-0 right-0 p-8 opacity-5"><Trophy size={200}/></div>
                    
                    <div className="grid lg:grid-cols-3 gap-8 mb-8 relative z-10">
                        <div className="bg-white/5 p-6 rounded-3xl border border-white/10">
                            <p className="text-blue-400 text-[10px] font-black uppercase tracking-widest mb-4">Passo 1: Times</p>
                            <div className="flex justify-between items-end mb-6">
                                <span className="text-4xl font-black">{timesDaEtapa.length}</span>
                                <span className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">Confirmados na Etapa</span>
                            </div>
                            <button onClick={abrirSelecaoTimes} className="w-full bg-blue-600 hover:bg-blue-500 py-3 rounded-xl font-bold text-xs uppercase flex items-center justify-center gap-2"><Users size={16}/> Selecionar Times</button>
                        </div>
                        <div className="lg:col-span-2 bg-white/5 p-6 rounded-3xl border border-white/10 grid grid-cols-2 gap-6 relative">
                            <div><p className="text-yellow-400 text-[10px] font-black uppercase tracking-widest mb-3 border-b border-white/10 pb-2">Grupo A</p><ul className="text-xs font-medium text-slate-300 space-y-1">{grupos.A.map(t => <li key={t.id}>• {t.nome_equipe}</li>)}</ul></div>
                            <div><p className="text-yellow-400 text-[10px] font-black uppercase tracking-widest mb-3 border-b border-white/10 pb-2">Grupo B</p><ul className="text-xs font-medium text-slate-300 space-y-1">{grupos.B.map(t => <li key={t.id}>• {t.nome_equipe}</li>)}</ul></div>
                            <Link 
                              href={`/admin/sorteio?etapa_id=${etapaId}`} 
                              className="absolute top-4 right-4 bg-slate-800 hover:bg-slate-700 py-2 px-4 rounded-lg font-bold text-[10px] uppercase flex items-center justify-center gap-2 border border-white/10 text-white"
                            >
                              <Shuffle size={12}/> Abrir Sorteio Animado
                            </Link></div>
                    </div>
                    
                    <div className="grid lg:grid-cols-4 gap-6 pt-8 border-t border-white/10 relative z-10">
                        <div className="col-span-2 flex items-center gap-4 bg-white/5 p-4 rounded-2xl border border-white/10">
                            <div className="flex-1"><p className="text-blue-400 text-[10px] font-black uppercase tracking-widest mb-1">Passo 2: Tabela</p><label className="text-[10px] flex items-center gap-2 cursor-pointer text-slate-400 hover:text-white transition-colors"><input type="checkbox" checked={sorteioLimpar} onChange={e=>setSorteioLimpar(e.target.checked)} className="accent-blue-500"/> Limpar jogos atuais ao gerar</label></div>
                            <button onClick={gerarJogosAuto} className="bg-white text-slate-900 hover:bg-slate-200 px-6 py-3 rounded-xl font-black text-xs uppercase flex items-center gap-2"><ClipboardList size={16}/> Gerar Tabela</button>
                        </div>
                        <div className="col-span-2 bg-black/30 p-5 rounded-2xl border border-white/10 flex flex-col gap-4">
                            <p className="text-blue-400 text-[10px] font-black uppercase tracking-widest">Passo 3: Agenda Automática</p>
                            <div className="grid grid-cols-3 gap-3">
                                <div><label className="text-[9px] text-slate-500 font-bold block mb-1 uppercase">Data</label><input type="date" className="w-full bg-slate-800 border border-white/10 rounded-lg p-2 text-xs text-white" value={horData} onChange={e=>setHorData(e.target.value)} /></div>
                                <div><label className="text-[9px] text-slate-500 font-bold block mb-1 uppercase">Início</label><input type="time" className="w-full bg-slate-800 border border-white/10 rounded-lg p-2 text-xs text-white text-center" value={horInicio} onChange={e=>setHorInicio(e.target.value)} /></div>
                                <div><label className="text-[9px] text-slate-500 font-bold block mb-1 uppercase">Duração</label><input type="number" className="w-full bg-slate-800 border border-white/10 rounded-lg p-2 text-xs text-white text-center" value={horDuracao} onChange={e=>setHorDuracao(e.target.value)} placeholder="Min" title="Tempo total (jogo+intervalo)" /></div>
                            </div>
                            <button onClick={aplicarHorarios} className="w-full bg-blue-600 hover:bg-blue-500 py-3 rounded-xl font-black text-xs uppercase"><Clock size={14} className="inline mr-2"/> Aplicar Agenda</button>
                        </div>
                    </div>
                    
                    <div className="mt-8 flex justify-end gap-3 relative z-10">
                        <button onClick={gerarFinais} className="bg-yellow-500 hover:bg-yellow-400 text-slate-900 font-black px-6 py-3 rounded-xl text-xs uppercase flex items-center gap-2"><Trophy size={16}/> Gerar Finais</button>
                        <button onClick={limparEtapa} className="bg-red-500/10 hover:bg-red-500/20 text-red-400 font-bold px-4 py-3 rounded-xl text-xs uppercase flex items-center gap-2 border border-red-500/30"><Trash2 size={14}/> Reset Etapa</button>
                    </div>
                </div>

                {/* 3. LISTA DE JOGOS */}
                <div className="space-y-6">
                    <div className="flex items-center gap-3">
                        <h2 className="font-black uppercase text-slate-900 text-2xl tracking-tight">Jogos</h2>
                        <span className="bg-slate-200 text-slate-600 px-3 py-1 rounded-full text-xs font-black shadow-inner">{jogos.length}</span>
                    </div>
                    {jogos.length === 0 ? <div className="bg-white rounded-3xl p-20 text-center border border-slate-200 shadow-sm"><p className="text-slate-400 font-bold text-sm">A tabela desta etapa está vazia. Gere os jogos acima.</p></div> : 
                        <div className="grid md:grid-cols-2 gap-6">
                            {jogos.map((j) => (
                                <GameCard key={j.id} jogo={j} onUpdate={atualizarJogo} busy={loading} pin={pin} />
                            ))}
                        </div>
                    }
                </div>

                {/* MANUAL ADD */}
                <div className="bg-slate-100 rounded-3xl p-6 border border-slate-200 opacity-60 hover:opacity-100 transition-all">
                    <p className="text-[10px] font-black uppercase text-slate-400 mb-3 tracking-widest">Adição Manual (Backup)</p>
                    <div className="flex gap-3 items-center flex-wrap">
                        <select className="p-3 rounded-xl border border-slate-200 text-xs font-bold uppercase bg-white outline-none" value={novoJogo.tipo_jogo} onChange={e => setNovoJogo({...novoJogo, tipo_jogo: e.target.value})}>
                            <option value="GRUPO">Fase de Grupos</option>
                            <option value="FINAL">Grande Final</option>
                            <option value="DISPUTA_3">Disputa 3º Lugar</option>
                        </select>
                        <input className="p-3 rounded-xl border border-slate-200 text-xs w-24 bg-white font-bold outline-none" placeholder="Rodada" value={novoJogo.rodada} onChange={e => setNovoJogo({...novoJogo, rodada: e.target.value})} />
                        <select className="flex-1 p-3 rounded-xl border border-slate-200 text-xs bg-white font-bold outline-none" value={novoJogo.equipe_a_id} onChange={e => setNovoJogo({...novoJogo, equipe_a_id: e.target.value})}>
                            <option value="">Time A</option>
                            {todosTimes.map(t => <option key={t.id} value={t.id}>{t.nome_equipe}</option>)}
                        </select>
                        <span className="font-black text-slate-300">VS</span>
                        <select className="flex-1 p-3 rounded-xl border border-slate-200 text-xs bg-white font-bold outline-none" value={novoJogo.equipe_b_id} onChange={e => setNovoJogo({...novoJogo, equipe_b_id: e.target.value})}>
                            <option value="">Time B</option>
                            {todosTimes.map(t => <option key={t.id} value={t.id}>{t.nome_equipe}</option>)}
                        </select>
                        <button onClick={criarJogoManual} disabled={loading} className="bg-slate-900 text-white px-6 py-3 rounded-xl font-black text-xs hover:bg-black uppercase flex items-center gap-2">
                            {loading ? <Loader2 className="animate-spin" size={14}/> : <PlusCircle size={14}/>} Adicionar
                        </button>
                    </div>
                </div>
            </div>
        ) : (
            <div className="text-center p-20 bg-slate-100 rounded-3xl border border-dashed border-slate-300">
                <Trophy className="mx-auto text-slate-300 mb-4" size={64}/>
                <p className="text-slate-500 font-bold text-lg">Selecione ou Crie uma Etapa acima para começar.</p>
            </div>
        )}
      </div>
    </main>
  )
}

function GameCard({ jogo, onUpdate, busy, pin }) {
  const [ga, setGa] = useState(jogo.gols_a ?? '')
  const [gb, setGb] = useState(jogo.gols_b ?? '')
  const [pa, setPa] = useState(jogo.penaltis_a ?? '')
  const [pb, setPb] = useState(jogo.penaltis_b ?? '')
  const [showPenalties, setShowPenalties] = useState(jogo.penaltis_a !== null || jogo.penaltis_b !== null)

  const [editData, setEditData] = useState(jogo.data_jogo ?? '')
  const [editHora, setEditHora] = useState(jogo.horario ? String(jogo.horario).slice(0,5) : '')
  const [editJuiz, setEditJuiz] = useState(jogo.arbitro ?? '')
  const [isEditing, setIsEditing] = useState(false)

  const [open, setOpen] = useState(false)
  const [eventos, setEventos] = useState([])
  const [atletasA, setAtletasA] = useState([])
  const [atletasB, setAtletasB] = useState([])
  
  const [novo, setNovo] = useState({ tipo: 'GOL', equipe: 'A', atleta_id: '', minuto: '', camisa_no_jogo: '', observacao: '' })

  const nomeA = jogo?.equipeA?.nome_equipe || 'Equipe A'
  const nomeB = jogo?.equipeB?.nome_equipe || 'Equipe B'
  const dataFormatada = jogo.data_jogo ? new Date(jogo.data_jogo + 'T00:00:00').toLocaleDateString('pt-BR', {day:'2-digit', month:'2-digit'}) : '';
  const horaFormatada = jogo.horario ? String(jogo.horario).slice(0, 5) : '--:--';

  let statusBadge = "bg-slate-100 text-slate-500", statusText = "Agendado"
  if (jogo.status === 'EM_ANDAMENTO') { statusBadge = "bg-green-100 text-green-700 animate-pulse border-green-200 shadow-sm"; statusText = "Ao Vivo ●" }
  else if (jogo.status === 'FINALIZADO') { statusBadge = "bg-slate-800 text-white shadow-sm"; statusText = "Finalizado" }

  const labelTipo = jogo.tipo_jogo === 'FINAL' ? '🏆 FINAL' : jogo.tipo_jogo === 'DISPUTA_3' ? '🥉 3º LUGAR' : `RODADA ${jogo.rodada}`;

  async function loadSumula() {
    try {
      const [ev, ra, rb] = await Promise.all([
        fetch(`/api/admin/jogos/eventos?jogo_id=${jogo.id}`, { headers: { 'x-admin-pin': pin } }).then(r=>r.json()),
        fetch(`/api/admin/atletas?equipe_id=${jogo.equipe_a_id}`, { headers: { 'x-admin-pin': pin } }).then(r=>r.json()),
        fetch(`/api/admin/atletas?equipe_id=${jogo.equipe_b_id}`, { headers: { 'x-admin-pin': pin } }).then(r=>r.json()),
      ])
      setEventos(ev || []); setAtletasA(ra || []); setAtletasB(rb || [])
    } catch(e){}
  }

  async function toggleOpen() { if (!open) await loadSumula(); setOpen(!open); }

  async function addEvento() {
    const equipe_id = novo.equipe === 'A' ? jogo.equipe_a_id : jogo.equipe_b_id
    const atleta_id = novo.atleta_id ? Number(novo.atleta_id) : null
    await fetch('/api/admin/jogos/eventos', { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-admin-pin': pin }, body: JSON.stringify({ jogo_id: jogo.id, equipe_id, atleta_id, ...novo }) })
    await loadSumula(); setNovo({...novo, observacao: ''});
  }

  async function delEvento(id) { if (confirm('Excluir?')) { await fetch(`/api/admin/jogos/eventos?id=${id}`, { method: 'DELETE', headers: { 'x-admin-pin': pin } }); await loadSumula(); } }

  function saveInfo() { onUpdate({ action: 'update_info', id: jogo.id, data_jogo: editData, horario: editHora, arbitro: editJuiz }); setIsEditing(false); }

  function saveScore() {
      const payload = { 
          action: 'set_score', id: jogo.id, gols_a: ga, gols_b: gb,
          penaltis_a: showPenalties && pa !== '' ? pa : null,
          penaltis_b: showPenalties && pb !== '' ? pb : null
      }
      onUpdate(payload)
  }

  function renderEvento(ev) {
      const nomeTime = ev.equipe_id === jogo.equipe_a_id ? nomeA : nomeB
      const camisa = ev.camisa_no_jogo ? ` (#${ev.camisa_no_jogo})` : ''
      const min = ev.minuto ? `${ev.minuto}' ` : ''
      const obs = ev.observacao ? ` - ${ev.observacao}` : ''
      return `${min}${ev.tipo} • ${nomeTime}${camisa}${obs}`
  }

  return (
    <div className={`rounded-[2rem] border transition-all shadow-sm hover:shadow-lg ${jogo.status === 'FINALIZADO' ? 'bg-slate-50 border-slate-200' : 'bg-white border-slate-200'}`}>
      <div className="p-5 border-b border-slate-100 flex justify-between items-center bg-slate-50/50 rounded-t-[2rem]">
          <div className="flex items-center gap-3">
              <span className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase border ${statusBadge}`}>{statusText}</span>
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wide">{labelTipo}</span>
          </div>
          <div className="flex items-center gap-2">
              {isEditing ? (
                  <div className="flex items-center gap-1 bg-white p-1 rounded-xl border border-slate-200 shadow-lg absolute right-12 z-10">
                    <input className="border rounded-lg p-2 text-xs w-24 outline-none focus:border-blue-500 font-bold" type="text" placeholder="Juiz" value={editJuiz} onChange={e=>setEditJuiz(e.target.value)} />
                    <input className="border rounded-lg p-2 text-xs w-28 outline-none focus:border-blue-500 font-bold" type="date" value={editData} onChange={e=>setEditData(e.target.value)} />
                    <input className="border rounded-lg p-2 text-xs w-20 outline-none focus:border-blue-500 font-bold" type="time" value={editHora} onChange={e=>setEditHora(e.target.value)} />
                    <button onClick={saveInfo} className="bg-blue-600 text-white p-2 rounded-lg hover:bg-blue-700 shadow-md"><CheckCircle size={14}/></button>
                  </div>
              ) : (
                  <div className="flex items-center gap-3 group cursor-pointer hover:bg-slate-100 px-3 py-2 rounded-xl transition-all" onClick={() => setIsEditing(true)}>
                      {jogo.arbitro && <span className="text-[10px] font-bold text-slate-400 uppercase flex items-center gap-1"><User size={10}/> {jogo.arbitro}</span>}
                      <span className="text-xs font-bold text-slate-600 flex items-center gap-1"><Calendar size={12} className="text-blue-500"/> {dataFormatada || '--/--'}</span>
                      <span className="text-xs font-bold text-slate-600 flex items-center gap-1"><Clock size={12} className="text-blue-500"/> {horaFormatada}</span>
                      <Edit3 size={12} className="text-slate-300 opacity-0 group-hover:opacity-100 transition-opacity"/>
                  </div>
              )}
          </div>
      </div>

      <div className="p-8 relative">
          <button onClick={() => setShowPenalties(!showPenalties)} className={`absolute top-2 right-2 text-[10px] font-black px-2 py-1 rounded uppercase border transition-colors ${showPenalties ? 'bg-slate-800 text-white border-slate-800' : 'bg-white text-slate-300 border-slate-200 hover:text-slate-500'}`}>Pênaltis</button>

          <div className="flex justify-between items-center mb-8">
              <p className="font-black text-slate-800 text-center w-1/3 text-sm md:text-lg leading-tight">{nomeA}</p>
              <div className="text-center w-1/3 flex flex-col items-center justify-center gap-2">
                  <div className="flex items-center gap-3">
                    <input className="w-14 h-14 text-center text-3xl font-black bg-slate-50 rounded-2xl border border-slate-200 focus:border-blue-500 outline-none text-slate-900" value={ga} onChange={e=>setGa(e.target.value)} placeholder="0"/>
                    <span className="text-slate-300 font-black text-xl">:</span>
                    <input className="w-14 h-14 text-center text-3xl font-black bg-slate-50 rounded-2xl border border-slate-200 focus:border-blue-500 outline-none text-slate-900" value={gb} onChange={e=>setGb(e.target.value)} placeholder="0"/>
                  </div>
                  {showPenalties && (
                      <div className="flex items-center gap-2 animate-in fade-in slide-in-from-top-1">
                          <input className="w-8 h-8 text-center text-xs font-bold bg-slate-100 rounded-lg border border-slate-300 focus:border-blue-500 outline-none text-slate-600" value={pa} onChange={e=>setPa(e.target.value)} placeholder="P" />
                          <span className="text-[10px] font-bold text-slate-400 uppercase">Pênaltis</span>
                          <input className="w-8 h-8 text-center text-xs font-bold bg-slate-100 rounded-lg border border-slate-300 focus:border-blue-500 outline-none text-slate-600" value={pb} onChange={e=>setPb(e.target.value)} placeholder="P" />
                      </div>
                  )}
              </div>
              <p className="font-black text-slate-800 text-center w-1/3 text-sm md:text-lg leading-tight">{nomeB}</p>
          </div>

          <div className="flex justify-center gap-3">
              <button onClick={saveScore} className="bg-slate-100 p-3 rounded-xl text-slate-600 hover:bg-slate-200 hover:text-blue-600 transition-colors" title="Salvar Placar"><Save size={20}/></button>
              {jogo.status === 'EM_BREVE' && <button onClick={() => onUpdate({ action: 'set_status', id: jogo.id, status: 'EM_ANDAMENTO' })} className="bg-green-600 text-white px-6 py-2 rounded-xl font-black text-xs uppercase flex items-center gap-2 hover:bg-green-500 shadow-lg shadow-green-600/20 transition-all hover:scale-105"><PlayCircle size={18}/> Iniciar</button>}
              
              {/* BOTÃO REABRIR (NOVO) */}
              {jogo.status === 'FINALIZADO' && (
                  <div className="flex gap-2">
                      <span className="bg-slate-800 text-white px-6 py-2 rounded-xl font-black text-xs uppercase flex items-center gap-2 cursor-default"><StopCircle size={18}/> Encerrado</span>
                      <button onClick={() => onUpdate({ action: 'set_status', id: jogo.id, status: 'EM_ANDAMENTO' })} className="bg-blue-100 text-blue-600 px-4 py-2 rounded-xl font-bold text-xs uppercase hover:bg-blue-200 transition-colors" title="Reabrir Partida"><RotateCcw size={18}/></button>
                  </div>
              )}

              {jogo.status === 'EM_ANDAMENTO' && <button onClick={() => onUpdate({ action: 'set_status', id: jogo.id, status: 'FINALIZADO' })} className="bg-slate-900 text-white px-6 py-2 rounded-xl font-black text-xs uppercase flex items-center gap-2 hover:bg-black shadow-lg shadow-slate-900/20 transition-all hover:scale-105"><StopCircle size={18}/> Encerrar</button>}
              <button onClick={toggleOpen} className={`p-3 rounded-xl border transition-all ${open ? 'bg-blue-50 border-blue-200 text-blue-600' : 'bg-white border-slate-200 text-slate-400 hover:bg-slate-50'}`}><ClipboardList size={20}/></button>
          </div>
      </div>

      {open && (
        <div className="bg-slate-50 border-t border-slate-100 p-6 rounded-b-[2rem] animate-in fade-in slide-in-from-top-4">
            <div className="grid grid-cols-7 gap-3 mb-4">
                <select className="col-span-2 p-3 rounded-xl border border-slate-200 text-xs font-bold bg-white outline-none focus:border-blue-500" value={novo.tipo} onChange={e=>setNovo({...novo, tipo: e.target.value})}><option value="GOL">⚽ GOL</option><option value="AMARELO">🟨 AMARELO</option><option value="VERMELHO">🟥 VERMELHO</option></select>
                <select className="col-span-2 p-3 rounded-xl border border-slate-200 text-xs font-bold bg-white outline-none focus:border-blue-500" value={novo.equipe} onChange={e=>setNovo({...novo, equipe: e.target.value, atleta_id: ''})}><option value="A">{nomeA}</option><option value="B">{nomeB}</option></select>
                <select className="col-span-3 p-3 rounded-xl border border-slate-200 text-xs font-bold bg-white outline-none focus:border-blue-500" value={novo.atleta_id} onChange={e=>setNovo({...novo, atleta_id: e.target.value})}><option value="">Selecione Atleta...</option>{(novo.equipe === 'A' ? atletasA : atletasB).map(a=><option key={a.id} value={a.id}>{a.nome}</option>)}</select>
                <input className="col-span-1 p-3 rounded-xl border border-slate-200 text-xs font-bold outline-none focus:border-blue-500" placeholder="Min" value={novo.minuto} onChange={e=>setNovo({...novo, minuto: e.target.value})} />
                <input className="col-span-2 p-3 rounded-xl border border-slate-200 text-xs font-bold outline-none focus:border-blue-500" placeholder="Camisa" value={novo.camisa_no_jogo} onChange={e=>setNovo({...novo, camisa_no_jogo: e.target.value})} />
                <input className="col-span-2 p-3 rounded-xl border border-slate-200 text-xs font-bold outline-none focus:border-blue-500" placeholder="Obs..." value={novo.observacao} onChange={e=>setNovo({...novo, observacao: e.target.value})} />
                <button onClick={addEvento} className="col-span-2 bg-blue-600 text-white font-black rounded-xl py-2 text-xs uppercase hover:bg-blue-500 shadow-md transition-transform active:scale-95">Adicionar</button>
            </div>
            <div className="space-y-2">
                {eventos.map(ev => (
                    <div key={ev.id} className="flex justify-between items-center bg-white p-3 rounded-xl border border-slate-100 text-xs font-bold text-slate-600 shadow-sm hover:border-slate-200 transition-colors">
                        <span>{renderEvento(ev)}</span>
                        <button onClick={()=>delEvento(ev.id)} className="text-red-300 hover:text-red-500 transition-colors"><Trash2 size={14}/></button>
                    </div>
                ))}
                {eventos.length === 0 && <p className="text-center text-slate-400 text-xs font-medium py-4">Nenhum evento registrado na súmula.</p>}
            </div>
        </div>
      )}
    </div>
  )
}