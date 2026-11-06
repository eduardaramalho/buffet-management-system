import { expect, request, test, type Page } from '@playwright/test'
import { ApiClient, expectStatus } from '../support/api'
import { data } from '../support/data'
import { daysFromNow, toDateInput, toDateTimeLocal } from '../support/dates'
import { e2eEnv } from '../support/env'
import { login, logout, navigateTo, selectWhenLoaded } from '../support/ui'

/**
 * Jornada completa de um evento, do cadastro à análise gerencial, com um único navegador e um
 * único banco recriado do zero. Cada teste é um passo de negócio e depende do anterior (serial).
 *
 * Erros de JavaScript não tratados (a "tela branca") são coletados durante toda a jornada e
 * verificados ao final de cada passo: o backend pode ter respondido certo e a interface ter quebrado.
 */
test.describe.serial('Jornada do evento: cadastro → regras → confirmação → execução → conclusão → replicação → relatórios', () => {
  let page: Page
  let admin: ApiClient
  let temporaryPassword = ''
  let managerAccessToken = ''
  const pageErrors: string[] = []

  const eventRow = (name: string) => page.getByRole('button', { name: `Visualizar ${name}` })
  const openEventHub = async (name: string) => {
    await navigateTo(page, 'Eventos', 'Eventos')
    await eventRow(name).click()
    await expect(page.getByRole('heading', { level: 1, name })).toBeVisible()
  }
  const currentStep = () => page.locator('.event-step.current')
  const findEvent = async (name: string) => {
    const events = await admin.json<Array<{ id: string; name: string; status: string }>>(admin.get('/events'))
    const event = events.find((item) => item.name === name)
    expect(event, `evento "${name}" não encontrado na API`).toBeDefined()
    return event!
  }

  test.beforeAll(async ({ browser }) => {
    admin = await ApiClient.login(e2eEnv.admin)

    page = await browser.newPage()
    page.on('pageerror', (error) => pageErrors.push(error.message))
    await page.goto('/login')
  })

  test.afterEach(() => {
    expect(pageErrors, 'erros de JavaScript não tratados na interface').toEqual([])
  })

  test.afterAll(async () => {
    await page?.close()
    await admin?.dispose()
  })

  test('1. administrador acessa o sistema', async () => {
    // ADR 0012: sem recuperação por e-mail; "Esqueceu a senha?" orienta procurar o administrador.
    await page.getByRole('button', { name: 'Esqueceu a senha?' }).click()
    await expect(page.getByRole('region', { name: 'Como recuperar a senha' })).toContainText('Procure o administrador do sistema')
    await login(page, e2eEnv.admin.email, e2eEnv.admin.password)
    await expect(page.getByRole('heading', { level: 1, name: 'Dashboard' })).toBeVisible()
  })

  test('2. cadastro de usuário com papel de gestor', async () => {
    await navigateTo(page, 'Usuários', 'Usuários')
    await page.getByRole('button', { name: 'Novo usuário' }).click()
    const dialog = page.getByRole('dialog', { name: 'Novo usuário' })
    await dialog.getByLabel('Nome').fill(data.manager.name)
    await dialog.getByLabel('E-mail').fill(data.manager.email)
    await dialog.getByRole('radio', { name: data.manager.role, exact: true }).check()
    await dialog.getByLabel('Senha inicial').fill(data.manager.password)
    await dialog.getByRole('button', { name: 'Criar usuário' }).click()
    await expect(dialog).toBeHidden()
    await expect(page.getByText(data.manager.email).first()).toBeVisible()
  })

  test('3. cadastro de cliente', async () => {
    await navigateTo(page, 'Clientes', 'Clientes')
    await page.getByRole('button', { name: 'Novo cliente' }).click()
    const dialog = page.getByRole('dialog', { name: 'Novo cliente' })
    await dialog.getByLabel('Nome', { exact: true }).fill(data.client.name)
    await dialog.getByLabel('E-mail').fill(data.client.email)
    await dialog.getByLabel('Telefone').fill(data.client.phone)
    await dialog.getByRole('button', { name: 'Salvar' }).click()
    await expect(dialog).toBeHidden()
    await expect(page.getByText(data.client.name).first()).toBeVisible()
  })

  test('4. catálogo de serviços: cadastro, nome duplicado recusado e "Outro" protegido (RF06)', async () => {
    await navigateTo(page, 'Serviços', 'Serviços')
    // O seed traz o serviço genérico "Outro", que pode ser editado mas nunca excluído.
    await expect(page.getByRole('button', { name: 'Editar Outro' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Excluir Outro' })).toHaveCount(0)

    await page.getByRole('button', { name: 'Novo serviço' }).click()
    const dialog = page.getByRole('dialog', { name: 'Novo serviço' })
    await dialog.getByLabel('Nome do serviço').fill(data.service)
    await dialog.getByRole('button', { name: 'Salvar' }).click()
    await expect(dialog).toBeHidden()
    await expect(page.getByText(data.service, { exact: true })).toBeVisible()

    // Mesmo nome com outra caixa: recusado pelo backend (409) e a mensagem aparece no formulário.
    await page.getByRole('button', { name: 'Novo serviço' }).click()
    await dialog.getByLabel('Nome do serviço').fill(data.service.toUpperCase())
    await dialog.getByRole('button', { name: 'Salvar' }).click()
    await expect(dialog.getByRole('alert')).toContainText('Já existe um serviço com este nome')
    await dialog.getByRole('button', { name: 'Cancelar' }).click()
    await expect(dialog).toBeHidden()

    // Edição e exclusão lógica: o serviço some do catálogo (e dos novos eventos, verificado no passo 8).
    const { retiredService } = data
    await page.getByRole('button', { name: 'Novo serviço' }).click()
    await dialog.getByLabel('Nome do serviço').fill(retiredService.name)
    await dialog.getByRole('button', { name: 'Salvar' }).click()
    await expect(dialog).toBeHidden()
    await page.getByRole('button', { name: `Editar ${retiredService.name}` }).click()
    const editDialog = page.getByRole('dialog', { name: 'Editar serviço' })
    await editDialog.getByLabel('Nome do serviço').fill(retiredService.renamed)
    await editDialog.getByRole('button', { name: 'Salvar' }).click()
    await expect(editDialog).toBeHidden()
    await expect(page.getByText(retiredService.renamed, { exact: true })).toBeVisible()
    page.once('dialog', (confirm) => void confirm.accept())
    await page.getByRole('button', { name: `Excluir ${retiredService.renamed}` }).click()
    await expect(page.getByText(retiredService.renamed, { exact: true })).toHaveCount(0)

    // A tela esconde o botão; o backend também recusa excluir o "Outro" (400).
    const services = await admin.json<Array<{ id: string; name: string }>>(admin.get('/services'))
    const generic = services.find((service) => service.name === 'Outro')!
    await expectStatus(await admin.delete(`/services/${generic.id}`), 400)
  })

  test('5. cadastro de equipe com novo colaborador', async () => {
    const { kitchenTeam } = data
    await navigateTo(page, 'Equipes', 'Equipes')
    await page.getByRole('button', { name: 'Nova equipe' }).click()
    const dialog = page.getByRole('dialog', { name: 'Nova equipe' })
    await dialog.getByLabel('Nome da equipe', { exact: true }).fill(kitchenTeam.name)
    await dialog.getByLabel('Especialidade', { exact: true }).selectOption({ label: kitchenTeam.specialty })

    // Modal em seções: os membros ficam na segunda seção.
    await dialog.getByRole('button', { name: /Membros e líder/ }).click()
    await dialog.getByRole('button', { name: 'Cadastrar novo colaborador' }).click()
    const collaboratorDialog = page.getByRole('dialog', { name: 'Novo colaborador' })
    await collaboratorDialog.getByLabel('Nome', { exact: true }).fill(kitchenTeam.collaborator.name)
    await collaboratorDialog.getByLabel('Cargo', { exact: true }).fill(kitchenTeam.collaborator.position)
    await collaboratorDialog.getByRole('button', { name: 'Salvar colaborador' }).click()
    await expect(collaboratorDialog).toBeHidden()
    // O colaborador recém-criado já entra como membro, com o cargo ao lado do nome.
    const members = dialog.getByRole('list', { name: 'Membros da equipe' })
    await expect(members).toContainText(kitchenTeam.collaborator.name)
    await expect(members).toContainText(kitchenTeam.collaborator.position)
    // Líder único: um só controle, que lista apenas os membros.
    await dialog.getByLabel('Líder da equipe', { exact: true }).selectOption({ label: `${kitchenTeam.collaborator.name} · ${kitchenTeam.collaborator.position}` })
    await expect(dialog.getByText(`${kitchenTeam.collaborator.position} · Líder da equipe`)).toBeVisible()

    await dialog.getByRole('button', { name: 'Salvar' }).click()
    await expect(dialog).toBeHidden()
    await expect(page.getByText(kitchenTeam.name, { exact: true }).first()).toBeVisible()
  })

  test('6. cadastros de apoio: colaboradores, inativação de equipe e papéis', async () => {
    // O colaborador criado dentro do formulário de equipe aparece no cadastro próprio.
    await navigateTo(page, 'Colaboradores', 'Colaboradores')
    const collaboratorRow = page.getByRole('row').filter({ hasText: data.kitchenTeam.collaborator.name })
    await expect(collaboratorRow).toContainText(data.kitchenTeam.collaborator.position)
    await expect(collaboratorRow).toContainText('Ativo')

    // Equipe inativada pela tela fica no histórico, mas não pode ser vinculada a eventos (passo 9).
    await admin.json(admin.post('/teams', { name: data.supportTeam.name, specialty: data.supportTeam.specialty }), 201)
    await navigateTo(page, 'Equipes', 'Equipes')
    page.once('dialog', (confirm) => void confirm.accept())
    await page.getByRole('button', { name: `Inativar ${data.supportTeam.name}` }).click()
    await expect(page.getByRole('row').filter({ hasText: data.supportTeam.name })).toContainText('Inativa')
    await expect(page.getByRole('button', { name: `Ativar ${data.supportTeam.name}` })).toBeVisible()

    // Papéis criados pelo seed: o RBAC é por permissão, e cada papel tem a sua matriz.
    await navigateTo(page, 'Papéis e permissões', 'Papéis')
    for (const role of ['admin', 'gestor', 'colaborador']) await expect(page.getByRole('cell', { name: role, exact: true })).toBeVisible()
  })

  test('7. criação de regra no motor de regras', async () => {
    const { rule } = data
    await navigateTo(page, 'Regras', 'Regras')
    await page.getByRole('button', { name: 'Nova regra' }).click()
    const dialog = page.getByRole('dialog', { name: 'Nova regra' })
    await dialog.getByLabel('Nome da regra', { exact: true }).fill(rule.name)
    await dialog.getByRole('button', { name: /Condições/ }).click()
    await dialog.getByRole('checkbox', { name: rule.eventType, exact: true }).check()
    await dialog.getByLabel('Mínimo de convidados', { exact: true }).fill(String(rule.minGuests))
    await dialog.getByRole('button', { name: /Tarefas geradas/ }).click()
    for (const [index, task] of rule.tasks.entries()) {
      await dialog.getByRole('button', { name: 'Adicionar tarefa' }).click()
      await dialog.getByLabel(`Título da tarefa ${index + 1}`, { exact: true }).fill(task.title)
      await dialog.getByLabel(`Dias antes do evento ${index + 1}`, { exact: true }).fill(String(task.daysBefore))
    }
    await dialog.getByRole('button', { name: /Recursos exigidos/ }).click()
    await dialog.getByRole('button', { name: 'Adicionar recurso' }).click()
    await dialog.getByLabel('Especialidade 1', { exact: true }).selectOption({ label: rule.specialty })
    // RFC 3.1 (ADR 0010): each generated task goes to the allocated team of this specialty.
    await dialog.getByRole('button', { name: /Tarefas geradas/ }).click()
    for (const index of rule.tasks.keys()) await dialog.getByLabel(`Equipe responsável ${index + 1}`, { exact: true }).selectOption({ label: rule.specialty })
    await dialog.getByRole('button', { name: 'Salvar' }).click()
    await expect(dialog).toBeHidden()
    await expect(page.getByText(rule.name, { exact: true }).first()).toBeVisible()

    // ADR 0010: a equipe responsável pela tarefa precisa estar entre os recursos exigidos pela regra (400).
    await expectStatus(await admin.post('/rules', {
      name: 'Regra com equipe fora dos recursos',
      resourceRequirements: [{ specialty: 'COZINHA', minQuantity: 1 }],
      taskTemplates: [{ title: 'Montar o bar', specialty: 'BAR' }],
    }), 400)
  })

  test('8. criação do evento e vínculo da equipe', async () => {
    const { event } = data
    await navigateTo(page, 'Eventos', 'Eventos')
    await page.getByRole('button', { name: 'Novo Evento' }).click()
    const dialog = page.getByRole('dialog', { name: 'Novo evento' })
    // exact: as seções do modal têm nome ("Cliente e data") e getByLabel também as encontraria.
    await selectWhenLoaded(dialog.getByLabel('Cliente', { exact: true }), data.client.name)
    await dialog.getByLabel('Nome do evento', { exact: true }).fill(event.name)
    await dialog.getByLabel('Data e hora', { exact: true }).fill(toDateTimeLocal(event.date))
    await dialog.getByLabel('Tipo de evento', { exact: true }).selectOption({ label: event.type })
    await dialog.getByRole('button', { name: 'Próxima seção' }).click()
    await dialog.getByLabel('Local', { exact: true }).fill(event.location)
    await dialog.getByLabel('Convidados', { exact: true }).fill(String(event.guests))
    await dialog.getByRole('button', { name: /^Serviços/ }).click()
    await dialog.getByRole('checkbox', { name: data.service }).check()
    // RF06: serviço excluído não é mais oferecido para novos eventos.
    await expect(dialog.getByRole('checkbox', { name: data.retiredService.renamed })).toHaveCount(0)
    await dialog.getByRole('button', { name: 'Salvar' }).click()
    await expect(dialog).toBeHidden()
    await expect(eventRow(event.name)).toBeVisible()

    // Equipes só podem ser vinculadas a um evento já existente (formulário de edição).
    await page.getByRole('button', { name: `Editar ${event.name}` }).click()
    const editDialog = page.getByRole('dialog', { name: 'Editar evento' })
    // A edição precisa mostrar o mesmo horário cadastrado (sem conversão para UTC).
    await expect(editDialog.getByLabel('Data e hora', { exact: true })).toHaveValue(toDateTimeLocal(event.date))
    await editDialog.getByRole('button', { name: /^Equipes/ }).click()
    await selectWhenLoaded(editDialog.getByLabel('Equipe para vincular', { exact: true }), data.kitchenTeam.name)
    await editDialog.getByRole('button', { name: 'Vincular equipe' }).click()
    await expect(editDialog.getByRole('button', { name: `Desvincular ${data.kitchenTeam.name}` })).toBeVisible()
    await editDialog.getByRole('button', { name: 'Cancelar' }).click()
    await expect(editDialog).toBeHidden()

    await openEventHub(event.name)
    await expect(page.locator('#event-teams').getByText(data.kitchenTeam.name)).toBeVisible()
    await expect(page.locator('.event-details-side').getByText(data.client.name)).toBeVisible()
    // Antes da confirmação o motor apenas mostra quais regras combinam com o evento.
    await expect(page.getByRole('heading', { name: 'Motor de regras' })).toBeVisible()
    await expect(page.locator('.event-details-side').getByText(data.rule.name)).toBeVisible()
  })

  test('9. fluxo alternativo: conflito de agenda da equipe e cancelamento de evento', async () => {
    const { conflictingEvent } = data
    const clients = await admin.json<Array<{ id: string; name: string }>>(admin.get('/clients'))
    const client = clients.find((item) => item.name === data.client.name)!
    const created = await admin.json<{ id: string }>(admin.post('/events', {
      name: conflictingEvent.name, eventDate: data.event.date.toISOString(), endDate: null, location: conflictingEvent.location,
      serviceType: 'ANIVERSARIO', guestsCount: conflictingEvent.guests, observations: null, clientId: client.id,
    }), 201)
    const teams = await admin.json<Array<{ id: string; name: string }>>(admin.get('/teams'))
    const team = teams.find((item) => item.name === data.kitchenTeam.name)!

    // Regra de negócio: a mesma equipe não pode atender dois eventos no mesmo horário.
    await expectStatus(await admin.post(`/teams/${team.id}/events/${created.id}`), 409)
    // Equipe inativa (passo 6) não recebe novos eventos.
    const supportTeam = teams.find((item) => item.name === data.supportTeam.name)!
    const inactiveAssignment = await admin.post(`/teams/${supportTeam.id}/events/${created.id}`)
    await expectStatus(inactiveAssignment, 400)
    expect(await inactiveAssignment.text()).toContain('Equipe inativa não pode ser atribuída')

    await openEventHub(conflictingEvent.name)
    await page.getByRole('button', { name: 'Mais ações' }).click()
    await page.getByRole('button', { name: 'Cancelar evento' }).click()
    await page.getByRole('button', { name: 'Confirmar cancelamento' }).click()
    await expect(page.getByRole('button', { name: 'Confirmar', exact: true })).toBeHidden()
    await expect.poll(async () => (await findEvent(conflictingEvent.name)).status).toBe('CANCELADO')
  })

  test('10. exclusão e restauração de um evento', async () => {
    const { conflictingEvent } = data
    await navigateTo(page, 'Eventos', 'Eventos')
    page.once('dialog', (dialog) => void dialog.accept())
    await page.getByRole('button', { name: `Excluir ${conflictingEvent.name}` }).click()
    await expect(eventRow(conflictingEvent.name)).toHaveCount(0)

    await page.getByRole('button', { name: 'Excluídos' }).click()
    await page.getByRole('button', { name: `Restaurar ${conflictingEvent.name}` }).click()
    await expect(page.getByRole('status').filter({ hasText: `Evento '${conflictingEvent.name}' restaurado.` })).toBeVisible()

    // Volta exatamente como estava: mesmo status (Cancelado) na lista de ativos.
    await page.getByRole('button', { name: 'Ativos' }).click()
    await expect(eventRow(conflictingEvent.name)).toBeVisible()
    await expect.poll(async () => (await findEvent(conflictingEvent.name)).status).toBe('CANCELADO')

    // Restaurar um evento que não está excluído é recusado (400) e a lista de excluídos fica vazia.
    const restored = await findEvent(conflictingEvent.name)
    await expectStatus(await admin.patch(`/events/${restored.id}/restore`), 400)
    expect(await admin.json<unknown[]>(admin.get('/events/deleted'))).toEqual([])

    // A restauração fica registrada no histórico da Central do evento (auditoria EVENT_RESTORED).
    await openEventHub(conflictingEvent.name)
    await expect(page.locator('.event-history-list').getByText(`Evento '${conflictingEvent.name}' restaurado`)).toBeVisible()
  })

  test('11. confirmação do evento aplica as regras, gera as tarefas e atribui a equipe', async () => {
    await openEventHub(data.event.name)
    await page.getByRole('button', { name: 'Confirmar', exact: true }).click()

    // A Central deve continuar na tela (sem precisar sair e entrar) já refletindo o motor de regras.
    await expect(page.getByRole('heading', { level: 1, name: data.event.name })).toBeVisible()
    await expect(currentStep()).toContainText('Confirmado')
    await expect(page.getByRole('heading', { name: 'Regras aplicadas' })).toBeVisible()
    await expect(page.locator('.event-details-side').getByText(data.rule.name)).toBeVisible()
    for (const task of data.rule.tasks) await expect(page.getByText(task.title, { exact: true })).toBeVisible()
    // Atribuição automática (RFC 3.1): as tarefas da regra já saem com a equipe da especialidade.
    await expect(page.getByRole('alert').filter({ hasText: 'Há tarefas sem equipe alocada' })).toHaveCount(0)
    const confirmed = await findEvent(data.event.name)
    const teams = await admin.json<Array<{ id: string; name: string }>>(admin.get('/teams'))
    const kitchen = teams.find((team) => team.name === data.kitchenTeam.name)!
    const generated = await admin.json<Array<{ title: string; assignedTeamId: string | null }>>(admin.get(`/tasks?eventId=${confirmed.id}`))
    for (const task of data.rule.tasks) expect(generated.find((item) => item.title === task.title)?.assignedTeamId).toBe(kitchen.id)
  })

  test('12. tarefa manual e tarefas da regra já atribuídas', async () => {
    const teamName = data.kitchenTeam.name
    await navigateTo(page, 'Tarefas', 'Tarefas')

    await page.getByRole('button', { name: 'Nova tarefa' }).click()
    const dialog = page.getByRole('dialog', { name: 'Nova tarefa' })
    await selectWhenLoaded(dialog.getByLabel('Evento', { exact: true }), data.event.name)
    await dialog.getByLabel('Título', { exact: true }).fill(data.manualTask.title)
    await selectWhenLoaded(dialog.getByLabel('Equipe', { exact: true }), teamName)
    await dialog.getByRole('button', { name: 'Salvar' }).click()
    await expect(dialog).toBeHidden()
    await expect(page.getByRole('region', { name: 'Pendente' }).getByText(data.manualTask.title)).toBeVisible()

    // As tarefas da regra já foram atribuídas automaticamente na confirmação.
    for (const task of data.rule.tasks) {
      await expect(page.getByRole('region', { name: 'Pendente' }).getByText(task.title, { exact: true })).toBeVisible()
      await expect(page.getByRole('button', { name: `Atribuir equipe a ${task.title}` })).toHaveCount(0)
    }
  })

  test('13. execução: evento iniciado e tarefas concluídas', async () => {
    await openEventHub(data.event.name)
    await page.getByRole('button', { name: 'Iniciar evento' }).click()
    await expect(currentStep()).toContainText('Em andamento')

    await navigateTo(page, 'Tarefas', 'Tarefas')
    const titles = [...data.rule.tasks.map((task) => task.title), data.manualTask.title]
    // ADR 0014: a tarefa precisa passar por "Em andamento" antes de ser concluída.
    await expect(page.getByLabel(`Mover ${titles[0]}`).getByRole('option', { name: 'Concluída' })).toHaveCount(0)
    for (const title of titles) {
      await page.getByLabel(`Mover ${title}`).selectOption({ label: 'Em andamento' })
      await expect(page.getByRole('region', { name: 'Em andamento' }).getByText(title)).toBeVisible()
      await page.getByLabel(`Mover ${title}`).selectOption({ label: 'Concluída' })
      await expect(page.getByRole('region', { name: 'Concluída' }).getByText(title)).toBeVisible()
    }
  })

  test('14. conclusão do evento', async () => {
    await openEventHub(data.event.name)
    await expect(page.getByText('3 de 3')).toBeVisible()
    await page.getByRole('button', { name: 'Concluir', exact: true }).click()
    await expect(currentStep()).toContainText('Concluído')
    await expect(page.getByRole('button', { name: 'Concluir', exact: true })).toBeHidden()
    await expect.poll(async () => (await findEvent(data.event.name)).status).toBe('CONCLUIDO')
  })

  test('15. replicação do evento concluído como base de um novo evento (RF25)', async () => {
    const { replica } = data
    await openEventHub(data.event.name)
    await page.getByRole('button', { name: 'Replicar evento' }).click()
    const dialog = page.getByRole('dialog', { name: 'Replicar evento' })

    // Passo 1: dados copiados e editáveis; nome e data sempre informados de novo.
    await expect(dialog.getByLabel('Local')).toHaveValue(data.event.location)
    await expect(dialog.getByLabel('Nome do evento')).toHaveValue('')
    await expect(dialog.getByLabel('Data do evento')).toHaveValue('')
    await expect(dialog.getByRole('checkbox', { name: data.service })).toBeChecked()
    await selectWhenLoaded(dialog.getByLabel('Cliente'), data.client.name)
    await dialog.getByLabel('Nome do evento').fill(replica.name)
    await dialog.getByLabel('Data do evento').fill(toDateTimeLocal(replica.date))
    await dialog.getByLabel('Número de convidados').fill(String(replica.guests))
    await dialog.getByRole('button', { name: 'Revisar itens copiados' }).click()

    // Passo 2: atenção ao que foi copiado. Só a tarefa manual aparece; as da regra voltam na confirmação.
    await expect(dialog.getByRole('note')).toContainText(`Confira os itens copiados de '${data.event.name}'`)
    await expect(dialog.getByLabel(`Copiar tarefa ${data.manualTask.title}`)).toBeChecked()
    for (const task of data.rule.tasks) await expect(dialog.getByLabel(`Copiar tarefa ${task.title}`)).toHaveCount(0)
    await expect(dialog.getByLabel(`Copiar equipe ${data.kitchenTeam.name}`)).toBeChecked()
    await dialog.getByRole('button', { name: 'Criar evento' }).click()
    await expect(dialog).toBeHidden()

    // A Central do novo evento abre já mostrando a origem e o que veio dela.
    await expect(page.getByRole('heading', { level: 1, name: replica.name })).toBeVisible()
    await expect(currentStep()).toContainText('Planejamento')
    await expect(page.locator('.event-lineage').getByRole('link', { name: data.event.name })).toBeVisible()
    await expect(page.locator('#event-teams').getByText(data.kitchenTeam.name)).toBeVisible()
    await expect(page.getByText(data.manualTask.title, { exact: true })).toBeVisible()
    await expect(page.getByText('Copiada do evento de origem')).toBeVisible()

    const created = await findEvent(replica.name)
    const copiedTasks = await admin.json<Array<{ title: string; status: string; sourceTaskId: string | null }>>(admin.get(`/tasks?eventId=${created.id}`))
    expect(copiedTasks).toEqual([expect.objectContaining({ title: data.manualTask.title, status: 'PENDENTE', sourceTaskId: expect.any(String) })])

    // Confirmar a réplica roda o motor de regras normalmente e gera as tarefas da regra.
    await page.getByRole('button', { name: 'Confirmar', exact: true }).click()
    await expect(currentStep()).toContainText('Confirmado')
    for (const task of data.rule.tasks) await expect(page.getByText(task.title, { exact: true })).toBeVisible()

    // A origem passa a listar o evento criado a partir dela.
    await page.locator('.event-lineage').getByRole('link', { name: data.event.name }).click()
    await expect(page.getByRole('heading', { level: 1, name: data.event.name })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Eventos criados a partir deste' })).toBeVisible()
    await expect(page.getByRole('link', { name: replica.name })).toBeVisible()

    // ADR 0008: replicar para uma data em que a equipe já está ocupada (a da réplica) recusa tudo com 409.
    const source = await findEvent(data.event.name)
    const teams = await admin.json<Array<{ id: string; name: string }>>(admin.get('/teams'))
    const kitchen = teams.find((team) => team.name === data.kitchenTeam.name)!
    const clients = await admin.json<Array<{ id: string; name: string }>>(admin.get('/clients'))
    const conflict = await admin.post(`/events/${source.id}/replicate`, {
      name: 'Réplica com equipe ocupada', eventDate: replica.date.toISOString(), endDate: null, location: data.event.location,
      serviceType: 'CASAMENTO', guestsCount: replica.guests, observations: null, clientId: clients.find((client) => client.name === data.client.name)!.id,
      teamIds: [kitchen.id],
    })
    await expectStatus(conflict, 409)
    expect((await admin.json<Array<{ name: string }>>(admin.get('/events'))).map((event) => event.name)).not.toContain('Réplica com equipe ocupada')
  })

  test('16. dashboard gerencial', async () => {
    await navigateTo(page, 'Dashboard', 'Dashboard')
    await expect(page.getByRole('heading', { name: 'Tarefas por Status' })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Próximos Eventos' })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Atividades recentes' })).toHaveCount(0)
    // Tarefas abertas com o prazo vencido (mesma regra dos relatórios).
    await expect(page.getByText('Tarefas atrasadas', { exact: true })).toBeVisible()
    await expect(page.getByRole('alert')).toHaveCount(0)
  })

  test('17. relatórios gerenciais e exportações', async () => {
    await navigateTo(page, 'Relatórios', 'Relatórios')
    const period = page.getByRole('region', { name: 'Período' })
    await period.getByLabel('Data inicial').fill(toDateInput(daysFromNow(-1)))
    await period.getByLabel('Data final').fill(toDateInput(daysFromNow(30)))
    const panel = page.getByRole('tabpanel')

    await page.getByRole('tab', { name: 'Eventos' }).click()
    await expect(panel.getByText(data.event.name)).toBeVisible()
    await expect(panel.getByText(data.conflictingEvent.name)).toBeVisible()
    for (const [label, extension] of [['Exportar CSV', '.csv'], ['Exportar PDF', '.pdf']] as const) {
      const download = page.waitForEvent('download')
      await panel.getByRole('button', { name: label }).click()
      expect((await download).suggestedFilename()).toMatch(new RegExp(`\\${extension}$`))
    }

    await page.getByRole('tab', { name: 'Tarefas' }).click()
    await expect(panel.getByText('Tarefas por status')).toBeVisible()
    await expect(panel.getByRole('alert')).toHaveCount(0)

    await page.getByRole('tab', { name: 'Desempenho das equipes' }).click()
    await expect(panel.getByText('Tarefas por equipe')).toBeVisible()
    await expect(panel.getByText(data.kitchenTeam.name).first()).toBeVisible()
    await expect(panel.getByRole('alert')).toHaveCount(0)
  })

  test('18. redefinição de senha: administrador gera uma senha temporária para a gestora (ADR 0012)', async () => {
    await navigateTo(page, 'Usuários', 'Usuários')
    // A senha de administradores protegidos não pode ser redefinida pela interface.
    await expect(page.getByRole('button', { name: 'Redefinir senha de Administrador' })).toBeDisabled()

    await page.getByRole('button', { name: `Redefinir senha de ${data.manager.name}` }).click()
    const dialog = page.getByRole('dialog', { name: 'Redefinir senha' })
    await dialog.getByRole('button', { name: 'Redefinir senha' }).click()
    const shown = dialog.locator('.temporary-password code')
    await expect(shown).toHaveText(/^[A-Za-z0-9]{12}$/)
    temporaryPassword = (await shown.textContent())!.trim()
    await expect(dialog.getByText(/não será exibida novamente/)).toBeVisible()
    await dialog.getByRole('button', { name: 'Concluir' }).click()
    await expect(dialog).toBeHidden()

    // O backend também protege administradores (403), não só a tela.
    const users = await admin.json<Array<{ id: string; email: string }>>(admin.get('/users'))
    const adminUser = users.find((user) => user.email === e2eEnv.admin.email)!
    await expectStatus(await admin.post(`/users/${adminUser.id}/reset-password`), 403)

    // A senha anterior deixa de valer assim que a temporária é gerada.
    const anonymous = await request.newContext({ baseURL: e2eEnv.backendUrl })
    await expectStatus(await anonymous.post('/api/v1/auth/login', { data: { email: data.manager.email, password: data.manager.password } }), 400)
    await anonymous.dispose()
  })

  test('19. troca obrigatória: a gestora entra com a senha temporária e define uma nova', async () => {
    await logout(page)
    await login(page, data.manager.email, temporaryPassword)
    await expect(page.getByRole('heading', { name: 'Defina uma nova senha' })).toBeVisible()
    // Nenhuma página interna abre antes da troca.
    await expect(page.getByRole('navigation')).toHaveCount(0)

    await page.getByLabel('Senha temporária').fill(temporaryPassword)
    await page.getByLabel('Nova senha', { exact: true }).fill(data.manager.newPassword)
    await page.getByLabel('Confirmar nova senha').fill(data.manager.newPassword)
    const changed = page.waitForResponse((response) => response.url().endsWith('/api/v1/auth/change-password'))
    await page.getByRole('button', { name: 'Salvar nova senha' }).click()
    // A troca devolve um par novo de tokens já sem a flag de troca pendente; o passo 20 usa esse token na API.
    managerAccessToken = (await (await changed).json() as { accessToken: string }).accessToken
    // Página inicial = primeira tela do menu que o papel pode abrir (para o gestor, Clientes).
    await expect(page.getByRole('heading', { level: 1, name: 'Clientes' })).toBeVisible()
  })

  test('20. controle de acesso: gestor vê apenas o que seu papel permite', async () => {
    const menu = page.getByRole('navigation')
    await expect(menu.getByRole('link', { name: 'Usuários', exact: true })).toBeVisible()
    await expect(menu.getByRole('link', { name: 'Clientes', exact: true })).toBeVisible()
    for (const hidden of ['Eventos', 'Tarefas', 'Regras', 'Serviços', 'Relatórios', 'Dashboard']) {
      await expect(menu.getByRole('link', { name: hidden, exact: true })).toHaveCount(0)
    }
    await expect(page.getByRole('button', { name: `Redefinir senha de ${data.manager.name}` })).toHaveCount(0)

    // A tela esconder o menu não basta: o backend precisa recusar a operação.
    const manager = await ApiClient.fromToken(managerAccessToken)
    await expectStatus(await manager.get('/events'), 403)
    await expectStatus(await manager.post('/rules', { name: 'Regra indevida' }), 403)
    await expectStatus(await manager.get('/clients'), 200)
    const source = await findEvent(data.event.name)
    await expectStatus(await manager.post(`/events/${source.id}/replicate`, { name: 'Réplica indevida' }), 403)
    const managerUser = (await admin.json<Array<{ id: string; email: string }>>(admin.get('/users'))).find((user) => user.email === data.manager.email)
    await expectStatus(await manager.post(`/users/${managerUser!.id}/reset-password`), 403)

    // ADR 0012: users:update (gestor) não troca senha pela edição; antes isso permitia tomar a conta de outro usuário.
    const roles = await admin.json<Array<{ id: string; name: string }>>(admin.get('/roles'))
    const { collaboratorUser } = data
    const colleague = await admin.json<{ id: string }>(admin.post('/users', {
      name: collaboratorUser.name, email: collaboratorUser.email, password: collaboratorUser.password, roleId: roles.find((role) => role.name === collaboratorUser.role)!.id,
    }), 201)
    await expectStatus(await manager.put(`/users/${colleague.id}`, { password: 'Invadida123!' }), 422)
    await expectStatus(await manager.put(`/users/${managerUser!.id}`, { password: 'Invadida123!' }), 422)
    await manager.dispose()
  })

  test('21. sessão: o botão Sair continua acessível em tela baixa e no celular', async () => {
    // Regressão: a sidebar é fixa e não rolava; em telas baixas o rodapé com "Sair" ficava fora da tela,
    // e no celular o botão era escondido por CSS (não havia como encerrar a sessão).
    for (const viewport of [{ width: 1366, height: 600 }, { width: 390, height: 844 }]) {
      await page.setViewportSize(viewport)
      await expect(page.getByRole('button', { name: 'Sair' })).toBeInViewport()
    }
    await logout(page)
  })

  test('22. colaborador acompanha eventos e move o status das tarefas, sem editar nada', async () => {
    const { collaboratorUser, replica } = data
    // O passo 21 termina no tamanho de celular.
    await page.setViewportSize({ width: 1280, height: 720 })
    const signedIn = page.waitForResponse((response) => response.url().endsWith('/api/v1/auth/login'))
    await login(page, collaboratorUser.email, collaboratorUser.password)
    const collaborator = await ApiClient.fromToken((await (await signedIn).json() as { accessToken: string }).accessToken)

    // Página inicial: a primeira tela do menu que o papel abre. Antes o colaborador entrava em loop de redirecionamento.
    await expect(page.getByRole('heading', { level: 1, name: 'Eventos' })).toBeVisible()
    const menu = page.getByRole('navigation')
    for (const visible of ['Eventos', 'Tarefas']) await expect(menu.getByRole('link', { name: visible, exact: true })).toBeVisible()
    for (const hidden of ['Dashboard', 'Relatórios', 'Clientes', 'Serviços', 'Equipes', 'Colaboradores', 'Regras', 'Usuários', 'Papéis e permissões']) {
      await expect(menu.getByRole('link', { name: hidden, exact: true })).toHaveCount(0)
    }

    // Lista e Central do evento só para consulta.
    await expect(page.getByRole('button', { name: 'Novo Evento' })).toHaveCount(0)
    await expect(page.getByRole('button', { name: `Editar ${replica.name}` })).toHaveCount(0)
    await expect(page.getByRole('button', { name: `Excluir ${replica.name}` })).toHaveCount(0)
    await eventRow(replica.name).click()
    await expect(page.getByRole('heading', { level: 1, name: replica.name })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Tarefas do evento' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Iniciar evento' })).toHaveCount(0)
    await expect(page.getByRole('button', { name: 'Replicar evento' })).toHaveCount(0)

    // Quadro de tarefas: move o status, sem criar, editar ou excluir.
    await navigateTo(page, 'Tarefas', 'Tarefas')
    await expect(page.getByRole('button', { name: 'Nova tarefa' })).toHaveCount(0)
    await page.getByLabel('Buscar por evento').fill(replica.name)
    const [task] = data.rule.tasks
    await page.getByLabel(`Mover ${task.title}`).selectOption({ label: 'Em andamento' })
    await expect(page.getByRole('region', { name: 'Em andamento' }).getByText(task.title, { exact: true })).toBeVisible()
    await expect(page.getByRole('button', { name: `Editar ${task.title}` })).toHaveCount(0)

    // O backend recusa tudo o que o papel não permite.
    const replicaEvent = await findEvent(replica.name)
    await expectStatus(await collaborator.post('/tasks', { eventId: replicaEvent.id, title: 'Tarefa indevida' }), 403)
    await expectStatus(await collaborator.put(`/events/${replicaEvent.id}`, { name: 'Edição indevida' }), 403)
    await expectStatus(await collaborator.get('/users'), 403)
    await expectStatus(await collaborator.get('/teams'), 403)
    const managerUser = (await admin.json<Array<{ id: string; email: string }>>(admin.get('/users'))).find((user) => user.email === data.manager.email)!
    // O próprio perfil (GET /auth/me) não exige users:read, então o colaborador não lê outros usuários.
    await expectStatus(await collaborator.get(`/users/${managerUser.id}`), 403)
    await expectStatus(await collaborator.patch(`/users/${managerUser.id}/deactivate`), 403)
    await collaborator.dispose()
    await logout(page)
  })
})
