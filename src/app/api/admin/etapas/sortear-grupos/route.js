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

export async function POST(request) {
  if (!isAuthorized(request)) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const body = await request.json().catch(() => null)
  const etapa_id = Number(body?.etapa_id)

  if (!etapa_id) return NextResponse.json({ error: 'etapa_id obrigatório' }, { status: 400 })

  const supabase = supabaseAdmin()

  try {
    // SE VIER LISTA MANUAL (Do seu Sorteio Animado)
    if (body.sorteio_manual && Array.isArray(body.sorteio_manual)) {
        const manual = body.sorteio_manual;
        const updates = [];

        // Atualiza UM POR UM para garantir a gravação correta da ORDEM
        for (const item of manual) {
            if (item.equipe_id && item.grupo) {
                updates.push(
                    supabase
                        .from('etapa_equipes')
                        .update({ 
                            grupo: item.grupo,
                            ordem_sorteio: item.ordem // <--- AQUI ESTÁ A SOLUÇÃO
                        })
                        .eq('equipe_id', Number(item.equipe_id)) // Procura pelo ID do Time
                        .eq('etapa_id', etapa_id)                // Na etapa certa
                )
            }
        }

        await Promise.all(updates);
        return NextResponse.json({ ok: true, msg: 'Grupos e ordem salvos!' });
    }

    return NextResponse.json({ error: 'Nenhum dado manual enviado.' }, { status: 400 })

  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}