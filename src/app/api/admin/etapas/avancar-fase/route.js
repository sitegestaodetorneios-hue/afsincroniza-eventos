import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

function supabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    { auth: { persistSession: false } }
  )
}

export async function POST(request) {
  const body = await request.json()
  const { etapa_id, regras } = body

  if (!etapa_id) return NextResponse.json({ error: 'Etapa ID obrigatório' }, { status: 400 })

  const supabase = supabaseAdmin()

  try {
    // 1. BUSCAR DADOS
    const { data: timesData } = await supabase.from('etapa_equipes').select('equipe_id, grupo, equipes(nome_equipe)').eq('etapa_id', etapa_id)
    const { data: jogosData } = await supabase.from('jogos').select('*').eq('etapa_id', etapa_id).order('id', { ascending: true })

    const idsJogos = jogosData?.map(j => j.id) || []
    const { data: cartoesData } = await supabase.from('jogo_eventos').select('equipe_id, tipo').in('jogo_id', idsJogos).in('tipo', ['AMARELO', 'VERMELHO'])

    // =================================================================================
    // 2. CALCULAR CLASSIFICAÇÃO (MODO AGRESSIVO: TEM GOL = CONTA)
    // =================================================================================
    const stats = {} 
    
    // Inicializa Times
    timesData?.forEach(t => {
        let grp = (t.grupo || 'U').toUpperCase().replace('GRUPO', '').trim();
        if(grp === '') grp = 'U';

        stats[t.equipe_id] = { 
            id: t.equipe_id, 
            nome: t.equipes?.nome_equipe || 'Time', 
            grupo: grp, 
            pts: 0, v: 0, sg: 0, gp: 0, gc: 0, ca: 0, cv: 0 
        }
    })

    // Filtra Jogos de Grupo
    const jogosGrupos = jogosData?.filter(j => j.tipo_jogo === 'GRUPO') || []

    jogosGrupos.forEach(j => {
        if (j.gols_a !== null && j.gols_b !== null) {
            const tA = j.equipe_a_id; const tB = j.equipe_b_id
            const gA = Number(j.gols_a); const gB = Number(j.gols_b)

            if (stats[tA] && stats[tB]) {
                stats[tA].gp += gA; stats[tA].gc += gB; stats[tA].sg += (gA - gB);
                stats[tB].gp += gB; stats[tB].gc += gA; stats[tB].sg += (gB - gA);

                if (gA > gB) { stats[tA].v++; stats[tA].pts += 3; }
                else if (gB > gA) { stats[tB].v++; stats[tB].pts += 3; }
                else { stats[tA].pts += 1; stats[tB].pts += 1; }
            }
        }
    })

    // Cartões
    cartoesData?.forEach(c => {
        if (stats[c.equipe_id]) {
            if (c.tipo === 'AMARELO') stats[c.equipe_id].ca++
            if (c.tipo === 'VERMELHO') stats[c.equipe_id].cv++
        }
    })

    // Agrupa e Ordena
    const ranking = {}
    Object.values(stats).forEach(time => {
        if (!ranking[time.grupo]) ranking[time.grupo] = []
        ranking[time.grupo].push(time)
    })

    // LOGICA DE ORDENAÇÃO IDÊNTICA À PÚBLICA
    const criterios = regras && regras.length > 0 ? regras : ['PONTOS', 'VITORIAS', 'SALDO', 'GOLS_PRO', 'VERMELHOS', 'AMARELOS']
    
    Object.keys(ranking).forEach(grupo => {
        ranking[grupo].sort((a, b) => {
            for (let crit of criterios) {
                if (crit === 'PONTOS') { if (b.pts !== a.pts) return b.pts - a.pts }
                if (crit === 'VITORIAS') { if (b.v !== a.v) return b.v - a.v }
                if (crit === 'SALDO') { if (b.sg !== a.sg) return b.sg - a.sg }
                if (crit === 'GOLS_PRO') { if (b.gp !== a.gp) return b.gp - a.gp }
                if (crit === 'GOLS_CONTRA') { if (a.gc !== b.gc) return a.gc - b.gc } // Menor é melhor
                if (crit === 'VERMELHOS') { if (a.cv !== b.cv) return a.cv - b.cv } // Menor é melhor
                if (crit === 'AMARELOS') { if (a.ca !== b.ca) return a.ca - b.ca } // Menor é melhor
            }
            return 0
        })
    })

    // =================================================================================
    // 3. MAPEAR VENCEDORES MATA-MATA
    // =================================================================================
    const jogosMataMata = jogosData?.filter(j => j.tipo_jogo !== 'GRUPO').sort((a, b) => a.id - b.id) || []
    const mapaVencedores = {} 
    const mapaPerdedores = {}

    jogosMataMata.forEach((j, index) => {
        const temPlacar = j.gols_a !== null && j.gols_b !== null;
        
        if (temPlacar) {
            const gA = Number(j.gols_a), gB = Number(j.gols_b)
            const pA = j.penaltis_a !== null ? Number(j.penaltis_a) : -1
            const pB = j.penaltis_b !== null ? Number(j.penaltis_b) : -1
            let w = null, l = null

            if (gA > gB) { w = j.equipe_a_id; l = j.equipe_b_id }
            else if (gB > gA) { w = j.equipe_b_id; l = j.equipe_a_id }
            else {
                if (pA > pB) { w = j.equipe_a_id; l = j.equipe_b_id }
                else if (pB > pA) { w = j.equipe_b_id; l = j.equipe_a_id }
            }

            if (w) mapaVencedores[index] = w
            if (l) mapaPerdedores[index] = l
        }
    })

    // =================================================================================
    // 4. ATUALIZAR JOGOS
    // =================================================================================
    let atualizados = 0
    let logs = []

    for (const jogo of jogosMataMata) {
        if (jogo.equipe_a_id && jogo.equipe_b_id) continue 

        let updateData = {}

        const resolve = (regra) => {
            if (!regra) return null;

            // 1. RANKING|A:0
            const matchRank = regra.match(/RANKING\|([A-Z]):(\d+)/i);
            if (matchRank) {
                const grp = matchRank[1].toUpperCase();
                const idx = parseInt(matchRank[2]); 
                const time = ranking[grp]?.[idx];
                
                if (time) return { id: time.id, nome: time.nome, origem: `Grupo ${grp} (${idx+1}º)` };
                else return { erro: `Grupo ${grp} (Tem ${ranking[grp]?.length || 0} times) - Posição ${idx} vazia` }
            }

            // 2. JOGO_VENC|INDEX:0
            const matchVenc = regra.match(/JOGO_VENC\|INDEX:(\d+)/i);
            if (matchVenc) {
                const idx = parseInt(matchVenc[1]);
                const tid = mapaVencedores[idx];
                if(tid) return { id: tid, nome: 'Vencedor', origem: `Jogo Index ${idx}` };
                else return { erro: `Vencedor Index ${idx} indefinido` }
            }

            // 3. JOGO_PERD|INDEX:0
            const matchPerd = regra.match(/JOGO_PERD\|INDEX:(\d+)/i);
            if (matchPerd) {
                const idx = parseInt(matchPerd[1]);
                const tid = mapaPerdedores[idx];
                if(tid) return { id: tid, nome: 'Perdedor', origem: `Jogo Index ${idx}` };
                else return { erro: `Perdedor Index ${idx} indefinido` }
            }

            return null;
        }

        if (!jogo.equipe_a_id) {
            const res = resolve(jogo.origem_a);
            if (res && res.id) { updateData.equipe_a_id = res.id; logs.push(`Jogo ${jogo.id} (A): ${res.nome}`); }
            else if (res && res.erro) logs.push(`Jogo ${jogo.id} (A): ${res.erro}`);
        }
        
        if (!jogo.equipe_b_id) {
            const res = resolve(jogo.origem_b);
            if (res && res.id) { updateData.equipe_b_id = res.id; logs.push(`Jogo ${jogo.id} (B): ${res.nome}`); }
            else if (res && res.erro) logs.push(`Jogo ${jogo.id} (B): ${res.erro}`);
        }

        if (Object.keys(updateData).length > 0) {
            await supabase.from('jogos').update(updateData).eq('id', jogo.id)
            atualizados++
        }
    }

    return NextResponse.json({ 
        success: true, 
        atualizados, 
        debugMessage: `GRUPOS NO SISTEMA: ${Object.keys(ranking).join(', ')}\n\nLOGS:\n${logs.join('\n')}`
    })

  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}