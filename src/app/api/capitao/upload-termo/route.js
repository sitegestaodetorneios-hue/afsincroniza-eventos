import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

function supabaseAnon() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    { auth: { persistSession: false } }
  )
}

export async function POST(request) {
  const supabase = supabaseAnon()

  try {
    const { equipe_id, arquivo_base64, nome_arquivo } = await request.json()

    if (!equipe_id || !arquivo_base64) {
      return NextResponse.json({ error: 'Dados incompletos.' }, { status: 400 })
    }

    // 1. Converter Base64 para Buffer
    const base64Data = arquivo_base64.split(';base64,').pop()
    const buffer = Buffer.from(base64Data, 'base64')

    // 2. Gerar nome único
    const extensao = nome_arquivo.split('.').pop()
    const path = `termos/equipe_${equipe_id}_${Date.now()}.${extensao}`

    // 3. Upload para o Supabase
    const { error: uploadError } = await supabase
      .storage
      .from('documentos')
      .upload(path, buffer, {
        contentType: arquivo_base64.match(/data:(.*);base64/)?.[1] || 'application/pdf',
        upsert: true
      })

    if (uploadError) {
      console.error('Erro Upload Storage:', uploadError)
      return NextResponse.json({ error: 'Falha ao salvar arquivo no servidor.' }, { status: 500 })
    }

    // 4. Pegar URL Pública
    const { data: publicUrlData } = supabase
      .storage
      .from('documentos')
      .getPublicUrl(path)

    const termo_url = publicUrlData.publicUrl

    // 5. Atualizar Tabela Equipes
    // AQUI ESTAVA O ERRO: mudamos termo_assinado para FALSE
    const { error: dbError } = await supabase
      .from('equipes')
      .update({ 
        termo_url: termo_url,
        termo_assinado: false // <--- CRUCIAL: Fica false (Pendente) até o Admin aprovar
      })
      .eq('id', equipe_id)

    if (dbError) {
      return NextResponse.json({ error: 'Erro ao vincular termo na equipe.' }, { status: 500 })
    }

    return NextResponse.json({ success: true, url: termo_url })

  } catch (e) {
    console.error(e)
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}