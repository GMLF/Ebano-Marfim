// Supabase Edge Function — recebe o aviso da InfinitePay quando um
// pagamento é confirmado, e marca o pedido correspondente como "pago".
//
// Segurança: essa URL é pública na internet (a InfinitePay precisa
// conseguir chamá-la de fora). Por isso só aceitamos a chamada se vier
// com o segredo certo no parâmetro ?token= — sem isso, qualquer um
// poderia tentar marcar um pedido como pago sem ter pago de verdade.
// Usa a service_role (só existe aqui no servidor, nunca no navegador)
// porque quem chama isso é a InfinitePay, não o cliente logado — não
// dá pra usar a sessão de ninguém pra essa escrita.
//
// IMPORTANTE: os nomes dos campos do corpo do webhook (order_nsu, status)
// são a melhor tentativa com base na documentação pública da InfinitePay —
// ainda não vimos um webhook real chegando. Assim que configurar e testar
// um pagamento de verdade, se o status não bater no pedido, me manda o
// payload que a InfinitePay realmente envia (dá pra ver nos logs da
// função, em Supabase > Edge Functions > pagamento-webhook > Logs) que a
// gente ajusta os nomes dos campos.
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

    const orderId = corpo.order_nsu || corpo.data?.order_nsu || corpo.nsu;
    const statusBruto = String(corpo.status || corpo.data?.status || '').toLowerCase();
    const statusConfirmado = ['paid', 'approved', 'completed', 'success'].includes(statusBruto);

    if (!orderId || !statusConfirmado) {
      return new Response('ignorado (status não confirmado ou sem order_nsu)', { status: 200 });
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const admin = createClient(supabaseUrl, serviceRoleKey);

    const { error } = await admin
      .from('orders')
      .update({ status: 'pago' })
      .eq('id', orderId)
      .eq('status', 'pendente'); // não sobrescreve um pedido já enviado/cancelado manualmente

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
