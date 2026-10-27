# ADR 0011: Hospedagem em produção e deploy contínuo

- **Status:** Aceito
- **Escopo:** Infraestrutura (`deploy/`), CI/CD (`.github/workflows/ci.yml`, job `deploy`), backend (`trust proxy`, seed de produção), documentação (README, Wiki: Deploy)

## Contexto

O Portfolio Playbook da disciplina exige que a solução esteja **em nuvem, com acesso público e estável, sem depender de máquina local**, até a divulgação final das notas (11/12/2026), passando pelo Poster + Demo Day (10, 15 e 16/12/2026). As restrições que pesam na escolha:

- **Obrigatório:** deploy via CI/CD (GitHub Actions) e ambientes distintos de desenvolvimento e produção.
- **Reprovação direta:** projeto fora do ar, deploy manual via SSH ou FTP e banco em disco local (SQLite, H2).
- **Não usar:** Vercel, Netlify, Render, Firebase e plataformas que entregam banco, autenticação e APIs prontos.
- **Evitar:** serviços que ocultam a infraestrutura e o deploy (integração direta com o GitHub, SSL automático) sem domínio técnico sobre o ambiente.
- **Preferir:** AWS, Azure, GCP, Docker e Terraform.

O projeto já roda inteiro em Docker Compose: MySQL 8, backend (Node 24, migrations no entrypoint), frontend (build Vite servido por Nginx), Prometheus e Grafana. O recurso disponível é a assinatura **Azure for Students** (US$ 100 de crédito por 12 meses, sem cartão).

## Decisões

1. **Provedor:** Microsoft Azure, assinatura Azure for Students, com orçamento e alertas de custo no Cost Management.
2. **Computação:** uma **VM Linux ARM** (Ubuntu 24.04 LTS, tamanho **B2pls_v2**, 2 vCPUs e 4 GB, cerca de US$ 27/mês) em **Canada Central**, no resource group `rg-eventospro-prod`. A assinatura de estudante só permite cinco regiões (Italy North, Canada Central, Chile Central, Brazil South, Belgium Central), e nelas a série B x64 não estava liberada; Canada Central oferecia a série B em ARM. Tamanhos com 1 GB ficam no limite com MySQL, Node, Prometheus e Grafana juntos, e indisponibilidade reprova o projeto.
3. **Orquestração:** `deploy/docker-compose.prod.yml`, separado do Compose de desenvolvimento. Usa imagens versionadas pelo SHA do commit, não faz build na VM e define limites de memória por serviço.
4. **Banco:** MySQL 8 em container, com volume persistente e **backup diário** (`mysqldump` agendado na VM, com retenção). O MySQL não publica porta no host.
5. **Borda e HTTPS:** **Caddy** como proxy reverso, com certificado Let's Encrypt para o rótulo DNS gratuito do IP público (`eventospro.<região>.cloudapp.azure.com`).
   - `/api/*` vai para o backend e o restante para o frontend, na **mesma origem**. Por isso, `VITE_API_URL` fica vazio e `CORS_ORIGIN` é a URL pública.
   - `/api/v1/metrics` é bloqueado na borda. O Prometheus coleta pela rede interna do Docker.
   - O Grafana é servido em `/grafana`, com senha forte vinda dos secrets.
6. **Rede:** o NSG da VM libera apenas as portas 80 e 443. A porta 22 fica fechada, porque nenhuma etapa de operação ou deploy depende de SSH.
7. **Registro de imagens:** GitHub Container Registry (GHCR), com as imagens `backend` e `frontend` publicadas pelo próprio workflow para `linux/arm64`. Os estágios de build dos Dockerfiles usam `$BUILDPLATFORM` (geram só JavaScript e arquivos estáticos); apenas o estágio final é montado com emulação (QEMU) no runner.
8. **Deploy contínuo:** novo job `deploy` no `ci.yml`, executado só em push na `main` e depois de `e2e` e `sonar` passarem. Sequência:
   1. Build e push das imagens com a tag do commit.
   2. Login na Azure por **OIDC** (`azure/login`), sem senha armazenada.
   3. `az vm run-command invoke` envia o bundle `deploy/` e o `.env` de produção, autentica no GHCR com o `GITHUB_TOKEN` temporário do job, faz `docker compose pull` e `up -d`, aplica as migrations e roda o seed.
