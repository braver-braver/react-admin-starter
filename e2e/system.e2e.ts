import { expect, test, type Page } from 'playwright/test'

function address(path: string) {
  if (!test.info().project.name.startsWith('demo-')) return path
  const base = process.env.DEMO_SERVE_BASE ?? '/react-admin-starter/'
  const version = process.env.DEMO_TARGET_VERSION ?? 'latest'
  return `${base}${version === 'latest' ? '' : `releases/${version}/`}#${path}`
}
async function login(
  page: Page,
  email = 'admin@example.com',
  password = 'Demo1234!'
) {
  await page.getByRole('textbox', { name: '邮箱', exact: true }).fill(email)
  await page.getByLabel('密码', { exact: true }).fill(password)
  await page.getByRole('button', { name: '登录', exact: true }).click()
}
async function logout(page: Page) {
  await page.getByRole('button', { name: '账户菜单' }).click()
  await page.getByRole('menuitem', { name: '退出登录' }).click()
  await page
    .getByRole('alertdialog', { name: '退出登录' })
    .getByRole('button', { name: '退出登录', exact: true })
    .click()
  await expect(
    page.getByRole('textbox', { name: '邮箱', exact: true })
  ).toBeVisible()
}
test('navigation groups collapse on desktop and mobile without hiding icon navigation', async ({
  page,
}) => {
  await page.goto(address('/system/roles'))
  await login(page)
  await expect(
    page.getByRole('heading', { name: '角色管理', exact: true })
  ).toBeVisible()

  const isMobile = test.info().project.name.includes('mobile')
  const sidebarTrigger = page.locator('header [data-slot="sidebar-trigger"]')
  if (isMobile) await sidebarTrigger.click()

  const group = page.getByRole('button', { name: '切换系统管理分组' })
  const roleLink = page.getByRole('link', {
    name: '角色管理',
    exact: true,
  })
  await expect(group).toHaveAttribute('aria-expanded', 'true')
  await expect(roleLink).toBeVisible()

  await group.click()
  await expect(group).toHaveAttribute('aria-expanded', 'false')
  await expect(roleLink).not.toBeVisible()
  // Other groups must not be affected.
  await expect(
    page.getByRole('button', { name: '切换工作区分组' })
  ).toHaveAttribute('aria-expanded', 'true')

  if (!isMobile) {
    const sidebar = page.locator('[data-slot="sidebar"][data-state]')
    await sidebarTrigger.click()
    await expect(sidebar).toHaveAttribute('data-state', 'collapsed')
    const compactGroupTrigger = page.locator(
      'button[aria-label="切换系统管理分组"]'
    )
    // Hidden headers must be absent from keyboard and screen-reader navigation.
    await expect(compactGroupTrigger).toBeDisabled()
    await expect(compactGroupTrigger).toHaveAttribute('tabindex', '-1')
    await expect(compactGroupTrigger).toHaveAttribute('aria-hidden', 'true')
    await expect(
      page.locator('[data-sidebar="menu-button"]').filter({
        hasText: '角色管理',
      })
    ).toBeVisible()
    await sidebarTrigger.click()
    await expect(sidebar).toHaveAttribute('data-state', 'expanded')
    await expect(group).toBeEnabled()
    await expect(group).toHaveAttribute('aria-expanded', 'false')
  }

  await group.click()
  await expect(roleLink).toBeVisible()
  await page.getByRole('link', { name: '权限管理', exact: true }).click()
  await expect(
    page.getByRole('heading', { name: '权限管理', exact: true })
  ).toBeVisible()
})

