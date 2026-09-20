// Supabase Edge Function — cria um link de pagamento na InfinitePay
// (Pix + cartão) pra um pedido que já existe no banco, e devolve esse
// link. O cliente é redirecionado pra lá; nenhum dado de cartão passa
// pelo nosso site (menos escopo de PCI-DSS pra nós).
//
// O valor cobrado é sempre o `subtotal` já gravado no pedido — nunca um
// valor vindo do navegador nesta chamada. Esse subtotal já foi validado
// no insert do pedido pelo gatilho calcular_subtotal_pedido (ver
// supabase/product_prices.sql), então aqui só confiamos no banco.
//
// A API de "Checkout Integrado" da InfinitePay não usa chave de API —
// só o seu handle (@usuario) identifica a conta que recebe o pagamento.
// Baseado na documentação interativa deles (Checkout > Documentação).
//
// Secrets necessários (Supabase > Edge Functions > criar-pagamento > Secrets):
//   INFINITEPAY_HANDLE  -> seu handle, sem o "$" (ex.: guilherme-moreira-107)
//   SITE_URL            -> https://gmlf.github.io/Ebano-Marfim (sem barra no final)
//   WEBHOOK_SECRET      -> um segredo que você mesmo inventa (uma senha longa aleatória)
// SUPABASE_URL e SUPABASE_ANON_KEY já existem automaticamente em toda Edge Function.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.116.0';

const ORIGENS_PERMITIDAS = new Set([
  'https://gmlf.github.io',
  'http://localhost:8080',
  'http://127.0.0.1:8080'
]);

function corsHeadersPara(origin: string | null) {
  const origemPermitida = origin && ORIGENS_PERMITIDAS.has(origin) ? origin : 'https://gmlf.github.io';
  return {
    'Access-Control-Allow-Origin': origemPermitida,
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    Vary: 'Origin'
  };
}

Deno.serve(async req => {
  const corsHeaders = corsHeadersPara(req.headers.get('origin'));
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  const erro = (status: number, mensagem: string) =>
    new Response(JSON.stringify({ error: mensagem }), {
      status,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) return erro(401, 'Não autenticado.');

    const { orderId } = await req.json();
    if (!orderId) return erro(400, 'orderId é obrigatório.');

    // Cliente "como o usuário" — a mesma RLS que protege a tabela orders
    // no navegador vale aqui, então só dá pra ler o próprio pedido.
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const clienteUsuario = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } }
    });

    const { data: pedido, error: erroPedido } = await clienteUsuario
      .from('orders')
      .select('id, order_number, subtotal, recipient_name, recipient_phone')
      .eq('id', orderId)
      .single();

    if (erroPedido || !pedido) return erro(404, 'Pedido não encontrado.');

    const handle = Deno.env.get('INFINITEPAY_HANDLE');
    const siteUrl = Deno.env.get('SITE_URL');
    const webhookSecret = Deno.env.get('WEBHOOK_SECRET');

    if (!handle || !siteUrl || !webhookSecret) {
      return erro(503, 'Pagamento ainda não configurado no servidor.');
    }

    const resposta = await fetch('https://api.checkout.infinitepay.io/links', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        handle,
        order_nsu: pedido.order_number,
        redirect_url: `${siteUrl}/checkout.html?pedido=${pedido.order_number}`,
        webhook_url: `${supabaseUrl}/functions/v1/pagamento-webhook?token=${webhookSecret}`,
        items: [
          {
            quantity: 1,
            price: Math.round(Number(pedido.subtotal) * 100), // InfinitePay espera centavos
            description: `Pedido #${pedido.order_number} — Ébano & Marfim`
          }
        ],
        customer: {
          name: pedido.recipient_name || undefined,
          phone_number: pedido.recipient_phone || undefined
        }
      })
    });

    const dados = await resposta.json();
    // A documentação não mostrou o formato exato da resposta — tentamos os
    // nomes de campo mais prováveis. Se nenhum bater, dá pra ver a resposta
    // real nos logs desta função (Supabase > Edge Functions > Logs) e ajustar aqui.
    const checkoutUrl = dados.url || dados.checkout_url || dados.link || dados.payment_url;

    if (!resposta.ok || !checkoutUrl) {
      console.error('[criar-pagamento] resposta inesperada da InfinitePay:', JSON.stringify(dados));
      return erro(502, 'Não foi possível criar o pagamento agora.');
    }

    return new Response(JSON.stringify({ checkoutUrl }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  } catch (e) {
    console.error('[criar-pagamento] erro:', e);
    return erro(400, 'Requisição inválida.');
  }
});
