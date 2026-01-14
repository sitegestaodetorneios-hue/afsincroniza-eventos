'use client'
import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import {
  Settings, LayoutDashboard, Users, Trash2, CheckCircle, Phone,
  Image as ImageIcon, AlignLeft, LogOut, ClipboardList, Loader2,
  AlertCircle, Save, Trophy, Type, Calendar, MapPin, DollarSign, FileText
} from 'lucide-react'

// --- FUNÇÕES AUXILIARES ---
function onlyDigits(v) { return (v || '').toString().replace(/\D/g, '') }

function isValidBRPhone(raw) {
  const d = onlyDigits(raw)
  return d.length >= 10 && d.length <= 13
}

function waLink(rawPhone) {
  const d = onlyDigits(rawPhone)
  if (!d) return null
  if (d.startsWith('55') && d.length >= 12) return `https://wa.me/${d}`
  return `https://wa.me/55${d}`
}

function formatPhoneDisplay(raw) {
    const d = onlyDigits(raw)
    if (d.length === 11) return `(${d.slice(0,2)}) ${d.slice(2,7)}-${d.slice(7)}`
    if (d.length >= 12 && d.startsWith('55')) return `(+55) ${d.slice(2,4)} ${d.slice(4,9)}-${d.slice(9)}`
    return raw
}

