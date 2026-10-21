# ADR 0006: Relatórios gerenciais e exportação

- **Status:** Aceito
- **Escopo:** Backend (`modules/reports`, `app.ts`, `prisma/seed.ts`), frontend (`ReportsPage`, `components/reports`, `BarChart`, `useReport`)

## Contexto

A RFC afirma, na Tabela 1, que a solução gera relatórios, e a seção 4 lista relatórios sobre eventos realizados, tarefas executadas e desempenho operacional das equipes. A hipótese (seção 1) propõe medir tarefas esquecidas e o tempo de resposta na atribuição. Nada disso existia além dos indicadores resumidos do dashboard.

## Decisões

1. **Módulo próprio `reports`, somente leitura**, com as mesmas camadas dos demais. O `ReportRepository` (porta no domínio) devolve agregados brutos; as definições de negócio (pontualidade, esquecida, média ponderada) ficam em funções puras do domínio (`report.metrics.ts`), aplicadas igualmente ao JSON, às linhas e aos arquivos.
2. **Recorte pela data do evento** em todos os relatórios, para que eventos, tarefas e equipes descrevam o mesmo conjunto.
3. **Sem N+1:** número fixo de consultas por relatório. Prisma (`groupBy`, `count` com field reference `completedAt <= dueDate`) onde ele expressa a agregação; **SQL parametrizado** (`Prisma.sql`) só no desempenho por equipe, que precisa de somas condicionais e média de diferença de datas por grupo.
4. **Limite de 366 dias** por consulta (422), protegendo o banco e o tamanho dos arquivos. Listagens JSON paginadas; exportações trazem o período inteiro.
5. **Exportação no backend** (`/export?format=csv|pdf`): um único ponto que respeita RBAC, filtros e limite. `ReportService` monta um `ReportDocument` independente de formato; cada `ReportExporter` (Strategy) só renderiza. Adicionar um formato não altera o serviço.
6. **PDF com PDFKit:** JavaScript puro, sem navegador headless, licença MIT, layout próprio em código (sem template).
7. **Segurança e LGPD:** permissão `reports:view` só para `admin`; proteção contra CSV injection; `Cache-Control: no-store`; auditoria `REPORT_EXPORTED` em cada exportação.
8. **Frontend sem biblioteca de gráficos:** `BarChart` em HTML/CSS acessível (`figure` + lista de valores). Relatórios são carregados sob demanda, sem polling, porque a análise é feita sobre um período fechado.

## Prós

- Indicadores da hipótese calculados com uma definição única e testada.
- Custo de consulta previsível, independente do volume.
- Formatos de exportação desacoplados do cálculo.

## Contras e limitações

- A consulta SQL bruta não é verificada pelo compilador; os testes cobrem a montagem e o mapeamento, e a execução real é validada no MySQL local.
- Uma nova dependência de runtime (`pdfkit`).
- Tempo de atribuição limitado pelo modelo atual: o motor não atribui equipe à tarefa e `assignedAt` guarda só a última atribuição.

## Alternativas descartadas

- **Agregar em memória** (como o dashboard faz com tarefas concluídas): simples, mas carrega todas as linhas e cresce com o volume.
- **CSV gerado no frontend / jsPDF:** exportaria só a página carregada e duplicaria regras no cliente.
- **Puppeteer:** PDF idêntico à tela, mas adiciona Chromium à imagem Docker e é frágil no CI.
