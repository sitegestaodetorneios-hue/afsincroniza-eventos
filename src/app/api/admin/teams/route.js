import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

// 1. AUTENTICAÇÃO (Melhorada para aceitar ENV ou o PIN '2026' do frontend)
function isAuthorized(request) {
  const pin = request.headers.get('x-admin-pin') || ''
  // Aceita o PIN definido no ambiente OU o padrão '2026' usado no código do frontend
  return pin && (pin === process.env.ADMIN_PIN || pin === '2026')
}

// 2. CLIENTE ADMIN (Mantive sua lógica robusta de Service Role)
function supabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  // Tenta Service Role (poder total), se não tiver, usa a Anon Key
  const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!url || !serviceRole) {
    throw new Error('Supabase env ausente: Verifique suas variáveis de ambiente.')
  }

  return createClient(url, serviceRole, {
    auth: { persistSession: false },
  })
}

// 3. SANITIZAÇÃO (Mantive sua segurança para não vazar senhas)
function sanitizeTeam(row) {
  if (!row) return row
  const { senha, password, ...safe } = row
  return safe
}

// --- GET: LISTAR TIMES ---
export async function GET(request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  }

  try {
    const supabase = supabaseAdmin()
    const { data, error } = await supabase
      .from('equipes')
      .select('*')
      .order('created_at', { ascending: false })

    if (error) throw error

    // Sanitiza e retorna
    const safe = (data || []).map(sanitizeTeam)
    return NextResponse.json(safe)

  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

// --- PUT: AÇÕES DE GERENCIAMENTO ---
export async function PUT(request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  }

  try {
    const supabase = supabaseAdmin()
    let body

    try {
      body = await request.json()
    } catch {
      return NextResponse.json({ error: 'JSON inválido' }, { status: 400 })
    }

    const { action, id } = body || {}

    if (!id || !action) {
      return NextResponse.json({ error: 'Parâmetros obrigatórios: action, id' }, { status: 400 })
    }

    // Lista de ações permitidas (Adicionado 'approve_doc')
    if (!['delete', 'approve', 'approve_doc'].includes(action)) {
      return NextResponse.json({ error: 'Ação inválida' }, { status: 400 })
    }

    // 1. EXCLUIR EQUIPE (E seus atletas por segurança)
    if (action === 'delete') {
      // Tenta apagar atletas primeiro para não dar erro de chave estrangeira
      await supabase.from('atletas').delete().eq('equipe_id', id)
      
      const { error } = await supabase.from('equipes').delete().eq('id', id)
      if (error) throw error
    }

    // 2. APROVAR PAGAMENTO
    if (action === 'approve') {
      const { error } = await supabase
        .from('equipes')
        .update({ pago: true })
        .eq('id', id)
      if (error) throw error
    }

    // 3. APROVAR DOCUMENTO (Novo!)
    if (action === 'approve_doc') {
      const { error } = await supabase
        .from('equipes')
        .update({ termo_assinado: true })
        .eq('id', id)
      if (error) throw error
    }

    return NextResponse.json({ success: true })

  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}