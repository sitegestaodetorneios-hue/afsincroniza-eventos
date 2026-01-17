'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@supabase/supabase-js'
import { Activity, Users, Smartphone, Monitor, BarChart3, AlertCircle } from 'lucide-react'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
)

export default function Monitoramento() {
  const [users, setUsers] = useState({})
  const [total, setTotal] = useState(0)
  const [dbLatency, setDbLatency] = useState(null)

  useEffect(() => {
    // 1. MONITORAMENTO DE USUÁRIOS (REALTIME)
    const channel = supabase.channel('online-users')
    
    channel
      .on('presence', { event: 'sync' }, () => {
        const state = channel.presenceState()
        const allUsers = []
        
        // Processa os dados brutos do Supabase
        for (const id in state) {
          const userSessions = state[id]
          userSessions.forEach(session => allUsers.push(session))
        }

        setTotal(allUsers.length)

        // Agrupa por página
        const porPagina = allUsers.reduce((acc, user) => {
          const page = user.page || 'Desconhecido'
          acc[page] = (acc[page] || 0) + 1
          return acc
        }, {})
        
        setUsers(porPagina)
      })
      .subscribe()

    // 2. MONITORAMENTO DE SAÚDE DO BANCO (PING)
    const interval = setInterval(async () => {
        const start = Date.now()
        await supabase.from('jogos').select('id').limit(1).maybeSingle()
        const end = Date.now()
        setDbLatency(end - start)
    }, 5000) // Testa a cada 5 segundos

    return () => {
      supabase.removeChannel(channel)
      clearInterval(interval)
    }
  }, [])

  // Definição de cores baseada na latência
  const getHealthColor = (ms) => {
      if(!ms) return 'bg-slate-200'
      if(ms < 200) return 'bg-green-500' // Ótimo
      if(ms < 800) return 'bg-yellow-500' // Atenção
      return 'bg-red-600 animate-pulse' // Perigo
  }

  return (
    <main className="min-h-screen bg-slate-900 text-white p-6 md:p-12 font-mono">
      <div className="max-w-6xl mx-auto">
        
        <div className="flex justify-between items-center mb-10 border-b border-slate-700 pb-6">
            <div>
                <h1 className="text-3xl font-black uppercase tracking-widest text-blue-400 flex items-center gap-3">
                    <Activity className="animate-pulse" /> Monitoramento Real-Time
                </h1>
                <p className="text-slate-400 text-sm mt-1">Torneio Pérolas do Vale • Status do Servidor</p>
            </div>
            
            <div className="text-right">
                <div className="flex items-center gap-2 justify-end">
                    <span className={`w-3 h-3 rounded-full ${getHealthColor(dbLatency)}`}></span>
                    <span className="font-bold">{dbLatency ? `${dbLatency}ms` : '---'}</span>
                </div>
                <p className="text-[10px] uppercase text-slate-500 tracking-widest">Latência do Banco</p>
            </div>
        </div>

        {/* CARDS PRINCIPAIS */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10">
            {/* TOTAL ONLINE */}
            <div className="bg-slate-800 border border-slate-700 p-6 rounded-2xl relative overflow-hidden group">
                <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity"><Users size={80}/></div>
                <h3 className="text-slate-400 text-xs font-black uppercase tracking-[0.2em] mb-2">Usuários Online Agora</h3>
                <p className="text-6xl font-black text-white">{total}</p>
                <div className="mt-4 flex gap-2 text-[10px] text-green-400 font-bold uppercase bg-green-400/10 inline-block px-3 py-1 rounded-full">
                    <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse my-auto"></span> Ao Vivo
                </div>
            </div>

            {/* ANALYTICS EXTERNO */}
            <div className="bg-slate-800 border border-slate-700 p-6 rounded-2xl flex flex-col justify-center gap-4">
                <div className="flex items-center gap-3 text-slate-300">
                    <BarChart3 />
                    <span className="font-bold text-sm">Painéis Externos (Mais detalhados)</span>
                </div>
                <div className="grid grid-cols-2 gap-3">
                    <a href="https://supabase.com/dashboard/project/_/reports/database" target="_blank" className="bg-emerald-600/20 hover:bg-emerald-600/40 border border-emerald-500/50 text-emerald-400 text-xs font-bold uppercase py-3 rounded-xl text-center transition-colors">
                        Supabase Health
                    </a>
                    <a href="https://vercel.com/dashboard" target="_blank" className="bg-white/5 hover:bg-white/10 border border-white/10 text-white text-xs font-bold uppercase py-3 rounded-xl text-center transition-colors">
                        Vercel Logs
                    </a>
                </div>
            </div>

            {/* STATUS API */}
            <div className="bg-slate-800 border border-slate-700 p-6 rounded-2xl">
                 <h3 className="text-slate-400 text-xs font-black uppercase tracking-[0.2em] mb-4">Cache Check</h3>
                 <div className="space-y-3">
                    <div className="flex justify-between items-center text-sm border-b border-slate-700 pb-2">
                        <span className="text-slate-300">API Partidas</span>
                        <span className="text-green-400 font-mono text-xs">Cache: 15s</span>
                    </div>
                    <div className="flex justify-between items-center text-sm border-b border-slate-700 pb-2">
                        <span className="text-slate-300">API Tabela</span>
                        <span className="text-green-400 font-mono text-xs">Cache: 30s</span>
                    </div>
                    <div className="flex justify-between items-center text-sm">
                        <span className="text-slate-300">Home</span>
                        <span className="text-blue-400 font-mono text-xs">Cache: 1h</span>
                    </div>
                 </div>
            </div>
        </div>

        {/* DETALHE POR PÁGINA */}
        <h2 className="text-xl font-black uppercase italic text-white mb-6 flex items-center gap-2">
            <Monitor size={20} className="text-blue-500"/> Tráfego por Página
        </h2>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
            {Object.entries(users).sort(([,a], [,b]) => b - a).map(([page, count]) => (
                <div key={page} className="bg-slate-800 border-l-4 border-blue-500 p-4 rounded-r-xl flex justify-between items-center hover:bg-slate-750 transition-colors">
                    <span className="font-mono text-sm text-slate-300 truncate max-w-[200px]" title={page}>{page}</span>
                    <span className="text-2xl font-black text-white">{count}</span>
                </div>
            ))}
            
            {total === 0 && (
                <div className="col-span-full py-10 text-center text-slate-600 font-bold border-2 border-dashed border-slate-800 rounded-xl">
                    Esperando usuários conectarem...
                </div>
            )}
        </div>

        <div className="mt-10 bg-yellow-900/20 border border-yellow-600/30 p-4 rounded-xl flex gap-3 items-start">
            <AlertCircle className="text-yellow-500 shrink-0" size={20} />
            <div className="text-xs text-yellow-200/80">
                <strong>Nota Técnica:</strong> Este painel usa WebSocket (Supabase Realtime). 
                No plano Grátis do Supabase, o limite é de 200 conexões simultâneas (o painel para de contar se passar disso, mas o site continua funcionando normalmente para os usuários). 
                Para o site não cair, confie nos indicadores de "Latência do Banco" no topo.
            </div>
        </div>

      </div>
    </main>
  )
}