'use client'
import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import {
  Settings, LayoutDashboard, Users, Trash2, CheckCircle, Phone,
  Image as ImageIcon, AlignLeft, LogOut, ClipboardList, Loader2,
  AlertCircle, Save, Trophy, Type, Calendar, MapPin, DollarSign, FileText,
  FileCheck, XCircle, Video, MessageSquare, PlusCircle, Swords
} from 'lucide-react'

// --- FUNÇÕES AUXILIARES ---
function onlyDigits(v) { return (v || '').toString().replace(/\D/g, '') }
function isValidBRPhone(raw) { const d = onlyDigits(raw); return d.length >= 10 && d.length <= 13 }
function waLink(rawPhone) {
  const d = onlyDigits(rawPhone)
  if (!d) return null
  if (d.startsWith('55') && d.length >= 12) return `https://wa.me/${d}`
  return `https://wa.me/55${d}`
}
function formatPhoneDisplay(raw) {
  const d = onlyDigits(raw)
  if (d.length === 11) return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`
  if (d.length >= 12 && d.startsWith('55')) return `(+55) ${d.slice(2, 4)} ${d.slice(4, 9)}-${d.slice(9)}`
  return raw
}

export default function AdminPanel() {
  const [autenticado, setAutenticado] = useState(false)
  const [senha, setSenha] = useState('')
  const [abaAtiva, setAbaAtiva] = useState('dashboard')
  const [loading, setLoading] = useState(false)
  const [equipes, setEquipes] = useState([])

  const defaultConfig = useMemo(() => ({
    id: 1,
    nome_competicao: '', nome_empresa: '', logo_url: '', whatsapp: '',
    texto_topo: '', titulo_destaque: '', subtitulo: '',
    imagem_fundo: '', titulo_card_hero: '', texto_card_hero: '',
    data_limite: '', valor_premio: '',

    // ✅ NOVO: textos do HERO (layout novo)
    hero_headline: '',
    hero_tagline: '',
    hero_badge: '',

    slogan: '', texto_empresa: '', missao: '', valores: '',
    status_futsal: 'EM_BREVE', titulo_futsal: '', desc_futsal: '',
    local_futsal: '', inicio_futsal: '', vagas_futsal: 0,
    preco_futsal: 0.00,
    status_society: 'EM_BREVE', titulo_society: '', desc_society: '',
    local_society: '', inicio_society: '', vagas_society: 0,
    preco_society: 0.00,
    texto_footer: '',
  }), [])

  const [config, setConfig] = useState(defaultConfig)

  const [listaPatrocinios, setListaPatrocinios] = useState([])
  const [novoPatro, setNovoPatro] = useState({
    nome_empresa: '', banner_url: '', video_url: '', link_destino: '', cota: 'CARROSSEL'
  })

  useEffect(() => { if (autenticado) carregarTudo() }, [autenticado])

  async function carregarTudo() {
    setLoading(true)
    try {
      const [cfgRes, teamsRes, patroRes] = await Promise.all([
        fetch('/api/config', { cache: 'no-store' }),
        fetch('/api/admin/teams', { headers: { 'x-admin-pin': senha }, cache: 'no-store' }),
        fetch('/api/admin/patrocinios', { cache: 'no-store' })
      ])

      const cfg = await cfgRes.json().catch(() => null)
      const teams = await teamsRes.json().catch(() => [])
      const patroData = await patroRes.json().catch(() => [])

      if (cfg) {
        setConfig({
          ...defaultConfig,
          ...cfg,

          // ✅ garante string (evita null quebrar input controlado)
          hero_headline: cfg.hero_headline || '',
          hero_tagline: cfg.hero_tagline || '',
          hero_badge: cfg.hero_badge || '',

          vagas_futsal: Number(cfg.vagas_futsal || 0),
          vagas_society: Number(cfg.vagas_society || 0),
          preco_futsal: Number(cfg.preco_futsal || 0.00),
          preco_society: Number(cfg.preco_society || 0.00),
        })
      }

      setListaPatrocinios(Array.isArray(patroData) ? patroData : [])
      setEquipes(Array.isArray(teams) ? teams : [])
    } catch (e) {
      alert('Erro de conexão.')
    } finally {
      setLoading(false)
    }
  }

  function logar() { if (senha === '2026') setAutenticado(true); else alert('Senha Incorreta.') }
  function sair() { setAutenticado(false); setSenha(''); setAbaAtiva('dashboard'); setEquipes([]); setConfig(defaultConfig); }

async function salvarConfig() {
  setLoading(true)
  try {
    const res = await fetch('/api/config', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', 'x-admin-pin': senha },
      body: JSON.stringify(config),
    })

    const payload = await res.json().catch(() => ({}))
    if (!res.ok) {
      alert(payload?.error || 'Erro ao salvar configurações.')
      return
    }

    alert('Tudo salvo! O site já foi atualizado.')
    await carregarTudo()
  } finally {
    setLoading(false)
  }
}

  async function adicionarPatrocinio() {
    if (!novoPatro.nome_empresa || !novoPatro.banner_url) return alert("Preencha Nome e Banner!")
    setLoading(true)
    try {
      const res = await fetch('/api/admin/patrocinios', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-admin-pin': senha },
        body: JSON.stringify(novoPatro)
      })
      if (res.ok) {
        setNovoPatro({ nome_empresa: '', banner_url: '', video_url: '', link_destino: '', cota: 'CARROSSEL' })
        await carregarTudo()
      } else {
        alert("Erro ao salvar patrocinador.")
      }
    } catch (e) {
      alert("Erro de conexão.")
    } finally {
      setLoading(false)
    }
  }

  async function excluirPatrocinio(id) {
    if (!confirm("Deseja remover este patrocinador?")) return
    try {
      await fetch('/api/admin/patrocinios', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json', 'x-admin-pin': senha },
        body: JSON.stringify({ id })
      })
      await carregarTudo()
    } catch (e) {
      alert("Erro ao excluir.")
    }
  }

  async function gerenciarEquipe(id, action) {
    let msg = 'Tem certeza?'
    if (action === 'delete') msg = 'Isso excluirá a equipe e atletas. Continuar?'
    if (action === 'reject_doc') msg = 'Isso apagará o documento e notificará como Pendente. Confirmar?'

    if (!confirm(msg)) return
    try {
      const res = await fetch('/api/admin/teams', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'x-admin-pin': senha },
        body: JSON.stringify({ id, action }),
      })
      if (!res.ok) throw new Error()
      await carregarTudo()
    } catch (e) {
      alert('Falha ao executar ação.')
    }
  }

  if (!autenticado) {
    return (
      <main className="min-h-screen bg-slate-950 flex items-center justify-center p-6">
        <div className="bg-slate-900 p-10 rounded-2xl border border-slate-800 text-center max-w-sm w-full shadow-2xl">
          <div className="w-16 h-16 bg-blue-600 rounded-full flex items-center justify-center mx-auto mb-6 shadow-[0_0_20px_rgba(37,99,235,0.5)]">
            <LayoutDashboard className="text-white" size={32} />
          </div>
          <h1 className="text-2xl font-black text-white uppercase mb-6 tracking-widest">Super Admin</h1>
          <input
            type="password"
            placeholder="PIN DE ACESSO"
            className="w-full p-4 bg-slate-950 border border-slate-800 rounded-xl text-center text-white font-bold text-xl mb-6 tracking-[0.5em] outline-none focus:border-blue-600 transition-colors"
            value={senha}
            onChange={(e) => setSenha(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && logar()}
          />
          <button onClick={logar} className="w-full bg-blue-600 text-white font-bold py-4 rounded-xl uppercase hover:bg-blue-500 transition-all hover:scale-[1.02]">
            Acessar Sistema
          </button>
        </div>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-slate-50 flex flex-col md:flex-row font-sans text-slate-800">

      <aside className="bg-slate-900 text-white w-full md:w-72 flex-shrink-0 p-6 flex flex-col justify-between h-screen sticky top-0 overflow-y-auto border-r border-slate-800 shadow-2xl z-20">
        <div>
          <div className="flex items-center gap-3 mb-10 text-blue-500 pl-2">
            <LayoutDashboard size={32} />
            <div>
              <span className="font-black uppercase text-xl tracking-tighter block leading-none text-white">Master<span className="text-blue-500">Panel</span></span>
              <span className="text-slate-500 text-[10px] font-bold tracking-widest uppercase">Gestão Esportiva</span>
            </div>
          </div>

          <nav className="space-y-2">
            <button
              onClick={() => setAbaAtiva('dashboard')}
              className={`w-full text-left p-4 rounded-xl font-bold uppercase text-xs tracking-wider flex items-center gap-3 transition-all ${abaAtiva === 'dashboard'
                ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/50'
                : 'text-slate-400 hover:bg-slate-800 hover:text-white'
                }`}
            >
              <Users size={18} /> Auditoria / Equipes
            </button>

            <button
              onClick={() => setAbaAtiva('config')}
              className={`w-full text-left p-4 rounded-xl font-bold uppercase text-xs tracking-wider flex items-center gap-3 transition-all ${abaAtiva === 'config'
                ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/50'
                : 'text-slate-400 hover:bg-slate-800 hover:text-white'
                }`}
            >
              <Settings size={18} /> Editor Completo
            </button>

            <div className="pt-4 pb-2 text-[10px] font-black uppercase text-slate-600 tracking-widest pl-2">Campeonato</div>

            {/* ✅ NOVA: Página de Etapas/Jogos (criar etapa, gerar tabela, etc) */}
            <Link
              href="/admin/jogos"
              className="w-full text-left p-4 rounded-xl font-bold uppercase text-xs tracking-wider flex items-center gap-3 transition-all text-slate-400 hover:bg-slate-800 hover:text-white"
            >
              <PlusCircle size={18} /> Etapas & Geração
            </Link>

            {/* ✅ Gestão completa (cards, editar, súmula, etc) */}
            <Link
              href="/admin/jogos-novo"
              className="w-full text-left p-4 rounded-xl font-bold uppercase text-xs tracking-wider flex items-center gap-3 transition-all text-slate-400 hover:bg-slate-800 hover:text-white"
            >
              <ClipboardList size={18} /> Jogos (Gestão)
            </Link>

            {/* ✅ Ao vivo (somente EM_ANDAMENTO) */}
            <Link
              href="/ao-vivo"
              className="w-full text-left p-4 rounded-xl font-bold uppercase text-xs tracking-wider flex items-center gap-3 transition-all text-slate-400 hover:bg-slate-800 hover:text-white"
            >
              <Calendar size={18} /> Tela Ao Vivo
            </Link>

            {/* ✅ Modelos */}
            <Link
              href="/admin/modelos"
              className="w-full text-left p-4 rounded-xl font-bold uppercase text-xs tracking-wider flex items-center gap-3 transition-all text-slate-400 hover:bg-slate-800 hover:text-white"
            >
              <Swords size={18} /> Modelos & Regras
            </Link>
          </nav>
        </div>

        <button onClick={sair} className="mt-8 w-full text-left p-4 rounded-xl font-bold uppercase text-xs flex gap-3 hover:bg-red-900/20 text-red-400 hover:text-red-300 transition-colors">
          <LogOut size={18} /> Encerrar Sessão
        </button>
      </aside>

      <div className="flex-1 p-6 md:p-12 overflow-y-auto h-screen bg-slate-50">

        {abaAtiva === 'dashboard' && (
          <div className="max-w-7xl mx-auto animate-in fade-in duration-500">
            <div className="flex justify-between items-end mb-8">
              <div>
                <h2 className="text-4xl font-black uppercase text-slate-900 tracking-tighter">Auditoria</h2>
                <p className="text-slate-500 font-medium">Controle financeiro e cadastral das equipes.</p>
              </div>
              <div className="bg-white px-6 py-3 rounded-2xl border border-slate-200 shadow-sm text-right">
                <span className="block text-[10px] font-bold uppercase text-slate-400 tracking-wider">Total Inscritos</span>
                <span className="text-3xl font-black text-blue-600 leading-none">{equipes.length}</span>
              </div>
            </div>

            <div className="bg-white rounded-3xl shadow-xl border border-slate-200 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="bg-slate-50 uppercase font-black text-xs text-slate-400 tracking-wider border-b border-slate-100">
                    <tr>
                      <th className="p-6">Time / Local</th>
                      <th className="p-6">Responsável</th>
                      <th className="p-6">WhatsApp</th>
                      <th className="p-6 text-center">Pagamento</th>
                      <th className="p-6 text-center">Documento</th>
                      <th className="p-6 text-right">Ações</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {loading && (
                      <tr>
                        <td colSpan="6" className="p-10 text-center text-slate-400">
                          <Loader2 className="animate-spin mx-auto mb-2" />
                          Carregando dados...
                        </td>
                      </tr>
                    )}
                    {!loading && equipes.map((eq) => (
                      <tr key={eq.id} className="hover:bg-blue-50/50 transition-colors group">
                        <td className="p-6">
                          <p className="font-black text-slate-900 text-lg">{eq.nome_equipe}</p>
                          <p className="text-xs font-bold text-slate-400 uppercase tracking-wide flex items-center gap-1">
                            {eq.modalidade || 'FUTSAL'} • {eq.cidade}
                          </p>
                        </td>
                        <td className="p-6">
                          <div className="space-y-1">
                            <p className="font-bold text-slate-700 flex items-center gap-2">
                              <Users size={14} className="text-blue-500" /> {eq.nome_capitao}
                            </p>
                            <div className="text-xs text-slate-500 bg-slate-100 px-2 py-1 rounded inline-block font-mono border border-slate-200">
                              Login: {eq.email}
                            </div>
                          </div>
                        </td>
                        <td className="p-6">
                          {waLink(eq.whatsapp) ? (
                            <a
                              href={waLink(eq.whatsapp)}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex items-center gap-2 bg-green-50 text-green-700 px-3 py-1.5 rounded-lg text-xs font-bold hover:bg-green-100 transition-colors border border-green-100 shadow-sm"
                            >
                              <Phone size={14} /> {formatPhoneDisplay(eq.whatsapp)}
                            </a>
                          ) : (
                            <span className="text-slate-400 font-semibold flex items-center gap-2 text-xs">
                              <AlertCircle size={14} /> Inválido
                            </span>
                          )}
                        </td>
                        <td className="p-6 text-center">
                          {eq.pago ? (
                            <span className="inline-flex items-center gap-1.5 bg-green-100 text-green-700 px-3 py-1.5 rounded-full text-[10px] font-black uppercase tracking-wide border border-green-200">
                              <CheckCircle size={12} /> Confirmado
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1.5 bg-yellow-50 text-yellow-700 px-3 py-1.5 rounded-full text-[10px] font-black uppercase tracking-wide border border-yellow-100">
                              Pendente
                            </span>
                          )}
                        </td>
                        <td className="p-6 text-center">
                          {eq.termo_url ? (
                            <div className="flex flex-col items-center gap-2">
                              <a
                                href={eq.termo_url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1 bg-blue-50 text-blue-700 px-3 py-1.5 rounded-lg text-[10px] font-black uppercase hover:bg-blue-100 border border-blue-200"
                              >
                                <FileText size={14} /> Ver Termo
                              </a>

                              {!eq.termo_assinado ? (
                                <div className="flex gap-2">
                                  <button onClick={() => gerenciarEquipe(eq.id, 'approve_doc')} className="bg-green-600 text-white p-2 rounded-lg hover:bg-green-700 shadow-sm transition-colors">
                                    <CheckCircle size={16} />
                                  </button>
                                  <button onClick={() => gerenciarEquipe(eq.id, 'reject_doc')} className="bg-red-50 text-white p-2 rounded-lg hover:bg-red-600 shadow-sm transition-colors">
                                    <XCircle size={16} />
                                  </button>
                                </div>
                              ) : (
                                <div className="flex items-center gap-2">
                                  <span className="text-[9px] bg-green-100 text-green-700 px-2 py-0.5 rounded border border-green-200 font-bold uppercase flex items-center gap-1">
                                    <CheckCircle size={10} /> Doc OK
                                  </span>
                                  <button onClick={() => gerenciarEquipe(eq.id, 'reject_doc')} className="text-red-300 hover:text-red-500 p-1">
                                    <Trash2 size={12} />
                                  </button>
                                </div>
                              )}
                            </div>
                          ) : (
                            <span className="text-slate-300 text-xs font-bold uppercase tracking-wider flex flex-col items-center gap-1">
                              <AlertCircle size={14} /> Pendente
                            </span>
                          )}
                        </td>
                        <td className="p-6 text-right">
                          <div className="flex justify-end gap-2 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                            {!eq.pago && (
                              <button onClick={() => gerenciarEquipe(eq.id, 'approve')} className="p-2 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-600 transition-all border border-blue-100" title="Aprovar Pagamento">
                                <DollarSign size={18} />
                              </button>
                            )}
                            <button onClick={() => gerenciarEquipe(eq.id, 'delete')} className="p-2 bg-red-50 text-red-600 rounded-lg hover:bg-red-600 transition-all border border-red-100" title="Excluir Equipe">
                              <Trash2 size={18} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {abaAtiva === 'config' && (
          <div className="max-w-5xl mx-auto space-y-8 animate-in fade-in duration-500 pb-20">
            <div className="flex justify-between items-end sticky top-0 bg-slate-50/90 backdrop-blur z-10 py-4 border-b border-slate-200">
              <div>
                <h2 className="text-4xl font-black uppercase text-slate-900 tracking-tighter">Editor do Site</h2>
                <p className="text-slate-500 font-medium">Controle total de textos, status e imagens.</p>
              </div>
              <button
                onClick={salvarConfig}
                disabled={loading}
                className="bg-slate-900 text-white font-black py-3 px-8 rounded-xl uppercase shadow-lg shadow-slate-300 hover:scale-[1.02] hover:bg-black transition-all flex items-center gap-2 disabled:opacity-60"
              >
                {loading ? <Loader2 className="animate-spin" size={18} /> : <Save size={18} />}
                {loading ? 'Salvando...' : 'Salvar Alterações'}
              </button>
            </div>

            {/* SEÇÃO 1: IDENTIDADE E CONTATO */}
            <div className="bg-white p-8 rounded-[2rem] shadow-sm border border-slate-200">
              <h3 className="flex items-center gap-3 font-black uppercase text-slate-800 text-sm mb-6 pb-4 border-b border-slate-100">
                <ImageIcon size={18} className="text-blue-600" /> 1. Identidade & Contato
              </h3>
              <div className="grid md:grid-cols-2 gap-6">
                <div className="md:col-span-2">
                  <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest mb-2 block">Logo URL (Link da Imagem)</label>
                  <input className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-700 outline-none" value={config.logo_url || ''} onChange={(e) => setConfig({ ...config, logo_url: e.target.value })} />
                </div>
                <div>
                  <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest mb-2 block">Nome da Competição (Ex: Taça Verão)</label>
                  <input className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-700 outline-none" value={config.nome_competicao || ''} onChange={(e) => setConfig({ ...config, nome_competicao: e.target.value })} />
                </div>
                <div>
                  <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest mb-2 block">Nome da Empresa (Organizadora)</label>
                  <input className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-700 outline-none" value={config.nome_empresa || ''} onChange={(e) => setConfig({ ...config, nome_empresa: e.target.value })} />
                </div>
                <div>
                  <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest mb-2 block">WhatsApp Admin (Só números)</label>
                  <input className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-700 outline-none" value={config.whatsapp || ''} onChange={(e) => setConfig({ ...config, whatsapp: e.target.value })} placeholder="47999998888" />
                </div>
              </div>
            </div>

            {/* SEÇÃO 2: CAPA DO SITE (HERO) */}
            <div className="bg-white p-8 rounded-[2rem] shadow-sm border border-slate-200">
              <h3 className="flex items-center gap-3 font-black uppercase text-slate-800 text-sm mb-6 pb-4 border-b border-slate-100">
                <AlignLeft size={18} className="text-purple-600" /> 2. Capa do Site (Hero Section)
              </h3>

              <div className="grid md:grid-cols-2 gap-6">
                <div className="md:col-span-2">
                  <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest mb-2 block">Link Imagem de Fundo</label>
                  <input className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-700 outline-none" value={config.imagem_fundo || ''} onChange={(e) => setConfig({ ...config, imagem_fundo: e.target.value })} />
                </div>

                <div>
                  <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest mb-2 block">Texto Pequeno Topo</label>
                  <input className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-700 outline-none" value={config.texto_topo || ''} onChange={(e) => setConfig({ ...config, texto_topo: e.target.value })} />
                </div>

                <div>
                  <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest mb-2 block">Título Principal (Grande)</label>
                  <input className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-700 outline-none text-lg" value={config.titulo_destaque || ''} onChange={(e) => setConfig({ ...config, titulo_destaque: e.target.value })} />
                </div>

                <div className="md:col-span-2">
                  <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest mb-2 block">Subtítulo (Abaixo do Título)</label>
                  <textarea className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl font-medium text-slate-600 outline-none h-20" value={config.subtitulo || ''} onChange={(e) => setConfig({ ...config, subtitulo: e.target.value })} />
                </div>

                <div>
                  <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest mb-2 block">Data Limite (Texto)</label>
                  <input className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-700 outline-none" value={config.data_limite || ''} onChange={(e) => setConfig({ ...config, data_limite: e.target.value })} />
                </div>

                <div>
                  <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest mb-2 block">Valor Prêmio (Texto)</label>
                  <input className="w-full p-3 bg-green-50 border border-green-200 rounded-xl font-black text-green-700 outline-none" value={config.valor_premio || ''} onChange={(e) => setConfig({ ...config, valor_premio: e.target.value })} />
                </div>

                {/* ✅ NOVO: Textos do Hero (layout novo) */}
                <div className="md:col-span-2 bg-purple-50 p-4 rounded-xl border border-purple-200 mt-2">
                  <p className="text-[10px] font-black uppercase text-purple-700 mb-2">
                    Texto do Hero (layout novo)
                  </p>

                  <div className="grid md:grid-cols-2 gap-4">
                    <div className="md:col-span-2">
                      <label className="text-[9px] font-bold uppercase text-slate-500">Headline (Grande)</label>
                      <input
                        className="w-full p-2 bg-white border border-purple-200 rounded-lg text-sm font-black"
                        placeholder="Ex: O palco da base local."
                        value={config.hero_headline || ''}
                        onChange={(e) => setConfig({ ...config, hero_headline: e.target.value })}
                      />
                    </div>

                    <div className="md:col-span-2">
                      <label className="text-[9px] font-bold uppercase text-slate-500">Tagline (Abaixo)</label>
                      <input
                        className="w-full p-2 bg-white border border-purple-200 rounded-lg text-sm font-bold"
                        placeholder="Ex: Somos apaixonados por futebol de base."
                        value={config.hero_tagline || ''}
                        onChange={(e) => setConfig({ ...config, hero_tagline: e.target.value })}
                      />
                    </div>

                    <div className="md:col-span-2">
                      <label className="text-[9px] font-bold uppercase text-slate-500">Badge (Destaque)</label>
                      <input
                        className="w-full p-2 bg-white border border-purple-200 rounded-lg text-sm font-bold"
                        placeholder="Ex: Vem aí: Taça Pérolas do Vale do Itajaí"
                        value={config.hero_badge || ''}
                        onChange={(e) => setConfig({ ...config, hero_badge: e.target.value })}
                      />
                      <p className="text-[10px] text-slate-500 mt-2">
                        Esse é o texto que “desce” e fica em destaque no Hero.
                      </p>
                    </div>
                  </div>
                </div>

                <div className="md:col-span-2 bg-slate-50 p-4 rounded-xl border border-slate-200 mt-2">
                  <p className="text-[10px] font-black uppercase text-slate-400 mb-2">Card Flutuante (Match Center)</p>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-[9px] font-bold uppercase text-slate-400">Título Card</label>
                      <input className="w-full p-2 bg-white border rounded-lg text-sm font-bold" value={config.titulo_card_hero || ''} onChange={(e) => setConfig({ ...config, titulo_card_hero: e.target.value })} />
                    </div>
                    <div>
                      <label className="text-[9px] font-bold uppercase text-slate-400">Texto Card</label>
                      <input className="w-full p-2 bg-white border rounded-lg text-sm" value={config.texto_card_hero || ''} onChange={(e) => setConfig({ ...config, texto_card_hero: e.target.value })} />
                    </div>
                  </div>
                </div>

              </div>
            </div>

            {/* SEÇÃO 3: SOBRE A EMPRESA */}
            <div className="bg-white p-8 rounded-[2rem] shadow-sm border border-slate-200">
              <h3 className="flex items-center gap-3 font-black uppercase text-slate-800 text-sm mb-6 pb-4 border-b border-slate-100">
                <Type size={18} className="text-orange-500" /> 3. Sobre a Empresa
              </h3>
              <div className="grid md:grid-cols-2 gap-6">
                <div className="md:col-span-2">
                  <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest mb-2 block">Slogan Curto</label>
                  <input className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-700 outline-none" value={config.slogan || ''} onChange={(e) => setConfig({ ...config, slogan: e.target.value })} />
                </div>
                <div className="md:col-span-2">
                  <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest mb-2 block">Texto Principal (Quem somos)</label>
                  <textarea className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl font-medium text-slate-600 outline-none h-24" value={config.texto_empresa || ''} onChange={(e) => setConfig({ ...config, texto_empresa: e.target.value })} />
                </div>
                <div>
                  <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest mb-2 block">Missão</label>
                  <textarea className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl font-medium text-slate-600 outline-none h-24" value={config.missao || ''} onChange={(e) => setConfig({ ...config, missao: e.target.value })} />
                </div>
                <div>
                  <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest mb-2 block">Valores</label>
                  <textarea className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl font-medium text-slate-600 outline-none h-24" value={config.valores || ''} onChange={(e) => setConfig({ ...config, valores: e.target.value })} />
                </div>
              </div>
            </div>

            {/* SEÇÃO 4: MODALIDADES (INCLUINDO VALORES PIX) */}
            <div className="grid md:grid-cols-2 gap-8">
              <div className="bg-white p-8 rounded-[2rem] shadow-sm border border-slate-200">
                <h3 className="flex items-center gap-3 font-black uppercase text-blue-600 text-sm mb-6 pb-4 border-b border-slate-100">4.1 Futsal</h3>
                <div className="space-y-4">
                  <div className="bg-blue-50 p-4 rounded-xl border border-blue-100">
                    <label className="text-[10px] font-black uppercase text-blue-500 mb-1 block">Status Inscrição</label>
                    <select className="w-full p-2 bg-white border border-blue-200 rounded-lg font-bold text-xs" value={config.status_futsal} onChange={(e) => setConfig({ ...config, status_futsal: e.target.value })}>
                      <option value="EM_BREVE">🟡 Em Breve</option>
                      <option value="ABERTA">🟢 Aberta</option>
                      <option value="ENCERRADA">🔴 Encerrada</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-[10px] font-black mb-1 block uppercase text-slate-400">Título</label>
                    <input className="w-full p-2 bg-slate-50 border rounded-lg font-bold" value={config.titulo_futsal || ''} onChange={(e) => setConfig({ ...config, titulo_futsal: e.target.value })} />
                  </div>
                  <div>
                    <label className="text-[10px] font-black mb-1 block uppercase text-slate-400">Descrição</label>
                    <textarea className="w-full p-2 bg-slate-50 border rounded-lg font-medium h-20" value={config.desc_futsal || ''} onChange={(e) => setConfig({ ...config, desc_futsal: e.target.value })} />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-[10px] font-black mb-1 block uppercase text-slate-400">Local</label>
                      <input className="w-full p-2 bg-slate-50 border rounded-lg font-bold" value={config.local_futsal || ''} onChange={(e) => setConfig({ ...config, local_futsal: e.target.value })} />
                    </div>
                    <div>
                      <label className="text-[10px] font-black mb-1 block uppercase text-slate-400">Início</label>
                      <input className="w-full p-2 bg-slate-50 border rounded-lg font-bold" value={config.inicio_futsal || ''} onChange={(e) => setConfig({ ...config, inicio_futsal: e.target.value })} />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-[10px] font-black mb-1 block uppercase text-slate-400">Vagas</label>
                      <input type="number" className="w-full p-2 bg-slate-50 border rounded-lg font-bold" value={config.vagas_futsal || 0} onChange={(e) => setConfig({ ...config, vagas_futsal: Number(e.target.value) })} />
                    </div>
                    <div>
                      <label className="text-[10px] font-black mb-1 block uppercase text-blue-600">Valor PIX (R$)</label>
                      <input type="number" step="0.01" className="w-full p-2 bg-blue-50 border border-blue-200 rounded-lg font-black text-blue-700" value={config.preco_futsal || 0} onChange={(e) => setConfig({ ...config, preco_futsal: Number(e.target.value) })} />
                    </div>
                  </div>
                </div>
              </div>

              <div className="bg-white p-8 rounded-[2rem] shadow-sm border border-slate-200">
                <h3 className="flex items-center gap-3 font-black uppercase text-green-600 text-sm mb-6 pb-4 border-b border-slate-100">4.2 Society</h3>
                <div className="space-y-4">
                  <div className="bg-green-50 p-4 rounded-xl border border-green-100">
                    <label className="text-[10px] font-black uppercase text-green-500 mb-1 block">Status Inscrição</label>
                    <select className="w-full p-2 bg-white border border-green-200 rounded-lg font-bold text-xs" value={config.status_society} onChange={(e) => setConfig({ ...config, status_society: e.target.value })}>
                      <option value="EM_BREVE">🟡 Em Breve</option>
                      <option value="ABERTA">🟢 Aberta</option>
                      <option value="ENCERRADA">🔴 Encerrada</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-[10px] font-black mb-1 block uppercase text-slate-400">Título</label>
                    <input className="w-full p-2 bg-slate-50 border rounded-lg font-bold" value={config.titulo_society || ''} onChange={(e) => setConfig({ ...config, titulo_society: e.target.value })} />
                  </div>
                  <div>
                    <label className="text-[10px] font-black mb-1 block uppercase text-slate-400">Descrição</label>
                    <textarea className="w-full p-2 bg-slate-50 border rounded-lg font-medium h-20" value={config.desc_society || ''} onChange={(e) => setConfig({ ...config, desc_society: e.target.value })} />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-[10px] font-black mb-1 block uppercase text-slate-400">Local</label>
                      <input className="w-full p-2 bg-slate-50 border rounded-lg font-bold" value={config.local_society || ''} onChange={(e) => setConfig({ ...config, local_society: e.target.value })} />
                    </div>
                    <div>
                      <label className="text-[10px] font-black mb-1 block uppercase text-slate-400">Início</label>
                      <input className="w-full p-2 bg-slate-50 border rounded-lg font-bold" value={config.inicio_society || ''} onChange={(e) => setConfig({ ...config, inicio_society: e.target.value })} />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-[10px] font-black mb-1 block uppercase text-slate-400">Vagas</label>
                      <input type="number" className="w-full p-2 bg-slate-50 border rounded-lg font-bold" value={config.vagas_society || 0} onChange={(e) => setConfig({ ...config, vagas_society: Number(e.target.value) })} />
                    </div>
                    <div>
                      <label className="text-[10px] font-black mb-1 block uppercase text-green-600">Valor PIX (R$)</label>
                      <input type="number" step="0.01" className="w-full p-2 bg-green-50 border border-green-200 rounded-lg font-black text-green-700" value={config.preco_society || 0} onChange={(e) => setConfig({ ...config, preco_society: Number(e.target.value) })} />
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* SEÇÃO 5: RODAPÉ */}
            <div className="bg-white p-8 rounded-[2rem] shadow-sm border border-slate-200">
              <h3 className="flex items-center gap-3 font-black uppercase text-slate-800 text-sm mb-6 pb-4 border-b border-slate-100">5. Rodapé</h3>
              <div className="grid md:grid-cols-1 gap-6">
                <div>
                  <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest mb-2 block">Texto do Rodapé (Copyright/Info)</label>
                  <input className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl font-bold text-sm" value={config.texto_footer || ''} onChange={(e) => setConfig({ ...config, texto_footer: e.target.value })} />
                </div>
              </div>
            </div>

            {/* SEÇÃO 6: GESTÃO DE PATROCINADORES */}
            <div className="bg-white p-8 rounded-[2rem] shadow-xl border-2 border-blue-100 relative overflow-hidden">
              <div className="absolute top-0 right-0 p-4 opacity-10"><Trophy size={80} className="text-blue-600" /></div>
              <h3 className="flex items-center gap-3 font-black uppercase text-slate-800 text-sm mb-6 pb-4 border-b border-slate-100">
                <Trophy size={18} className="text-blue-600" /> 6. Ecossistema de Patrocínios
              </h3>

              <div className="bg-slate-50 p-6 rounded-3xl border border-slate-100 mb-8 space-y-4">
                <p className="text-[10px] font-black uppercase text-blue-600 tracking-widest">Adicionar Novo Parceiro</p>
                <div className="grid md:grid-cols-3 gap-4">
                  <div className="md:col-span-2">
                    <label className="text-[9px] font-bold uppercase text-slate-400 ml-1">Empresa</label>
                    <input className="w-full p-2 bg-white border border-slate-200 rounded-xl font-bold text-sm" placeholder="Nome do Patrocinador" value={novoPatro.nome_empresa} onChange={e => setNovoPatro({ ...novoPatro, nome_empresa: e.target.value })} />
                  </div>
                  <div>
                    <label className="text-[9px] font-bold uppercase text-slate-400 ml-1">Cota / Local de Exibição</label>
                    <select className="w-full p-2 bg-white border border-slate-200 rounded-xl font-bold text-sm text-blue-600" value={novoPatro.cota} onChange={e => setNovoPatro({ ...novoPatro, cota: e.target.value })}>
                      <option value="MASTER">💎 MASTER (Fixo Topo)</option>
                      <option value="CARROSSEL">🔄 CARROSSEL (Giro)</option>
                      <option value="RODAPE">⬇️ RODAPÉ (Fixo Base)</option>
                    </select>
                  </div>
                  <div className="md:col-span-3">
                    <label className="text-[9px] font-bold uppercase text-slate-400 ml-1">Link da Imagem (Banner)</label>
                    <input className="w-full p-2 bg-white border border-slate-200 rounded-xl font-bold text-sm" placeholder="https://imgur.com/link-da-imagem.png" value={novoPatro.banner_url} onChange={e => setNovoPatro({ ...novoPatro, banner_url: e.target.value })} />
                  </div>
                  {/* ✅ CAMPO DE VÍDEO MASTER REINTEGRADO */}
                  <div className="md:col-span-3">
                    <label className="text-[9px] font-bold uppercase text-slate-400 ml-1">Link do Vídeo (Apenas para MASTER - MP4)</label>
                    <input className="w-full p-2 bg-white border border-slate-200 rounded-xl font-bold text-sm" placeholder="https://link-do-video.mp4" value={novoPatro.video_url} onChange={e => setNovoPatro({ ...novoPatro, video_url: e.target.value })} />
                  </div>
                  {/* ✅ CAMPO LINK DESTINO REINTEGRADO */}
                  <div className="md:col-span-3">
                    <label className="text-[9px] font-bold uppercase text-slate-400 ml-1">Link de Destino (Site/Insta)</label>
                    <input className="w-full p-2 bg-white border border-slate-200 rounded-xl font-bold text-sm" placeholder="https://instagram.com/marca" value={novoPatro.link_destino} onChange={e => setNovoPatro({ ...novoPatro, link_destino: e.target.value })} />
                  </div>
                </div>
                <button onClick={adicionarPatrocinio} disabled={loading} className="w-full bg-blue-600 text-white font-black py-3 rounded-xl uppercase text-xs tracking-widest hover:bg-blue-700 transition-all flex items-center justify-center gap-2">
                  <PlusCircle size={16} /> Adicionar Patrocinador
                </button>
              </div>

              <div className="space-y-3">
                <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Patrocinadores Ativos ({listaPatrocinios.length})</p>
                {listaPatrocinios.length === 0 && <p className="text-center py-10 text-slate-400 font-bold text-sm bg-slate-50 rounded-2xl border-2 border-dashed">Nenhum patrocinador cadastrado.</p>}
                {listaPatrocinios.map(p => (
                  <div key={p.id} className="flex items-center justify-between p-4 bg-white border border-slate-100 rounded-2xl shadow-sm hover:shadow-md transition-shadow group">
                    <div className="flex items-center gap-4">
                      <div className={`w-3 h-10 rounded-full ${p.cota === 'MASTER'
                        ? 'bg-blue-600 shadow-[0_0_10px_rgba(37,99,235,0.4)]'
                        : p.cota === 'RODAPE'
                          ? 'bg-slate-800'
                          : 'bg-green-500'
                        }`}
                      />
                      <div>
                        <p className="font-black text-slate-800 uppercase text-xs">{p.nome_empresa}</p>
                        <div className="flex gap-2 items-center">
                          <span className="text-[9px] font-bold text-slate-400 uppercase bg-slate-100 px-2 py-0.5 rounded tracking-tighter">{p.cota}</span>
                          {p.video_url && <Video size={10} className="text-blue-500" />}
                        </div>
                      </div>
                    </div>
                    <button onClick={() => excluirPatrocinio(p.id)} className="p-2 bg-red-50 text-red-400 rounded-lg opacity-100 sm:opacity-0 sm:group-hover:opacity-100 hover:bg-red-500 hover:text-white transition-all">
                      <Trash2 size={16} />
                    </button>
                  </div>
                ))}
              </div>
            </div>

          </div>
        )}
      </div>
    </main>
  )
}
