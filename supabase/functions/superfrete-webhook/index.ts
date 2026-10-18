// Supabase Edge Function — recebe os avisos automáticos do SuperFrete
// quando o status de uma etiqueta muda, e atualiza o pedido sozinho:
// order.posted -> status vira "enviado"; order.delivered -> vira "entregue".
// É isso que faz a esteira de Minha Conta avançar sem ninguém precisar
// clicar em nada depois que a etiqueta foi comprada.
//
// Segurança: essa URL é pública (o SuperFrete precisa conseguir chamá-la
// de fora). Cada chamada vem assinada com HMAC-SHA256 no cabeçalho
// X-ME-Signature, calculado sobre o corpo cru da requisição usando o
// "secret_token" que você define ao cadastrar o webhook no painel do
// SuperFrete — conferimos essa assinatura antes de confiar em qualquer
// coisa do corpo. Usa a service_role só pra essa escrita pontual.
//
// Configuração (feita no painel do SuperFrete, Integrações > Webhooks,
// não tem como fazer isso por código):
//   URL do webhook: https://<seu-projeto>.supabase.co/functions/v1/superfrete-webhook
//   Eventos: order.posted, order.delivered
//   Secret necessário aqui (Supabase > Edge Functions > superfrete-webhook > Secrets):
//     SUPERFRETE_WEBHOOK_SECRET -> o MESMO "secret_token" cadastrado no painel do SuperFrete

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.116.0';

async function assinaturaValida(corpoCru: string, assinaturaRecebida: string | null, segredo: string): Promise<boolean> {
  if (!assinaturaRecebida) return false;
  const chave = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(segredo),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const assinaturaCalculada = await crypto.subtle.sign('HMAC', chave, new TextEncoder().encode(corpoCru));
  const hexCalculada = Array.from(new Uint8Array(assinaturaCalculada))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
  // o hex calculado aqui sempre sai minúsculo — normaliza o recebido pro
  // mesmo caso antes de comparar, pra não rejeitar um webhook legítimo só
  // porque o SuperFrete mandou a assinatura em maiúsculas
  const hexRecebida = assinaturaRecebida.toLowerCase();
  // comparação em tempo constante — evita vazar a assinatura certa por timing
  if (hexCalculada.length !== hexRecebida.length) return false;
  let diferenca = 0;
  for (let i = 0; i < hexCalculada.length; i++) {
    diferenca |= hexCalculada.charCodeAt(i) ^ hexRecebida.charCodeAt(i);
  }
  return diferenca === 0;
}

Deno.serve(async req => {
  try {
    const corpoCru = await req.text();
    const segredo = Deno.env.get('SUPERFRETE_WEBHOOK_SECRET');
    const assinatura = req.headers.get('x-me-signature');

    if (!segredo) {
      console.error('[superfrete-webhook] SUPERFRETE_WEBHOOK_SECRET não configurado.');
      return new Response('não configurado', { status: 503 });
    }
    if (!(await assinaturaValida(corpoCru, assinatura, segredo))) {
      return new Response('assinatura inválida', { status: 401 });
    }

    const payload = JSON.parse(corpoCru);
    console.log('[superfrete-webhook] evento recebido:', payload.event);

    const labelId = payload.data?.id;
    if (!labelId) return new Response('ok (sem id)', { status: 200 });

    // só os dois eventos que nos interessam avançam o status do pedido —
    // os outros (created/released/generated/cancelled) a gente só loga
    const NOVO_STATUS: Record<string, string> = {
      'order.posted': 'enviado',
      'order.delivered': 'entregue'
    };
    const novoStatus = NOVO_STATUS[payload.event];
    if (!novoStatus) return new Response('ok (evento ignorado)', { status: 200 });

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const admin = createClient(supabaseUrl, serviceRoleKey);

    const { data: pedido } = await admin
      .from('orders')
      .select('id, status')
      .eq('superfrete_label_id', labelId)
      .maybeSingle();

    if (!pedido) {
      console.error('[superfrete-webhook] nenhum pedido com superfrete_label_id =', labelId);
      return new Response('pedido não encontrado', { status: 200 }); // 200 pra não ficar tentando de novo
    }

    // só avança, nunca retrocede — se por algum motivo o evento de "postado"
    // chegar atrasado depois do de "entregue", não desfaz o progresso
    const ORDEM = ['pendente', 'pago', 'enviado', 'entregue', 'cancelado'];
    if (ORDEM.indexOf(novoStatus) <= ORDEM.indexOf(pedido.status)) {
      return new Response('ok (já estava nesse status ou à frente)', { status: 200 });
    }

    const { error } = await admin.from('orders').update({ status: novoStatus }).eq('id', pedido.id);
    if (error) {
      console.error('[superfrete-webhook] erro ao atualizar pedido:', error.message);
      return new Response('erro ao atualizar pedido', { status: 500 });
    }

    return new Response('ok', { status: 200 });
  } catch (e) {
    console.error('[superfrete-webhook] payload inválido:', e);
    return new Response('erro', { status: 400 });
  }
});
