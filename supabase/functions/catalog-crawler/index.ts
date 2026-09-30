// Supabase Edge Function — crawler incremental que importa o catálogo
// inteiro de perfumes do comprasparaguai.com.br (nome, marca, foto, notas
// e preço), não só os poucos produtos que a loja já vende (esses usam
// supabase/functions/atualizar-precos, com URL curada por produto).
//
// Por que "incremental": são ~26.807 produtos em ~500 páginas de listagem,
// e o robots.txt deles pede 10s entre requisições — não cabe numa function
// só. Esta roda a cada 2 minutos (ver catalog_import.sql) e faz só um
// pedaço por vez: 1 página de listagem nova (descobre produtos) + um lote
// de produtos pra completar com detalhe (foto/notas/preço), sempre os mais
// antigos primeiro. Uma volta completa no catálogo leva alguns dias; depois
// disso, o mesmo ritmo mantém os produtos revisitados (preço/estoque).
//
// Fotos ficam como link direto pro comprasparaguai (hotlink) — não são
// baixadas nem re-hospedadas.
//
// Configuração necessária (Edge Functions > catalog-crawler > Secrets):
//   SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY -> já existem por padrão
//   CATALOG_CRON_SECRET                      -> mesmo valor colado no cron.schedule (catalog_import.sql)

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.116.0';

const COMPRASPARAGUAI_BASE = 'https://www.comprasparaguai.com.br';
const CRAWL_DELAY_MS = 10_000; // robots.txt: crawl-delay 10 pra bots
const DETALHES_POR_EXECUCAO = 6; // lote pequeno de propósito — um lote de 15 estourou o limite de tempo/recursos da Edge Function (~170-190s); 6 fica bem abaixo disso. O cron roda mais vezes (2 em 2 min) pra manter o mesmo ritmo total.

// mesma fórmula de atualizar-precos/index.ts — mantidas iguais nas duas
// functions de propósito, pra todo produto (curado ou importado) seguir a
// mesma conta de custo/margem combinada com o Caio.
const TAXA_IMPORTACAO = 0.20;
const MARGEM_MONETARIA = 0.03;
const EMBALAGEM = 12;
const MULT_FECHADO = 1.5;
const MULT_DECANTE = 2;

