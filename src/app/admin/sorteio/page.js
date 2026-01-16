'use client'

import { useState, useEffect, Suspense, useRef } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { motion, AnimatePresence, useAnimation } from 'framer-motion'
import { Trophy, Users, ChevronLeft, Volume2, Play, CheckCircle2, Circle, Loader2, Swords, Sparkles, RefreshCcw, Save, Mic } from 'lucide-react'

// --- CONFIGURAÇÕES VISUAIS ---
const CARD_WIDTH = 220 
const CARD_GAP = 10    
const GIRO_DURATION = 6 

// --- COMPONENTE ROLETA BLAZE (Ajustado) ---
function BlazeRoulette({ items, onSpinEnd, vencedorParaGirar }) {
  const [faixa, setFaixa] = useState([])
  const [ultimoVencedor, setUltimoVencedor] = useState(null)
  const [resetIndex, setResetIndex] = useState(0) // Força a animação a reiniciar
  const controls = useAnimation()
  
  // Inicializa visualmente
  useEffect(() => {
    if (items.length > 0 && faixa.length === 0) {
      setFaixa(items.slice(0, 15))
    }
  }, [items, faixa.length])

  // Monitora comando de girar
  useEffect(() => {
    if (vencedorParaGirar) {
      girarRoleta(vencedorParaGirar)
    }
  }, [vencedorParaGirar])

  const girarRoleta = async (target) => {
    // 1. O PONTO DE PARTIDA
    const startItem = ultimoVencedor || items[0] || { nome_equipe: '...' }
    
    // 2. GERAR FITA SEM REPETIÇÃO COLADA
    // Isso evita "Time A" do lado de "Time A"
    let fillers = []
    let lastAdded = startItem.id

    for (let i = 0; i < 60; i++) { 
        let randomItem
        let tentativas = 0
        // Tenta achar um time diferente do anterior (máximo 5 tentativas para não travar se tiver só 1 time)
        do {
            randomItem = items[Math.floor(Math.random() * items.length)]
            tentativas++
        } while (randomItem.id === lastAdded && items.length > 1 && tentativas < 5)
        
        fillers.push(randomItem)
        lastAdded = randomItem.id
    }

    // Garante que o item antes do Vencedor também não seja ele mesmo
    if (fillers[fillers.length - 1].id === target.id && items.length > 1) {
        fillers[fillers.length - 1] = items.find(t => t.id !== target.id) || fillers[fillers.length - 1]
    }

    // Monta a fita final
    const novaFaixa = [startItem, ...fillers, target, ...items.slice(0, 5)]
    setFaixa(novaFaixa)
    
    // Força o React a recriar o componente da fita (Isso corrige o bug de não girar na 2ª vez)
    setResetIndex(prev => prev + 1)

    // 3. ANIMAÇÃO
    setTimeout(async () => {
        const targetIndex = 61 // 1 (start) + 60 (fillers)
        const centerOffset = 360 // Ajuste para centralizar na tela
        const pixelParada = -((targetIndex * (CARD_WIDTH + CARD_GAP)) - centerOffset)

        // Reseta posição (invisível pois o elemento foi recriado)
        await controls.start({ x: 0, transition: { duration: 0 } })

        // Gira suave
        await controls.start({ 
            x: pixelParada, 
            transition: { 
                duration: GIRO_DURATION, 
                ease: [0.15, 0.85, 0.35, 1] // Curva "S" suave (Casino Style)
            } 
        })

        // Finaliza
        setUltimoVencedor(target)
        onSpinEnd()
    }, 50) 
  }

  return (
    <div className="flex flex-col items-center w-full relative overflow-hidden">
        {/* SETAS INDICADORAS */}
        <div className="absolute z-30 top-0 left-1/2 -translate-x-1/2 -mt-2 filter drop-shadow-lg">
            <div className="w-0 h-0 border-l-[15px] border-l-transparent border-r-[15px] border-r-transparent border-t-[25px] border-t-yellow-400"></div>
        </div>
        <div className="absolute z-30 bottom-0 left-1/2 -translate-x-1/2 -mb-2 filter drop-shadow-lg">
            <div className="w-0 h-0 border-l-[15px] border-l-transparent border-r-[15px] border-r-transparent border-b-[25px] border-b-yellow-400"></div>
        </div>
        
        {/* LINHA LASER */}
        <div className="absolute z-20 top-0 bottom-0 left-1/2 w-[2px] bg-yellow-500/40 h-full pointer-events-none shadow-[0_0_15px_yellow]"></div>

        {/* JANELA */}
        <div className="w-full max-w-5xl h-[240px] bg-[#0f172a] border-y-[4px] border-slate-700 relative overflow-hidden shadow-[inset_0_0_50px_rgba(0,0,0,0.8)] flex items-center rounded-xl">
            <motion.div 
                key={resetIndex} // O segredo da re-animação
                animate={controls}
                className="flex items-center pl-4"
                style={{ display: 'flex', gap: `${CARD_GAP}px` }} 
            >
                {faixa.map((time, i) => (
                    <div key={`${time.id}-${i}`} className="shrink-0 relative" style={{ width: CARD_WIDTH, height: 160 }}>
                        <div className={`
                            w-full h-full rounded-xl flex flex-col items-center justify-center p-2 text-center 
                            bg-gradient-to-b from-slate-800 to-slate-900 border-2 border-slate-600 shadow-xl
                            relative overflow-hidden group
                        `}>
                            {/* Ícone com Cor Baseada no ID (Resolve o problema de ser sempre amarelo) */}
                            <div className="w-14 h-14 bg-slate-950 rounded-full mb-3 flex items-center justify-center border border-white/5 shadow-inner">
                                <Trophy 
                                    size={24} 
                                    className={time.id % 2 === 0 ? "text-blue-500" : "text-yellow-500"}
                                />
                            </div>
                            
                            <span className="text-sm font-black uppercase text-white leading-tight line-clamp-2 drop-shadow-md px-1">
                                {time.nome_equipe}
                            </span>
                        </div>
                    </div>
                ))}
            </motion.div>
            
            {/* Sombras Laterais */}
            <div className="absolute inset-y-0 left-0 w-40 bg-gradient-to-r from-[#0F172A] via-[#0F172A]/90 to-transparent z-10 pointer-events-none"/>
            <div className="absolute inset-y-0 right-0 w-40 bg-gradient-to-l from-[#0F172A] via-[#0F172A]/90 to-transparent z-10 pointer-events-none"/>
        </div>
    </div>
  )
}

