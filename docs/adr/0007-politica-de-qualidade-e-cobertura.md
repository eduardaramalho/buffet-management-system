# ADR 0007: Política de qualidade, cobertura e Quality Gate

- **Status:** Aceito
- **Escopo:** `apps/backend/jest.config.cjs`, `apps/frontend/vitest.config.ts`, `apps/frontend/eslint.config.js`, `apps/backend/package.json` (`typecheck`), `sonar-project.properties`, `.github/workflows/ci.yml`, `.github/scripts/coverage-summary.mjs`, `.github/rulesets/main.json`

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

7. **Lint do frontend obrigatório no CI** (KAN-84, 22/11/2026). O job `frontend` roda `npm run lint` antes dos testes, e o script usa `--max-warnings 0`: qualquer erro ou aviso do ESLint reprova o job. Antes disso o lint só rodava localmente e acumulou 3 erros das regras do React Compiler (`react-hooks/set-state-in-effect` e `react-hooks/refs`) e avisos de dependências de efeito sem que o pipeline acusasse. As regras não são desligadas nem silenciadas com `eslint-disable`: o código é ajustado. Os padrões adotados para atender às regras são:
   - carga inicial de tela com `useEffectEvent`, aplicando o estado só quando a resposta chega (`.then`), e reinício da tela por `key` quando o parâmetro da rota muda;
   - ref com o valor mais recente de uma função atualizada em efeito (`useLayoutEffect`), nunca durante o render;
   - efeitos que dependem de permissão usam o valor derivado (por exemplo, `canListTasks`) como dependência e descartam respostas que chegam depois da limpeza do efeito.

   O backend não tem ESLint configurado; a análise estática dele fica a cargo do Sonar.

8. **Checagem de tipos dos testes do backend no CI** (KAN-85, 24/11/2026). O job `backend` roda `npm run typecheck` (`tsc --noEmit -p tsconfig.json`) antes dos testes. O `tsconfig.build.json` exclui os `.spec.ts` e o ts-jest executa os testes sem barrar erro de tipo, então os specs acumularam 157 erros em 33 arquivos sem que o pipeline acusasse, com o build e os 729 testes passando. As correções seguem três padrões:
   - mocks tipados pela assinatura do contrato (`jest.fn<Repositorio["metodo"]>()`) quando o objeto entra no lugar de uma interface, para que mudanças na interface (campos novos como `isProtected` e `mustChangePassword`, métodos novos como `listByEvent` e `softDelete`) quebrem o typecheck em vez de passarem despercebidas;
   - parâmetros declarados (`async (..._args: unknown[]) =>`, `async (_args: unknown) =>`) nos mocks de controllers e de delegates do Prisma que já entram com `as never`, porque o `expect` do `@jest/globals` confere os argumentos de `toHaveBeenCalledWith` contra a assinatura do mock;
   - `as unknown as AuditService` onde o service depende da classe concreta `AuditService`, cujo campo privado impede que um objeto literal seja compatível.

## Estado atual da publicação

O repositório e o projeto do SonarCloud são públicos, e os badges de Quality Gate e cobertura estão no README. No plano gratuito, só repositórios públicos permitem rulesets, o que tornou possível bloquear o merge.

**Ruleset da `main` (KAN-53, 27/11/2026).** A configuração fica versionada em [`.github/rulesets/main.json`](../../.github/rulesets/main.json) e é importada em Settings > Rules > Rulesets. Ela aplica:

- **Checks obrigatórios:** `backend`, `frontend`, `e2e` e `sonar`, aceitos só quando publicados pelo GitHub Actions. Como o job `sonar` espera o Quality Gate (`sonar.qualitygate.wait`), um gate reprovado também bloqueia o merge. O `deploy` fica de fora porque só roda em push na `main`, depois do merge.
- **Branch atualizada com a `main`:** a PR precisa conter o último commit da `main` e passar pelos checks de novo, para que duas PRs aprovadas separadamente não quebrem a `main` juntas.
- **Merge só por pull request, com 0 aprovações:** o projeto tem uma desenvolvedora, e o GitHub não permite aprovar a própria PR. O que protege a `main` são os checks, não a revisão.
- **Sem exclusão da `main` e sem force push:** preserva o histórico que o Sonar usa para calcular o código novo.
- **Sem bypass, nem para o admin:** uma regra que o dono do repositório contorna não garante nada. Em uma emergência, o ruleset é desativado, a correção entra e ele é reativado, e a mudança fica registrada no histórico de regras do repositório.

Alternativas descartadas: a branch protection clássica, que é a forma legada e não restringe a origem dos checks; o bypass para o admin, que deixaria a regra só no papel; e desligar a exigência de branch atualizada, que economiza execuções do CI mas permite quebrar a `main` com dois merges seguidos.

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
