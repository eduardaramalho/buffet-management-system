# Deploy em produção (Azure)

Decisões e alternativas em [ADR 0011](../docs/adr/0011-hospedagem-e-deploy.md). Resumo:

- Uma VM Linux ARM (Ubuntu 24.04, `Standard_B2pls_v2`, 2 vCPUs e 4 GiB) em **Canada Central**, na assinatura Azure for Students, resource group `rg-eventospro-prod`.
- Endereço público: `https://eventospro.canadacentral.cloudapp.azure.com`.
- Tudo roda em Docker Compose (`docker-compose.prod.yml`): MySQL, backend, frontend, Caddy (HTTPS), Prometheus e Grafana.
- O deploy é contínuo: cada push na `main` que passa por `backend`, `frontend`, `e2e` e `sonar` dispara o job `deploy` do CI.
- O CI publica as imagens no GHCR e atualiza a VM com `az vm run-command`. Não existe SSH: a porta 22 fica fechada.

## Endereços

| Serviço | URL |
|---|---|
| Aplicação | `https://<PUBLIC_DOMAIN>/` |
| API | `https://<PUBLIC_DOMAIN>/api/v1` |
| Health check | `https://<PUBLIC_DOMAIN>/api/v1/health` |
| Grafana | `https://<PUBLIC_DOMAIN>/grafana` (usuário `admin`, senha em `GRAFANA_ADMIN_PASSWORD`) |

`/api/v1/metrics` responde 404 de fora; o Prometheus coleta pela rede interna do Docker.

## Arquivos

