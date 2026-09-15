-- Rode isso no Supabase: Dashboard > SQL Editor > New query > cola e clica em "Run".
-- Cria a tabela de pedidos e trava com Row Level Security: cada usuário só
-- consegue ver/criar os próprios pedidos, nunca os de outra pessoa.

create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  order_number text not null,
  items jsonb not null,
  subtotal numeric not null,
  payment_method text not null,
  created_at timestamptz not null default now()
);

alter table public.orders enable row level security;

create policy "usuarios_veem_so_os_proprios_pedidos"
  on public.orders for select
  using (auth.uid() = user_id);

create policy "usuarios_criam_so_os_proprios_pedidos"
  on public.orders for insert
  with check (auth.uid() = user_id);
