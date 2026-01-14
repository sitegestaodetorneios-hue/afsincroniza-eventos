import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

function isAuthorized(request) {
  const pin = request.headers.get('x-admin-pin') || ''
  return pin === (process.env.ADMIN_PIN || '2026')
}

function supabaseAdmin() {
    return createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL,
        process.env.SUPABASE_SERVICE_ROLE_KEY,
        { auth: { persistSession: false } }
    )
}

// GET: Lista times da etapa com seus grupos (A ou B)
export async function GET(request) {
    if (!isAuthorized(request)) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

    const { searchParams } = new URL(request.url)
    const etapa_id = searchParams.get('etapa_id')

    if (!etapa_id) return NextResponse.json({ error: 'ID obrigatório' }, { status: 400 })

    const supabase = supabaseAdmin()
    
    // Busca o vínculo e os dados da equipe
    const { data, error } = await supabase
        .from('etapa_equipes')
        .select('id, grupo, equipe_id, equipes ( id, nome_equipe, cidade )')
        .eq('etapa_id', etapa_id)
        .order('grupo', { ascending: true }) // Ordena A primeiro, depois B

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    // Limpa a resposta para ficar fácil de ler no front
    const times = data.map(item => ({
        id: item.equipe_id,
        vinculo_id: item.id,
        nome_equipe: item.equipes?.nome_equipe || 'Desconhecido',
        cidade: item.equipes?.cidade,
        grupo: item.grupo || 'A' // Se null, assume A
    }))

    return NextResponse.json(times)
}

// POST: Importar/Limpar
export async function POST(request) {
  if (!isAuthorized(request)) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const body = await request.json()
  const { action, etapa_id, selected_ids } = body 

  if (!etapa_id) return NextResponse.json({ error: 'Etapa ID obrigatório' }, { status: 400 })

  const supabase = supabaseAdmin()

  try {
    // LIMPAR TUDO DA ETAPA
    if (action === 'clear') {
        await supabase.from('jogos').delete().eq('etapa_id', etapa_id)
        await supabase.from('etapa_equipes').delete().eq('etapa_id', etapa_id)
        return NextResponse.json({ ok: true, msg: 'Etapa zerada com sucesso!' })
    }

    // IMPORTAR TIMES SELECIONADOS
    if (action === 'import_selected') {
        if (!selected_ids || !Array.isArray(selected_ids) || selected_ids.length === 0) {
            return NextResponse.json({ error: 'Nenhum time selecionado.' }, { status: 400 })
        }

        const inserts = selected_ids.map(id => ({
            etapa_id: Number(etapa_id),
            equipe_id: Number(id),
            grupo: 'A' // Entra no A por padrão, depois sorteia
        }))

        const { error } = await supabase.from('etapa_equipes').upsert(inserts, { onConflict: 'etapa_id, equipe_id', ignoreDuplicates: true })
        if (error) throw error;

        return NextResponse.json({ ok: true, msg: `${inserts.length} times adicionados!` })
    }

    return NextResponse.json({ error: 'Ação inválida' }, { status: 400 })

  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}