import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

export async function POST(req) {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  )

  try {
    const body = await req.json()
    const { nome_equipe, capitao, email, senha, modalidade, whatsapp, cidade } = body
    const emailLimpo = email.toLowerCase().trim()

    // 1. VERIFICAÇÃO DE DUPLICIDADE
    // Procuramos se já existe alguma equipe com este e-mail
    const { data: existe } = await supabase
      .from('equipes')
      .select('email')
      .eq('email', emailLimpo)
      .maybeSingle()

    if (existe) {
      return NextResponse.json(
        { error: 'Este e-mail já está sendo utilizado por outra equipe.' }, 
        { status: 400 }
      )
    }

    // 2. SE NÃO EXISTIR, PROSEGUE COM A INSERÇÃO
    const { data, error } = await supabase
      .from('equipes')
      .insert([
        {
          nome_equipe,
          nome_capitao: capitao, 
          email: emailLimpo,
          senha,
          senha_hash: senha,
          modalidade,
          whatsapp,
          cidade,
          pago: false,
          termo_assinado: false
        }
      ])
      .select()
      .single()

    if (error) throw error

    return NextResponse.json({ success: true, equipe: data })

  } catch (e) {
    console.error('ERRO INSCRIÇÃO:', e.message)
    return NextResponse.json({ error: 'Erro ao processar inscrição: ' + e.message }, { status: 500 })
  }
}