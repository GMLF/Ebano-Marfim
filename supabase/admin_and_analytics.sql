-- Rode isso no Supabase: Dashboard > SQL Editor > New query > cola e "Run".
-- Cria: (1) sistema de admin, (2) permissão de admin ver TODOS os pedidos,
-- (3) tabela de eventos (busca, clique, funil) pro dashboard.

-- ---------- 1. quem é admin ----------
create table if not exists public.admins (
  user_id uuid primary key references auth.users(id) on delete cascade
);

-- função que checa se quem está logado é admin — "security definer" evita
-- problema de recursão de RLS quando outras tabelas checam isso
create or replace function public.is_admin()
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (select 1 from public.admins where user_id = auth.uid());
$$;

-- ---------- 2. admin também vê os pedidos de todo mundo ----------
-- (a política antiga de "só vê o próprio pedido" continua existindo pros
-- clientes normais; essa é uma política extra, só pra quem é admin)
drop policy if exists "admins_veem_todos_pedidos" on public.orders;
create policy "admins_veem_todos_pedidos"
  on public.orders for select
  using (public.is_admin());

-- ---------- 3. eventos: busca, clique em produto, funil de compra ----------
create table if not exists public.analytics_events (
  id bigint generated always as identity primary key,
  event_type text not null,   -- 'search' | 'product_view' | 'add_to_cart' | 'checkout_start' | 'checkout_complete'
  payload jsonb,               -- ex: {"term":"sauvage"} ou {"product_id":"dior-sauvage","name":"Sauvage"}
  session_id text,             -- id anônimo por navegador (funciona mesmo sem login)
  user_id uuid references auth.users(id),
  created_at timestamptz not null default now()
);

alter table public.analytics_events enable row level security;

-- qualquer visitante (mesmo sem login) pode CRIAR um evento — é assim que
-- rastreamos visitantes anônimos, mas ninguém além do admin consegue LER
drop policy if exists "qualquer_um_cria_evento" on public.analytics_events;
create policy "qualquer_um_cria_evento"
  on public.analytics_events for insert
  with check (true);

drop policy if exists "so_admin_le_eventos" on public.analytics_events;
create policy "so_admin_le_eventos"
  on public.analytics_events for select
  using (public.is_admin());

-- ---------- 4. por último, troque SEU-EMAIL@AQUI.COM pelo seu e-mail de
-- cadastro no site e rode só essa linha pra se tornar admin ----------
insert into public.admins (user_id)
select id from auth.users where email = 'SEU-EMAIL@AQUI.COM'
on conflict (user_id) do nothing;
