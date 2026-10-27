#!/usr/bin/env bash
# Backup diário do MySQL de produção (ADR 0011), agendado pelo remote-deploy.sh em /etc/cron.d.
# Restauração: gunzip -c backups/<arquivo>.sql.gz | docker compose -f docker-compose.prod.yml --env-file .env \
#   exec -T mysql sh -c 'MYSQL_PWD="$MYSQL_ROOT_PASSWORD" mysql -uroot "$MYSQL_DATABASE"'
set -euo pipefail

readonly APP_DIR="/opt/eventospro"
readonly BACKUP_DIR="${APP_DIR}/backups"
readonly RETENTION_DAYS=7

cd "${APP_DIR}"
mkdir -p "${BACKUP_DIR}"

timestamp="$(date -u +%Y%m%dT%H%M%SZ)"
target="${BACKUP_DIR}/eventospro-${timestamp}.sql.gz"

# A senha é lida dentro do container (MYSQL_PWD), então não aparece na lista de processos do host.
docker compose -f docker-compose.prod.yml --env-file .env exec -T mysql \
  sh -c 'MYSQL_PWD="$MYSQL_ROOT_PASSWORD" mysqldump -uroot --single-transaction --routines --triggers "$MYSQL_DATABASE"' \
  | gzip > "${target}.tmp"
mv "${target}.tmp" "${target}"
chmod 600 "${target}"

find "${BACKUP_DIR}" -name 'eventospro-*.sql.gz' -mtime +"${RETENTION_DAYS}" -delete

echo "$(date -u +%FT%TZ) backup criado: ${target}"