// --- COMPONENTE PRINCIPAL ---
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
      slogan: '', texto_empresa: '', missao: '', valores: '',
      status_futsal: 'EM_BREVE', titulo_futsal: '', desc_futsal: '', 
      local_futsal: '', inicio_futsal: '', vagas_futsal: 0,
      status_society: 'EM_BREVE', titulo_society: '', desc_society: '', 
      local_society: '', inicio_society: '', vagas_society: 0,
      texto_footer: '',
    }), []
  )

  const [config, setConfig] = useState(defaultConfig)

  useEffect(() => { if (autenticado) carregarTudo() }, [autenticado])

  async function carregarTudo() {
    setLoading(true)
    try {
      const [cfgRes, teamsRes] = await Promise.all([
        fetch('/api/config'),
        fetch('/api/admin/teams', { headers: { 'x-admin-pin': senha } }),
      ])
      const cfg = await cfgRes.json().catch(() => null)
      const teams = await teamsRes.json().catch(() => [])

      if (cfg) {
        setConfig({
          ...defaultConfig,
          ...cfg,
          vagas_futsal: Number(cfg.vagas_futsal || 0),
          vagas_society: Number(cfg.vagas_society || 0),
        })
      } else { setConfig(defaultConfig) }

      setEquipes(Array.isArray(teams) ? teams : [])
    } catch (e) { alert('Erro de conexão.') } finally { setLoading(false) }
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
      if (!res.ok) throw new Error()
      alert('Tudo salvo! O site já foi atualizado.')
      await carregarTudo()
    } catch (e) { alert('Erro ao salvar.') } finally { setLoading(false) }
  }

  async function gerenciarEquipe(id, action) {
    if (!confirm('Tem certeza?')) return
    try {
      const res = await fetch('/api/admin/teams', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'x-admin-pin': senha },
        body: JSON.stringify({ id, action }),
      })
      if (!res.ok) throw new Error()
      await carregarTudo()
    } catch (e) { alert('Falha ao executar ação.') }
  }

  if (!autenticado) {
    return (
      <main className="min-h-screen bg-slate-950 flex items-center justify-center p-6">
        <div className="bg-slate-900 p-10 rounded-2xl border border-slate-800 text-center max-w-sm w-full shadow-2xl">
          <div className="w-16 h-16 bg-blue-600 rounded-full flex items-center justify-center mx-auto mb-6 shadow-[0_0_20px_rgba(37,99,235,0.5)]"><LayoutDashboard className="text-white" size={32}/></div>
          <h1 className="text-2xl font-black text-white uppercase mb-6 tracking-widest">Super Admin</h1>
          <input type="password" placeholder="PIN DE ACESSO" className="w-full p-4 bg-slate-950 border border-slate-800 rounded-xl text-center text-white font-bold text-xl mb-6 tracking-[0.5em] outline-none focus:border-blue-600 transition-colors" value={senha} onChange={(e) => setSenha(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && logar()} />
          <button onClick={logar} className="w-full bg-blue-600 text-white font-bold py-4 rounded-xl uppercase hover:bg-blue-500 transition-all hover:scale-[1.02]">Acessar Sistema</button>
        </div>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-slate-50 flex flex-col md:flex-row font-sans text-slate-800">
      
      {/* SIDEBAR */}
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
            <button onClick={() => setAbaAtiva('dashboard')} className={`w-full text-left p-4 rounded-xl font-bold uppercase text-xs tracking-wider flex items-center gap-3 transition-all ${abaAtiva === 'dashboard' ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/50' : 'text-slate-400 hover:bg-slate-800 hover:text-white'}`}>
              <Users size={18} /> Auditoria / Equipes
            </button>
            <button onClick={() => setAbaAtiva('config')} className={`w-full text-left p-4 rounded-xl font-bold uppercase text-xs tracking-wider flex items-center gap-3 transition-all ${abaAtiva === 'config' ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/50' : 'text-slate-400 hover:bg-slate-800 hover:text-white'}`}>
              <Settings size={18} /> Editor Completo
            </button>
            <Link href="/admin/jogos" className="w-full text-left p-4 rounded-xl font-bold uppercase text-xs tracking-wider flex items-center gap-3 transition-all text-slate-400 hover:bg-slate-800 hover:text-white">
              <ClipboardList size={18} /> Gestão de Jogos
            </Link>
          </nav>
        </div>
        <button onClick={sair} className="mt-8 w-full text-left p-4 rounded-xl font-bold uppercase text-xs flex gap-3 hover:bg-red-900/20 text-red-400 hover:text-red-300 transition-colors">
          <LogOut size={18} /> Encerrar Sessão
        </button>
      </aside>

      {/* CONTEÚDO */}
      <div className="flex-1 p-6 md:p-12 overflow-y-auto h-screen bg-slate-50">
        
        {/* ABA 1: DASHBOARD / AUDITORIA */}
        {abaAtiva === 'dashboard' && (
          <div className="max-w-7xl mx-auto animate-in fade-in duration-500">
            <div className="flex justify-between items-end mb-8">
                <div><h2 className="text-4xl font-black uppercase text-slate-900 tracking-tighter">Auditoria</h2><p className="text-slate-500 font-medium">Controle financeiro e cadastral das equipes.</p></div>
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
                    {loading && <tr><td colSpan="6" className="p-10 text-center text-slate-400"><Loader2 className="animate-spin mx-auto mb-2"/>Carregando dados...</td></tr>}
                    {!loading && equipes.map((eq) => {
                        const link = waLink(eq.whatsapp)
                        return (
                        <tr key={eq.id} className="hover:bg-blue-50/50 transition-colors group">
                            <td className="p-6">
                                <p className="font-black text-slate-900 text-lg">{eq.nome_equipe}</p>
                                <p className="text-xs font-bold text-slate-400 uppercase tracking-wide flex items-center gap-1">{eq.modalidade || 'FUTSAL'} • {eq.cidade}</p>
                            </td>
                            <td className="p-6"><div className="space-y-1"><p className="font-bold text-slate-700 flex items-center gap-2"><Users size={14} className="text-blue-500"/> {eq.nome_capitao}</p><div className="text-xs text-slate-500 bg-slate-100 px-2 py-1 rounded inline-block font-mono border border-slate-200">Login: {eq.email}</div></div></td>
                            <td className="p-6">{link ? <a href={link} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 bg-green-50 text-green-700 px-3 py-1.5 rounded-lg text-xs font-bold hover:bg-green-100 transition-colors border border-green-100 shadow-sm"><Phone size={14} /> {formatPhoneDisplay(eq.whatsapp)}</a> : <span className="text-slate-400 font-semibold flex items-center gap-2 text-xs"><AlertCircle size={14}/> Inválido</span>}</td>
                            <td className="p-6 text-center">{eq.pago ? <span className="inline-flex items-center gap-1.5 bg-green-100 text-green-700 px-3 py-1.5 rounded-full text-[10px] font-black uppercase tracking-wide border border-green-200"><CheckCircle size={12}/> Confirmado</span> : <span className="inline-flex items-center gap-1.5 bg-yellow-50 text-yellow-700 px-3 py-1.5 rounded-full text-[10px] font-black uppercase tracking-wide border border-yellow-100">Pendente</span>}</td>
                            <td className="p-6 text-center">{eq.termo_url ? <a href={eq.termo_url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 bg-blue-100 text-blue-700 px-3 py-1.5 rounded-lg text-[10px] font-black uppercase hover:bg-blue-200 transition-colors border border-blue-200"><FileText size={14}/> Ver Termo</a> : <span className="text-slate-300 text-xs font-bold uppercase tracking-wider">Pendente</span>}</td>
                            <td className="p-6 text-right"><div className="flex justify-end gap-2 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">{!eq.pago && <button onClick={() => gerenciarEquipe(eq.id, 'approve')} className="p-2 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-600 hover:text-white transition-all border border-blue-100" title="Aprovar"><CheckCircle size={18} /></button>}<button onClick={() => gerenciarEquipe(eq.id, 'delete')} className="p-2 bg-red-50 text-red-600 rounded-lg hover:bg-red-600 hover:text-white transition-all border border-red-100" title="Excluir"><Trash2 size={18} /></button></div></td>
                        </tr>
                        )
                    })}
                    </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ABA 2: CONFIGURAÇÃO GERAL (EDITOR) */}
        {abaAtiva === 'config' && (
          <div className="max-w-5xl mx-auto space-y-8 animate-in fade-in duration-500 pb-20">
            <div className="flex justify-between items-end sticky top-0 bg-slate-50/90 backdrop-blur z-10 py-4 border-b border-slate-200">
                <div><h2 className="text-4xl font-black uppercase text-slate-900 tracking-tighter">Editor do Site</h2><p className="text-slate-500 font-medium">Controle total de textos, status e imagens.</p></div>
                <button onClick={salvarConfig} disabled={loading} className="bg-slate-900 text-white font-black py-3 px-8 rounded-xl uppercase shadow-lg shadow-slate-300 hover:scale-[1.02] hover:bg-black transition-all flex items-center gap-2 disabled:opacity-60">{loading ? <Loader2 className="animate-spin" size={18}/> : <Save size={18}/>} {loading ? 'Salvando...' : 'Salvar Alterações'}</button>
            </div>

            {/* SEÇÃO 1: IDENTIDADE E CONTATO */}
            <div className="bg-white p-8 rounded-[2rem] shadow-sm border border-slate-200">
                <h3 className="flex items-center gap-3 font-black uppercase text-slate-800 text-sm mb-6 pb-4 border-b border-slate-100"><ImageIcon size={18} className="text-blue-600" /> 1. Identidade & Contato</h3>
                <div className="grid md:grid-cols-2 gap-6">
                    <div className="md:col-span-2"><label className="text-[10px] font-black uppercase text-slate-400 tracking-widest mb-2 block">Logo URL (Link da Imagem)</label><input className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-700 outline-none" value={config.logo_url || ''} onChange={(e) => setConfig({ ...config, logo_url: e.target.value })} /></div>
                    <div><label className="text-[10px] font-black uppercase text-slate-400 tracking-widest mb-2 block">Nome da Competição (Ex: Taça Verão)</label><input className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-700 outline-none" value={config.nome_competicao || ''} onChange={(e) => setConfig({ ...config, nome_competicao: e.target.value })} /></div>
                    <div><label className="text-[10px] font-black uppercase text-slate-400 tracking-widest mb-2 block">Nome da Empresa (Organizadora)</label><input className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-700 outline-none" value={config.nome_empresa || ''} onChange={(e) => setConfig({ ...config, nome_empresa: e.target.value })} /></div>
                    <div><label className="text-[10px] font-black uppercase text-slate-400 tracking-widest mb-2 block">WhatsApp Admin (Só números)</label><input className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-700 outline-none" value={config.whatsapp || ''} onChange={(e) => setConfig({ ...config, whatsapp: e.target.value })} placeholder="47999998888" /></div>
                </div>
            </div>

            {/* SEÇÃO 2: CAPA DO SITE (HERO) */}
            <div className="bg-white p-8 rounded-[2rem] shadow-sm border border-slate-200">
                <h3 className="flex items-center gap-3 font-black uppercase text-slate-800 text-sm mb-6 pb-4 border-b border-slate-100"><AlignLeft size={18} className="text-purple-600" /> 2. Capa do Site (Hero Section)</h3>
                <div className="grid md:grid-cols-2 gap-6">
                    <div className="md:col-span-2"><label className="text-[10px] font-black uppercase text-slate-400 tracking-widest mb-2 block">Link Imagem de Fundo</label><input className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-700 outline-none" value={config.imagem_fundo || ''} onChange={(e) => setConfig({ ...config, imagem_fundo: e.target.value })} /></div>
                    <div><label className="text-[10px] font-black uppercase text-slate-400 tracking-widest mb-2 block">Texto Pequeno Topo</label><input className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-700 outline-none" value={config.texto_topo || ''} onChange={(e) => setConfig({ ...config, texto_topo: e.target.value })} /></div>
                    <div><label className="text-[10px] font-black uppercase text-slate-400 tracking-widest mb-2 block">Título Principal (Grande)</label><input className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-700 outline-none text-lg" value={config.titulo_destaque || ''} onChange={(e) => setConfig({ ...config, titulo_destaque: e.target.value })} /></div>
                    <div className="md:col-span-2"><label className="text-[10px] font-black uppercase text-slate-400 tracking-widest mb-2 block">Subtítulo (Abaixo do Título)</label><textarea className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl font-medium text-slate-600 outline-none h-20" value={config.subtitulo || ''} onChange={(e) => setConfig({ ...config, subtitulo: e.target.value })} /></div>
                    <div><label className="text-[10px] font-black uppercase text-slate-400 tracking-widest mb-2 block">Data Limite (Texto)</label><input className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-700 outline-none" value={config.data_limite || ''} onChange={(e) => setConfig({ ...config, data_limite: e.target.value })} /></div>
                    <div><label className="text-[10px] font-black uppercase text-slate-400 tracking-widest mb-2 block">Valor Prêmio (Texto)</label><input className="w-full p-3 bg-green-50 border border-green-200 rounded-xl font-black text-green-700 outline-none" value={config.valor_premio || ''} onChange={(e) => setConfig({ ...config, valor_premio: e.target.value })} /></div>
                    
                    <div className="md:col-span-2 bg-slate-50 p-4 rounded-xl border border-slate-200 mt-2">
                        <p className="text-[10px] font-black uppercase text-slate-400 mb-2">Card Flutuante (Match Center)</p>
                        <div className="grid grid-cols-2 gap-4">
                            <div><label className="text-[9px] font-bold uppercase text-slate-400">Título Card</label><input className="w-full p-2 bg-white border rounded-lg text-sm font-bold" value={config.titulo_card_hero || ''} onChange={(e) => setConfig({...config, titulo_card_hero: e.target.value})} /></div>
                            <div><label className="text-[9px] font-bold uppercase text-slate-400">Texto Card</label><input className="w-full p-2 bg-white border rounded-lg text-sm" value={config.texto_card_hero || ''} onChange={(e) => setConfig({...config, texto_card_hero: e.target.value})} /></div>
                        </div>
                    </div>
                </div>
            </div>

            {/* SEÇÃO 3: SOBRE A EMPRESA */}
            <div className="bg-white p-8 rounded-[2rem] shadow-sm border border-slate-200">
                <h3 className="flex items-center gap-3 font-black uppercase text-slate-800 text-sm mb-6 pb-4 border-b border-slate-100"><Type size={18} className="text-orange-500" /> 3. Sobre a Empresa</h3>
                <div className="grid md:grid-cols-2 gap-6">
                    <div className="md:col-span-2"><label className="text-[10px] font-black uppercase text-slate-400 tracking-widest mb-2 block">Slogan Curto</label><input className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-700 outline-none" value={config.slogan || ''} onChange={(e) => setConfig({ ...config, slogan: e.target.value })} /></div>
                    <div className="md:col-span-2"><label className="text-[10px] font-black uppercase text-slate-400 tracking-widest mb-2 block">Texto Principal (Quem somos)</label><textarea className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl font-medium text-slate-600 outline-none h-24" value={config.texto_empresa || ''} onChange={(e) => setConfig({ ...config, texto_empresa: e.target.value })} /></div>
                    <div><label className="text-[10px] font-black uppercase text-slate-400 tracking-widest mb-2 block">Missão</label><textarea className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl font-medium text-slate-600 outline-none h-24" value={config.missao || ''} onChange={(e) => setConfig({ ...config, missao: e.target.value })} /></div>
                    <div><label className="text-[10px] font-black uppercase text-slate-400 tracking-widest mb-2 block">Valores</label><textarea className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl font-medium text-slate-600 outline-none h-24" value={config.valores || ''} onChange={(e) => setConfig({ ...config, valores: e.target.value })} /></div>
                </div>
            </div>

            {/* SEÇÃO 4: MODALIDADES (CRUCIAL PARA INSCRIÇÃO) */}
            <div className="grid md:grid-cols-2 gap-8">
                {/* FUTSAL */}
                <div className="bg-white p-8 rounded-[2rem] shadow-sm border border-slate-200 relative overflow-hidden group hover:shadow-md transition-all">
                    <div className="absolute top-0 left-0 w-full h-1 bg-blue-500"></div>
                    <h3 className="flex items-center gap-3 font-black uppercase text-blue-600 text-sm mb-6 pb-4 border-b border-slate-100">4.1 Futsal</h3>
                    <div className="space-y-4">
                        <div className="bg-blue-50 p-4 rounded-xl border border-blue-100">
                            <label className="text-[10px] font-black uppercase text-blue-500 tracking-widest mb-1 block">Status Inscrição (Controla o Site)</label>
                            <select className="w-full p-2 bg-white border border-blue-200 rounded-lg font-bold text-xs text-blue-700 outline-none" value={config.status_futsal} onChange={(e) => setConfig({...config, status_futsal: e.target.value})}>
                                <option value="EM_BREVE">🟡 Em Breve (Reserva apenas)</option>
                                <option value="ABERTA">🟢 Aberta (Inscrição Real)</option>
                                <option value="ENCERRADA">🔴 Encerrada (Fechado)</option>
                            </select>
                        </div>
                        <div><label className="text-[10px] font-black uppercase text-slate-400 tracking-widest mb-1 block">Título</label><input className="w-full p-2 bg-slate-50 border rounded-lg font-bold text-sm" value={config.titulo_futsal || ''} onChange={(e) => setConfig({ ...config, titulo_futsal: e.target.value })} /></div>
                        <div><label className="text-[10px] font-black uppercase text-slate-400 tracking-widest mb-1 block">Descrição</label><textarea className="w-full p-2 bg-slate-50 border rounded-lg font-medium text-sm h-20" value={config.desc_futsal || ''} onChange={(e) => setConfig({ ...config, desc_futsal: e.target.value })} /></div>
                        <div className="grid grid-cols-2 gap-2">
                            <div><label className="text-[10px] font-black uppercase text-slate-400 tracking-widest mb-1 block">Local</label><input className="w-full p-2 bg-slate-50 border rounded-lg font-bold text-sm" value={config.local_futsal || ''} onChange={(e) => setConfig({ ...config, local_futsal: e.target.value })} /></div>
                            <div><label className="text-[10px] font-black uppercase text-slate-400 tracking-widest mb-1 block">Data Início</label><input className="w-full p-2 bg-slate-50 border rounded-lg font-bold text-sm" value={config.inicio_futsal || ''} onChange={(e) => setConfig({ ...config, inicio_futsal: e.target.value })} /></div>
                        </div>
                        <div><label className="text-[10px] font-black uppercase text-slate-400 tracking-widest mb-1 block">Vagas Totais</label><input type="number" className="w-full p-2 bg-slate-50 border rounded-lg font-bold text-sm" value={Number(config.vagas_futsal || 0)} onChange={(e) => setConfig({ ...config, vagas_futsal: Number(e.target.value || 0) })} /></div>
                    </div>
                </div>

                {/* SOCIETY */}
                <div className="bg-white p-8 rounded-[2rem] shadow-sm border border-slate-200 relative overflow-hidden group hover:shadow-md transition-all">
                    <div className="absolute top-0 left-0 w-full h-1 bg-green-500"></div>
                    <h3 className="flex items-center gap-3 font-black uppercase text-green-600 text-sm mb-6 pb-4 border-b border-slate-100">4.2 Society (Suíço)</h3>
                    <div className="space-y-4">
                        <div className="bg-green-50 p-4 rounded-xl border border-green-100">
                            <label className="text-[10px] font-black uppercase text-green-500 tracking-widest mb-1 block">Status Inscrição (Controla o Site)</label>
                            <select className="w-full p-2 bg-white border border-green-200 rounded-lg font-bold text-xs text-green-700 outline-none" value={config.status_society} onChange={(e) => setConfig({...config, status_society: e.target.value})}>
                                <option value="EM_BREVE">🟡 Em Breve (Reserva apenas)</option>
                                <option value="ABERTA">🟢 Aberta (Inscrição Real)</option>
                                <option value="ENCERRADA">🔴 Encerrada (Fechado)</option>
                            </select>
                        </div>
                        <div><label className="text-[10px] font-black uppercase text-slate-400 tracking-widest mb-1 block">Título</label><input className="w-full p-2 bg-slate-50 border rounded-lg font-bold text-sm" value={config.titulo_society || ''} onChange={(e) => setConfig({ ...config, titulo_society: e.target.value })} /></div>
                        <div><label className="text-[10px] font-black uppercase text-slate-400 tracking-widest mb-1 block">Descrição</label><textarea className="w-full p-2 bg-slate-50 border rounded-lg font-medium text-sm h-20" value={config.desc_society || ''} onChange={(e) => setConfig({ ...config, desc_society: e.target.value })} /></div>
                        <div className="grid grid-cols-2 gap-2">
                            <div><label className="text-[10px] font-black uppercase text-slate-400 tracking-widest mb-1 block">Local</label><input className="w-full p-2 bg-slate-50 border rounded-lg font-bold text-sm" value={config.local_society || ''} onChange={(e) => setConfig({ ...config, local_society: e.target.value })} /></div>
                            <div><label className="text-[10px] font-black uppercase text-slate-400 tracking-widest mb-1 block">Data Início</label><input className="w-full p-2 bg-slate-50 border rounded-lg font-bold text-sm" value={config.inicio_society || ''} onChange={(e) => setConfig({ ...config, inicio_society: e.target.value })} /></div>
                        </div>
                        <div><label className="text-[10px] font-black uppercase text-slate-400 tracking-widest mb-1 block">Vagas Totais</label><input type="number" className="w-full p-2 bg-slate-50 border rounded-lg font-bold text-sm" value={Number(config.vagas_society || 0)} onChange={(e) => setConfig({ ...config, vagas_society: Number(e.target.value || 0) })} /></div>
                    </div>
                </div>
            </div>

            {/* SEÇÃO 5: RODAPÉ */}
            <div className="bg-white p-8 rounded-[2rem] shadow-sm border border-slate-200">
                <h3 className="flex items-center gap-3 font-black uppercase text-slate-800 text-sm mb-6 pb-4 border-b border-slate-100">5. Rodapé</h3>
                <div className="grid md:grid-cols-1 gap-6">
                    <div><label className="text-[10px] font-black uppercase text-slate-400 tracking-widest mb-2 block">Texto do Rodapé (Copyright/Info)</label><input className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl font-bold text-sm" value={config.texto_footer || ''} onChange={(e) => setConfig({ ...config, texto_footer: e.target.value })} /></div>
                </div>
            </div>

          </div>
        )}
      </div>
    </main>
  )
}