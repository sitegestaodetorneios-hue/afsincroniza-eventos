'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  ArrowLeft, PlusCircle, Save, CheckCircle, X, Loader2,
  Trash2, Shuffle, Trophy, Clock, Calendar,
  Edit3, Lock, Shield, Settings, Mic, ClipboardList, Target, Zap, ArrowUp, ArrowDown
} from 'lucide-react'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
)

// ======================================================
// ✅ ALGORITMOS (AGORA GERANDO FOLGA QUANDO ÍMPAR / BYE)
// ======================================================
function gerarConfrontosBerger(times) {
  if (times.length < 2) return []
  const mapTimes = times.length % 2 === 0 ? [...times] : [...times, null] // BYE
  const total = mapTimes.length
  const rodadas = total - 1
  const jogosPorRodada = total / 2
  const out = []

  for (let r = 0; r < rodadas; r++) {
    const rodada = []
    for (let i = 0; i < jogosPorRodada; i++) {
      const t1 = mapTimes[i]
      const t2 = mapTimes[total - 1 - i]

      if (t1 && t2) rodada.push({ a: t1, b: t2, bye: false })
      else if (t1 && !t2) rodada.push({ a: t1, b: null, bye: true })
      else if (!t1 && t2) rodada.push({ a: t2, b: null, bye: true })
    }
    out.push(rodada)

    // Berger rotation: fixa index 0 e gira o resto
    mapTimes.splice(1, 0, mapTimes.pop())
  }
  return out
}

// ✅ Cruzamento com FOLGA (quando grupos têm tamanhos diferentes)
function gerarCruzamentoRotativo(grupoA, grupoB) {
  let A = [...grupoA]
  let B = [...grupoB]
  if (B.length > A.length) { const tmp = A; A = B; B = tmp }
  while (B.length < A.length) B.push(null)

  const len = A.length
  const rodadas = []

  for (let r = 0; r < len; r++) {
    const jogos = []
    for (let i = 0; i < len; i++) {
      const a = A[i]
      const b = B[(i + r) % len]
      if (a && b) jogos.push({ a, b, bye: false })
      else if (a && !b) jogos.push({ a, b: null, bye: true })
    }
    rodadas.push(jogos)
  }
  return rodadas
}

const CRITERIOS_LABEL = {
  PONTOS: 'Pontos',
  VITORIAS: 'Vitórias',
  SALDO: 'Saldo Gols',
  GOLS_PRO: 'Gols Pró',
  VERMELHOS: 'C. Vermelhos',
  AMARELOS: 'C. Amarelos'
}

