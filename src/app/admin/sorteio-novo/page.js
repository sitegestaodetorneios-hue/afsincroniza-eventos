'use client'

import { useState, useEffect, Suspense, useRef, useMemo } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { motion, AnimatePresence, useAnimation } from 'framer-motion'
import {
  Trophy, Users, ChevronLeft, Play, CheckCircle2, Loader2,
  Sparkles, Save, Mic, Info, Star
} from 'lucide-react'
import { createClient } from '@supabase/supabase-js'
import { createPortal } from 'react-dom'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
)

// --- CONFIGURAÇÕES VISUAIS ---
const CARD_WIDTH = 220
const CARD_GAP = 10
const GIRO_DURATION = 6

// ============================================================
// ✅ FULLSCREEN PORTAL — garante centralização real na viewport
// (resolve o “vazio à esquerda / empurra para direita” quando
// a página está dentro de layout com sidebar/transform)
// ============================================================
function FullscreenPortal({ children }) {
  const [mounted, setMounted] = useState(false)
  useEffect(() => { setMounted(true) }, [])
  if (!mounted) return null
  return createPortal(children, document.body)
}

// ============================================================
// ✅ ÁUDIO (SFX) — com “desbloqueio” no primeiro clique
// ============================================================
function createSfx() {
  let ctx = null

  const ensureCtx = async () => {
    if (typeof window === 'undefined') return null
    const AudioContext = window.AudioContext || window.webkitAudioContext
    if (!AudioContext) return null
    if (!ctx) ctx = new AudioContext()
    if (ctx.state === 'suspended') {
      try { await ctx.resume() } catch {}
    }
    return ctx
  }

  const click = async () => { await ensureCtx() }

  const playSpin = async () => {
    const c = await ensureCtx()
    if (!c) return
    const now = c.currentTime

    // “Rumble” (base)
    const osc = c.createOscillator()
    const gain = c.createGain()
    const filter = c.createBiquadFilter()

    osc.type = 'sawtooth'
    filter.type = 'lowpass'

    filter.frequency.setValueAtTime(260, now)
    filter.frequency.linearRampToValueAtTime(90, now + GIRO_DURATION)

    gain.gain.setValueAtTime(0.0001, now)
    gain.gain.exponentialRampToValueAtTime(0.12, now + 0.05)
    gain.gain.exponentialRampToValueAtTime(0.0001, now + GIRO_DURATION)

    osc.connect(filter)
    filter.connect(gain)
    gain.connect(c.destination)

    osc.start(now)
    osc.stop(now + GIRO_DURATION)

    // “ticks” leves durante o giro
    const tickCount = 12
    for (let i = 0; i < tickCount; i++) {
      const t = now + (GIRO_DURATION * (i / tickCount))
      const o = c.createOscillator()
      const g = c.createGain()
      o.type = 'square'
      o.frequency.value = 820 + Math.random() * 120
      g.gain.setValueAtTime(0.0001, t)
      g.gain.exponentialRampToValueAtTime(0.03, t + 0.01)
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.06)
      o.connect(g); g.connect(c.destination)
      o.start(t); o.stop(t + 0.08)
    }
  }

  const playWin = async () => {
    const c = await ensureCtx()
    if (!c) return
    const now = c.currentTime
    const notes = [392.0, 523.25, 659.25, 783.99] // “crescendo” agradável

    notes.forEach((freq, i) => {
      const osc = c.createOscillator()
      const gain = c.createGain()
      osc.type = 'triangle'
      osc.frequency.value = freq
      const start = now + i * 0.085
      gain.gain.setValueAtTime(0.0001, start)
      gain.gain.exponentialRampToValueAtTime(0.16, start + 0.02)
      gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.9)
      osc.connect(gain)
      gain.connect(c.destination)
      osc.start(start)
      osc.stop(start + 1.0)
    })

    // “boom” suave
    const boomOsc = c.createOscillator()
    const boomGain = c.createGain()
    const boomFilter = c.createBiquadFilter()
    boomOsc.type = 'sine'
    boomFilter.type = 'lowpass'
    boomFilter.frequency.setValueAtTime(140, now)
    boomGain.gain.setValueAtTime(0.0001, now)
    boomGain.gain.exponentialRampToValueAtTime(0.18, now + 0.02)
    boomGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.55)
    boomOsc.frequency.setValueAtTime(120, now)
    boomOsc.frequency.exponentialRampToValueAtTime(60, now + 0.5)
    boomOsc.connect(boomFilter)
    boomFilter.connect(boomGain)
    boomGain.connect(c.destination)
    boomOsc.start(now)
    boomOsc.stop(now + 0.6)
  }

  return { click, playSpin, playWin }
}

