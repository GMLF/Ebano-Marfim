-- Rode isso no Supabase: SQL Editor > New query > cola e "Run".
-- Deixa o cliente avaliar (1 a 5 estrelas) um pedido, mas só depois
-- que ele estiver como "entregue" — e só o próprio dono do pedido.

alter table public.orders
  add column if not exists rating integer,
  add column if not exists rated_at timestamptz;

alter table public.orders
  drop constraint if exists chk_rating_valido,
  add constraint chk_rating_valido check (rating is null or (rating between 1 and 5));

-- Função estreita: só deixa mexer na nota do próprio pedido, só se já
-- estiver entregue — não abre uma política de update geral na tabela
-- (subtotal, itens e status continuam impossíveis de alterar por aqui).
create or replace function public.avaliar_pedido(pedido_id uuid, nota integer)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  dono uuid;
  status_atual text;
begin
  select user_id, status into dono, status_atual from public.orders where id = pedido_id;
  if dono is null then
    raise exception 'Pedido não encontrado.';
  end if;
  if dono != auth.uid() then
    raise exception 'Você só pode avaliar seus próprios pedidos.';
  end if;
  if status_atual != 'entregue' then
    raise exception 'Só dá pra avaliar pedidos já entregues.';
  end if;
  if nota < 1 or nota > 5 then
    raise exception 'A nota precisa ser de 1 a 5.';
  end if;
  update public.orders set rating = nota, rated_at = now() where id = pedido_id;
end;
$$;

-- Atualiza a função do admin pra também trazer a nota de cada pedido.
-- Precisa dropar antes: o Postgres não deixa mudar o formato de retorno
-- de uma função só com "create or replace".
drop function if exists public.admin_all_orders();

create function public.admin_all_orders()
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
  state text,
  rating integer
)
language sql
security definer
set search_path = public
as $$
  select
    o.id, o.order_number, u.email, o.subtotal, o.payment_method, o.items, o.created_at, o.status,
    o.shipping_carrier, o.shipping_service, o.shipping_price, o.shipping_days,
    o.recipient_name, o.recipient_phone, o.cep, o.street, o.number, o.neighborhood, o.city, o.state,
    o.rating
  from public.orders o
  join auth.users u on u.id = o.user_id
  where public.is_admin()
  order by o.created_at desc;
$$;
