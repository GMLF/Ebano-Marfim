-- Rode isso no Supabase: SQL Editor > New query > cola e "Run".
--
-- Por que isso existe: além dos poucos produtos que a loja já vende (ver
-- pricing_automation.sql), o Caio quer trazer o catálogo inteiro de
-- perfumes disponível no comprasparaguai.com.br pro site — com foto,
-- notas e preço calculado do mesmo jeito. São ~26.807 produtos em ~500
-- páginas de listagem: não cabe numa função só (o robots.txt deles pede
-- 10s entre requisições), então isso roda aos poucos, num crawler
-- incremental (supabase/functions/catalog-crawler) chamado a cada 5
-- minutos, que vai completando o catálogo em alguns dias e depois fica
-- revisitando os produtos mais antigos pra manter preço/estoque atualizados.
--
-- Isso é separado dos produtos curados (data/products.js): aqueles têm
-- conteúdo escrito à mão e continuam do jeito que sempre foram. Este
-- catálogo é só o que dá pra importar automaticamente.

create table if not exists public.catalog_products (
  id text primary key, -- 'cp-<id numérico da URL do comprasparaguai>'
  comprasparaguai_url text not null unique,
  name text not null,
  brand text,
  brand_filter text, -- slug da marca, usado no filtro da Coleção
  family_filter text, -- um dos 5 baldes que a Coleção já usa (chypre/gourmand/frutado/amadeirado/aquatico), mapeado por palavra-chave a partir da família olfativa crua — aproximado, não é curadoria manual
  gender text,
  bottle_ml numeric,
  top_notes text,
  heart_notes text,
  base_notes text,
  match_notes text[] not null default '{}', -- gerado automaticamente das notas (ver gerarMatchNotes na function) — usado pelo Quiz
  image_url text,
  status text not null default 'pendente' check (status in ('pendente', 'completo')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create extension if not exists pg_trgm;

create index if not exists catalog_products_status_idx on public.catalog_products (status, updated_at);
create index if not exists catalog_products_brand_filter_idx on public.catalog_products (brand_filter);
create index if not exists catalog_products_family_filter_idx on public.catalog_products (family_filter);
create index if not exists catalog_products_match_notes_idx on public.catalog_products using gin (match_notes);
create index if not exists catalog_products_name_idx on public.catalog_products using gin (name gin_trgm_ops);

alter table public.catalog_products enable row level security;
drop policy if exists qualquer_um_le_catalogo on public.catalog_products;
create policy qualquer_um_le_catalogo on public.catalog_products for select using (status = 'completo');
-- produtos "pendente" (descobertos mas ainda sem detalhe) ficam invisíveis
-- pro site até o crawler completar os dados — evita mostrar card vazio.

-- 1 linha só: de onde o crawler continua na próxima execução.
create table if not exists public.catalog_crawl_state (
  id int primary key default 1,
  next_discovery_page int not null default 1,
  updated_at timestamptz not null default now(),
  constraint catalog_crawl_state_singleton check (id = 1)
);
insert into public.catalog_crawl_state (id, next_discovery_page)
  values (1, 1) on conflict (id) do nothing;
alter table public.catalog_crawl_state enable row level security;
-- sem policy de select: só a service_role (Edge Function) mexe nisso.

-- Preços/estoque desses produtos usam a mesma tabela product_prices de
-- sempre (não precisa de product_sources — o crawler já sabe a URL de
-- cada um via catalog_products).

-- remove o job de 5 em 5 min de uma tentativa anterior (nome antigo), se existir
select cron.unschedule(jobid) from cron.job where jobname = 'catalogo-crawler-5-em-5-min';

-- Agenda o crawler pra rodar a cada 2 minutos (lotes pequenos — 6 produtos
-- por execução, ver DETALHES_POR_EXECUCAO na function — porque um lote maior
-- estourou o limite de tempo/recursos da Edge Function; rodando mais vezes
-- compensa e mantém o ritmo de completar o catálogo em alguns dias).
select cron.schedule(
  'catalogo-crawler-2-em-2-min',
  '*/2 * * * *',
  $$
  select net.http_post(
    url := 'https://lkvejlfwgjfdxakhxfpr.supabase.co/functions/v1/catalog-crawler',
    headers := jsonb_build_object(
      'x-cron-secret', 'COLE-O-MESMO-SEGREDO-AQUI',
      'Authorization', 'Bearer sb_publishable_Cd7doW8laotUTzR1WZQ5BQ_AqHJF_ok'
    ),
    body := '{}'::jsonb
  );
  $$
);