9. **Identidade do pipeline:** uma **User Assigned Managed Identity** (`id-eventospro-deploy`) com credencial federada para o repositório (branch `main`) e papel **Virtual Machine Contributor** restrito ao resource group. Contas de estudante costumam ter a criação de App Registration bloqueada no tenant da universidade; a identidade gerenciada é um recurso da própria assinatura.
10. **Segredos e configuração:** senhas e identificadores da Azure ficam em **secrets do repositório**; valores não sensíveis (domínio, e-mail do Let's Encrypt, resource group e nome da VM) ficam em **variáveis do repositório**. Environments em repositório privado exigem plano pago. O `.env` de produção é gerado no job e nunca é versionado.
11. **Ajustes no backend para produção** (com TDD):
    - `trust proxy` configurável por variável de ambiente, para que o rate limiter enxergue o IP real do cliente atrás do Caddy, e não o IP do proxy.
    - O seed passa a ler a senha inicial do admin de `ADMIN_INITIAL_PASSWORD`, só define a senha na criação (nunca sobrescreve) e passa a ser executável na imagem de produção, que não tem as dependências de desenvolvimento.
12. **Provisionamento:** pelo portal da Azure, com o passo a passo documentado em `deploy/README.md`; `deploy/scripts/azure-provision.sh` reproduz a mesma infraestrutura pela Azure CLI. Terraform fica como evolução, se o prazo permitir.

## Prós

- Controle total do ambiente e da arquitetura, que é o que o Playbook pede e o que pode ser defendido na banca.
- Reaproveita o Compose e os Dockerfiles existentes; desenvolvimento e produção rodam as mesmas imagens.
- Deploy automatizado e rastreável: cada versão em produção corresponde a um commit que passou por testes, E2E e Sonar.
- Nenhuma credencial de longa duração fora do GitHub: OIDC para a Azure e token temporário para o GHCR.
- Custo estimado em torno de US$ 40 por mês, dentro do crédito até o fim da disciplina.

## Contras e limitações

- **Ponto único de falha:** uma VM só, sem alta disponibilidade. É aceitável para o porte do projeto e mitigado por `restart: unless-stopped`, healthchecks e backup diário.
- A manutenção do sistema operacional (atualizações de segurança) fica sob responsabilidade do projeto. Atualizações automáticas (`unattended-upgrades`) são ativadas no bootstrap.
- O banco em container exige backup e restauração próprios, diferente de um banco gerenciado.
- O `run-command` grava o script recebido na VM, acessível só pelo root. Como o `.env` vai nesse script, a VM passa a ser o perímetro de proteção dos segredos de produção.
- O build das imagens ARM no runner x64 é mais lento, porque a instalação das dependências de produção roda emulada.
- O rótulo DNS da Azure não é um domínio próprio. Um domínio pode ser apontado depois sem mudar a arquitetura.

## Alternativas descartadas

- **Azure App Service ou Container Apps:** menos operação, mas caem na categoria "Evitar" do Playbook (deploy integrado ao GitHub e SSL automático, sem domínio sobre o ambiente) e escondem a infraestrutura que a banca avalia.
- **Azure Database for MySQL (Flexible Server):** backup gerenciado e possivelmente coberto pela cota gratuita, mas acrescenta firewall, rede e TLS obrigatório na conexão do Prisma às vésperas da entrega. Fica como evolução.
- **Vercel, Netlify, Render, Firebase:** vedados pelo Playbook.
- **Deploy por SSH a partir do Actions:** seria automatizado, mas o Playbook lista "deploy via SSH" como motivo de reprovação; o `run-command` elimina a ambiguidade e permite manter a porta 22 fechada.
- **Build das imagens na própria VM:** dispensa o registro, mas consome a memória da produção durante o deploy e torna o artefato publicado diferente do que foi testado no CI.
