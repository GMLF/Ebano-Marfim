-- Rode isso no Supabase: SQL Editor > New query > cola e "Run".
--
-- Por que isso existe: em vez de editar preço à mão em data/products.js e
-- em product_prices.sql toda vez que o custo em dólar muda, uma Edge
-- Function (supabase/functions/atualizar-precos) busca o preço médio de
-- cada perfume no comprasparaguai.com.br, aplica a fórmula de custo/margem
-- combinada com o Caio e grava o resultado direto em product_prices — a
-- mesma tabela que já era a fonte de verdade pro gatilho do pedido. O cron
-- no final desta migração chama essa function a cada hora.
--
-- IMPORTANTE: só os produtos com uma linha em product_sources (abaixo) são
-- atualizados automaticamente. Os demais (ex.: linha Bidaya Parfums, que é
-- comprada direto do site oficial da marca, não revendida no Paraguai)
-- continuam com o preço manual de sempre — edite product_prices.sql como
-- já era feito.

-- URL exata (dentro do próprio comprasparaguai.com.br) da página do
-- produto certo — concentração e tamanho batendo com o que a gente vende
-- (ver fullSize em data/products.js). Não é uma busca por nome: casar por
-- nome erraria concentração (EDT vs EDP vs Elixir) ou tamanho.
create table if not exists public.product_sources (
  product_id text primary key,
  comprasparaguai_url text not null,
  bottle_ml numeric not null
);

alter table public.product_sources enable row level security;
-- sem policy de select: só a service_role (usada pela Edge Function) lê esta tabela.

insert into public.product_sources (product_id, comprasparaguai_url, bottle_ml) values
  ('dior-sauvage', '/perfume-christian-dior-sauvage-eau-de-toilette-masculino-100ml_15199/', 100),
  ('dior-homme', '/perfume-christian-dior-homme-eau-de-toilette-masculino-100ml_738/', 100),
  ('lattafa-khamrah', '/perfume-lattafa-khamrah-eau-de-parfum-unissex-100ml_53599/', 100),
  ('lattafa-yara', '/perfume-lattafa-yara-eau-de-parfum-feminino-100ml_50537/', 100),
  ('lattafa-asad', '/perfume-lattafa-asad-eau-de-parfum-masculino-100ml_52480/', 100),
  ('lattafa-oud-mood', '/perfume-lattafa-oud-mood-eau-de-parfum-unissex-100ml_48942/', 100),
  ('mykonos-california', '/perfume-mykonos-california-signature-unissex-extrait-50ml__5545222/', 50),
  ('milk-drops', '/perfume-mykonos-milk-drops-extrait-u-50ml__5489894/', 50),
  ('cafe-drops', '/perfume-mykonos-cafe-drops-extrait-f-50ml__5489896/', 50)
on conflict (product_id) do update set
  comprasparaguai_url = excluded.comprasparaguai_url,
  bottle_ml = excluded.bottle_ml;

-- pink-drops e mykonos-myego ficaram de fora de propósito: no comprasparaguai,
-- pink-drops só existe como link externo pra loja parceira (sem página própria
-- pra ler ofertas) e o myego só aparece em 100ml (o nosso é vendido em 50ml,
-- calcular por ml a partir de um frasco de tamanho errado erraria o preço).
-- Continuam manuais até alguém mapear uma fonte confiável pra eles.

-- estoque + data da última atualização, usados pelo front-end pra mostrar
-- "esgotado" e pela Edge Function pra saber quando um preço foi calculado.
alter table public.product_prices add column if not exists in_stock boolean not null default true;
alter table public.product_prices add column if not exists updated_at timestamptz not null default now();

-- Agenda a Edge Function pra rodar a cada hora. Habilita pg_cron e pg_net
-- (dá pra fazer isso por SQL mesmo; se der erro de permissão, habilite as
-- duas em Database > Extensions no painel e rode só o cron.schedule abaixo).
create extension if not exists pg_cron;
create extension if not exists pg_net;

-- Precisa do secret PRECOS_CRON_SECRET configurado na Edge Function
-- (Edge Functions > atualizar-precos > Secrets) — o mesmo valor colado
-- abaixo no lugar de 'COLE-O-MESMO-SEGREDO-AQUI'. Troque também a URL pela
-- URL real do seu projeto (Project Settings > API).
--
-- O header Authorization é exigido pelo próprio Supabase (antes até de
-- chegar na function) — sem ele toda chamada volta 401. Use a anon/publishable
-- key do projeto (a mesma de js/supabase-config.js), não a service_role.
select cron.unschedule(jobid) from cron.job where jobname = 'atualizar-precos-hora-em-hora'; -- remove o job antigo (sem Authorization), se existir

select cron.schedule(
  'atualizar-precos-hora-em-hora',
  '0 * * * *',
  $$
  select net.http_post(
    url := 'https://lkvejlfwgjfdxakhxfpr.supabase.co/functions/v1/atualizar-precos',
    headers := jsonb_build_object(
      'x-cron-secret', 'COLE-O-MESMO-SEGREDO-AQUI',
      'Authorization', 'Bearer sb_publishable_Cd7doW8laotUTzR1WZQ5BQ_AqHJF_ok'
    ),
    body := '{}'::jsonb
  );
  $$
);
