'use client'

import { useState, useEffect, Suspense, useRef, useMemo } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { motion, AnimatePresence, useAnimation, useMotionValue, useAnimationFrame } from 'framer-motion'
import {
  Trophy, Users, ChevronLeft, Play, CheckCircle2, Loader2,
  Sparkles, Save, Mic, Info, Star
} from 'lucide-react'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
)

// --- CONFIGURAÇÕES VISUAIS ---
const CARD_WIDTH = 220
const CARD_GAP = 10
const GIRO_DURATION = 6

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
    const notes = [392.0, 523.25, 659.25, 783.99]

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
// ✅ VOZ (TTS) — Narrador esportivo estilo rádio (pt-BR claro)
// ============================================================
function useVoice() {
  const enabledRef = useRef(true)
  const voiceRef = useRef(null)

  // controla concorrência: evita fala antiga “vazar”
  const runIdRef = useRef(0)
  const readyRef = useRef(false)

  const norm = (s) => (s || '').toLowerCase()

  const looksMale = (v) => {
    const n = norm(v.name)
    return (
      n.includes('daniel') ||
      n.includes('ricardo') ||
      n.includes('antonio') ||
      n.includes('paulo') ||
      n.includes('joao') ||
      n.includes('bruno') ||
      n.includes('male') ||
      n.includes('masc') ||
      n.includes('mascul')
    )
  }

  const scoreVoice = (v) => {
    const name = norm(v.name)
    const lang = norm(v.lang)

    let s = 0
    // idioma
    if (lang.includes('pt-br')) s += 60
    else if (lang.includes('pt')) s += 35
    else s -= 50

    // local costuma ser mais estável que cloud
    if (v.localService) s += 10

    // preferências (rádio: voz masculina/mais grave)
    if (name.includes('microsoft') && name.includes('daniel')) s += 100
    if (name.includes('daniel')) s += 35
    if (name.includes('microsoft')) s += 18
    if (name.includes('google')) s += 10

    if (looksMale(v)) s += 15

    return s
  }

  const pickBestPtBR = () => {
    if (typeof window === 'undefined') return null
    const voices = window.speechSynthesis?.getVoices?.() || []
    if (!voices.length) return null

    const sorted = [...voices].sort((a, b) => scoreVoice(b) - scoreVoice(a))
    return sorted[0] || null
  }

  const ensureVoicesReady = async () => {
    if (typeof window === 'undefined') return false
    if (readyRef.current && voiceRef.current) return true

    // tenta “acordar” as vozes
    try { window.speechSynthesis.getVoices() } catch {}

    // espera onvoiceschanged ou timeout
    await new Promise((resolve) => {
      let done = false
      const finish = () => {
        if (done) return
        done = true
        resolve(true)
      }

      const t = setTimeout(finish, 1200)

      const handler = () => {
        clearTimeout(t)
        finish()
      }

      try {
        window.speechSynthesis.onvoiceschanged = handler
      } catch {
        clearTimeout(t)
        finish()
      }
    })

    // seleciona a melhor voz
    const v = pickBestPtBR()
    if (v) voiceRef.current = v
    readyRef.current = true
    return !!voiceRef.current
  }

  useEffect(() => {
    if (typeof window === 'undefined') return
    ;(async () => {
      await ensureVoicesReady()
    })()
  }, [])

  const setEnabled = (v) => {
    enabledRef.current = !!v
    if (!v && typeof window !== 'undefined') {
      try { window.speechSynthesis.cancel() } catch {}
    }
  }

  const clamp = (n, a, b) => Math.max(a, Math.min(b, n))

  // quebra em frases (melhor pra locução clara)
  const splitSmart = (text) => {
    const clean = String(text || '').replace(/\s+/g, ' ').trim()
    if (!clean) return []
    const parts = clean.split(/(?<=[.!?…])\s+/).filter(Boolean)
    if (parts.length) return parts
    return [clean]
  }

  // fala “segura” com promessa (espera terminar)
  const speakSequence = async (text, opts = {}) => {
    if (typeof window === 'undefined') return
    if (!enabledRef.current) return
    if (!text) return

    const myRun = ++runIdRef.current

    await ensureVoicesReady()
    if (!enabledRef.current) return
    if (myRun !== runIdRef.current) return

    // tenta evitar travadinhas do speechSynthesis
    try { window.speechSynthesis.cancel() } catch {}
    try { window.speechSynthesis.resume?.() } catch {}

    const parts = splitSmart(text)

    // parâmetros “locutor de rádio”: claro, firme, levemente empolgado
    const baseRate = opts.rate ?? 1.03
    const basePitch = opts.pitch ?? 0.72
    const volume = opts.volume ?? 1.0
    const pauseMs = opts.pauseMs ?? 140

    // micro-variação sem embolar
    const rateJitter = opts.rateJitter ?? 0.015
    const pitchJitter = opts.pitchJitter ?? 0.015

    for (let i = 0; i < parts.length; i++) {
      if (!enabledRef.current) return
      if (myRun !== runIdRef.current) return

      await new Promise((resolve) => {
        let finished = false

        const u = new SpeechSynthesisUtterance(parts[i])
        u.lang = 'pt-BR'
        u.voice = voiceRef.current || null

        const r = baseRate + (Math.random() * 2 - 1) * rateJitter
        const p = basePitch + (Math.random() * 2 - 1) * pitchJitter

        u.rate = clamp(r, 0.95, 1.15)
        u.pitch = clamp(p, 0.60, 0.92)
        u.volume = clamp(volume, 0.0, 1.0)

        const done = () => {
          if (finished) return
          finished = true
          resolve(true)
        }

        u.onend = () => setTimeout(done, pauseMs)
        u.onerror = () => setTimeout(done, 60)

        // watchdog (se travar, não quebra o fluxo)
        const maxMs = opts.maxMsPerPart ?? 9000
        const watchdog = setTimeout(() => {
          try { window.speechSynthesis.cancel() } catch {}
          done()
        }, maxMs)

        const originalDone = done
        const doneWithClear = () => {
          clearTimeout(watchdog)
          originalDone()
        }

        u.onend = () => setTimeout(doneWithClear, pauseMs)
        u.onerror = () => setTimeout(doneWithClear, 60)

        try {
          window.speechSynthesis.speak(u)
        } catch {
          doneWithClear()
        }
      })
    }
  }

  // ✅ “Narrador” (rádio) — mantém português bem claro
  const speakNarrador = async (text, opts = {}) => {
    // pequenos truques de dicção/ritmo com pontuação
    const polish = String(text || '')
      .replace(/\s+/g, ' ')
      .replace(/—/g, '…')
      .replace(/\bpt\b/gi, 'ponto')
      .trim()

    return speakSequence(polish, {
      rate: opts.rate ?? 1.03,
      pitch: opts.pitch ?? 0.72,
      pauseMs: opts.pauseMs ?? 140,
      rateJitter: opts.rateJitter ?? 0.012,
      pitchJitter: opts.pitchJitter ?? 0.012,
      maxMsPerPart: opts.maxMsPerPart ?? 9000,
      volume: opts.volume ?? 1.0
    })
  }

  const stop = () => {
    runIdRef.current += 1
    if (typeof window !== 'undefined') {
      try { window.speechSynthesis.cancel() } catch {}
    }
  }

  return { speakNarrador, stop, setEnabled }
}

