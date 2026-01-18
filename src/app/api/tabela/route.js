import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

// ⚠️ SEM 'export const revalidate' ou 'force-dynamic' 
// Deixamos o controle total para o Header da resposta, igual à sua API ao-vivo.

function supabasePublic() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  )
}

export async function GET(request) {
  const { searchParams } = new URL(request.url)
  const etapa_id = searchParams.get('etapa_id')

  const supabase = supabasePublic()

  try {
    // 1. CARREGAR ETAPAS (MENU)
    const { data: etapas } = await supabase
      .from('etapas')
      .select('id, titulo, status, modalidade, regras')
      .order('created_at', { ascending: false })

    const etapaAtiva = etapa_id 
      ? etapas.find(e => e.id == etapa_id) 
      : etapas[0]

    // Se não tiver etapa, retorna vazio mas com o mesmo cache para proteger
    if (!etapaAtiva) {
        return NextResponse.json({ menu: etapas, etapa: null }, {
            status: 200,
            headers: { 'Cache-Control': 'public, s-maxage=30, stale-while-revalidate=59' }
        })
    }

    const id = etapaAtiva.id

    // 2. BUSCAR DADOS BRUTOS (PARALELO)
    const [timesRes, jogosRes, cartoesRes, artilhariaRes] = await Promise.all([
        supabase.from('etapa_equipes').select('equipe_id, grupo, equipes(nome_equipe)').eq('etapa_id', id),
        supabase.from('jogos').select('*').eq('etapa_id', id).order('id', { ascending: true }),
        supabase.from('jogo_eventos').select('*').in('tipo', ['AMARELO', 'VERMELHO']), 
        supabase.from('jogo_eventos').select('atleta_id, tipo, equipes(nome_equipe), atletas(nome)').eq('tipo', 'GOL')
    ])

    const timesData = timesRes.data || []
    const jogosData = jogosRes.data || []
    const jogosIds = jogosData.map(j => j.id)
    
    const cartoesData = (cartoesRes.data || []).filter(c => jogosIds.includes(c.jogo_id))
    const golsData = (artilhariaRes.data || []).filter(g => jogosIds.includes(g.jogo_id))

    // =================================================================================
    // 3. CÁLCULO DE CLASSIFICAÇÃO (LÓGICA AGRESSIVA IGUAL ADMIN)
    // =================================================================================
    const stats = {} 
    
    // Inicializa Times
    timesData.forEach(t => {
        let grp = (t.grupo || 'U').trim().toUpperCase().replace('GRUPO', '').trim()
        if(grp === '') grp = 'U'
        
        stats[t.equipe_id] = { 
            equipe_id: t.equipe_id, 
            nome_equipe: t.equipes?.nome_equipe || 'Time', 
            grupo: grp, 
            pts: 0, v: 0, e: 0, d: 0, j: 0, 
            sg: 0, gp: 0, gc: 0, 
            ca: 0, cv: 0 
        }
    })

    // Processa Jogos
    const jogosGrupos = jogosData.filter(j => j.tipo_jogo === 'GRUPO')
    
    jogosGrupos.forEach(j => {
        if (j.gols_a !== null && j.gols_b !== null) {
            const tA = j.equipe_a_id; const tB = j.equipe_b_id
            const gA = Number(j.gols_a); const gB = Number(j.gols_b)

            if (stats[tA] && stats[tB]) {
                stats[tA].j++; stats[tB].j++;
                stats[tA].gp += gA; stats[tA].gc += gB; stats[tA].sg += (gA - gB);
                stats[tB].gp += gB; stats[tB].gc += gA; stats[tB].sg += (gB - gA);

                if (gA > gB) { stats[tA].v++; stats[tA].pts += 3; stats[tB].d++; }
                else if (gB > gA) { stats[tB].v++; stats[tB].pts += 3; stats[tA].d++; }
                else { stats[tA].e++; stats[tA].pts += 1; stats[tB].e++; stats[tB].pts += 1; }
            }
        }
    })

    // Cartões
    cartoesData.forEach(c => {
        if (stats[c.equipe_id]) {
            if (c.tipo === 'AMARELO') stats[c.equipe_id].ca++
            if (c.tipo === 'VERMELHO') stats[c.equipe_id].cv++
        }
    })

    // Ordenação (Mesma lista do Admin)
    let classificacao = Object.values(stats)
    const regrasSalvas = etapaAtiva.regras?.criterios 
    const criterios = regrasSalvas && regrasSalvas.length > 0 ? regrasSalvas : ['PONTOS', 'VITORIAS', 'SALDO', 'GOLS_PRO', 'VERMELHOS', 'AMARELOS']

    classificacao.sort((a, b) => {
        if (a.grupo < b.grupo) return -1
        if (a.grupo > b.grupo) return 1

        for (let crit of criterios) {
            if (crit === 'PONTOS') { if (b.pts !== a.pts) return b.pts - a.pts }
            if (crit === 'VITORIAS') { if (b.v !== a.v) return b.v - a.v }
            if (crit === 'SALDO') { if (b.sg !== a.sg) return b.sg - a.sg }
            if (crit === 'GOLS_PRO') { if (b.gp !== a.gp) return b.gp - a.gp }
            if (crit === 'GOLS_CONTRA') { if (a.gc !== b.gc) return a.gc - b.gc } 
            if (crit === 'VERMELHOS') { if (a.cv !== b.cv) return a.cv - b.cv }
            if (crit === 'AMARELOS') { if (a.ca !== b.ca) return a.ca - b.ca }
        }
        return 0
    })

    // Artilharia
    const artilhariaMap = {}
    golsData.forEach(g => {
        if(g.atleta_id) {
            if(!artilhariaMap[g.atleta_id]) {
                artilhariaMap[g.atleta_id] = { 
                    nome: g.atletas?.nome || 'Atleta', 
                    equipe: g.equipes?.nome_equipe, 
                    gols: 0 
                }
            }
            artilhariaMap[g.atleta_id].gols++
        }
    })
    const artilharia = Object.values(artilhariaMap).sort((a, b) => b.gols - a.gols).slice(0, 10)

    // Defesa
    const defesa = classificacao
        .filter(t => t.j > 0)
        .sort((a, b) => (a.gc / a.j) - (b.gc / b.j))
        .slice(0, 5)

    // Finais
    const finais = jogosData
        .filter(j => j.tipo_jogo !== 'GRUPO')
        .map(j => {
            const timeA = stats[j.equipe_a_id]?.nome_equipe || j.origem_a || 'A definir'
            const timeB = stats[j.equipe_b_id]?.nome_equipe || j.origem_b || 'A definir'
            return { ...j, equipeA: { nome_equipe: timeA }, equipeB: { nome_equipe: timeB } }
        })

    // ✅ RESPOSTA IDÊNTICA À API 'AO-VIVO'
    return NextResponse.json({
      menu: etapas,
      etapa: etapaAtiva,
      classificacao,
      finais,
      artilharia,
      defesa,
      now: new Date().toISOString()
    }, {
        status: 200,
        headers: {
            'Cache-Control': 'public, s-maxage=30, stale-while-revalidate=59',
        }
    })

  } catch (e) {
    console.error("API Tabela Error:", e)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}