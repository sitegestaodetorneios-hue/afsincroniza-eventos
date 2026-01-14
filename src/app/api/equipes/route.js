import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

export async function POST(request) {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );

  try {
    const dados = await request.json();

    if (!dados.senha || dados.senha.trim() === "") {
      return NextResponse.json({ error: "A senha é obrigatória!" }, { status: 400 });
    }

    const { data, error } = await supabase
      .from('equipes')
      .insert([
        {
          nome_equipe: dados.nome_equipe,
          cidade: dados.cidade,
          nome_capitao: dados.nome_capitao,
          whatsapp: dados.whatsapp,
          email: dados.email,
          senha: dados.senha,
          modalidade: dados.modalidade || 'FUTSAL', // SALVA AQUI
          pago: false
        }
      ])
      .select();

    if (error) {
      console.error("ERRO SUPABASE:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, equipe: data[0] });

  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Erro no servidor." }, { status: 500 });
  }
}