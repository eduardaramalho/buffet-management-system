# ADR 0021: Ambientes de desenvolvimento e produção, sem staging

- **Status:** Aceito
- **Escopo:** Infraestrutura (`docker-compose.yml`, `deploy/`), CI/CD (`.github/workflows/ci.yml`), documentação (Wiki: Deploy e Rastreabilidade-RFC)
- **Origem:** KAN-94
- **Relacionado:** ADR 0007 (Quality Gate e checks obrigatórios), ADR 0011 (hospedagem e deploy contínuo)

## Contexto

O [Portfolio Playbook](https://github.com/CatolicaSC-Portfolio/The-Portfolio-Playbook/blob/main/Portfolio.md#L42), em Pilares > 3. DevOps e Infraestrutura, pede a "manutenção de ambientes distintos (Desenvolvimento e Produção/Staging)" para que o parceiro externo teste uma versão estável.

Hoje o projeto tem:

- **Desenvolvimento:** máquina da desenvolvedora, com `npm run dev` ou o `docker-compose.yml` completo, banco local e segredos de desenvolvimento.
- **CI:** GitHub Actions, que roda testes, cobertura, SonarCloud e a jornada E2E com Playwright contra backend e MySQL reais, em contêineres descartáveis, a cada push e pull request.
- **Produção:** VM na Azure com `deploy/docker-compose.prod.yml`, banco e segredos próprios, atualizada pelo job `deploy` (ADR 0011).

Não existe um ambiente de staging (homologação) publicado entre o CI e a produção. A questão é se o projeto precisa de um.

Fatores que pesam na decisão:

- O texto do Playbook trata "Produção/Staging" como o segundo ambiente, ao lado do desenvolvimento. Os demais trechos do documento pedem a solução "em ambiente produtivo", com acesso público e estável.
- A base de produção contém só dados de teste. Não há cliente real nem dado pessoal real, e a versão publicada é usada pela orientadora e pela banca para avaliar o sistema.
- A assinatura Azure for Students tem crédito limitado, e a VM atual (B2pls_v2, 4 GB) já roda Caddy, frontend, backend, MySQL, Prometheus e Grafana com limites de memória por serviço.
- Uma mudança no pipeline perto das entregas finais coloca em risco justamente o ambiente que é avaliado.

## Decisão

1. **Dois ambientes publicados de fato: desenvolvimento e produção.** Não será criado staging nesta versão.
2. **A estabilidade da produção é garantida pelo pipeline, e não por um ambiente intermediário.** Uma versão só chega à produção depois de:
   - passar pelos checks `backend`, `frontend`, `e2e` e `sonar` (o E2E roda a jornada completa contra backend e banco reais, papel que um staging teria);
   - ser integrada na `main` por pull request, com os checks obrigatórios do ruleset versionado em `.github/rulesets/main.json` (ADR 0007);
   - ser publicada como imagem imutável no GHCR com a tag do SHA do commit, a mesma imagem que passou pelo CI.
3. **Isolamento entre os ambientes:** cada ambiente tem o próprio Compose, banco e segredos. Os segredos de produção ficam só nos secrets do GitHub e no `.env` gerado no job, nunca no repositório nem na máquina de desenvolvimento.
4. **Recuperação em caso de versão ruim:** rollback reexecutando o pipeline de um commit anterior (imagens versionadas no GHCR), migrations aditivas com correção por nova migration e backup diário do banco, conforme a seção de rollback da Wiki (Deploy).
5. **Gatilhos para rever esta decisão e criar staging:** entrada de um cliente real com dados reais na produção, mais de uma pessoa publicando versões, ou migrations destrutivas que precisem ser ensaiadas com uma cópia dos dados.

## Prós

- Atende o Playbook com dois ambientes distintos e isolados, sem custo adicional na Azure.
- Não mexe no deploy que está estável, o que preserva a disponibilidade exigida para a avaliação.
- O que seria validado em staging (integração entre frontend, backend e banco, em navegador real) já é validado a cada push pelo E2E do CI, de forma automática e repetível.
- Menos infraestrutura para manter: um único conjunto de segredos de nuvem, uma VM e um pipeline linear.

## Contras

- Não há um endereço público para testar manualmente uma versão antes de ela entrar em produção. Um problema que só apareça com os dados ou a configuração de produção é descoberto já em produção.
- O E2E roda com banco vazio e semeado a cada execução, e não com uma cópia dos dados de produção.
- A justificativa depende do contexto atual (base de teste, sem cliente real). Quando esse contexto mudar, staging passa a ser necessário (item 5 da decisão).

## Alternativas descartadas

- **Staging em uma segunda VM, com deploy promovido para produção:** é o modelo mais completo, mas aproximadamente dobra o consumo do crédito, exige novo rótulo DNS ou IP, banco, segredos e identidade OIDC próprios, e transforma o pipeline em duas etapas com aprovação. O ganho não compensa o risco e o custo enquanto a produção só tem dados de teste.
- **Staging na mesma VM, em outra porta ou caminho:** não tem custo de nuvem, mas divide CPU e memória com a produção (dois MySQL em 4 GB) e não isola os ambientes. Um problema no staging pode derrubar a produção, o que contradiz o objetivo de oferecer uma versão estável.
- **Ambientes efêmeros por pull request (preview):** dão um endereço por PR, mas exigem orquestração extra (criação e destruição de stacks e bancos) fora do escopo do projeto.

## Consequências

- A Wiki (Deploy e Rastreabilidade-RFC) registra os ambientes e esta justificativa.
- Toda mudança continua chegando à produção só pelo pipeline; não há deploy manual.
- Quando um dos gatilhos do item 5 ocorrer, a evolução prevista é a segunda VM com promoção para produção, reaproveitando o `deploy/docker-compose.prod.yml` e os scripts de provisionamento.
