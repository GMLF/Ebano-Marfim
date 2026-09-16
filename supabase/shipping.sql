-- Rode isso no Supabase: SQL Editor > New query > cola e "Run".
-- Adiciona à tabela orders os dados do frete escolhido no checkout,
-- pra ficar registrado junto do pedido (transportadora, serviço, preço e prazo).

alter table public.orders
  add column if not exists shipping_carrier text,
  add column if not exists shipping_service text,
  add column if not exists shipping_price numeric,
  add column if not exists shipping_days integer;
