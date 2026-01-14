'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { ArrowLeft, User, Phone, MapPin, Shield, CheckCircle, Loader2, Trophy, AlertCircle } from 'lucide-react'

// Mascara de telefone
const phoneMask = (value) => {
  if (!value) return ""
  return value.replace(/[\D]/g, '')
    .replace(/(\d{2})(\d)/, '($1) $2')
    .replace(/(\d{5})(\d)/, '$1-$2')
    .replace(/(-\d{4})(\d+?)/, '$1')
}

export default function Inscricao() {
  const [step, setStep] = useState(1) // 1 = Seleção, 2 = Form, 3 = Sucesso
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [vagas, setVagas] = useState({ futsal: {}, society: {} })
  
  // Form Data
  const [form, setForm] = useState({
    modalidade: '',
    nome_equipe: '',
    capitao: '',
    whatsapp: '',
    cidade: ''
  })

  // Carrega vagas ao abrir
  useEffect(() => {
    fetch('/api/inscricao/status')
      .then(res => res.json())
      .then(data => {
          setVagas(data)
          setLoading(false)
      })
  }, [])

  async function handleSubmit(e) {
    e.preventDefault()
    setSaving(true)

    try {
        const res = await fetch('/api/inscricao', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({
                ...form,
                whatsapp: form.whatsapp.replace(/\D/g, '') // Limpa para envio
            })
        })
        
        const data = await res.json()
        
        if (res.ok) {
            setStep(3) // Sucesso
        } else {
            alert(data.error || 'Erro ao inscrever.')
        }
    } catch (error) {
        alert('Erro de conexão.')
    } finally {
        setSaving(false)
    }
  }

  // PASSO 1: SELEÇÃO DA COMPETIÇÃO
  if (step === 1) {
    return (
        <main className="min-h-screen bg-slate-50 py-10 px-4">
            <div className="max-w-4xl mx-auto">
                <div className="mb-8">
                    <Link href="/" className="flex items-center gap-2 text-slate-500 hover:text-blue-600 font-bold text-sm uppercase mb-4"><ArrowLeft size={18}/> Voltar</Link>
                    <h1 className="text-3xl font-black uppercase text-slate-900 tracking-tighter">Nova Inscrição</h1>
                    <p className="text-slate-500">Selecione o campeonato para garantir sua vaga.</p>
                </div>

                {loading ? (
                    <div className="p-20 text-center"><Loader2 className="animate-spin mx-auto text-blue-600"/></div>
                ) : (
                    <div className="grid md:grid-cols-2 gap-6">
                        {/* CARD FUTSAL */}
                        <button 
                            disabled={vagas.futsal.esgotado}
                            onClick={() => { setForm({...form, modalidade: 'FUTSAL'}); setStep(2); }}
                            className={`text-left p-8 rounded-3xl border-2 transition-all relative overflow-hidden group ${vagas.futsal.esgotado ? 'bg-slate-100 border-slate-200 opacity-60 cursor-not-allowed' : 'bg-white border-slate-200 hover:border-blue-500 hover:shadow-xl'}`}
                        >
                            <div className="relative z-10">
                                <div className="flex justify-between items-start mb-4">
                                    <span className="bg-blue-100 text-blue-700 px-3 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest">Futsal</span>
                                    {vagas.futsal.esgotado ? (
                                        <span className="text-red-500 font-black text-xs uppercase flex items-center gap-1"><AlertCircle size={14}/> Esgotado</span>
                                    ) : (
                                        <span className="text-green-600 font-black text-xs uppercase flex items-center gap-1"><CheckCircle size={14}/> Aberto</span>
                                    )}
                                </div>
                                <h3 className="text-3xl font-black text-slate-900 mb-2">Taça Futsal</h3>
                                <p className="text-slate-500 text-sm font-medium mb-6">Competição oficial de quadra. Categoria Livre.</p>
                                
                                {/* BARRA DE VAGAS */}
                                <div className="bg-slate-100 rounded-full h-3 w-full overflow-hidden">
                                    <div 
                                        className={`h-full ${vagas.futsal.esgotado ? 'bg-slate-400' : 'bg-blue-500'}`} 
                                        style={{ width: `${(vagas.futsal.ocupadas / vagas.futsal.total) * 100}%` }}
                                    ></div>
                                </div>
                                <div className="flex justify-between mt-2 text-[10px] font-bold uppercase tracking-widest text-slate-400">
                                    <span>{vagas.futsal.ocupadas} Confirmados</span>
                                    <span>Restam {vagas.futsal.restantes} Vagas</span>
                                </div>
                            </div>
                        </button>

                        {/* CARD SOCIETY */}
                        <button 
                            disabled={vagas.society.esgotado}
                            onClick={() => { setForm({...form, modalidade: 'SOCIETY'}); setStep(2); }}
                            className={`text-left p-8 rounded-3xl border-2 transition-all relative overflow-hidden group ${vagas.society.esgotado ? 'bg-slate-100 border-slate-200 opacity-60 cursor-not-allowed' : 'bg-white border-slate-200 hover:border-green-500 hover:shadow-xl'}`}
                        >
                            <div className="relative z-10">
                                <div className="flex justify-between items-start mb-4">
                                    <span className="bg-green-100 text-green-700 px-3 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest">Suíço</span>
                                    {vagas.society.esgotado ? (
                                        <span className="text-red-500 font-black text-xs uppercase flex items-center gap-1"><AlertCircle size={14}/> Esgotado</span>
                                    ) : (
                                        <span className="text-green-600 font-black text-xs uppercase flex items-center gap-1"><CheckCircle size={14}/> Aberto</span>
                                    )}
                                </div>
                                <h3 className="text-3xl font-black text-slate-900 mb-2">Taça Suíço</h3>
                                <p className="text-slate-500 text-sm font-medium mb-6">Campo de grama sintética. 7 jogadores.</p>
                                
                                {/* BARRA DE VAGAS */}
                                <div className="bg-slate-100 rounded-full h-3 w-full overflow-hidden">
                                    <div 
                                        className={`h-full ${vagas.society.esgotado ? 'bg-slate-400' : 'bg-green-500'}`} 
                                        style={{ width: `${(vagas.society.ocupadas / vagas.society.total) * 100}%` }}
                                    ></div>
                                </div>
                                <div className="flex justify-between mt-2 text-[10px] font-bold uppercase tracking-widest text-slate-400">
                                    <span>{vagas.society.ocupadas} Confirmados</span>
                                    <span>Restam {vagas.society.restantes} Vagas</span>
                                </div>
                            </div>
                        </button>
                    </div>
                )}
            </div>
        </main>
    )
  }

  // PASSO 2: FORMULÁRIO
  if (step === 2) {
      return (
        <main className="min-h-screen bg-slate-50 py-10 px-4 flex items-center justify-center">
            <div className="bg-white p-8 md:p-12 rounded-[2.5rem] shadow-2xl border border-slate-100 w-full max-w-lg">
                <button onClick={() => setStep(1)} className="text-slate-400 hover:text-blue-600 text-xs font-bold uppercase flex items-center gap-2 mb-6"><ArrowLeft size={14}/> Trocar Campeonato</button>
                
                <h2 className="text-3xl font-black text-slate-900 mb-2">Cadastro {form.modalidade === 'FUTSAL' ? 'Futsal' : 'Suíço'}</h2>
                <p className="text-slate-500 mb-8 font-medium text-sm">Preencha os dados do time. O pagamento será feito na próxima etapa.</p>

                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <label className="block text-[10px] font-black uppercase text-slate-400 tracking-widest mb-1">Nome da Equipe</label>
                        <div className="relative">
                            <Shield className="absolute left-4 top-3.5 text-slate-300" size={18}/>
                            <input required className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 pl-11 font-bold text-slate-700 outline-none focus:border-blue-500 focus:bg-white transition-all" placeholder="Ex: Real Madruga" value={form.nome_equipe} onChange={e => setForm({...form, nome_equipe: e.target.value})} />
                        </div>
                    </div>

                    <div>
                        <label className="block text-[10px] font-black uppercase text-slate-400 tracking-widest mb-1">Cidade Base</label>
                        <div className="relative">
                            <MapPin className="absolute left-4 top-3.5 text-slate-300" size={18}/>
                            <input required className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 pl-11 font-bold text-slate-700 outline-none focus:border-blue-500 focus:bg-white transition-all" placeholder="Ex: Itajaí" value={form.cidade} onChange={e => setForm({...form, cidade: e.target.value})} />
                        </div>
                    </div>

                    <div>
                        <label className="block text-[10px] font-black uppercase text-slate-400 tracking-widest mb-1">Nome do Capitão</label>
                        <div className="relative">
                            <User className="absolute left-4 top-3.5 text-slate-300" size={18}/>
                            <input required className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 pl-11 font-bold text-slate-700 outline-none focus:border-blue-500 focus:bg-white transition-all" placeholder="Nome completo" value={form.capitao} onChange={e => setForm({...form, capitao: e.target.value})} />
                        </div>
                    </div>

                    <div>
                        <label className="block text-[10px] font-black uppercase text-slate-400 tracking-widest mb-1">WhatsApp Capitão</label>
                        <div className="relative">
                            <Phone className="absolute left-4 top-3.5 text-slate-300" size={18}/>
                            <input required className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 pl-11 font-bold text-slate-700 outline-none focus:border-blue-500 focus:bg-white transition-all" placeholder="(47) 99999-9999" value={form.whatsapp} onChange={e => setForm({...form, whatsapp: phoneMask(e.target.value)})} maxLength={15} />
                        </div>
                    </div>

                    <button type="submit" disabled={saving} className="w-full bg-slate-900 text-white font-black py-4 rounded-xl uppercase hover:bg-blue-600 transition-all flex items-center justify-center gap-2 mt-4 shadow-lg">
                        {saving ? <Loader2 className="animate-spin"/> : 'Finalizar Pré-Inscrição'}
                    </button>
                </form>
            </div>
        </main>
      )
  }

  // PASSO 3: SUCESSO
  return (
    <main className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="bg-white p-10 rounded-[2.5rem] shadow-2xl border border-slate-100 text-center max-w-md w-full">
            <div className="w-20 h-20 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto mb-6">
                <Trophy size={40} className="animate-bounce"/>
            </div>
            <h2 className="text-3xl font-black text-slate-900 uppercase italic tracking-tighter mb-2">Inscrição Recebida!</h2>
            <p className="text-slate-500 font-medium mb-8">
                Parabéns, <b>{form.nome_equipe}</b> foi pré-cadastrada. Para confirmar sua vaga, aguarde o contato da organização ou envie o comprovante Pix agora.
            </p>
            
            <div className="space-y-3">
                <a href={`https://wa.me/55${form.whatsapp.replace(/\D/g,'')}?text=Ola, acabei de inscrever o time ${form.nome_equipe}. Como faço o Pix?`} target="_blank" className="block w-full bg-green-500 text-white font-bold py-3 rounded-xl hover:bg-green-600 transition-colors shadow-lg shadow-green-500/30">
                    Chamar no WhatsApp
                </a>
                <Link href="/" className="block w-full bg-slate-100 text-slate-600 font-bold py-3 rounded-xl hover:bg-slate-200 transition-colors">
                    Voltar ao Início
                </Link>
            </div>
        </div>
    </main>
  )
}