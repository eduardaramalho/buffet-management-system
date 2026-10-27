# ADR 0007: Política de qualidade, cobertura e Quality Gate

- **Status:** Aceito
- **Escopo:** `apps/backend/jest.config.cjs`, `apps/frontend/vitest.config.ts`, `sonar-project.properties`, `.github/workflows/ci.yml`, `.github/scripts/coverage-summary.mjs`

## Contexto

A linha Web Apps do Portfólio exige cobertura de testes unitários de 75% no backend e 25% no frontend, além de análise estática de código. A auditoria do SonarCloud em 22/10/2026 mostrou três problemas, mesmo com o Quality Gate aprovado e 88,5% de cobertura geral:

1. **Exclusões divergentes.** O Jest excluía `role.factory.ts` e `role.routes.ts` da cobertura, mas o Sonar não. Arquivos indexados pelo Sonar e ausentes do LCOV são contados como 0%. Além disso, a exclusão escondia que as rotas de papéis não tinham teste de permissão, ao contrário das rotas de equipes, regras, tarefas e auditoria.
2. **Cobertura do frontend medida pela metade.** Sem `coverage.include`, o Vitest 4 mede apenas os arquivos importados por algum teste. Cinco páginas e dois módulos de API sem nenhum teste ficavam fora do threshold local, mas apareciam com 0% no Sonar.
3. **Quality Gate sem efeito.** O job de análise publicava o resultado sem esperar o gate. Um gate reprovado não reprovava o pipeline.

O Quality Gate do Sonar também não consegue aplicar limites diferentes por diretório, então ele sozinho não prova os mínimos separados de backend e frontend.

## Decisões

1. **Uma única lista de exclusões de cobertura**, idêntica no Jest, no Vitest e no Sonar. Ficam de fora apenas:
   - código gerado (`apps/backend/src/generated/**`, cliente Prisma);
   - testes e setup de testes;
   - pontos de entrada que só montam a aplicação: `apps/backend/src/server.ts`, `apps/backend/src/seed.ts`, `apps/frontend/src/main.tsx`, `apps/frontend/src/App.tsx`.

   Rotas e factories **não** são excluídas: são cobertas pelos testes de permissão de cada módulo. Qualquer nova exclusão precisa atualizar os três arquivos e este ADR.

2. **Frontend medido sobre todo o `src/`** (`coverage.include: ['src/**/*.{ts,tsx}']`), para que o número local seja o mesmo que o Sonar enxerga.

3. **Thresholds aplicados nas quatro métricas** (linhas, branches, funções e statements):
   - **Backend: 85%** (mínimo exigido: 75%).
   - **Frontend: 80%** (mínimo exigido: 25%).

   As quatro métricas são exigidas porque a métrica de linhas sozinha é enganosa neste código: componentes escritos em uma única linha contam como uma linha coberta, mesmo com várias funções e condicionais sem teste. Os thresholds acima do mínimo protegem o nível atual contra regressões.

4. **Garantia em duas camadas:**
   - **CI (por aplicação):** os thresholds do Jest e do Vitest reprovam o build de cada app. Cada job publica uma tabela de cobertura no resumo do GitHub Actions (`coverage-summary.mjs`), que serve de evidência separada por aplicação.
   - **Sonar (código novo):** `sonar.qualitygate.wait=true` faz o job `sonar` falhar quando o gate reprova, com timeout de 300 segundos.

5. **Testes de caracterização para código já existente.** Os testes adicionados nesta etapa (contrato das APIs, páginas de autenticação e papéis, estados da Central do evento e do Dashboard, rotas de papéis) descrevem o comportamento atual de código escrito antes deles. Eles são registrados como testes de caracterização, não como TDD. Código novo continua seguindo TDD.

6. **Política de triagem de issues do Sonar:**
   - **High e Medium:** corrigir sempre.
   - **Low:** corrigir quando o custo for baixo; caso contrário, marcar como **Accepted** com comentário explicando o motivo.
   - **False positive:** somente quando a regra não se aplica tecnicamente ao trecho, com justificativa no comentário.
   - Alterações em massa sem comentário não são permitidas: cada decisão deve ser rastreável no próprio Sonar.

## Limitação temporária

O repositório e o projeto do SonarCloud estão privados, e a conta não possui GitHub Pro. No plano gratuito, repositórios privados não permitem branch protection nem rulesets. Até a abertura do repositório:

- um gate ou threshold reprovado deixa o commit com status de falha no Actions, mas não bloqueia o merge na `main`;
- o bloqueio depende de disciplina: nada é integrado à `main` com o pipeline vermelho.

**Quando o repositório ficar público:** criar um ruleset na `main` exigindo os checks `backend`, `frontend`, `e2e` e `sonar`; tornar o projeto do SonarCloud público e adicionar os badges de Quality Gate e cobertura ao README.

## Prós

- O número de cobertura é o mesmo no terminal, no CI e no Sonar.
- Lacunas reais deixam de ficar escondidas por exclusões.
- Os mínimos por aplicação ficam comprovados a cada execução do pipeline.
- O Quality Gate passa a ter efeito sobre o pipeline.

## Contras

- Ao incluir todo o `src/` do frontend, qualquer tela nova sem teste reduz a cobertura imediatamente e pode reprovar o build. Esse é o comportamento desejado, mas exige escrever os testes junto com a tela.
- Thresholds altos nas quatro métricas aumentam o custo de mudanças grandes no frontend.
- `sonar.qualitygate.wait` acrescenta alguns segundos de espera ao job de análise.

## Alternativas descartadas

- **Excluir os arquivos sem cobertura do Sonar:** deixaria os números bonitos, mas esconderia código de produção sem teste, inclusive uma camada de autorização.
- **Usar apenas o Quality Gate do Sonar:** ele não separa backend de frontend e, por padrão, avalia só o código novo.
- **Manter 25% no frontend:** atende ao mínimo, mas permitiria que a cobertura atual caísse em mais de 50 pontos sem nenhum alerta.
