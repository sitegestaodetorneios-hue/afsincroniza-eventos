'use client'

import { useState, useRef } from 'react'
import { UserPlus, Users, ArrowLeft, Mail, Lock, FileText, Upload, CheckCircle, AlertTriangle, GraduationCap, Printer } from 'lucide-react'
import Link from 'next/link'

async function safeJson(res) {
  try {
    return await res.json()
  } catch {
    const txt = await res.text().catch(() => '')
    return { error: txt || `Erro ${res.status}` }
  }
}

export default function PainelProfessor() {
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

  // Upload Termo
  const [termoFile, setTermoFile] = useState(null)
  const [uploading, setUploading] = useState(false)
  const fileInputRef = useRef(null)

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
        alert(data?.error || 'Dados incorretos!')
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
        setAtletas([])
        return
      }
      setAtletas(Array.isArray(data) ? data : [])
    } catch (e) {
      setAtletas([])
    }
  }

  async function adicionarAtleta(e) {
    e.preventDefault()
    if (!novoAtleta.nome || !novoAtleta.rg) return alert('Preencha Nome e RG')
    if (!equipe?.id) return alert('Sessão expirada.')

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
        alert(data?.error || 'Erro ao salvar')
        setLoading(false)
        return
      }

      setNovoAtleta({ nome: '', rg: '', camisa: '' })
      await carregarAtletas(equipe.id)
    } catch (e) {
      alert('Falha ao salvar atleta.')
    }
    setLoading(false)
  }

  // --- GERAR TERMO COM DIREITO DE IMAGEM ---
  function gerarTermo() {
    if (atletas.length === 0) return alert("Cadastre os atletas antes de gerar o termo.")
    
    const printWindow = window.open('', '_blank')
    if(!printWindow) return alert("Pop-up bloqueado. Permita pop-ups.")

    const html = `
      <html>
        <head>
          <title>Súmula e Termo - ${equipe.nome_equipe}</title>
          <style>
            body { font-family: 'Times New Roman', serif; padding: 40px; color: #000; line-height: 1.4; }
            .header { text-align: center; border-bottom: 2px solid #000; padding-bottom: 20px; margin-bottom: 30px; }
            h1 { font-size: 20px; text-transform: uppercase; margin: 0; }
            h2 { font-size: 14px; font-weight: normal; margin: 5px 0 0 0; text-transform: uppercase; }
            .content { font-size: 12px; text-align: justify; margin-bottom: 20px; }
            table { width: 100%; border-collapse: collapse; margin-top: 20px; font-family: sans-serif; }
            th, td { border: 1px solid #000; padding: 6px; text-align: left; font-size: 11px; }
            th { background-color: #eee; text-transform: uppercase; font-weight: bold; text-align: center; }
            .assinatura { margin-top: 60px; text-align: center; float: right; width: 40%; border-top: 1px solid #000; padding-top: 5px; font-size: 12px; }
            .footer { margin-top: 100px; font-size: 10px; text-align: center; clear: both; }
          </style>
        </head>
        <body>
          <div class="header">
            <h1>Ficha de Inscrição Oficial</h1>
            <h2>${equipe.modalidade} • Temporada 2026</h2>
          </div>
          
          <p><b>Equipe:</b> ${equipe.nome_equipe.toUpperCase()}</p>
          <p><b>Professor(a) Responsável:</b> ${equipe.nome_capitao}</p>

          <div class="content">
            <p>
              Pelo presente instrumento, inscrevo os atletas abaixo relacionados para participarem da competição. Declaro que todos estão aptos fisicamente e clinicamente para a prática desportiva, isentando a organização de qualquer responsabilidade sobre acidentes ou problemas de saúde.
            </p>
            <p>
              <b>DO DIREITO DE IMAGEM:</b> Os atletas abaixo relacionados, bem como a comissão técnica, CEDEM e TRANSFEREM, de forma gratuita e definitiva, os direitos de uso de sua imagem e voz para a organização do evento, permitindo a divulgação em fotos, vídeos, sites, redes sociais e materiais promocionais da competição, sem qualquer ônus ou restrição de tempo ou território.
            </p>
          </div>

          <table>
            <thead>
              <tr>
                <th style="width: 30px;">#</th>
                <th>Nome Completo do Atleta</th>
                <th>RG / Documento</th>
                <th style="width: 180px;">Assinatura (Concordo com os termos)</th>
              </tr>
            </thead>
            <tbody>
              ${atletas.map(a => `
                <tr>
                  <td style="text-align: center;">${a.numero_camisa || ''}</td>
                  <td>${a.nome}</td>
                  <td>${a.rg}</td>
                  <td></td>
                </tr>
              `).join('')}
              ${Array.from({ length: Math.max(0, 15 - atletas.length) }).map((_, i) => `
                <tr>
                  <td style="text-align: center;"></td>
                  <td>&nbsp;</td>
                  <td></td>
                  <td></td>
                </tr>
              `).join('')}
            </tbody>
          </table>

          <div class="assinatura">
            <b>${equipe.nome_capitao}</b><br>
            Assinatura do Professor(a)
          </div>

          <div class="footer">
            Documento gerado eletronicamente em ${new Date().toLocaleDateString()}. O uso deste documento é exclusivo para esta competição.
          </div>
          
          <script>window.print();</script>
        </body>
      </html>
    `
    printWindow.document.write(html)
    printWindow.document.close()
  }

  // --- UPLOAD TERMO ---
  async function handleFileUpload(e) {
    const file = e.target.files[0]
    if (!file) return
    if (file.size > 5 * 1024 * 1024) return alert("Arquivo muito grande (Máx 5MB)")
    setTermoFile(file)
  }

  async function enviarTermo() {
    if (!termoFile) return alert("Selecione o arquivo assinado.")
    
    setUploading(true)
    try {
        const reader = new FileReader();
        reader.readAsDataURL(termoFile);
        reader.onload = async () => {
            const base64 = reader.result;
            const res = await fetch('/api/capitao/upload-termo', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    equipe_id: equipe.id,
                    arquivo_base64: base64,
                    nome_arquivo: termoFile.name
                })
            })
            const data = await safeJson(res)
            if (res.ok) {
                alert("Documento enviado com sucesso! O status da equipe será atualizado após análise.")
                setTermoFile(null)
            } else {
                alert(data.error || "Erro ao enviar.")
            }
            setUploading(false)
        };
    } catch (e) {
        setUploading(false)
    }
  }

  // TELA DE LOGIN
  if (!acessoLiberado) {
    return (
      <main className="min-h-screen bg-slate-950 flex items-center justify-center p-6 font-sans">
        <div className="bg-white p-10 rounded-[2rem] max-w-md w-full shadow-2xl relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-2 bg-blue-600"></div>
          
          <div className="text-center mb-10">
            <div className="w-16 h-16 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-sm">
                <GraduationCap size={32} />
            </div>
            <h1 className="text-2xl font-black uppercase text-slate-900 tracking-tight">
              Área do Professor
            </h1>
            <p className="text-slate-500 text-sm font-medium mt-2">
              Gestão de elenco e documentação.
            </p>
          </div>

          <div className="space-y-5">
            <div className="relative group">
              <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-blue-600 transition-colors" size={18}/>
              <input type="email" placeholder="E-mail cadastrado" className="w-full p-4 pl-12 bg-slate-50 border-2 border-slate-100 rounded-xl font-bold text-slate-900 outline-none focus:border-blue-600 transition-all placeholder:text-slate-400" value={emailBusca} onChange={(e) => setEmailBusca(e.target.value)} />
            </div>

            <div className="relative group">
              <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-blue-600 transition-colors" size={18}/>
              <input type="password" placeholder="Senha de acesso" className="w-full p-4 pl-12 bg-slate-50 border-2 border-slate-100 rounded-xl font-bold text-slate-900 outline-none focus:border-blue-600 transition-all placeholder:text-slate-400" value={senhaBusca} onChange={(e) => setSenhaBusca(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') acessarPainel() }} />
            </div>

            <button onClick={acessarPainel} disabled={loading} className="w-full bg-slate-900 text-white font-black py-4 rounded-xl hover:bg-blue-600 transition-all uppercase tracking-widest text-xs shadow-lg disabled:opacity-60">
              {loading ? 'Acessando...' : 'Entrar no Painel'}
            </button>

            <Link href="/" className="flex items-center justify-center gap-2 text-xs font-bold text-slate-400 hover:text-slate-600 mt-6 uppercase tracking-wide transition-colors">
              <ArrowLeft size={14} /> Voltar ao site
            </Link>
          </div>
        </div>
      </main>
    )
  }

  // DASHBOARD
  return (
    <main className="min-h-screen bg-slate-50 py-8 px-4 md:px-8 font-sans">
      <div className="max-w-6xl mx-auto">
        
        {/* HEADER FIFA STANDARD */}
        <div className="bg-slate-900 rounded-[2rem] p-8 md:p-10 text-white shadow-2xl mb-10 relative overflow-hidden">
            <div className="absolute top-0 right-0 p-10 opacity-5 pointer-events-none"><Users size={300}/></div>
            <div className="relative z-10 flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
                <div>
                    <div className="flex items-center gap-3 mb-2">
                        <div className="bg-blue-600 px-3 py-1 rounded text-[10px] font-black uppercase tracking-widest shadow-sm">Professor</div>
                        <span className="text-slate-400 text-xs font-bold uppercase tracking-widest">{equipe?.modalidade}</span>
                    </div>
                    <h1 className="text-3xl md:text-5xl font-black uppercase italic tracking-tighter text-white">
                        {equipe?.nome_equipe || 'Nome da Equipe'}
                    </h1>
                    <p className="text-slate-300 font-medium mt-2 flex items-center gap-2">
                        <GraduationCap size={18} className="text-yellow-500"/> Resp: {equipe?.nome_capitao}
                    </p>
                </div>

                <div className="flex items-center gap-6 bg-white/10 p-4 rounded-2xl border border-white/10 backdrop-blur-sm">
                    <div className="text-right">
                        <p className="text-[10px] font-black uppercase text-blue-300 tracking-widest">Elenco</p>
                        <p className="text-3xl font-black text-white leading-none">
                            {(Array.isArray(atletas) ? atletas.length : 0)}<span className="text-lg text-slate-400">/15</span>
                        </p>
                    </div>
                    <div className={`h-10 w-1 ${equipe?.termo_assinado ? 'bg-green-500' : 'bg-red-500'} rounded-full`}></div>
                    <div>
                        <p className="text-[10px] font-black uppercase text-blue-300 tracking-widest">Documentação</p>
                        {equipe?.termo_assinado ? (
                            <p className="text-green-400 font-bold text-sm flex items-center gap-1"><CheckCircle size={14}/> Regular</p>
                        ) : (
                            <p className="text-red-400 font-bold text-sm flex items-center gap-1 animate-pulse"><AlertTriangle size={14}/> Pendente</p>
                        )}
                    </div>
                </div>
            </div>
        </div>

        <div className="grid lg:grid-cols-3 gap-8">
          
          {/* COLUNA 1: GESTÃO (CADASTRO E DOCS) */}
          <div className="lg:col-span-1 space-y-8">
            
            {/* CARD CADASTRO */}
            <div className="bg-white p-6 rounded-[2rem] shadow-sm border border-slate-200">
              <h2 className="flex items-center gap-2 font-black uppercase text-xs tracking-widest text-slate-400 mb-6 border-b border-slate-100 pb-2">
                <UserPlus size={16} className="text-blue-600" /> Inscrever Novo Atleta
              </h2>
              <form onSubmit={adicionarAtleta} className="space-y-3">
                <div>
                    <label className="text-[10px] font-bold uppercase text-slate-400 ml-2">Nome Completo</label>
                    <input className="w-full p-3 bg-slate-50 border-2 border-slate-100 rounded-xl font-bold text-sm text-slate-800 outline-none focus:border-blue-500 transition-colors" value={novoAtleta.nome} onChange={(e) => setNovoAtleta({ ...novoAtleta, nome: e.target.value })} />
                </div>
                <div className="grid grid-cols-3 gap-3">
                    <div className="col-span-2">
                        <label className="text-[10px] font-bold uppercase text-slate-400 ml-2">RG / DOC</label>
                        <input className="w-full p-3 bg-slate-50 border-2 border-slate-100 rounded-xl font-bold text-sm text-slate-800 outline-none focus:border-blue-500 transition-colors" value={novoAtleta.rg} onChange={(e) => setNovoAtleta({ ...novoAtleta, rg: e.target.value })} />
                    </div>
                    <div>
                        <label className="text-[10px] font-bold uppercase text-slate-400 ml-2">Nº</label>
                        <input className="w-full p-3 bg-slate-50 border-2 border-slate-100 rounded-xl font-bold text-sm text-slate-800 outline-none focus:border-blue-500 transition-colors text-center" type="number" value={novoAtleta.camisa} onChange={(e) => setNovoAtleta({ ...novoAtleta, camisa: e.target.value })} />
                    </div>
                </div>
                <button disabled={loading || (Array.isArray(atletas) ? atletas.length : 0) >= 15} className="w-full bg-blue-600 text-white font-black py-3 rounded-xl hover:bg-blue-700 uppercase text-xs tracking-widest disabled:opacity-50 transition-all shadow-lg shadow-blue-500/30 mt-2">
                  {loading ? 'Salvando...' : 'Adicionar ao Elenco'}
                </button>
              </form>
            </div>

            {/* CARD DOCUMENTAÇÃO */}
            <div className="bg-slate-800 p-6 rounded-[2rem] shadow-xl border border-slate-700 text-white">
                <h2 className="flex items-center gap-2 font-black uppercase text-xs tracking-widest text-slate-400 mb-4 border-b border-slate-700 pb-2">
                    <FileText size={16} className="text-yellow-400" /> Regularização
                </h2>
                
                <div className="space-y-4">
                    <div className="bg-white/5 p-4 rounded-xl border border-white/10">
                        <p className="text-xs text-slate-300 font-medium mb-3">1. Cadastre os atletas e gere o termo com direito de imagem incluso para imprimir.</p>
                        <button onClick={gerarTermo} className="w-full bg-white text-slate-900 font-bold py-3 rounded-xl hover:bg-slate-200 uppercase text-[10px] tracking-widest flex items-center justify-center gap-2 transition-colors">
                            <Printer size={14}/> Imprimir Termo
                        </button>
                    </div>

                    <div className="bg-white/5 p-4 rounded-xl border border-white/10">
                        <p className="text-xs text-slate-300 font-medium mb-3">2. Colete as assinaturas, tire uma foto legível e envie aqui.</p>
                        
                        <input type="file" accept="image/*,application/pdf" ref={fileInputRef} onChange={handleFileUpload} className="hidden" />
                        
                        {!termoFile ? (
                            <button onClick={() => fileInputRef.current?.click()} className="w-full border-2 border-dashed border-slate-600 text-slate-400 font-bold py-3 rounded-xl hover:border-blue-400 hover:text-blue-300 uppercase text-[10px] tracking-widest transition-colors flex items-center justify-center gap-2">
                                <Upload size={14}/> Anexar Foto/PDF
                            </button>
                        ) : (
                            <div className="space-y-2 animate-in fade-in zoom-in">
                                <div className="bg-green-900/30 p-2 rounded-lg text-xs truncate flex items-center gap-2 text-green-300 border border-green-900/50">
                                    <FileText size={14}/> {termoFile.name}
                                </div>
                                <div className="flex gap-2">
                                    <button onClick={enviarTermo} disabled={uploading} className="flex-1 bg-green-600 text-white font-bold py-2 rounded-lg text-[10px] uppercase tracking-widest hover:bg-green-500 disabled:opacity-50 transition-colors shadow-lg">
                                        {uploading ? 'Enviando...' : 'Confirmar Envio'}
                                    </button>
                                    <button onClick={() => setTermoFile(null)} className="px-3 bg-red-500/20 text-red-400 rounded-lg hover:bg-red-500/40 transition-colors"><AlertTriangle size={14}/></button>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>
          </div>

          {/* COLUNA 2: LISTA DE ATLETAS */}
          <div className="lg:col-span-2">
            <div className="flex justify-between items-end mb-6">
                <h3 className="text-sm font-black uppercase text-slate-400 tracking-widest">Elenco Oficial</h3>
                <span className="text-xs font-bold text-blue-600 bg-blue-50 px-3 py-1 rounded-full border border-blue-100">Temporada 2026</span>
            </div>
            
            <div className="space-y-3">
              {(Array.isArray(atletas) ? atletas : []).length === 0 ? (
                <div className="text-center py-20 bg-white rounded-[2.5rem] border-2 border-dashed border-slate-200">
                    <div className="bg-slate-50 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
                        <Users size={32} className="text-slate-300"/>
                    </div>
                    <p className="text-slate-400 font-bold text-sm">Nenhum atleta no elenco.</p>
                    <p className="text-xs text-slate-400 mt-1">Use o formulário ao lado para começar a convocação.</p>
                </div>
              ) : (
                <div className="grid md:grid-cols-2 gap-3">
                    {(Array.isArray(atletas) ? atletas : []).map((atleta) => (
                    <div key={atleta.id} className="bg-white p-4 rounded-2xl border border-slate-100 flex justify-between items-center shadow-sm hover:shadow-md hover:border-blue-200 transition-all group">
                        <div className="flex items-center gap-4">
                        <div className="h-12 w-12 bg-slate-50 rounded-xl flex items-center justify-center font-black text-slate-300 text-lg group-hover:bg-blue-600 group-hover:text-white transition-colors shadow-inner">
                            {atleta.numero_camisa || '-'}
                        </div>
                        <div>
                            <p className="font-black text-slate-800 uppercase text-sm leading-tight">{atleta.nome}</p>
                            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mt-0.5">RG: {atleta.rg}</p>
                        </div>
                        </div>
                        <div className="flex items-center gap-2">
                            <span className="text-[9px] bg-green-50 text-green-700 px-2 py-1 rounded border border-green-100 font-bold uppercase tracking-wide">Inscrito</span>
                        </div>
                    </div>
                    ))}
                </div>
              )}
            </div>
          </div>

        </div>
      </div>
    </main>
  )
}