// ============================================================
// ✅ Faixa de Patrocinadores — cores vivas + esteira infinita
// - se tem poucos, repete pra “encher”
// - nunca volta, nunca para (direita -> esquerda)
// ============================================================
function SponsorsTicker({ patrocinadores }) {
  const wrapRef = useRef(null)
  const trackRef = useRef(null)
  const x = useMotionValue(0)
  const [dist, setDist] = useState(0)

  const baseLista = useMemo(() => {
    const lista = (patrocinadores && patrocinadores.length > 0)
      ? patrocinadores
      : [
          { nome_empresa: "Seu Patrocínio Aqui", banner_url: null },
          { nome_empresa: "Espaço Disponível", banner_url: null }
        ]

    // ✅ se vier poucos, repete pra preencher
    const MIN_ITENS = 10
    const filled = []
    let i = 0
    while (filled.length < Math.max(MIN_ITENS, lista.length)) {
      filled.push(lista[i % lista.length])
      i++
      if (i > 200) break
    }
    return filled
  }, [patrocinadores])

  // ✅ duplicado 2x = wrap perfeito
  const loop = useMemo(() => [...baseLista, ...baseLista], [baseLista])

  const medir = () => {
    const track = trackRef.current
    if (!track) return
    const full = track.getBoundingClientRect().width
    const half = Math.floor(full / 2)
    if (half > 0) setDist(half)
  }

  useEffect(() => {
    if (typeof window === 'undefined') return
    const r1 = requestAnimationFrame(medir)
    const t1 = setTimeout(medir, 120)
    const t2 = setTimeout(medir, 450)

    let ro = null
    if (window.ResizeObserver) {
      ro = new ResizeObserver(medir)
      if (wrapRef.current) ro.observe(wrapRef.current)
      if (trackRef.current) ro.observe(trackRef.current)
    }
    window.addEventListener('resize', medir)

    return () => {
      cancelAnimationFrame(r1)
      clearTimeout(t1)
      clearTimeout(t2)
      window.removeEventListener('resize', medir)
      try { ro?.disconnect?.() } catch {}
    }
  }, [loop.length])

  // ✅ esteira: sempre esquerda, wrap sem “voltar”
  useAnimationFrame((t, delta) => {
    if (!dist) return
    const pxPorSegundo = 125
    const move = (pxPorSegundo * delta) / 1000
    let next = x.get() - move
    if (next <= -dist) next += dist
    x.set(next)
  })

  return (
    <div
      ref={wrapRef}
      className="w-full max-w-full overflow-hidden relative mb-6 z-40 h-16 flex items-center
                 border-y border-blue-500/25
                 bg-gradient-to-r from-[#020617] via-[#081a3a] to-[#020617]"
      style={{
        contain: 'layout paint',   // ✅ evita empurrar layout
        overflowX: 'hidden'        // ✅ reforço
      }}
    >
      <div className="absolute inset-y-0 left-0 w-28 bg-gradient-to-r from-[#06122a] to-transparent z-10 pointer-events-none" />
      <div className="absolute inset-y-0 right-0 w-28 bg-gradient-to-l from-[#06122a] to-transparent z-10 pointer-events-none" />

      {/* ✅ TRACK FORA DO FLUXO (absolute) — não aumenta largura da página */}
      <motion.div
        ref={trackRef}
        className="absolute left-0 top-1/2 -translate-y-1/2 inline-flex items-center gap-14 pr-16"
        style={{ x, willChange: 'transform' }}
      >
        {loop.map((pat, i) => (
          <div key={`${pat.nome_empresa || 'pat'}-${i}`} className="flex items-center">
            <div
              className="px-4 py-2 rounded-full border border-blue-400/20
                         bg-gradient-to-b from-white/12 to-white/0
                         shadow-[0_0_18px_rgba(37,99,235,0.18)]
                         hover:shadow-[0_0_30px_rgba(59,130,246,0.35)]
                         transition-all flex items-center gap-3"
            >
              {pat.banner_url ? (
                <img
                  src={pat.banner_url}
                  alt={pat.nome_empresa}
                  onLoad={medir}
                  className="h-9 w-auto object-contain max-w-[220px]
                             drop-shadow-[0_10px_22px_rgba(59,130,246,0.28)]
                             saturate-200 contrast-125"
                />
              ) : (
                <>
                  <Star size={14} className="text-yellow-300 drop-shadow-[0_0_12px_rgba(250,204,21,0.45)]" />
                  <span className="font-black uppercase text-sm text-slate-100 tracking-widest drop-shadow-[0_2px_10px_rgba(0,0,0,0.35)]">
                    {pat.nome_empresa || "PARCEIRO"}
                  </span>
                </>
              )}
            </div>
          </div>
        ))}
      </motion.div>
    </div>
  )
}

// ============================================================
// Algoritmos
// ============================================================
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

      if (t1 && t2) rodadaAtual.push({ a: t1, b: t2, bye: false })
      else if (t1 && !t2) rodadaAtual.push({ a: t1, b: null, bye: true })
      else if (!t1 && t2) rodadaAtual.push({ a: t2, b: null, bye: true })
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
// Rolete
// - topo: só escudo do time; se não tiver, fica vazio
// - baixo: mantém patrocinador
// ============================================================
function BlazeRoulette({ items, onSpinEnd, vencedorParaGirar, patrocinadores, sfx }) {
  const [faixa, setFaixa] = useState([])
  const [resetIndex, setResetIndex] = useState(0)
  const containerRef = useRef(null)
  const controls = useAnimation()

  useEffect(() => {
    if (items.length > 0 && faixa.length === 0) {
      const getRandomSponsor = () => {
        if (!patrocinadores || patrocinadores.length === 0) return null
        return patrocinadores[Math.floor(Math.random() * patrocinadores.length)]
      }
      const prepareItem = (item) => ({ ...item, sponsor: getRandomSponsor() })
      setFaixa(items.slice(0, 15).map(prepareItem))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items.length])

  useEffect(() => {
    if (vencedorParaGirar) girarRoleta(vencedorParaGirar)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vencedorParaGirar])

  const girarRoleta = async (target) => {
    if (!sfx) return
    await sfx.click()
    await sfx.playSpin()

    const getRandomSponsor = () => {
      if (!patrocinadores || patrocinadores.length === 0) return null
      return patrocinadores[Math.floor(Math.random() * patrocinadores.length)]
    }
    const prepareItem = (item) => ({ ...item, sponsor: getRandomSponsor() })

    const startItem = prepareItem(items[0] || { nome_equipe: '...', id: -1 })
    const targetItem = prepareItem(target)

    let fillers = []
    let lastAdded = startItem?.id ?? -1

    for (let i = 0; i < 50; i++) {
      let randomItem
      do {
        randomItem = items[Math.floor(Math.random() * items.length)]
      } while (randomItem?.id === lastAdded && items.length > 1)

      fillers.push(prepareItem(randomItem))
      lastAdded = randomItem?.id ?? lastAdded
    }

    if (fillers[fillers.length - 1]?.id === target.id && items.length > 1) {
      const replacement = items.find(t => t.id !== target.id) || fillers[fillers.length - 1]
      fillers[fillers.length - 1] = prepareItem(replacement)
    }

    const novaFaixa = [startItem, ...fillers, targetItem, ...items.slice(0, 3).map(prepareItem)]
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
        className="w-full max-w-[1200px] h-[260px] bg-[#0f172a] border-y-[4px] border-slate-700 relative overflow-hidden shadow-2xl flex items-center rounded-2xl"
      >
        <motion.div
          key={resetIndex}
          animate={controls}
          className="flex items-center"
          style={{ display: 'flex', gap: `${CARD_GAP}px`, willChange: 'transform' }}
        >
          {faixa.map((item, i) => (
            <div key={`${item.id}-${i}`} className="shrink-0 relative" style={{ width: CARD_WIDTH, height: 180 }}>
              <div className="w-full h-full rounded-2xl flex flex-col items-center justify-between p-3 text-center bg-gradient-to-b from-slate-800 to-slate-950 border-2 border-slate-700 shadow-xl relative overflow-hidden group">
                {/* TOPO: só escudo do time. Se não tiver, não mostra nada */}
                <div className="flex-1 flex items-center justify-center w-full">
                  <div className="w-20 h-20 bg-slate-900 rounded-full flex items-center justify-center border-2 border-white/5 shadow-inner group-hover:scale-110 transition-transform duration-500 overflow-hidden">
                    {item.logo_url ? (
                      <img
                        src={item.logo_url}
                        className="w-14 h-14 object-contain"
                        alt={item.nome_equipe}
                      />
                    ) : null}
                  </div>
                </div>

                <div className="mb-2 w-full">
                  <span className="text-sm font-black uppercase text-white leading-tight line-clamp-2 px-1 drop-shadow-md">
                    {item.nome_equipe}
                  </span>
                </div>

                {/* BAIXO: mantém patrocinadores */}
                <div className="w-full bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 rounded-lg py-1.5 border-t border-white/10 mt-1 flex flex-col items-center justify-center h-[35px]">
                  <span className="text-[8px] text-slate-400 font-bold uppercase tracking-widest mb-0.5">PARCEIRO</span>
                  {item.sponsor?.banner_url ? (
                    <img src={item.sponsor.banner_url} className="h-4 object-contain max-w-[80px]" alt="Parceiro" />
                  ) : (
                    <span className="text-[9px] text-yellow-500 font-bold uppercase">OFICIAL</span>
                  )}
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

  const getDescricaoModo = () => {
    if (estiloGrupo === 'INTRA_GRUPO' || estiloGrupo === 'TODOS_CONTRA_TODOS') return 'Todos contra Todos (Dentro do Grupo)'
    if (estiloGrupo === 'IDA_E_VOLTA') return 'Ida e Volta (Revanche)'
    if (estiloGrupo === 'CRUZAMENTO' || estiloGrupo === 'INTER_GRUPO_TOTAL') return 'Cruzamento Total: Todos do A contra Todos do B'
    if (estiloGrupo === 'CASADINHA' || estiloGrupo === 'CASADINHA_INTRA') return 'Casadinha: 1º x 2º do mesmo grupo'
    if (estiloGrupo === 'MATA_MATA_PURO') return 'Copa: Eliminatória Direta'
    return 'Modo Personalizado'
  }

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

        // ✅ LOGO: usa escudo_url e fallbacks
        const lista = (data || [])
          .map(t => {
            const eq = t.equipes
            if (!eq) return null
            return {
              ...eq,
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

  useEffect(() => {
    voice.setEnabled(somAtivo)
  }, [somAtivo]) // eslint-disable-line react-hooks/exhaustive-deps

const narrarInicio = async () => {
  if (!sfxRef.current) return
  await sfxRef.current.click()
  if (!somAtivo) return

  const frases = [
    "Alô, alô, torcida! Tá valendo! Atenção no telão… vai começar o sorteio oficial!",
    "Atenção, atenção! Clima de decisão no ar! Começa agora o sorteio da competição!",
    "Segura a emoção! Olho no telão! É agora… vamos pro sorteio oficial!"
  ]

  await voice.speakNarrador(frases[Math.floor(Math.random() * frases.length)])
}

const narrarResultado = async (nome, letra) => {
  if (!somAtivo) return

  const frases = (estiloGrupo === 'MATA_MATA_PURO')
    ? [
        `Tá definido! ${nome} confirmado! Segue o jogo!`,
        `Olha ele aí! ${nome}! Passou na roleta!`,
        `Anota aí! ${nome} tá dentro!`
      ]
    : [
        `A roleta parou! ${nome}! Vai pro Grupo ${letra}!`,
        `Confirmado no telão! ${nome}! Grupo ${letra}!`,
        `Tá cravado! ${nome}! No Grupo ${letra}!`,
        `É isso! ${nome}! Direto pro Grupo ${letra}!`
      ]

  await voice.speakNarrador(frases[Math.floor(Math.random() * frases.length)])
}

const narrarFim = async () => {
  if (!somAtivo) return
  const frases = [
    "Sorteio encerrado! Grupos definidos! Agora é bola rolando!",
    "Fim de sorteio! Tá tudo desenhado! Partiu tabela oficial!",
    "Tá pronto! A competição tá montada! Agora é jogo!"
  ]
  await voice.speakNarrador(frases[Math.floor(Math.random() * frases.length)])
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

  const onRoletaParou = async () => {
  if (!vencedorAtual) return

  const letraGrupo = letras[grupoAtualIndex]

  // ✅ espera terminar de falar
  await narrarResultado(vencedorAtual.nome_equipe, letraGrupo)

  // ✅ depois atualiza estados (sem setTimeout fixo)
  setGrupos(prev => ({
    ...prev,
    [grupoAtualIndex]: [...(prev[grupoAtualIndex] || []), vencedorAtual]
  }))

  setPoteSorteio(prev => {
    const novo = prev.filter(t => t.id !== vencedorAtual.id)

    if (novo.length === 0) {
      setTimeout(async () => {
        setFase('finalizado')
        await narrarFim()
      }, 120)
    }
    return novo
  })

  if (estiloGrupo !== 'MATA_MATA_PURO') {
    setGrupoAtualIndex(prev => (prev + 1) % qtdGrupos)
  }

  setVencedorAtual(null)
  setSorteando(false)
}


  // --- Salvar e Gerar Jogos
  const salvarEGerar = async () => {
    setLoading(true)
    try {
      await supabase.from('jogos').delete().eq('etapa_id', Number(etapaId))

      // salva grupos
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

      // 2) CRUZAMENTO
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
      alert('Erro: ' + e.message)
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center text-white gap-4">
        <Loader2 className="animate-spin w-12 h-12 text-blue-500" />
        <p className="font-black uppercase tracking-widest animate-pulse">Processando...</p>
      </div>
    )
  }

  return (
    <main className="min-h-screen bg-[#0F172A] text-white p-4 font-sans overflow-hidden bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-blue-900/20 via-[#0F172A] to-[#020617]">
      <div className="max-w-[1600px] mx-auto h-full flex flex-col">
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

        <motion.div initial={{ y: -20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} className="bg-blue-900/30 border border-blue-500/30 p-3 rounded-xl mb-6 flex items-center gap-3">
          <Info className="text-blue-400 shrink-0" size={20} />
          <div>
            <p className="text-[10px] uppercase font-bold text-blue-400 tracking-widest">Modo Atual</p>
            <p className="text-sm font-medium text-blue-100">{getDescricaoModo()}</p>
          </div>
        </motion.div>

        {fase === 'selecao' && (
          <div className="flex-1 flex flex-col items-center justify-center">
            <div className="bg-slate-900/50 border border-white/10 p-8 rounded-[3rem] backdrop-blur-xl shadow-2xl w-full max-w-5xl">
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
                      {active ? <CheckCircle2 size={14} className="text-white" /> : <div className="w-3.5 h-3.5 rounded-full border border-slate-500" />}
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
          <div className="grid grid-rows-[auto_1fr] h-full gap-4">
            <div className="flex flex-col items-center justify-center min-h-[350px]">
              <SponsorsTicker patrocinadores={patrocinadores} />

              <BlazeRoulette
                items={poteSorteio}
                onSpinEnd={onRoletaParou}
                vencedorParaGirar={vencedorAtual}
                patrocinadores={patrocinadores}
                sfx={sfxRef.current}
              />

              <div className="mt-6 h-20 flex items-center justify-center">
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

            <div className={`grid gap-4 w-full items-start overflow-y-auto pb-10 ${
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
              <Sparkles className="text-green-400 mx-auto mb-6 w-24 h-24 animate-pulse" />
              <h2 className="text-5xl font-black uppercase italic text-white mb-2">Sorteio Concluído!</h2>
              <p className="text-slate-400 text-lg mb-8">Todos os grupos foram definidos.</p>

              <button
                onClick={salvarEGerar}
                disabled={loading}
                className="bg-green-600 hover:bg-green-500 text-white font-black px-12 py-5 rounded-2xl uppercase text-xl shadow-xl flex items-center gap-3 mx-auto hover:scale-105 transition-all"
              >
                {loading ? <Loader2 className="animate-spin" /> : <Save />} Gerar Tabela Oficial
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
  )
}

export default function SorteioPage() {
  return (
    <Suspense fallback={<div className="bg-slate-950 min-h-screen flex items-center justify-center text-white">Carregando Sorteio...</div>}>
      <SorteioContent />
    </Suspense>
  )
}
