-- Rode isso no Supabase: SQL Editor > New query > cola e "Run". Seguro rodar de novo.
--
-- Busca da Coleção mais rápida:
-- 1. catalog_busca junta o perfume do catálogo importado com o preço dele, pra
--    busca fazer uma ida ao banco em vez de duas (perfumes, depois preços).
-- 2. Índice de trigramas no nome: o "contém 'odyssey'" (ilike '%odyssey%') não
--    usa índice comum, e varreria o catálogo inteiro (~27 mil perfumes quando o
--    crawler terminar) a cada letra digitada.

create extension if not exists pg_trgm;
create index if not exists catalog_products_name_trgm_idx
  on public.catalog_products using gin (name gin_trgm_ops);

-- security_invoker: a view respeita a RLS das tabelas de origem (as duas já têm
-- leitura pública), em vez de rodar com a permissão de quem criou a view.
create or replace view public.catalog_busca
with (security_invoker = true) as
select
  c.id, c.name, c.brand, c.brand_filter, c.family_filter, c.gender,
  c.image_url, c.image_bg_url, c.top_notes, c.heart_notes, c.base_notes,
  c.bottle_ml, c.match_notes, c.status, c.updated_at,
  p.price, p.in_stock
from public.catalog_products c
left join public.product_prices p on p.product_id = c.id and p.size = 'full';

grant select on public.catalog_busca to anon, authenticated;
