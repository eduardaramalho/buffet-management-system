import { expect, test, type Page } from '@playwright/test'
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
test.describe.serial('Jornada do evento: cadastro → regras → confirmação → execução → conclusão → relatórios', () => {
  let page: Page
  let admin: ApiClient
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
    // O catálogo de serviços não faz parte do seed; é um dado de referência pré-existente na operação.
    const services = await admin.json<Array<{ name: string }>>(admin.get('/services'))
    if (!services.some((service) => service.name === data.service)) await admin.json(admin.post('/services', { name: data.service }), 201)

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
    await login(page, e2eEnv.admin.email, e2eEnv.admin.password)
    await expect(page.getByRole('heading', { level: 1, name: 'Dashboard' })).toBeVisible()
  })

  test('2. cadastro de usuário com papel de gestor', async () => {
    await navigateTo(page, 'Usuários', 'Usuários')
    await page.getByRole('button', { name: 'Novo usuário' }).click()
    const dialog = page.getByRole('dialog', { name: 'Novo usuário' })
    await dialog.getByLabel('Nome').fill(data.manager.name)
    await dialog.getByLabel('E-mail').fill(data.manager.email)
    await selectWhenLoaded(dialog.getByLabel('Papel'), data.manager.role)
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

  test('4. cadastro de equipe com novo colaborador', async () => {
    const { kitchenTeam } = data
    await navigateTo(page, 'Equipes', 'Equipes')
    await page.getByRole('button', { name: 'Nova equipe' }).click()
    const dialog = page.getByRole('dialog', { name: 'Nova equipe' })
    await dialog.getByLabel('Nome da equipe').fill(kitchenTeam.name)
    await dialog.getByLabel('Especialidade').selectOption({ label: kitchenTeam.specialty })

    await dialog.getByRole('button', { name: '+ Novo colaborador' }).click()
    const collaboratorDialog = page.getByRole('dialog', { name: 'Novo colaborador' })
    await collaboratorDialog.getByLabel('Nome', { exact: true }).fill(kitchenTeam.collaborator.name)
    await collaboratorDialog.getByLabel('Função').fill(kitchenTeam.collaborator.position)
    await collaboratorDialog.getByRole('button', { name: 'Salvar' }).click()
    await expect(collaboratorDialog).toBeHidden()
    // O colaborador recém-criado já entra selecionado como membro.
    await expect(dialog.getByRole('checkbox', { name: kitchenTeam.collaborator.name })).toBeChecked()

    await dialog.getByRole('button', { name: 'Salvar' }).click()
    await expect(dialog).toBeHidden()
    await expect(page.getByText(kitchenTeam.name, { exact: true }).first()).toBeVisible()
  })

  test('5. criação de regra no motor de regras', async () => {
    const { rule } = data
    await navigateTo(page, 'Regras', 'Regras')
    await page.getByRole('button', { name: 'Nova regra' }).click()
    const dialog = page.getByRole('dialog', { name: 'Nova regra' })
    await dialog.getByLabel('Nome da regra').fill(rule.name)
    await dialog.getByRole('checkbox', { name: rule.eventType, exact: true }).check()
    await dialog.getByLabel('Mínimo de convidados').fill(String(rule.minGuests))
    for (const [index, task] of rule.tasks.entries()) {
      await dialog.getByRole('button', { name: '+ Adicionar tarefa' }).click()
      await dialog.getByLabel(`Título da tarefa ${index + 1}`).fill(task.title)
      await dialog.getByLabel(`Dias antes do evento ${index + 1}`).fill(String(task.daysBefore))
    }
    await dialog.getByRole('button', { name: '+ Adicionar recurso' }).click()
    await dialog.getByLabel('Especialidade 1').selectOption({ label: rule.specialty })
    await dialog.getByRole('button', { name: 'Salvar' }).click()
    await expect(dialog).toBeHidden()
    await expect(page.getByText(rule.name, { exact: true }).first()).toBeVisible()
  })

  test('6. criação do evento e vínculo da equipe', async () => {
    const { event } = data
    await navigateTo(page, 'Eventos', 'Eventos')
    await page.getByRole('button', { name: 'Novo Evento' }).click()
    const dialog = page.getByRole('dialog', { name: 'Novo Evento' })
    await selectWhenLoaded(dialog.getByLabel('Cliente'), data.client.name)
    await dialog.getByLabel('Nome do evento').fill(event.name)
    await dialog.getByLabel('Data do evento').fill(toDateTimeLocal(event.date))
    await dialog.getByLabel('Local').fill(event.location)
    await dialog.getByLabel('Tipo de serviço').selectOption({ label: event.type })
    await dialog.getByLabel('Número de convidados').fill(String(event.guests))
    await dialog.getByRole('checkbox', { name: data.service }).check()
    await dialog.getByRole('button', { name: 'Salvar' }).click()
    await expect(dialog).toBeHidden()
    await expect(eventRow(event.name)).toBeVisible()

    // Equipes só podem ser vinculadas a um evento já existente (formulário de edição).
    await page.getByRole('button', { name: `Editar ${event.name}` }).click()
    const editDialog = page.getByRole('dialog', { name: 'Editar evento' })
    // A edição precisa mostrar o mesmo horário cadastrado (sem conversão para UTC).
    await expect(editDialog.getByLabel('Data do evento')).toHaveValue(toDateTimeLocal(event.date))
    await selectWhenLoaded(editDialog.getByLabel('Equipe para adicionar'), data.kitchenTeam.name)
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

  test('7. fluxo alternativo: conflito de agenda da equipe e cancelamento de evento', async () => {
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

    await openEventHub(conflictingEvent.name)
    await page.getByRole('button', { name: 'Mais ações' }).click()
    await page.getByRole('button', { name: 'Cancelar evento' }).click()
    await page.getByRole('button', { name: 'Confirmar cancelamento' }).click()
    await expect(page.getByRole('button', { name: 'Confirmar', exact: true })).toBeHidden()
    await expect.poll(async () => (await findEvent(conflictingEvent.name)).status).toBe('CANCELADO')
  })

  test('8. confirmação do evento aplica as regras e gera as tarefas', async () => {
    await openEventHub(data.event.name)
    await page.getByRole('button', { name: 'Confirmar', exact: true }).click()

    // A Central deve continuar na tela (sem precisar sair e entrar) já refletindo o motor de regras.
    await expect(page.getByRole('heading', { level: 1, name: data.event.name })).toBeVisible()
    await expect(currentStep()).toContainText('Confirmado')
    await expect(page.getByRole('heading', { name: 'Regras aplicadas' })).toBeVisible()
    await expect(page.locator('.event-details-side').getByText(data.rule.name)).toBeVisible()
    for (const task of data.rule.tasks) await expect(page.getByText(task.title, { exact: true })).toBeVisible()
    // Tarefas geradas pela regra ainda não têm equipe: a Central alerta o gestor.
    await expect(page.getByRole('alert').filter({ hasText: 'Há tarefas sem equipe alocada' })).toBeVisible()
  })

  test('9. tarefa manual e atribuição de equipe às tarefas geradas', async () => {
    const teamName = data.kitchenTeam.name
    await navigateTo(page, 'Tarefas', 'Tarefas')

    await page.getByRole('button', { name: 'Nova tarefa' }).click()
    const dialog = page.getByRole('dialog', { name: 'Nova tarefa' })
    await selectWhenLoaded(dialog.getByLabel('Evento'), data.event.name)
    await dialog.getByLabel('Título').fill(data.manualTask.title)
    await selectWhenLoaded(dialog.getByLabel('Equipe'), teamName)
    await dialog.getByRole('button', { name: 'Salvar' }).click()
    await expect(dialog).toBeHidden()
    await expect(page.getByRole('region', { name: 'Pendente' }).getByText(data.manualTask.title)).toBeVisible()

    for (const task of data.rule.tasks) {
      await page.getByRole('button', { name: `Atribuir equipe a ${task.title}` }).click()
      const editDialog = page.getByRole('dialog', { name: 'Editar tarefa' })
      await selectWhenLoaded(editDialog.getByLabel('Equipe'), teamName)
      await editDialog.getByRole('button', { name: 'Salvar' }).click()
      await expect(editDialog).toBeHidden()
      await expect(page.getByRole('button', { name: `Atribuir equipe a ${task.title}` })).toBeHidden()
    }
  })

  test('10. execução: evento iniciado e tarefas concluídas', async () => {
    await openEventHub(data.event.name)
    await page.getByRole('button', { name: 'Iniciar evento' }).click()
    await expect(currentStep()).toContainText('Em andamento')

    await navigateTo(page, 'Tarefas', 'Tarefas')
    const titles = [...data.rule.tasks.map((task) => task.title), data.manualTask.title]
    for (const title of titles) {
      await page.getByLabel(`Mover ${title}`).selectOption({ label: 'Em andamento' })
      await expect(page.getByRole('region', { name: 'Em andamento' }).getByText(title)).toBeVisible()
      await page.getByLabel(`Mover ${title}`).selectOption({ label: 'Concluída' })
      await expect(page.getByRole('region', { name: 'Concluída' }).getByText(title)).toBeVisible()
    }
  })

  test('11. conclusão do evento', async () => {
    await openEventHub(data.event.name)
    await expect(page.getByText('3 de 3')).toBeVisible()
    await page.getByRole('button', { name: 'Concluir', exact: true }).click()
    await expect(currentStep()).toContainText('Concluído')
    await expect(page.getByRole('button', { name: 'Concluir', exact: true })).toBeHidden()
    await expect.poll(async () => (await findEvent(data.event.name)).status).toBe('CONCLUIDO')
  })

  test('12. dashboard do gestor', async () => {
    await navigateTo(page, 'Dashboard', 'Dashboard')
    await expect(page.getByRole('heading', { name: 'Tarefas por Status' })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Atividades recentes' })).toBeVisible()
    await expect(page.getByRole('alert')).toHaveCount(0)
  })

  test('13. relatórios gerenciais e exportações', async () => {
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

  test('14. controle de acesso: gestor vê apenas o que seu papel permite', async () => {
    await logout(page)
    await login(page, data.manager.email, data.manager.password)
    const menu = page.getByRole('navigation')
    await expect(menu.getByRole('link', { name: 'Usuários', exact: true })).toBeVisible()
    await expect(menu.getByRole('link', { name: 'Clientes', exact: true })).toBeVisible()
    for (const hidden of ['Eventos', 'Tarefas', 'Regras', 'Relatórios', 'Dashboard']) {
      await expect(menu.getByRole('link', { name: hidden, exact: true })).toHaveCount(0)
    }

    // A tela esconder o menu não basta: o backend precisa recusar a operação.
    const manager = await ApiClient.login({ email: data.manager.email, password: data.manager.password })
    await expectStatus(await manager.get('/events'), 403)
    await expectStatus(await manager.post('/rules', { name: 'Regra indevida' }), 403)
    await expectStatus(await manager.get('/clients'), 200)
    await manager.dispose()
  })
})
