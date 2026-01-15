'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { 
  ArrowLeft, User, Shield, CheckCircle, 
  Loader2, Trophy, Mail, Lock, 
  MapPin, Phone, Globe, ChevronRight
} from 'lucide-react'

const phoneMask = (v) => {
  if (!v) return ""
  v = v.replace(/\D/g, "")
  return v.length > 10 ? v.replace(/^(\d{2})(\d{5})(\d{4}).*/, "($1) $2-$3") : v.replace(/^(\d{2})(\d{4})(\d{0,4}).*/, "($1) $2-$3")
}

export default function Inscricao() {
  const router = useRouter()
  const [step, setStep] = useState(1) 
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  
  const [vagas, setVagas] = useState({ 
    futsal: { total: 0, ocupadas: 0, restantes: 0, esgotado: false }, 
    society: { total: 0, ocupadas: 0, restantes: 0, esgotado: false } 
  })
  const [siteConfigs, setSiteConfigs] = useState({
    titulo_futsal: 'Carregando...', desc_futsal: '...',
    titulo_society: 'Carregando...', desc_society: '...'
  })
  
  const [form, setForm] = useState({
    modalidade: '', nome_equipe: '', capitao: '', email: '', senha: '', whatsapp: '', cidade: ''
  })

  // Carregamento inicial de vagas e configurações
  useEffect(() => {
    async function loadData() {
        try {
            const [resV, resC] = await Promise.all([
                fetch(`/api/inscricao/status?t=${Date.now()}`),
                fetch(`/api/config?t=${Date.now()}`)
            ])
            const dV = await resV.json()
            const dC = await resC.json()
            if (dV && !dV.error) setVagas(dV)
            if (dC && !dC.error) setSiteConfigs(dC)
        } catch (e) { console.error(e) }
        finally { setLoading(false) }
    }
    loadData()
  }, [])

  async function handleSubmit(e) {
    e.preventDefault()
    setSaving(true)
    try {
        // 1. Grava a equipe no Banco de Dados
        const res = await fetch('/api/inscricao', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({...form, whatsapp: form.whatsapp.replace(/\D/g, '')})
        })
        
        const dataInsc = await res.json()
        if (!res.ok) throw new Error(dataInsc.error || 'Erro na inscrição')

        // 2. Avança para a tela de Sucesso e Redirecionamento (Estratégia Melhor Modelo)
        setStep(3) 

    } catch (e) { 
        alert(e.message || 'Erro de conexão') 
    } finally { 
        setSaving(false) 
    }
  }

  // PASSO 1: SELEÇÃO DE CATEGORIA
  if (step === 1) {
    return (
        <main className="min-h-screen bg-[#f8fafc] py-12 px-4 font-sans text-slate-900">
            <div className="max-w-5xl mx-auto">
                <header className="mb-12 text-center md:text-left">
                    <Link href="/" className="inline-flex items-center gap-2 text-slate-400 hover:text-blue-600 font-bold text-xs uppercase tracking-[0.2em] mb-6 transition-all group">
                        <ArrowLeft size={16} className="group-hover:-translate-x-1 transition-transform"/> Voltar ao Início
                    </Link>
                    <h1 className="text-5xl md:text-6xl font-black leading-none tracking-tighter italic uppercase">
                        Temporada <span className="text-blue-600">2026</span>
                    </h1>
                    <p className="text-slate-500 mt-4 font-medium text-lg">Selecione sua categoria oficial.</p>
                </header>
                <div className="grid md:grid-cols-2 gap-8">
                    {[
                        { id: 'FUTSAL', v: vagas.futsal, t: siteConfigs.titulo_futsal, d: siteConfigs.desc_futsal, color: 'blue' },
                        { id: 'SOCIETY', v: vagas.society, t: siteConfigs.titulo_society, d: siteConfigs.desc_society, color: 'green' }
                    ].map((item) => (
                        <button key={item.id} disabled={item.v.esgotado || loading} onClick={() => { setForm({...form, modalidade: item.id}); setStep(2); }} className={`group relative text-left p-1 rounded-[2.5rem] transition-all duration-500 ${item.v.esgotado ? 'grayscale opacity-60' : 'hover:scale-[1.02] hover:shadow-2xl'}`}>
                            <div className="bg-white rounded-[2.4rem] p-8 h-full border border-slate-100 relative overflow-hidden">
                                <div className={`absolute -right-10 -top-10 w-40 h-40 bg-${item.color}-50 rounded-full blur-3xl opacity-50 group-hover:opacity-100 transition-opacity`}></div>
                                <div className="relative z-10">
                                    <div className="flex justify-between items-center mb-8">
                                        <div className={`w-14 h-14 rounded-2xl bg-${item.id === 'FUTSAL' ? 'blue-600' : 'green-600'} flex items-center justify-center text-white shadow-lg`}>
                                            <Trophy size={28} />
                                        </div>
                                        {item.v.esgotado ? <span className="bg-red-50 text-red-600 px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest">Encerradas</span> : <span className={`bg-${item.id === 'FUTSAL' ? 'blue-50 text-blue-600' : 'green-50 text-green-600'} px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest animate-pulse`}>Vagas Abertas</span>}
                                    </div>
                                    <h3 className="text-3xl font-black text-slate-900 mb-3 uppercase tracking-tighter">{item.t}</h3>
                                    <p className="text-slate-500 text-sm leading-relaxed mb-8 font-medium">{item.d}</p>
                                    <div className="space-y-3">
                                        <div className="flex justify-between text-[10px] font-black uppercase text-slate-400 tracking-widest"><span>Ocupação</span><span>{item.v.ocupadas} / {item.v.total} Times</span></div>
                                        <div className="h-3 bg-slate-100 rounded-full overflow-hidden p-1">
                                            <div className={`h-full rounded-full transition-all duration-1000 ${item.id === 'FUTSAL' ? 'bg-blue-500' : 'bg-green-500'}`} style={{ width: `${(item.v.ocupadas / (item.v.total || 1)) * 100}%` }}></div>
                                        </div>
                                    </div>
                                    <div className="mt-8 flex items-center gap-2 text-slate-900 font-black uppercase text-xs tracking-widest group-hover:text-blue-600 transition-colors">Inscrever Equipe <ChevronRight size={16} /></div>
                                </div>
                            </div>
                        </button>
                    ))}
                </div>
            </div>
        </main>
    )
  }

  // PASSO 2: FORMULÁRIO DE DADOS
  if (step === 2) {
    return (
        <main className="min-h-screen bg-white md:bg-[#f8fafc] py-12 px-4 flex items-center justify-center text-slate-900 font-sans">
            <div className="bg-white md:p-12 p-6 rounded-[3rem] md:shadow-2xl md:border border-slate-100 w-full max-w-xl animate-in fade-in zoom-in duration-500">
                <button onClick={() => setStep(1)} className="mb-8 flex items-center gap-2 text-slate-400 hover:text-blue-600 font-bold text-[10px] uppercase tracking-widest transition-all">
                    <ArrowLeft size={14}/> Voltar
                </button>
                <div className="mb-10 text-center md:text-left">
                    <h2 className="text-4xl font-black text-slate-900 italic uppercase tracking-tighter">Inscrição <span className="text-blue-600">Oficial</span></h2>
                    <p className="text-slate-400 font-medium tracking-tight">Modalidade: <span className="text-blue-600 font-black uppercase">{form.modalidade}</span></p>
                </div>
                <form onSubmit={handleSubmit} className="space-y-6">
                    <div className="grid gap-6">
                        <Field label="Equipe" icon={<Shield size={18}/>} placeholder="Nome do clube" value={form.nome_equipe} onChange={v => setForm({...form, nome_equipe: v})} />
                        <Field label="Nome do Professor" icon={<User size={18}/>} placeholder="Responsável técnico" value={form.capitao} onChange={v => setForm({...form, capitao: v})} />
                        <div className="h-px bg-slate-100 my-2"></div>
                        <Field label="Email Login" icon={<Mail size={18}/>} placeholder="professor@competicao.com" value={form.email} onChange={v => setForm({...form, email: v.toLowerCase()})} type="email" />
                        <Field label="Defina sua Senha" icon={<Lock size={18}/>} placeholder="••••••••" value={form.senha} onChange={v => setForm({...form, senha: v})} type="password" />
                        <div className="grid grid-cols-2 gap-4">
                            <Field label="Cidade" icon={<Globe size={18}/>} value={form.cidade} onChange={v => setForm({...form, cidade: v})} />
                            <Field label="WhatsApp" icon={<Phone size={18}/>} value={form.whatsapp} onChange={v => setForm({...form, whatsapp: phoneMask(v)})} />
                        </div>
                    </div>
                    <button disabled={saving} className="w-full bg-blue-600 hover:bg-slate-900 text-white font-black py-5 rounded-2xl uppercase tracking-[0.2em] transition-all shadow-xl shadow-blue-500/20 flex items-center justify-center gap-3">
                        {saving ? <Loader2 className="animate-spin" /> : <>Finalizar Registro <CheckCircle size={20}/></>}
                    </button>
                </form>
            </div>
        </main>
    )
  }

  // PASSO 3: SUCESSO E REDIRECIONAMENTO (LOGICA NOVO MODELO)
  return (
    <main className="min-h-screen bg-[#f8fafc] flex items-center justify-center p-6 text-slate-900">
        <div className="bg-white p-12 rounded-[4rem] shadow-2xl text-center max-w-md w-full animate-in fade-in zoom-in duration-700">
            <div className="w-24 h-24 bg-blue-600 text-white rounded-[2.5rem] flex items-center justify-center mx-auto mb-8 shadow-xl shadow-blue-100 rotate-12">
                <CheckCircle size={56} />
            </div>
            <h2 className="text-4xl font-black uppercase italic tracking-tighter mb-4 leading-none">Equipe<br/><span className="text-blue-600">Cadastrada!</span></h2>
            <p className="text-slate-500 font-medium mb-10 leading-relaxed">
              Sua conta foi criada com sucesso. Agora acesse o painel para realizar o pagamento e liberar o cadastro dos seus atletas.
            </p>
            <button 
                onClick={() => router.push('/painel-capitao')}
                className="block w-full bg-slate-900 text-white font-black py-5 rounded-2xl uppercase tracking-widest hover:bg-blue-600 transition-all shadow-2xl"
            >
                Ir para o Painel do Professor
            </button>
        </div>
    </main>
  )
}

function Field({ label, icon, value, onChange, placeholder, type = "text" }) {
    return (
        <div className="space-y-1.5 text-left">
            <label className="block text-[10px] font-black uppercase text-slate-400 tracking-widest ml-1">{label}</label>
            <div className="relative group">
                <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-blue-500 transition-colors">{icon}</div>
                <input type={type} required placeholder={placeholder} value={value} onChange={e => onChange(e.target.value)} className="w-full bg-slate-50 border border-slate-100 rounded-2xl p-4 pl-12 font-bold text-slate-700 outline-none focus:bg-white focus:border-blue-500 focus:ring-4 focus:ring-blue-500/5 transition-all placeholder:text-slate-300" />
            </div>
        </div>
    )
}