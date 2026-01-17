'use client'
import { useEffect, useState, useMemo, useRef } from 'react'
import { createClient } from '@supabase/supabase-js'
import { Activity, Users, Eye, ArrowUp, Zap, Clock } from 'lucide-react'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
)

export default function Monitoramento() {
  const [usersByPage, setUsersByPage] = useState({})
  const [totalOnline, setTotalOnline] = useState(0)
  const [totalAccumulated, setTotalAccumulated] = useState(0)
  const [startTime, setStartTime] = useState(null)
  
  // Refs para não perder contagem entre renderizações
  const seenIds = useRef(new Set())
  
  // Histórico de latência
  const [latencyHistory, setLatencyHistory] = useState([]) 

  useEffect(() => {
    setStartTime(new Date())

    // 1. MONITORAMENTO DE USUÁRIOS E ACUMULAÇÃO
    const channel = supabase.channel('online-users')
    
    channel.on('presence', { event: 'sync' }, () => {
        const state = channel.presenceState()
        const currentUsers = []
        
        // Percorre todos os usuários conectados agora
        for (const id in state) {
          state[id].forEach(session => {
            currentUsers.push(session)
            
            // LÓGICA DO ACUMULADOR (CLIENT-SIDE)
            // Se esse ID de usuário ainda não foi visto nesta sessão do admin, adiciona
            // O ID vem do tracker que criamos (Math.random)
            if (session.presence_ref && !seenIds.current.has(session.presence_ref)) {
                seenIds.current.add(session.presence_ref)
            }
          })
        }

        setTotalOnline(currentUsers.length)
        setTotalAccumulated(seenIds.current.size) // Atualiza o total visto

        // Agrupa por página
        const porPagina = currentUsers.reduce((acc, user) => {
          const page = user.page || 'Desconhecido'
          acc[page] = (acc[page] || 0) + 1
          return acc
        }, {})
        setUsersByPage(porPagina)
      })
      .subscribe()

    // 2. MONITORAMENTO DE SAÚDE (PING)
    const pingServer = async () => {
        const start = performance.now()
        await supabase.from('jogos').select('id', { count: 'exact', head: true }).limit(1)
        const end = performance.now()
        setLatencyHistory(prev => [...prev, Math.round(end - start)].slice(-60))
    }

    pingServer()
    const interval = setInterval(pingServer, 5000)

    return () => {
      supabase.removeChannel(channel)
      clearInterval(interval)
    }
  }, [])

  // Estatísticas de Latência
  const stats = useMemo(() => {
      if (latencyHistory.length === 0) return { current: 0, max: 0, avg: 0 }
      const current = latencyHistory[latencyHistory.length - 1]
      const max = Math.max(...latencyHistory)
      const sum = latencyHistory.reduce((a, b) => a + b, 0)
      const avg = Math.round(sum / latencyHistory.length)
      return { current, max, avg }
  }, [latencyHistory])

  const getHealthColor = (ms) => {
      if(!ms) return 'text-slate-500'
      if(ms < 300) return 'text-green-400'
      if(ms < 800) return 'text-yellow-400'
      return 'text-red-500 animate-pulse'
  }

  // Formata o tempo decorrido
  const getElapsedTime = () => {
      if (!startTime) return '0min'
      const diffMs = new Date() - startTime
      const diffMins = Math.floor(diffMs / 60000)
      return `${diffMins} min`
  }

  return (
    <main className="min-h-screen bg-slate-950 text-white p-4 md:p-8 font-mono">
      <div className="max-w-7xl mx-auto">
        
        {/* CABEÇALHO */}
        <div className="flex justify-between items-end mb-8 border-b border-slate-800 pb-4">
            <div>
                <h1 className="text-2xl font-black uppercase tracking-widest text-blue-500 flex items-center gap-2">
                    <Activity className="animate-pulse"/> Sala de Comando
                </h1>
                <p className="text-xs text-slate-500 mt-1">Monitoramento em Tempo Real (Sem Carga no DB)</p>
            </div>
            <div className="text-right text-xs text-slate-500">
                <p>Sessão iniciada há: <span className="text-white font-bold">{getElapsedTime()}</span></p>
            </div>
        </div>

        {/* METRICAS PRINCIPAIS */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
            
            {/* CARD 1: LATÊNCIA */}
            <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl">
                <p className="text-slate-500 text-[10px] font-black uppercase tracking-widest mb-1">Saúde do Banco</p>
                <div className={`text-3xl font-black ${getHealthColor(stats.current)} flex items-center gap-2`}>
                    <Zap size={20} className="fill-current"/> {stats.current}ms
                </div>
                <div className="mt-2 h-1 w-full bg-slate-800 rounded-full overflow-hidden">
                    <div className={`h-full ${stats.current < 300 ? 'bg-green-500' : 'bg-red-500'}`} style={{width: `${Math.min(stats.current/10, 100)}%`}}></div>
                </div>
            </div>

            {/* CARD 2: PICO DE LATÊNCIA */}
            <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl">
                <p className="text-slate-500 text-[10px] font-black uppercase tracking-widest mb-1">Pico (5 min)</p>
                <div className={`text-3xl font-black ${getHealthColor(stats.max)} flex items-center gap-2`}>
                    <ArrowUp size={20}/> {stats.max}ms
                </div>
                <p className="text-[10px] text-slate-600 mt-2">Média Estável: {stats.avg}ms</p>
            </div>

            {/* CARD 3: ONLINE AGORA */}
            <div className="bg-blue-900/20 border border-blue-500/30 p-5 rounded-2xl relative overflow-hidden">
                <div className="absolute top-0 right-0 p-4 opacity-10"><Users size={60}/></div>
                <p className="text-blue-300 text-[10px] font-black uppercase tracking-widest mb-1">Online Agora</p>
                <div className="text-4xl font-black text-white flex items-center gap-2">
                    {totalOnline}
                </div>
                <div className="flex items-center gap-2 mt-2">
                    <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>
                    <span className="text-[10px] uppercase text-blue-200">Ao Vivo</span>
                </div>
            </div>

            {/* CARD 4: ACUMULADO (A MÁGICA) */}
            <div className="bg-emerald-900/20 border border-emerald-500/30 p-5 rounded-2xl relative overflow-hidden">
                <div className="absolute top-0 right-0 p-4 opacity-10"><Eye size={60}/></div>
                <p className="text-emerald-300 text-[10px] font-black uppercase tracking-widest mb-1">Visitas Acumuladas</p>
                <div className="text-4xl font-black text-white flex items-center gap-2">
                    {totalAccumulated}
                </div>
                <p className="text-[10px] text-emerald-200/60 mt-2 flex items-center gap-1">
                    <Clock size={10}/> Nesta sessão do admin
                </p>
            </div>
        </div>

        {/* DETALHE POR PÁGINA */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
            <h3 className="text-sm font-black text-white uppercase tracking-widest mb-6 flex items-center gap-2">
                <Users size={16} className="text-slate-500"/> Onde eles estão?
            </h3>
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-3">
                {Object.entries(usersByPage).sort(([,a], [,b]) => b - a).map(([page, count]) => (
                    <div key={page} className="flex justify-between items-center bg-slate-950 p-3 rounded-lg border border-slate-800 hover:border-blue-500/50 transition-colors">
                        <code className="text-xs text-slate-400 truncate max-w-[200px]">{page}</code>
                        <span className="text-sm font-black text-white bg-slate-800 px-2 py-1 rounded-md min-w-[30px] text-center">{count}</span>
                    </div>
                ))}
                {totalOnline === 0 && (
                    <div className="col-span-full text-center py-8 text-slate-700 text-xs uppercase tracking-widest">Aguardando conexões...</div>
                )}
            </div>
        </div>
        
      </div>
    </main>
  )
}