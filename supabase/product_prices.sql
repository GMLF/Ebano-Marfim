-- Rode isso no Supabase: SQL Editor > New query > cola e "Run".
--
-- Por que isso existe: hoje o checkout calcula o subtotal no navegador
-- e salva esse valor direto no pedido — alguém com o DevTools aberto
-- poderia editar o preço no localStorage e o pedido ficaria registrado
-- com um valor errado. Essa tabela é a fonte de verdade dos preços
-- (espelha data/products.js) e o gatilho abaixo recalcula o subtotal
-- de cada pedido no banco, ignorando o que vier do navegador. Também
-- força todo pedido a nascer com status 'pendente' (alguém poderia,
-- sem isso, mandar um pedido já criado como "pago" direto pela API) e
-- nunca deixa o frete ficar negativo.
--
-- IMPORTANTE: sempre que mudar um preço em data/products.js, atualize
-- os valores aqui também (rode este arquivo de novo — ele substitui
-- os preços antigos).

create table if not exists public.product_prices (
  product_id text not null,
  size text not null, -- '3', '5', '10' (decant, ml) ou 'full' (frasco fechado)
  price numeric not null,
  primary key (product_id, size)
);

-- preços públicos (já aparecem no site) — não precisa de RLS restritiva aqui
alter table public.product_prices enable row level security;
drop policy if exists qualquer_um_le_precos on public.product_prices;
create policy qualquer_um_le_precos on public.product_prices for select using (true);

insert into public.product_prices (product_id, size, price) values
  ('bidaya-sex-on-the-rocks', '3', 34), ('bidaya-sex-on-the-rocks', '5', 49), ('bidaya-sex-on-the-rocks', '10', 84), ('bidaya-sex-on-the-rocks', 'full', 259),
  ('bidaya-vanilla-porn', '3', 34), ('bidaya-vanilla-porn', '5', 49), ('bidaya-vanilla-porn', '10', 84), ('bidaya-vanilla-porn', 'full', 259),
  ('bidaya-ayat', '3', 34), ('bidaya-ayat', '5', 49), ('bidaya-ayat', '10', 84), ('bidaya-ayat', 'full', 259),
  ('bidaya-maktub-la-vie', '3', 34), ('bidaya-maktub-la-vie', '5', 49), ('bidaya-maktub-la-vie', '10', 84), ('bidaya-maktub-la-vie', 'full', 259),
  ('bidaya-elliur', '3', 34), ('bidaya-elliur', '5', 49), ('bidaya-elliur', '10', 84), ('bidaya-elliur', 'full', 259),
  ('milk-drops', '3', 34), ('milk-drops', '5', 49), ('milk-drops', '10', 84), ('milk-drops', 'full', 259),
  ('pink-drops', '3', 34), ('pink-drops', '5', 49), ('pink-drops', '10', 84), ('pink-drops', 'full', 259),
  ('cafe-drops', '3', 34), ('cafe-drops', '5', 49), ('cafe-drops', '10', 84), ('cafe-drops', 'full', 259),
  ('dior-sauvage', '3', 115), ('dior-sauvage', '5', 169), ('dior-sauvage', '10', 285), ('dior-sauvage', 'full', 869),
  ('dior-homme', '3', 105), ('dior-homme', '5', 159), ('dior-homme', '10', 269), ('dior-homme', 'full', 815),
  ('lattafa-khamrah', '3', 32), ('lattafa-khamrah', '5', 49), ('lattafa-khamrah', '10', 82), ('lattafa-khamrah', 'full', 249),
  ('lattafa-yara', '3', 26), ('lattafa-yara', '5', 39), ('lattafa-yara', '10', 66), ('lattafa-yara', 'full', 199),
  ('lattafa-asad', '3', 27), ('lattafa-asad', '5', 41), ('lattafa-asad', '10', 69), ('lattafa-asad', 'full', 209),
  ('lattafa-oud-mood', '3', 31), ('lattafa-oud-mood', '5', 47), ('lattafa-oud-mood', '10', 79), ('lattafa-oud-mood', 'full', 239),
  ('mykonos-california', '3', 34), ('mykonos-california', '5', 49), ('mykonos-california', '10', 84), ('mykonos-california', 'full', 259),
  ('mykonos-myego', '3', 34), ('mykonos-myego', '5', 49), ('mykonos-myego', '10', 84), ('mykonos-myego', 'full', 259)
on conflict (product_id, size) do update set price = excluded.price;

-- Recalcula o subtotal de cada pedido a partir dos preços reais (product_prices),
-- não do valor que veio do navegador. Também zera o frete quando for a
-- entrega própria em Londrina (regra do negócio: essa entrega é sempre grátis).
create or replace function public.calcular_subtotal_pedido()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  item jsonb;
  preco numeric;
  total numeric := 0;
begin
  for item in select * from jsonb_array_elements(new.items)
  loop
    select price into preco from public.product_prices
      where product_id = item->>'id' and size = (item->>'size');
    if preco is null then
      raise exception 'Produto ou tamanho inválido no pedido: % / %', item->>'id', item->>'size';
    end if;
    total := total + preco * coalesce((item->>'qty')::numeric, 1);
  end loop;

  if new.payment_method = 'pix' then
    total := total * 0.95; -- mesmo desconto de 5% mostrado no checkout
  end if;

  if new.shipping_carrier = 'Entrega própria' then
    new.shipping_price := 0;
  end if;
  new.shipping_price := greatest(coalesce(new.shipping_price, 0), 0); -- nunca negativo, nem pra abater o total

  new.subtotal := round(total + coalesce(new.shipping_price, 0), 2);
  new.status := 'pendente'; -- ignora qualquer status que venha do navegador: todo pedido nasce pendente, só o webhook ou o admin mudam depois
  return new;
end;
$$;

drop trigger if exists trg_calcular_subtotal_pedido on public.orders;
create trigger trg_calcular_subtotal_pedido
  before insert on public.orders
  for each row execute function public.calcular_subtotal_pedido();
