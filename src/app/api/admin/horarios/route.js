import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

function isAuthorized(request) {
  const pin = request.headers.get('x-admin-pin') || ''
  return pin === (process.env.ADMIN_PIN || '2026')
}

// Soma minutos ao horário "HH:MM:SS"
function addMinutes(timeStr, minutesToAdd) {
    const [h, m] = timeStr.split(':').map(Number);
    const date = new Date();
    date.setHours(h, m, 0, 0);
    date.setMinutes(date.getMinutes() + minutesToAdd);
    
    const hh = String(date.getHours()).padStart(2, '0');
    const mm = String(date.getMinutes()).padStart(2, '0');
    return `${hh}:${mm}:00`;
}

export async function POST(request) {
  if (!isAuthorized(request)) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const body = await request.json()
  const { etapa_id, data_jogo, hora_inicio_base, duracao_min, intervalo_min } = body

  if (!etapa_id) return NextResponse.json({ error: 'Etapa ID obrigatório' }, { status: 400 })
  if (!data_jogo) return NextResponse.json({ error: 'Data dos jogos é obrigatória' }, { status: 400 })

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  )

  try {
    // 1. Busca os jogos da etapa ordenados
    const { data: jogos, error: errFetch } = await supabase
        .from('jogos')
        .select('id, rodada')
        .eq('etapa_id', etapa_id)
        .order('rodada')
        .order('id')

    if (errFetch) throw errFetch
    if (!jogos || jogos.length === 0) return NextResponse.json({ error: 'Nenhum jogo encontrado nesta etapa.' }, { status: 404 })

    // 2. Calcula e atualiza
    let currentTime = hora_inicio_base || '08:00';
    // Se o usuário mandar '08:00', garante formatação
    if(currentTime.length === 5) currentTime += ':00';

    const duracao = Number(duracao_min || 50); // Tempo de jogo
    const intervalo = Number(intervalo_min || 5); // Tempo de troca
    const tempoTotal = duracao + intervalo; // Ex: 50 + 5 = 55 min por slot

    const updates = [];

    for (const jogo of jogos) {
        updates.push(
            supabase.from('jogos').update({ 
                horario: currentTime,
                data_jogo: data_jogo // <--- FORÇA A DATA EM TODOS
            }).eq('id', jogo.id)
        );

        // Avança o relógio
        currentTime = addMinutes(currentTime, tempoTotal);
    }

    await Promise.all(updates);

    return NextResponse.json({ 
        ok: true, 
        jogos_atualizados: updates.length,
        msg: 'Agenda atualizada com sucesso!'
    })

  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}