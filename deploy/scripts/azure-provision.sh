#!/usr/bin/env bash
# Provisionamento da infraestrutura de produção na Azure (ADR 0011), executado uma vez no Azure Cloud Shell (Bash).
# A VM de produção foi criada pelo portal com estas mesmas configurações; o script documenta e reproduz o ambiente.
# Cria a VM com IP público e rótulo DNS, libera só as portas 80/443 e cria a identidade gerenciada
# usada pelo GitHub Actions (OIDC), com o papel Virtual Machine Contributor restrito ao resource group.
# Idempotente na medida do possível: recursos já existentes são reaproveitados.
set -euo pipefail

readonly RESOURCE_GROUP="rg-eventospro-prod"
# Regiões permitidas pela política da assinatura Azure for Students: italynorth, canadacentral,
# chilecentral, brazilsouth e belgiumcentral. Só Canada Central tinha a série B liberada (em ARM).
readonly LOCATION="canadacentral"
readonly VM_NAME="vm-eventospro-prod"
readonly VM_SIZE="Standard_B2pls_v2"
readonly DNS_LABEL="${DNS_LABEL:-eventospro}"
readonly IDENTITY_NAME="id-eventospro-deploy"
readonly GITHUB_REPOSITORY="eduardaramalho/buffet-management-system"
readonly ROLE_RETRIES=10
readonly ROLE_RETRY_DELAY_SECONDS=15

az group show --name "${RESOURCE_GROUP}" --output none

echo "==> VM ${VM_NAME} (${VM_SIZE}, ${LOCATION})"
if ! az vm show --resource-group "${RESOURCE_GROUP}" --name "${VM_NAME}" --output none 2>/dev/null; then
  az vm create \
    --resource-group "${RESOURCE_GROUP}" \
    --name "${VM_NAME}" \
    --location "${LOCATION}" \
    --image Canonical:ubuntu-24_04-lts:server-arm64:latest \
    --size "${VM_SIZE}" \
    --security-type Standard \
    --admin-username azureuser \
    --generate-ssh-keys \
    --storage-sku StandardSSD_LRS \
    --os-disk-delete-option Delete \
    --nic-delete-option Delete \
    --public-ip-address "${VM_NAME}-ip" \
    --public-ip-sku Standard \
    --public-ip-address-allocation static \
    --public-ip-address-dns-name "${DNS_LABEL}" \
    --nsg-rule NONE \
    --output none
fi

echo "==> Liberando apenas HTTP e HTTPS (sem SSH)"
az vm open-port --resource-group "${RESOURCE_GROUP}" --name "${VM_NAME}" --port 80,443 --priority 100 --output none

echo "==> Identidade gerenciada ${IDENTITY_NAME}"
az identity create --resource-group "${RESOURCE_GROUP}" --name "${IDENTITY_NAME}" --location "${LOCATION}" --output none
client_id="$(az identity show --resource-group "${RESOURCE_GROUP}" --name "${IDENTITY_NAME}" --query clientId --output tsv)"
principal_id="$(az identity show --resource-group "${RESOURCE_GROUP}" --name "${IDENTITY_NAME}" --query principalId --output tsv)"

echo "==> Credencial federada para o GitHub Actions (branch main)"
if ! az identity federated-credential show --resource-group "${RESOURCE_GROUP}" --identity-name "${IDENTITY_NAME}" --name github-main --output none 2>/dev/null; then
  az identity federated-credential create \
    --resource-group "${RESOURCE_GROUP}" \
    --identity-name "${IDENTITY_NAME}" \
    --name github-main \
    --issuer https://token.actions.githubusercontent.com \
    --subject "repo:${GITHUB_REPOSITORY}:ref:refs/heads/main" \
    --audiences api://AzureADTokenExchange \
    --output none
fi

echo "==> Papel Virtual Machine Contributor no resource group"
scope="$(az group show --name "${RESOURCE_GROUP}" --query id --output tsv)"
# A identidade recém-criada leva alguns segundos para ficar visível ao controle de acesso.
for attempt in $(seq 1 "${ROLE_RETRIES}"); do
  if az role assignment create --assignee-object-id "${principal_id}" --assignee-principal-type ServicePrincipal \
      --role "Virtual Machine Contributor" --scope "${scope}" --output none 2>/dev/null; then
    break
  fi
  [ "${attempt}" -eq "${ROLE_RETRIES}" ] && { echo "Falha ao atribuir o papel" >&2; exit 1; }
  sleep "${ROLE_RETRY_DELAY_SECONDS}"
done

fqdn="$(az network public-ip show --resource-group "${RESOURCE_GROUP}" --name "${VM_NAME}-ip" --query dnsSettings.fqdn --output tsv)"

echo
echo "================ Valores para o GitHub ================"
echo "Secret   AZURE_CLIENT_ID       = ${client_id}"
echo "Secret   AZURE_TENANT_ID       = $(az account show --query tenantId --output tsv)"
echo "Secret   AZURE_SUBSCRIPTION_ID = $(az account show --query id --output tsv)"
echo "Variable PUBLIC_DOMAIN         = ${fqdn}"
echo "Variable AZURE_RESOURCE_GROUP  = ${RESOURCE_GROUP}"
echo "Variable AZURE_VM_NAME         = ${VM_NAME}"
echo "PROVISION_OK"
