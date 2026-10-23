-- Rode isso no Supabase: SQL Editor > New query > cola e "Run".
-- Guarda o necessário pra comprar etiqueta de envio no SuperFrete e pra
-- receber a confirmação automática de postagem/entrega via webhook deles,
-- além de um jeito do próprio cliente confirmar recebimento (cobre a
-- entrega própria em Londrina, que nunca passa por transportadora).

alter table public.orders
  add column if not exists shipping_service_id integer,   -- 1=PAC, 2=SEDEX, 17=Mini Envios, 3=Jadlog, 31=Loggi, 33=J&T (SuperFrete) — null = entrega própria/local
  add column if not exists recipient_document text,       -- CPF do destinatário, exigido pelo SuperFrete pra gerar etiqueta
  add column if not exists superfrete_label_id text,       -- id da etiqueta no SuperFrete, usado pra casar o webhook com o pedido
  add column if not exists tracking_code text,
  add column if not exists label_print_url text,
  add column if not exists free_shipping boolean not null default false; -- preenchido pelo gatilho em product_prices.sql

-- O carrinho/checkout.js só deveria mandar um desses 6 códigos (ou nulo,
-- pra entrega própria) — trava aqui pra um valor inventado/adulterado no
-- navegador não virar um serviço de transportadora que não existe.
alter table public.orders
  drop constraint if exists chk_shipping_service_id_valido,
  add constraint chk_shipping_service_id_valido check (
    shipping_service_id is null or shipping_service_id in (1, 2, 3, 17, 31, 33)
  );

-- Só admin pode disparar a compra de etiqueta, e só grava esses 3 campos
-- específicos — nunca mexe em valor, itens ou status do pedido por aqui.
create or replace function public.admin_salvar_etiqueta(
  pedido_id uuid,
  superfrete_id text,
  tracking text,
  label_url text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'Só administradores podem comprar etiqueta de envio.';
  end if;
  update public.orders
    set superfrete_label_id = superfrete_id,
        tracking_code = tracking,
        label_print_url = label_url
    where id = pedido_id;
end;
$$;

-- Admin lê os dados de envio de UM pedido (a tabela não deixa, por RLS,
-- um admin ler pedido de outro usuário direto — só por uma função como
-- esta, que confere is_admin() e devolve só o necessário pra comprar
-- etiqueta, não o pedido inteiro).
-- drop antes: o Postgres não deixa mudar as colunas de retorno com "create or replace".
drop function if exists public.admin_get_order_envio(uuid);
create function public.admin_get_order_envio(pedido_id uuid)
returns table(
  id uuid,
  order_number text,
  status text,
  items jsonb,
  shipping_service_id integer,
  shipping_price numeric,
  free_shipping boolean,
  recipient_name text,
  recipient_phone text,
  recipient_document text,
  cep text,
  street text,
  number text,
  neighborhood text,
  city text,
  state text,
  superfrete_label_id text,
  tracking_code text,
  label_print_url text
)
language sql
security definer
set search_path = public
as $$
  select
    o.id, o.order_number, o.status, o.items, o.shipping_service_id, o.shipping_price, o.free_shipping,
    o.recipient_name, o.recipient_phone, o.recipient_document,
    o.cep, o.street, o.number, o.neighborhood, o.city, o.state,
    o.superfrete_label_id, o.tracking_code, o.label_print_url
  from public.orders o
  where o.id = pedido_id and public.is_admin();
$$;

-- O próprio cliente confirma que recebeu — cobre a entrega própria em
-- Londrina (nunca passa por transportadora, então o webhook do SuperFrete
-- nunca vai avisar) e serve de reforço se o webhook atrasar por algum motivo.
-- Só funciona a partir de "enviado", nunca pula etapa.
create or replace function public.confirmar_recebimento(pedido_id uuid)
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
  -- "is distinct from" (não "!="): com != , chamada sem login (auth.uid()
  -- nulo) vira comparação NULL em vez de true, e o "if" não dispara —
  -- deixaria qualquer um, sem estar logado, confirmar entrega de pedido
  -- alheio. "is distinct from" fecha isso.
  if auth.uid() is null or dono is distinct from auth.uid() then
    raise exception 'Você só pode confirmar o recebimento dos seus próprios pedidos.';
  end if;
  if status_atual != 'enviado' then
    raise exception 'Esse pedido não está marcado como enviado.';
  end if;
  update public.orders set status = 'entregue' where id = pedido_id;
end;
$$;

-- O cliente desiste de um pedido que ainda não pagou. Só a partir de
-- "pendente": depois de pago, cancelamento passa a envolver estorno e fica
-- com a loja.
create or replace function public.cancelar_pedido(pedido_id uuid)
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
  if auth.uid() is null or dono is distinct from auth.uid() then
    raise exception 'Você só pode cancelar seus próprios pedidos.';
  end if;
  if status_atual != 'pendente' then
    raise exception 'Só dá pra cancelar pedidos que ainda não foram pagos. Fale com a gente pelo WhatsApp.';
  end if;
  update public.orders set status = 'cancelado' where id = pedido_id;
end;
$$;

-- Atualiza a função do admin pra também trazer os campos de rastreio.
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
  shipping_service_id integer,
  shipping_price numeric,
  shipping_days integer,
  recipient_name text,
  recipient_phone text,
  recipient_document text,
  cep text,
  street text,
  number text,
  neighborhood text,
  city text,
  state text,
  rating integer,
  superfrete_label_id text,
  tracking_code text,
  label_print_url text
)
language sql
security definer
set search_path = public
as $$
  select
    o.id, o.order_number, u.email, o.subtotal, o.payment_method, o.items, o.created_at, o.status,
    o.shipping_carrier, o.shipping_service, o.shipping_service_id, o.shipping_price, o.shipping_days,
    o.recipient_name, o.recipient_phone, o.recipient_document, o.cep, o.street, o.number, o.neighborhood, o.city, o.state,
    o.rating, o.superfrete_label_id, o.tracking_code, o.label_print_url
  from public.orders o
  join auth.users u on u.id = o.user_id
  where public.is_admin()
  order by o.created_at desc;
$$;