// ============================================================
// ✅ VOZ (TTS) — narrador esportivo (masculino, “padrão fifa”)
// ============================================================
function useVoice() {
  const enabledRef = useRef(true)
  const voiceRef = useRef(null)

  const norm = (s) => (s || '').toLowerCase()

  const pickBestPtMale = () => {
    if (typeof window === 'undefined') return null
    const voices = window.speechSynthesis?.getVoices?.() || []
    if (!voices.length) return null

    const isPt = (v) => norm(v.lang).includes('pt')
    const isPtBR = (v) => norm(v.lang).includes('pt-br')

    const candidates = voices.filter(v => isPtBR(v) || isPt(v))
    if (!candidates.length) return voices[0] || null

    // ✅ prioridade: Microsoft Daniel (pt-BR) -> outros “Daniel” -> vozes masculinas comuns -> fallback
    const msDaniel =
      candidates.find(v => norm(v.name).includes('microsoft') && norm(v.name).includes('daniel')) ||
      candidates.find(v => norm(v.name).includes('daniel')) ||
      candidates.find(v => norm(v.name).includes('ricardo')) ||
      candidates.find(v => norm(v.name).includes('male')) ||
      candidates.find(v => norm(v.name).includes('masc')) ||
      null

    if (msDaniel) return msDaniel

    // se tiver Google pt-BR disponível, pega como fallback (pode ser feminino, mas é natural)
    const google = candidates.find(v => norm(v.name).includes('google'))
    if (google) return google

    return candidates[0] || voices[0] || null
  }

  useEffect(() => {
    if (typeof window === 'undefined') return
    const load = () => {
      const v = pickBestPtMale()
      if (v) voiceRef.current = v
    }
    window.speechSynthesis.onvoiceschanged = load
    const t1 = setTimeout(load, 120)
    const t2 = setTimeout(load, 600)
    const t3 = setTimeout(load, 1200)
    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3) }
  }, [])

  const setEnabled = (v) => { enabledRef.current = !!v }

  const clamp = (n, a, b) => Math.max(a, Math.min(b, n))
  const rand = (a, b) => a + Math.random() * (b - a)

  // ✅ narrador: voz mais “grave”, ritmo firme, pausas naturais
  const speakNarrador = (text, opts = {}) => {
    if (typeof window === 'undefined') return
    if (!enabledRef.current) return
    if (!text) return

    try {
      window.speechSynthesis.cancel()

      const baseRate = opts.rate ?? 1.06
      const basePitch = opts.pitch ?? 0.66
      const volume = opts.volume ?? 1.0
      const pauseMs = opts.pauseMs ?? 130

      const parts = String(text)
        .replace(/\s+/g, ' ')
        .trim()
        .split(/(?<=[.!?…])\s+/)
        .filter(Boolean)

      let i = 0
      const speakNext = () => {
        if (i >= parts.length) return

        const u = new SpeechSynthesisUtterance(parts[i])
        u.lang = 'pt-BR'
        u.voice = voiceRef.current || null

        u.rate = clamp(baseRate + rand(-0.02, 0.02), 0.92, 1.18)
        u.pitch = clamp(basePitch + rand(-0.02, 0.02), 0.55, 0.90)
        u.volume = volume

        u.onend = () => {
          i += 1
          setTimeout(speakNext, pauseMs)
        }

        window.speechSynthesis.speak(u)
      }

      speakNext()
    } catch {}
  }

  const speak = (text, opts = {}) => {
    if (typeof window === 'undefined') return
    if (!enabledRef.current) return
    if (!text) return

    try {
      window.speechSynthesis.cancel()
      const u = new SpeechSynthesisUtterance(text)
      u.lang = 'pt-BR'
      u.voice = voiceRef.current || null

      const baseRate = opts.rate ?? 1.02
      const basePitch = opts.pitch ?? 0.78

      u.rate = clamp(baseRate + rand(-0.02, 0.02), 0.90, 1.12)
      u.pitch = clamp(basePitch + rand(-0.02, 0.02), 0.65, 0.95)
      u.volume = opts.volume ?? 1.0

      window.speechSynthesis.speak(u)
    } catch {}
  }

  return { speak, speakNarrador, setEnabled }
}

// ============================================================
// UI: Barra de Patrocinadores (TOP — mais VIVO, sem grayscale)
// ============================================================
function SponsorsTicker({ patrocinadores }) {
  const lista = patrocinadores && patrocinadores.length > 0
    ? patrocinadores
    : [
        { nome_empresa: "Seu Patrocínio Aqui", banner_url: null },
        { nome_empresa: "Espaço Disponível", banner_url: null }
      ]

  const loop = [...lista, ...lista, ...lista, ...lista, ...lista]

  return (
    <div className="w-full border-y border-blue-500/20 py-3 overflow-hidden relative mb-6 backdrop-blur-md z-40 h-16 flex items-center bg-gradient-to-r from-[#020617] via-[#0B1224] to-[#020617]">
      <div className="absolute inset-y-0 left-0 w-32 bg-gradient-to-r from-[#0B1224] to-transparent z-10"/>
      <div className="absolute inset-y-0 right-0 w-32 bg-gradient-to-l from-[#0B1224] to-transparent z-10"/>

      <motion.div
        className="flex gap-16 whitespace-nowrap items-center"
        animate={{ x: [0, -2000] }}
        transition={{ repeat: Infinity, duration: 55, ease: "linear" }}
      >
        {loop.map((pat, i) => (
          <div
            key={i}
            className="flex items-center gap-3 opacity-95 hover:opacity-100 transition-all cursor-default"
          >
            {pat.banner_url ? (
              <img
                src={pat.banner_url}
                alt={pat.nome_empresa}
                className="h-10 w-auto object-contain max-w-[220px] drop-shadow-[0_6px_18px_rgba(37,99,235,0.25)] saturate-150"
              />
            ) : (
              <div className="flex items-center gap-2">
                <Star size={14} className="text-yellow-400 drop-shadow-[0_0_12px_rgba(250,204,21,0.45)]"/>
                <span className="font-black uppercase text-sm text-slate-100 tracking-widest drop-shadow-[0_2px_8px_rgba(0,0,0,0.55)]">
                  {pat.nome_empresa || "PARCEIRO"}
                </span>
              </div>
            )}
          </div>
        ))}
      </motion.div>
    </div>
  )
}

