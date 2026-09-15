#!/usr/bin/env bash
# Lê as credenciais do .env (arquivo local, fora do Git) e gera
# js/supabase-config.js (esse sim é commitado — só tem a chave pública).
#
# Uso:
#   bash scripts/sync-env.sh
#
# Este script NÃO faz git add/commit/push — ele só escreve o arquivo
# js/supabase-config.js localmente. Suba pro GitHub quando quiser, do
# jeito que você já usa (git add / commit / push).

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
ENV_FILE="$ROOT_DIR/.env"
OUT_FILE="$ROOT_DIR/js/supabase-config.js"

if [ ! -f "$ENV_FILE" ]; then
  echo "Não encontrei $ENV_FILE."
  echo "Copie .env.example para .env e preencha com suas credenciais do Supabase."
  exit 1
fi

# carrega só as chaves que interessam, ignorando comentários e linhas em branco
SUPABASE_URL=$(grep -E '^SUPABASE_URL=' "$ENV_FILE" | tail -1 | cut -d '=' -f2-)
SUPABASE_ANON_KEY=$(grep -E '^SUPABASE_ANON_KEY=' "$ENV_FILE" | tail -1 | cut -d '=' -f2-)

if [ -z "$SUPABASE_URL" ] || [ -z "$SUPABASE_ANON_KEY" ]; then
  echo "SUPABASE_URL ou SUPABASE_ANON_KEY não encontrados/vazios em $ENV_FILE."
  exit 1
fi

cat > "$OUT_FILE" <<EOF
/* =========================================================
   Credenciais do Supabase — gerado automaticamente por
   scripts/sync-env.sh a partir do .env local. Não edite este
   valor à mão; edite o .env e rode o script de novo.
   ========================================================= */
window.SUPABASE_URL = '${SUPABASE_URL}';
window.SUPABASE_ANON_KEY = '${SUPABASE_ANON_KEY}';
EOF

echo "OK: js/supabase-config.js atualizado a partir de $ENV_FILE."
