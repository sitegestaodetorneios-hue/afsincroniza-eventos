'use client'

import { useState, useEffect, Suspense, useRef } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import { Trophy, Sparkles, RefreshCcw, Save, Users, ChevronLeft, Volume2, Play, CheckCircle2, Circle, Loader2 } from 'lucide-react'

function SorteioContent() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const etapaId = searchParams.get('etapa_id')
  
  const [equipes, setEquipes] = useState([])
  const [selecionadas, setSelecionadas] = useState([])
  const [pote, setPote] = useState([])
  const [grupoA, setGrupoA] = useState([])
  const [grupoB, setGrupoB] = useState([])
  const [sorteando, setSorteando] = useState(false)
  const [fase, setFase] = useState('selecao')
  const [loading, setLoading] = useState(true)
  
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

  // --- GERADOR DE SOM SINTETIZADO (PARA LOCALHOST) ---
  const playSfx = (tipo) => {
    try {
      if (!audioCtx.current) audioCtx.current = new (window.AudioContext || window.webkitAudioContext)()
      const ctx = audioCtx.current
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.connect(gain)
      gain.connect(ctx.destination)

      if (tipo === 'suspense') {
        osc.type = 'triangle'
        osc.frequency.setValueAtTime(100, ctx.currentTime)
        osc.frequency.exponentialRampToValueAtTime(250, ctx.currentTime + 2.5)
        gain.gain.setValueAtTime(0.3, ctx.currentTime)
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 2.5)
        osc.start()
        osc.stop(ctx.currentTime + 2.5)
      } else if (tipo === 'revelacao') {
        osc.type = 'sine'
        osc.frequency.setValueAtTime(880, ctx.currentTime)
        gain.gain.setValueAtTime(0.5, ctx.currentTime)
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.5)
        osc.start()
        osc.stop(ctx.currentTime + 0.5)
      }
    } catch (e) { console.log("Erro áudio:", e) }
  }

  const anunciarVozLocutor = (equipe, chave) => {
    if (typeof window !== 'undefined' && window.speechSynthesis) {
      window.speechSynthesis.cancel()
      const msg = new SpeechSynthesisUtterance()
      msg.text = `Atenção... , , Equipe sorteada: , , ${equipe}! . . . Vai para o Grupo ${chave}.`
      msg.lang = 'pt-BR'
      const voices = window.speechSynthesis.getVoices()
      const vozFifa = voices.find(v => (v.name.includes('Google') || v.name.includes('Daniel') || v.name.includes('Antonio')) && v.lang.includes('pt-BR'))
      if (vozFifa) msg.voice = vozFifa
      msg.rate = 0.85
      msg.pitch = 0.8 
      window.speechSynthesis.speak(msg)
    }
  }

  const sortearProximo = () => {
    if (pote.length === 0 || sorteando) return
    setSorteando(true)
    playSfx('suspense')

    setTimeout(() => {
      const randomIndex = Math.floor(Math.random() * pote.length)
      const escolhida = pote[randomIndex]
      let chave = ""

      if (grupoA.length <= grupoB.length) {
        setGrupoA(prev => [...prev, escolhida]); chave = "A"
      } else {
        setGrupoB(prev => [...prev, escolhida]); chave = "B"
      }

      playSfx('revelacao')
      anunciarVozLocutor(escolhida.nome_equipe, chave)
      setPote(prev => prev.filter((_, i) => i !== randomIndex))
      setSorteando(false)
    }, 2800)
  }

  const prepararShow = () => {
    if (!audioCtx.current) audioCtx.current = new (window.AudioContext || window.webkitAudioContext)()
    setPote(selecionadas)
    setFase('sorteio')
  }

  // --- FUNÇÃO DE SALVAMENTO CORRIGIDA ---
  const salvarESair = async () => {
    setLoading(true)
    const sorteio = [
      ...grupoA.map(e => ({ equipe_id: e.equipe_id, grupo: 'A' })),
      ...grupoB.map(e => ({ equipe_id: e.equipe_id, grupo: 'B' }))
    ]
    
    try {
      const res = await fetch('/api/admin/etapas/sortear-grupos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-admin-pin': '2026' },
        body: JSON.stringify({ 
          etapa_id: Number(etapaId), 
          sorteio_manual: sorteio 
        })
      })

      if (res.ok) {
        router.back()
      } else {
        throw new Error("Falha na API")
      }
    } catch (e) {
      alert("Erro ao salvar o sorteio. Verifique a conexão.")
      setLoading(false)
    }
  }

  if (loading) return (
    <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center text-white">
      <Loader2 className="animate-spin text-blue-600 mb-4" size={48} />
      <span className="font-black uppercase tracking-widest italic">Processando Dados...</span>
    </div>
  )

  return (
    <main className="min-h-screen bg-slate-950 text-white p-6 md:p-12 font-sans overflow-hidden bg-[radial-gradient(circle_at_top,_var(--tw-gradient-stops))] from-blue-900/20 via-slate-950 to-slate-950">
      <div className="max-w-7xl mx-auto">
        
        {/* HEADER */}
        <div className="flex justify-between items-center mb-16">
           <button onClick={() => router.back()} className="group flex items-center gap-2 text-slate-500 hover:text-white font-black uppercase text-[10px] tracking-widest transition-all">
              <ChevronLeft size={18} /> Voltar
           </button>
           <div className="text-right">
              <h1 className="text-5xl md:text-7xl font-black italic uppercase tracking-tighter leading-none text-transparent bg-clip-text bg-gradient-to-b from-white to-slate-500">
                SORTEIO <span className="text-blue-600">PREMIUM</span>
              </h1>
              <p className="text-[10px] font-bold text-blue-400 uppercase tracking-[0.4em] mt-2 italic">Ronaldo Cescon Enterprise • Padrão FIFA</p>
           </div>
        </div>

        {fase === 'selecao' ? (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            <div className="bg-slate-900/30 border border-white/5 p-12 rounded-[4rem] backdrop-blur-xl shadow-2xl">
              <h2 className="text-2xl font-black uppercase italic text-center mb-10 tracking-widest text-blue-400">Times Confirmados</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-5 mb-12">
                {equipes.map(eq => {
                  const active = selecionadas.find(s => s.id === eq.id)
                  return (
                    <button key={eq.id} onClick={() => active ? setSelecionadas(selecionadas.filter(s => s.id !== eq.id)) : setSelecionadas([...selecionadas, eq])} className={`p-6 rounded-[2rem] border-2 transition-all flex justify-between items-center group ${active ? 'bg-blue-600 border-blue-400 shadow-xl' : 'bg-slate-900 border-slate-800 text-slate-500 hover:border-blue-900'}`}>
                      <span className="font-black uppercase italic text-sm truncate mr-2">{eq.nome_equipe}</span>
                      {active ? <CheckCircle2 size={20} className="text-white"/> : <Circle size={20}/>}
                    </button>
                  )
                })}
              </div>
              <div className="flex justify-center">
                <button onClick={prepararShow} disabled={selecionadas.length < 2} className="bg-white text-slate-950 font-black px-20 py-8 rounded-full uppercase italic tracking-widest hover:bg-blue-600 hover:text-white transition-all shadow-2xl flex items-center gap-4 text-2xl">
                  <Play size={28} /> PREPARAR SHOW
                </button>
              </div>
            </div>
          </motion.div>
        ) : (
          <div className="grid lg:grid-cols-3 gap-12 items-start">
            <div className="bg-gradient-to-b from-blue-900/20 to-transparent border border-white/5 p-10 rounded-[4rem] shadow-2xl min-h-[500px]">
              <h2 className="text-blue-500 font-black italic uppercase text-3xl mb-10 border-b border-blue-500/20 pb-6 flex justify-between">GRUPO A <Users size={24}/></h2>
              <div className="space-y-4">
                <AnimatePresence>
                  {grupoA.map((eq, i) => (
                    <motion.div key={eq.id} initial={{ x: -50, opacity: 0 }} animate={{ x: 0, opacity: 1 }} className="bg-white/5 p-6 rounded-3xl flex justify-between items-center border border-white/5 shadow-lg">
                      <span className="font-black uppercase italic text-lg">{eq.nome_equipe}</span>
                      <span className="bg-blue-600 text-white px-4 py-1 rounded-full font-black text-xs italic">A{i+1}</span>
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>
            </div>

            <div className="flex flex-col items-center">
              <div className="relative mb-20">
                <motion.div animate={{ rotate: sorteando ? 360 : 0, scale: sorteando ? [1, 1.1, 1] : 1 }} transition={{ duration: 1.2, repeat: sorteando ? Infinity : 0, ease: "linear" }} className="w-72 h-72 rounded-full border-[20px] border-slate-900 border-t-blue-600 flex flex-col items-center justify-center bg-slate-950 shadow-[0_0_80px_rgba(37,99,235,0.2)]">
                  <span className="text-8xl font-black text-white italic">{pote.length}</span>
                </motion.div>
                {sorteando && <div className="absolute inset-0 bg-blue-600/40 rounded-full blur-[120px] animate-pulse" />}
              </div>

              <button onClick={sortearProximo} disabled={sorteando || pote.length === 0} className="w-full bg-white text-slate-950 font-black px-10 py-10 rounded-[3rem] uppercase italic text-3xl hover:bg-blue-600 hover:text-white transition-all shadow-2xl flex flex-col items-center gap-2">
                {sorteando ? <RefreshCcw className="animate-spin" size={40}/> : <div className="flex items-center gap-4"><Volume2 size={36}/> SORTEAR BOLA</div>}
              </button>

              {pote.length === 0 && grupoA.length > 0 && (
                <button 
                  onClick={salvarESair} 
                  className="mt-12 bg-green-600 hover:bg-green-500 text-white font-black px-16 py-6 rounded-3xl uppercase italic tracking-widest text-sm shadow-[0_0_30px_rgba(34,197,94,0.3)] animate-bounce flex items-center gap-3"
                >
                  <Save size={20} /> FINALIZAR SORTEIO
                </button>
              )}
            </div>

            <div className="bg-gradient-to-b from-slate-900/40 to-transparent border border-white/5 p-10 rounded-[4rem] shadow-2xl min-h-[500px]">
              <h2 className="text-slate-400 font-black italic uppercase text-3xl mb-10 border-b border-white/10 pb-6 flex justify-between">GRUPO B <Users size={24}/></h2>
              <div className="space-y-4">
                <AnimatePresence>
                  {grupoB.map((eq, i) => (
                    <motion.div key={eq.id} initial={{ x: 50, opacity: 0 }} animate={{ x: 0, opacity: 1 }} className="bg-white/5 p-6 rounded-3xl flex justify-between items-center border border-white/5 shadow-lg">
                      <span className="font-black uppercase italic text-lg">{eq.nome_equipe}</span>
                      <span className="bg-slate-700 text-white px-4 py-1 rounded-full font-black text-xs italic">B{i+1}</span>
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>
            </div>
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