-- Rode isso no Supabase: SQL Editor > New query > cola e "Run".
-- Avaliação por PRODUTO (diferente de order_reviews.sql, que avalia o
-- pedido inteiro): o cliente avalia cada perfume separadamente, com nota
-- e comentário, e isso fica público na página do produto pra quem for
-- comprar ver a opinião de quem já comprou. Só quem de fato comprou
-- aquele produto, num pedido já entregue, pode avaliar ele.

create table if not exists public.product_reviews (
  id uuid primary key default gen_random_uuid(),
  product_id text not null,
  order_id uuid not null references public.orders(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  rating integer not null,
  comment text,
  reviewer_name text not null,
  created_at timestamptz not null default now(),
  constraint chk_rating_valido check (rating between 1 and 5),
  constraint uq_uma_avaliacao_por_produto_no_pedido unique (order_id, product_id)
);

alter table public.product_reviews enable row level security;

-- avaliações são públicas: qualquer visitante (sem login) precisa ler
-- elas na página do produto, não só o próprio autor.
drop policy if exists "avaliacoes_sao_publicas" on public.product_reviews;
create policy "avaliacoes_sao_publicas"
  on public.product_reviews for select
  using (true);

-- Escrita só por esta função (nunca direto na tabela): confere que o
-- pedido é do usuário logado, que já foi entregue, e que o produto
-- avaliado realmente estava nesse pedido — senão qualquer um poderia
-- avaliar qualquer produto sem ter comprado.
create or replace function public.avaliar_produto(
  pedido_id uuid,
  produto_id text,
  nota integer,
  texto text,
  nome text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  dono uuid;
  status_atual text;
  itens jsonb;
  produto_no_pedido boolean;
begin
  select user_id, status, items into dono, status_atual, itens
  from public.orders where id = pedido_id;

  if dono is null then
    raise exception 'Pedido não encontrado.';
  end if;
  if dono != auth.uid() then
    raise exception 'Você só pode avaliar produtos dos seus próprios pedidos.';
  end if;
  if status_atual != 'entregue' then
    raise exception 'Só dá pra avaliar depois que o pedido foi entregue.';
  end if;
  if nota < 1 or nota > 5 then
    raise exception 'A nota precisa ser de 1 a 5.';
  end if;

  select exists(
    select 1 from jsonb_array_elements(itens) i where i->>'id' = produto_id
  ) into produto_no_pedido;
  if not produto_no_pedido then
    raise exception 'Esse produto não faz parte desse pedido.';
  end if;

  insert into public.product_reviews (product_id, order_id, user_id, rating, comment, reviewer_name)
  values (produto_id, pedido_id, auth.uid(), nota, nullif(trim(texto), ''), nome)
  on conflict (order_id, product_id) do update
    set rating = excluded.rating,
        comment = excluded.comment,
        reviewer_name = excluded.reviewer_name,
        created_at = now();
end;
$$;

-- Resumo (média + total) de vários produtos de uma vez, pra grade de
-- cards não precisar de uma chamada por produto.
create or replace function public.resumo_avaliacoes(produto_ids text[])
returns table(product_id text, media numeric, total integer)
language sql
security definer
set search_path = public
as $$
  select product_id, round(avg(rating), 1) as media, count(*)::integer as total
  from public.product_reviews
  where product_id = any(produto_ids)
  group by product_id;
$$;