function SorteioContent() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const etapaId = searchParams.get('etapa_id')
  
  // Estados
  const [equipes, setEquipes] = useState([])
  const [selecionadas, setSelecionadas] = useState([])
  const [pote, setPote] = useState([])
  const [grupoA, setGrupoA] = useState([])
  const [grupoB, setGrupoB] = useState([])
  
  // Controles
  const [sorteando, setSorteando] = useState(false)
  const [vencedorAtual, setVencedorAtual] = useState(null)
  
  // Animação Final
  const [confrontosVisuais, setConfrontosVisuais] = useState([])
  const [indiceConfronto, setIndiceConfronto] = useState(-1)
  const [showTerminado, setShowTerminado] = useState(false)
  
  // Sistema
  const [statusSalvamento, setStatusSalvamento] = useState('')
  const [fase, setFase] = useState('selecao')
  const [loading, setLoading] = useState(true)
  
  const vozRef = useRef(null)
  const audioCtx = useRef(null)

  useEffect(() => {
    if (!etapaId) return
    fetch(`/api/admin/etapas/gerenciar-times?etapa_id=${etapaId}`, { headers: { 'x-admin-pin': '2026' } })
      .then(res => res.json())
      .then(data => {
        setEquipes(Array.isArray(data) ? data : [])
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [etapaId])

  // --- CONFIGURAÇÃO DA VOZ (Forçar Homem/Google) ---
  useEffect(() => {
    const carregarVozes = () => {
        if (typeof window === 'undefined' || !window.speechSynthesis) return;
        
        const voices = window.speechSynthesis.getVoices();
        
        // Prioridade 1: Google Português do Brasil (Masculina no Chrome)
        // Prioridade 2: Microsoft Daniel (Masculina no Edge/Windows)
        // Prioridade 3: Qualquer pt-BR que não seja "Maria" (geralmente feminina)
        const vozMasc = voices.find(v => v.name.includes('Google Português do Brasil')) 
                     || voices.find(v => v.lang === 'pt-BR' && v.name.includes('Daniel'))
                     || voices.find(v => v.lang === 'pt-BR');
        
        if (vozMasc) {
            vozRef.current = vozMasc;
        }
    };

    if (typeof window !== 'undefined' && window.speechSynthesis) {
        window.speechSynthesis.onvoiceschanged = carregarVozes;
        // Tenta carregar imediatamente (alguns browsers já têm pronto)
        carregarVozes();
        // Tenta de novo em 1s (fix para Chrome as vezes demorar)
        setTimeout(carregarVozes, 1000);
    }
  }, [])

  const falar = (texto) => {
    if (typeof window !== 'undefined' && window.speechSynthesis) {
      window.speechSynthesis.cancel() // Para a fala anterior
      const msg = new SpeechSynthesisUtterance()
      msg.text = texto
      msg.lang = 'pt-BR'
      msg.rate = 1.1
      msg.pitch = 0.9 // Tom levemente grave
      
      if (vozRef.current) {
          msg.voice = vozRef.current;
      }
      
      window.speechSynthesis.speak(msg)
    }
  }

  // --- EFEITOS SONOROS ---
  const playSfx = (tipo) => {
    try {
      if (!audioCtx.current) audioCtx.current = new (window.AudioContext || window.webkitAudioContext)()
      const ctx = audioCtx.current
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.connect(gain)
      gain.connect(ctx.destination)

      if (tipo === 'roleta') { 
        const now = ctx.currentTime;
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(50, now);
        osc.frequency.linearRampToValueAtTime(600, now + 1); 
        osc.frequency.linearRampToValueAtTime(100, now + GIRO_DURATION);
        gain.gain.setValueAtTime(0.05, now);
        gain.gain.linearRampToValueAtTime(0, now + GIRO_DURATION);
        osc.start();
        osc.stop(now + GIRO_DURATION);
      } else if (tipo === 'impacto') { 
        const now = ctx.currentTime;
        osc.type = 'square';
        osc.frequency.setValueAtTime(120, now);
        osc.frequency.exponentialRampToValueAtTime(0.01, now + 0.4);
        gain.gain.setValueAtTime(0.2, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.4);
        osc.start();
        osc.stop(now + 0.4);
      }
    } catch (e) {}
  }

  // Frases Humanizadas
  const frasesIntro = ["Quem será o próximo? ", "Atenção para o sorteio... ", "Quem vem agora? "]
  const frasesGrupo = ["Vai para o ", "Caiu no ", "Joga no "]

  // --- LÓGICA DE SORTEIO ---
  const sortearProximo = () => {
    if (pote.length === 0 || sorteando) return
    
    const randomIndex = Math.floor(Math.random() * pote.length)
    const escolhida = pote[randomIndex]
    
    setVencedorAtual(escolhida) 
    setSorteando(true)
    playSfx('roleta')
  }

  const onRoletaParou = () => {
    if (!vencedorAtual) return

    playSfx('impacto')
    
    const nomeGrupo = (grupoA.length <= grupoB.length) ? "Grupo A" : "Grupo B"
    const fraseMeio = frasesGrupo[Math.floor(Math.random() * frasesGrupo.length)]

    falar(`${vencedorAtual.nome_equipe}... ${fraseMeio} ${nomeGrupo}.`)

    // Pequeno delay para ler o nome antes de mover
    setTimeout(() => {
        if (grupoA.length <= grupoB.length) {
            setGrupoA(prev => [...prev, vencedorAtual])
        } else {
            setGrupoB(prev => [...prev, vencedorAtual])
        }
        
        setPote(prev => prev.filter(t => t.id !== vencedorAtual.id))
        setVencedorAtual(null) 
        setSorteando(false)
    }, 2500) 
  }

  const prepararShow = () => {
    setPote(selecionadas)
    setFase('sorteio')
  }

  const narrarConfronto = (timeA, timeB) => {
      const intros = ["Grande jogo !", "Duelo :", "Em campo :"]
      const intro = intros[Math.floor(Math.random() * intros.length)]
      falar(`${intro} ${timeA.nome_equipe}... contra ... ${timeB.nome_equipe}!`)
  }

  const iniciarConfrontos = () => {
      setFase('confrontos')
      const lista = []
      const max = Math.max(grupoA.length, grupoB.length)
      for (let i = 0; i < max; i++) {
          if (grupoA[i] && grupoB[i]) {
              lista.push({ a: grupoA[i], b: grupoB[i], jogo: i + 1 })
          }
      }
      setConfrontosVisuais(lista)
      
      falar("Atenção torcedores! Definindo os confrontos. ")
      
      let idx = 0
      setIndiceConfronto(idx)
      
      setTimeout(() => {
          if(lista[0]) narrarConfronto(lista[0].a, lista[0].b)
      }, 2000)

      const interval = setInterval(() => {
          idx++
          if (idx < lista.length) {
              setIndiceConfronto(idx)
              narrarConfronto(lista[idx].a, lista[idx].b)
          } else {
              clearInterval(interval)
              setTimeout(() => {
                  setShowTerminado(true)
                  falar("Sorteio Finalizado  e  Tabela pronta.")
              }, 4000)
          }
      }, 7000)
  }

  const salvarESair = async () => {
    setLoading(true)
    setStatusSalvamento('Salvando Ordem...')
    
    const sorteioPayload = [
      ...grupoA.map((e, index) => ({ equipe_id: e.id, grupo: 'A', ordem: index + 1 })),
      ...grupoB.map((e, index) => ({ equipe_id: e.id, grupo: 'B', ordem: index + 1 }))
    ]
    
    try {
      await fetch('/api/admin/etapas/sortear-grupos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-admin-pin': '2026' },
        body: JSON.stringify({ etapa_id: Number(etapaId), sorteio_manual: sorteioPayload })
      })

      setStatusSalvamento('Gerando Tabela...')
      await new Promise(r => setTimeout(r, 1000));

      const idsA = grupoA.map(t => Number(t.id));
      const idsB = grupoB.map(t => Number(t.id));

      const resJogos = await fetch('/api/admin/sorteio', { 
        method: 'POST', 
        headers: { 'Content-Type': 'application/json', 'x-admin-pin': '2026' }, 
        body: JSON.stringify({ 
            etapa_id: Number(etapaId), 
            modo: 'BINGO', 
            limpar_existentes: true,
            times_ordenados_a: idsA,
            times_ordenados_b: idsB
        }) 
      })

      const dataJogos = await resJogos.json()
      if (dataJogos.error) throw new Error(dataJogos.error)

      router.push('/admin/jogos')

    } catch (e) {
      alert("Erro: " + e.message)
      setLoading(false)
    }
  }

  if (loading) return <div className="min-h-screen bg-slate-950 flex items-center justify-center text-white"><Loader2 className="animate-spin mr-2"/> {statusSalvamento || 'Carregando...'}</div>

  const jogoAtual = confrontosVisuais[indiceConfronto]

  return (
    <main className="min-h-screen bg-[#0F172A] text-white p-4 md:p-8 font-sans overflow-hidden bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-blue-900/20 via-[#0F172A] to-[#020617]">
      <div className="max-w-[1600px] mx-auto">
        
        <div className="flex justify-between items-end mb-8 border-b border-white/5 pb-6">
           <button onClick={() => router.back()} className="flex items-center gap-2 text-slate-500 hover:text-white uppercase text-xs font-bold tracking-widest transition-all"><ChevronLeft size={16} /> Voltar</button>
           <div className="text-right">
             <div className="flex items-center gap-2 justify-end mb-1">
                <span className="w-2 h-2 bg-red-500 rounded-full animate-pulse"></span>
                <span className="text-[10px] font-black text-red-500 uppercase tracking-widest">Ao Vivo</span>
             </div>
             <h1 className="text-4xl md:text-5xl font-black italic uppercase tracking-tighter text-transparent bg-clip-text bg-gradient-to-r from-white to-slate-500">
               SORTEIO <span className="text-blue-600">PROFISSIONAL</span>
             </h1>
           </div>
        </div>

        {fase === 'selecao' && (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="max-w-5xl mx-auto">
            <div className="bg-slate-900/50 border border-white/10 p-8 rounded-[3rem] backdrop-blur-xl shadow-2xl">
              <div className="flex justify-between items-center mb-8">
                  <h2 className="text-2xl font-black uppercase italic tracking-wider flex items-center gap-3"><Users className="text-blue-500"/> Confirmar Presença</h2>
                  <span className="bg-blue-600/20 text-blue-400 px-4 py-1 rounded-full text-xs font-black uppercase">{selecionadas.length} Selecionados</span>
              </div>
              
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-12 max-h-[50vh] overflow-y-auto pr-2 custom-scrollbar">
                {equipes.map(eq => {
                  const active = selecionadas.find(s => s.id === eq.id)
                  return (
                    <button key={eq.id} onClick={() => active ? setSelecionadas(selecionadas.filter(s => s.id !== eq.id)) : setSelecionadas([...selecionadas, eq])} 
                      className={`relative p-4 rounded-2xl border transition-all flex flex-col items-center justify-center text-center gap-2 group overflow-hidden ${active ? 'bg-blue-600 border-blue-500 shadow-lg shadow-blue-900/50' : 'bg-slate-800/50 border-white/5 hover:border-white/20'}`}>
                      {active && <div className="absolute top-2 right-2"><CheckCircle2 size={16} className="text-white"/></div>}
                      <span className={`font-black uppercase italic text-sm ${active ? 'text-white' : 'text-slate-400 group-hover:text-white'}`}>{eq.nome_equipe}</span>
                    </button>
                  )
                })}
              </div>
              
              <div className="flex justify-center">
                <button onClick={prepararShow} disabled={selecionadas.length < 2} className="group relative px-12 py-6 bg-white text-slate-950 font-black text-xl rounded-full uppercase italic tracking-widest hover:scale-105 transition-all shadow-[0_0_40px_rgba(255,255,255,0.3)] disabled:opacity-50 disabled:hover:scale-100">
                  <span className="flex items-center gap-3 relative z-10"><Play size={24} fill="currentColor" /> Iniciar Sorteio</span>
                  <div className="absolute inset-0 rounded-full bg-blue-400 blur-xl opacity-0 group-hover:opacity-40 transition-opacity"/>
                </button>
              </div>
            </div>
          </motion.div>
        )}

        {fase === 'sorteio' && (
          <div className="grid lg:grid-cols-12 gap-8 items-start min-h-[600px]">
            {/* GRUPO A */}
            <div className="lg:col-span-3 space-y-4">
                <div className="bg-gradient-to-br from-blue-900/20 to-slate-900 border border-blue-500/30 p-6 rounded-[2rem] shadow-lg sticky top-8 min-h-[400px]">
                    <h2 className="text-blue-400 font-black italic uppercase text-2xl mb-6 flex justify-between border-b border-blue-500/20 pb-4">Grupo A <span className="bg-blue-500 text-white text-xs px-2 py-1 rounded-md">{grupoA.length}</span></h2>
                    <div className="space-y-3"><AnimatePresence>{grupoA.map((eq, i) => (<motion.div key={eq.id} initial={{ x: -20, opacity: 0 }} animate={{ x: 0, opacity: 1 }} className="bg-slate-800/80 p-3 rounded-xl border border-white/5 flex justify-between items-center shadow-md"><span className="font-bold uppercase text-xs text-white truncate max-w-[120px]">{eq.nome_equipe}</span><span className="font-black text-[10px] text-blue-400 bg-blue-950 px-2 py-1 rounded">A{i+1}</span></motion.div>))}</AnimatePresence></div>
                </div>
            </div>

            {/* ROLETA CENTRAL */}
            <div className="lg:col-span-6 flex flex-col items-center justify-start pt-4">
                <div className="w-full mb-8 relative">
                    <BlazeRoulette 
                        items={pote} 
                        vencedorParaGirar={vencedorAtual} 
                        onSpinEnd={onRoletaParou}         
                    />
                </div>

                <div className="w-full flex justify-center mt-8">
                    {!sorteando && pote.length > 0 && (
                        <button onClick={sortearProximo} className="group relative w-full max-w-sm bg-gradient-to-b from-blue-500 to-blue-700 hover:from-blue-400 hover:to-blue-600 text-white font-black py-6 rounded-2xl uppercase italic text-2xl shadow-[0_0_30px_rgba(59,130,246,0.4)] transition-all flex items-center justify-center gap-3 border-t-4 border-blue-400">
                            <span className="flex items-center gap-2"><Mic className="w-6 h-6 animate-pulse"/> SORTEAR</span>
                        </button>
                    )}
                    {sorteando && <div className="text-white font-black uppercase tracking-widest animate-pulse flex items-center gap-2"><Loader2 className="animate-spin"/> Sorteando...</div>}
                    {!sorteando && pote.length === 0 && grupoA.length > 0 && (
                        <motion.button initial={{ scale: 0 }} animate={{ scale: 1 }} onClick={iniciarConfrontos} className="w-full max-w-md bg-yellow-500 hover:bg-yellow-400 text-slate-900 font-black py-4 rounded-2xl uppercase italic tracking-wider shadow-[0_0_30px_rgba(234,179,8,0.4)] flex items-center justify-center gap-2 animate-bounce"><Swords size={20}/> Revelar Jogos</motion.button>
                    )}
                </div>
                <div className="text-slate-600 font-bold uppercase text-[10px] tracking-widest mt-8">Restam {pote.length} times</div>
            </div>

            {/* GRUPO B */}
            <div className="lg:col-span-3 space-y-4">
                <div className="bg-gradient-to-bl from-slate-800/20 to-slate-900 border border-white/10 p-6 rounded-[2rem] shadow-lg sticky top-8 min-h-[400px]">
                    <h2 className="text-slate-400 font-black italic uppercase text-2xl mb-6 flex justify-between border-b border-white/10 pb-4">Grupo B <span className="bg-slate-700 text-white text-xs px-2 py-1 rounded-md">{grupoB.length}</span></h2>
                    <div className="space-y-3"><AnimatePresence>{grupoB.map((eq, i) => (<motion.div key={eq.id} initial={{ x: 20, opacity: 0 }} animate={{ x: 0, opacity: 1 }} className="bg-slate-800/80 p-3 rounded-xl border border-white/5 flex justify-between items-center shadow-md"><span className="font-bold uppercase text-xs text-slate-300 truncate max-w-[120px]">{eq.nome_equipe}</span><span className="font-black text-[10px] text-slate-500 bg-slate-950 px-2 py-1 rounded">B{i+1}</span></motion.div>))}</AnimatePresence></div>
                </div>
            </div>
          </div>
        )}

        {/* FASE 3: CONFRONTOS */}
        {fase === 'confrontos' && (
            <div className="flex flex-col items-center justify-center min-h-[60vh]">
                <AnimatePresence mode='wait'>
                    {!showTerminado && jogoAtual ? (
                        <motion.div key={jogoAtual.jogo} initial={{ scale: 0.9, opacity: 0, y: 50 }} animate={{ scale: 1, opacity: 1, y: 0 }} exit={{ scale: 1.1, opacity: 0 }} className="relative w-full max-w-4xl bg-slate-900/80 border border-white/10 p-12 rounded-[3rem] backdrop-blur-2xl shadow-2xl">
                            <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-yellow-500 text-slate-900 px-8 py-2 rounded-full font-black uppercase tracking-widest shadow-lg border-4 border-slate-950">Jogo {jogoAtual.jogo}</div>
                            <div className="flex flex-col md:flex-row items-center justify-between gap-12 mt-6">
                                <div className="text-center flex-1"><div className="w-32 h-32 mx-auto bg-blue-600 rounded-full flex items-center justify-center border-4 border-blue-400 shadow-[0_0_40px_rgba(37,99,235,0.5)] mb-4"><span className="text-4xl font-black italic text-white">A{jogoAtual.jogo}</span></div><h2 className="text-3xl md:text-4xl font-black uppercase italic text-white">{jogoAtual.a.nome_equipe}</h2></div>
                                <div className="relative"><span className="text-8xl font-black italic text-transparent bg-clip-text bg-gradient-to-b from-yellow-300 to-yellow-600 drop-shadow-[0_0_15px_rgba(234,179,8,0.5)]">VS</span></div>
                                <div className="text-center flex-1"><div className="w-32 h-32 mx-auto bg-slate-700 rounded-full flex items-center justify-center border-4 border-slate-500 shadow-[0_0_40px_rgba(100,116,139,0.3)] mb-4"><span className="text-4xl font-black italic text-slate-300">B{jogoAtual.jogo}</span></div><h2 className="text-3xl md:text-4xl font-black uppercase italic text-slate-400">{jogoAtual.b.nome_equipe}</h2></div>
                            </div>
                        </motion.div>
                    ) : showTerminado && (
                        <motion.div initial={{ scale: 0.5, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="text-center bg-slate-900/50 p-16 rounded-[4rem] border border-white/10 backdrop-blur-xl">
                            <Sparkles className="text-yellow-400 mx-auto mb-6 w-20 h-20 animate-spin-slow"/>
                            <h2 className="text-5xl md:text-7xl font-black uppercase italic text-white mb-6">Sorteio Finalizado!</h2>
                            <button onClick={salvarESair} disabled={loading} className="bg-green-600 hover:bg-green-500 text-white font-black px-16 py-6 rounded-2xl uppercase italic tracking-widest text-2xl shadow-[0_0_40px_rgba(34,197,94,0.4)] flex items-center gap-4 hover:scale-105 transition-all mx-auto">{loading ? <Loader2 className="animate-spin"/> : <Save size={28}/>} SALVAR TABELA</button>
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>
        )}
      </div>
    </main>
  )
}

export default function SorteioPage() {
  return (
    <Suspense fallback={<div className="bg-slate-950 min-h-screen"></div>}>
      <SorteioContent />
    </Suspense>
  )
}