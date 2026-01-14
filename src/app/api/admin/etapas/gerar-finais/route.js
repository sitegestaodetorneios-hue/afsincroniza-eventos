import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

// Evita cache para não pegar dados velhos
export const dynamic = 'force-dynamic'

function supabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY, // Se tiver Service Role, melhor usar aqui para garantir permissão de escrita
    { auth: { persistSession: false } }
  )
}

export async function POST(request) {
  const supabase = supabaseAdmin()
  const { etapa_id } = await request.json()

  if (!etapa_id) return NextResponse.json({ error: 'Etapa não informada' }, { status: 400 })

  try {
    // 1. Limpar finais anteriores dessa etapa para não duplicar
    await supabase.from('jogos').delete().eq('etapa_id', etapa_id).in('tipo_jogo', ['FINAL', 'DISPUTA_3'])

    // 2. Buscar Classificação Básica (Pontos, Vitórias, Gols)
    const { data: dadosView } = await supabase.from('vw_tabela_oficial').select('*').eq('etapa_id', etapa_id)
    
    // 3. Buscar Cartões (Critério de Desempate FIFA)
    // Precisamos buscar "na unha" igual fizemos na tabela
    const { data: jogos } = await supabase.from('jogos').select('id').eq('etapa_id', etapa_id)
    const jogoIds = jogos?.map(j => j.id) || []

    const { data: eventos } = await supabase
        .from('jogo_eventos')
        .select('tipo, equipe_id')
        .in('jogo_id', jogoIds)
        .in('tipo', ['AMARELO', 'VERMELHO'])

    const statsCartoes = {} // { equipe_id: { am: 0, verm: 0 } }

    eventos?.forEach(ev => {
        if (!statsCartoes[ev.equipe_id]) statsCartoes[ev.equipe_id] = { am: 0, verm: 0 }
        if (ev.tipo === 'AMARELO') statsCartoes[ev.equipe_id].am++
        if (ev.tipo === 'VERMELHO') statsCartoes[ev.equipe_id].verm++
    })

    // 4. Unir Dados e Ordenar (Lógica FIFA IDÊNTICA à Tabela)
    const classificacaoCompleta = (dadosView || []).map(time => {
        const cartoes = statsCartoes[time.equipe_id] || { am: 0, verm: 0 }
        return {
            ...time,
            ca: cartoes.am,
            cv: cartoes.verm
        }
    }).sort((a, b) => {
        // 1. Pontos
        if (b.pts !== a.pts) return b.pts - a.pts;
        // 2. Saldo de Gols (FIFA)
        const sgA = a.gp - a.gc;
        const sgB = b.gp - b.gc;
        if (sgB !== sgA) return sgB - sgA;
        // 3. Gols Pró
        if (b.gp !== a.gp) return b.gp - a.gp;
        // 4. Menos Vermelhos
        if (a.cv !== b.cv) return a.cv - b.cv; 
        // 5. Menos Amarelos
        return a.ca - b.ca;
    });

    // 5. Separar Grupos
    const grupoA = classificacaoCompleta.filter(t => t.grupo === 'A')
    const grupoB = classificacaoCompleta.filter(t => t.grupo === 'B')

    // Validar se temos times suficientes
    if (grupoA.length === 0 || grupoB.length === 0) {
        return NextResponse.json({ error: 'É necessário ter times no Grupo A e B com jogos realizados.' }, { status: 400 })
    }

    // 6. Definir Finalistas (1º de cada grupo)
    const finalistaA = grupoA[0]
    const finalistaB = grupoB[0]

    // 7. Definir Disputa de 3º (2º de cada grupo)
    const terceiroA = grupoA[1]
    const terceiroB = grupoB[1]

    const novosJogos = []

    // Criar Jogo da Final
    if (finalistaA && finalistaB) {
        novosJogos.push({
            etapa_id,
            equipe_a_id: finalistaA.equipe_id,
            equipe_b_id: finalistaB.equipe_id,
            tipo_jogo: 'FINAL',
            rodada: 99, // Número alto para ficar no fim
            status: 'EM_BREVE'
        })
    }

    // Criar Jogo de 3º Lugar (se houver times)
    if (terceiroA && terceiroB) {
        novosJogos.push({
            etapa_id,
            equipe_a_id: terceiroA.equipe_id,
            equipe_b_id: terceiroB.equipe_id,
            tipo_jogo: 'DISPUTA_3',
            rodada: 98,
            status: 'EM_BREVE'
        })
    }

    // 8. Salvar no Banco
    if (novosJogos.length > 0) {
        const { error } = await supabase.from('jogos').insert(novosJogos)
        if (error) throw error
    }

    return NextResponse.json({ success: true, jogos_criados: novosJogos.length })

  } catch (e) {
    console.error(e)
    return NextResponse.json({ error: 'Erro ao gerar finais: ' + e.message }, { status: 500 })
  }
}