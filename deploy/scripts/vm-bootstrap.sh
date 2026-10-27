#!/usr/bin/env bash
# Preparação única da VM de produção (ADR 0011).
# Executado uma vez pelo portal da Azure: VM > Executar comando > RunShellScript.
# Idempotente: pode ser executado de novo sem efeito colateral.
set -euo pipefail

readonly APP_DIR="/opt/eventospro"
readonly SWAP_FILE="/swapfile"
readonly SWAP_SIZE="2G"

export DEBIAN_FRONTEND=noninteractive

echo "==> Atualizando pacotes"
apt-get update -q
apt-get upgrade -y -q
apt-get install -y -q ca-certificates curl gnupg unattended-upgrades

echo "==> Instalando Docker Engine e Compose (repositório oficial da Docker)"
if ! command -v docker >/dev/null 2>&1; then
  install -m 0755 -d /etc/apt/keyrings
  curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
  chmod a+r /etc/apt/keyrings/docker.asc
  # shellcheck disable=SC1091
  codename="$(. /etc/os-release && echo "$VERSION_CODENAME")"
  echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/ubuntu ${codename} stable" \
    > /etc/apt/sources.list.d/docker.list
  apt-get update -q
  apt-get install -y -q docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
fi

echo "==> Rotação de logs dos containers"
mkdir -p /etc/docker
cat > /etc/docker/daemon.json <<'JSON'
{
  "log-driver": "json-file",
  "log-opts": { "max-size": "10m", "max-file": "3" }
}
JSON
systemctl enable docker
systemctl restart docker

echo "==> Swap de ${SWAP_SIZE} (folga de memória para picos)"
if ! swapon --show | grep -q "${SWAP_FILE}"; then
  fallocate -l "${SWAP_SIZE}" "${SWAP_FILE}"
  chmod 600 "${SWAP_FILE}"
  mkswap "${SWAP_FILE}"
  swapon "${SWAP_FILE}"
  grep -q "${SWAP_FILE}" /etc/fstab || echo "${SWAP_FILE} none swap sw 0 0" >> /etc/fstab
fi

echo "==> Atualizações automáticas de segurança"
cat > /etc/apt/apt.conf.d/20auto-upgrades <<'CONF'
APT::Periodic::Update-Package-Lists "1";
APT::Periodic::Unattended-Upgrade "1";
CONF

echo "==> Pasta da aplicação"
mkdir -p "${APP_DIR}/backups"
chmod 700 "${APP_DIR}"

docker --version
docker compose version
echo "BOOTSTRAP_OK"
