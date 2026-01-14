'use client'

import { useState } from 'react'
import { UserPlus, Users, ArrowLeft, Mail, Lock } from 'lucide-react'
import Link from 'next/link'

async function safeJson(res) {
  try {
    return await res.json()
  } catch {
    const txt = await res.text().catch(() => '')
    return { error: txt || `Erro ${res.status}` }
  }
}

export default function PainelCapitao() {
  const [acessoLiberado, setAcessoLiberado] = useState(false)

  // Login
  const [emailBusca, setEmailBusca] = useState('')
  const [senhaBusca, setSenhaBusca] = useState('')
  const [loading, setLoading] = useState(false)

  // Painel
  const [equipe, setEquipe] = useState(null)
  const [atletas, setAtletas] = useState([])

  // Novo atleta
  const [novoAtleta, setNovoAtleta] = useState({ nome: '', rg: '', camisa: '' })

  async function acessarPainel() {
    if (!emailBusca || !senhaBusca) return alert('Digite e-mail e senha!')

    setLoading(true)
    try {
      const res = await fetch('/api/capitao/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: emailBusca.trim(),
          senha: senhaBusca,
        }),
      })

      const data = await safeJson(res)

      if (!res.ok || !data?.ok) {
        alert(data?.error || 'E-mail ou senha incorretos!')
        setLoading(false)
        return
      }

      setEquipe(data.equipe)
      setAcessoLiberado(true)
      await carregarAtletas(data.equipe.id)
    } catch (e) {
      console.error(e)
      alert('Erro de conexão.')
    }
    setLoading(false)
  }

  async function carregarAtletas(equipeId) {
    try {
      const res = await fetch(`/api/atletas?equipe_id=${equipeId}`)
      const data = await safeJson(res)

      if (!res.ok) {
        console.error('Erro /api/atletas:', data)
        alert(data?.error || 'Erro ao carregar atletas.')
        setAtletas([])
        return
      }

      setAtletas(Array.isArray(data) ? data : [])
    } catch (e) {
      console.error(e)
      alert('Falha ao carregar atletas.')
      setAtletas([])
    }
  }

  async function adicionarAtleta(e) {
    e.preventDefault()
    if (!novoAtleta.nome || !novoAtleta.rg) return alert('Preencha Nome e RG')
    if (!equipe?.id) return alert('Equipe inválida. Faça login novamente.')

    setLoading(true)
    try {
      const res = await fetch('/api/atletas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nome: novoAtleta.nome,
          rg: novoAtleta.rg,
          camisa: novoAtleta.camisa,
          equipe_id: equipe.id,
        }),
      })

      const data = await safeJson(res)

      if (!res.ok) {
        alert(data?.error || 'Erro ao salvar atleta')
        setLoading(false)
        return
      }

      setNovoAtleta({ nome: '', rg: '', camisa: '' })
      await carregarAtletas(equipe.id)
    } catch (e) {
      console.error(e)
      alert('Falha ao salvar atleta.')
    }
    setLoading(false)
  }

  if (!acessoLiberado) {
    return (
      <main className="min-h-screen bg-slate-900 flex items-center justify-center p-6">
        <div className="bg-white p-10 rounded-3xl max-w-md w-full shadow-2xl">
          <div className="text-center mb-8">
            <Users size={48} className="mx-auto text-blue-600 mb-4" />
            <h1 className="text-2xl font-black uppercase text-slate-900">
              Acesso do Capitão
            </h1>
            <p className="text-slate-500 text-sm">
              Use o e-mail cadastrado na inscrição.
            </p>
          </div>

          <div className="space-y-4">
            <div className="relative">
              <Mail
                className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400"
                size={18}
              />
              <input
                type="email"
                placeholder="E-mail do Capitão"
                className="w-full p-4 pl-12 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-900 outline-none focus:border-blue-600"
                value={emailBusca}
                onChange={(e) => setEmailBusca(e.target.value)}
              />
            </div>

            <div className="relative">
              <Lock
                className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400"
                size={18}
              />
              <input
                type="password"
                placeholder="Senha de Acesso"
                className="w-full p-4 pl-12 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-900 outline-none focus:border-blue-600"
                value={senhaBusca}
                onChange={(e) => setSenhaBusca(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') acessarPainel()
                }}
              />
            </div>

            <button
              onClick={acessarPainel}
              disabled={loading}
              className="w-full bg-blue-600 text-white font-black py-4 rounded-xl hover:bg-blue-700 transition-all uppercase tracking-widest disabled:opacity-60"
            >
              {loading ? 'Verificando...' : 'Entrar'}
            </button>

            <Link
              href="/"
              className="flex items-center justify-center gap-2 text-xs font-bold text-slate-400 hover:text-slate-600 mt-4 uppercase"
            >
              <ArrowLeft size={12} /> Voltar para Home
            </Link>
          </div>
        </div>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-slate-50 py-10 px-4 md:px-10">
      <div className="max-w-4xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-black uppercase italic text-slate-900">
              {equipe?.nome_equipe || 'Equipe'}
            </h1>
            <p className="text-slate-500 font-bold uppercase text-xs">
              Gestão de Elenco 2026
            </p>
          </div>
          <div className="text-right">
            <p className="text-[10px] font-black uppercase text-slate-400">
              Vagas
            </p>
            <p className="text-2xl font-black text-blue-600">
              {(Array.isArray(atletas) ? atletas.length : 0)}{' '}
              <span className="text-slate-300 text-lg">/ 15</span>
            </p>
          </div>
        </div>

        <div className="grid md:grid-cols-3 gap-8">
          <div className="md:col-span-1">
            <div className="bg-white p-6 rounded-3xl shadow-lg border border-slate-200 sticky top-10">
              <h2 className="flex items-center gap-2 font-black uppercase text-sm text-slate-900 mb-6">
                <UserPlus size={18} className="text-blue-600" /> Novo Atleta
              </h2>

              <form onSubmit={adicionarAtleta} className="space-y-4">
                <input
                  className="w-full p-3 bg-slate-50 border rounded-lg font-bold text-sm"
                  placeholder="Nome Completo"
                  value={novoAtleta.nome}
                  onChange={(e) =>
                    setNovoAtleta({ ...novoAtleta, nome: e.target.value })
                  }
                />
                <input
                  className="w-full p-3 bg-slate-50 border rounded-lg font-bold text-sm"
                  placeholder="RG / CPF"
                  value={novoAtleta.rg}
                  onChange={(e) =>
                    setNovoAtleta({ ...novoAtleta, rg: e.target.value })
                  }
                />
                <input
                  className="w-full p-3 bg-slate-50 border rounded-lg font-bold text-sm"
                  placeholder="Camisa (Nº)"
                  type="number"
                  value={novoAtleta.camisa}
                  onChange={(e) =>
                    setNovoAtleta({ ...novoAtleta, camisa: e.target.value })
                  }
                />

                <button
                  disabled={loading || (Array.isArray(atletas) ? atletas.length : 0) >= 15}
                  className="w-full bg-green-500 text-white font-black py-3 rounded-xl hover:bg-green-600 uppercase text-xs tracking-widest disabled:opacity-50"
                >
                  {loading ? 'Salvando...' : '+ Adicionar'}
                </button>
              </form>
            </div>
          </div>

          <div className="md:col-span-2 space-y-3">
            {(Array.isArray(atletas) ? atletas : []).length === 0 ? (
              <p className="text-center text-slate-400 font-bold py-10">
                Nenhum atleta cadastrado.
              </p>
            ) : (
              (Array.isArray(atletas) ? atletas : []).map((atleta) => (
                <div
                  key={atleta.id}
                  className="bg-white p-4 rounded-2xl border border-slate-200 flex justify-between items-center shadow-sm"
                >
                  <div className="flex items-center gap-4">
                    <div className="h-10 w-10 bg-slate-100 rounded-full flex items-center justify-center font-black text-slate-500">
                      {atleta.numero_camisa || '-'}
                    </div>
                    <div>
                      <p className="font-bold text-slate-900 uppercase">
                        {atleta.nome}
                      </p>
                      <p className="text-xs text-slate-400 font-bold">
                        RG: {atleta.rg}
                      </p>
                    </div>
                  </div>
                  <span className="text-[10px] bg-green-100 text-green-700 px-3 py-1 rounded-full font-black uppercase">
                    Regular
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </main>
  )
}
