import { expect, type Locator, type Page } from '@playwright/test'

/**
 * O token de acesso fica em memória (apps/frontend/src/api/tokenStore.ts): recarregar a página
 * encerra a sessão. Por isso a jornada navega pelo menu (client-side) e não usa page.goto após o login.
 */
export const navigateTo = async (page: Page, menu: string, heading: string) => {
  await page.getByRole('navigation').getByRole('link', { name: menu, exact: true }).click()
  await expect(page.getByRole('heading', { level: 1, name: heading })).toBeVisible()
}

export const login = async (page: Page, email: string, password: string) => {
  await page.getByLabel('E-mail').fill(email)
  // exact: o botão "Mostrar senha" também tem "senha" no nome acessível.
  await page.getByLabel('Senha', { exact: true }).fill(password)
  await page.getByRole('button', { name: 'Entrar' }).click()
  await expect(page.getByRole('button', { name: 'Sair' })).toBeVisible()
}

export const logout = async (page: Page) => {
  await page.getByRole('button', { name: 'Sair' }).click()
  await expect(page.getByRole('heading', { name: 'Acesse sua conta' })).toBeVisible()
}

/** Seleciona uma opção que chega de forma assíncrona (a lista é carregada da API após abrir o formulário). */
export const selectWhenLoaded = async (select: Locator, optionLabel: string) => {
  await expect(select.locator('option', { hasText: optionLabel })).toBeAttached()
  await select.selectOption({ label: optionLabel })
}
