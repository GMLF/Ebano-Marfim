// Supabase Edge Function — remove o fundo (branco/liso) das fotos
// importadas do comprasparaguai (ver catalog-crawler) sem IA/API paga: troca
// por transparente os pixels próximos da cor amostrada nos 4 cantos da
// imagem, com uma transição suave na borda pra não ficar serrilhado. Salva
// o PNG resultante no bucket público "catalog-fotos" (ver catalog_image_bg.sql).
//
// Funciona bem em foto de estúdio com fundo branco/liso (a maioria das fotos
// de perfume) — fundos mais complexos ficam com recorte imperfeito, e fotos
// em WEBP/AVIF (formato que a ImageScript não decodifica) simplesmente não
// são processadas; nesses casos o produto continua com a foto original
// (js/script.js usa image_bg_url se existir, senão cai pra image_url).
//
// Configuração necessária (Edge Functions > process-image-catalogo > Secrets):
//   SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY -> já existem por padrão
//   IMAGE_CRON_SECRET                        -> mesmo valor colado no cron.schedule (catalog_image_bg.sql)

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.116.0';
import { Image } from 'https://deno.land/x/imagescript@1.3.0/mod.ts';

const LOTE_POR_EXECUCAO = 4; // pequeno de propósito — decodificar/processar imagem é pesado
const TAMANHO_MAX = 450; // px no maior lado — mantém o processamento e o arquivo final leves
const LIMIAR_DENTRO = 18; // distância de cor até aqui: totalmente transparente
const LIMIAR_FORA = 45; // distância de cor a partir daqui: mantém opaco (transição suave entre os dois)

function corDistancia(r1: number, g1: number, b1: number, r2: number, g2: number, b2: number): number {
  return Math.sqrt((r1 - r2) ** 2 + (g1 - g2) ** 2 + (b1 - b2) ** 2);
}

function removerFundo(imagem: Image) {
  // ImageScript usa coordenadas base-1 (x e y começam em 1, não em 0)
  const cantos = [
    [1, 1], [imagem.width, 1], [1, imagem.height], [imagem.width, imagem.height]
  ].map(([x, y]) => Image.colorToRGBA(imagem.getPixelAt(x, y)));
  const fundoR = cantos.reduce((s, c) => s + c[0], 0) / cantos.length;
  const fundoG = cantos.reduce((s, c) => s + c[1], 0) / cantos.length;
  const fundoB = cantos.reduce((s, c) => s + c[2], 0) / cantos.length;

  for (let y = 1; y <= imagem.height; y++) {
    for (let x = 1; x <= imagem.width; x++) {
      const [r, g, b, a] = Image.colorToRGBA(imagem.getPixelAt(x, y));
      const dist = corDistancia(r, g, b, fundoR, fundoG, fundoB);
      let novoAlpha = a;
      if (dist <= LIMIAR_DENTRO) novoAlpha = 0;
      else if (dist < LIMIAR_FORA) novoAlpha = Math.round(a * (dist - LIMIAR_DENTRO) / (LIMIAR_FORA - LIMIAR_DENTRO));
      if (novoAlpha !== a) imagem.setPixelAt(x, y, Image.rgbaToColor(r, g, b, novoAlpha));
    }
  }
}

Deno.serve(async req => {
  const segredoEsperado = Deno.env.get('IMAGE_CRON_SECRET');
  if (!segredoEsperado || req.headers.get('x-cron-secret') !== segredoEsperado) {
    return new Response(JSON.stringify({ error: 'Não autorizado.' }), { status: 401 });
  }

  const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

  const { data: produtos, error: erroBusca } = await supabase
    .from('catalog_products')
    .select('id, image_url')
    .eq('image_bg_status', 'pendente')
    .not('image_url', 'is', null)
    .order('updated_at', { ascending: true })
    .limit(LOTE_POR_EXECUCAO);

  if (erroBusca) {
    return new Response(JSON.stringify({ error: erroBusca.message }), { status: 500 });
  }

  const resumo: Record<string, string> = {};

  for (const produto of produtos ?? []) {
    try {
      const resposta = await fetch(produto.image_url);
      if (!resposta.ok) throw new Error(`status ${resposta.status} ao baixar a foto`);
      const bytes = new Uint8Array(await resposta.arrayBuffer());

      let imagem = await Image.decode(bytes);
      if (imagem.width < 4 || imagem.height < 4) throw new Error(`imagem pequena demais (${imagem.width}x${imagem.height}), provavelmente não é a foto do produto`);
      const maiorLado = Math.max(imagem.width, imagem.height);
      if (maiorLado > TAMANHO_MAX) {
        const escala = TAMANHO_MAX / maiorLado;
        imagem = imagem.resize(Math.round(imagem.width * escala), Math.round(imagem.height * escala));
      }
      removerFundo(imagem);
      const png = await imagem.encode();

      const caminho = `${produto.id}.png`;
      const { error: erroUpload } = await supabase.storage.from('catalog-fotos').upload(caminho, png, {
        contentType: 'image/png',
        upsert: true
      });
      if (erroUpload) throw erroUpload;

      const { data: urlPublica } = supabase.storage.from('catalog-fotos').getPublicUrl(caminho);
      await supabase.from('catalog_products').update({
        image_bg_url: urlPublica.publicUrl,
        image_bg_status: 'ok'
      }).eq('id', produto.id);
      resumo[produto.id] = 'ok';
    } catch (erro) {
      await supabase.from('catalog_products').update({ image_bg_status: 'falhou' }).eq('id', produto.id);
      resumo[produto.id] = `falhou: ${erro instanceof Error ? erro.message : String(erro)}`;
    }
  }

  return new Response(JSON.stringify({ resumo }), { headers: { 'Content-Type': 'application/json' } });
});
