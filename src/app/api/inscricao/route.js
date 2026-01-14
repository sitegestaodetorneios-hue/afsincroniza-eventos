import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

export async function POST(request) {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  )

  try {
    const body = await request.json()
    const { nome_equipe, capitao, whatsapp, modalidade, cidade } = body

    // 1. Validação de Segurança: Verifica se ainda tem vaga antes de salvar
    // Busca config
    const { data: config } = await supabase.from('config').select('*').single()
    
    // Conta pagos dessa modalidade
    const { count: pagos } = await supabase
        .from('equipes')
        .select('*', { count: 'exact', head: true })
        .eq('modalidade', modalidade)
        .eq('pago', true)

    const limite = modalidade === 'FUTSAL' ? config.vagas_futsal : config.vagas_society
    
    // Se já lotou, bloqueia (Permite criar como "Reserva" se quiser, mas aqui vou bloquear)
    if (pagos >= limite) {
        return NextResponse.json({ error: 'Sinto muito, as vagas acabaram enquanto você preenchia!' }, { status: 400 })
    }

    // 2. Salva a equipe (como pago=false inicialmente)
    const { data, error } = await supabase
      .from('equipes')
      .insert([
        {
          nome_equipe,
          nome_capitao: capitao,
          whatsapp, // lembre de limpar caracteres no front
          modalidade,
          cidade,
          pago: false, // Começa pendente
          data_inscricao: new Date()
        }
      ])
      .select()

    if (error) throw error

    return NextResponse.json({ success: true, id: data[0].id })

  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}