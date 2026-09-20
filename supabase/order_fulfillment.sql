-- Rode isso no Supabase: SQL Editor > New query > cola e "Run".
-- Adiciona status de envio e o endereço do destinatário em cada pedido,
-- pra dar pro admin acompanhar o que já foi enviado e pra onde mandar.

alter table public.orders
  add column if not exists status text not null default 'pendente',
  add column if not exists recipient_name text,
  add column if not exists recipient_phone text,
  add column if not exists cep text,
  add column if not exists street text,
  add column if not exists number text,
  add column if not exists neighborhood text,
  add column if not exists city text,
  add column if not exists state text;

alter table public.orders
  drop constraint if exists chk_status_valido,
  add constraint chk_status_valido check (
    status in ('pendente', 'pago', 'enviado', 'entregue', 'cancelado')
  );

-- Só admin pode mudar o status — nunca o valor do pedido em si (subtotal,
-- itens etc. continuam protegidos, essa função só toca a coluna status).
create or replace function public.admin_update_order_status(pedido_id uuid, novo_status text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'Só administradores podem mudar o status de um pedido.';
  end if;
  if novo_status not in ('pendente', 'pago', 'enviado', 'entregue', 'cancelado') then
    raise exception 'Status inválido: %', novo_status;
  end if;
  update public.orders set status = novo_status where id = pedido_id;
end;
$$;

-- Atualiza a função que lista pedidos pro admin, agora trazendo status e endereço
create or replace function public.admin_all_orders()
returns table(
  id uuid,
  order_number text,
  email text,
  subtotal numeric,
  payment_method text,
  items jsonb,
  created_at timestamptz,
  status text,
  shipping_carrier text,
  shipping_service text,
  shipping_price numeric,
  shipping_days integer,
  recipient_name text,
  recipient_phone text,
  cep text,
  street text,
  number text,
  neighborhood text,
  city text,
  state text
)
language sql
security definer
set search_path = public
as $$
  select
    o.id, o.order_number, u.email, o.subtotal, o.payment_method, o.items, o.created_at, o.status,
    o.shipping_carrier, o.shipping_service, o.shipping_price, o.shipping_days,
    o.recipient_name, o.recipient_phone, o.cep, o.street, o.number, o.neighborhood, o.city, o.state
  from public.orders o
  join auth.users u on u.id = o.user_id
  where public.is_admin()
  order by o.created_at desc;
$$;