export default function GestaoJogosModelo() {
  const [pin, setPin] = useState('')
  const [authed, setAutenticado] = useState(false)
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  const [etapas, setEtapas] = useState([])
  const [etapaId, setEtapaId] = useState('')
  const [jogos, setJogos] = useState([])
  const [timesDaEtapa, setTimesDaEtapa] = useState([])
  const [modelos, setModelos] = useState([])

  const [modeloSelecionado, setModeloSelecionado] = useState('')
  const [qtdGrupos, setQtdGrupos] = useState(2)
  const [estiloGrupo, setEstiloGrupo] = useState('INTRA_GRUPO')

  const [regras, setRegras] = useState(['PONTOS', 'VITORIAS', 'SALDO', 'GOLS_PRO', 'VERMELHOS', 'AMARELOS'])

  // ✅ REGRAS FIFA DA ETAPA (EDITÁVEIS)
  const [temposPartida, setTemposPartida] = useState(['1T', '2T'])
  const [assinaturasRequired, setAssinaturasRequired] = useState({ ARBITRO: 2, MESARIO: 1 })
  const [empateMataMata, setEmpateMataMata] = useState('PENALTIS') // PENALTIS | PRORROGACAO | REPLAY | NENHUM
  const [empateGrupos, setEmpateGrupos] = useState('NORMAL')       // NORMAL | PENALTIS | NENHUM
  const [prorroMinutos, setProrroMinutos] = useState(5)
  const [prorroTempos, setProrroTempos] = useState(['PR1', 'PR2'])
  const [cartoesRegra, setCartoesRegra] = useState({
    dois_amarelos: { suspende_jogos: 1, zera_apos_cumprir: true },
    vermelho_direto: { punicao: 'SUSPENDE', suspende_jogos: 1 }, // ou ELIMINA
    acumulacao_amarelos: { ativo: false, limite: 3, suspende_jogos: 1 },
    limpa_na_fase: false
  })

  const [showModalTimes, setShowModalTimes] = useState(false)
  const [todosTimes, setTodosTimes] = useState([])
  const [selectedTeams, setSelectedTeams] = useState(new Set())
  const [horData, setHorData] = useState('')
  const [horInicio, setHorInicio] = useState('08:00')
  const [horDuracao, setHorDuracao] = useState(50)

  const [novoJogo, setNovoJogo] = useState({ descricao: '', rodada: '', equipe_a_id: '', equipe_b_id: '' })

  function auth() {
    if (pin === '2026') setAutenticado(true)
    else alert('PIN incorreto')
  }

  useEffect(() => {
    if (authed) {
      carregarEtapas()
      carregarModelos()
      carregarTodosTimes()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authed])

  useEffect(() => {
    if (etapaId) selecionarEtapa(etapaId)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [etapaId])

  async function carregarEtapas() {
    const { data } = await supabase.from('etapas').select('*').order('created_at', { ascending: false })
    setEtapas(data || [])
  }

  async function carregarModelos() {
    const { data } = await supabase.from('modelos_campeonato').select('*').order('id', { ascending: false })
    setModelos(data || [])
  }

  async function carregarTodosTimes() {
    const { data } = await supabase.from('equipes').select('*').order('nome_equipe')
    setTodosTimes(data || [])
  }

  async function selecionarEtapa(id) {
    if (!id) return
    setLoading(true)
    setEtapaId(String(id))
    setJogos([])
    try {
      const { data: etapaData } = await supabase.from('etapas').select('regras').eq('id', Number(id)).single()
      if (etapaData?.regras?.criterios) setRegras(etapaData.regras.criterios)

      // ✅ carregar config FIFA da etapa
      const r = etapaData?.regras || {}

      if (Array.isArray(r?.sumula?.tempos) && r.sumula.tempos.length) {
        setTemposPartida(r.sumula.tempos)
      } else {
        setTemposPartida(['1T', '2T'])
      }

      if (r?.sumula?.assinaturas_required) {
        setAssinaturasRequired({
          ARBITRO: Number(r.sumula.assinaturas_required.ARBITRO ?? 2),
          MESARIO: Number(r.sumula.assinaturas_required.MESARIO ?? 1)
        })
      } else {
        setAssinaturasRequired({ ARBITRO: 2, MESARIO: 1 })
      }

      if (r?.empate?.mata_mata) setEmpateMataMata(String(r.empate.mata_mata))
      if (r?.empate?.grupos) setEmpateGrupos(String(r.empate.grupos))

      if (r?.empate?.prorrogacao?.minutos) setProrroMinutos(Number(r.empate.prorrogacao.minutos))
      if (Array.isArray(r?.empate?.prorrogacao?.tempos) && r.empate.prorrogacao.tempos.length) {
        setProrroTempos(r.empate.prorrogacao.tempos)
      }

      if (r?.cartoes) {
        setCartoesRegra(prev => ({
          ...prev,
          ...r.cartoes
        }))
      }

      const { data: timesData } = await supabase
        .from('etapa_equipes')
        .select('*, equipes(*)')
        .eq('etapa_id', Number(id))

      const listaTimes = timesData?.map(t => {
        const eq = t.equipes || {}
        return {
          ...eq,
          grupo: t.grupo,
          logo_url: eq.logo_url || eq.escudo_url || eq.escudo || eq.logo || null
        }
      }) || []
      setTimesDaEtapa(listaTimes)

      const mapaTimes = {}
      listaTimes.forEach(t => { mapaTimes[t.id] = t })

      const { data: jogosCrus, error } = await supabase
        .from('jogos')
        .select('*')
        .eq('etapa_id', Number(id))
        .order('rodada', { ascending: true })
        .order('id', { ascending: true })

      if (error) throw error

      const jogosCompletos = (jogosCrus || []).map(j => ({
        ...j,
        equipeA: j.equipe_a_id ? mapaTimes[j.equipe_a_id] : null,
        equipeB: j.equipe_b_id ? mapaTimes[j.equipe_b_id] : null
      }))

      setJogos(jogosCompletos)
    } catch (e) {
      console.error('Erro ao selecionar etapa:', e)
    } finally {
      setLoading(false)
    }
  }

  function moverRegra(index, direcao) {
    const novasRegras = [...regras]
    const item = novasRegras[index]
    if (direcao === 'UP' && index > 0) {
      novasRegras[index] = novasRegras[index - 1]
      novasRegras[index - 1] = item
    } else if (direcao === 'DOWN' && index < novasRegras.length - 1) {
      novasRegras[index] = novasRegras[index + 1]
      novasRegras[index + 1] = item
    }
    setRegras(novasRegras)
  }

  async function atualizarClassificados() {
    if (!etapaId) return
    setLoading(true)
    try {
      // mantém compatível: salva as regras completas
      await salvarRegrasDaEtapa()

      const res = await fetch('/api/admin/etapas/avancar-fase', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ etapa_id: Number(etapaId), regras })
      })

      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Erro na API')

      let msg = `Cálculo Finalizado!\n\nJogos Atualizados: ${data.atualizados}`
      if (data.atualizados === 0) msg = data.debugMessage || (msg + `\n\nNenhum jogo novo preenchido.`)
      alert(msg)

      await selecionarEtapa(etapaId)
    } catch (e) {
      alert('Erro: ' + e.message)
    } finally {
      setLoading(false)
    }
  }

  async function salvarRegrasDaEtapa() {
    if (!etapaId) return

    const payloadRegras = {
      criterios: regras,
      sumula: {
        tempos: temposPartida,
        eventos: ['GOL', 'AMARELO', 'VERMELHO'],
        assinaturas_required: {
          ARBITRO: Number(assinaturasRequired.ARBITRO || 1),
          MESARIO: Number(assinaturasRequired.MESARIO || 1)
        }
      },
      cartoes: cartoesRegra,
      empate: {
        grupos: empateGrupos,
        mata_mata: empateMataMata,
        prorrogacao: {
          tempos: prorroTempos,
          minutos: Number(prorroMinutos || 5)
        }
      }
    }

    const { error } = await supabase
      .from('etapas')
      .update({ regras: payloadRegras })
      .eq('id', Number(etapaId))

    if (error) throw error
  }

  // ======================================================
  // ✅ GERAR TUDO
  // ======================================================
  async function gerarTudo() {
    if (!etapaId || !modeloSelecionado || timesDaEtapa.length < 2) {
      return alert('Selecione etapa, modelo e importe times.')
    }
    if (!confirm(`ATENÇÃO: A tabela atual será apagada!\n\nContinuar?`)) return

    setLoading(true)
    try {
      const { data: modelo } = await supabase
        .from('modelos_campeonato')
        .select('*')
        .eq('id', modeloSelecionado)
        .single()

      await supabase.from('jogos').delete().eq('etapa_id', Number(etapaId))

      await salvarRegrasDaEtapa()

      const timesEmbaralhados = [...timesDaEtapa].sort(() => Math.random() - 0.5)
      const letras = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J']

      if (estiloGrupo !== 'MATA_MATA_PURO') {
        for (let i = 0; i < timesEmbaralhados.length; i++) {
          const letraGrupo = letras[i % qtdGrupos]
          await supabase
            .from('etapa_equipes')
            .update({ grupo: letraGrupo })
            .eq('etapa_id', Number(etapaId))
            .eq('equipe_id', timesEmbaralhados[i].id)
        }
      }

      const { data: timesData } = await supabase
        .from('etapa_equipes')
        .select('*, equipes(*)')
        .eq('etapa_id', Number(etapaId))

      const timesAtualizados = timesData?.map(t => ({ ...t.equipes, grupo: t.grupo })) || []

      const gruposObj = {}
      timesAtualizados.forEach(t => {
        const g = (t.grupo || 'A').trim().toUpperCase()
        if (!gruposObj[g]) gruposObj[g] = []
        gruposObj[g].push(t)
      })

      let insertsJogos = []

      if (estiloGrupo === 'INTRA_GRUPO' || estiloGrupo === 'TODOS_CONTRA_TODOS' || estiloGrupo === 'IDA_E_VOLTA') {
        const rodadasGlobais = {}
        let maxRodadas = 0

        for (let i = 0; i < qtdGrupos; i++) {
          const letra = letras[i]
          const times = gruposObj[letra] || []
          const rodadasGrupo = gerarConfrontosBerger(times)

          rodadasGrupo.forEach((jogosDaRodada, idx) => {
            const numRodada = idx + 1
            if (!rodadasGlobais[numRodada]) rodadasGlobais[numRodada] = []

            jogosDaRodada.forEach(jogo => {
              if (jogo.bye) {
                rodadasGlobais[numRodada].push({
                  etapa_id: Number(etapaId),
                  tipo_jogo: 'FOLGA',
                  obs_publica: `Grupo ${letra} - Rodada ${numRodada} - FOLGA`,
                  equipe_a_id: jogo.a.id,
                  equipe_b_id: null,
                  rodada: numRodada,
                  status: 'EM_BREVE'
                })
                return
              }

              rodadasGlobais[numRodada].push({
                etapa_id: Number(etapaId),
                tipo_jogo: 'GRUPO',
                obs_publica: `Grupo ${letra} - Rodada ${numRodada}`,
                equipe_a_id: jogo.a.id,
                equipe_b_id: jogo.b.id,
                rodada: numRodada,
                status: 'EM_BREVE'
              })
            })

            if (numRodada > maxRodadas) maxRodadas = numRodada
          })
        }

        for (let r = 1; r <= maxRodadas; r++) {
          if (rodadasGlobais[r]) insertsJogos.push(...rodadasGlobais[r])
        }

        if (estiloGrupo === 'IDA_E_VOLTA') {
          const idaSemFolga = insertsJogos.filter(j => j.tipo_jogo !== 'FOLGA')
          const volta = idaSemFolga.map(j => ({
            ...j,
            equipe_a_id: j.equipe_b_id,
            equipe_b_id: j.equipe_a_id,
            rodada: j.rodada + maxRodadas,
            obs_publica: (j.obs_publica || '').replace('Rodada', 'Volta')
          }))
          insertsJogos.push(...volta)
        }
      }

      if (estiloGrupo === 'CRUZAMENTO') {
        for (let k = 0; k < qtdGrupos; k += 2) {
          const g1 = gruposObj[letras[k]] || []
          const g2 = gruposObj[letras[k + 1]] || []
          const l1 = letras[k]
          const l2 = letras[k + 1]
          if (g1.length === 0 || g2.length === 0) continue

          const listaRodadas = gerarCruzamentoRotativo(g1, g2)
          listaRodadas.forEach((jogosDaRodada, idx) => {
            jogosDaRodada.forEach(jogo => {
              if (jogo.bye) {
                insertsJogos.push({
                  etapa_id: Number(etapaId),
                  tipo_jogo: 'FOLGA',
                  obs_publica: `Intergrupo ${l1}x${l2} - Rodada ${idx + 1} - FOLGA`,
                  equipe_a_id: jogo.a.id,
                  equipe_b_id: null,
                  rodada: idx + 1,
                  status: 'EM_BREVE'
                })
                return
              }

              insertsJogos.push({
                etapa_id: Number(etapaId),
                tipo_jogo: 'GRUPO',
                obs_publica: `Intergrupo ${l1}x${l2} - Rodada ${idx + 1}`,
                equipe_a_id: jogo.a.id,
                equipe_b_id: jogo.b.id,
                rodada: idx + 1,
                status: 'EM_BREVE'
              })
            })
          })
        }
      }

      if (estiloGrupo === 'MATA_MATA_PURO') {
        const todos = [...timesAtualizados]
        for (let i = 0; i < todos.length; i += 2) {
          if (todos[i] && todos[i + 1]) {
            insertsJogos.push({
              etapa_id: Number(etapaId),
              tipo_jogo: 'ELIMINATORIA',
              obs_publica: `Jogo ${Math.floor(i / 2) + 1}`,
              equipe_a_id: todos[i].id,
              equipe_b_id: todos[i + 1].id,
              rodada: 1,
              status: 'EM_BREVE'
            })
          } else if (todos[i] && !todos[i + 1]) {
            insertsJogos.push({
              etapa_id: Number(etapaId),
              tipo_jogo: 'FOLGA',
              obs_publica: `FOLGA - ${todos[i].nome_equipe}`,
              equipe_a_id: todos[i].id,
              equipe_b_id: null,
              rodada: 1,
              status: 'EM_BREVE'
            })
          }
        }
      }

      if (modelo && modelo.estrutura && estiloGrupo !== 'MATA_MATA_PURO') {
        const ultimaRodada = insertsJogos.length > 0 ? Math.max(...insertsJogos.map(j => j.rodada || 0)) : 0
        const insertsMataMata = modelo.estrutura.map((item, idx) => ({
          etapa_id: Number(etapaId),
          tipo_jogo: item.fase,
          obs_publica: item.obs,
          origem_a: item.ruleA,
          origem_b: item.ruleB,
          equipe_a_id: null,
          equipe_b_id: null,
          rodada: ultimaRodada + 10 + Math.floor(idx / 4),
          status: 'EM_BREVE'
        }))
        insertsJogos.push(...insertsMataMata)
      }

      if (insertsJogos.length > 0) {
        const { error } = await supabase.from('jogos').insert(insertsJogos)
        if (error) throw error
      }

      alert('Sucesso! Tabela gerada.')
      await selecionarEtapa(etapaId)
    } catch (e) {
      alert('Erro: ' + e.message)
    } finally {
      setLoading(false)
    }
  }

  async function criarJogoManual() {
    if (!etapaId) return alert('Selecione uma etapa!')
    if (!novoJogo.descricao) return alert('Digite a descrição (ex: Final, Semi 1)')
    setLoading(true)
    try {
      const payload = {
        etapa_id: Number(etapaId),
        tipo_jogo: 'ELIMINATORIA',
        obs_publica: String(novoJogo.descricao || '').toUpperCase(),
        equipe_a_id: novoJogo.equipe_a_id ? Number(novoJogo.equipe_a_id) : null,
        equipe_b_id: novoJogo.equipe_b_id ? Number(novoJogo.equipe_b_id) : null,
        rodada: novoJogo.rodada ? Number(novoJogo.rodada) : 99,
        status: 'EM_BREVE'
      }
      const { error } = await supabase.from('jogos').insert(payload)
      if (error) throw error
      alert('Jogo manual adicionado!')
      setNovoJogo({ descricao: '', rodada: '', equipe_a_id: '', equipe_b_id: '' })
      await selecionarEtapa(etapaId)
    } catch (e) {
      alert('Erro: ' + e.message)
    } finally {
      setLoading(false)
    }
  }

  async function irParaSorteioAoVivo() {
    if (!etapaId || !modeloSelecionado) return alert('Selecione etapa e modelo.')
    const params = new URLSearchParams({
      etapa_id: String(etapaId),
      qtd_grupos: String(qtdGrupos),
      modelo_id: String(modeloSelecionado),
      estilo: String(estiloGrupo)
    })

    setLoading(true)
    try {
      await salvarRegrasDaEtapa()
      router.push(`/admin/sorteio-novo?${params.toString()}`)
    } catch (e) {
      alert('Erro ao salvar regras da etapa: ' + (e.message || e))
    } finally {
      setLoading(false)
    }
  }

  async function confirmarImportacao() {
    if (selectedTeams.size === 0) return
    setLoading(true)
    try {
      const inserts = Array.from(selectedTeams).map(id => ({
        etapa_id: Number(etapaId),
        equipe_id: id,
        grupo: 'A'
      }))
      await supabase.from('etapa_equipes').insert(inserts)
      setShowModalTimes(false)
      await selecionarEtapa(etapaId)
    } finally {
      setLoading(false)
    }
  }

  async function limparEtapa() {
    if (!confirm('Resetar?')) return
    setLoading(true)
    try {
      await supabase.from('jogos').delete().eq('etapa_id', Number(etapaId))
      await supabase.from('etapa_equipes').delete().eq('etapa_id', Number(etapaId))
      await selecionarEtapa(etapaId)
    } finally {
      setLoading(false)
    }
  }

  async function aplicarAgendaEmMassa() {
    if (!horData) return
    setLoading(true)
    try {
      const jogosP = jogos.filter(j => j.status === 'EM_BREVE')
      let h = new Date(`${horData}T${horInicio}`)
      for (const j of jogosP) {
        await supabase.from('jogos').update({
          data_jogo: horData,
          horario: h.toTimeString().slice(0, 5)
        }).eq('id', j.id)
        h.setMinutes(h.getMinutes() + Number(horDuracao))
      }
      await selecionarEtapa(etapaId)
    } finally {
      setLoading(false)
    }
  }

  async function atualizarJogo(p) {
    const { id, action, ...d } = p

    if (action === 'set_score') {
      await supabase.from('jogos').update({
        gols_a: d.gols_a === '' ? 0 : Number(d.gols_a),
        gols_b: d.gols_b === '' ? 0 : Number(d.gols_b),
        penaltis_a: d.penaltis_a,
        penaltis_b: d.penaltis_b
      }).eq('id', id)
    }

    if (action === 'set_status') {
      const payload = { status: d.status }
      if (d.gols_a !== undefined) payload.gols_a = d.gols_a === '' ? 0 : Number(d.gols_a)
      if (d.gols_b !== undefined) payload.gols_b = d.gols_b === '' ? 0 : Number(d.gols_b)
      if (d.penaltis_a !== undefined) payload.penaltis_a = d.penaltis_a
      if (d.penaltis_b !== undefined) payload.penaltis_b = d.penaltis_b
      await supabase.from('jogos').update(payload).eq('id', id)
    }

    if (action === 'update_info') {
      await supabase.from('jogos').update({
        data_jogo: d.data_jogo,
        horario: d.horario,
        arbitro: d.arbitro
      }).eq('id', id)
    }

    if (action === 'set_teams') {
      const a = d.equipe_a_id ? Number(d.equipe_a_id) : null
      const b = d.equipe_b_id ? Number(d.equipe_b_id) : null

      await supabase.from('jogos').update({
        equipe_a_id: a,
        equipe_b_id: b
      }).eq('id', id)
    }

    await selecionarEtapa(etapaId)
  }

  if (!authed) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="bg-slate-900 p-8 rounded-2xl text-center">
          <Lock className="mx-auto text-blue-500 mb-4" />
          <h1 className="text-white font-black mb-4">GESTÃO FINAL</h1>
          <input
            type="password"
            value={pin}
            onChange={e => setPin(e.target.value)}
            className="bg-black text-white p-3 rounded mb-4 w-full text-center"
          />
          <button onClick={auth} className="bg-blue-600 w-full p-3 rounded font-bold text-white">
            ENTRAR
          </button>
        </div>
      </div>
    )
  }

  return (
    <main className="min-h-screen bg-slate-50 py-8 px-4 md:px-8 text-slate-800">
      {showModalTimes && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-2xl rounded-3xl p-6 h-[80vh] flex flex-col shadow-2xl">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-xl font-black uppercase">Importar Times</h3>
              <button onClick={() => setShowModalTimes(false)}><X /></button>
            </div>
            <div className="flex-1 overflow-y-auto grid grid-cols-2 gap-2 p-1">
              {todosTimes.map(t => {
                const sel = selectedTeams.has(t.id)
                return (
                  <div
                    key={t.id}
                    onClick={() => {
                      const s = new Set(selectedTeams)
                      sel ? s.delete(t.id) : s.add(t.id)
                      setSelectedTeams(s)
                    }}
                    className={`p-3 rounded-xl border cursor-pointer flex justify-between items-center ${sel ? 'bg-blue-50 border-blue-500' : 'bg-slate-50 border-slate-100'
                      }`}
                  >
                    <span className="font-bold text-xs">{t.nome_equipe}</span>
                    {sel && <CheckCircle size={16} className="text-blue-500" />}
                  </div>
                )
              })}
            </div>
            <button
              onClick={confirmarImportacao}
              className="mt-4 bg-slate-900 text-white py-3 rounded-xl font-bold uppercase w-full"
            >
              Confirmar Seleção ({selectedTeams.size})
            </button>
          </div>
        </div>
      )}

      <div className="max-w-7xl mx-auto">
       <div className="flex items-center justify-between gap-4 mb-8">
  <div className="flex items-center gap-4">
    <Link href="/admin" className="bg-white p-3 rounded-full shadow hover:scale-105">
      <ArrowLeft />
    </Link>

    <div>
      <h1 className="text-2xl font-black uppercase text-slate-800 flex items-center gap-2">
        <Trophy className="text-yellow-500 fill-yellow-500" /> Painel de Controle
      </h1>
      <p className="text-slate-500 text-xs font-bold">Gestão completa de campeonatos.</p>
    </div>
  </div>

  {/* ✅ NOVO: link para cadastrar árbitros/mesários */}
  <Link
    href="/admin/staff"
    className="bg-slate-900 text-white px-4 py-2 rounded-xl text-xs font-black uppercase hover:bg-black flex items-center gap-2 shadow-sm"
    title="Cadastrar árbitros e mesários"
  >
    <Shield size={14} /> Cadastro de Árbitros
  </Link>
      </div>

        <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100 mb-6 flex gap-2 overflow-x-auto">
          {etapas.map(e => (
            <button
              key={e.id}
              onClick={() => selecionarEtapa(e.id)}
              className={`px-4 py-2 rounded-lg font-bold text-xs uppercase whitespace-nowrap border transition-all ${String(etapaId) === String(e.id)
                ? 'bg-slate-900 text-white border-slate-900 shadow-lg'
                : 'bg-white border-slate-200 text-slate-400 hover:border-slate-400'
                }`}
            >
              {e.titulo}
            </button>
          ))}
        </div>

        {etapaId && (
          <div className="grid lg:grid-cols-12 gap-6 animate-in fade-in">
            <div className="lg:col-span-3 space-y-6">
              <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-sm">
                <div className="flex justify-between items-center mb-4">
                  <h2 className="text-xs font-black uppercase text-slate-400">1. Times ({timesDaEtapa.length})</h2>
                </div>
                <div className="flex flex-wrap gap-1 mb-4 max-h-[100px] overflow-y-auto custom-scrollbar">
                  {timesDaEtapa.map(t => (
                    <span key={t.id} className="bg-slate-50 border px-2 py-1 rounded text-[9px] font-bold truncate max-w-[100px]">
                      {t.nome_equipe}
                    </span>
                  ))}
                </div>
                <button
                  onClick={() => { setSelectedTeams(new Set()); setShowModalTimes(true) }}
                  className="w-full bg-blue-600 hover:bg-blue-500 text-white py-2 rounded-xl text-xs font-black uppercase flex items-center justify-center gap-2"
                >
                  <PlusCircle size={14} /> Importar Times
                </button>
              </div>

              <div className="bg-slate-900 text-white p-6 rounded-3xl shadow-xl relative overflow-hidden">
                <h2 className="text-sm font-black uppercase text-yellow-500 mb-4 flex items-center gap-2 relative z-10">
                  <Shield size={14} /> 2. Gerar Campeonato
                </h2>

                <div className="space-y-3 relative z-10">
                  <div>
                    <label className="text-[10px] font-bold text-slate-400 uppercase">Grupos</label>
                    <select
                      className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2 text-xs font-bold text-white mt-1"
                      value={qtdGrupos}
                      onChange={e => setQtdGrupos(Number(e.target.value))}
                    >
                      {[1, 2, 3, 4, 5, 6, 8, 10].map(n => <option key={n} value={n}>{n} Grupos</option>)}
                    </select>
                  </div>

                  <div>
                    <label className="text-[10px] font-bold text-slate-400 uppercase">Modo</label>
                    <select
                      className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2 text-xs font-bold text-white mt-1"
                      value={estiloGrupo}
                      onChange={e => setEstiloGrupo(e.target.value)}
                    >
                      <optgroup label="Grupos">
                        <option value="INTRA_GRUPO">Turno Único</option>
                        <option value="IDA_E_VOLTA">Ida e Volta</option>
                        <option value="CRUZAMENTO">Inter-Grupo (A×B)</option>
                      </optgroup>
                      <optgroup label="Copa">
                        <option value="MATA_MATA_PURO">Copa (Sem Grupos)</option>
                      </optgroup>
                    </select>
                  </div>

                  <div>
                    <label className="text-[10px] font-bold text-slate-400 uppercase">Mata-Mata</label>
                    <select
                      className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2 text-xs font-bold text-white mt-1"
                      value={modeloSelecionado}
                      onChange={e => setModeloSelecionado(e.target.value)}
                    >
                      <option value="">Selecione...</option>
                      {modelos.map(m => <option key={m.id} value={m.id}>{m.nome}</option>)}
                    </select>
                  </div>

                  <div className="bg-slate-800 p-2 rounded-lg border border-slate-700">
                    <p className="text-[9px] font-bold text-slate-400 uppercase mb-2 flex items-center gap-1">
                      <Settings size={10} /> Critérios de Desempate
                    </p>

                    <div className="space-y-1 max-h-[100px] overflow-y-auto custom-scrollbar">
                      {regras.map((r, idx) => (
                        <div
                          key={r}
                          className="flex justify-between items-center bg-slate-900 px-2 py-1 rounded text-[10px] border border-slate-700"
                        >
                          <span className="text-xs font-bold">{idx + 1}. {CRITERIOS_LABEL[r] || r}</span>
                          <div className="flex gap-1">
                            <button onClick={() => moverRegra(idx, 'UP')} className="hover:text-blue-400 text-slate-500">
                              <ArrowUp size={10} />
                            </button>
                            <button onClick={() => moverRegra(idx, 'DOWN')} className="hover:text-blue-400 text-slate-500">
                              <ArrowDown size={10} />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* ✅ CONFIG FIFA DA ETAPA */}
                  <div className="bg-slate-800 p-3 rounded-lg border border-slate-700">
                    <p className="text-[9px] font-bold text-slate-400 uppercase mb-2 flex items-center gap-1">
                      <Settings size={10} /> Config FIFA da Etapa
                    </p>

                    <div className="mb-3">
                      <label className="text-[10px] font-bold text-slate-400 uppercase">Tempos da Partida</label>
                      <div className="flex gap-2 mt-1">
                        <button
                          type="button"
                          onClick={() => setTemposPartida(['1T'])}
                          className={`flex-1 py-2 rounded-lg text-[10px] font-black uppercase border ${temposPartida.length === 1
                            ? 'bg-yellow-500 text-slate-900 border-yellow-500'
                            : 'bg-slate-900 text-slate-300 border-slate-700'
                            }`}
                        >
                          1 Tempo
                        </button>
                        <button
                          type="button"
                          onClick={() => setTemposPartida(['1T', '2T'])}
                          className={`flex-1 py-2 rounded-lg text-[10px] font-black uppercase border ${temposPartida.length === 2
                            ? 'bg-yellow-500 text-slate-900 border-yellow-500'
                            : 'bg-slate-900 text-slate-300 border-slate-700'
                            }`}
                        >
                          2 Tempos
                        </button>
                      </div>
                      <div className="mt-2 text-[10px] text-slate-400 font-bold">
                        Atual: {temposPartida.join(' / ')}
                      </div>
                    </div>

                    <div className="mb-3">
                      <label className="text-[10px] font-bold text-slate-400 uppercase">Empate no Mata-Mata</label>
                      <select
                        className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-xs font-bold text-white mt-1"
                        value={empateMataMata}
                        onChange={e => setEmpateMataMata(e.target.value)}
                      >
                        <option value="PENALTIS">Pênaltis</option>
                        <option value="PRORROGACAO">Prorrogação + Pênaltis</option>
                        <option value="REPLAY">Jogo de Volta / Replay</option>
                        <option value="NENHUM">Sem Desempate (manual)</option>
                      </select>

                      {empateMataMata === 'PRORROGACAO' && (
                        <div className="mt-2 grid grid-cols-2 gap-2">
                          <input
                            type="number"
                            className="bg-slate-900 border border-slate-700 rounded-lg p-2 text-xs font-bold text-white"
                            value={prorroMinutos}
                            onChange={e => setProrroMinutos(Number(e.target.value))}
                            placeholder="Min por tempo"
                          />
                          <div className="text-[10px] text-slate-400 font-bold flex items-center">
                            PR: {prorroTempos.join(' / ')}
                          </div>
                        </div>
                      )}
                    </div>

                    <div className="mb-2">
                      <label className="text-[10px] font-bold text-slate-400 uppercase">Regras de Cartões (Etapa)</label>

                      <div className="bg-slate-900 border border-slate-700 rounded-lg p-2 mt-1 space-y-2">
                        <div className="flex justify-between items-center">
                          <span className="text-[10px] font-bold text-slate-300">2 Amarelos → Suspende</span>
                          <input
                            type="number"
                            className="w-16 bg-black border border-slate-700 rounded p-1 text-xs font-black text-white text-center"
                            value={cartoesRegra.dois_amarelos.suspende_jogos}
                            onChange={e => setCartoesRegra(prev => ({
                              ...prev,
                              dois_amarelos: { ...prev.dois_amarelos, suspende_jogos: Number(e.target.value) }
                            }))}
                          />
                        </div>

                        <div className="flex justify-between items-center">
                          <span className="text-[10px] font-bold text-slate-300">Vermelho Direto</span>
                          <select
                            className="bg-black border border-slate-700 rounded p-1 text-xs font-black text-white"
                            value={cartoesRegra.vermelho_direto.punicao}
                            onChange={e => setCartoesRegra(prev => ({
                              ...prev,
                              vermelho_direto: { ...prev.vermelho_direto, punicao: e.target.value }
                            }))}
                          >
                            <option value="SUSPENDE">Suspende</option>
                            <option value="ELIMINA">Elimina da etapa</option>
                          </select>
                        </div>

                        {cartoesRegra.vermelho_direto.punicao === 'SUSPENDE' && (
                          <div className="flex justify-between items-center">
                            <span className="text-[10px] font-bold text-slate-300">Suspende (jogos)</span>
                            <input
                              type="number"
                              className="w-16 bg-black border border-slate-700 rounded p-1 text-xs font-black text-white text-center"
                              value={cartoesRegra.vermelho_direto.suspende_jogos}
                              onChange={e => setCartoesRegra(prev => ({
                                ...prev,
                                vermelho_direto: { ...prev.vermelho_direto, suspende_jogos: Number(e.target.value) }
                              }))}
                            />
                          </div>
                        )}

                        <div className="flex justify-between items-center">
                          <span className="text-[10px] font-bold text-slate-300">Limpa cartões na fase?</span>
                          <button
                            type="button"
                            onClick={() => setCartoesRegra(prev => ({ ...prev, limpa_na_fase: !prev.limpa_na_fase }))}
                            className={`px-3 py-1 rounded text-[10px] font-black uppercase ${cartoesRegra.limpa_na_fase
                              ? 'bg-yellow-500 text-slate-900'
                              : 'bg-slate-800 text-slate-300 border border-slate-700'
                              }`}
                          >
                            {cartoesRegra.limpa_na_fase ? 'SIM' : 'NÃO'}
                          </button>
                        </div>
                      </div>
                    </div>

                    <div className="mt-3">
                      <label className="text-[10px] font-bold text-slate-400 uppercase">Assinaturas na Súmula</label>
                      <div className="grid grid-cols-2 gap-2 mt-1">
                        <div className="bg-slate-900 border border-slate-700 rounded-lg p-2">
                          <div className="text-[10px] font-black text-slate-300">Árbitros</div>
                          <input
                            type="number"
                            className="w-full bg-black border border-slate-700 rounded p-2 text-xs font-black text-white text-center mt-1"
                            value={assinaturasRequired.ARBITRO}
                            onChange={e => setAssinaturasRequired(prev => ({ ...prev, ARBITRO: Number(e.target.value) }))}
                          />
                        </div>
                        <div className="bg-slate-900 border border-slate-700 rounded-lg p-2">
                          <div className="text-[10px] font-black text-slate-300">Mesários</div>
                          <input
                            type="number"
                            className="w-full bg-black border border-slate-700 rounded p-2 text-xs font-black text-white text-center mt-1"
                            value={assinaturasRequired.MESARIO}
                            onChange={e => setAssinaturasRequired(prev => ({ ...prev, MESARIO: Number(e.target.value) }))}
                          />
                        </div>
                      </div>
                    </div>

                    <button
                      type="button"
                      disabled={loading}
                      onClick={async () => {
                        try {
                          setLoading(true)
                          await salvarRegrasDaEtapa()
                          alert('✅ Regras FIFA salvas na etapa.')
                        } catch (e) {
                          alert('Erro ao salvar regras: ' + (e.message || e))
                        } finally {
                          setLoading(false)
                        }
                      }}
                      className="w-full mt-3 bg-slate-700 hover:bg-slate-600 text-white py-2 rounded-xl text-[10px] font-black uppercase"
                    >
                      Salvar Regras da Etapa
                    </button>
                  </div>

                  <button
                    onClick={gerarTudo}
                    disabled={loading}
                    className="w-full bg-yellow-500 hover:bg-yellow-400 text-slate-900 py-3 rounded-xl text-xs font-black uppercase flex items-center justify-center gap-2 transition-all active:scale-95 shadow-lg"
                  >
                    {loading ? <Loader2 className="animate-spin" /> : <Shuffle size={14} />}
                    {estiloGrupo === 'MATA_MATA_PURO' ? 'GERAR COPA' : 'GERAR TABELA'}
                  </button>

                  <button
                    onClick={irParaSorteioAoVivo}
                    className="w-full bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white py-3 rounded-xl text-xs font-black uppercase flex items-center justify-center gap-2 transition-all active:scale-95 shadow-lg mt-2"
                  >
                    <Mic size={14} /> Sorteio Ao Vivo
                  </button>
                </div>
              </div>

              <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-sm">
                <h2 className="text-xs font-black uppercase text-slate-400 mb-4">3. Agenda Rápida</h2>
                <div className="space-y-2 mb-4">
                  <input
                    type="date"
                    className="w-full bg-slate-50 border p-2 rounded-lg text-xs font-bold"
                    value={horData}
                    onChange={e => setHorData(e.target.value)}
                  />
                  <div className="flex gap-2">
                    <input
                      type="time"
                      className="w-full bg-slate-50 border p-2 rounded-lg text-xs font-bold"
                      value={horInicio}
                      onChange={e => setHorInicio(e.target.value)}
                    />
                    <input
                      type="number"
                      className="w-full bg-slate-50 border p-2 rounded-lg text-xs font-bold"
                      placeholder="Min"
                      value={horDuracao}
                      onChange={e => setHorDuracao(e.target.value)}
                    />
                  </div>
                </div>
                <button
                  onClick={aplicarAgendaEmMassa}
                  className="w-full bg-slate-100 hover:bg-slate-200 text-slate-600 py-2 rounded-xl text-xs font-black uppercase"
                >
                  Aplicar Horários
                </button>
              </div>

              <div className="bg-indigo-50 p-5 rounded-3xl border border-indigo-100 shadow-sm text-center">
                <h2 className="text-xs font-black uppercase text-indigo-400 mb-2">Avançar Fase</h2>
                <button
                  onClick={atualizarClassificados}
                  className="w-full bg-indigo-600 hover:bg-indigo-500 text-white py-3 rounded-xl text-xs font-black uppercase flex items-center justify-center gap-2 shadow-lg shadow-indigo-200"
                >
                  <Zap size={16} /> Atualizar Mata-Mata
                </button>
                <p className="text-[9px] text-indigo-400 mt-2 leading-tight">
                  Preenche automaticamente os confrontos baseados na tabela.
                </p>
              </div>

              <button
                onClick={limparEtapa}
                className="w-full border border-red-100 text-red-400 py-2 rounded-xl text-xs font-bold uppercase hover:bg-red-50"
              >
                Resetar Tudo
              </button>
            </div>

            <div className="lg:col-span-9">
              <div className="flex items-center gap-3 mb-4">
                <h2 className="font-black uppercase text-slate-800 text-xl">Tabela de Jogos</h2>
                <span className="bg-slate-200 text-slate-600 px-2 py-1 rounded text-xs font-black">{jogos.length}</span>
              </div>

              <div className="bg-slate-100 border border-slate-200 rounded-2xl p-4 mb-4 flex flex-wrap gap-2 items-center">
                <div className="px-2 py-1 bg-slate-200 rounded text-[10px] font-black uppercase text-slate-500">Backup Manual</div>
                <input
                  className="p-2 rounded-lg border text-xs font-bold w-40"
                  placeholder="Fase (ex: FINAL)"
                  value={novoJogo.descricao}
                  onChange={e => setNovoJogo({ ...novoJogo, descricao: e.target.value })}
                />
                <input
                  className="p-2 rounded-lg border text-xs font-bold w-20 text-center"
                  placeholder="Rodada"
                  type="number"
                  value={novoJogo.rodada}
                  onChange={e => setNovoJogo({ ...novoJogo, rodada: e.target.value })}
                />
                <select
                  className="p-2 rounded-lg border text-xs font-bold w-32"
                  value={novoJogo.equipe_a_id}
                  onChange={e => setNovoJogo({ ...novoJogo, equipe_a_id: e.target.value })}
                >
                  <option value="">Time A</option>
                  {timesDaEtapa.map(t => <option key={t.id} value={t.id}>{t.nome_equipe}</option>)}
                </select>
                <span className="font-black text-slate-300">vs</span>
                <select
                  className="p-2 rounded-lg border text-xs font-bold w-32"
                  value={novoJogo.equipe_b_id}
                  onChange={e => setNovoJogo({ ...novoJogo, equipe_b_id: e.target.value })}
                >
                  <option value="">Time B</option>
                  {timesDaEtapa.map(t => <option key={t.id} value={t.id}>{t.nome_equipe}</option>)}
                </select>
                <button
                  onClick={criarJogoManual}
                  className="bg-slate-800 text-white px-4 py-2 rounded-lg text-xs font-black uppercase hover:bg-black flex items-center gap-2"
                >
                  <PlusCircle size={14} /> Add
                </button>
              </div>

              {jogos.length === 0 ? (
                <div className="bg-white rounded-3xl p-20 text-center border border-dashed border-slate-300">
                  <Trophy className="mx-auto text-slate-200 mb-4" size={64} />
                  <p className="text-slate-400 font-bold text-sm">Pronto para gerar!</p>
                </div>
              ) : (
                <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-4">
                  {jogos.map(j => (
                    <GameCard
                      key={j.id}
                      jogo={j}
                      onUpdate={atualizarJogo}
                      pin={pin}
                      allTeams={timesDaEtapa}
                      stageCfg={{ tempos: temposPartida }}
                   />
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </main>
  )
}

// ✅ COLE ESTE BLOCO NO LUGAR DO SEU GameCard (substitui o placeholder)
// - Compatível com seu atualizarJogo({action: ...})
// - Súmula com 1T/2T (ou tempos configurados) + camisa auto-preenche atleta
// - Suporta FOLGA (desliga placar/súmula/pênaltis)
// - Inclui impressão simples da súmula (print do navegador)

function GameCard({ jogo, onUpdate, pin, allTeams, stageCfg }) {
  const temposCfg =
    Array.isArray(stageCfg?.tempos) && stageCfg.tempos.length ? stageCfg.tempos : ['1T', '2T']

  const isFolga =
    String(jogo.tipo_jogo || '').toUpperCase() === 'FOLGA' || (jogo.equipe_a_id && !jogo.equipe_b_id)

  const [ga, setGa] = useState(jogo.gols_a ?? '')
  const [gb, setGb] = useState(jogo.gols_b ?? '')
  const [pa, setPa] = useState(jogo.penaltis_a ?? '')
  const [pb, setPb] = useState(jogo.penaltis_b ?? '')
  const [showPenalties, setShowPenalties] = useState(
    jogo.penaltis_a !== null || jogo.penaltis_b !== null
  )

  const [isSettingTeams, setIsSettingTeams] = useState(false)
  const [manualA, setManualA] = useState(jogo.equipe_a_id || '')
  const [manualB, setManualB] = useState(jogo.equipe_b_id || '')

  const [isEditing, setIsEditing] = useState(false)
  const [editData, setEditData] = useState(jogo.data_jogo ?? '')
  const [editHora, setEditHora] = useState(jogo.horario ? String(jogo.horario).slice(0, 5) : '')
  const [editJuiz, setEditJuiz] = useState(jogo.arbitro ?? '')

  const [openSumula, setOpenSumula] = useState(false)
  const [sumulaLoading, setSumulaLoading] = useState(false)
  const [eventos, setEventos] = useState([])
  const [atletasA, setAtletasA] = useState([])
  const [atletasB, setAtletasB] = useState([])

  const [novoEvento, setNovoEvento] = useState({
    tipo: 'GOL',
    tempo: temposCfg?.[0] || '1T',
    equipe: 'A',
    atleta_id: '',
    minuto: '',
    camisa_no_jogo: '',
    observacao: ''
  })

  const nomeA = jogo.equipeA?.nome_equipe || (jogo.origem_a ? `( ${jogo.origem_a} )` : 'Aguardando...')
  const nomeB = isFolga
    ? 'FOLGA'
    : (jogo.equipeB?.nome_equipe || (jogo.origem_b ? `( ${jogo.origem_b} )` : 'Aguardando...'))

  const save = (novosGolsA, novosGolsB) => {
    if (isFolga) return
    const placarA = novosGolsA !== undefined ? novosGolsA : ga
    const placarB = novosGolsB !== undefined ? novosGolsB : gb
    onUpdate({
      action: 'set_score',
      id: jogo.id,
      gols_a: placarA,
      gols_b: placarB,
      penaltis_a: showPenalties && pa !== '' ? pa : null,
      penaltis_b: showPenalties && pb !== '' ? pb : null
    })
  }

  const saveInfo = () => {
    onUpdate({ action: 'update_info', id: jogo.id, data_jogo: editData, horario: editHora, arbitro: editJuiz })
    setIsEditing(false)
  }

  const saveTeams = () => {
    if (manualA && manualB && String(manualA) === String(manualB)) {
      alert('Time A e Time B não podem ser o mesmo.')
      return
    }
    onUpdate({ action: 'set_teams', id: jogo.id, equipe_a_id: manualA, equipe_b_id: manualB })
    setIsSettingTeams(false)
  }

  function atletaLabelById(atleta_id, camisa_no_jogo) {
    if (!atleta_id) return camisa_no_jogo ? `#${camisa_no_jogo} Jogador` : 'Jogador'
    const a = [...(atletasA || []), ...(atletasB || [])].find(x => String(x.id) === String(atleta_id))
    const camisa = camisa_no_jogo ?? a?.numero_camisa ?? a?.numero ?? ''
    return `${camisa ? `#${camisa} ` : ''}${a?.nome || 'Jogador'}`
  }

  function autoAtletaPorCamisa(camisa, lista) {
    const c = String(camisa || '').trim()
    if (!c) return ''
    const a = (lista || []).find(x => String(x.numero_camisa ?? x.numero ?? '').trim() === c)
    return a ? String(a.id) : ''
  }

  const handleSelectAtleta = (e, listaAtletas) => {
    const selectedId = e.target.value
    const atleta = listaAtletas.find(a => String(a.id) === String(selectedId))
    const camisaAuto = atleta?.numero_camisa ?? atleta?.numero
    setNovoEvento(prev => ({
      ...prev,
      atleta_id: selectedId,
      camisa_no_jogo: camisaAuto ? String(camisaAuto) : prev.camisa_no_jogo
    }))
  }

  const handleCamisaChange = (val) => {
    const camisa = String(val || '').trim()
    const lista = novoEvento.equipe === 'A' ? atletasA : atletasB
    const idAuto = autoAtletaPorCamisa(camisa, lista)
    setNovoEvento(prev => ({
      ...prev,
      camisa_no_jogo: camisa,
      atleta_id: idAuto || prev.atleta_id
    }))
  }

  async function loadSumula() {
    if (!pin) return
    if (isFolga) return
    if (!jogo.equipe_a_id || !jogo.equipe_b_id) return

    setSumulaLoading(true)
    try {
      const headers = { 'x-admin-pin': pin }

      const [evRes, aRes, bRes] = await Promise.all([
        fetch(`/api/admin/jogos/eventos?jogo_id=${jogo.id}`, { headers }),
        fetch(`/api/admin/atletas?equipe_id=${jogo.equipe_a_id}`, { headers }),
        fetch(`/api/admin/atletas?equipe_id=${jogo.equipe_b_id}`, { headers })
      ])

      const evJson = await safeJson(evRes)
      const aJson = await safeJson(aRes)
      const bJson = await safeJson(bRes)

      if (!evRes.ok) throw new Error(evJson?.error || 'Erro ao carregar eventos')
      if (!aRes.ok) throw new Error(aJson?.error || 'Erro ao carregar atletas A')
      if (!bRes.ok) throw new Error(bJson?.error || 'Erro ao carregar atletas B')

      setEventos(Array.isArray(evJson) ? evJson : [])
      setAtletasA(Array.isArray(aJson) ? aJson : [])
      setAtletasB(Array.isArray(bJson) ? bJson : [])
    } finally {
      setSumulaLoading(false)
    }
  }

  async function toggleSumula() {
    if (isFolga) return
    try {
      if (!openSumula) await loadSumula()
      setOpenSumula(!openSumula)
    } catch (e) {
      alert(e.message || 'Erro ao abrir súmula')
    }
  }

  async function addEvento() {
    if (isFolga) return
    if (!novoEvento.equipe) return

    const equipe_id = novoEvento.equipe === 'A' ? jogo.equipe_a_id : jogo.equipe_b_id
    const atleta_id = novoEvento.atleta_id ? Number(novoEvento.atleta_id) : null

    const res = await fetch('/api/admin/jogos/eventos', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-admin-pin': pin },
      body: JSON.stringify({
        jogo_id: jogo.id,
        equipe_id,
        atleta_id,
        tipo: novoEvento.tipo,
        tempo: novoEvento.tempo, // ✅ 1T/2T/PR...
        minuto: novoEvento.minuto,
        camisa_no_jogo: novoEvento.camisa_no_jogo,
        observacao: novoEvento.observacao
      })
    })

    const j = await safeJson(res)
    if (!res.ok) return alert(j?.error || 'Erro ao salvar evento')

    // auto placar por gol
    if (String(novoEvento.tipo).toUpperCase() === 'GOL') {
      if (novoEvento.equipe === 'A') {
        const novoGa = Number(ga || 0) + 1
        setGa(novoGa)
        save(novoGa, gb)
      } else {
        const novoGb = Number(gb || 0) + 1
        setGb(novoGb)
        save(ga, novoGb)
      }
    }

    await loadSumula()
    setNovoEvento(prev => ({ ...prev, atleta_id: '', minuto: '', camisa_no_jogo: '', observacao: '' }))
  }

  async function delEvento(id, tipo, equipe_id) {
    if (isFolga) return
    if (!confirm('Excluir evento?')) return

    const res = await fetch(`/api/admin/jogos/eventos?id=${id}`, {
      method: 'DELETE',
      headers: { 'x-admin-pin': pin }
    })

    const j = await safeJson(res)
    if (!res.ok) return alert(j?.error || 'Erro ao excluir')

    if (String(tipo).toUpperCase() === 'GOL') {
      if (Number(equipe_id) === Number(jogo.equipe_a_id)) {
        const novoGa = Math.max(0, Number(ga || 0) - 1)
        setGa(novoGa)
        save(novoGa, gb)
      } else {
        const novoGb = Math.max(0, Number(gb || 0) - 1)
        setGb(novoGb)
        save(ga, novoGb)
      }
    }

    await loadSumula()
  }

  function imprimirSumula() {
    const win = window.open('', '_blank')
    if (!win) return alert('Bloqueado pelo navegador. Permita popups para imprimir.')

    const evs = (eventos || []).map(ev => {
      const team = Number(ev.equipe_id) === Number(jogo.equipe_a_id) ? nomeA : nomeB
      const t = ev.tempo ? String(ev.tempo) : ''
      const m = ev.minuto ? `${ev.minuto}'` : ''
      const camisa = ev.camisa_no_jogo || ''
      const atleta = atletaLabelById(ev.atleta_id, ev.camisa_no_jogo)
      const obs = ev.observacao ? String(ev.observacao) : ''
      return `<tr>
        <td>${t}</td>
        <td>${m}</td>
        <td>${team}</td>
        <td>${ev.tipo}</td>
        <td>${camisa ? `#${camisa}` : ''}</td>
        <td>${atleta}</td>
        <td>${obs}</td>
      </tr>`
    }).join('')

    win.document.write(`
      <html>
      <head>
        <title>Súmula - Jogo ${jogo.id}</title>
        <style>
          body { font-family: Arial, sans-serif; padding: 20px; }
          h1,h2 { margin: 0 0 8px 0; }
          .meta { margin: 6px 0 14px 0; color: #444; font-size: 12px; }
          table { width: 100%; border-collapse: collapse; margin-top: 10px; }
          th, td { border: 1px solid #ddd; padding: 8px; font-size: 12px; }
          th { background: #f5f5f5; text-align: left; }
          .placar { font-size: 18px; font-weight: bold; margin-top: 6px; }
        </style>
      </head>
      <body>
        <h1>SÚMULA</h1>
        <div class="meta">Jogo ID: ${jogo.id} • Etapa: ${jogo.etapa_id} • ${jogo.data_jogo || ''} ${jogo.horario || ''}</div>
        <h2>${nomeA} x ${nomeB}</h2>
        <div class="placar">${ga || 0} - ${gb || 0}</div>
        <div class="meta">Árbitro: ${jogo.arbitro || ''}</div>

        <table>
          <thead>
            <tr>
              <th>Tempo</th>
              <th>Min</th>
              <th>Equipe</th>
              <th>Tipo</th>
              <th>Camisa</th>
              <th>Atleta</th>
              <th>Obs</th>
            </tr>
          </thead>
          <tbody>
            ${evs || '<tr><td colspan="7">Sem eventos</td></tr>'}
          </tbody>
        </table>

        <script>
          window.onload = function() { window.print(); }
        </script>
      </body>
      </html>
    `)
    win.document.close()
  }

  return (
    <div className={`bg-white border rounded-2xl p-4 shadow-sm relative transition-all ${
      isFolga
        ? 'border-amber-300 ring-1 ring-amber-100'
        : (jogo.status === 'EM_ANDAMENTO' ? 'border-green-400 ring-1 ring-green-100' : 'border-slate-200')
    }`}>
      <div className="flex justify-between items-center mb-3">
        <div className="flex gap-2 items-center">
          <span className={`text-[10px] font-black uppercase px-2 py-1 rounded ${
            isFolga ? 'text-amber-700 bg-amber-100' : 'text-slate-500 bg-slate-100'
          }`}>
            {isFolga ? (jogo.obs_publica || 'FOLGA') : (jogo.obs_publica || jogo.tipo_jogo)}
          </span>

          <span className={jogo.status === 'EM_ANDAMENTO'
            ? 'text-green-600 animate-pulse text-[10px] font-bold'
            : 'text-slate-400 text-[10px] font-bold'
          }>
            {String(jogo.status || '').replaceAll('_', ' ')}
          </span>
        </div>

        <div className="flex gap-1">
          <button
            onClick={() => setIsSettingTeams(!isSettingTeams)}
            className={`${isSettingTeams ? 'text-blue-600' : 'text-slate-300'} hover:text-blue-500`}
            title="Editar Times"
          >
            <Settings size={12} />
          </button>

          {isEditing ? (
            <div className="flex items-center gap-1 bg-white p-1 rounded-lg border border-blue-200 shadow-lg absolute right-2 top-2 z-20">
              <input
                className="border rounded p-1 text-[10px] w-16"
                type="text"
                placeholder="Juiz"
                value={editJuiz}
                onChange={e => setEditJuiz(e.target.value)}
              />
              <input
                className="border rounded p-1 text-[10px] w-20"
                type="date"
                value={editData}
                onChange={e => setEditData(e.target.value)}
              />
              <input
                className="border rounded p-1 text-[10px] w-14"
                type="time"
                value={editHora}
                onChange={e => setEditHora(e.target.value)}
              />
              <button onClick={saveInfo} className="bg-blue-600 text-white p-1 rounded hover:bg-blue-700">
                <CheckCircle size={12} />
              </button>
            </div>
          ) : (
            <button
              onClick={() => setIsEditing(true)}
              className="text-slate-300 hover:text-blue-500 transition-colors"
              title="Editar data/hora/juiz"
            >
              <Edit3 size={12} />
            </button>
          )}
        </div>
      </div>

      <div className="space-y-2 mb-4">
        {isSettingTeams ? (
          <div className="bg-slate-50 p-2 rounded-lg border border-blue-200 mb-2">
            <select className="w-full text-xs p-1 mb-1 border rounded" value={manualA} onChange={e => setManualA(e.target.value)}>
              <option value="">Time A...</option>
              {allTeams?.map(t => <option key={t.id} value={t.id}>{t.nome_equipe}</option>)}
            </select>
            <select className="w-full text-xs p-1 mb-1 border rounded" value={manualB} onChange={e => setManualB(e.target.value)}>
              <option value="">Time B... (vazio = FOLGA)</option>
              {allTeams?.map(t => <option key={t.id} value={t.id}>{t.nome_equipe}</option>)}
            </select>
            <button onClick={saveTeams} className="w-full bg-blue-600 text-white text-[10px] py-1 rounded font-bold uppercase">
              Salvar Times
            </button>
          </div>
        ) : (
          <>
            {/* Time A */}
            <div className="flex justify-between items-center">
              <div className="flex items-center gap-2 truncate">
                <div className="w-5 h-5 flex items-center justify-center bg-slate-50 rounded-full border border-slate-100 overflow-hidden">
                  {jogo.equipeA?.escudo_url
                    ? <img src={jogo.equipeA.escudo_url} className="w-full h-full object-contain" />
                    : <Shield size={10} className="text-slate-300" />
                  }
                </div>
                <span className="font-bold text-sm text-slate-800 truncate">{nomeA}</span>
              </div>

              {!isFolga && (
                <div className="flex gap-1">
                  <input
                    className="w-10 p-1 text-center bg-slate-50 rounded border font-bold"
                    value={ga}
                    onChange={e => setGa(e.target.value)}
                  />
                  {showPenalties && (
                    <input
                      className="w-8 p-1 text-center bg-yellow-50 rounded border border-yellow-300 font-bold text-xs"
                      placeholder="PK"
                      value={pa}
                      onChange={e => setPa(e.target.value)}
                    />
                  )}
                </div>
              )}
            </div>

            {/* Time B / FOLGA */}
            <div className="flex justify-between items-center">
              <div className="flex items-center gap-2 truncate">
                <div className="w-5 h-5 flex items-center justify-center bg-slate-50 rounded-full border border-slate-100 overflow-hidden">
                  {!isFolga && jogo.equipeB?.escudo_url
                    ? <img src={jogo.equipeB.escudo_url} className="w-full h-full object-contain" />
                    : <Shield size={10} className="text-slate-300" />
                  }
                </div>
                <span className={`font-bold text-sm truncate ${isFolga ? 'text-amber-700' : 'text-slate-800'}`}>
                  {nomeB}
                </span>
              </div>

              {!isFolga && (
                <div className="flex gap-1">
                  <input
                    className="w-10 p-1 text-center bg-slate-50 rounded border font-bold"
                    value={gb}
                    onChange={e => setGb(e.target.value)}
                  />
                  {showPenalties && (
                    <input
                      className="w-8 p-1 text-center bg-yellow-50 rounded border border-yellow-300 font-bold text-xs"
                      placeholder="PK"
                      value={pb}
                      onChange={e => setPb(e.target.value)}
                    />
                  )}
                </div>
              )}
            </div>

            {isFolga && (
              <div className="mt-2 text-[10px] font-bold text-amber-700 bg-amber-50 border border-amber-200 rounded-lg p-2">
                ✅ Este card é uma <span className="font-black">FOLGA</span> (rodada ímpar / time sem adversário).
              </div>
            )}
          </>
        )}
      </div>

      <div className="pt-3 border-t border-slate-100 flex justify-between items-center">
        <div className="text-[10px] text-slate-400 flex flex-col">
          <span className="font-bold flex items-center gap-1">
            <Calendar size={10} />
            {jogo.data_jogo ? String(jogo.data_jogo).split('-').reverse().slice(0, 2).join('/') : '--/--'}
          </span>
          <span className="flex items-center gap-1">
            <Clock size={10} />
            {jogo.horario ? String(jogo.horario).slice(0, 5) : '--:--'} {jogo.arbitro && `• ${jogo.arbitro}`}
          </span>
        </div>

        <div className="flex gap-2">
          {!isFolga && (
            <button
              onClick={() => setShowPenalties(!showPenalties)}
              className={`p-1.5 rounded transition-colors ${
                showPenalties ? 'bg-yellow-100 text-yellow-700' : 'bg-slate-100 text-slate-600 hover:text-yellow-600'
              }`}
              title="Pênaltis"
            >
              <Target size={14} />
            </button>
          )}

          {!isFolga && (
            <button
              onClick={toggleSumula}
              className={`p-1.5 rounded transition-colors ${
                openSumula ? 'bg-blue-100 text-blue-600' : 'bg-slate-100 text-slate-600 hover:text-blue-600'
              }`}
              title="Súmula"
            >
              <ClipboardList size={14} />
            </button>
          )}
        </div>
      </div>

      {/* ✅ CONTROLES DO JOGO */}
      {!isFolga && (
        <div className="mt-3 flex gap-2">
          {jogo.status === 'EM_BREVE' && (
            <button
              onClick={() => onUpdate({ action: 'set_status', id: jogo.id, status: 'EM_ANDAMENTO' })}
              className="flex-1 bg-green-600 text-white py-2 rounded-xl text-[10px] font-black uppercase hover:bg-green-500"
            >
              INICIAR
            </button>
          )}

          {jogo.status === 'EM_ANDAMENTO' && (
            <>
              <button
                onClick={() => onUpdate({
                  action: 'set_score',
                  id: jogo.id,
                  gols_a: ga,
                  gols_b: gb,
                  penaltis_a: showPenalties ? (pa === '' ? null : pa) : null,
                  penaltis_b: showPenalties ? (pb === '' ? null : pb) : null
                })}
                className="flex-1 bg-slate-100 text-slate-700 py-2 rounded-xl text-[10px] font-black uppercase hover:bg-slate-200 flex items-center justify-center gap-2"
                title="Salvar"
              >
                <Save size={14} /> SALVAR
              </button>

              <button
                onClick={() => onUpdate({
                  action: 'set_status',
                  id: jogo.id,
                  status: 'FINALIZADO',
                  gols_a: ga,
                  gols_b: gb,
                  penaltis_a: showPenalties ? (pa === '' ? null : pa) : null,
                  penaltis_b: showPenalties ? (pb === '' ? null : pb) : null
                })}
                className="flex-1 bg-slate-900 text-white py-2 rounded-xl text-[10px] font-black uppercase hover:bg-black"
              >
                ENCERRAR
              </button>
            </>
          )}

          {jogo.status === 'FINALIZADO' && (
            <button
              onClick={() => onUpdate({ action: 'set_status', id: jogo.id, status: 'EM_ANDAMENTO' })}
              className="flex-1 bg-blue-50 border border-blue-100 text-blue-700 py-2 rounded-xl text-[10px] font-black uppercase hover:bg-blue-100"
            >
              REABRIR
            </button>
          )}
        </div>
      )}

      {/* ✅ SÚMULA */}
      {!isFolga && openSumula && (
        <div className="mt-4 pt-4 border-t border-dashed border-slate-200 animate-in fade-in slide-in-from-top-2">
          <div className="flex items-center justify-between mb-2">
            <div className="text-[10px] font-black uppercase text-slate-400">
              Súmula • Tempos: {temposCfg.join(' / ')}
            </div>
            <div className="flex gap-2">
              <button
                onClick={imprimirSumula}
                className="px-3 py-1 rounded-lg text-[10px] font-black uppercase bg-white border border-slate-200 hover:border-slate-400"
                title="Imprimir Súmula"
              >
                IMPRIMIR
              </button>
            </div>
          </div>

          {sumulaLoading && (
            <div className="mb-3 text-slate-500 text-xs font-bold flex items-center gap-2">
              <Loader2 className="animate-spin" size={14} /> Carregando súmula...
            </div>
          )}

          <div className="bg-slate-50 p-3 rounded-xl border border-slate-100 mb-3">
            <div className="grid grid-cols-2 gap-2 mb-2">
              <select
                className="p-1.5 rounded border text-[10px] font-bold"
                value={novoEvento.tipo}
                onChange={e => setNovoEvento(prev => ({ ...prev, tipo: e.target.value }))}
              >
                <option value="GOL">⚽ GOL</option>
                <option value="AMARELO">🟨 AMARELO</option>
                <option value="VERMELHO">🟥 VERMELHO</option>
              </select>

              <select
                className="p-1.5 rounded border text-[10px] font-bold"
                value={novoEvento.equipe}
                onChange={e => {
                  const equipe = e.target.value
                  setNovoEvento(prev => ({
                    ...prev,
                    equipe,
                    atleta_id: '',
                    camisa_no_jogo: ''
                  }))
                }}
              >
                <option value="A">{nomeA.substring(0, 16)}</option>
                <option value="B">{nomeB.substring(0, 16)}</option>
              </select>
            </div>

            {/* ✅ 1T / 2T / PR */}
            <div className="grid grid-cols-2 gap-2 mb-2">
              <select
                className="p-1.5 rounded border text-[10px] font-bold"
                value={novoEvento.tempo}
                onChange={e => setNovoEvento(prev => ({ ...prev, tempo: e.target.value }))}
              >
                {temposCfg.map(t => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>

              <input
                className="p-1.5 rounded border text-[10px] font-bold"
                placeholder="Min (ex: 12)"
                value={novoEvento.minuto}
                onChange={e => setNovoEvento(prev => ({ ...prev, minuto: e.target.value }))}
              />
            </div>

            {/* ✅ Camisa + atleta (auto) */}
            <div className="grid grid-cols-2 gap-2 mb-2">
              <input
                className="p-1.5 rounded border text-[10px] font-bold"
                placeholder="Camisa no jogo (ex: 5)"
                value={novoEvento.camisa_no_jogo}
                onChange={e => handleCamisaChange(e.target.value)}
              />

              <select
                className="p-1.5 rounded border text-[10px] font-bold"
                value={novoEvento.atleta_id}
                onChange={(e) =>
                  handleSelectAtleta(e, novoEvento.equipe === 'A' ? atletasA : atletasB)
                }
              >
                <option value="">Selecione Atleta...</option>
                {(novoEvento.equipe === 'A' ? atletasA : atletasB).map(a => (
                  <option key={a.id} value={a.id}>
                    {(a.numero_camisa ?? a.numero) ? `#${a.numero_camisa ?? a.numero} - ` : ''}{a.nome}
                  </option>
                ))}
              </select>
            </div>

            <input
              className="w-full p-1.5 rounded border text-[10px] font-bold mb-2"
              placeholder="Obs (Ex: Falta / Goleiro adiantou / etc)"
              value={novoEvento.observacao}
              onChange={e => setNovoEvento(prev => ({ ...prev, observacao: e.target.value }))}
            />

            <button
              onClick={addEvento}
              disabled={sumulaLoading}
              className="w-full bg-slate-900 text-white py-1.5 rounded text-[10px] font-bold uppercase hover:bg-black disabled:opacity-60"
            >
              Adicionar Evento
            </button>
          </div>

          <div className="space-y-1 max-h-[170px] overflow-y-auto custom-scrollbar">
            {eventos.map(ev => {
              const teamName = Number(ev.equipe_id) === Number(jogo.equipe_a_id) ? nomeA : nomeB
              const tempoTxt = ev.tempo ? String(ev.tempo) : ''
              const minutoTxt = ev.minuto ? `${ev.minuto}'` : ''
              const atletaTxt = atletaLabelById(ev.atleta_id, ev.camisa_no_jogo)

              return (
                <div
                  key={ev.id}
                  className="flex justify-between items-center bg-white p-2 rounded border border-slate-100 text-[9px] font-bold text-slate-600"
                >
                  <span className="flex items-center gap-1 flex-wrap">
                    <span className={`px-1 rounded ${
                      ev.tipo === 'GOL'
                        ? 'bg-green-100 text-green-700'
                        : ev.tipo === 'VERMELHO'
                          ? 'bg-red-100 text-red-700'
                          : 'bg-yellow-100 text-yellow-700'
                    }`}>
                      {ev.tipo}
                    </span>

                    {tempoTxt && <span className="text-slate-500">{tempoTxt}</span>}
                    {minutoTxt && <span>{minutoTxt}</span>}

                    <span className="text-slate-400">•</span>
                    <span className="text-slate-700">{teamName}</span>

                    <span className="text-slate-400">•</span>
                    <span className="text-slate-900">{atletaTxt}</span>

                    {ev.observacao && (
                      <>
                        <span className="text-slate-400">•</span>
                        <span className="text-slate-500">{String(ev.observacao)}</span>
                      </>
                    )}
                  </span>

                  <button
                    onClick={() => delEvento(ev.id, ev.tipo, ev.equipe_id)}
                    className="text-red-300 hover:text-red-500"
                    title="Excluir evento"
                  >
                    <Trash2 size={10} />
                  </button>
                </div>
              )
            })}
            {eventos.length === 0 && (
              <p className="text-center text-[9px] text-slate-300">Nenhum evento.</p>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

// ✅ helper robusto para não quebrar quando a API retornar HTML (Unexpected token '<')
async function safeJson(res) {
  const text = await res.text()
  try {
    return JSON.parse(text)
  } catch {
    // devolve só um pedaço para debug sem explodir a UI
    return { error: (text || '').slice(0, 160) }
  }
}
