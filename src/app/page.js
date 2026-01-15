'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import {
  Trophy,
  ArrowRight,
  MapPin,
  Calendar,
  LogIn,
  Loader2,
  PlayCircle,
  ShieldCheck,
  Sparkles,
  FileText,
  CreditCard,
  Phone,
  Radio,
  LayoutList,
  Volume2
} from 'lucide-react'
import { BRAND } from '@/lib/branding'

function waLink(number, text) {
  const digits = (number || '').replace(/\D/g, '')
  const base = digits ? `https://wa.me/55${digits}` : `https://wa.me/55`
  const msg = encodeURIComponent(text || '')
  return msg ? `${base}?text=${msg}` : base
}

export default function Home() {
  const [siteData, setSiteData] = useState(null)
  const [patrocinios, setPatrocinios] = useState([]) // Estado para os patrocinadores

  useEffect(() => {
    // Carrega configurações e patrocinadores simultaneamente
    Promise.all([
      fetch('/api/config').then(res => res.json()),
      fetch('/api/admin/patrocinios').then(res => res.json())
    ]).then(([config, patro]) => {
      setSiteData(config || {})
      setPatrocinios(Array.isArray(patro) ? patro : [])
    }).catch(() => {
      setSiteData({})
      setPatrocinios([])
    })
  }, [])

  // Separação lógica dos patrocinadores
  const master = useMemo(() => patrocinios.find(p => p.cota === 'MASTER'), [patrocinios])
  const apoiadores = useMemo(() => patrocinios.filter(p => p.cota === 'RODAPE'), [patrocinios])

  const defs = useMemo(() => {
    const competitionName = siteData?.nome_competicao || BRAND.competition || 'Taça Pérolas do Vale do Itajaí'
    const companyName = siteData?.nome_empresa || BRAND.company || 'A&F Sincroniza Eventos Esportivos'
    const whatsapp = siteData?.whatsapp || BRAND.whatsapp || ''
    const slogan = siteData?.slogan || 'Gestão profissional para competições amadoras — do pré-agendamento ao campeão.'
    const textoEmpresa = siteData?.texto_empresa || 'Organizamos competições com padrão profissional, transparência e uma experiência premium para equipes, atletas e público.'
    const missao = siteData?.missao || 'Elevar o nível do futebol de base com organização, tecnologia e atendimento rápido.'
    const valores = siteData?.valores || 'Respeito, transparência, segurança, pontualidade e experiência.'
    const reserveMsg = `Olá! Quero reservar vaga na ${competitionName}. Minha cidade é ____ e minha equipe é _____. Modalidade: ( ) Futsal ( ) Suíço. Categorias: _____.`

    return { competitionName, companyName, whatsapp, slogan, textoEmpresa, missao, valores, reserveMsg }
  }, [siteData])

  if (!siteData) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center gap-4">
        <Loader2 className="animate-spin text-blue-600" size={48} />
        <p className="text-slate-400 font-bold uppercase tracking-widest text-xs animate-pulse">Carregando…</p>
      </div>
    )
  }

  const totalVagas = Number(siteData?.vagas_futsal || 0) + Number(siteData?.vagas_society || 0)
  const futsalOpen = Boolean(siteData?.status_futsal === 'ABERTA' || siteData?.inscricoes_futsal_abertas)
  const suicoOpen = Boolean(siteData?.status_society === 'ABERTA' || siteData?.inscricoes_society_abertas)
  const algumaInscricaoAberta = futsalOpen || suicoOpen

  const heroTitle = siteData?.titulo_destaque || defs.competitionName
  const heroSubtitle = siteData?.subtitulo || 'Futsal e Suíço com categorias Sub-08 a Sub-16. Feminino livre participa apenas da grande final.'
  const heroImg = siteData?.imagem_fundo || 'https://images.unsplash.com/photo-1574629810360-7efbbe195018?auto=format&fit=crop&q=80&w=1400'
  const logoUrl = siteData?.logo_url || '/brand/logo-sincroniza.jpg'

  return (
    <main className="min-h-screen bg-slate-50 text-slate-900 selection:bg-blue-600 selection:text-white">
      
      {/* TOP BAR */}
      <div className="bg-slate-900 text-white py-3 px-6 md:px-12 text-[10px] font-bold uppercase tracking-[0.2em] flex flex-col md:flex-row justify-between items-center gap-2 text-center md:text-left">
        <span className="opacity-80">{siteData?.texto_topo || defs.companyName}</span>
        <div className="flex items-center gap-2">
          {siteData?.data_limite ? (
            <span className="text-green-400 bg-green-400/10 px-3 py-1 rounded-full animate-pulse">Inscrições até {siteData.data_limite}</span>
          ) : ( <span className="text-slate-300 bg-white/10 px-3 py-1 rounded-full">Temporada 2026</span> )}
          <a href={waLink(defs.whatsapp, defs.reserveMsg)} target="_blank" rel="noreferrer" className="text-blue-200 bg-blue-500/10 px-3 py-1 rounded-full hover:bg-blue-500/20 transition" title="Falar no WhatsApp">
            <span className="inline-flex items-center gap-2"><Phone size={12} /> WhatsApp</span>
          </a>
        </div>
      </div>

      {/* NAVBAR */}
      <nav className="bg-white/80 backdrop-blur-md border-b border-slate-200 py-4 px-6 md:px-12 flex flex-col lg:flex-row justify-between items-center sticky top-0 z-50">
        <div className="flex items-center gap-3 mb-4 lg:mb-0">
          <div className="bg-white border border-slate-200 p-2 rounded-xl shadow-sm">
            <img src={logoUrl} alt={defs.companyName} className="h-10 w-auto object-contain" />
          </div>
          <div className="leading-tight">
            <span className="font-black text-xl md:text-2xl tracking-tighter uppercase text-slate-900 block">Taça <span className="text-blue-600">Pérolas</span></span>
            <span className="text-[10px] md:text-xs font-black uppercase tracking-widest text-slate-400 block">{BRAND?.region || 'Vale do Itajaí • SC'}</span>
          </div>
        </div>

        {/* MATCH CENTER MENU */}
        <div className="flex gap-2 bg-slate-100 p-1 rounded-lg border border-slate-200 mb-4 lg:mb-0">
            <Link href="/ao-vivo"><button className="flex items-center gap-2 px-3 py-2 rounded-md font-black text-[10px] uppercase bg-white text-red-600 shadow-sm hover:scale-105 transition-transform border border-slate-100"><Radio size={12} className="animate-pulse"/> Ao Vivo</button></Link>
            <Link href="/tabela"><button className="flex items-center gap-2 px-3 py-2 rounded-md font-bold text-[10px] uppercase text-slate-600 hover:bg-white hover:text-blue-600 transition-colors"><Trophy size={12}/> Tabela</button></Link>
            <Link href="/partidas"><button className="flex items-center gap-2 px-3 py-2 rounded-md font-bold text-[10px] uppercase text-slate-600 hover:bg-white hover:text-blue-600 transition-colors"><Calendar size={12}/> Jogos</button></Link>
        </div>

        <div className="flex flex-wrap justify-center gap-2 md:gap-6 text-xs font-bold uppercase tracking-widest text-slate-500 items-center">
          <a href="#competicoes" className="hover:text-blue-600 transition-colors px-3 py-2 rounded-lg hover:bg-slate-50">Competições</a>
          <a href="#inscricao" className="hover:text-blue-600 transition-colors px-3 py-2 rounded-lg hover:bg-slate-50">Inscrição</a>
          <Link href="/regulamento" className="hover:text-blue-600 transition-colors px-3 py-2 rounded-lg hover:bg-slate-50">Regulamento</Link>
          <Link href="/painel-capitao"><button className="flex items-center gap-2 border-2 border-slate-200 text-slate-600 px-5 py-2.5 rounded-xl hover:border-blue-600 hover:text-blue-600 transition-all bg-white"><LogIn size={14} /> Área do Professor</button></Link>
        </div>
      </nav>

      {/* HERO SECTION */}
      <section className="relative pt-16 pb-28 px-6 md:px-12 overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-full bg-[radial-gradient(circle_at_top_right,_var(--tw-gradient-stops))] from-blue-50 via-slate-50 to-white -z-10" />
        <div className="max-w-7xl mx-auto grid lg:grid-cols-2 gap-16 items-center">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-100/50 text-blue-700 text-[10px] font-black uppercase tracking-widest mb-6 border border-blue-100">
              <span className="w-2 h-2 rounded-full bg-blue-600 animate-ping" /> Temporada 2026
            </div>
            <h1 className="text-5xl md:text-7xl lg:text-8xl font-black text-slate-900 leading-[0.9] tracking-tighter mb-7">{heroTitle}</h1>
            <p className="text-slate-500 text-lg md:text-xl mb-7 max-w-xl leading-relaxed font-medium">{heroSubtitle}</p>
            <p className="text-slate-700 font-bold mb-8">{defs.slogan}</p>
            <div className="flex flex-col sm:flex-row gap-4">
              {algumaInscricaoAberta ? (
                  <a href="#competicoes" className="group"><button className="w-full sm:w-auto bg-slate-900 text-white font-bold px-8 py-5 rounded-2xl hover:bg-blue-600 transition-all shadow-xl flex items-center justify-center gap-3">VER COMPETIÇÕES <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform" /></button></a>
              ) : (
                  <Link href="/ao-vivo" className="group"><button className="w-full sm:w-auto bg-red-600 text-white font-bold px-8 py-5 rounded-2xl hover:bg-red-700 transition-all shadow-xl flex items-center justify-center gap-3"><PlayCircle size={18} /> ACOMPANHAR AO VIVO</button></Link>
              )}
              <a href="#inscricao"><button className="w-full sm:w-auto bg-white text-slate-900 border-2 border-slate-200 font-bold px-8 py-5 rounded-2xl hover:bg-slate-50 transition-all flex items-center justify-center gap-2"><PlayCircle size={18} /> COMO FUNCIONA</button></a>
            </div>
            <div className="mt-10 grid grid-cols-3 gap-4 pt-8 border-t border-slate-200/60 text-center">
              <div className="bg-white border border-slate-200 rounded-2xl p-5">
                <p className="text-2xl font-black text-slate-900">{totalVagas || '—'}</p>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Vagas totais</p>
              </div>
              <div className="bg-white border border-slate-200 rounded-2xl p-5">
                <p className="text-2xl font-black text-slate-900">Sub 08–16</p>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Masc.</p>
              </div>
              <div className="bg-white border border-slate-200 rounded-2xl p-5">
                <p className="text-2xl font-black text-slate-900">Final</p>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Fem.</p>
              </div>
            </div>
          </div>

          <div className="relative group">
            <div className="absolute -inset-4 bg-gradient-to-r from-blue-600 to-purple-600 rounded-[2.5rem] opacity-20 blur-2xl group-hover:opacity-30 transition-opacity" />
            <div className="bg-slate-900 rounded-[2rem] aspect-[4/3] relative overflow-hidden shadow-2xl border-4 border-white transform transition-transform duration-500 group-hover:scale-[1.01]">
              <img src={heroImg} className="absolute inset-0 w-full h-full object-cover opacity-80" alt="Capa" />
              <div className="absolute inset-0 bg-gradient-to-t from-slate-900 via-transparent to-transparent opacity-90" />
              <div className="absolute bottom-0 left-0 p-8 w-full">
                <div className="bg-white/10 backdrop-blur-md border border-white/20 p-6 rounded-2xl">
                  <p className="text-blue-300 font-black uppercase text-xs tracking-widest mb-2 flex items-center gap-2"><Trophy size={14}/> Match Center</p>
                  <p className="text-white text-sm mb-4 font-bold">Classificação e estatísticas em tempo real.</p>
                  <div className="grid grid-cols-2 gap-2">
                      <Link href="/tabela" className="bg-white/20 hover:bg-white/30 text-white text-[10px] font-black uppercase py-2 rounded-lg text-center transition-colors">Ver Tabela</Link>
                      <Link href="/partidas" className="bg-white/20 hover:bg-white/30 text-white text-[10px] font-black uppercase py-2 rounded-lg text-center transition-colors">Todos os Jogos</Link>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* PATROCINADOR MASTER (ENTRE HERO E CONTEÚDO) */}
      {master && (
        <section className="max-w-7xl mx-auto px-6 md:px-12 mb-20 animate-in fade-in zoom-in duration-1000">
           <div className="bg-white p-2 rounded-[2.5rem] border border-slate-200 shadow-2xl overflow-hidden relative group">
              <a href={master.link_destino || '#'} target="_blank">
                {master.video_url ? (
                  <div className="relative aspect-[16/6] md:aspect-[21/6] w-full rounded-[2rem] overflow-hidden bg-slate-900">
                    <video src={master.video_url} autoPlay loop muted playsInline className="w-full h-full object-cover opacity-90" />
                    <div className="absolute top-4 right-4 bg-black/40 backdrop-blur-md p-2 rounded-full text-white/80"><Volume2 size={16}/></div>
                  </div>
                ) : (
                  <img src={master.banner_url} className="w-full h-auto rounded-[2rem] object-cover transition-transform duration-1000 group-hover:scale-[1.02]" alt="Sponsor" />
                )}
                <div className="absolute top-6 left-10"><span className="bg-slate-900/80 backdrop-blur-md text-white text-[9px] font-black uppercase tracking-[0.3em] px-4 py-1.5 rounded-full border border-white/20">Patrocinador Master</span></div>
              </a>
           </div>
        </section>
      )}

      {/* SEÇÃO SOBRE */}
      <section id="sobre" className="py-24 px-6 md:px-12 bg-white">
        <div className="max-w-7xl mx-auto grid lg:grid-cols-2 gap-14 items-start">
          <div>
            <h2 className="text-xs font-black uppercase tracking-[0.4em] text-blue-600 mb-4 bg-blue-50 inline-block px-4 py-2 rounded-full">A EMPRESA</h2>
            <p className="text-4xl md:text-5xl font-black text-slate-900 uppercase italic tracking-tighter">{defs.companyName}</p>
            <p className="text-slate-500 mt-6 text-lg leading-relaxed font-medium max-w-xl">{defs.textoEmpresa}</p>
            <div className="mt-10 flex flex-col sm:flex-row gap-4">
              <a href={waLink(defs.whatsapp, defs.reserveMsg)} target="_blank" rel="noreferrer" className="group">
                <button className="w-full sm:w-auto bg-slate-900 text-white font-bold px-8 py-4 rounded-2xl hover:bg-blue-600 transition-all flex items-center justify-center gap-3">FALAR COM A ORGANIZAÇÃO <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform" /></button>
              </a>
              <Link href="/regulamento" className="w-full sm:w-auto"><button className="w-full bg-white text-slate-900 border-2 border-slate-200 font-bold px-8 py-4 rounded-2xl hover:bg-slate-50 transition-all flex items-center justify-center gap-2"><FileText size={18} /> Ver Regulamento</button></Link>
            </div>
          </div>
          <div className="grid sm:grid-cols-2 gap-6">
            <div className="bg-slate-50 border border-slate-200 rounded-[2rem] p-7">
              <div className="w-12 h-12 rounded-2xl bg-blue-600 text-white flex items-center justify-center mb-5"><Sparkles size={22} /></div>
              <p className="font-black text-slate-900 text-xl mb-2">Missão</p>
              <p className="text-slate-500 text-sm font-medium">{defs.missao}</p>
            </div>
            <div className="bg-slate-50 border border-slate-200 rounded-[2rem] p-7">
              <div className="w-12 h-12 rounded-2xl bg-slate-900 text-white flex items-center justify-center mb-5"><ShieldCheck size={22} /></div>
              <p className="font-black text-slate-900 text-xl mb-2">Valores</p>
              <p className="text-slate-500 text-sm font-medium">{defs.valores}</p>
            </div>
          </div>
        </div>
      </section>

      {/* SEÇÃO COMPETIÇÕES */}
      <section id="competicoes" className="py-24 px-6 md:px-12 bg-slate-50">
        <div className="max-w-7xl mx-auto text-center mb-16">
          <h2 className="text-xs font-black uppercase tracking-[0.4em] text-blue-600 mb-4 bg-blue-50 inline-block px-4 py-2 rounded-full">COMPETIÇÕES</h2>
          <p className="text-4xl md:text-5xl font-black text-slate-900 uppercase italic tracking-tighter">Abertas e Em Breve</p>
        </div>
        <div className="max-w-7xl mx-auto grid md:grid-cols-2 gap-8 lg:gap-12">
            {/* FUTSAL CARD */}
            <div className="bg-white border border-slate-200 p-8 md:p-10 rounded-[2.5rem] hover:shadow-2xl transition-all duration-300">
              <div className="flex justify-between items-start gap-4 mb-6">
                <div><p className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400">Modalidade</p><h3 className="text-3xl font-black text-slate-900 mt-1">{siteData?.titulo_futsal || 'Futsal'}</h3></div>
                <span className={`text-[10px] font-black px-4 py-2 rounded-full uppercase tracking-wide ${futsalOpen ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}`}>{futsalOpen ? 'Inscrições abertas' : 'Em breve (reserva)'}</span>
              </div>
              <p className="text-slate-500 mb-8 font-medium leading-relaxed">{siteData?.desc_futsal || 'Sub-08 a Sub-16.'}</p>
              <div className="space-y-3 pt-6 border-t border-slate-200">
                <div className="flex items-center gap-3 text-sm font-bold text-slate-500"><div className="p-1.5 bg-slate-50 rounded-lg"><MapPin size={16} className="text-blue-600" /></div>{siteData?.local_futsal || 'Local a definir'}</div>
                <div className="flex items-center gap-3 text-sm font-bold text-slate-500"><div className="p-1.5 bg-slate-50 rounded-lg"><Calendar size={16} className="text-blue-600" /></div>{siteData?.inicio_futsal || 'Início a definir'}</div>
              </div>
              <div className="mt-8 flex flex-col sm:flex-row gap-3">
                {futsalOpen ? ( <Link href="/inscricao" className="flex-1"><button className="w-full bg-slate-900 text-white font-bold px-6 py-4 rounded-2xl hover:bg-blue-600 transition-all flex items-center justify-center gap-2">INSCREVER <ArrowRight size={18} /></button></Link> ) : ( <a className="flex-1" href={waLink(defs.whatsapp, defs.reserveMsg)} target="_blank"><button className="w-full bg-slate-900 text-white font-bold px-6 py-4 rounded-2xl hover:bg-blue-600 transition-all flex items-center justify-center gap-2">RESERVAR VAGA <ArrowRight size={18} /></button></a> )}
              </div>
            </div>

            {/* SUICO CARD */}
            <div className="bg-white border border-slate-200 p-8 md:p-10 rounded-[2.5rem] hover:shadow-2xl transition-all duration-300">
              <div className="flex justify-between items-start gap-4 mb-6">
                <div><p className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400">Modalidade</p><h3 className="text-3xl font-black text-slate-900 mt-1">{siteData?.titulo_society || 'Suíço'}</h3></div>
                <span className={`text-[10px] font-black px-4 py-2 rounded-full uppercase tracking-wide ${suicoOpen ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}`}>{suicoOpen ? 'Inscrições abertas' : 'Em breve (reserva)'}</span>
              </div>
              <p className="text-slate-500 mb-8 font-medium leading-relaxed">{siteData?.desc_society || 'Sub-08 a Sub-16.'}</p>
              <div className="space-y-3 pt-6 border-t border-slate-200">
                <div className="flex items-center gap-3 text-sm font-bold text-slate-500"><div className="p-1.5 bg-slate-50 rounded-lg"><MapPin size={16} className="text-green-600" /></div>{siteData?.local_society || 'Local a definir'}</div>
                <div className="flex items-center gap-3 text-sm font-bold text-slate-500"><div className="p-1.5 bg-slate-50 rounded-lg"><Calendar size={16} className="text-green-600" /></div>{siteData?.inicio_society || 'Início a definir'}</div>
              </div>
              <div className="mt-8 flex flex-col sm:flex-row gap-3">
                {suicoOpen ? ( <Link href="/inscricao" className="flex-1"><button className="w-full bg-slate-900 text-white font-bold px-6 py-4 rounded-2xl hover:bg-green-600 transition-all flex items-center justify-center gap-2">INSCREVER <ArrowRight size={18} /></button></Link> ) : ( <a className="flex-1" href={waLink(defs.whatsapp, defs.reserveMsg)} target="_blank"><button className="w-full bg-slate-900 text-white font-bold px-6 py-4 rounded-2xl hover:bg-green-600 transition-all flex items-center justify-center gap-2">RESERVAR VAGA <ArrowRight size={18} /></button></a> )}
              </div>
            </div>
        </div>
      </section>

      {/* SEÇÃO INSCRIÇÃO */}
      <section id="inscricao" className="py-24 px-6 md:px-12 bg-white text-center">
        <div className="max-w-7xl mx-auto">
          <h2 className="text-xs font-black uppercase tracking-[0.4em] text-blue-600 mb-4 bg-blue-50 inline-block px-4 py-2 rounded-full">INSCRIÇÃO</h2>
          <p className="text-4xl md:text-5xl font-black text-slate-900 uppercase italic tracking-tighter mb-16">Como funciona</p>
          <div className="grid md:grid-cols-3 gap-8">
            <div className="bg-slate-50 border border-slate-200 rounded-[2rem] p-8 text-left">
              <div className="w-12 h-12 rounded-2xl bg-slate-900 text-white flex items-center justify-center mb-6"><FileText size={22} /></div>
              <p className="font-black text-slate-900 text-xl mb-2">1) Regulamento</p>
              <p className="text-slate-500 text-sm font-medium leading-relaxed">Leia as regras e critérios. Aceite o termo de imagem.</p>
              <Link href="/regulamento"><button className="w-full mt-6 bg-white border-2 border-slate-200 font-bold py-3 rounded-2xl hover:bg-slate-50 transition-all">Abrir regulamento</button></Link>
            </div>
            <div className="bg-slate-50 border border-slate-200 rounded-[2rem] p-8 text-left">
              <div className="w-12 h-12 rounded-2xl bg-blue-600 text-white flex items-center justify-center mb-6"><CreditCard size={22} /></div>
              <p className="font-black text-slate-900 text-xl mb-2">2) Inscrição + Pix</p>
              <p className="text-slate-500 text-sm font-medium leading-relaxed">Preencha os dados do time e finalize o pagamento via Pix.</p>
              <Link href="/inscricao"><button className="w-full mt-6 bg-slate-900 text-white font-bold py-3 rounded-2xl hover:bg-blue-600 transition-all flex items-center justify-center gap-2">Inscrever equipe <ArrowRight size={18} /></button></Link>
            </div>
            <div className="bg-slate-50 border border-slate-200 rounded-[2rem] p-8 text-left">
              <div className="w-12 h-12 rounded-2xl bg-green-600 text-white flex items-center justify-center mb-6"><LogIn size={22} /></div>
              <p className="font-black text-slate-900 text-xl mb-2">3) Área do Professor</p>
              <p className="text-slate-500 text-sm font-medium leading-relaxed">Cadastre atletas e acompanhe status regular para o jogo.</p>
              <Link href="/painel-capitao"><button className="w-full mt-6 bg-white border-2 border-slate-200 font-bold py-3 rounded-2xl hover:bg-slate-50 transition-all">Entrar no painel</button></Link>
            </div>
          </div>
        </div>
      </section>

      {/* APOIADORES (RODAPÉ PREMIUM) */}
      {apoiadores.length > 0 && (
        <section className="py-20 bg-slate-50 border-t border-slate-200 text-center">
           <div className="max-w-7xl mx-auto px-6">
              <p className="text-[10px] font-black uppercase text-slate-400 tracking-[0.4em] mb-12">Apoio Institucional e Realização</p>
              <div className="flex flex-wrap justify-center items-center gap-10 md:gap-20 opacity-60 grayscale hover:grayscale-0 transition-all duration-700">
                {apoiadores.map(p => (
                  <a key={p.id} href={p.link_destino || '#'} target="_blank" className="hover:scale-110 transition-transform">
                    <img src={p.banner_url} alt={p.nome_empresa} className="h-10 md:h-14 w-auto object-contain" />
                  </a>
                ))}
              </div>
           </div>
        </section>
      )}

      {/* FOOTER */}
      <footer className="bg-slate-900 text-white py-20 px-6 md:px-12 border-t border-slate-800">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-start gap-10">
          <div className="flex items-start gap-4">
            <div className="bg-slate-800/70 border border-slate-700 rounded-xl p-2"><img src={logoUrl} alt={defs.companyName} className="h-10 w-auto object-contain" /></div>
            <div>
              <span className="font-black text-2xl uppercase italic tracking-tighter block mb-2">Taça<span className="text-blue-500">Pérolas</span></span>
              <p className="text-slate-400 text-sm max-w-sm leading-relaxed">{siteData?.texto_footer || 'A competição mais organizada do Vale do Itajaí.'}</p>
              <p className="text-slate-600 text-xs mt-6 font-mono">© 2026 {defs.companyName}.</p>
            </div>
          </div>
          <div className="flex flex-col items-end gap-4">
            <div className="flex gap-8 text-xs font-bold uppercase tracking-widest text-slate-400">
              <Link href="/regulamento" className="hover:text-white transition-colors">Termos</Link>
              <Link href="/privacidade" className="hover:text-white transition-colors">Privacidade</Link>
            </div>
            <Link href="/admin"><button className="text-[10px] font-bold uppercase tracking-widest text-slate-700 bg-slate-800 px-4 py-2 rounded-lg hover:bg-slate-700 hover:text-white transition-all">Acesso Administrativo</button></Link>
          </div>
        </div>
      </footer>
    </main>
  )
}