-- Rode isso no Supabase: SQL Editor > New query > cola e "Run".
-- Função que devolve todos os pedidos já com o e-mail do cliente
-- (a tabela orders sozinha só tem o user_id). Só devolve algo se
-- quem chamar for admin. Com isso o dashboard consegue calcular
-- "clientes que mais compraram" pra qualquer período (dia, mês, ano),
-- sem precisar de uma consulta separada por filtro.

create or replace function public.admin_all_orders()
returns table(
  order_number text,
  email text,
  subtotal numeric,
  payment_method text,
  items jsonb,
  created_at timestamptz
)
language sql
security definer
set search_path = public
as $$
  select o.order_number, u.email, o.subtotal, o.payment_method, o.items, o.created_at
  from public.orders o
  join auth.users u on u.id = o.user_id
  where public.is_admin()
  order by o.created_at desc;
$$;