test('system pages expose real forms and menu changes update navigation after refresh', async ({
  page,
}) => {
  await page.goto(address('/system/menus'))
  await login(page)
  await expect(
    page.getByRole('heading', { name: '菜单管理', exact: true })
  ).toBeVisible()
  await page.getByRole('button', { name: '编辑用户管理', exact: true }).click()
  const dialog = page.getByRole('dialog', { name: '编辑菜单', exact: true })
  await dialog.getByLabel('名称', { exact: true }).fill('用户资料')
  await dialog.getByRole('button', { name: '保存配置' }).click()
  await expect(dialog).toHaveCount(0)
  await page.reload()
  await expect(
    page.getByRole('heading', { name: '菜单管理', exact: true })
  ).toBeVisible()
  await page.keyboard.press('Control+k')
  await expect(
    page.getByRole('option', { name: '用户资料', exact: true })
  ).toBeVisible()
  await page.keyboard.press('Escape')
  for (const [path, title] of [
    ['roles', '角色管理'],
    ['permissions', '权限管理'],
    ['departments', '部门管理'],
    ['accounts', '登录用户管理'],
  ]) {
    await page.goto(address(`/system/${path}`))
    await expect(
      page.getByRole('heading', { name: title, exact: true })
    ).toBeVisible()
    await expect(page.getByRole('table')).toBeVisible()
  }
})
test('administrator creates a department-scoped role and a usable login account through the UI', async ({
  page,
}) => {
  await page.goto(address('/system/departments'))
  await login(page)
  await page.getByRole('button', { name: '新增部门', exact: true }).click()
  let dialog = page.getByRole('dialog', { name: '新增部门', exact: true })
  await dialog.getByLabel('名称', { exact: true }).fill('协作组')
  await dialog.getByLabel('唯一代码').fill('collaboration')
  await dialog.getByLabel('上级部门').selectOption({ label: '运营部' })
  await dialog.getByRole('button', { name: '保存配置' }).click()
  await expect(
    page.getByRole('row').filter({ hasText: '协作组' })
  ).toBeVisible()

  await page.goto(address('/system/roles'))
  await page.getByRole('button', { name: '新增角色', exact: true }).click()
  dialog = page.getByRole('dialog', { name: '新增角色', exact: true })
  await dialog.getByLabel('名称', { exact: true }).fill('运营经办')
  await dialog.getByLabel('唯一代码').fill('operations_editor')
  await dialog
    .getByLabel('数据范围', { exact: true })
    .selectOption('descendants')
  await dialog.getByRole('checkbox', { name: /查看业务用户/ }).check()
  await dialog.getByRole('checkbox', { name: /维护业务用户/ }).check()
  await dialog.getByRole('checkbox', { name: '用户管理', exact: true }).check()
  await dialog.getByRole('button', { name: '保存配置' }).click()
  await expect(
    page.getByRole('row').filter({ hasText: '运营经办' })
  ).toBeVisible()

  await page.goto(address('/system/accounts'))
  await page.getByRole('button', { name: '新增登录用户', exact: true }).click()
  dialog = page.getByRole('dialog', { name: '新增登录用户', exact: true })
  await dialog.getByLabel('显示名称').fill('运营测试账号')
  await dialog.getByLabel('登录邮箱').fill('operator@example.com')
  await dialog.getByLabel('初始密码').fill('Operator123!')
  await dialog.getByLabel('所属部门').selectOption({ label: '运营部' })
  await dialog.getByRole('checkbox', { name: /运营经办/ }).check()
  await dialog.getByRole('button', { name: '保存配置' }).click()
  await expect(
    page.getByRole('row').filter({ hasText: 'operator@example.com' })
  ).toBeVisible()
  await page.reload()
  await expect(
    page.getByRole('row').filter({ hasText: 'operator@example.com' })
  ).toBeVisible()
  await logout(page)
  await page.goto(address('/sign-in?redirect=/users'))
  await login(page, 'operator@example.com', 'Operator123!')
  await expect(
    page.getByRole('heading', { name: '用户管理示例' })
  ).toBeVisible()
  await expect(
    page.getByRole('columnheader', { name: '所属部门' })
  ).toBeVisible()
  await expect(
    page.getByRole('cell', { name: '销售部', exact: true })
  ).toHaveCount(0)
  await expect(
    page.getByRole('cell', { name: '运营部', exact: true }).first()
  ).toBeVisible()
  await expect(
    page.getByRole('button', { name: '添加用户', exact: true })
  ).toBeVisible()
  await page.goto(address('/system/accounts'))
  await expect(page).toHaveURL(/403/)
  await expect(page.getByRole('heading', { name: '登录用户管理' })).toHaveCount(
    0
  )
})
