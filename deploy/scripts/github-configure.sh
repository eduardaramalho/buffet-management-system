#!/usr/bin/env bash
# Cadastra os secrets e as variáveis do GitHub Actions usados pelo job "deploy" (ADR 0011).
# Executado uma vez no Azure Cloud Shell, depois do azure-provision.sh, com o GitHub CLI autenticado (gh auth login).
# Senhas são geradas aleatoriamente e só são criadas se ainda não existirem: rodar de novo nunca troca
# a senha do banco (o MySQL só a lê na criação do volume).
set -euo pipefail

readonly REPOSITORY="eduardaramalho/buffet-management-system"
readonly RESOURCE_GROUP="rg-eventospro-prod"
readonly VM_NAME="vm-eventospro-prod"
readonly IDENTITY_NAME="id-eventospro-deploy"
readonly RANDOM_BYTES=32

gh auth status >/dev/null 2>&1 || { echo "Rode 'gh auth login' antes." >&2; exit 1; }

existing_secrets="$(gh secret list --repo "${REPOSITORY}" --json name --jq '.[].name')"

set_secret_once() {
  local name="$1" value="$2"
  if grep -qx "${name}" <<< "${existing_secrets}"; then
    echo "secret ${name}: já existe, mantido"
  else
    gh secret set "${name}" --repo "${REPOSITORY}" --body "${value}"
    echo "secret ${name}: criado"
  fi
}

random_secret() {
  openssl rand -hex "${RANDOM_BYTES}"
}

# Identificadores da Azure: sempre atualizados (não são senhas e podem mudar se a identidade for recriada).
gh secret set AZURE_CLIENT_ID --repo "${REPOSITORY}" \
  --body "$(az identity show --resource-group "${RESOURCE_GROUP}" --name "${IDENTITY_NAME}" --query clientId --output tsv)"
gh secret set AZURE_TENANT_ID --repo "${REPOSITORY}" --body "$(az account show --query tenantId --output tsv)"
gh secret set AZURE_SUBSCRIPTION_ID --repo "${REPOSITORY}" --body "$(az account show --query id --output tsv)"

set_secret_once MYSQL_ROOT_PASSWORD "$(random_secret)"
set_secret_once MYSQL_PASSWORD "$(random_secret)"
set_secret_once JWT_ACCESS_SECRET "$(random_secret)"
set_secret_once GRAFANA_ADMIN_PASSWORD "$(random_secret)"

admin_password=""
if ! grep -qx "ADMIN_INITIAL_PASSWORD" <<< "${existing_secrets}"; then
  admin_password="$(openssl rand -hex 8)"
fi
[ -n "${admin_password}" ] && set_secret_once ADMIN_INITIAL_PASSWORD "${admin_password}"

fqdn="$(az network public-ip show --resource-group "${RESOURCE_GROUP}" --name "${VM_NAME}-ip" --query dnsSettings.fqdn --output tsv)"
gh variable set PUBLIC_DOMAIN --repo "${REPOSITORY}" --body "${fqdn}"
gh variable set ACME_EMAIL --repo "${REPOSITORY}" --body "$(az account show --query user.name --output tsv)"
gh variable set AZURE_RESOURCE_GROUP --repo "${REPOSITORY}" --body "${RESOURCE_GROUP}"
gh variable set AZURE_VM_NAME --repo "${REPOSITORY}" --body "${VM_NAME}"

echo
echo "Endereço público: https://${fqdn}"
if [ -n "${admin_password}" ]; then
  echo "Login inicial:    admin@buffet.local / ${admin_password}"
  echo "ANOTE esta senha agora: ela não é exibida de novo. Troque-a no primeiro acesso."
fi
echo "GITHUB_CONFIG_OK"
