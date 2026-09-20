// Supabase Edge Function — cotação de frete via SuperFrete (Correios,
// Jadlog, J&T, Loggi). Formato de requisição/resposta conferido contra a
// documentação oficial (superfrete.readme.io) — não é mais uma suposição.
//
// Existe pra manter o token da API fora do navegador: o site chama esta
// função, ela chama o SuperFrete com o token guardado como secret do
// projeto (nunca commitado), e devolve só as opções de frete.
//
// Configuração necessária no painel do Supabase (Edge Functions > calcular-frete > Secrets),
// NUNCA aqui no código:
//   SUPERFRETE_TOKEN  -> token gerado no painel do SuperFrete
//   ORIGEM_CEP        -> CEP de onde os pacotes são enviados
//   CONTATO_EMAIL     -> e-mail de contato exigido no cabeçalho User-Agent

const SUPERFRETE_URL = 'https://api.superfrete.com/api/v0/calculator';

// Peso aproximado (kg) já considerando embalagem, por tipo de item vendido.
// São estimativas — ajuste aqui se pesar os produtos de verdade na balança.
const PESO_POR_ITEM: Record<string, number> = {
  '3': 0.06,
  '5': 0.08,
  '10': 0.11,
  full: 0.35
};

// Caixa pequena padrão (cm) — cobre a maioria dos pedidos de decant.
const CAIXA_PADRAO = { altura: 4, largura: 12, comprimento: 16 };

// Só o nosso próprio site (e o ambiente local de testes) pode chamar esta função.
// Sem essa lista, qualquer outra página poderia usar nossa cota do SuperFrete escondida.
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

  try {
    const { cepDestino, items } = await req.json();

    if (!cepDestino || !Array.isArray(items) || !items.length) {
      return new Response(JSON.stringify({ error: 'CEP de destino e itens são obrigatórios.' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const pesoTotal = Math.max(
      0.1,
      items.reduce((soma: number, item: { size: string; qty: number }) => {
        const pesoUnitario = PESO_POR_ITEM[item.size] ?? PESO_POR_ITEM['10'];
        return soma + pesoUnitario * (item.qty || 1);
      }, 0)
    );

    const token = Deno.env.get('SUPERFRETE_TOKEN');
    const origemCep = Deno.env.get('ORIGEM_CEP');
    const contatoEmail = Deno.env.get('CONTATO_EMAIL') || 'contato@ebanoemarfim.com.br';

    if (!token || !origemCep) {
      return new Response(JSON.stringify({ error: 'Frete ainda não configurado no servidor.' }), {
        status: 503,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const resposta = await fetch(SUPERFRETE_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        Accept: 'application/json',
        'User-Agent': `Ebano & Marfim (${contatoEmail})`
      },
      body: JSON.stringify({
        from: { postal_code: origemCep },
        to: { postal_code: String(cepDestino).replace(/\D/g, '') },
        services: '1,2,17,3,33,31', // PAC, SEDEX, Mini Envios, Jadlog, J&T, Loggi
        package: {
          height: CAIXA_PADRAO.altura,
          width: CAIXA_PADRAO.largura,
          length: CAIXA_PADRAO.comprimento,
          weight: Number(pesoTotal.toFixed(2))
        }
      })
    });

    const cotacoes = await resposta.json();
    if (!resposta.ok || !Array.isArray(cotacoes)) {
      return new Response(JSON.stringify({ error: 'Não foi possível calcular o frete agora.' }), {
        status: 502,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const opcoes = cotacoes
      .filter((c: any) => !c.has_error && c.price)
      .map((c: any) => ({
        id: c.id,
        transportadora: c.company?.name ?? '',
        servico: c.name,
        preco: Number(c.price),
        dias: c.delivery_time
      }))
      .sort((a: any, b: any) => a.preco - b.preco);

    return new Response(JSON.stringify({ opcoes }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  } catch {
    return new Response(JSON.stringify({ error: 'Requisição inválida.' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
