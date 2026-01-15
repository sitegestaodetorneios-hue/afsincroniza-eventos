// ... (mantenha seus imports e configs de topo iguais)

export async function POST(request) {
  try {
    const body = await request.json().catch(() => ({}))
    const paymentId = body?.data?.id || body?.id
    const type = body?.type || body?.topic

    if (!paymentId || (type && !['payment', 'payment.updated', 'payment.created'].includes(String(type).toLowerCase()))) {
      return NextResponse.json({ ok: true })
    }

    const payment = new Payment(client)
    const mp = await payment.get({ id: paymentId })

    const status = mp?.status
    const emailVinculado = mp?.external_reference // O email vindo do checkout

    const supabase = supabaseAdmin()

    // 1. Log opcional na tabela de pagamentos
    await supabase.from('pagamentos').update({ status }).eq('mp_payment_id', String(paymentId))

    // 2. ✅ LIBERAÇÃO DA EQUIPE (Ajustado para maior compatibilidade)
    if (status === 'approved' && emailVinculado) {
      const { error } = await supabase
        .from('equipes')
        .update({ pago: true })
        .ilike('email', emailVinculado.trim()) // 👈 ILIKE é mais seguro que EQ

      if (error) {
        console.error('Erro Supabase ao liberar equipe:', error.message)
      } else {
        console.log(`✅ Sucesso: Equipe ${emailVinculado} liberada.`)
      }
    }

    return NextResponse.json({ ok: true })
  } catch (e) {
    console.error('Erro Crítico Webhook:', e.message)
    return NextResponse.json({ ok: true }) 
  }
}