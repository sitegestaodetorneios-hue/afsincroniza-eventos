'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import {
  ArrowLeft, Loader2, Users, Search, Trash2, Save, PlusCircle, Shield, X
} from 'lucide-react'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
)

const onlyDigits = (s) => String(s || '').replace(/\D/g, '')

async function safeJson(res) {
  const text = await res.text()
  try { return JSON.parse(text) } catch { return { error: text?.slice(0, 200) } }
}

function maskCpfLast4(last4) {
  const v = String(last4 || '').trim()
  if (!v) return '—'
  return `***.***.***-${v}`
}

export default function AdminStaff() {
  const [pin, setPin] = useState('')
  const [authed, setAuthed] = useState(false)

  const [loading, setLoading] = useState(false)
  const [staff, setStaff] = useState([])
  const [etapas, setEtapas] = useState([])

  const [q, setQ] = useState('')
  const [selected, setSelected] = useState(null)

  // modal
  const [open, setOpen] = useState(false)

  function auth() {
    if (pin === '2026') setAuthed(true)
    else alert('PIN incorreto')
  }

  async function loadAll() {
    setLoading(true)
    try {
      // staff list (com vínculos resumidos)
      const r = await fetch('/api/admin/staff', { headers: { 'x-admin-pin': pin } })
      const j = await safeJson(r)
      if (!r.ok) throw new Error(j.error || 'Erro ao carregar staff')
      setStaff(j.staff || [])

      // etapas para dropdown
      const { data: etapasData, error } = await supabase
        .from('etapas')
        .select('id,titulo,created_at')
        .order('created_at', { ascending: false })
      if (error) throw error
      setEtapas(etapasData || [])
    } catch (e) {
      alert(e.message || 'Erro')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (authed) loadAll()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authed])

  const staffFiltrado = useMemo(() => {
    const qq = q.trim().toLowerCase()
    if (!qq) return staff
    return staff.filter(s => {
      const nome = String(s.nome || '').toLowerCase()
      const last4 = String(s.cpf_last4 || '')
      const qdigits = onlyDigits(qq)
      return nome.includes(qq) || (qdigits ? last4.includes(qdigits) : false)
    })
  }, [staff, q])

  function openEdit(s) {
    setSelected({
      ...s,
      _newPass: '',
      _assignEtapaId: '',
      _assignRole: 'ARBITRO',
      _cpfRaw: '' // cpf completo (opcional: só se quiser atualizar)
    })
    setOpen(true)
  }

  async function saveStaff() {
    if (!selected) return
    setLoading(true)
    try {
      const cpfRawDigits = onlyDigits(selected._cpfRaw || '')

      const payload = {
        id: selected.id,
        nome: selected.nome,
        ativo: Boolean(selected.ativo),
        new_password: selected._newPass || null,
        // CPF opcional: só manda se preencher
        cpf_raw: cpfRawDigits ? cpfRawDigits : null
      }

      const r = await fetch('/api/admin/staff', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', 'x-admin-pin': pin },
        body: JSON.stringify(payload)
      })
      const j = await safeJson(r)
      if (!r.ok) throw new Error(j.error || 'Erro ao salvar')

      await loadAll()
      alert('✅ Salvo!')
      setOpen(false)
      setSelected(null)
    } catch (e) {
      alert(e.message || 'Erro')
    } finally {
      setLoading(false)
    }
  }

  async function deleteStaff() {
    if (!selected) return
    if (!confirm(`Excluir ${selected.nome}? (remove vínculos da etapa)`)) return
    setLoading(true)
    try {
      const r = await fetch(`/api/admin/staff?id=${selected.id}`, {
        method: 'DELETE',
        headers: { 'x-admin-pin': pin }
      })
      const j = await safeJson(r)
      if (!r.ok) throw new Error(j.error || 'Erro ao excluir')
      await loadAll()
      alert('✅ Excluído!')
      setOpen(false)
      setSelected(null)
    } catch (e) {
      alert(e.message || 'Erro')
    } finally {
      setLoading(false)
    }
  }

  async function assignEtapa() {
    if (!selected?._assignEtapaId) return alert('Selecione a etapa')
    setLoading(true)
    try {
      const r = await fetch('/api/admin/staff/etapas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-admin-pin': pin },
        body: JSON.stringify({
          staff_id: selected.id,
          etapa_id: Number(selected._assignEtapaId),
          role: selected._assignRole
        })
      })
      const j = await safeJson(r)
      if (!r.ok) throw new Error(j.error || 'Erro ao vincular etapa')

      // recarrega lista
      await loadAll()

      // fecha e reabre com dados atualizados (pro próprio modal não ficar defasado)
      const updated = (staff || []).find(x => x.id === selected.id)
      setSelected(prev => ({
        ...prev,
        ...(updated || {}),
        _assignEtapaId: ''
      }))

      alert('✅ Etapa adicionada!')
    } catch (e) {
      alert(e.message || 'Erro')
    } finally {
      setLoading(false)
    }
  }

  async function removeVinculo(vinculoId) {
    if (!confirm('Remover vínculo desta etapa?')) return
    setLoading(true)
    try {
      const r = await fetch(`/api/admin/staff/etapas?id=${vinculoId}`, {
        method: 'DELETE',
        headers: { 'x-admin-pin': pin }
      })
      const j = await safeJson(r)
      if (!r.ok) throw new Error(j.error || 'Erro ao remover vínculo')
      await loadAll()
      alert('✅ Vínculo removido!')
    } catch (e) {
      alert(e.message || 'Erro')
    } finally {
      setLoading(false)
    }
  }

  if (!authed) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
        <div className="bg-slate-900 p-8 rounded-2xl text-center w-full max-w-sm">
          <Shield className="mx-auto text-yellow-500 mb-4" />
          <h1 className="text-white font-black mb-4 uppercase">Admin • Staff</h1>
          <input
            type="password"
            value={pin}
            onChange={e => setPin(e.target.value)}
            className="bg-black text-white p-3 rounded mb-4 w-full text-center font-bold"
            placeholder="PIN"
          />
          <button
            onClick={auth}
            className="bg-yellow-500 hover:bg-yellow-400 w-full p-3 rounded font-black text-slate-900 uppercase"
          >
            Entrar
          </button>
        </div>
      </div>
    )
  }

  return (
    <main className="min-h-screen bg-slate-50 py-8 px-4 md:px-8 text-slate-800">
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center gap-4 mb-6">
          <Link href="/admin" className="bg-white p-3 rounded-full shadow hover:scale-105">
            <ArrowLeft />
          </Link>
          <div className="flex-1">
            <h1 className="text-2xl font-black uppercase text-slate-800 flex items-center gap-2">
              <Users className="text-indigo-600" /> Staff (Árbitros / Mesários)
            </h1>
            <p className="text-slate-500 text-xs font-bold">
              Ver todos • editar • excluir • vincular a etapas.
            </p>
          </div>

          <button
            onClick={loadAll}
            className="bg-slate-900 text-white px-4 py-2 rounded-xl text-xs font-black uppercase"
          >
            Atualizar
          </button>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm mb-4 flex flex-col md:flex-row gap-3 md:items-center">
          <div className="flex items-center gap-2 flex-1">
            <Search size={16} className="text-slate-400" />
            <input
              className="w-full outline-none text-sm font-bold"
              placeholder="Buscar por nome, CPF (últimos 4) ou e-mail interno..."
              value={q}
              onChange={e => setQ(e.target.value)}
            />
          </div>

          {loading && (
            <div className="text-slate-500 text-xs font-bold flex items-center gap-2">
              <Loader2 className="animate-spin" size={14} /> Carregando...
            </div>
          )}
        </div>

        <div className="grid w-full grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 justify-items-stretch">
          {staffFiltrado.map(s => (
            <div key={s.id} className="w-full bg-white border border-slate-200 rounded-2xl p-4 shadow-sm">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="font-black uppercase text-slate-800 truncate">{s.nome || '—'}</div>
                  <div className="text-[11px] text-slate-500 font-bold truncate">
                    CPF: {maskCpfLast4(s.cpf_last4)} • {s.ativo ? 'ATIVO' : 'INATIVO'}
                  </div>
                </div>
                <button
                  onClick={() => openEdit(s)}
                  className="px-3 py-1 rounded-xl text-[10px] font-black uppercase bg-slate-900 text-white hover:bg-black"
                >
                  Editar
                </button>
              </div>

              <div className="mt-3">
                <div className="text-[10px] font-black uppercase text-slate-400 mb-1">
                  Etapas / Funções
                </div>

                {(!s.vinculos || s.vinculos.length === 0) ? (
                  <div className="text-[11px] text-slate-400 font-bold">
                    Nenhuma etapa vinculada.
                  </div>
                ) : (
                  <div className="space-y-1">
                    {s.vinculos.slice(0, 4).map(v => (
                      <div key={v.id} className="flex justify-between items-center bg-slate-50 border border-slate-100 rounded-xl px-3 py-2">
                        <div className="text-[10px] font-black uppercase text-slate-600">
                          {v.role}
                        </div>
                        <div className="text-[10px] font-bold text-slate-700 truncate ml-2">
                          {v.etapa_titulo}
                        </div>
                      </div>
                    ))}
                    {s.vinculos.length > 4 && (
                      <div className="text-[10px] text-slate-400 font-bold">
                        +{s.vinculos.length - 4} vínculos…
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          ))}

          {staffFiltrado.length === 0 && (
            <div className="col-span-full bg-white rounded-2xl p-12 text-center border border-dashed border-slate-300">
              <Users className="mx-auto text-slate-200 mb-3" size={48} />
              <div className="text-slate-400 font-bold">Nenhum staff encontrado.</div>
            </div>
          )}
        </div>

        {/* MODAL EDIT */}
        {open && selected && (
          <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-white w-full max-w-3xl rounded-3xl p-6 shadow-2xl">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <div className="text-xl font-black uppercase">{selected.nome}</div>
                  <div className="text-xs font-bold text-slate-500">
                    Staff ID: {selected.id}
                  </div>
                </div>
                <button onClick={() => { setOpen(false); setSelected(null) }}>
                  <X />
                </button>
              </div>

              <div className="grid md:grid-cols-2 gap-3">
                <div className="bg-slate-50 border border-slate-100 rounded-2xl p-4">
                  <div className="text-[10px] font-black uppercase text-slate-400 mb-2">Dados</div>

                  <label className="text-[10px] font-black uppercase text-slate-400">Nome</label>
                  <input
                    className="w-full mt-1 border rounded-xl p-2 font-bold"
                    value={selected.nome || ''}
                    onChange={e => setSelected(prev => ({ ...prev, nome: e.target.value }))}
                  />

                  <label className="text-[10px] font-black uppercase text-slate-400 mt-3 block">
                    CPF (opcional: para atualizar)
                  </label>
                  <input
                    className="w-full mt-1 border rounded-xl p-2 font-bold"
                    value={selected._cpfRaw || ''}
                    onChange={e => setSelected(prev => ({ ...prev, _cpfRaw: e.target.value }))}
                    placeholder="Somente números (11 dígitos)"
                  />
                  <div className="text-[10px] text-slate-400 font-bold mt-2">
                    Atual: {maskCpfLast4(selected.cpf_last4)}
                  </div>

                  <div className="flex items-center justify-between mt-3">
                    <div className="text-[10px] font-black uppercase text-slate-400">Ativo</div>
                    <button
                      type="button"
                      onClick={() => setSelected(prev => ({ ...prev, ativo: !prev.ativo }))}
                      className={`px-3 py-1 rounded text-[10px] font-black uppercase ${
                        selected.ativo ? 'bg-green-600 text-white' : 'bg-slate-200 text-slate-700'
                      }`}
                    >
                      {selected.ativo ? 'SIM' : 'NÃO'}
                    </button>
                  </div>

                  <label className="text-[10px] font-black uppercase text-slate-400 mt-3 block">
                    Reset Senha (opcional)
                  </label>
                  <input
                    type="password"
                    className="w-full mt-1 border rounded-xl p-2 font-bold"
                    value={selected._newPass || ''}
                    onChange={e => setSelected(prev => ({ ...prev, _newPass: e.target.value }))}
                    placeholder="Nova senha"
                  />

                  <button
                    onClick={saveStaff}
                    disabled={loading}
                    className="w-full mt-4 bg-slate-900 text-white py-3 rounded-2xl text-xs font-black uppercase hover:bg-black flex items-center justify-center gap-2 disabled:opacity-60"
                  >
                    {loading ? <Loader2 className="animate-spin" size={16} /> : <Save size={16} />}
                    Salvar
                  </button>

                  <button
                    onClick={deleteStaff}
                    disabled={loading}
                    className="w-full mt-2 bg-red-600 text-white py-3 rounded-2xl text-xs font-black uppercase hover:bg-red-500 flex items-center justify-center gap-2 disabled:opacity-60"
                  >
                    <Trash2 size={16} /> Excluir Staff
                  </button>
                </div>

                <div className="bg-slate-50 border border-slate-100 rounded-2xl p-4">
                  <div className="text-[10px] font-black uppercase text-slate-400 mb-2">
                    Etapas que está apitando
                  </div>

                  <div className="flex gap-2">
                    <select
                      className="flex-1 border rounded-xl p-2 text-xs font-bold"
                      value={selected._assignEtapaId || ''}
                      onChange={e => setSelected(prev => ({ ...prev, _assignEtapaId: e.target.value }))}
                    >
                      <option value="">Selecione a etapa…</option>
                      {etapas.map(e => (
                        <option key={e.id} value={e.id}>{e.titulo}</option>
                      ))}
                    </select>

                    <select
                      className="w-32 border rounded-xl p-2 text-xs font-bold"
                      value={selected._assignRole || 'ARBITRO'}
                      onChange={e => setSelected(prev => ({ ...prev, _assignRole: e.target.value }))}
                    >
                      <option value="ARBITRO">ARBITRO</option>
                      <option value="ASSISTENTE">ASSISTENTE</option>
                      <option value="MESARIO">MESARIO</option>
                    </select>

                    <button
                      onClick={assignEtapa}
                      disabled={loading}
                      className="bg-indigo-600 text-white px-3 rounded-xl text-xs font-black uppercase hover:bg-indigo-500 disabled:opacity-60 flex items-center gap-2"
                      title="Adicionar vínculo"
                    >
                      <PlusCircle size={16} />
                      Add
                    </button>
                  </div>

                  <div className="mt-3 space-y-2 max-h-[320px] overflow-y-auto custom-scrollbar">
                    {(selected.vinculos || []).length === 0 ? (
                      <div className="text-[11px] text-slate-400 font-bold">
                        Nenhuma etapa vinculada ainda.
                      </div>
                    ) : (
                      selected.vinculos.map(v => (
                        <div
                          key={v.id}
                          className="bg-white border border-slate-200 rounded-2xl p-3 flex items-center justify-between gap-3"
                        >
                          <div className="min-w-0">
                            <div className="text-[10px] font-black uppercase text-indigo-700">
                              {v.role}
                            </div>
                            <div className="text-xs font-black text-slate-800 truncate">
                              {v.etapa_titulo}
                            </div>
                            <div className="text-[10px] text-slate-400 font-bold">
                              vínculo #{v.id}
                            </div>
                          </div>

                          <button
                            onClick={() => removeVinculo(v.id)}
                            disabled={loading}
                            className="bg-red-50 text-red-600 border border-red-100 px-3 py-2 rounded-xl text-[10px] font-black uppercase hover:bg-red-100 disabled:opacity-60"
                          >
                            Remover
                          </button>
                        </div>
                      ))
                    )}
                  </div>

                  <div className="mt-3 text-[10px] text-slate-400 font-bold">
                    Dica: Para <b>2 árbitros e 1 mesário</b>, adicione 2 vínculos com role ARBITRO e 1 com MESARIO.
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

      </div>
    </main>
  )
}
