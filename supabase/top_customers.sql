-- Rode isso no Supabase: SQL Editor > New query > cola e "Run".
-- Função que devolve os clientes que mais compraram (e-mail, total gasto,
-- número de pedidos). Só devolve algo se quem chamar for admin — o
-- "security definer" é o que permite essa função ler o e-mail em
-- auth.users, que normalmente não é acessível pelo cliente.

create or replace function public.admin_top_customers()
returns table(email text, total_spent numeric, order_count bigint)
language sql
security definer
set search_path = public
as $$
  select u.email, sum(o.subtotal) as total_spent, count(*) as order_count
  from public.orders o
  join auth.users u on u.id = o.user_id
  where public.is_admin()
  group by u.email
  order by total_spent desc
  limit 20;
$$;
