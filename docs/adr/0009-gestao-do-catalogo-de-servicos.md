# ADR 0009: Gestão do catálogo de serviços (RF06)

- **Status:** Aceito
- **Escopo:** Backend (`ServiceCatalogService`, `PrismaServiceRepository`, `ServiceController`, `errorHandler`, `auditActivity`, `prisma/seed.ts`), frontend (`ServicesListPage`, `ServiceForm`, menu e rota `/services`), E2E (passo 4 da jornada)

## Contexto

O ADR 0001 definiu os serviços como catálogo N:N, com o item genérico `Outro` como entrada única (`isCustom = true`). A API de CRUD existia, mas o RF06 estava parcial: não havia tela, e o backend não garantia as regras do próprio ADR. Era possível criar nomes duplicados e mais de um serviço genérico, excluir o `Outro` ou mudar o tipo de um serviço já contratado. Um id inexistente respondia 400 ou 500 em vez de 404.

## Decisões

1. **Nome único entre serviços ativos.** A verificação usa a collation do MySQL (`utf8mb4_unicode_ci`), que já ignora maiúsculas, minúsculas e acentos. Espaços nas pontas são removidos. A violação responde **409**. Não há índice único no banco, porque um serviço excluído (soft delete) não deve bloquear o mesmo nome no futuro.
2. **`Outro` é criado pelo seed e protegido.** O seed cria o serviço genérico, de forma idempotente, se o catálogo ativo não tiver um. Ele pode ser renomeado, mas não excluído (400). Um segundo serviço genérico é recusado (409). A tela só cria serviços padrão.
3. **O tipo do serviço é imutável.** Trocar `isCustom` invalidaria os rótulos (`customLabel`) já gravados nos eventos, então a mudança é recusada (400).
4. **Excluir um serviço contratado é permitido.** É soft delete: os eventos mantêm o serviço no histórico, e ele deixa de ser oferecido em novos eventos e na replicação (RF25, que já avisa sobre serviços removidos). A confirmação na tela explica esse efeito.
5. **404 para serviço inexistente ou excluído** em `get`, `update` e `remove` (`NotFoundError`), seguindo o padrão dos demais módulos.
6. **Auditoria legível:** `SERVICE_CREATED`, `SERVICE_UPDATED` (com nome antes e depois) e `SERVICE_DELETED` (com o nome) passam a aparecer em português no histórico e na atividade recente.
7. **Tela:** lista com busca local (o catálogo é pequeno e a API não pagina), selo "Rótulo livre" no `Outro`, formulário lateral só com o nome, e ações conforme as permissões `services:*`. O menu fica em Operação, logo após Clientes.

## Prós

- As regras do ADR 0001 passam a valer no backend, não só por convenção.
- Nenhuma migration: as regras usam o schema atual.
- O histórico dos eventos é preservado em qualquer exclusão.

## Contras e limitações

- **Concorrência:** sem índice único, duas criações simultâneas com o mesmo nome podem passar pela verificação. Para um catálogo mantido pelo administrador, o risco é baixo; a mitigação seria uma coluna normalizada com índice único parcial (não suportado diretamente pelo MySQL).
- A unicidade depende da collation do banco. Trocar a collation muda a regra; o ADR registra essa dependência.

## Alternativas descartadas

- **Bloquear a exclusão de serviço em uso:** mais restritivo que o necessário, porque o soft delete já preserva o histórico e o buffet precisa poder retirar um serviço que deixou de oferecer.
- **Checkbox de "rótulo livre" na tela:** permitiria vários serviços genéricos e contradiz a entrada única do ADR 0001.
- **Índice único em `name`:** impediria recriar um serviço com o nome de um já excluído.
