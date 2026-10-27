#!/usr/bin/env bash
# Executado no runner do GitHub Actions (job "deploy"). Monta o script que o `az vm run-command`
# executa na VM: um invólucro POSIX (o run-command pode usar /bin/sh) que grava o remote-deploy.sh,
# com o bundle de configuração e as credenciais temporárias do GHCR, e o executa com bash.
# Uso: build-remote-script.sh <arquivo .env de produção> <arquivo de saída>
set -euo pipefail

readonly ENV_FILE="${1:?informe o arquivo .env de produção}"
readonly OUTPUT="${2:?informe o arquivo de saída}"
REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
readonly REPO_ROOT
readonly HEREDOC_MARKER="EVENTOSPRO_REMOTE_DEPLOY"
readonly SAFE_VALUE='^[A-Za-z0-9_.+/=-]+$'

: "${GHCR_USER:?GHCR_USER não definido}"
: "${GHCR_TOKEN:?GHCR_TOKEN não definido}"

staging="$(mktemp -d)"
trap 'rm -rf "${staging}"' EXIT

cp "${REPO_ROOT}/deploy/docker-compose.prod.yml" "${REPO_ROOT}/deploy/Caddyfile" "${staging}/"
cp -r "${REPO_ROOT}/deploy/scripts" "${staging}/scripts"
cp -r "${REPO_ROOT}/observability" "${staging}/observability"
cp "${ENV_FILE}" "${staging}/.env"

bundle="$(tar -czf - -C "${staging}" . | base64 -w0)"

# Os valores entram entre aspas simples no script gerado; só aceitamos caracteres que não quebram a citação.
for value in "${bundle}" "${GHCR_USER}" "${GHCR_TOKEN}"; do
  [[ "${value}" =~ ${SAFE_VALUE} ]] || { echo "Valor com caracteres inesperados" >&2; exit 1; }
done

# shellcheck disable=SC2016 # o texto entre aspas simples é o próprio script gerado, expandido só na VM.
{
  echo '#!/bin/sh'
  echo 'umask 077'
  echo 'script="$(mktemp)"'
  echo "cat > \"\$script\" <<'${HEREDOC_MARKER}'"
  echo '#!/usr/bin/env bash'
  echo "export BUNDLE_B64='${bundle}'"
  echo "export GHCR_USER='${GHCR_USER}'"
  echo "export GHCR_TOKEN='${GHCR_TOKEN}'"
  tail -n +2 "${REPO_ROOT}/deploy/scripts/remote-deploy.sh"
  echo "${HEREDOC_MARKER}"
  echo 'status=0'
  echo 'bash "$script" || status=$?'
  echo 'rm -f "$script"'
  echo 'exit "$status"'
} > "${OUTPUT}"
