-- Rode isso no Supabase: SQL Editor > New query > cola e "Run".
--
-- A tabela analytics_events precisa aceitar insert de qualquer um (mesmo
-- sem login), porque é assim que rastreamos visitante que não tem conta.
-- Mas hoje ela aceita literalmente qualquer coisa: um script poderia
-- despejar lixo nela direto pela API do Supabase, sem passar pelo site.
-- Essas duas restrições não bloqueiam o rastreamento normal, só travam
-- o que claramente não é um evento válido do nosso site.

alter table public.analytics_events
  drop constraint if exists chk_event_type_valido,
  add constraint chk_event_type_valido check (
    event_type in ('page_view', 'search', 'product_view', 'add_to_cart', 'checkout_start', 'checkout_complete')
  );

alter table public.analytics_events
  drop constraint if exists chk_payload_tamanho,
  add constraint chk_payload_tamanho check (pg_column_size(payload) < 2000);
