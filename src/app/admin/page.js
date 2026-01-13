'use client'
import Link from 'next/link'
import { ClipboardList } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import {
  Settings,
  LayoutDashboard,
  Users,
  Trash2,
  CheckCircle,
  Phone,
  Image as ImageIcon,
  AlignLeft,
  LogOut,
} from 'lucide-react'

function onlyDigits(v) {
  return (v || '').toString().replace(/\D/g, '')
}

function isValidBRPhone(raw) {
  const d = onlyDigits(raw)
  // aceita 10 ou 11 dígitos (DDD + número)
  return d.length === 10 || d.length === 11
}

function waLink(rawPhone) {
  const d = onlyDigits(rawPhone)
  if (!d) return null
  return `https://wa.me/55${d}`
}

export default function AdminPanel() {
  const [autenticado, setAutenticado] = useState(false)
  const [senha, setSenha] = useState('')
  const [abaAtiva, setAbaAtiva] = useState('dashboard')
  const [loading, setLoading] = useState(false)
  const [equipes, setEquipes] = useState([])

  const defaultConfig = useMemo(
    () => ({
      id: 1,
      // Identidade
      nome_competicao: '',
      nome_empresa: '',
      logo_url: '/brand/logo-sincroniza.jpg',
      slogan: 'Tecnologia e organização para o esporte local.',
      whatsapp: '',

      texto_empresa: '',
      missao: '',
      valores: '',

      // Status (para botões: INSCRIÇÃO ou RESERVA)
      status_futsal: 'EM_BREVE',
      status_society: 'EM_BREVE',

      // Hero
      titulo_destaque: '',
      subtitulo: '',
      data_limite: '',
      valor_premio: '',
      imagem_fundo: '',
      texto_topo: '',
      titulo_card_hero: '',
      texto_card_hero: '',

      // Futsal
      vagas_futsal: 0,
      local_futsal: '',
      inicio_futsal: '',
      titulo_futsal: '',
      desc_futsal: '',

      // Society
      vagas_society: 0,
      local_society: '',
      inicio_society: '',
      titulo_society: '',
      desc_society: '',

      // Gerais
      titulo_modalidades: '',
      subtitulo_modalidades: '',
      texto_footer: '',
    }),
    []
  )

  const [config, setConfig] = useState(defaultConfig)

  useEffect(() => {
    if (autenticado) carregarTudo()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autenticado])

  async function carregarTudo() {
    try {
      const [cfgRes, teamsRes] = await Promise.all([
        fetch('/api/config'),
        fetch('/api/admin/teams', {
          headers: { 'x-admin-pin': senha },
        }),
      ])

      const cfg = await cfgRes.json().catch(() => null)
      const teams = await teamsRes.json().catch(() => [])

      if (cfg) {
        setConfig({
          ...defaultConfig,
          ...cfg,
          // garante números
          vagas_futsal: Number(cfg.vagas_futsal || 0),
          vagas_society: Number(cfg.vagas_society || 0),
        })
      } else {
        setConfig(defaultConfig)
      }

      setEquipes(Array.isArray(teams) ? teams : [])
    } catch (e) {
      console.error(e)
      alert('Falha ao carregar dados do Admin. Verifique a API / Supabase.')
    }
  }

  function logar() {
    // OBS: isso só protege o FRONT. A segurança real é a API validar o x-admin-pin também.
    if (senha === '2026') setAutenticado(true)
    else alert('Senha Incorreta.')
  }

  function sair() {
    setAutenticado(false)
    setSenha('')
    setAbaAtiva('dashboard')
    setEquipes([])
    setConfig(defaultConfig)
  }

  async function salvarConfig() {
    setLoading(true)
    try {
      const res = await fetch('/api/config', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'x-admin-pin': senha,
        },
        body: JSON.stringify(config),
      })

      if (!res.ok) {
        const msg = await res.text().catch(() => '')
        throw new Error(msg || 'Erro ao salvar config')
      }

      alert('Site Atualizado!')
      await carregarTudo()
    } catch (e) {
      console.error(e)
      alert('Não consegui salvar. Verifique PIN e API / Supabase.')
    } finally {
      setLoading(false)
    }
  }

  async function gerenciarEquipe(id, action) {
    if (!confirm('Confirma essa ação?')) return
    try {
      const res = await fetch('/api/admin/teams', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'x-admin-pin': senha,
        },
        body: JSON.stringify({ id, action }),
      })

      if (!res.ok) {
        const msg = await res.text().catch(() => '')
        throw new Error(msg || 'Erro ao aplicar ação')
      }

      await carregarTudo()
    } catch (e) {
      console.error(e)
      alert('Falha ao executar ação. Verifique a API / permissões.')
    }
  }

  if (!autenticado) {
    return (
      <main className="min-h-screen bg-slate-950 flex items-center justify-center p-6">
        <div className="bg-slate-900 p-10 rounded-2xl border border-slate-800 text-center max-w-sm w-full">
          <h1 className="text-2xl font-black text-white uppercase mb-6">
            Super Admin
          </h1>
          <input
            type="password"
            placeholder="PIN"
            className="w-full p-4 bg-slate-950 border border-slate-800 rounded-xl text-center text-white font-bold text-xl mb-4"
            value={senha}
            onChange={(e) => setSenha(e.target.value)}
          />
          <button
            onClick={logar}
            className="w-full bg-blue-600 text-white font-bold py-4 rounded-xl uppercase"
          >
            Entrar
          </button>
        </div>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-slate-50 flex flex-col md:flex-row">
      <aside className="bg-slate-900 text-white w-full md:w-64 flex-shrink-0 p-6 flex flex-col justify-between">
        <div>
          <div className="flex items-center gap-2 mb-10 text-blue-500">
            <LayoutDashboard size={28} />
            <span className="font-black uppercase text-xl">
              Master<span className="text-white">Panel</span>
            </span>
          </div>

          <nav className="space-y-2">
            <button
              onClick={() => setAbaAtiva('dashboard')}
              className={`w-full text-left p-3 rounded-xl font-bold uppercase text-xs flex gap-3 ${
                abaAtiva === 'dashboard'
                  ? 'bg-blue-600'
                  : 'hover:bg-slate-800'
              }`}
            >
              <Users size={16} /> Auditoria
            </button>

            <button
              onClick={() => setAbaAtiva('config')}
              className={`w-full text-left p-3 rounded-xl font-bold uppercase text-xs flex gap-3 ${
                abaAtiva === 'config' ? 'bg-blue-600' : 'hover:bg-slate-800'
              }`}
            >
              <Settings size={16} /> Editar Site
            </button>
          </nav>
        </div>

        <Link
  href="/admin/jogos"
  className="w-full text-left p-3 rounded-xl font-bold uppercase text-xs flex gap-3 hover:bg-slate-800 text-white"
>
  <ClipboardList size={16} /> Jogos / Súmula
</Link>


        <button
          onClick={sair}
          className="mt-8 w-full text-left p-3 rounded-xl font-bold uppercase text-xs flex gap-3 hover:bg-slate-800 text-slate-300"
        >
          <LogOut size={16} /> Sair
        </button>
      </aside>

      <div className="flex-1 p-6 md:p-10 overflow-y-auto">
        {abaAtiva === 'dashboard' && (
          <div className="max-w-6xl mx-auto">
            <h2 className="text-3xl font-black uppercase text-slate-900 mb-8">
              Auditoria
            </h2>

            <div className="bg-white rounded-2xl shadow-lg border border-slate-200 overflow-hidden">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-100 uppercase font-black text-xs text-slate-500">
                  <tr>
                    <th className="p-4">Equipe</th>
                    <th className="p-4">Login</th>
                    <th className="p-4">WhatsApp</th>
                    <th className="p-4">Status</th>
                    <th className="p-4 text-right">Ação</th>
                  </tr>
                </thead>
                <tbody>
                  {equipes.map((eq) => {
                    const hasPhone = isValidBRPhone(eq.whatsapp)
                    const link = hasPhone ? waLink(eq.whatsapp) : null

                    return (
                      <tr key={eq.id} className="border-b hover:bg-slate-50">
                        <td className="p-4 font-bold">{eq.nome_equipe}</td>

                        <td className="p-4">
                          <div className="font-bold">{eq.email}</div>
                          <div className="text-xs text-slate-400">
                            {/* Não exibir senha */}
                            Acesso via redefinição (recomendado)
                          </div>
                        </td>

                        <td className="p-4">
                          {link ? (
                            <a
                              href={link}
                              target="_blank"
                              rel="noreferrer"
                              className="text-green-600 font-bold flex gap-1 items-center"
                            >
                              <Phone size={12} /> {eq.whatsapp}
                            </a>
                          ) : (
                            <span className="text-slate-400 font-semibold">
                              —
                            </span>
                          )}
                        </td>

                        <td className="p-4">
                          {eq.pago ? (
                            <span className="text-green-600 font-bold">Pago</span>
                          ) : (
                            <span className="text-red-400 font-bold">
                              Pendente
                            </span>
                          )}
                        </td>

                        <td className="p-4 text-right">
                          <div className="flex justify-end gap-2">
                            {!eq.pago && (
                              <button
                                onClick={() => gerenciarEquipe(eq.id, 'approve')}
                                className="p-2 bg-blue-100 text-blue-600 rounded"
                                title="Aprovar pagamento"
                              >
                                <CheckCircle size={16} />
                              </button>
                            )}
                            <button
                              onClick={() => gerenciarEquipe(eq.id, 'delete')}
                              className="p-2 bg-red-100 text-red-600 rounded"
                              title="Excluir equipe"
                            >
                              <Trash2 size={16} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {abaAtiva === 'config' && (
          <div className="max-w-4xl mx-auto space-y-6">
            <h2 className="text-3xl font-black uppercase text-slate-900">
              Editar Todo o Site
            </h2>

            {/* 0. IDENTIDADE / EMPRESA */}
            <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-200">
              <h3 className="flex items-center gap-2 font-black uppercase text-slate-600 text-xs tracking-widest mb-4 pb-2 border-b">
                <ImageIcon size={14} /> Identidade & Empresa
              </h3>

              <div className="grid md:grid-cols-2 gap-4">
                <div className="md:col-span-2">
                  <label className="text-xs font-bold uppercase tracking-wider text-slate-500">
                    Logo (URL)
                  </label>
                  <input
                    className="mt-2 w-full p-3 rounded-xl border bg-slate-50"
                    value={config.logo_url || ''}
                    onChange={(e) =>
                      setConfig({ ...config, logo_url: e.target.value })
                    }
                    placeholder="/brand/logo-sincroniza.jpg"
                  />
                  <p className="mt-2 text-[11px] text-slate-400">
                    Se usar a imagem padrão do projeto, deixe:{' '}
                    <b>/brand/logo-sincroniza.jpg</b>
                  </p>
                </div>

                <div>
                  <label className="text-xs font-bold uppercase tracking-wider text-slate-500">
                    Nome da Competição
                  </label>
                  <input
                    className="mt-2 w-full p-3 rounded-xl border bg-slate-50"
                    value={config.nome_competicao || ''}
                    onChange={(e) =>
                      setConfig({ ...config, nome_competicao: e.target.value })
                    }
                  />
                </div>

                <div>
                  <label className="text-xs font-bold uppercase tracking-wider text-slate-500">
                    Nome da Empresa
                  </label>
                  <input
                    className="mt-2 w-full p-3 rounded-xl border bg-slate-50"
                    value={config.nome_empresa || ''}
                    onChange={(e) =>
                      setConfig({ ...config, nome_empresa: e.target.value })
                    }
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="text-xs font-bold uppercase tracking-wider text-slate-500">
                    Slogan
                  </label>
                  <input
                    className="mt-2 w-full p-3 rounded-xl border bg-slate-50"
                    value={config.slogan || ''}
                    onChange={(e) =>
                      setConfig({ ...config, slogan: e.target.value })
                    }
                    placeholder="Tecnologia e organização para o esporte local."
                  />
                </div>

                <div>
                  <label className="text-xs font-bold uppercase tracking-wider text-slate-500">
                    WhatsApp (opcional)
                  </label>
                  <input
                    className="mt-2 w-full p-3 rounded-xl border bg-slate-50"
                    value={config.whatsapp || ''}
                    onChange={(e) =>
                      setConfig({ ...config, whatsapp: e.target.value })
                    }
                    placeholder="Ex.: 47999999999"
                  />
                  <p className="mt-2 text-[11px] text-slate-400">
                    Ainda sem número? Pode deixar em branco.
                  </p>
                </div>

                <div>
                  <label className="text-xs font-bold uppercase tracking-wider text-slate-500">
                    Status Futsal
                  </label>
                  <select
                    className="mt-2 w-full p-3 rounded-xl border bg-slate-50"
                    value={config.status_futsal || 'EM_BREVE'}
                    onChange={(e) =>
                      setConfig({ ...config, status_futsal: e.target.value })
                    }
                  >
                    <option value="EM_BREVE">EM BREVE (Reserva)</option>
                    <option value="ABERTA">ABERTA (Inscrição)</option>
                    <option value="ENCERRADA">ENCERRADA</option>
                  </select>
                </div>

                <div>
                  <label className="text-xs font-bold uppercase tracking-wider text-slate-500">
                    Status Suíço
                  </label>
                  <select
                    className="mt-2 w-full p-3 rounded-xl border bg-slate-50"
                    value={config.status_society || 'EM_BREVE'}
                    onChange={(e) =>
                      setConfig({ ...config, status_society: e.target.value })
                    }
                  >
                    <option value="EM_BREVE">EM BREVE (Reserva)</option>
                    <option value="ABERTA">ABERTA (Inscrição)</option>
                    <option value="ENCERRADA">ENCERRADA</option>
                  </select>
                </div>

                <div className="md:col-span-2">
                  <label className="text-xs font-bold uppercase tracking-wider text-slate-500">
                    Texto da Empresa
                  </label>
                  <textarea
                    className="mt-2 w-full p-3 rounded-xl border bg-slate-50 min-h-[90px]"
                    value={config.texto_empresa || ''}
                    onChange={(e) =>
                      setConfig({ ...config, texto_empresa: e.target.value })
                    }
                  />
                </div>

                <div>
                  <label className="text-xs font-bold uppercase tracking-wider text-slate-500">
                    Missão
                  </label>
                  <textarea
                    className="mt-2 w-full p-3 rounded-xl border bg-slate-50 min-h-[90px]"
                    value={config.missao || ''}
                    onChange={(e) =>
                      setConfig({ ...config, missao: e.target.value })
                    }
                  />
                </div>

                <div>
                  <label className="text-xs font-bold uppercase tracking-wider text-slate-500">
                    Valores
                  </label>
                  <textarea
                    className="mt-2 w-full p-3 rounded-xl border bg-slate-50 min-h-[90px]"
                    value={config.valores || ''}
                    onChange={(e) =>
                      setConfig({ ...config, valores: e.target.value })
                    }
                  />
                </div>
              </div>
            </div>

            {/* 1. HERO */}
            <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-200">
              <h3 className="flex items-center gap-2 font-black uppercase text-slate-400 text-xs mb-4 pb-2 border-b">
                <ImageIcon size={14} /> Topo e Apresentação
              </h3>
              <div className="grid md:grid-cols-2 gap-4">
                <div className="md:col-span-2">
                  <label className="text-xs font-bold uppercase text-slate-500">
                    URL Imagem Fundo
                  </label>
                  <input
                    className="w-full p-3 rounded-xl border bg-slate-50"
                    value={config.imagem_fundo || ''}
                    onChange={(e) =>
                      setConfig({ ...config, imagem_fundo: e.target.value })
                    }
                  />
                </div>

                <div>
                  <label className="text-xs font-bold uppercase text-slate-500">
                    Texto Topo
                  </label>
                  <input
                    className="w-full p-3 rounded-xl border bg-slate-50"
                    value={config.texto_topo || ''}
                    onChange={(e) =>
                      setConfig({ ...config, texto_topo: e.target.value })
                    }
                  />
                </div>

                <div>
                  <label className="text-xs font-bold uppercase text-slate-500">
                    Data Limite
                  </label>
                  <input
                    className="w-full p-3 rounded-xl border bg-slate-50"
                    value={config.data_limite || ''}
                    onChange={(e) =>
                      setConfig({ ...config, data_limite: e.target.value })
                    }
                  />
                </div>

                <div>
                  <label className="text-xs font-bold uppercase text-slate-500">
                    Título Principal
                  </label>
                  <input
                    className="w-full p-3 rounded-xl border bg-slate-50"
                    value={config.titulo_destaque || ''}
                    onChange={(e) =>
                      setConfig({ ...config, titulo_destaque: e.target.value })
                    }
                  />
                </div>

                <div>
                  <label className="text-xs font-bold uppercase text-slate-500">
                    Subtítulo
                  </label>
                  <textarea
                    className="w-full p-3 rounded-xl border bg-slate-50 min-h-[90px]"
                    value={config.subtitulo || ''}
                    onChange={(e) =>
                      setConfig({ ...config, subtitulo: e.target.value })
                    }
                  />
                </div>

                <div>
                  <label className="text-xs font-bold uppercase text-slate-500">
                    Valor Prêmio (R$)
                  </label>
                  <input
                    className="w-full p-3 rounded-xl border bg-slate-50 font-black text-green-700"
                    value={config.valor_premio || ''}
                    onChange={(e) =>
                      setConfig({ ...config, valor_premio: e.target.value })
                    }
                  />
                </div>
              </div>
            </div>

            {/* 2. FUTSAL */}
            <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-200">
              <h3 className="flex items-center gap-2 font-black uppercase text-blue-600 text-xs mb-4 pb-2 border-b">
                <AlignLeft size={14} /> Modalidade 1 (Futsal)
              </h3>
              <div className="grid md:grid-cols-2 gap-4">
                <div className="md:col-span-2">
                  <label className="text-xs font-bold uppercase text-slate-500">
                    Título do Card
                  </label>
                  <input
                    className="w-full p-3 rounded-xl border bg-slate-50"
                    value={config.titulo_futsal || ''}
                    onChange={(e) =>
                      setConfig({ ...config, titulo_futsal: e.target.value })
                    }
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="text-xs font-bold uppercase text-slate-500">
                    Descrição
                  </label>
                  <textarea
                    className="w-full p-3 rounded-xl border bg-slate-50 min-h-[90px]"
                    value={config.desc_futsal || ''}
                    onChange={(e) =>
                      setConfig({ ...config, desc_futsal: e.target.value })
                    }
                  />
                </div>

                <div>
                  <label className="text-xs font-bold uppercase text-slate-500">
                    Local
                  </label>
                  <input
                    className="w-full p-3 rounded-xl border bg-slate-50"
                    value={config.local_futsal || ''}
                    onChange={(e) =>
                      setConfig({ ...config, local_futsal: e.target.value })
                    }
                  />
                </div>

                <div>
                  <label className="text-xs font-bold uppercase text-slate-500">
                    Data Início
                  </label>
                  <input
                    className="w-full p-3 rounded-xl border bg-slate-50"
                    value={config.inicio_futsal || ''}
                    onChange={(e) =>
                      setConfig({ ...config, inicio_futsal: e.target.value })
                    }
                  />
                </div>

                <div>
                  <label className="text-xs font-bold uppercase text-slate-500">
                    Vagas
                  </label>
                  <input
                    type="number"
                    className="w-full p-3 rounded-xl border bg-slate-50"
                    value={Number(config.vagas_futsal || 0)}
                    onChange={(e) =>
                      setConfig({
                        ...config,
                        vagas_futsal: Number(e.target.value || 0),
                      })
                    }
                  />
                </div>
              </div>
            </div>

            {/* 3. SUÍÇO */}
            <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-200">
              <h3 className="flex items-center gap-2 font-black uppercase text-green-600 text-xs mb-4 pb-2 border-b">
                <AlignLeft size={14} /> Modalidade 2 (Suíço)
              </h3>
              <div className="grid md:grid-cols-2 gap-4">
                <div className="md:col-span-2">
                  <label className="text-xs font-bold uppercase text-slate-500">
                    Título do Card
                  </label>
                  <input
                    className="w-full p-3 rounded-xl border bg-slate-50"
                    value={config.titulo_society || ''}
                    onChange={(e) =>
                      setConfig({ ...config, titulo_society: e.target.value })
                    }
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="text-xs font-bold uppercase text-slate-500">
                    Descrição
                  </label>
                  <textarea
                    className="w-full p-3 rounded-xl border bg-slate-50 min-h-[90px]"
                    value={config.desc_society || ''}
                    onChange={(e) =>
                      setConfig({ ...config, desc_society: e.target.value })
                    }
                  />
                </div>

                <div>
                  <label className="text-xs font-bold uppercase text-slate-500">
                    Local
                  </label>
                  <input
                    className="w-full p-3 rounded-xl border bg-slate-50"
                    value={config.local_society || ''}
                    onChange={(e) =>
                      setConfig({ ...config, local_society: e.target.value })
                    }
                  />
                </div>

                <div>
                  <label className="text-xs font-bold uppercase text-slate-500">
                    Data Início
                  </label>
                  <input
                    className="w-full p-3 rounded-xl border bg-slate-50"
                    value={config.inicio_society || ''}
                    onChange={(e) =>
                      setConfig({ ...config, inicio_society: e.target.value })
                    }
                  />
                </div>

                <div>
                  <label className="text-xs font-bold uppercase text-slate-500">
                    Vagas
                  </label>
                  <input
                    type="number"
                    className="w-full p-3 rounded-xl border bg-slate-50"
                    value={Number(config.vagas_society || 0)}
                    onChange={(e) =>
                      setConfig({
                        ...config,
                        vagas_society: Number(e.target.value || 0),
                      })
                    }
                  />
                </div>
              </div>
            </div>

            {/* 4. RODAPÉ */}
            <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-200">
              <h3 className="flex items-center gap-2 font-black uppercase text-slate-400 text-xs mb-4 pb-2 border-b">
                <Settings size={14} /> Rodapé e Seções
              </h3>
              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-bold uppercase text-slate-500">
                    Título Seção Modalidades
                  </label>
                  <input
                    className="w-full p-3 rounded-xl border bg-slate-50"
                    value={config.titulo_modalidades || ''}
                    onChange={(e) =>
                      setConfig({ ...config, titulo_modalidades: e.target.value })
                    }
                  />
                </div>

                <div>
                  <label className="text-xs font-bold uppercase text-slate-500">
                    Subtítulo Seção Modalidades
                  </label>
                  <input
                    className="w-full p-3 rounded-xl border bg-slate-50"
                    value={config.subtitulo_modalidades || ''}
                    onChange={(e) =>
                      setConfig({
                        ...config,
                        subtitulo_modalidades: e.target.value,
                      })
                    }
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="text-xs font-bold uppercase text-slate-500">
                    Texto do Rodapé
                  </label>
                  <input
                    className="w-full p-3 rounded-xl border bg-slate-50"
                    value={config.texto_footer || ''}
                    onChange={(e) =>
                      setConfig({ ...config, texto_footer: e.target.value })
                    }
                  />
                </div>
              </div>
            </div>

            <button
              onClick={salvarConfig}
              disabled={loading}
              className="w-full bg-slate-900 text-white font-black py-4 rounded-xl uppercase shadow-lg hover:scale-[1.01] transition-transform disabled:opacity-60"
            >
              {loading ? 'Salvando...' : 'Salvar Alterações'}
            </button>
          </div>
        )}
      </div>
    </main>
  )
}
