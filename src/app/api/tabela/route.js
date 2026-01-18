import { createClient } from '@supabase/supabase-js'

// 1. Forçamos o Next.js a tratar como estático o máximo possível
export const dynamic = 'force-static'
export const revalidate = 30 

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
    // --- TODA A SUA LÓGICA DE CÁLCULO (MANTIDA INTEGRALMENTE) ---
    const { data: etapas } = await supabase.from('etapas').select('*').order('created_at', { ascending: false })
    const etapaAtiva = etapa_id ? etapas.find(e => e.id == etapa_id) : etapas[0]

    if (!etapaAtiva) {
        return new Response(JSON.stringify({ menu: etapas, etapa: null }), {
            status: 200,
            headers: { 'Content-Type': 'application/json', 'Cache-Control': 'public, s-maxage=30' }
        })
    }

    const id = etapaAtiva.id
    const [timesRes, jogosRes, cartoesRes, artilhariaRes] = await Promise.all([
        supabase.from('etapa_equipes').select('equipe_id, grupo, equipes(nome_equipe)').eq('etapa_id', id),
        supabase.from('jogos').select('*').eq('etapa_id', id).order('id', { ascending: true }),
        supabase.from('jogo_eventos').select('*').in('tipo', ['AMARELO', 'VERMELHO']), 
        supabase.from('jogo_eventos').select('atleta_id, tipo, equipes(nome_equipe), atletas(nome), jogo_id').eq('tipo', 'GOL')
    ])

    const stats = {} 
    timesRes.data?.forEach(t => {
        let grp = (t.grupo || 'U').trim().toUpperCase().replace('GRUPO', '').trim() || 'U'
        stats[t.equipe_id] = { equipe_id: t.equipe_id, nome_equipe: t.equipes?.nome_equipe || 'Time', grupo: grp, pts: 0, v: 0, e: 0, d: 0, j: 0, sg: 0, gp: 0, gc: 0, ca: 0, cv: 0 }
    })

    jogosRes.data?.filter(j => j.tipo_jogo === 'GRUPO').forEach(j => {
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

    let classificacao = Object.values(stats)
    const regrasSalvas = etapaAtiva.regras?.criterios 
    const criterios = (regrasSalvas && regrasSalvas.length > 0) ? regrasSalvas : ['PONTOS', 'VITORIAS', 'SALDO', 'GOLS_PRO', 'VERMELHOS', 'AMARELOS']

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

    const artilhariaMap = {}
    artilhariaRes.data?.forEach(g => {
        if(g.atleta_id) {
            if(!artilhariaMap[g.atleta_id]) artilhariaMap[g.atleta_id] = { nome: g.atletas?.nome || 'Atleta', equipe: g.equipes?.nome_equipe, gols: 0 }
            artilhariaMap[g.atleta_id].gols++
        }
    })

    const corpo = {
      menu: etapas,
      etapa: etapaAtiva,
      classificacao,
      finais: jogosRes.data?.filter(j => j.tipo_jogo !== 'GRUPO').map(j => ({
          ...j, equipeA: { nome_equipe: stats[j.equipe_a_id]?.nome_equipe || j.origem_a || 'A definir' },
          equipeB: { nome_equipe: stats[j.equipe_b_id]?.nome_equipe || j.origem_b || 'A definir' }
      })),
      artilharia: Object.values(artilhariaMap).sort((a, b) => b.gols - a.gols).slice(0, 10),
      defesa: classificacao.filter(t => t.j > 0).sort((a, b) => (a.gc / a.j) - (b.gc / b.j)).slice(0, 5),
      now: new Date().toISOString()
    }

    // --- ✅ A SOLUÇÃO FINAL: USAR 'new Response' PARA LIMPAR OS HEADERS ---
    return new Response(JSON.stringify(corpo), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'public, s-maxage=30, stale-while-revalidate=59',
        // SOBRESCREVEMOS O VARY PARA REMOVER O RSC QUE CAUSA O MISS
        'Vary': 'Accept-Encoding' 
      }
    })

  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), { status: 500 })
  }
}