// ============================================================
// Algoritmos
// ============================================================

// ✅ Berger com FOLGA (quando ímpar)
function gerarConfrontosBerger(times) {
  if (times.length < 2) return []

  const mapTimes = times.length % 2 === 0 ? [...times] : [...times, null]
  const total = mapTimes.length
  const numRodadas = total - 1
  const jogosPorRodada = total / 2

  const rodadas = []
  for (let r = 0; r < numRodadas; r++) {
    const rodadaAtual = []
    for (let i = 0; i < jogosPorRodada; i++) {
      const t1 = mapTimes[i]
      const t2 = mapTimes[total - 1 - i]

      if (t1 && t2) {
        rodadaAtual.push({ a: t1, b: t2, bye: false })
      } else if (t1 && !t2) {
        rodadaAtual.push({ a: t1, b: null, bye: true })
      } else if (!t1 && t2) {
        rodadaAtual.push({ a: t2, b: null, bye: true })
      }
    }
    rodadas.push(rodadaAtual)
    mapTimes.splice(1, 0, mapTimes.pop())
  }
  return rodadas
}

function gerarCruzamentoRotativo(grupoA, grupoB) {
  const rodadas = []
  const lenA = grupoA.length
  const lenB = grupoB.length
  const totalLoops = Math.max(lenA, lenB)

  for (let r = 0; r < totalLoops; r++) {
    const jogosDaRodada = []
    for (let i = 0; i < lenA; i++) {
      const indexB = (i + r) % lenB
      jogosDaRodada.push({ a: grupoA[i], b: grupoB[indexB] })
    }
    rodadas.push(jogosDaRodada)
  }
  return rodadas
}

