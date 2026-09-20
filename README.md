# Ébano & Marfim — Casa de Decants

Site front-end (HTML/CSS/JS puro, sem build) para uma **casa de curadoria de decants e frascos fechados** de perfumes reais: **Bidaya Parfums** (Sex on the Rocks, Vanilla P\*rn, Ayat, Maktub La Vie, Elliur), a linha **Drops** + outras fragrâncias da **Mykonos**, os clássicos **Dior Sauvage** e **Dior Homme**, e best-sellers da **Lattafa** (Khamrah, Yara, Asad, Oud Mood). A loja não fabrica os perfumes — compra os lotes originais e revende em decant (3ml/5ml/10ml) ou no frasco fechado de fábrica.

## Estrutura

```
ebano-marfim-perfumes/
├── index.html          # Início — hero, manifesto, destaques
├── colecao.html        # Coleção — busca + filtros (select) + grade + quick view
├── quiz.html            # Quiz de 10 perguntas com ranking por notas
├── atelie.html          # As 5 etapas do decant
├── contato.html         # Depoimentos + newsletter
├── conta.html            # Login / cadastro / recuperação de senha / Google (via Supabase)
├── checkout.html         # Checkout simulado — cartão parcelado ou Pix
├── css/
│   └── style.css        # tokens de tema (claro/escuro), layout e componentes
├── js/
│   ├── script.js         # catálogo de produtos, carrinho, quiz, filtros — roda em todas as páginas
│   ├── supabase-config.js # suas credenciais do Supabase (troque os valores)
│   ├── auth.js            # login/cadastro/recuperação/Google — roda em todas as páginas
│   ├── conta.js            # lógica só da página conta.html
│   └── checkout.js         # lógica só da página checkout.html
├── assets/
│   ├── favicon.svg
│   └── products/           # fotos reais dos produtos (ver observação abaixo)
└── README.md
```

Site multi-página de verdade (não é uma âncora dentro de uma página só) — cabeçalho, rodapé, carrinho e menu mobile são repetidos em cada `.html` porque é um site estático sem servidor/templating; se um dia isso for para produção com backend, esses blocos repetidos são o primeiro ponto a virar componente/include.

## Como abrir

Basta abrir `index.html` diretamente no navegador (duplo clique) — não há dependências de build. As únicas chamadas externas são as fontes do Google Fonts (Fraunces + Jost) e a biblioteca `@supabase/supabase-js` via CDN; as fotos dos produtos já estão salvas localmente em `assets/products/`.

Para servir localmente (recomendado para testar bem o `localStorage`):

```bash
# na pasta do projeto
python -m http.server 8080
# depois acesse http://localhost:8080
```

## Como ativar o login (Supabase)

O login/cadastro/recuperação de senha/Google **não funcionam ainda** — o site está pronto pro código, só falta ligar suas credenciais:

