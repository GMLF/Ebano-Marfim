// Supabase Edge Function — precificação automática a partir do preço médio
// em dólar de cada perfume no comprasparaguai.com.br.
//
// Por que isso existe: em vez de editar preço à mão sempre que o dólar ou o
// custo em Assunção muda, isso busca a cotação do dia e o preço médio das
// ofertas de cada produto mapeado em product_sources, aplica a fórmula de
// custo/margem combinada com o Caio e grava em product_prices — a mesma
// tabela que o gatilho do pedido (product_prices.sql) já usa como fonte de
// verdade. Um cron no banco (ver pricing_automation.sql) chama esta function
// a cada hora.
//
// Só é chamada pelo cron do Supabase, nunca pelo navegador — por isso a
// proteção é um header secreto, não uma lista de origens (CORS) como em
// calcular-frete.
//
// Configuração necessária (Edge Functions > atualizar-precos > Secrets):
//   SUPABASE_URL              -> já existe por padrão no ambiente da function
//   SUPABASE_SERVICE_ROLE_KEY -> já existe por padrão no ambiente da function
//   PRECOS_CRON_SECRET        -> mesmo valor colado no cron.schedule (pricing_automation.sql)

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.116.0';

const COMPRASPARAGUAI_BASE = 'https://www.comprasparaguai.com.br';

// Constantes da fórmula combinada com o Caio — nomeadas aqui pra dar pra
// somar "perda" e "margem de mão de obra" depois sem reescrever a conta.
const TAXA_IMPORTACAO = 0.20; // o "+20%" sobre o custo em reais
const MARGEM_MONETARIA = 0.03; // os 3% de margem, aplicados por último
const EMBALAGEM = 12; // custo fixo de embalagem (reais), entra em fechado e decante
const MULT_FECHADO = 1.5;
const MULT_DECANTE = 2;

function round2(n: number) {
  return Math.round(n * 100) / 100;
}

