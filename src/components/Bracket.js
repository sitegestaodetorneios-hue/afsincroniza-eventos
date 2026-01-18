import { Trophy, Calendar, Clock } from 'lucide-react'

export default function Bracket({ jogos }) {
  // Filtra e ordena as fases
  const finais = jogos.filter(j => j.tipo_jogo === 'FINAL')
  const disputa3 = jogos.filter(j => j.tipo_jogo === 'DISPUTA_3')
  const semis = jogos.filter(j => j.tipo_jogo === 'SEMI')
  const quartas = jogos.filter(j => j.tipo_jogo === 'QUARTAS')
  const oitavas = jogos.filter(j => j.tipo_jogo === 'OITAVAS')

  // Se não tiver jogos de mata-mata, avisa
  if (jogos.length === 0) return (
    <div className="text-center p-10 text-slate-400 bg-slate-50 rounded-xl border border-dashed border-slate-200">
       <Trophy className="mx-auto mb-2 opacity-50" />
       <p className="text-xs uppercase font-bold">A fase final ainda não foi definida.</p>
    </div>
  )

  const renderMatch = (jogo) => {
    const winnerA = jogo.finalizado && (jogo.gols_a > jogo.gols_b || jogo.penaltis_a > jogo.penaltis_b)
    const winnerB = jogo.finalizado && (jogo.gols_b > jogo.gols_a || jogo.penaltis_b > jogo.penaltis_a)

    return (
      <div key={jogo.id} className="bg-white border border-slate-200 rounded-lg shadow-sm mb-4 min-w-[200px] overflow-hidden">
        <div className="bg-slate-50 px-3 py-1 text-[9px] font-black text-slate-400 uppercase flex justify-between">
           <span>{jogo.id} • {new Date(jogo.data_jogo).toLocaleDateString('pt-BR').slice(0,5)}</span>
           <span>{jogo.horario ? String(jogo.horario).slice(0,5) : '--:--'}</span>
        </div>
        <div className="p-3 space-y-2">
            {/* Time A */}
            <div className={`flex justify-between items-center ${winnerA ? 'opacity-100' : (jogo.finalizado ? 'opacity-40' : 'opacity-100')}`}>
                <div className="flex items-center gap-2">
                   {jogo.equipeA?.logo_url ? <img src={jogo.equipeA.logo_url} className="w-5 h-5 object-contain"/> : <div className="w-5 h-5 bg-slate-200 rounded-full"></div>}
                   <span className={`text-xs font-bold truncate max-w-[100px] ${winnerA ? 'text-green-700' : 'text-slate-700'}`}>{jogo.equipeA?.nome_equipe || 'A definir'}</span>
                </div>
                <div className="flex gap-1 font-mono font-black text-sm">
                    <span>{jogo.gols_a ?? '-'}</span>
                    {jogo.penaltis_a && <span className="text-[10px] text-slate-400">({jogo.penaltis_a})</span>}
                </div>
            </div>
            {/* Time B */}
            <div className={`flex justify-between items-center ${winnerB ? 'opacity-100' : (jogo.finalizado ? 'opacity-40' : 'opacity-100')}`}>
                <div className="flex items-center gap-2">
                   {jogo.equipeB?.logo_url ? <img src={jogo.equipeB.logo_url} className="w-5 h-5 object-contain"/> : <div className="w-5 h-5 bg-slate-200 rounded-full"></div>}
                   <span className={`text-xs font-bold truncate max-w-[100px] ${winnerB ? 'text-green-700' : 'text-slate-700'}`}>{jogo.equipeB?.nome_equipe || 'A definir'}</span>
                </div>
                <div className="flex gap-1 font-mono font-black text-sm">
                    <span>{jogo.gols_b ?? '-'}</span>
                    {jogo.penaltis_b && <span className="text-[10px] text-slate-400">({jogo.penaltis_b})</span>}
                </div>
            </div>
        </div>
      </div>
    )
  }

  return (
    <div className="overflow-x-auto pb-4 custom-scrollbar">
        <div className="flex gap-8 min-w-max px-4">
            {/* COLUNA OITAVAS */}
            {oitavas.length > 0 && (
                <div className="flex flex-col justify-center gap-4">
                    <h3 className="text-center text-xs font-black uppercase text-blue-500 mb-2">Oitavas</h3>
                    {oitavas.map(renderMatch)}
                </div>
            )}
            
            {/* COLUNA QUARTAS */}
            {quartas.length > 0 && (
                <div className="flex flex-col justify-center gap-8 relative">
                    <h3 className="text-center text-xs font-black uppercase text-blue-500 mb-2">Quartas</h3>
                    {quartas.map(renderMatch)}
                </div>
            )}

            {/* COLUNA SEMI */}
            {semis.length > 0 && (
                <div className="flex flex-col justify-center gap-16">
                    <h3 className="text-center text-xs font-black uppercase text-blue-500 mb-2">Semifinais</h3>
                    {semis.map(renderMatch)}
                </div>
            )}

            {/* COLUNA FINAL */}
            {(finais.length > 0 || disputa3.length > 0) && (
                <div className="flex flex-col justify-center gap-8">
                    {finais.length > 0 && (
                        <div>
                            <h3 className="text-center text-xs font-black uppercase text-yellow-500 mb-2 flex items-center justify-center gap-1"><Trophy size={12}/> GRANDE FINAL</h3>
                            {finais.map(renderMatch)}
                        </div>
                    )}
                    {disputa3.length > 0 && (
                        <div className="opacity-80 scale-90">
                            <h3 className="text-center text-xs font-black uppercase text-orange-400 mb-2">Disputa 3º Lugar</h3>
                            {disputa3.map(renderMatch)}
                        </div>
                    )}
                </div>
            )}
        </div>
    </div>
  )
}