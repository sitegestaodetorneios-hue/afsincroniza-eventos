'use client'

import { useState, useEffect, useMemo } from 'react'
import {
  ArrowLeft,
  CreditCard,
  ShieldCheck,
  Copy,
  CheckCircle,
  Loader2,
  Lock,
  Mail,
  Phone,
  Info,
} from 'lucide-react'
import Link from 'next/link'

function onlyDigits(v) {
  return (v || '').toString().replace(/\D/g, '')
}

function waLink(rawPhone, text) {
  const digits = onlyDigits(rawPhone)
  const msg = encodeURIComponent(text || '')
  if (!digits) return null
  return `https://wa.me/55${digits}${msg ? `?text=${msg}` : ''}`
}

export default function Inscricao() {
  const [step, setStep] = useState(1)
  const [loading, setLoading] = useState(false)
  const [pixData, setPixData] = useState(null)
  const [pagamentoAprovado, setPagamentoAprovado] = useState(false)

  const [siteData, setSiteData] = useState(null)

  // ✅ DEV PIN (funciona em produção também)
  const [devPin, setDevPin] = useState('')

  const [form, setForm] = useState({
    nome_equipe: '',
    cidade: '',
    nome_capitao: '',
    whatsapp: '',
    email: '',
    senha: '',
  })

  // Busca config do site
  useEffect(() => {
    fetch('/api/config')
      .then((r) => r.json())
      .then((d) => setSiteData(d || {}))
      .catch(() => setSiteData({}))
  }, [])

  const competencia = useMemo(() => {
    return siteData?.nome_competicao || 'Taça Pérolas do Vale do Itajaí'
  }, [siteData])

  const empresa = useMemo(() => {
    return siteData?.nome_empresa || 'A&F Sincroniza Eventos Esportivos'
  }, [siteData])

  const slogan = useMemo(() => {
    return siteData?.slogan || 'Tecnologia e organização para o esporte local.'
  }, [siteData])

  const inscricoesAbertas = useMemo(() => {
    const f = (siteData?.status_futsal || 'EM_BREVE').toUpperCase()
    const s = (siteData?.status_society || 'EM_BREVE').toUpperCase()
    return f === 'ABERTA' || s === 'ABERTA'
  }, [siteData])

  const whatsNumber = siteData?.whatsapp || ''
  const reserveMsg = `Olá! Quero reservar vaga na ${competencia}. Minha cidade é ____ e minha equipe é _____.`

  // Monitora status do pagamento (polling)
  useEffect(() => {
    let intervalo
    if (pixData && pixData.id && !pagamentoAprovado) {
      intervalo = setInterval(async () => {
        try {
          const res = await fetch(`/api/status?id=${pixData.id}`)
          const data = await res.json()
          if (data.status === 'approved') {
            setPagamentoAprovado(true)
            clearInterval(intervalo)
          }
        } catch (error) {
          console.error(error)
        }
      }, 5000)
    }
    return () => clearInterval(intervalo)
  }, [pixData, pagamentoAprovado])

  async function salvarEquipe() {
    if (!inscricoesAbertas) {
      alert('Inscrições ainda não estão abertas. Faça a reserva de vaga.')
      return
    }

    if (!form.nome_equipe || !form.nome_capitao || !form.whatsapp || !form.email || !form.senha) {
      alert('Por favor, preencha TODOS os campos!')
      return
    }

    const emailOk = /^\S+@\S+\.\S+$/.test(form.email)
    if (!emailOk) {
      alert('Digite um e-mail válido.')
      return
    }

    const phoneDigits = onlyDigits(form.whatsapp)
    if (phoneDigits.length < 10) {
      alert('WhatsApp inválido. Informe DDD + número.')
      return
    }

    setLoading(true)
    try {
      const payload = { ...form, whatsapp: phoneDigits }

      const res = await fetch('/api/equipes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      if (res.ok) {
        setStep(2)
      } else {
        const msg = await res.text().catch(() => '')
        alert(msg || 'Erro ao salvar. Verifique se o nome da equipe já existe.')
      }
    } catch (error) {
      alert('Erro de conexão.')
    }
    setLoading(false)
  }

  async function gerarPix() {
    setLoading(true)
    try {
      const res = await fetch('/api/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nome_equipe: form.nome_equipe,
          nome_capitao: form.nome_capitao,
          email: form.email,
        }),
      })
      const data = await res.json()
      if (data.qr_code_base64) setPixData(data)
      else alert(data?.error || 'Não consegui gerar o Pix. Tente novamente.')
    } catch (error) {
      alert('Erro ao gerar Pix')
    }
    setLoading(false)
  }

  // Confirmação
  if (pagamentoAprovado) {
    return (
      <main className="min-h-screen bg-green-600 flex items-center justify-center p-6 text-white text-center">
        <div className="max-w-md w-full bg-white text-slate-900 p-10 rounded-[2rem] shadow-2xl">
          <div className="w-24 h-24 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <CheckCircle size={48} className="text-green-600" />
          </div>

          <h1 className="text-3xl font-black uppercase italic mb-2">Inscrição Confirmada!</h1>
          <p className="text-slate-500 mb-6">
            Sua equipe <strong>{form.nome_equipe}</strong> está dentro.
          </p>

          <div className="bg-slate-100 p-4 rounded-xl mb-6 text-left">
            <p className="text-xs font-bold text-slate-500 uppercase">Dados de Acesso:</p>
            <p className="text-sm text-slate-900">
              <strong>Login:</strong> {form.email}
            </p>
            <p className="text-sm text-slate-900">
              <strong>Senha:</strong> definida por você (não exibimos por segurança)
            </p>
          </div>

          <Link href="/painel-capitao">
            <button className="w-full bg-slate-900 text-white font-bold py-4 rounded-xl hover:bg-slate-800">
              ACESSAR PAINEL DA EQUIPE
            </button>
          </Link>
        </div>
      </main>
    )
  }

  // Loading config
  if (!siteData) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center gap-4">
        <Loader2 className="animate-spin text-blue-600" size={48} />
        <p className="text-slate-400 font-bold uppercase tracking-widest text-xs animate-pulse">
          Carregando…
        </p>
      </div>
    )
  }

  // Reserva (inscrição fechada)
  if (!inscricoesAbertas) {
    const link = waLink(whatsNumber, reserveMsg)

    return (
      <main className="min-h-screen bg-slate-50 py-12 px-6">
        <div className="max-w-2xl mx-auto">
          <Link
            href="/"
            className="inline-flex items-center gap-2 text-slate-500 hover:text-blue-600 mb-8 font-bold text-sm uppercase tracking-wider transition-colors"
          >
            <ArrowLeft size={16} /> Voltar para Home
          </Link>

          <div className="bg-white rounded-[2rem] shadow-xl border border-slate-200 overflow-hidden">
            <div className="bg-slate-900 p-8 text-white">
              <h1 className="text-2xl font-black uppercase italic tracking-tighter">Reserva de Vaga</h1>
              <p className="text-slate-300 text-xs font-bold uppercase mt-1">{competencia}</p>
            </div>

            <div className="p-8 md:p-12 space-y-6">
              <div className="flex items-start gap-3 bg-amber-50 border border-amber-100 p-4 rounded-2xl">
                <Info className="text-amber-600 mt-0.5" size={18} />
                <div>
                  <p className="font-black text-slate-900">Inscrições ainda não estão abertas</p>
                  <p className="text-slate-600 text-sm font-medium">
                    Faça o pré-agendamento (reserva). Quando abrirmos, a organização entra em contato primeiro com você.
                  </p>
                </div>
              </div>

              <div className="bg-slate-50 border border-slate-200 rounded-2xl p-5">
                <p className="text-xs font-black uppercase tracking-widest text-slate-500 mb-2">Organização</p>
                <p className="text-slate-900 font-black">{empresa}</p>
                <p className="text-slate-500 text-sm font-medium mt-1">{slogan}</p>
              </div>

              {link ? (
                <a href={link} target="_blank" rel="noreferrer">
                  <button className="w-full bg-slate-900 text-white font-black py-5 rounded-xl uppercase tracking-widest hover:bg-blue-600 transition-all">
                    RESERVAR VAGA NO WHATSAPP
                  </button>
                </a>
              ) : (
                <div className="bg-slate-50 border border-slate-200 rounded-2xl p-5">
                  <p className="text-slate-700 font-bold">Ainda sem WhatsApp oficial cadastrado.</p>
                  <p className="text-slate-500 text-sm font-medium">
                    Assim que o número for definido, a reserva será feita por aqui.
                  </p>
                </div>
              )}

              <Link href="/regulamento">
                <button className="w-full bg-white text-slate-900 border-2 border-slate-200 font-bold py-4 rounded-xl hover:bg-slate-50 transition-all">
                  Ver Regulamento
                </button>
              </Link>
            </div>

            <div className="bg-slate-50 p-4 text-center border-t border-slate-200">
              <p className="text-[10px] text-slate-400 font-bold uppercase flex items-center justify-center gap-2">
                <ShieldCheck size={12} /> {empresa}
              </p>
            </div>
          </div>
        </div>
      </main>
    )
  }

  // Fluxo normal
  return (
    <main className="min-h-screen bg-slate-50 py-12 px-6">
      <div className="max-w-2xl mx-auto">
        <Link
          href="/"
          className="inline-flex items-center gap-2 text-slate-500 hover:text-blue-600 mb-8 font-bold text-sm uppercase tracking-wider transition-colors"
        >
          <ArrowLeft size={16} /> Voltar para Home
        </Link>

        <div className="bg-white rounded-[2rem] shadow-xl border border-slate-200 overflow-hidden">
          <div className="bg-slate-900 p-8 text-white flex justify-between items-center">
            <div>
              <h1 className="text-2xl font-black uppercase italic tracking-tighter">Inscrição Oficial</h1>
              <p className="text-slate-400 text-xs font-bold uppercase mt-1">{competencia}</p>
              <p className="text-slate-500 text-[10px] font-bold uppercase mt-1">{empresa}</p>
            </div>
            <div className="h-10 w-10 bg-green-500 rounded-full flex items-center justify-center text-slate-900 font-black">
              {step}
            </div>
          </div>

          <div className="p-8 md:p-12">
            {step === 1 ? (
              <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-500">
                <div className="grid md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Nome da Equipe</label>
                    <input
                      type="text"
                      autoComplete="organization"
                      className="w-full p-4 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-800 outline-none focus:border-blue-600 focus:bg-white transition-all"
                      placeholder="Ex: Pérolas FC"
                      onChange={(e) => setForm({ ...form, nome_equipe: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Cidade</label>
                    <input
                      type="text"
                      autoComplete="address-level2"
                      className="w-full p-4 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-800 outline-none focus:border-blue-600 focus:bg-white transition-all"
                      placeholder="Ex: Itajaí"
                      onChange={(e) => setForm({ ...form, cidade: e.target.value })}
                    />
                  </div>
                </div>

                <div className="grid md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Nome Capitão</label>
                    <input
                      type="text"
                      autoComplete="name"
                      className="w-full p-4 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-800 outline-none focus:border-blue-600 focus:bg-white transition-all"
                      placeholder="Nome Completo"
                      onChange={(e) => setForm({ ...form, nome_capitao: e.target.value })}
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase text-blue-600 tracking-widest flex items-center gap-1">
                      <Mail size={12} /> E-mail (Seu Login)
                    </label>
                    <input
                      type="email"
                      autoComplete="email"
                      className="w-full p-4 bg-blue-50 border border-blue-200 rounded-xl font-bold text-slate-800 outline-none focus:border-blue-600 transition-all"
                      placeholder="exemplo@gmail.com"
                      onChange={(e) => setForm({ ...form, email: e.target.value })}
                    />
                    <p className="text-[9px] text-slate-400 font-bold uppercase">Este e-mail será usado para acessar o painel.</p>
                  </div>
                </div>

                <div className="grid md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest flex items-center gap-1">
                      <Phone size={10} /> WhatsApp
                    </label>
                    <input
                      type="tel"
                      autoComplete="tel"
                      className="w-full p-4 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-800 outline-none focus:border-blue-600 focus:bg-white transition-all"
                      placeholder="(47) 99999-9999"
                      onChange={(e) => setForm({ ...form, whatsapp: e.target.value })}
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase text-blue-600 tracking-widest flex items-center gap-1">
                      <Lock size={12} /> Senha de Acesso
                    </label>
                    <input
                      type="password"
                      autoComplete="new-password"
                      className="w-full p-4 bg-blue-50 border border-blue-200 rounded-xl font-bold text-slate-800 outline-none focus:border-blue-600 transition-all"
                      placeholder="Crie uma senha forte"
                      onChange={(e) => setForm({ ...form, senha: e.target.value })}
                    />
                  </div>
                </div>

                <button
                  onClick={salvarEquipe}
                  disabled={loading}
                  className="w-full bg-blue-600 text-white font-black py-5 rounded-xl uppercase tracking-widest hover:bg-blue-700 transition-all shadow-lg shadow-blue-200 mt-4 disabled:opacity-60"
                >
                  {loading ? 'Salvando...' : 'Continuar para Pagamento'}
                </button>
              </div>
            ) : (
              <div className="text-center space-y-8 animate-in fade-in slide-in-from-right-4 duration-500">
                <div className="bg-blue-50 border border-blue-100 p-6 rounded-2xl inline-block w-full">
                  <p className="text-slate-400 text-xs font-black uppercase tracking-widest mb-1">Valor da Inscrição</p>
                  <p className="text-4xl font-black text-blue-600">R$ 150,00</p>
                </div>

                <div className="border-2 border-dashed border-slate-300 bg-slate-50 rounded-2xl p-6 flex flex-col items-center justify-center gap-4 min-h-[300px]">
                  {!pixData ? (
                    <>
                      <div className="bg-white p-4 rounded-xl shadow-sm">
                        <CreditCard size={48} className="text-slate-300" />
                      </div>
                      <p className="text-slate-400 text-xs font-bold uppercase max-w-[220px]">Clique abaixo para gerar o Pix</p>
                    </>
                  ) : (
                    <>
                      <p className="text-green-600 text-xs font-black uppercase tracking-widest flex items-center gap-2 animate-pulse">
                        <Loader2 size={14} className="animate-spin" /> Aguardando Pagamento...
                      </p>
                      <img
                        src={`data:image/jpeg;base64,${pixData.qr_code_base64}`}
                        alt="QR Code"
                        className="w-48 h-48 rounded-lg shadow-md border-4 border-white"
                      />
                      <div className="w-full flex gap-2">
                        <input
                          readOnly
                          value={pixData.qr_code}
                          className="flex-1 text-[10px] bg-white border p-2 rounded-lg font-mono truncate"
                        />
                        <button onClick={() => navigator.clipboard.writeText(pixData.qr_code)} className="bg-blue-100 text-blue-600 p-2 rounded-lg">
                          <Copy size={16} />
                        </button>
                      </div>
                    </>
                  )}
                </div>

                <div className="flex gap-4">
                  <button onClick={() => setStep(1)} className="flex-1 bg-slate-100 text-slate-500 font-bold py-4 rounded-xl uppercase text-xs">
                    Voltar
                  </button>

                  {!pixData ? (
                    <button
                      onClick={gerarPix}
                      disabled={loading}
                      className="flex-[2] bg-green-500 text-white font-black py-4 rounded-xl hover:bg-green-600 uppercase tracking-widest shadow-lg shadow-green-200 disabled:opacity-60"
                    >
                      {loading ? 'Gerando...' : 'GERAR QR CODE PIX'}
                    </button>
                  ) : (
                    <button className="flex-[2] bg-slate-900 text-white font-black py-4 rounded-xl cursor-default uppercase tracking-widest opacity-80">
                      Aguardando...
                    </button>
                  )}
                </div>

                {/* ✅ DEV: Pular pagamento com PIN (funciona na Vercel) */}
                <div className="mt-8 pt-8 border-t border-slate-200">
                  <p className="text-[10px] font-bold text-slate-500 uppercase mb-2">Acesso restrito (dev)</p>
                  <div className="flex gap-2">
                    <input
                      type="password"
                      placeholder="PIN"
                      value={devPin}
                      className="flex-1 p-3 rounded-xl border bg-slate-50 font-bold text-xs"
                      onChange={(e) => setDevPin(e.target.value)}
                    />
                    <button
                      onClick={() => {
                        if (devPin === '2026') setPagamentoAprovado(true)
                        else alert('PIN incorreto')
                      }}
                      className="bg-red-100 text-red-600 font-bold px-4 rounded-xl text-xs uppercase tracking-widest border border-red-200"
                    >
                      Pular
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="bg-slate-50 p-4 text-center border-t border-slate-200">
            <p className="text-[10px] text-slate-400 font-bold uppercase flex items-center justify-center gap-2">
              <ShieldCheck size={12} /> Ambiente Seguro MP
            </p>
          </div>
        </div>

        <p className="text-center text-[10px] text-slate-400 font-bold uppercase mt-6">
          {empresa} — {slogan}
        </p>
      </div>
    </main>
  )
}
