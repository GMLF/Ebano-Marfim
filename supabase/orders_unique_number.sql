-- Rode isso no Supabase: SQL Editor > New query > cola e "Run".
-- Agora que order_number é usado pra casar a confirmação de pagamento da
-- InfinitePay com o pedido certo, ele precisa ser garantidamente único
-- (antes era só um número aleatório de 6 dígitos, sem checagem).

alter table public.orders
  add constraint orders_order_number_key unique (order_number);
