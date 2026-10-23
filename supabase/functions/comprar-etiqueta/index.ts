// Supabase Edge Function — compra uma etiqueta de envio de verdade no
// SuperFrete pra um pedido já pago. Gasta saldo real da carteira SuperFrete:
// só é chamada quando o admin clica "Comprar etiqueta de envio" em
// "Pedidos e envio" — nunca acontece sozinha.
//
// Fluxo (conferido contra a documentação oficial, superfrete.readme.io):
//   1. POST /api/v0/cart          -> cria a etiqueta (status "pending")
//   2. POST /api/v0/checkout      -> paga a etiqueta com o saldo da carteira
//                                     (é aqui que o dinheiro sai de verdade)
// Depois disso o SuperFrete manda os eventos order.posted / order.delivered
// pro webhook (supabase/functions/superfrete-webhook), que atualiza o
// status do pedido sozinho — não precisamos consultar status aqui.
//
// Secrets necessários (Supabase > Edge Functions > comprar-etiqueta > Secrets):
//   SUPERFRETE_TOKEN    -> mesmo token usado em calcular-frete
//   ORIGEM_CEP          -> CEP de onde os pacotes saem (já existe)
//   ORIGEM_NOME         -> nome do remetente (mínimo 2 palavras; prefixe com "Loja" se for um nome só)
//   ORIGEM_RUA          -> rua do remetente
//   ORIGEM_NUMERO       -> número do remetente (pode ser "" se não tiver)
//   ORIGEM_BAIRRO       -> bairro do remetente
//   ORIGEM_CIDADE       -> cidade do remetente
//   ORIGEM_UF           -> estado do remetente, 2 letras
//   ORIGEM_DOCUMENTO    -> CPF ou CNPJ do remetente
//   CONTATO_EMAIL       -> já existe, usado no User-Agent

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.116.0';

const SUPERFRETE_BASE = 'https://api.superfrete.com/api/v0';
const PESO_POR_FRASCO = 0.35;
const CAIXA_PADRAO = { altura: 6, largura: 12, comprimento: 16 };

// Tolerância pra recotação abaixo: cotação de frete varia um pouco de uma
// chamada pra outra (promoções, cache do SuperFrete), então não trava por
// qualquer centavo de diferença, só quando o preço real é bem maior do que
// o que foi cobrado do cliente.
const TOLERANCIA_FRETE_REAIS = 5;
const TOLERANCIA_FRETE_PERCENTUAL = 0.2;

const ORIGENS_PERMITIDAS = new Set([
  'https://gmlf.github.io',
  'https://ebanomarfim.com.br',
  'https://www.ebanomarfim.com.br',
  'http://localhost:8080',
  'http://127.0.0.1:8080'
]);

