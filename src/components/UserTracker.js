'use client'
import { useEffect } from 'react'
import { usePathname } from 'next/navigation'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
)

export default function UserTracker() {
  const pathname = usePathname()

  useEffect(() => {
    // Cria um ID único para este usuário nesta sessão
    const userId = Math.random().toString(36).substring(7)
    
    // Conecta no canal de monitoramento
    const channel = supabase.channel('online-users', {
      config: {
        presence: {
          key: userId,
        },
      },
    })

    channel.subscribe(async (status) => {
      if (status === 'SUBSCRIBED') {
        // Avisa: "Estou online nesta página!"
        await channel.track({
          online_at: new Date().toISOString(),
          page: pathname,
          device: window.innerWidth < 768 ? 'Mobile' : 'Desktop' 
        })
      }
    })

    return () => {
      supabase.removeChannel(channel)
    }
  }, [pathname]) // Se mudar de página, ele atualiza

  return null // Não renderiza nada visualmente
}