| Arquivo | Onde roda | Função |
|---|---|---|
| `docker-compose.prod.yml` | VM | Serviços de produção, limites de memória, rotação de logs |
| `Caddyfile` | VM | HTTPS (Let's Encrypt), roteamento, cabeçalhos de segurança |
| `scripts/azure-provision.sh` | Cloud Shell, uma vez | Recria VM, IP, portas e identidade do GitHub pela CLI (equivalente ao passo a passo abaixo) |
| `scripts/github-configure.sh` | Cloud Shell, uma vez | Cadastra secrets (senhas aleatórias) e variáveis do GitHub |
| `scripts/vm-bootstrap.sh` | VM, uma vez | Docker, swap, atualizações automáticas de segurança |
| `scripts/build-remote-script.sh` | CI | Empacota a configuração e o `.env` no script enviado à VM |
| `scripts/remote-deploy.sh` | VM, a cada deploy | Pull das imagens, `up`, seed, agendamento do backup |
| `scripts/backup-mysql.sh` | VM, diário às 03:30 UTC | `mysqldump` compactado, retenção de 7 dias |

## Fluxo de um deploy

1. Build e push das imagens `ghcr.io/<repositório>/backend` e `frontend` para `linux/arm64`, com a tag do commit. Os estágios de build rodam na arquitetura do runner; só o runtime é emulado (QEMU).
2. Geração do `.env` de produção a partir dos secrets e variáveis do repositório.
3. Login na Azure por OIDC com a identidade gerenciada `id-eventospro-deploy` (nenhuma senha guardada).
4. `az vm run-command` executa na VM:
   - extração da configuração em `/opt/eventospro`;
   - login temporário no GHCR com o token do próprio job;
   - `docker compose pull` e `up --wait` (as migrations rodam no entrypoint do backend);
   - seed idempotente (`node dist/seed.js`).
5. Smoke test: `/api/v1/health` responde 200, a página inicial carrega e `/api/v1/metrics` responde 404.

## Configuração inicial (uma vez)

### 1. Criar a VM

A assinatura Azure for Students só permite criar recursos em **Italy North, Canada Central, Chile Central, Brazil South e Belgium Central** (política `RequestDisallowedByAzure`). Entre elas, só Canada Central tinha a série B liberada, e apenas em ARM; por isso a VM e as imagens são ARM.

No portal, **Virtual machines → Create → Azure virtual machine**.

**Aba Basics**

| Campo | Valor |
|---|---|
| Subscription | Azure for Students |
| Resource group | `rg-eventospro-prod` |
| Virtual machine name | `vm-eventospro-prod` |
| Region | `(Canada) Canada Central` |
| Availability options | No infrastructure redundancy required |
| Security type | Standard |
| VM architecture | **Arm64** |
| Image | Ubuntu Server 24.04 LTS - ARM64 Gen2 |
| Size | `Standard_B2pls_v2` (2 vCPUs, 4 GiB, cerca de US$ 27/mês) |
| Authentication type | SSH public key |
| Username | `azureuser` |
| SSH public key source | Generate new key pair (guarde o `.pem`; só para emergência) |
| Public inbound ports | Allow selected ports |
| Select inbound ports | **HTTP (80)** e **HTTPS (443)**. **Não** marque SSH (22) |

**Aba Disks:** OS disk type **Standard SSD**, marque **Delete with VM**.

**Aba Networking:** mantenha o IP público novo e marque **Delete public IP and NIC when VM is deleted**.

**Aba Management:** deixe **Enable auto-shutdown desmarcado** (a aplicação precisa ficar no ar).

**Review + create → Create.** Se pedir, baixe a chave SSH.

### 2. Definir o endereço público

1. VM → **Overview** → clique no **Public IP address**.
2. **Settings → Configuration**:
   - **DNS name label:** `eventospro` (se estiver em uso, tente `eventospro-tcc`).
   - **Assignment:** Static.
3. **Apply.** O endereço completo é `eventospro.canadacentral.cloudapp.azure.com`; ele é o `PUBLIC_DOMAIN`.

### 3. Preparar a VM

1. VM → **Operations → Run command → RunShellScript**.
2. Cole o conteúdo de `deploy/scripts/vm-bootstrap.sh` e clique em **Run**.
3. Leva de 3 a 6 minutos. A saída precisa terminar com `BOOTSTRAP_OK`.

### 4. Identidade do GitHub Actions

1. Busque **Managed Identities → Create**:
   - Resource group `rg-eventospro-prod`, Region `Canada Central`, Name `id-eventospro-deploy`.
2. Na identidade criada: **Settings → Federated credentials → Add credential**:
   - Scenario: **GitHub Actions deploying Azure resources**
   - Organization: `eduardaramalho`; Repository: `buffet-management-system`
   - Entity: **Branch**; Branch: `main`; Name: `github-main`
3. Em **Overview**, copie o **Client ID**.
4. No resource group `rg-eventospro-prod`: **Access control (IAM) → Add → Add role assignment**:
   - Role: **Virtual Machine Contributor**
   - Members: **Managed identity** → `id-eventospro-deploy`
   - **Review + assign**.
5. Copie também o **Tenant ID** (busque **Microsoft Entra ID**, Overview) e o **Subscription ID** (busque **Subscriptions**, Azure for Students).

### 5. Secrets e variáveis no GitHub

Repositório → **Settings → Secrets and variables → Actions**.

**Aba Secrets**

| Nome | Valor |
|---|---|
| `AZURE_CLIENT_ID` | Client ID da identidade gerenciada |
| `AZURE_TENANT_ID` | Tenant ID |
| `AZURE_SUBSCRIPTION_ID` | Subscription ID |
| `MYSQL_ROOT_PASSWORD` | valor aleatório (veja abaixo) |
| `MYSQL_PASSWORD` | valor aleatório |
| `JWT_ACCESS_SECRET` | valor aleatório |
| `GRAFANA_ADMIN_PASSWORD` | valor aleatório |
| `ADMIN_INITIAL_PASSWORD` | senha do primeiro login de `admin@buffet.local` (mínimo 8 caracteres) |

**Aba Variables**

| Nome | Valor |
|---|---|
| `PUBLIC_DOMAIN` | `eventospro.canadacentral.cloudapp.azure.com` |
| `ACME_EMAIL` | e-mail para avisos do Let's Encrypt |
| `AZURE_RESOURCE_GROUP` | `rg-eventospro-prod` |
| `AZURE_VM_NAME` | `vm-eventospro-prod` |

Os valores vão sem aspas para um arquivo `.env`. Use só letras, números, `-` e `_` (sem espaço, `#`, `$` ou aspas). Para gerar um valor aleatório no PowerShell:

```powershell
$b = New-Object byte[] 32; [Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($b); -join ($b | ForEach-Object { $_.ToString('x2') })
```

### 6. Primeiro deploy

Faça o merge do Pull Request na `main`. Acompanhe o job **deploy** em **Actions**. Ao terminar:

1. Abra `https://<PUBLIC_DOMAIN>/` e entre com `admin@buffet.local` e a senha de `ADMIN_INITIAL_PASSWORD`.
2. Troque a senha do administrador. Os próximos deploys nunca a redefinem.

## Operação

**Rodar um comando na VM:** VM → Run command → RunShellScript. Exemplos:

```bash
cd /opt/eventospro && docker compose -f docker-compose.prod.yml --env-file .env ps
cd /opt/eventospro && docker compose -f docker-compose.prod.yml --env-file .env logs --tail 100 backend
/opt/eventospro/scripts/backup-mysql.sh && ls -lh /opt/eventospro/backups
```

**Restaurar um backup:**

```bash
cd /opt/eventospro
gunzip -c backups/<arquivo>.sql.gz | docker compose -f docker-compose.prod.yml --env-file .env \
  exec -T mysql sh -c 'MYSQL_PWD="$MYSQL_ROOT_PASSWORD" mysql -uroot "$MYSQL_DATABASE"'
```

**Refazer o deploy da versão atual:** Actions → CI → execução da `main` → **Re-run all jobs**.

**Trocar um segredo:** atualize o secret no GitHub e refaça o deploy. Atenção: `MYSQL_PASSWORD` e `MYSQL_ROOT_PASSWORD` só são lidos pelo MySQL na criação do volume. Depois disso, trocá-los exige alterar a senha também dentro do banco.

**Custos:** acompanhe em Cost Management (orçamento de US$ 45/mês com alertas). Depois da divulgação das notas, exclua o resource group `rg-eventospro-prod` para parar todo o consumo.
