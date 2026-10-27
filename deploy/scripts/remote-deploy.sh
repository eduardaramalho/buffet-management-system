#!/usr/bin/env bash
# Executado NA VM pelo job "deploy" do CI, via `az vm run-command` (ADR 0011). Não usa SSH.
# O CI injeta as variáveis BUNDLE_B64, GHCR_USER e GHCR_TOKEN antes deste conteúdo
# (veja deploy/scripts/build-remote-script.sh). O CI só considera o deploy concluído se a saída tiver DEPLOY_OK.
set -euo pipefail

readonly APP_DIR="/opt/eventospro"
readonly COMPOSE_FILE="docker-compose.prod.yml"
readonly REGISTRY="ghcr.io"

: "${BUNDLE_B64:?bundle de deploy ausente}"
: "${GHCR_USER:?usuário do GHCR ausente}"
: "${GHCR_TOKEN:?token do GHCR ausente}"

mkdir -p "${APP_DIR}/backups"
cd "${APP_DIR}"

echo "==> Extraindo configuração (compose, Caddyfile, observabilidade, scripts e .env)"
echo "${BUNDLE_B64}" | base64 -d | tar -xz -C "${APP_DIR}"
chmod 600 .env
chmod 700 scripts/*.sh

compose() {
  docker compose -f "${COMPOSE_FILE}" --env-file .env "$@"
}

# O token do job expira quando o workflow termina; o logout garante que ele não fique gravado na VM.
trap 'docker logout "${REGISTRY}" >/dev/null 2>&1 || true' EXIT
echo "${GHCR_TOKEN}" | docker login "${REGISTRY}" -u "${GHCR_USER}" --password-stdin

echo "==> Baixando imagens"
compose pull --quiet

echo "==> Subindo serviços (as migrations rodam no entrypoint do backend)"
compose up -d --remove-orphans --wait --wait-timeout 300

echo "==> Seed idempotente (papéis, permissões, serviço Outro e admin inicial)"
compose exec -T backend node dist/seed.js

echo "==> Agendando backup diário do banco"
cat > /etc/cron.d/eventospro-backup <<CRON
SHELL=/bin/bash
30 3 * * * root ${APP_DIR}/scripts/backup-mysql.sh >> /var/log/eventospro-backup.log 2>&1
CRON
chmod 644 /etc/cron.d/eventospro-backup

echo "==> Limpando imagens antigas"
docker image prune -f >/dev/null

compose ps
echo "DEPLOY_OK"
