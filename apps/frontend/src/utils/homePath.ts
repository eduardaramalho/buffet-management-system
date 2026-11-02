export const NO_ACCESS_PATH = '/sem-acesso'

// Same order as the side menu (InternalLayout): the home page is the first entry the user can open.
const MENU_PAGES: Array<{ path: string; permission: string }> = [
  { path: '/', permission: 'dashboard:view' },
  { path: '/reports', permission: 'reports:view' },
  { path: '/events', permission: 'events:list' },
  { path: '/clients', permission: 'clients:list' },
  { path: '/services', permission: 'services:list' },
  { path: '/tasks', permission: 'tasks:list' },
  { path: '/teams', permission: 'teams:list' },
  { path: '/collaborators', permission: 'collaborators:manage' },
  { path: '/rules', permission: 'rules:list' },
  { path: '/users', permission: 'users:list' },
  { path: '/roles', permission: 'roles:list' },
]

type UserWithPermissions = { roles?: Array<{ permissions: string[] }> }

/** Where a signed-in user goes after login or when a page is not allowed for their roles. */
export function getHomePath(user: UserWithPermissions) {
  const permissions = new Set(user.roles?.flatMap((role) => role.permissions) ?? [])
  return MENU_PAGES.find((page) => permissions.has(page.permission))?.path ?? NO_ACCESS_PATH
}
