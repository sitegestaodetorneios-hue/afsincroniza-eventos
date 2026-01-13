'use client'
import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { ArrowLeft, FileText, ShieldCheck, Info } from 'lucide-react'

export default function Regulamento() {
  const [siteData, setSiteData] = useState(null)

  useEffect(() => {
    fetch('/api/config')
      .then((r) => r.json())
      .then((d) => setSiteData(d || {}))
      .catch(() => setSiteData({}))
  }, [])

  const competencia = useMemo(
    () => siteData?.nome_competicao || 'Taça Pérolas do Vale do Itajaí',
    [siteData]
  )
  const empresa = useMemo(
    () => siteData?.nome_empresa || 'A&F Sincroniza Eventos Esportivos',
    [siteData]
  )

  return (
    <main className="min-h-screen bg-slate-50 py-12 px-6">
      <div className="max-w-3xl mx-auto">
        <Link
          href="/"
          className="inline-flex items-center gap-2 text-slate-500 hover:text-blue-600 mb-8 font-bold text-sm uppercase transition-colors"
        >
          <ArrowLeft size={16} /> Voltar
        </Link>

        <article className="bg-white p-10 md:p-16 rounded-[2rem] shadow-xl border border-slate-200">
          <header className="border-b-2 border-slate-100 pb-8 mb-8 text-center">
            <FileText size={48} className="text-slate-200 mx-auto mb-4" />
            <h1 className="text-3xl font-black text-slate-900 uppercase tracking-tighter mb-2">
              Regulamento (Versão Provisória)
            </h1>
            <p className="text-slate-400 text-xs font-bold uppercase tracking-widest">
              {competencia} • Temporada 2026
            </p>
            <p className="text-slate-500 text-[11px] font-bold uppercase tracking-widest mt-3">
              Organização: {empresa}
            </p>
          </header>

          {/* Aviso para não te prender a regras/datas agora */}
          <div className="mb-10 bg-amber-50 border border-amber-100 p-5 rounded-2xl flex gap-3">
            <Info className="text-amber-600 mt-0.5" size={18} />
            <div>
              <p className="font-black text-slate-900">Aviso importante</p>
              <p className="text-slate-600 text-sm font-medium">
                Este é um texto-base para organização do site. As regras oficiais (datas, valores, tabela e critérios)
                serão publicadas/atualizadas pela organização conforme abertura das etapas.
              </p>
            </div>
          </div>

          <div className="prose prose-slate max-w-none text-slate-600 leading-relaxed space-y-8">
            <section>
              <h3 className="text-xl font-black text-slate-900 uppercase mb-4">1. Modalidades e Categorias</h3>
              <ul>
                <li><b>Futsal</b>: Sub-08, Sub-10, Sub-12, Sub-14, Sub-16</li>
                <li><b>Suíço</b>: Sub-08, Sub-10, Sub-12, Sub-14, Sub-16</li>
                <li><b>Feminino livre</b>: participação <b>somente na etapa Final</b> (sem eliminatórias anteriores)</li>
              </ul>
            </section>

            <section>
              <h3 className="text-xl font-black text-slate-900 uppercase mb-4">2. Inscrições e Confirmação</h3>
              <p>
                As inscrições serão abertas por etapa/modalidade. Quando uma etapa ainda estiver “Em breve”, será possível
                realizar <b>pré-agendamento (reserva de vaga)</b>. A confirmação ocorre após contato da organização e
                efetivação do pagamento quando a etapa estiver aberta.
              </p>
              <p>
                Limites de atletas por equipe, valores e prazos serão informados no momento da abertura de cada etapa.
              </p>
            </section>

            <section>
              <h3 className="text-xl font-black text-slate-900 uppercase mb-4">3. Sistema de Disputa</h3>
              <p>
                O sistema de disputa (fase de grupos, classificatórias, mata-mata, critérios de desempate) poderá variar
                por etapa e modalidade, e será publicado junto com a tabela oficial.
              </p>
              <p>
                Critérios usuais (exemplo): pontos, vitórias, saldo de gols, gols pró, confronto direto (quando aplicável).
              </p>
            </section>

            <section>
              <h3 className="text-xl font-black text-slate-900 uppercase mb-4">4. Disciplina e Conduta</h3>
              <p>
                A organização preza pelo espírito esportivo. Condutas antidesportivas, agressões e reincidências poderão
                resultar em suspensão, perda de pontos e/ou eliminação da equipe, conforme decisão da organização.
              </p>
            </section>

            <section>
              <h3 className="text-xl font-black text-slate-900 uppercase mb-4">5. Direito de Imagem e Responsabilidade</h3>
              <p>
                Ao participar, atletas e responsáveis autorizam o uso de imagem em fotos/vídeos do evento para divulgação
                e registro. A organização poderá solicitar termo de autorização conforme necessário.
              </p>
            </section>

            <div className="bg-blue-50 p-6 rounded-xl border-l-4 border-blue-600 mt-8">
              <p className="text-sm font-bold text-blue-800 italic">
                “O espírito esportivo deve prevalecer acima de qualquer resultado.”
              </p>
            </div>

            <div className="mt-10 flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-slate-400">
              <ShieldCheck size={12} /> Documento base — atualizado pela organização conforme abertura das etapas.
            </div>
          </div>
        </article>
      </div>
    </main>
  )
}
