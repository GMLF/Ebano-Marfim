-- Rode isso no Supabase: SQL Editor > New query > cola e "Run".
--
-- ACHADO DE SEGURANÇA: a tabela public.admins foi criada sem nunca ligar
-- o Row Level Security (todas as outras tabelas do projeto têm — essa
-- ficou de fora por descuido). Sem RLS, dependendo das permissões padrão
-- do Supabase, qualquer pessoa logada no site poderia, abrindo o F12 e
-- chamando a API REST do Supabase diretamente (sem precisar do nosso
-- código), listar quem são os administradores — e possivelmente até
-- inserir o próprio user_id na tabela e virar admin sozinha.
--
-- A correção é ligar o RLS e NÃO criar nenhuma política de select/insert/
-- update/delete. Isso não quebra nada: ninguém do site precisa ler essa
-- tabela direto — toda checagem passa pela função is_admin(), que é
-- "security definer" e continua funcionando normalmente (funções assim
-- rodam com privilégio do dono da função, ignorando RLS). Com RLS ligado
-- e zero políticas, a tabela fica 100% inacessível via API pra qualquer
-- um, inclusive pra você mesmo logado — só dá pra mexer nela direto pelo
-- SQL Editor do Supabase (que sempre teve acesso total, independente de RLS).

alter table public.admins enable row level security;
