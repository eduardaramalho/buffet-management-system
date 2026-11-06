# ADR 0016: Padrão de formulários em modal centralizado

- **Status:** Aceito
- **Data:** 2026-11-05
- **Escopo:** Frontend (`components/form/`, `validation/`, `hooks/useFormValidation.ts`, `contexts/ToastContext.tsx`, formulários de Evento, Equipe, Regra, Cliente, Colaborador, Tarefa, Usuário, Papel e Serviço), E2E (jornada completa)

## Contexto

O estudo de UX dos formulários encontrou problemas que vinham da forma como as telas foram construídas, e não de uma tela só:

- **Botões desproporcionais.** A regra global `form button:not(.link-button)` dava a todo botão de formulário o tamanho do "Salvar". Em listas, como "Definir líder" e "Desvincular", o botão ficava muito maior que o texto ao lado.
- **Líder repetido.** Cada membro marcado ganhava um botão "Definir líder", e a regra de um líder só era checada no clique, com mensagem de erro. Na edição, trocar o líder podia gravar o novo antes de rebaixar o antigo, e a API recusava (409).
- **Erros longe do campo.** Uma única mensagem no rodapé, que parava no primeiro erro. Não havia marcação de obrigatório.
- **Sem padrão entre telas.** Painéis laterais com "Voltar" e "Cancelar" (ação duplicada); Usuário e Papel também existiam como páginas (`/users/new`, `/roles/new`) com outro layout.
- **Sem máscaras.** Telefone e CPF/CNPJ eram texto livre.

Entre dois modelos prototipados (página dedicada e modal centralizado), a stakeholder aprovou o **modal centralizado com seções** (Modelo B).

## Decisões

1. **Um componente de modal para todos os formulários** (`FormModal`):
   - Renderizado em portal no `<body>`, com `role="dialog"`, `aria-modal` e título ligado por `aria-labelledby`.
   - **Cancelar e Salvar sempre no canto direito do rodapé.** Nos formulários com seções, a navegação ("Seção anterior", "Próxima seção") fica à esquerda, para não deslocar os dois botões.
   - Durante o envio, o Salvar fica desabilitado, com `aria-busy` e o texto "Salvando...". Cancelar e Esc também ficam bloqueados.
   - Teclado: Enter envia (o conteúdo é um `<form>`), Esc fecha, Tab circula só dentro do modal e o foco volta para quem abriu.
   - Formulários longos (Evento, Equipe, Regra) usam navegação lateral por seções. As seções inativas continuam montadas (o estado e a validação enxergam todos os campos), mas ficam com `hidden`, fora da ordem de Tab. Ao salvar com erro, o modal abre a primeira seção com erro e foca o primeiro campo inválido.
2. **Componentes de campo reutilizáveis** (`components/form/`): `Field` (rótulo, obrigatório/opcional, ajuda e erro), `TextField`, `TextAreaField`, `SelectField`, `MaskedField`, `MaskedInput`, `PasswordField`, `FieldError`, `FieldGroup`, `ChoiceCard`, `SegmentedControl`, `Switch` e `FormSection`. O asterisco de obrigatório fica fora do `<label>` (não entra no nome acessível) e o controle recebe `aria-required`. O erro fica abaixo do campo e é ligado por `aria-describedby`.
3. **Validação com Zod no frontend, espelhando o backend.** Cada formulário tem um schema em `validation/` com os mesmos limites dos schemas Zod dos controllers, e mensagens em português. O CPF/CNPJ usa o mesmo cálculo de dígitos do domínio de clientes. A API continua validando tudo: o frontend só antecipa o erro.
   - Alternativa considerada: compartilhar os schemas do backend num pacote comum. Descartada porque o monorepo não tem workspace compartilhado e os schemas do backend usam tipos do Prisma; um pacote novo exigiria mudar o build e o CI a poucos dias da entrega.
   - O erro aparece quando a pessoa sai do campo ou tenta salvar (`useFormValidation`), e não enquanto ela ainda está digitando pela primeira vez.
4. **Máscaras** (`utils/masks.ts`): telefone, CPF, CNPJ (inclusive alfanumérico) e números inteiros. Data e hora usam os campos nativos (`date` e `datetime-local`), que já impõem o formato. Hoje não há campos de CEP nem de valor monetário; quando houver, a máscara entra no mesmo arquivo.
5. **Equipe:**
   - O cargo do membro vem do campo `position` do colaborador, sem mudança de banco. O rótulo passou de "Função" para "Cargo".
   - O líder é escolhido num único controle, que lista só os membros. Depois de escolhido, vira um cartão com "Trocar". Não existe mais botão de líder por membro, então a tela não permite dois líderes.
   - Ao salvar, quem deixa de liderar é rebaixado antes de o novo líder ser gravado, e o novo líder entra por último. Isso evita o 409 da API.
6. **Aviso de sucesso** (`ToastProvider`): depois de salvar, aparece um aviso numa região `aria-live` que some em 4 segundos. O erro da API aparece dentro do próprio modal (`role="alert"`), que continua aberto.
7. **Usuário e Papel** passam a usar o modal a partir das listas. As páginas `/users/new`, `/users/:id/edit`, `/roles/new` e `/roles/:id` foram removidas.

## Consequências

- Toda tela nova de cadastro deve usar `FormModal` e os componentes de `components/form/`, com um schema em `validation/`.
- Uma mudança de regra no backend (limite de caracteres, por exemplo) precisa ser repetida no schema do frontend. Os testes de `validation/schemas.test.ts` documentam os limites atuais.
- Os testes E2E navegam pelas seções dos formulários longos, porque os campos das seções inativas ficam ocultos.
- O diálogo de replicação de evento (ADR 0008) e o de redefinição de senha (ADR 0012) não fizeram parte do protótipo e continuam no painel lateral antigo.