function esperar(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function parseBRNumber(text: string): number {
  return Number(text.replace(/\./g, '').replace(',', '.'));
}

function round2(n: number) {
  return Math.round(n * 100) / 100;
}

const DIACRITICOS_REGEX = new RegExp('[̀-ͯ]', 'g');
function slugify(s: string): string {
  return s
    .normalize('NFD').replace(DIACRITICOS_REGEX, '')
    .toLowerCase().trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-');
}

function gerarMatchNotes(...textos: (string | null | undefined)[]): string[] {
  const notas = new Set<string>();
  for (const texto of textos) {
    if (!texto) continue;
    texto.split(/,| e | ou /i).map(s => s.trim()).filter(Boolean).forEach(s => {
      const slug = slugify(s);
      if (slug) notas.add(slug);
    });
  }
  return [...notas];
}

function mapearFamilia(textoFamilia: string | null | undefined): string | null {
  const t = (textoFamilia || '').toLowerCase();
  if (/gourmand|oriental|baunilha|doce|âmbar|ambar/.test(t)) return 'gourmand';
  if (/aquático|aquatico|marinho/.test(t)) return 'aquatico';
  if (/amadeirado|madeira|couro|chypre/.test(t)) return 'amadeirado';
  if (/frutado|fruta/.test(t)) return 'frutado';
  if (/floral|cítrico|citrico|aromático|aromatico/.test(t)) return 'chypre';
  return null;
}

function calcularPrecos(mediaUsd: number, cotacao: number, bottleMl: number) {
  const custoBase = mediaUsd * cotacao;
  const custoComTaxa = custoBase * (1 + TAXA_IMPORTACAO);
  const precoPorMl = (custoComTaxa * MULT_DECANTE) / bottleMl;
  const decante = (ml: number) => round2((precoPorMl * ml + EMBALAGEM) * (1 + MARGEM_MONETARIA));
  const fechado = round2((custoComTaxa * MULT_FECHADO + EMBALAGEM) * (1 + MARGEM_MONETARIA));
  return { '3': decante(3), '5': decante(5), '10': decante(10), full: fechado };
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

interface ItemListagem { id: string; url: string; nome: string; }

function parseListagem(html: string): ItemListagem[] {
  const itens: ItemListagem[] = [];
  const regex = /<div class="promocao-produtos-item col-sm-12">[\s\S]*?data-src="[^"]+"[\s\S]*?<div class="promocao-item-nome">\s*<a[^>]*href="([^"]+)">\s*([^<]+?)\s*<\/a>/g;
  let m: RegExpExecArray | null;
  while ((m = regex.exec(html))) {
    const url = m[1];
    const idMatch = url.match(/_(\d+)\/?$/);
    if (!idMatch) continue;
    itens.push({ id: 'cp-' + idMatch[1], url, nome: m[2].trim() });
  }
  return itens;
}

interface ExtraiOfertas { mediaUsd: number; ofertas: number; }

function extrairOfertas(html: string): ExtraiOfertas {
  const regexLista = /promocao-item-preco-oferta flex column">\s*<span>\s*<strong>\s*US\$\s*([\d.,]+)\s*<\/strong>/g;
  const precos: number[] = [];
  let m: RegExpExecArray | null;
  while ((m = regexLista.exec(html))) {
    const valor = parseBRNumber(m[1]);
    if (Number.isFinite(valor) && valor > 0) precos.push(valor);
  }
  if (!precos.length) {
    const fallback = html.match(/header-product-info--price">\s*<div class="flex wrap align-items-center">\s*<span>US\$\s*([\d.,]+)<\/span>/);
    if (fallback) {
      const valor = parseBRNumber(fallback[1]);
      if (Number.isFinite(valor) && valor > 0) precos.push(valor);
    }
  }
  if (!precos.length) return { mediaUsd: 0, ofertas: 0 };
  return { mediaUsd: precos.reduce((s, v) => s + v, 0) / precos.length, ofertas: precos.length };
}

function extrairEspecificacoes(html: string): Record<string, string> {
  const tabela = html.match(/<table class="table table-details table-hover table-striped">([\s\S]*?)<\/table>/);
  const mapa: Record<string, string> = {};
  if (!tabela) return mapa;
  const linhaRegex = /<tr><td>([^<]*)<\/td><td>([^<]*)<\/td><\/tr>/g;
  let m: RegExpExecArray | null;
  while ((m = linhaRegex.exec(tabela[1]))) mapa[m[1].trim()] = m[2].trim();
  return mapa;
}

function extrairImagem(html: string): string | null {
  const m = html.match(/<meta property="og:image" content="([^"]+)"/);
  return m ? m[1] : null;
}

Deno.serve(async req => {
  const segredoEsperado = Deno.env.get('CATALOG_CRON_SECRET');
  if (!segredoEsperado || req.headers.get('x-cron-secret') !== segredoEsperado) {
    return new Response(JSON.stringify({ error: 'Não autorizado.' }), { status: 401 });
  }

  const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

  const cotacao = await buscarCotacaoDolar();
  if (!cotacao) {
    return new Response(JSON.stringify({ error: 'Não consegui ler a cotação do dólar agora.' }), { status: 502 });
  }

  const resumo: { descoberta?: string; detalhes: Record<string, string> } = { detalhes: {} };
  let atrasoJaEsperado = false;
  const aguardarEntreRequisicoes = async () => {
    if (atrasoJaEsperado) await esperar(CRAWL_DELAY_MS);
    atrasoJaEsperado = true;
  };

  // --- 1) descoberta: 1 página de listagem por execução ---
  const { data: estado } = await supabase.from('catalog_crawl_state').select('*').eq('id', 1).single();
  const paginaAtual = estado?.next_discovery_page ?? 1;

  await aguardarEntreRequisicoes();
  try {
    const respostaListagem = await fetch(`${COMPRASPARAGUAI_BASE}/perfume/?page=${paginaAtual}`);
    if (respostaListagem.ok) {
      const htmlListagem = await respostaListagem.text();
      const itens = parseListagem(htmlListagem);
      if (itens.length) {
        const linhas = itens.map(item => ({
          id: item.id,
          comprasparaguai_url: item.url,
          name: item.nome,
          status: 'pendente'
        }));
        await supabase.from('catalog_products').upsert(linhas, { onConflict: 'id', ignoreDuplicates: true });
      }
      const proximaPagina = paginaAtual >= 500 ? 1 : paginaAtual + 1;
      await supabase.from('catalog_crawl_state').update({ next_discovery_page: proximaPagina, updated_at: new Date().toISOString() }).eq('id', 1);
      resumo.descoberta = `página ${paginaAtual}: ${itens.length} produtos vistos`;
    } else {
      resumo.descoberta = `página ${paginaAtual}: falha ao buscar (status ${respostaListagem.status})`;
    }
  } catch (erro) {
    resumo.descoberta = `página ${paginaAtual}: erro — ${erro instanceof Error ? erro.message : String(erro)}`;
  }

  // --- 2) detalhe: completa/atualiza os produtos mais antigos ---
  const { data: pendentes } = await supabase
    .from('catalog_products')
    .select('id, comprasparaguai_url')
    .order('updated_at', { ascending: true })
    .limit(DETALHES_POR_EXECUCAO);

  for (const produto of pendentes ?? []) {
    await aguardarEntreRequisicoes();
    try {
      const resposta = await fetch(COMPRASPARAGUAI_BASE + produto.comprasparaguai_url);
      if (!resposta.ok) {
        resumo.detalhes[produto.id] = `falha ao buscar (status ${resposta.status})`;
        continue;
      }
      const html = await resposta.text();
      const specs = extrairEspecificacoes(html);
      const { mediaUsd, ofertas } = extrairOfertas(html);
      const bottleMl = Number((specs['Volume'] || '').replace(/[^\d]/g, '')) || null;
      const agora = new Date().toISOString();

      const atualizacaoCatalogo: Record<string, unknown> = {
        brand: specs['Marca'] || null,
        brand_filter: specs['Marca'] ? slugify(specs['Marca']) : null,
        family_filter: mapearFamilia(specs['Família Olfativa']),
        gender: specs['Gênero'] || null,
        bottle_ml: bottleMl,
        top_notes: specs['Notas de Topo'] || null,
        heart_notes: specs['Notas de Coração'] || null,
        base_notes: specs['Notas de Fundo'] || null,
        match_notes: gerarMatchNotes(specs['Notas de Topo'], specs['Notas de Coração'], specs['Notas de Fundo']),
        image_url: extrairImagem(html),
        status: 'completo',
        updated_at: agora
      };
      await supabase.from('catalog_products').update(atualizacaoCatalogo).eq('id', produto.id);

      if (!ofertas || !bottleMl) {
        await supabase.from('product_prices').upsert(
          (['3', '5', '10', 'full'] as const).map(size => ({ product_id: produto.id, size, in_stock: false, updated_at: agora, price: 0 })),
          { onConflict: 'product_id,size', ignoreDuplicates: false }
        );
        resumo.detalhes[produto.id] = ofertas ? 'sem volume identificado (preço não calculado)' : 'esgotado (0 ofertas)';
        continue;
      }

      const precos = calcularPrecos(mediaUsd, cotacao, bottleMl);
      const linhasPreco = (['3', '5', '10', 'full'] as const).map(size => ({
        product_id: produto.id, size, price: precos[size], in_stock: true, updated_at: agora
      }));
      const { error: erroPreco } = await supabase.from('product_prices').upsert(linhasPreco, { onConflict: 'product_id,size' });
      resumo.detalhes[produto.id] = erroPreco
        ? `erro ao gravar preço: ${erroPreco.message}`
        : `ok — ${specs['Marca'] || '?'}, média US$ ${mediaUsd.toFixed(2)} (${ofertas} ofertas), fechado R$ ${precos.full}`;
    } catch (erro) {
      resumo.detalhes[produto.id] = `erro inesperado: ${erro instanceof Error ? erro.message : String(erro)}`;
    }
  }

  return new Response(JSON.stringify({ cotacao, resumo }), { headers: { 'Content-Type': 'application/json' } });
});
