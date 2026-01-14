import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

function isAuthorized(request) {
  const pin = request.headers.get('x-admin-pin') || ''
  return pin && pin === (process.env.ADMIN_PIN || '2026')
}

function supabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  return createClient(url, key, { auth: { persistSession: false } })
}

// Função para embaralhar (Fisher-Yates)
function shuffle(array) {
  let currentIndex = array.length, randomIndex;
  while (currentIndex != 0) {
    randomIndex = Math.floor(Math.random() * currentIndex);
    currentIndex--;
    [array[currentIndex], array[randomIndex]] = [array[randomIndex], array[currentIndex]];
  }
  return array;
}

export async function POST(request) {
  if (!isAuthorized(request)) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const body = await request.json().catch(() => null)
  const etapa_id = Number(body?.etapa_id)

  if (!etapa_id) return NextResponse.json({ error: 'etapa_id obrigatório' }, { status: 400 })

  const supabase = supabaseAdmin()

  try {
    // 1. Buscar todas as equipes vinculadas a esta etapa
    const { data: links, error: errFetch } = await supabase
      .from('etapa_equipes')
      .select('id, equipe_id, equipes(nome_equipe)')
      .eq('etapa_id', etapa_id)

    if (errFetch) throw errFetch
    if (!links || links.length < 2) return NextResponse.json({ error: 'Poucas equipes para dividir em grupos.' }, { status: 400 })

    // 2. Embaralhar para ser um sorteio justo
    const sorteados = shuffle(links)

    // 3. Dividir na metade (3 e 3)
    const metade = Math.ceil(sorteados.length / 2)
    const updates = []

    for (let i = 0; i < sorteados.length; i++) {
      const grupo = i < metade ? 'A' : 'B'
      const item = sorteados[i]

      // Adiciona promessa de atualização na lista
      updates.push(
        supabase
          .from('etapa_equipes')
          .update({ grupo: grupo })
          .eq('id', item.id) // Atualiza pelo ID do vínculo
      )
    }

    // 4. Executar todas as atualizações
    await Promise.all(updates)

    return NextResponse.json({ 
      ok: true, 
      msg: `Sorteio realizado! ${metade} times no Grupo A e ${sorteados.length - metade} no Grupo B.` 
    })

  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}