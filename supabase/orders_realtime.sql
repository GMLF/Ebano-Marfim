-- Rode isso no Supabase: SQL Editor > New query > cola e "Run".
-- Liga o Realtime na tabela orders, pra quando o admin mudar o status de
-- um pedido (em "Pedidos e envio"), a esteira em Minha Conta do cliente
-- atualizar sozinha, sem precisar recarregar a página.
--
-- Seguro por padrão: o Realtime respeita a Row Level Security da tabela
-- (supabase/orders.sql) — cada cliente só recebe eventos dos próprios
-- pedidos, nunca dos de outra pessoa.

alter publication supabase_realtime add table public.orders;
