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
  -- "is distinct from" (não "!="): com != , uma chamada sem login (auth.uid()
  -- nulo) faz a comparação virar NULL em vez de true, e o "if" simplesmente
  -- não dispara — ou seja, "!=" sozinho deixava qualquer um, sem estar
  -- logado, avaliar pedido de outra pessoa. "is distinct from" trata NULL
  -- como diferente de qualquer coisa, então nunca passa batido.
  if auth.uid() is null or dono is distinct from auth.uid() then
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

-- admin_all_orders (que também traz a nota) é definida em shipping_tracking.sql.
-- Não redefina aqui: rodar este arquivo de novo apagaria os campos de rastreio
-- do admin e o botão "Comprar etiqueta" sumiria sem erro nenhum.
