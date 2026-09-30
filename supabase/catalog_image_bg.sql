-- Rode isso no Supabase: SQL Editor > New query > cola e "Run".
--
-- Por que isso existe: as fotos importadas do comprasparaguai (ver
-- catalog_import.sql) vêm com fundo branco/liso da foto original — os
-- produtos curados (data/products.js) já usam PNG com fundo removido, e o
-- Caio quer a mesma cara pros produtos importados. Sem IA/API paga: a
-- function (supabase/functions/process-image-catalogo) baixa a foto,
-- troca os pixels próximos da cor do fundo (amostrada pelos 4 cantos da
-- imagem) por transparentes, e salva o PNG resultante no Storage. Funciona
-- bem em fundo branco/liso de estúdio (a maioria das fotos de perfume);
-- fundos mais complexos ficam com um recorte imperfeito, e fotos em WEBP/AVIF
-- (formato que a biblioteca de imagem não lê) simplesmente não são
-- processadas — nesses casos o site continua usando a foto original.

create extension if not exists pg_cron;
create extension if not exists pg_net;

alter table public.catalog_products add column if not exists image_bg_url text;
alter table public.catalog_products add column if not exists image_bg_status text not null default 'pendente'
  check (image_bg_status in ('pendente', 'ok', 'falhou'));
create index if not exists catalog_products_image_bg_status_idx on public.catalog_products (image_bg_status, updated_at);

-- bucket público pra guardar os PNGs já com fundo removido
insert into storage.buckets (id, name, public)
  values ('catalog-fotos', 'catalog-fotos', true)
  on conflict (id) do nothing;

drop policy if exists qualquer_um_le_fotos_catalogo on storage.objects;
create policy qualquer_um_le_fotos_catalogo on storage.objects
  for select using (bucket_id = 'catalog-fotos');
-- só leitura pública; quem escreve é a Edge Function, via service_role (que ignora RLS)

-- remove um agendamento anterior com esse nome, se existir (seguro rodar de novo)
select cron.unschedule(jobid) from cron.job where jobname = 'processar-fotos-catalogo-3-em-3-min';

-- lote pequeno de propósito (4 fotos por execução) — processar imagem é
-- mais pesado que só ler HTML, e a gente já teve que enxugar o crawler de
-- texto por estourar o limite de recursos da Edge Function.
select cron.schedule(
  'processar-fotos-catalogo-3-em-3-min',
  '*/3 * * * *',
  $$
  select net.http_post(
    url := 'https://lkvejlfwgjfdxakhxfpr.supabase.co/functions/v1/process-image-catalogo',
    headers := jsonb_build_object(
      'x-cron-secret', 'e3e1884fc4d4b9450498e715f2592c0865db595260b6bd31',
      'Authorization', 'Bearer sb_publishable_Cd7doW8laotUTzR1WZQ5BQ_AqHJF_ok'
    ),
    body := '{}'::jsonb
  );
  $$
);