// ============================================================
// Rolete — LOGO DO TIME (sem patrocínio dentro da roleta)
// ============================================================
function BlazeRoulette({ items, onSpinEnd, vencedorParaGirar, patrocinadores, sfx }) {
  const [faixa, setFaixa] = useState([])
  const [resetIndex, setResetIndex] = useState(0)
  const containerRef = useRef(null)
  const controls = useAnimation()

  useEffect(() => {
    if (items.length > 0 && faixa.length === 0) {
      setFaixa(items.slice(0, 15))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items.length])

  useEffect(() => {
    if (vencedorParaGirar) girarRoleta(vencedorParaGirar)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vencedorParaGirar])

  const girarRoleta = async (target) => {
    await sfx.click()
    await sfx.playSpin()

    const startItem = (items[0] || { nome_equipe: '...', id: -1 })
    const targetItem = target

    let fillers = []
    let lastAdded = startItem?.id ?? -1

    for (let i = 0; i < 50; i++) {
      let randomItem
      do {
        randomItem = items[Math.floor(Math.random() * items.length)]
      } while (randomItem?.id === lastAdded && items.length > 1)

      fillers.push(randomItem)
      lastAdded = randomItem?.id
    }

    if (fillers[fillers.length - 1]?.id === target.id && items.length > 1) {
      const replacement = items.find(t => t.id !== target.id) || fillers[fillers.length - 1]
      fillers[fillers.length - 1] = replacement
    }

    const novaFaixa = [startItem, ...fillers, targetItem, ...items.slice(0, 3)]
    setFaixa(novaFaixa)
    setResetIndex(prev => prev + 1)

    const targetIndex = 51
    const distToTargetStart = targetIndex * (CARD_WIDTH + CARD_GAP)
    const containerWidth = containerRef.current ? containerRef.current.offsetWidth : 1200
    const stopPosition = -(distToTargetStart) + (containerWidth / 2) - (CARD_WIDTH / 2)

    setTimeout(async () => {
      await controls.start({ x: 0, transition: { duration: 0 } })
      await controls.start({
        x: stopPosition,
        transition: { duration: GIRO_DURATION, ease: [0.15, 0.85, 0.35, 1] }
      })
      await sfx.playWin()
      onSpinEnd()
    }, 50)
  }

  return (
    <div className="flex flex-col items-center w-full relative my-4">
      <div className="absolute z-30 left-1/2 -translate-x-1/2 -top-4">
        <div className="w-0 h-0 border-l-[20px] border-l-transparent border-r-[20px] border-r-transparent border-t-[30px] border-t-yellow-400 drop-shadow-[0_4px_4px_rgba(0,0,0,0.5)]" />
      </div>
      <div className="absolute z-20 top-0 bottom-0 left-1/2 w-[2px] bg-yellow-500/30 h-full" />

      <div
        ref={containerRef}
        className="w-full max-w-[1200px] h-[240px] bg-[#0f172a] border-y-[4px] border-slate-700 relative overflow-hidden shadow-2xl flex items-center rounded-2xl mx-auto"
      >
        <motion.div
          key={resetIndex}
          animate={controls}
          className="flex items-center min-w-0"
          style={{ display: 'flex', gap: `${CARD_GAP}px` }}
        >
          {faixa.map((item, i) => (
            <div key={`${item.id}-${i}`} className="shrink-0 relative" style={{ width: CARD_WIDTH, height: 170 }}>
              <div className="w-full h-full rounded-2xl flex flex-col items-center justify-between p-3 text-center bg-gradient-to-b from-slate-800 to-slate-950 border-2 border-slate-700 shadow-xl relative overflow-hidden group">
                <div className="flex-1 flex items-center justify-center w-full">
                  <div className="w-24 h-24 bg-slate-900 rounded-full flex items-center justify-center border-2 border-white/5 shadow-inner group-hover:scale-110 transition-transform duration-500 overflow-hidden">
                    {/* ✅ LOGO DO TIME (escudo_url -> logo_url) */}
                    {item.logo_url ? (
                      <img src={item.logo_url} className="w-16 h-16 object-contain" alt={item.nome_equipe} />
                    ) : (
                      <Users size={34} className="text-slate-600" />
                    )}
                  </div>
                </div>

                <div className="mb-2 w-full">
                  <span className="text-sm font-black uppercase text-white leading-tight line-clamp-2 px-1 drop-shadow-md">
                    {item.nome_equipe}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </motion.div>

        <div className="absolute inset-y-0 left-0 w-48 bg-gradient-to-r from-[#0F172A] via-[#0F172A]/80 to-transparent z-10 pointer-events-none" />
        <div className="absolute inset-y-0 right-0 w-48 bg-gradient-to-l from-[#0F172A] via-[#0F172A]/80 to-transparent z-10 pointer-events-none" />
      </div>
    </div>
  )
}

// ============================================================
// Página
// ============================================================
function SorteioContent() {
  const searchParams = useSearchParams()
  const router = useRouter()

  const etapaId = searchParams.get('etapa_id')
  const qtdGrupos = Number(searchParams.get('qtd_grupos') || 2)
  const modeloId = searchParams.get('modelo_id')
  const estiloGrupo = searchParams.get('estilo') || 'INTRA_GRUPO'

  const letras = useMemo(() => ['A','B','C','D','E','F','G','H','I','J'], [])

  const [equipes, setEquipes] = useState([])
  const [selecionadas, setSelecionadas] = useState([])
  const [poteSorteio, setPoteSorteio] = useState([])
  const [grupos, setGrupos] = useState({})
  const [patrocinadores, setPatrocinadores] = useState([])
  const [fase, setFase] = useState('selecao')
  const [sorteando, setSorteando] = useState(false)
  const [vencedorAtual, setVencedorAtual] = useState(null)
  const [grupoAtualIndex, setGrupoAtualIndex] = useState(0)
  const [loading, setLoading] = useState(true)

  const [somAtivo, setSomAtivo] = useState(true)
  const sfxRef = useRef(null)
  const voice = useVoice()
  // ✅ B) trava o body e compensa a scrollbar (resolve o empurrão pra direita)
  useEffect(() => {
    const prevOverflow = document.body.style.overflow
    const prevPaddingRight = document.body.style.paddingRight

    const sbw = window.innerWidth - document.documentElement.clientWidth
    document.body.style.overflow = 'hidden'
    if (sbw > 0) document.body.style.paddingRight = `${sbw}px`

    return () => {
      document.body.style.overflow = prevOverflow
      document.body.style.paddingRight = prevPaddingRight
    }
  }, [])
  function getDescricaoModo() {
    if (estiloGrupo === 'INTRA_GRUPO' || estiloGrupo === 'TODOS_CONTRA_TODOS') return "Todos contra Todos (Dentro do Grupo)"
    if (estiloGrupo === 'IDA_E_VOLTA') return "Ida e Volta (Revanche)"
    if (estiloGrupo === 'CRUZAMENTO' || estiloGrupo === 'INTER_GRUPO_TOTAL') return "Cruzamento Total: Todos do A contra Todos do B"
    if (estiloGrupo === 'CASADINHA' || estiloGrupo === 'CASADINHA_INTRA') return "Casadinha: 1º x 2º do mesmo grupo"
    if (estiloGrupo === 'MATA_MATA_PURO') return "Copa: Eliminatória Direta"
    return "Modo Personalizado"
  }

  // init sfx
  useEffect(() => {
    sfxRef.current = createSfx()
  }, [])

  // carregar dados
  useEffect(() => {
    if (!etapaId) return
    async function load() {
      setLoading(true)
      try {
        const { data } = await supabase
          .from('etapa_equipes')
          .select('*, equipes(*)')
          .eq('etapa_id', Number(etapaId))

        // ✅ normaliza logo do time (escudo_url -> logo_url)
        const lista = (data || [])
          .map(t => {
            const eq = t.equipes
            if (!eq) return null
            return {
              ...eq,
              // logo do time pode estar em escudo_url (padrão do seu upload)
              logo_url: eq.logo_url || eq.escudo_url || eq.escudo || eq.logo || null
            }
          })
          .filter(Boolean)

        setEquipes(lista)
        setSelecionadas(lista)

        const g = {}
        for (let i = 0; i < qtdGrupos; i++) g[i] = []
        setGrupos(g)

        const { data: patrociniosData } = await supabase
          .from('patrocinios')
          .select('nome_empresa, banner_url')

        if (patrociniosData) setPatrocinadores(patrociniosData)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [etapaId, qtdGrupos])

  // som on/off
  useEffect(() => {
    voice.setEnabled(somAtivo)
  }, [somAtivo]) // eslint-disable-line react-hooks/exhaustive-deps

  const narrarInicio = async () => {
    if (!sfxRef.current) return
    await sfxRef.current.click()
    if (!somAtivo) return

    const frases = [
      "Atenção, torcida! Clima de decisão! Vai começar o sorteio oficial!",
      "Tá valendo! Olho no telão! Começa agora o sorteio da competição!",
      "Senhoras e senhores… segura a emoção! Vamos ao sorteio oficial!",
      "É noite de futebol! A roleta vai girar… e a emoção tá no ar!"
    ]
    voice.speakNarrador(frases[Math.floor(Math.random() * frases.length)], { rate: 1.06, pitch: 0.66, pauseMs: 140 })
  }

  const narrarResultado = (nome, letra) => {
    if (!somAtivo) return

    const frasesMataMata = [
      `Tá definido! ${nome}! Segue vivo na competição!`,
      `É agora! ${nome}! Confirmado no chaveamento!`,
      `Explode o telão! ${nome}! Tá dentro!`,
      `A roleta parou… e deu ${nome}! Classificado!`
    ]

    const frasesGrupo = [
      `Olha no telão… ${nome}! Grupo ${letra}!`,
      `Tá definido! ${nome}! Grupo ${letra}!`,
      `Chegou com moral! ${nome}! Grupo ${letra}!`,
      `Confirma aí! ${nome}! Grupo ${letra}!`,
      `A roleta parou… ${nome}! Vai pro Grupo ${letra}!`
    ]

    const pick = (estiloGrupo === 'MATA_MATA_PURO' ? frasesMataMata : frasesGrupo)
    voice.speakNarrador(pick[Math.floor(Math.random() * pick.length)], { rate: 1.07, pitch: 0.66, pauseMs: 135 })
  }

  const narrarFim = () => {
    if (!somAtivo) return

    const frases = [
      "Sorteio encerrado! Grupos definidos! Agora é bola rolando!",
      "Tá pronto! Emoção garantida! Partiu tabela oficial!",
      "Fim de sorteio! A competição tá desenhada… e promete demais!"
    ]
    voice.speakNarrador(frases[Math.floor(Math.random() * frases.length)], { rate: 1.05, pitch: 0.66, pauseMs: 150 })
  }

  const prepararShow = async () => {
    await narrarInicio()
    setPoteSorteio([...selecionadas])
    setFase('sorteio')
  }

  const sortearProximo = async () => {
    if (poteSorteio.length === 0 || sorteando) return
    if (sfxRef.current) await sfxRef.current.click()

    const randomIndex = Math.floor(Math.random() * poteSorteio.length)
    setVencedorAtual(poteSorteio[randomIndex])
    setSorteando(true)
  }

  const onRoletaParou = () => {
    if (!vencedorAtual) return

    const letraGrupo = letras[grupoAtualIndex]
    narrarResultado(vencedorAtual.nome_equipe, letraGrupo)

    // ✅ IMPORTANTE: usar callback pra evitar bug de estado
    setTimeout(() => {
      setGrupos(prev => ({
        ...prev,
        [grupoAtualIndex]: [...(prev[grupoAtualIndex] || []), vencedorAtual]
      }))

      setPoteSorteio(prev => {
        const novo = prev.filter(t => t.id !== vencedorAtual.id)
        // se acabou, finaliza depois
        if (novo.length === 0) {
          setTimeout(() => {
            setFase('finalizado')
            narrarFim()
          }, 1200)
        }
        return novo
      })

      if (estiloGrupo !== 'MATA_MATA_PURO') {
        setGrupoAtualIndex(prev => (prev + 1) % qtdGrupos)
      }

      setVencedorAtual(null)
      setSorteando(false)
    }, 1600)
  }

  // --- Salvar e Gerar Jogos
  const salvarEGerar = async () => {
    setLoading(true)
    try {
      await supabase.from('jogos').delete().eq('etapa_id', Number(etapaId))

      // salva grupos no relacionamento
      if (estiloGrupo !== 'MATA_MATA_PURO') {
        for (let i = 0; i < qtdGrupos; i++) {
          const timeIds = (grupos[i] || []).map(t => t.id)
          if (timeIds.length > 0) {
            await supabase
              .from('etapa_equipes')
              .update({ grupo: letras[i] })
              .eq('etapa_id', Number(etapaId))
              .in('equipe_id', timeIds)
          }
        }
      }

      let insertsJogos = []

      // 1) INTRA-GRUPO
      if (estiloGrupo === 'INTRA_GRUPO' || estiloGrupo === 'TODOS_CONTRA_TODOS' || estiloGrupo === 'IDA_E_VOLTA') {
        const rodadasGlobais = {}
        let maxRodadas = 0

        for (let i = 0; i < qtdGrupos; i++) {
          const letra = letras[i]
          const times = grupos[i] || []
          const listaRodadas = gerarConfrontosBerger(times)

          listaRodadas.forEach((jogosDaRodada, idx) => {
            const numRodada = idx + 1
            if (!rodadasGlobais[numRodada]) rodadasGlobais[numRodada] = []

            jogosDaRodada.forEach(jogo => {
              // ✅ FOLGA (quando ímpar)
              if (jogo.bye) {
                rodadasGlobais[numRodada].push({
                  etapa_id: Number(etapaId),
                  tipo_jogo: 'FOLGA',
                  obs_publica: `Grupo ${letra} - Rodada ${numRodada} - FOLGA`,
                  equipe_a_id: jogo.a.id,
                  equipe_b_id: null,
                  rodada: numRodada,
                  status: 'EM_BREVE'
                })
                return
              }

              rodadasGlobais[numRodada].push({
                etapa_id: Number(etapaId),
                tipo_jogo: 'GRUPO',
                obs_publica: `Grupo ${letra} - Rodada ${numRodada}`,
                equipe_a_id: jogo.a.id,
                equipe_b_id: jogo.b.id,
                rodada: numRodada,
                status: 'EM_BREVE'
              })
            })

            if (numRodada > maxRodadas) maxRodadas = numRodada
          })
        }

        for (let r = 1; r <= maxRodadas; r++) {
          if (rodadasGlobais[r]) insertsJogos.push(...rodadasGlobais[r])
        }

        if (estiloGrupo === 'IDA_E_VOLTA') {
          for (let r = 1; r <= maxRodadas; r++) {
            if (rodadasGlobais[r]) {
              // ✅ não duplicar FOLGA em volta
              const jogosVolta = rodadasGlobais[r]
                .filter(j => j.tipo_jogo !== 'FOLGA')
                .map(j => ({
                  ...j,
                  equipe_a_id: j.equipe_b_id,
                  equipe_b_id: j.equipe_a_id,
                  rodada: r + maxRodadas,
                  obs_publica: j.obs_publica.replace('Rodada', 'Volta')
                }))

              insertsJogos.push(...jogosVolta)
            }
          }
        }
      }

      // 2) CRUZAMENTO A x B
      else if (estiloGrupo === 'CRUZAMENTO' || estiloGrupo === 'INTER_GRUPO_TOTAL') {
        for (let k = 0; k < qtdGrupos; k += 2) {
          const g1 = grupos[k] || []
          const g2 = grupos[k + 1] || []
          const l1 = letras[k]
          const l2 = letras[k + 1]
          if (g1.length > 0 && g2.length > 0) {
            const listaRodadas = gerarCruzamentoRotativo(g1, g2)
            listaRodadas.forEach((jogosR, idx) => {
              jogosR.forEach(j => {
                insertsJogos.push({
                  etapa_id: Number(etapaId),
                  tipo_jogo: 'GRUPO',
                  obs_publica: `Intergrupo ${l1}x${l2}`,
                  equipe_a_id: j.a.id,
                  equipe_b_id: j.b.id,
                  rodada: idx + 1,
                  status: 'EM_BREVE'
                })
              })
            })
          }
        }
      }

      // 3) CASADINHA
      else if (estiloGrupo === 'CASADINHA' || estiloGrupo === 'CASADINHA_INTRA') {
        for (let i = 0; i < qtdGrupos; i++) {
          const times = grupos[i] || []
          const letra = letras[i]
          for (let k = 0; k < times.length; k += 2) {
            if (times[k] && times[k + 1]) {
              insertsJogos.push({
                etapa_id: Number(etapaId),
                tipo_jogo: 'GRUPO',
                obs_publica: `Grupo ${letra}`,
                equipe_a_id: times[k].id,
                equipe_b_id: times[k + 1].id,
                rodada: 1,
                status: 'EM_BREVE'
              })
            } else if (times[k] && !times[k + 1]) {
              // ✅ FOLGA se sobrar um
              insertsJogos.push({
                etapa_id: Number(etapaId),
                tipo_jogo: 'FOLGA',
                obs_publica: `Grupo ${letra} - FOLGA`,
                equipe_a_id: times[k].id,
                equipe_b_id: null,
                rodada: 1,
                status: 'EM_BREVE'
              })
            }
          }
        }
      }

      // 4) MATA-MATA PURO
      else if (estiloGrupo === 'MATA_MATA_PURO') {
        let todos = []
        for (let i = 0; i < qtdGrupos; i++) todos = [...todos, ...(grupos[i] || [])]
        for (let k = 0; k < todos.length; k += 2) {
          if (todos[k] && todos[k + 1]) {
            insertsJogos.push({
              etapa_id: Number(etapaId),
              tipo_jogo: 'ELIMINATORIA',
              obs_publica: `Jogo ${Math.floor(k / 2) + 1}`,
              equipe_a_id: todos[k].id,
              equipe_b_id: todos[k + 1].id,
              rodada: 1,
              status: 'EM_BREVE'
            })
          } else if (todos[k] && !todos[k + 1]) {
            // ✅ FOLGA se sobrar um
            insertsJogos.push({
              etapa_id: Number(etapaId),
              tipo_jogo: 'FOLGA',
              obs_publica: `FOLGA - ${todos[k].nome_equipe}`,
              equipe_a_id: todos[k].id,
              equipe_b_id: null,
              rodada: 1,
              status: 'EM_BREVE'
            })
          }
        }
      }

      // Mata-mata por modelo
      if (modeloId && estiloGrupo !== 'MATA_MATA_PURO') {
        const ultimaRodada = insertsJogos.length > 0 ? Math.max(...insertsJogos.map(j => j.rodada)) : 0
        const { data: modelo } = await supabase
          .from('modelos_campeonato')
          .select('*')
          .eq('id', modeloId)
          .single()

        if (modelo) {
          if (modelo.regras) {
            await supabase.from('etapas').update({ regras: modelo.regras }).eq('id', Number(etapaId))
          }
          const insertsMataMata = (modelo.estrutura || []).map((item, idx) => ({
            etapa_id: Number(etapaId),
            tipo_jogo: item.fase,
            obs_publica: item.obs,
            origem_a: item.ruleA,
            origem_b: item.ruleB,
            equipe_a_id: null,
            equipe_b_id: null,
            rodada: ultimaRodada + 10 + Math.floor(idx / 4),
            status: 'EM_BREVE'
          }))
          insertsJogos.push(...insertsMataMata)
        }
      }

      if (insertsJogos.length > 0) {
        const { error } = await supabase.from('jogos').insert(insertsJogos)
        if (error) throw error
      }

      alert(`Sucesso! ${insertsJogos.length} jogos gerados.`)
      router.push('/admin/jogos-novo')
    } catch (e) {
      alert("Erro: " + e.message)
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="fixed inset-0 bg-slate-950 flex flex-col items-center justify-center text-white gap-4 z-[9999]">
        <Loader2 className="animate-spin w-12 h-12 text-blue-500" />
        <p className="font-black uppercase tracking-widest animate-pulse">Processando...</p>
      </div>
    )
  }

  return (
    <FullscreenPortal>
      <main className="fixed inset-0 overflow-hidden bg-[#0F172A] text-white p-4 font-sans bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-blue-900/20 via-[#0F172A] to-[#020617] z-[9999]">
          <div className="w-full max-w-[1600px] mx-auto h-full flex flex-col min-w-0">
          <div className="flex justify-between items-center mb-4 border-b border-white/5 pb-4">
            <button onClick={() => router.back()} className="text-slate-500 hover:text-white uppercase text-xs font-bold flex items-center gap-1">
              <ChevronLeft size={14} /> Cancelar
            </button>

            <div className="flex items-center gap-3">
              <button
                onClick={async () => {
                  setSomAtivo(v => !v)
                  if (sfxRef.current) await sfxRef.current.click()
                }}
                className={`text-[10px] uppercase font-black px-3 py-2 rounded-xl border transition-all ${
                  somAtivo ? 'bg-blue-600/20 border-blue-500/40 text-blue-200' : 'bg-slate-900/40 border-white/10 text-slate-400'
                }`}
                title="Ativar/Desativar Som e Voz"
              >
                {somAtivo ? 'Som: ON' : 'Som: OFF'}
              </button>

              <h1 className="text-2xl md:text-3xl font-black italic uppercase tracking-tighter text-transparent bg-clip-text bg-gradient-to-r from-white to-slate-400">
                SORTEIO <span className="text-blue-500">AO VIVO</span>
              </h1>
            </div>
          </div>

          {/* CARD INFORMATIVO */}
          <motion.div initial={{ y: -20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} className="bg-blue-900/30 border border-blue-500/30 p-3 rounded-xl mb-6 flex items-center gap-3">
            <Info className="text-blue-400 shrink-0" size={20} />
            <div>
              <p className="text-[10px] uppercase font-bold text-blue-400 tracking-widest">Modo Atual</p>
              <p className="text-sm font-medium text-blue-100">{getDescricaoModo()}</p>
            </div>
          </motion.div>

          {fase === 'selecao' && (
            <div className="flex-1 flex flex-col items-center justify-center">
              <div className="bg-slate-900/50 border border-white/10 p-8 rounded-[3rem] backdrop-blur-xl shadow-2xl w-full max-w-5xl mx-auto">
                <div className="flex justify-between items-center mb-6">
                  <h2 className="text-xl font-black uppercase flex items-center gap-2">
                    <Users className="text-blue-500" /> Confirmar Times
                  </h2>
                  <div className="text-right">
                    <p className="text-xs text-slate-400 uppercase font-bold">Serão divididos em</p>
                    <p className="text-2xl font-black text-white">{qtdGrupos} GRUPOS</p>
                  </div>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-3 mb-8 max-h-[50vh] overflow-y-auto pr-2 custom-scrollbar">
                  {equipes.map(eq => {
                    const active = selecionadas.find(s => s.id === eq.id)
                    return (
                      <button
                        key={eq.id}
                        onClick={() => active
                          ? setSelecionadas(selecionadas.filter(s => s.id !== eq.id))
                          : setSelecionadas([...selecionadas, eq])
                        }
                        className={`p-3 rounded-xl border transition-all flex items-center gap-2 group ${
                          active ? 'bg-blue-600 border-blue-500' : 'bg-slate-800/50 border-white/5'
                        }`}
                      >
                        {active ? <CheckCircle2 size={14} className="text-white"/> : <div className="w-3.5 h-3.5 rounded-full border border-slate-500"/>}
                        <span className={`font-bold uppercase text-xs truncate ${active ? 'text-white' : 'text-slate-400'}`}>
                          {eq.nome_equipe}
                        </span>
                      </button>
                    )
                  })}
                </div>

                <div className="flex justify-center">
                  <button
                    onClick={prepararShow}
                    disabled={selecionadas.length < qtdGrupos}
                    className="group relative px-10 py-5 bg-white text-slate-950 font-black text-lg rounded-full uppercase italic tracking-widest hover:scale-105 transition-all shadow-[0_0_40px_rgba(255,255,255,0.2)] disabled:opacity-50 disabled:hover:scale-100"
                  >
                    <span className="flex items-center gap-2 relative z-10">
                      <Play size={20} fill="currentColor" /> INICIAR SHOW
                    </span>
                  </button>
                </div>
              </div>
            </div>
          )}

          {fase === 'sorteio' && (
              <div className="grid grid-rows-[auto_1fr] h-full gap-4 w-full min-w-0">
              <div className="flex flex-col items-center justify-center min-h-[350px] w-full">
                <SponsorsTicker patrocinadores={patrocinadores} />

                <BlazeRoulette
                  items={poteSorteio}
                  onSpinEnd={onRoletaParou}
                  vencedorParaGirar={vencedorAtual}
                  patrocinadores={patrocinadores}
                  sfx={sfxRef.current}
                />

                <div className="mt-6 h-20 flex items-center justify-center w-full">
                  {!sorteando && poteSorteio.length > 0 ? (
                    <button
                      onClick={sortearProximo}
                      className="bg-blue-600 hover:bg-blue-500 text-white font-black text-2xl px-12 py-4 rounded-2xl uppercase shadow-[0_0_50px_rgba(37,99,235,0.5)] animate-pulse hover:animate-none transition-transform active:scale-95 flex items-center gap-3"
                    >
                      <Mic /> SORTEAR PRÓXIMO
                    </button>
                  ) : sorteando ? (
                    <div className="text-blue-400 font-black text-xl uppercase tracking-[0.5em] animate-pulse">Sorteando...</div>
                  ) : null}
                </div>
              </div>

              <div className={`grid gap-4 w-full min-w-0 items-start overflow-y-auto pb-10 mx-auto ${
                qtdGrupos === 2 ? 'grid-cols-2' : qtdGrupos === 3 ? 'grid-cols-3' : 'grid-cols-2 lg:grid-cols-4'
              }`}>
                {Array.from({ length: qtdGrupos }).map((_, idx) => (
                  <div
                    key={idx}
                    className={`bg-slate-900/50 border p-4 rounded-2xl transition-all ${
                      grupoAtualIndex === idx && !sorteando && poteSorteio.length > 0
                        ? 'border-yellow-500/50 shadow-[0_0_20px_rgba(234,179,8,0.2)] scale-[1.02]'
                        : 'border-white/10'
                    }`}
                  >
                    <div className="flex justify-between items-center mb-4 border-b border-white/5 pb-2">
                      <h3 className={`font-black uppercase text-xl ${grupoAtualIndex === idx ? 'text-yellow-400' : 'text-slate-500'}`}>
                        Grupo {letras[idx]}
                      </h3>
                      <span className="bg-slate-800 text-white text-xs px-2 py-1 rounded font-bold">
                        {grupos[idx]?.length || 0}
                      </span>
                    </div>

                    <div className="space-y-2">
                      <AnimatePresence>
                        {grupos[idx]?.map((time, tIdx) => (
                          <motion.div
                            key={time.id}
                            initial={{ opacity: 0, x: -20 }}
                            animate={{ opacity: 1, x: 0 }}
                            className="bg-slate-800 p-3 rounded-lg border border-white/5 flex justify-between items-center"
                          >
                            <span className="font-bold text-sm text-slate-200 truncate">{time.nome_equipe}</span>
                            <span className="text-[10px] font-black text-slate-500">{letras[idx]}{tIdx + 1}</span>
                          </motion.div>
                        ))}
                      </AnimatePresence>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {fase === 'finalizado' && (
            <div className="flex-1 flex flex-col items-center justify-center">
              <motion.div
                initial={{ scale: 0.5, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                className="bg-slate-900/80 border border-green-500/30 p-12 rounded-[3rem] text-center backdrop-blur-xl shadow-[0_0_100px_rgba(34,197,94,0.2)]"
              >
                <Sparkles className="text-green-400 mx-auto mb-6 w-24 h-24 animate-pulse"/>
                <h2 className="text-5xl font-black uppercase italic text-white mb-2">Sorteio Concluído!</h2>
                <p className="text-slate-400 text-lg mb-8">Todos os grupos foram definidos.</p>

                <button
                  onClick={salvarEGerar}
                  disabled={loading}
                  className="bg-green-600 hover:bg-green-500 text-white font-black px-12 py-5 rounded-2xl uppercase text-xl shadow-xl flex items-center gap-3 mx-auto hover:scale-105 transition-all"
                >
                  {loading ? <Loader2 className="animate-spin"/> : <Save/>} Gerar Tabela Oficial
                </button>
              </motion.div>
            </div>
          )}

          <div className="w-full flex justify-end py-4 border-t border-white/5 mt-4">
            <a
              href="https://wa.me/5547997037512"
              target="_blank"
              className="flex items-center gap-2 opacity-30 hover:opacity-100 transition-all duration-500 group cursor-pointer"
            >
              <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400 group-hover:text-blue-400">
                System by <span className="text-white border-b border-blue-500/50">RC ENTERPRISE</span>
              </span>
              <div className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse shadow-[0_0_8px_#22c55e]" />
            </a>
          </div>
        </div>
      </main>
    </FullscreenPortal>
  )
}

export default function SorteioPage() {
  return (
    <Suspense fallback={<div className="bg-slate-950 min-h-screen flex items-center justify-center text-white">Carregando Sorteio...</div>}>
      <SorteioContent />
    </Suspense>
  )
}