function corsHeadersPara(origin: string | null) {
  const origemPermitida = origin && ORIGENS_PERMITIDAS.has(origin) ? origin : 'https://ebanomarfim.com.br';
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

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const clienteUsuario = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } }
    });

    // admin_get_order_envio já confere is_admin() lá dentro — linha vazia
    // aqui significa "não é admin" ou "pedido não existe", tratamos igual
    const { data: linhas, error: erroPedido } = await clienteUsuario.rpc('admin_get_order_envio', { pedido_id: orderId });
    const pedido = Array.isArray(linhas) ? linhas[0] : null;
    if (erroPedido || !pedido) return erro(403, 'Pedido não encontrado ou você não tem permissão de administrador.');

    if (pedido.superfrete_label_id) {
      return new Response(JSON.stringify({
        jaComprada: true,
        trackingCode: pedido.tracking_code,
        labelPrintUrl: pedido.label_print_url
      }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }
    if (!pedido.shipping_service_id) {
      return erro(400, 'Esse pedido não usa transportadora (é entrega própria ou não tem frete salvo), não dá pra comprar etiqueta.');
    }
    if (!pedido.recipient_document) {
      return erro(400, 'Esse pedido não tem CPF do destinatário salvo: o SuperFrete exige pra gerar etiqueta.');
    }

    // trim: secrets colados no painel do Supabase podem vir com "\n" invisível no fim
    const env = (nome: string) => Deno.env.get(nome)?.trim();
    const token = env('SUPERFRETE_TOKEN');
    const contatoEmail = env('CONTATO_EMAIL') || 'ebanoemarfimoficial@gmail.com';
    const origem = {
      nome: env('ORIGEM_NOME'),
      cep: env('ORIGEM_CEP'),
      rua: env('ORIGEM_RUA'),
      numero: env('ORIGEM_NUMERO') || '',
      bairro: env('ORIGEM_BAIRRO'),
      cidade: env('ORIGEM_CIDADE'),
      uf: env('ORIGEM_UF'),
      documento: env('ORIGEM_DOCUMENTO')
    };
    if (!token || !origem.nome || !origem.cep || !origem.rua || !origem.bairro || !origem.cidade || !origem.uf) {
      return erro(503, 'Compra de etiqueta ainda não configurada no servidor (faltam secrets de origem).');
    }

    const pesoTotal = Math.max(
      0.1,
      (pedido.items || []).reduce((soma: number, item: { qty: number }) => soma + PESO_POR_FRASCO * (item.qty || 1), 0)
    );

    const headersSuperfreteConsulta = {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      Accept: 'application/json',
      'User-Agent': `Ebano & Marfim (${contatoEmail})`
    };

    // shipping_service_id e shipping_price vêm do pedido, que o checkout.js
    // preenche no navegador — ou seja, um cliente poderia adulterar o
    // serviço escolhido (ex.: trocar PAC barato por SEDEX caro) sem mudar o
    // preço mostrado. Antes de gastar saldo de verdade, recotamos aqui no
    // servidor pro mesmo serviço e CEP, e abortamos se o preço real for bem
    // maior do que o que foi cobrado do cliente.
    const respRecotacao = await fetch(`${SUPERFRETE_BASE}/calculator`, {
      method: 'POST',
      headers: headersSuperfreteConsulta,
      body: JSON.stringify({
        from: { postal_code: String(origem.cep).replace(/\D/g, '') },
        to: { postal_code: String(pedido.cep).replace(/\D/g, '') },
        services: String(pedido.shipping_service_id),
        package: {
          height: CAIXA_PADRAO.altura,
          width: CAIXA_PADRAO.largura,
          length: CAIXA_PADRAO.comprimento,
          weight: Number(pesoTotal.toFixed(2))
        }
      })
    });
    const cotacoesReais = await respRecotacao.json();
    if (!respRecotacao.ok || !Array.isArray(cotacoesReais)) {
      return erro(502, 'Não foi possível conferir o preço real do frete agora. Tente de novo em instantes.');
    }
    const cotacaoReal = cotacoesReais.find((c: any) => String(c.id) === String(pedido.shipping_service_id) && !c.has_error);
    if (!cotacaoReal || !cotacaoReal.price) {
      return erro(502, 'O SuperFrete não devolveu preço pra esse serviço de envio agora. Confira manualmente antes de comprar.');
    }
    const precoReal = Number(cotacaoReal.price);
    const precoCobrado = Number(pedido.shipping_price || 0);
    const tolerancia = Math.max(TOLERANCIA_FRETE_REAIS, precoCobrado * TOLERANCIA_FRETE_PERCENTUAL);
    if (precoReal > precoCobrado + tolerancia) {
      console.error(
        `[comprar-etiqueta] preço real (R$${precoReal}) muito maior que o cobrado do cliente (R$${precoCobrado}) no pedido ${orderId}`
      );
      return erro(
        409,
        `O frete real desse serviço custa R$${precoReal.toFixed(2)}, bem mais do que os R$${precoCobrado.toFixed(2)} cobrados do cliente. Confira o pedido antes de comprar a etiqueta.`
      );
    }

    const corpoCarrinho = {
      from: {
        name: origem.nome,
        address: origem.rua,
        number: origem.numero,
        district: origem.bairro,
        city: origem.cidade,
        state_abbr: origem.uf,
        postal_code: String(origem.cep).replace(/\D/g, ''),
        document: origem.documento
      },
      to: {
        name: pedido.recipient_name,
        address: pedido.street,
        number: pedido.number || '',
        district: pedido.neighborhood || 'NA',
        city: pedido.city,
        state_abbr: pedido.state,
        postal_code: String(pedido.cep).replace(/\D/g, ''),
        phone: String(pedido.recipient_phone || '').replace(/\D/g, ''),
        document: pedido.recipient_document
      },
      service: pedido.shipping_service_id,
      products: (pedido.items || []).map((i: { name: string; qty: number; price: number }) => ({
        name: i.name,
        quantity: String(i.qty || 1),
        unitary_value: String(i.price || 0)
      })),
      volumes: {
        height: CAIXA_PADRAO.altura,
        width: CAIXA_PADRAO.largura,
        length: CAIXA_PADRAO.comprimento,
        weight: Number(pesoTotal.toFixed(2))
      },
      options: {
        non_commercial: true,
        receipt: false,
        own_hand: false,
        tags: [{ tag: `Pedido ${pedido.order_number}`, url: 'https://ebanomarfim.com.br' }]
      },
      platform: 'Ébano & Marfim'
    };

    const respCarrinho = await fetch(`${SUPERFRETE_BASE}/cart`, {
      method: 'POST',
      headers: headersSuperfreteConsulta,
      body: JSON.stringify(corpoCarrinho)
    });
    const dadosCarrinho = await respCarrinho.json();
    if (!respCarrinho.ok || !dadosCarrinho.id) {
      console.error('[comprar-etiqueta] erro no /cart:', JSON.stringify(dadosCarrinho));
      return erro(502, 'O SuperFrete recusou os dados do envio. Confira endereço e CPF do pedido.');
    }

    // paga a etiqueta com o saldo da carteira — a partir daqui o dinheiro saiu de verdade
    const respCheckout = await fetch(`${SUPERFRETE_BASE}/checkout`, {
      method: 'POST',
      headers: headersSuperfreteConsulta,
      body: JSON.stringify({ orders: [dadosCarrinho.id] })
    });
    const dadosCheckout = await respCheckout.json();
    if (!respCheckout.ok || !dadosCheckout.success) {
      console.error('[comprar-etiqueta] erro no /checkout:', JSON.stringify(dadosCheckout));
      return erro(502, 'Não foi possível pagar a etiqueta. Confira o saldo da carteira no painel do SuperFrete.');
    }

    const pedidoPago = dadosCheckout.purchase?.orders?.[0];
    const trackingCode = pedidoPago?.tracking || null;
    const labelPrintUrl = pedidoPago?.print?.url || null;

    const { error: erroSalvar } = await clienteUsuario.rpc('admin_salvar_etiqueta', {
      pedido_id: orderId,
      superfrete_id: dadosCarrinho.id,
      tracking: trackingCode,
      label_url: labelPrintUrl
    });
    if (erroSalvar) {
      // a etiqueta JÁ foi comprada e paga nesse ponto — não falha silenciosamente,
      // loga alto pro admin conseguir salvar manualmente se precisar
      console.error('[comprar-etiqueta] etiqueta comprada mas não salva no pedido:', orderId, dadosCarrinho.id, erroSalvar.message);
      return erro(500, `Etiqueta comprada (rastreio ${trackingCode}), mas não deu pra salvar no pedido. Anote esse código e avise o suporte técnico.`);
    }

    return new Response(JSON.stringify({ trackingCode, labelPrintUrl }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  } catch (e) {
    console.error('[comprar-etiqueta] erro:', e);
    return erro(400, 'Requisição inválida.');
  }
});