// o robots.txt do comprasparaguai pede 10s de intervalo entre requisições de
// bot — com poucos produtos mapeados isso ainda cabe bem dentro de 1h; se a
// lista em product_sources crescer muito, essa function vai precisar ser
// dividida em lotes (ou o intervalo do cron, aumentado).
const CRAWL_DELAY_MS = 10_000;
function esperar(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function parseBRNumber(text: string): number {
  // "1.234,56" -> 1234.56
  return Number(text.replace(/\./g, '').replace(',', '.'));
}

async function buscarCotacaoDolar(): Promise<number | null> {
  const resposta = await fetch(COMPRASPARAGUAI_BASE + '/');
  if (!resposta.ok) return null;
  const html = await resposta.text();
  const match = html.match(/cotacao-label">D[oó]lar hoje:<\/span>\s*<strong>R\$\s*([\d.,]+)<\/strong>/);
  if (!match) return null;
  const valor = parseBRNumber(match[1]);
  return Number.isFinite(valor) && valor > 0 ? valor : null;
}

async function buscarPrecoMedioUsd(urlRelativa: string): Promise<{ mediaUsd: number; ofertas: number } | null> {
  const resposta = await fetch(COMPRASPARAGUAI_BASE + urlRelativa);
  if (!resposta.ok) return null;
  const html = await resposta.text();

  // produtos com muitas ofertas (marcas grandes, tipo Dior) listam cada loja
  // nesse bloco — é a lista completa, usada pra tirar a média de verdade.
  const regexLista = /promocao-item-preco-oferta flex column">\s*<span>\s*<strong>\s*US\$\s*([\d.,]+)\s*<\/strong>/g;
  const precos: number[] = [];
  let m: RegExpExecArray | null;
  while ((m = regexLista.exec(html))) {
    const valor = parseBRNumber(m[1]);
    if (Number.isFinite(valor) && valor > 0) precos.push(valor);
  }

  // produtos com só 1-2 ofertas (comum em marcas nicho, tipo Mykonos) usam
  // outro template: preço único no topo da página, sem a lista acima. Nesse
  // template não tem o rótulo "A partir de:" antes do preço (quando tem, é
  // só o resumo do mínimo de uma lista que a gente já leu acima).
  if (!precos.length) {
    const fallback = html.match(/header-product-info--price">\s*<div class="flex wrap align-items-center">\s*<span>US\$\s*([\d.,]+)<\/span>/);
    if (fallback) {
      const valor = parseBRNumber(fallback[1]);
      if (Number.isFinite(valor) && valor > 0) precos.push(valor);
    }
  }

  if (!precos.length) return { mediaUsd: 0, ofertas: 0 };
  const media = precos.reduce((s, v) => s + v, 0) / precos.length;
  return { mediaUsd: media, ofertas: precos.length };
}

function calcularPrecos(mediaUsd: number, cotacao: number, bottleMl: number) {
  const custoBase = mediaUsd * cotacao;
  const custoComTaxa = custoBase * (1 + TAXA_IMPORTACAO);
  const precoPorMl = (custoComTaxa * MULT_DECANTE) / bottleMl;

  const decante = (ml: number) => round2((precoPorMl * ml + EMBALAGEM) * (1 + MARGEM_MONETARIA));
  const fechado = round2((custoComTaxa * MULT_FECHADO + EMBALAGEM) * (1 + MARGEM_MONETARIA));

  return {
    '3': decante(3),
    '5': decante(5),
    '10': decante(10),
    full: fechado
  };
}

Deno.serve(async req => {
  const segredoEsperado = Deno.env.get('PRECOS_CRON_SECRET');
  if (!segredoEsperado || req.headers.get('x-cron-secret') !== segredoEsperado) {
    return new Response(JSON.stringify({ error: 'Não autorizado.' }), { status: 401 });
  }

  const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

  const cotacao = await buscarCotacaoDolar();
  if (!cotacao) {
    return new Response(JSON.stringify({ error: 'Não consegui ler a cotação do dólar agora.' }), { status: 502 });
  }

  const { data: fontes, error: erroFontes } = await supabase.from('product_sources').select('*');
  if (erroFontes || !fontes) {
    return new Response(JSON.stringify({ error: 'Não consegui ler product_sources.' }), { status: 500 });
  }

  const resumo: Record<string, string> = {};

  for (const [indice, fonte] of fontes.entries()) {
    if (indice > 0) await esperar(CRAWL_DELAY_MS);
    try {
      const resultado = await buscarPrecoMedioUsd(fonte.comprasparaguai_url);
      if (!resultado) {
        resumo[fonte.product_id] = 'falha ao buscar a página (mantido preço anterior)';
        continue;
      }
      if (resultado.ofertas === 0) {
        await supabase.from('product_prices')
          .update({ in_stock: false, updated_at: new Date().toISOString() })
          .eq('product_id', fonte.product_id);
        resumo[fonte.product_id] = 'esgotado (0 ofertas no comprasparaguai)';
        continue;
      }

      const precos = calcularPrecos(resultado.mediaUsd, cotacao, Number(fonte.bottle_ml));
      const agora = new Date().toISOString();
      const linhas = (['3', '5', '10', 'full'] as const).map(size => ({
        product_id: fonte.product_id,
        size,
        price: precos[size],
        in_stock: true,
        updated_at: agora
      }));
      const { error: erroUpsert } = await supabase.from('product_prices').upsert(linhas, { onConflict: 'product_id,size' });
      resumo[fonte.product_id] = erroUpsert
        ? `erro ao gravar: ${erroUpsert.message}`
        : `ok — média US$ ${resultado.mediaUsd.toFixed(2)} (${resultado.ofertas} ofertas), fechado R$ ${precos.full}`;
    } catch (erro) {
      resumo[fonte.product_id] = `erro inesperado: ${erro instanceof Error ? erro.message : String(erro)}`;
    }
  }

  return new Response(JSON.stringify({ cotacao, resumo }), { headers: { 'Content-Type': 'application/json' } });
});
