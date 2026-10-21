# ADR 0005: Cadastro de clientes e vínculo com eventos

- **Status:** Aceito
- **Escopo:** Backend (`modules/clients`, `modules/events`), migration `20261021200000_add_clients`, frontend (`ClientsListPage`, `ClientForm`, `EventForm`, `EventDetailsPage`)

## Contexto

A RFC (seção 3.1 e Figura 1, bloco "Entrada de Dados") prevê o cadastro e gerenciamento de clientes e define que o cadastro do evento inclui o cliente. O sistema já tinha eventos em produção sem nenhum dado de cliente, então o vínculo não podia nascer obrigatório no banco sem uma migração de dados.

## Decisões

1. **Modelo:** `Client` com `type` (`PF`/`PJ`), `name`, `document`, `email`, `phone`, `notes`, timestamps e `deletedAt`. Relação N:1 `Event.clientId -> Client`, com `ON DELETE RESTRICT`. Endereço ficou de fora porque o local já pertence ao evento (minimização de dados). Contatos múltiplos (1:N) ficam como evolução futura.
2. **Expand/contract no `clientId`:** a coluna nasce nullable (expand). A aplicação exige o cliente na criação do evento (Zod e service). Na edição, o `clientId` é opcional para não travar a troca de status de eventos antigos pela Central do evento; o formulário de edição exige o cliente. Quando todos os eventos antigos estiverem vinculados, uma segunda migration aplica `NOT NULL` (contract).
3. **Documento:** opcional, validado por dígito verificador conforme o tipo (CPF ou CNPJ), armazenado sem pontuação. A validação aceita o CNPJ alfanumérico (12 caracteres `[0-9A-Z]` + 2 dígitos numéricos, valor de cada caractere = código ASCII menos 48), emitido pela Receita Federal desde julho de 2026. CNPJs numéricos continuam válidos com o mesmo algoritmo.
4. **Unicidade global do documento:** índice `UNIQUE` em `document`, incluindo clientes excluídos. O MySQL trata `NULL` como distinto, então clientes sem documento não colidem. O service verifica antes de gravar e o repository traduz a violação `P2002` (corrida entre verificação e insert) em `409`.
5. **Exclusão:** soft delete, bloqueado com `409` enquanto houver eventos não excluídos fora de `CONCLUIDO`/`CANCELADO`. Eventos encerrados mantêm o vínculo, e as telas exibem o cliente como inativo.
6. **Erros:** `ClientManagementError` (400) e `ClientConflictError` (409) ficam no domínio, e não no arquivo do service como nos módulos anteriores, porque o repository também lança o conflito. Cliente inexistente usa o `NotFoundError` compartilhado (404). Erros Zod seguem em 422.
7. **Desacoplamento:** o módulo de eventos depende de uma porta `EventClientReader` (no domínio de eventos), implementada por `PrismaClientRepository` e injetada no factory, sem import direto do módulo de clientes nas camadas internas.
8. **LGPD:** a auditoria grava só nome, tipo e nomes de campos alterados, nunca documento, e-mail ou telefone. O evento expõe um resumo do cliente sem o documento.

## Prós

- Migração sem risco para os eventos existentes e regra de negócio ativa desde já.
- Integridade do documento garantida pelo banco, não só pela aplicação.
- Validação pronta para o novo formato de CNPJ.

## Contras e limitações

- Durante a transição, a obrigatoriedade do cliente fica só na aplicação.
- Como a reativação de clientes está fora do escopo, o documento de um cliente excluído impede um novo cadastro com o mesmo CPF/CNPJ (a API explica o motivo no `409`).
- No soft delete os dados pessoais são mantidos; a anonimização para atender ao direito de eliminação (LGPD, art. 18) é evolução futura.

## Alternativas descartadas

- **`clientId` obrigatório já na primeira migration:** exigiria criar clientes fictícios para os eventos antigos, poluindo os dados.
- **Cliente sempre opcional:** contraria a RFC e deixaria eventos novos sem cliente.
- **Unicidade só entre clientes ativos:** o MySQL não tem índice parcial; exigiria coluna gerada ou só checagem na aplicação, sujeita a corrida.