1. Crie uma conta gratuita em [supabase.com](https://supabase.com) e um novo projeto.
2. Em **Settings → API**, copie a **Project URL** e a **anon public key**.
3. Cole os dois valores em `js/supabase-config.js`, no lugar de `SEU-PROJETO` e `SUA-CHAVE-ANON-PUBLICA-AQUI`.
4. Em **Authentication → URL Configuration**, defina a Site URL como o domínio onde o site vai rodar (ex.: `https://seudominio.com.br` ou, em teste local, `http://localhost:8080`).
5. Pra ativar o botão "Continuar com Google": em **Authentication → Providers → Google**, ative e cole o **Client ID** e **Client Secret** de um projeto OAuth criado no [Google Cloud Console](https://console.cloud.google.com/apis/credentials) (tela de consentimento OAuth + credencial "Web application", com a URL de callback que o próprio Supabase mostra nessa tela).
6. E-mail/senha e recuperação de senha já funcionam sem nenhum passo extra — o Supabase envia os e-mails de confirmação e de redefinição automaticamente (dá pra customizar o template em **Authentication → Email Templates**).

Sem esses passos, os formulários de `conta.html` mostram um aviso amarelo e uma mensagem de erro amigável em vez de travar.

## Sobre o checkout (pagamento)

`checkout.html` é uma **simulação completa do fluxo de compra** — endereço, cartão com parcelamento (1x a 6x sem juros) e Pix (com 5% de desconto simulado) — mas **nenhum pagamento real é processado**. Isso é proposital e não é uma limitação a ser "corrigida" com mais código: por regra do setor (PCI-DSS), nenhum site deve capturar ou guardar número de cartão diretamente.

Pra aceitar pagamento de verdade, o caminho é integrar um **gateway de pagamento homologado** — no Brasil, o mais comum pra cartão + Pix + parcelamento é o **Mercado Pago** (Checkout Pro ou Bricks), alternativas são PagSeguro e Pagar.me. Isso exige:
- **CNPJ** pra abrir conta de recebimento no gateway;
- Um **backend** que gere a cobrança com as credenciais do gateway (não dá pra fazer isso só no front-end com segurança) — o Supabase também serve pra isso via Edge Functions, ou um servidor Node simples.

## Como ativar o cálculo de frete (Correios + Jadlog via SuperFrete)

Correios e Jadlog direto exigem contrato comercial com CNPJ — não é opção agora. Um agregador (junta os dois num só cálculo) é o único caminho que aceita conta de pessoa física. Usamos o **SuperFrete** em vez do Melhor Envio porque o token é gerado direto no painel (sem fluxo de OAuth com app + autorização).

O checkout já tem o botão "Calcular frete" e a Edge Function pronta (`supabase/functions/calcular-frete/`), só falta ligar as credenciais:

1. Rode `supabase/shipping.sql` no SQL Editor do Supabase (adiciona as colunas de frete na tabela `orders`).
2. Crie uma conta gratuita em [superfrete.com.br](https://superfrete.com.br) (aceita CPF, não precisa de CNPJ) e, no painel, em **Configurações → Integrações**, gere um **token de API** com permissão de cálculo de frete.
3. Instale a [CLI do Supabase](https://supabase.com/docs/guides/cli) e faça o login (`supabase login`), depois `supabase link` no seu projeto.
4. Configure os secrets da função (nunca no código, nunca commitados):
   ```bash
   supabase secrets set SUPERFRETE_TOKEN=seu-token-aqui
   supabase secrets set ORIGEM_CEP=00000000
   supabase secrets set CONTATO_EMAIL=contato@ebanoemarfim.com.br
   ```
5. Publique a função: `supabase functions deploy calcular-frete`.

Até isso ser configurado, o botão de calcular frete mostra "Frete ainda não configurado no servidor" em vez de travar — e a opção de entrega local grátis em Londrina continua funcionando independente disso. O peso de cada item é uma **estimativa** (definida em `PESO_POR_ITEM` dentro da função) — ajuste os valores lá se pesar os produtos de verdade. Se o endpoint da API do SuperFrete tiver mudado desde a última atualização deste projeto, me manda um print do painel deles (tela de gerar token ou a documentação da API) que a gente ajusta a função.

O CEP no checkout também preenche endereço, cidade e estado automaticamente via [ViaCEP](https://viacep.com.br) (serviço público, gratuito, sem necessidade de token).

## Editar preços

Os preços de decant/frasco fechado estão em `data/products.js` (campos `fullPrice` e `decants: {3, 5, 10}` de cada produto).

**Importante:** o servidor também guarda uma cópia desses preços em `supabase/product_prices.sql`, usada pra recalcular o total de cada pedido de verdade (ver seção de Segurança abaixo). Sempre que mudar um preço aqui, atualize o valor correspondente nesse arquivo e rode ele de novo no SQL Editor do Supabase — senão o pedido é salvo com o preço antigo.

## Segurança

- **O total do pedido é recalculado no banco, não confia no navegador.** O checkout mostra o total calculado no cliente só pra experiência de compra, mas quem decide o valor que fica gravado é um gatilho no Postgres (`supabase/product_prices.sql`) que busca o preço real de cada item numa tabela própria (`product_prices`) e recalcula o subtotal — inclusive o desconto de 5% do Pix e o frete grátis da entrega local em Londrina. Isso existe porque, sem ele, alguém com o DevTools aberto poderia editar o preço no `localStorage` do carrinho antes de fechar o pedido.
- **A Edge Function de frete só aceita chamadas do domínio do site** (`https://gmlf.github.io`, mais `localhost:8080` pra testar local) — antes aceitava de qualquer origem, o que deixaria outra pessoa usar sua cota do SuperFrete escondida atrás do seu token. Se um dia colocar domínio próprio, adicione ele na lista `ORIGENS_PERMITIDAS` em `supabase/functions/calcular-frete/index.ts`.
- **A tabela de eventos de analytics (`analytics_events`) precisa aceitar registro de visitantes sem login**, então não dá pra travar totalmente quem pode escrever nela — mas `supabase/analytics_hardening.sql` limita isso a tipos de evento conhecidos e a um tamanho máximo de payload, pra impedir que alguém despeje lixo direto pela API do Supabase.
- Segredos (chave `service_role`, senha do banco, Client Secret do Google, token do SuperFrete) nunca ficam no código — só como variável de ambiente local (`.env`, no `.gitignore`) ou secret do Supabase.
- Os campos de cartão no checkout são só visuais: não saem do navegador, não são salvos em nenhum lugar (é simulação, ver seção acima).

Rode `supabase/product_prices.sql` e `supabase/analytics_hardening.sql` no SQL Editor do Supabase pra ativar essas duas proteções.

## Status do pedido e envio (painel de admin)

Rode `supabase/order_fulfillment.sql` no SQL Editor do Supabase. Ele adiciona:
- Uma coluna `status` em `orders` (`pendente`, `pago`, `enviado`, `entregue`, `cancelado`), começando sempre em `pendente`.
- As colunas de endereço do destinatário (`recipient_name`, `recipient_phone`, `cep`, `street`, `number`, `neighborhood`, `city`, `state`) — o checkout já manda esses dados, só faltava o banco ter onde guardar.
- A função `admin_update_order_status`, que só admin consegue chamar, e só muda a coluna `status` — nunca o valor do pedido.

No `admin.html`, a seção **"Pedidos e envio"** lista todos os pedidos (não filtra por período, de propósito — um pedido parado há semanas ainda precisa aparecer) com o endereço de entrega e um seletor de status editável direto ali.

## Funcionalidades

- **Navegação por páginas separadas**: Início, Coleção, Quiz, Ateliê, Contato, Minha Conta e Checkout.
- **Coleção com busca por nome + dois selects** (marca: Bidaya Parfums / Mykonos / Dior / Lattafa; nota: Chypre Floral / Gourmand-Oriental / Floral Frutado / Amadeirado / Aromático Aquático), combináveis entre si, mais busca rápida pelo ícone de lupa no cabeçalho (funciona em qualquer página).
- **Clique em qualquer parte do card abre a quick view** — só o seletor de tamanho e o botão de carrinho têm ação própria dentro do card.
- **Bottle "girando"**: dentro da quick view, o frasco balança suavemente em 3D enquanto o modal está aberto (produtos com foto de arte de marca própria, como os da Bidaya Parfums, mostram a arte original em vez do frasco flutuando).
- **Vitrine no hero** (Início) com fotos reais, efeito de flutuação e parallax/tilt 3D ao mover o mouse.
- **Link direto pra um produto**: `colecao.html#p-<id>` já abre a quick view daquele item ao carregar a página (usado pelos destaques do Início e pelo resultado do Quiz).
- **Alternador claro/escuro** no cabeçalho, persistido em `localStorage`. O tema escuro ("Ébano") tem um acabamento de mármore com veios e brilho dourado nos painéis de destaque.
- **Login, cadastro e recuperação de senha** (e-mail/senha + Google) via Supabase — ver seção acima pra ativar.
- **Carrinho lateral (drawer)** com foto real do produto, quantidade, remoção e subtotal, persistido em `localStorage`, acessível em qualquer página; "Finalizar seleção" leva pro checkout.
- **Checkout simulado** com cartão parcelado ou Pix — ver seção acima.
- **Quiz "Qual fragrância é a sua cara?"** de **10 perguntas**: cada resposta soma pontos a notas olfativas específicas, e no final cruza essas notas com o perfil real de cada fragrância e mostra um **ranking com % de afinidade** pra todo o catálogo.
- **Carrossel de depoimentos** automático + navegação manual (página Contato).
- **Newsletter** com validação de e-mail no front-end (sem backend real).

## Sobre as fotos dos produtos

As imagens em `assets/products/` vêm de fontes oficiais/varejistas confiáveis:

- **Bidaya Parfums** (`bidayaparfums.com`, site oficial da marca): essas fotos são a arte de divulgação completa da marca (com fundo próprio ilustrado), por isso aparecem no site sem o recorte/fundo removido que os outros produtos têm — é a arte original da casa, não uma foto de estúdio comum.
- **Mykonos** (`officialmykonos.com`) e **Dior** (via `epocacosmeticos.com.br`) e **Lattafa** (via `epocacosmeticos.com.br` e `pequiperfumes.com.br`/loja parceira): fotos de produto em fundo branco, com o fundo removido e recortado num enquadramento padronizado (PNG com transparência) pra ficar consistente na grade e encaixar bem tanto no tema claro quanto no escuro.

Mostrar a foto real do item que você revende é prática padrão de qualquer loja/decant house, mas **não use esse site como se fosse o site oficial de nenhuma dessas marcas** — a Ébano & Marfim é a revendedora/curadora, não a fabricante. Dior em especial é uma marca grande e mais restritiva sobre uso de imagem do que as outras — antes de operar isso como negócio real, confirme com cada marca (ou com quem você compra o estoque) se há alguma restrição de uso de imagem para revenda.

## Observações

Este é um protótipo de front-end: não há backend próprio além do que o Supabase fornece pra login, nem pagamento ou envio real de e-mails de pedido — o carrinho simula a experiência no navegador (via `localStorage`), e o checkout é uma demonstração do fluxo, não um processador de pagamento real. Os preços são placeholder até você informar os custos reais.
