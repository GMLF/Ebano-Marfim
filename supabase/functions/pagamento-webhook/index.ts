// Supabase Edge Function — recebe o aviso da InfinitePay quando um
// pagamento é aprovado, e marca o pedido correspondente como "pago".
//
// Segundo a documentação da InfinitePay, esse webhook só é chamado
// QUANDO O PAGAMENTO JÁ FOI APROVADO — não existe um campo de "status"
// no corpo pra checar, o próprio disparo do webhook é a confirmação.
// O pedido é encontrado pelo order_nsu, que enviamos como sendo o
// order_number do pedido (ver criar-pagamento/index.ts).
//
// Segurança: essa URL é pública na internet (a InfinitePay precisa
// conseguir chamá-la de fora). Por isso só aceitamos a chamada se vier
// com o segredo certo no parâmetro ?token= — sem isso, qualquer um
// poderia tentar marcar um pedido como pago sem ter pago de verdade.
// Também conferimos se o valor pago bate com o subtotal do pedido antes
// de confirmar, como uma segunda camada de proteção.
// Usa a service_role (só existe aqui no servidor, nunca no navegador)
// porque quem chama isso é a InfinitePay, não o cliente logado.
//
// Secret necessário (Supabase > Edge Functions > pagamento-webhook > Secrets):
//   WEBHOOK_SECRET -> o MESMO valor configurado em criar-pagamento

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.116.0';

Deno.serve(async req => {
  try {
    const url = new URL(req.url);
    const token = url.searchParams.get('token');
    const segredoEsperado = Deno.env.get('WEBHOOK_SECRET');

    if (!segredoEsperado || token !== segredoEsperado) {
      return new Response('não autorizado', { status: 401 });
    }

    const corpo = await req.json();
    console.log('[pagamento-webhook] payload recebido:', JSON.stringify(corpo));

    const orderNsu = corpo.order_nsu;
    const valorPagoCentavos = Number(corpo.paid_amount ?? corpo.amount);

    if (!orderNsu || !valorPagoCentavos) {
      return new Response('ignorado (sem order_nsu ou valor)', { status: 200 });
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const admin = createClient(supabaseUrl, serviceRoleKey);

    const { data: pedido } = await admin
      .from('orders')
      .select('id, subtotal, status')
      .eq('order_number', orderNsu)
      .single();

    if (!pedido) {
      console.error('[pagamento-webhook] pedido não encontrado pra order_nsu:', orderNsu);
      return new Response('pedido não encontrado', { status: 200 }); // 200 pra não ficar tentando de novo
    }

    const valorEsperadoCentavos = Math.round(Number(pedido.subtotal) * 100);
    if (valorPagoCentavos !== valorEsperadoCentavos) {
      console.error(`[pagamento-webhook] valor pago (${valorPagoCentavos}) diferente do esperado (${valorEsperadoCentavos}) pro pedido ${orderNsu} — não confirmado automaticamente.`);
      return new Response('valor não confere', { status: 200 });
    }

    if (pedido.status !== 'pendente') {
      return new Response('ok (já processado)', { status: 200 });
    }

    const { error } = await admin.from('orders').update({ status: 'pago' }).eq('id', pedido.id);
    if (error) {
      console.error('[pagamento-webhook] erro ao atualizar pedido:', error.message);
      return new Response('erro ao atualizar pedido', { status: 500 });
    }

    return new Response('ok', { status: 200 });
  } catch (e) {
    console.error('[pagamento-webhook] payload inválido:', e);
    return new Response('erro', { status: 400 });
  }
});
