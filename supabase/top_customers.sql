-- Rode isso no Supabase: SQL Editor > New query > cola e "Run".
-- Substitui a função anterior por uma que aceita um período em dias
-- (null ou 0 = todo o histórico). Seguro rodar de novo mesmo se você
-- já criou a versão antiga dessa função.

create or replace function public.admin_top_customers(since_days integer default null)
returns table(email text, total_spent numeric, order_count bigint)
language sql
security definer
set search_path = public
as $$
  select u.email, sum(o.subtotal) as total_spent, count(*) as order_count
  from public.orders o
  join auth.users u on u.id = o.user_id
  where public.is_admin()
    and (since_days is null or since_days = 0 or o.created_at >= now() - (since_days || ' days')::interval)
  group by u.email
  order by total_spent desc
  limit 20;
$$;
