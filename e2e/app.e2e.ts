import { expect, test, type Page, type Locator } from 'playwright/test'

async function login(page: Page, account = 'admin') {
  await page
    .getByRole('textbox', { name: '邮箱', exact: true })
    .fill(`${account}@example.com`)
  await page.getByLabel('密码', { exact: true }).fill('Demo1234!')
  await page.getByRole('button', { name: '登录', exact: true }).click()
}

async function containedFocus(page: Page, dialog: Locator) {
  // Traverse in both directions, including the boundary, and assert no focus leak.
  for (const key of ['Tab', 'Shift+Tab']) {
    for (let index = 0; index < 8; index++) {
      await page.keyboard.press(key)
      await expect
        .poll(() =>
          dialog.evaluate((node) => node.contains(document.activeElement))
        )
        .toBe(true)
    }
  }
}

async function sidebar(page: Page) {
  if (test.info().project.name === 'mobile') {
    await page
      .getByRole('button', { name: /^(Toggle Sidebar|切换侧边栏)$/ })
      .click()
    return page.getByRole('dialog', { name: /^(Sidebar|侧边栏)$/ })
  }
  return page.locator('[data-slot="sidebar-inner"]')
}

test('complete auth, routes, Users, session restoration and logout', async ({
  page,
}) => {
  await page.goto('/users')
  await expect(page).toHaveURL(/\/sign-in\?redirect=/)
  await expect(
    page.getByRole('textbox', { name: '邮箱', exact: true })
  ).toBeVisible()
  await login(page)
  await expect(page).toHaveURL(/\/users/)
  await expect(
    page.getByRole('heading', { name: '用户管理示例' })
  ).toBeVisible()
  await expect(page.getByRole('table')).toBeVisible()
  await expect(page.getByRole('row')).toHaveCount(11)
  await page.reload()
  await expect(
    page.getByRole('heading', { name: '用户管理示例' })
  ).toBeVisible()
  const nav = await sidebar(page)
  await nav.getByRole('link', { name: '工作台', exact: true }).click()
  await expect(page).toHaveURL(/\/$/)
  await expect(
    page.getByRole('heading', { name: '工作台', level: 1 })
  ).toBeVisible()
  await expect(page.getByRole('main')).toHaveCount(1)
  await page.getByRole('button', { name: '账户菜单' }).click()
  await page.getByRole('menuitem', { name: '退出登录' }).click()
  const dialog = page.getByRole('alertdialog', { name: '退出登录' })
  await expect(dialog).toBeVisible()
  await containedFocus(page, dialog)
  await dialog.getByRole('button', { name: '退出登录', exact: true }).click()
  await expect(page).toHaveURL(/\/sign-in/)
  await page.goto('/users')
  await expect(page).toHaveURL(/\/sign-in\?redirect=/)
  await expect(page.getByRole('table')).toHaveCount(0)
})

test('keyboard navigation, command focus, theme persistence and sidebar', async ({
  page,
}) => {
  await page.goto('/sign-in')
  await expect(
    page.getByRole('textbox', { name: '邮箱', exact: true })
  ).toBeVisible()
  // Submit the actual sign-in form using only the keyboard.
  await page.keyboard.press('Tab')
  await expect(
    page.getByRole('textbox', { name: '邮箱', exact: true })
  ).toBeFocused()
  await page.keyboard.type('admin@example.com')
  await page.keyboard.press('Tab')
  await expect(page.getByLabel('密码', { exact: true })).toBeFocused()
  await page.keyboard.type('Demo1234!')
  await page.keyboard.press('Enter')
  await expect(
    page.getByRole('heading', { name: '工作台', level: 1 })
  ).toBeVisible()
  const skip = page.getByRole('link', { name: '跳转到主要内容' })
  await skip.focus()
  await page.keyboard.press('Enter')
  await expect(page.getByRole('main')).toBeFocused()

  const search = page.getByRole('button', { name: /搜索页面或命令/ })
  await search.focus()
  await page.keyboard.press('Control+k')
  const dialog = page.getByRole('dialog', { name: '页面与命令搜索' })
  const input = dialog.getByRole('combobox', { name: '搜索页面或命令' })
  await expect(input).toBeFocused()
  await containedFocus(page, dialog)
  await page.keyboard.press('Escape')
  await expect(dialog).toHaveCount(0)
  await expect(search).toBeFocused()
  await page.keyboard.press('Enter')
  await input.fill('用户管理')
  await page.keyboard.press('ArrowDown')
  await page.keyboard.press('Enter')
  await expect(page).toHaveURL(/\/users/)
  await expect(
    page.getByRole('heading', { name: '用户管理示例' })
  ).toBeVisible()

  await page.getByRole('button', { name: '切换主题' }).click()
  await page.getByRole('menuitem', { name: '深色', exact: true }).click()
  await expect(page.locator('html')).toHaveClass(/dark/)
  await page.reload()
  await expect(
    page.getByRole('heading', { name: '用户管理示例' })
  ).toBeVisible()
  await expect(page.locator('html')).toHaveClass(/dark/)
  await page.getByRole('button', { name: '切换主题' }).click()
  await page.getByRole('menuitem', { name: '浅色', exact: true }).click()
  await expect(page.locator('html')).not.toHaveClass(/dark/)
  // Radix restores focus when the theme menu closes. Wait for the menu to
  // unmount before moving focus to the sidebar trigger, otherwise Enter can
  // land on the theme trigger instead of the sidebar.
  await expect(page.getByRole('menu')).toHaveCount(0)

  const toggle = page.getByRole('banner').getByRole('button', {
    name: /^(Toggle Sidebar|切换侧边栏)$/,
  })
  await toggle.focus()
  await expect(toggle).toBeFocused()
  await toggle.press('Enter')
  if (test.info().project.name === 'mobile') {
    const drawer = page.getByRole('dialog', { name: /^(Sidebar|侧边栏)$/ })
    await expect(drawer).toBeVisible()
    await containedFocus(page, drawer)
    await page.keyboard.press('Escape')
    await expect(drawer).toHaveCount(0)
    await expect(toggle).toBeFocused()
    // A second keyboard activation must still open the mobile drawer.
    await toggle.press('Enter')
    await expect(drawer).toBeVisible()
    await page.keyboard.press('Escape')
    await expect(drawer).toHaveCount(0)
    await expect(toggle).toBeFocused()
  } else {
    await expect(page.locator('[data-slot="sidebar"]')).toHaveAttribute(
      'data-state',
      'collapsed'
    )
    await page.keyboard.press('Enter')
    await expect(page.locator('[data-slot="sidebar"]')).toHaveAttribute(
      'data-state',
      'expanded'
    )
  }
})

test('invalid login and guest RBAC fail closed through the real router', async ({
  page,
}) => {
  await page.goto('/sign-in?redirect=/users')
  await page
    .getByRole('textbox', { name: '邮箱', exact: true })
    .fill('admin@example.com')
  await page.getByLabel('密码', { exact: true }).fill('Wrong1234!')
  await page.getByRole('button', { name: '登录', exact: true }).click()
  await expect(page.getByRole('alert')).toBeVisible()
  await expect(page).toHaveURL(/\/sign-in/)
  await login(page, 'guest')
  await expect(page).toHaveURL(/\/403/)
  await expect(page.getByRole('table')).toHaveCount(0)
  await page.goto('/')
  await expect(
    page.getByRole('heading', { name: '工作台', level: 1 })
  ).toBeVisible()
  const nav = await sidebar(page)
  await expect(
    nav.getByRole('link', { name: '用户管理', exact: true })
  ).toHaveCount(0)
})

test('viewer sees read-only Users and live permissions', async ({ page }) => {
  await page.goto('/sign-in?redirect=/users')
  await login(page, 'viewer')
  await expect(
    page.getByRole('heading', { name: '用户管理示例' })
  ).toBeVisible()
  await expect(
    page.getByRole('button', { name: '添加用户', exact: true })
  ).toHaveCount(0)
  await expect(
    page.getByRole('button', { name: '邀请用户', exact: true })
  ).toHaveCount(0)
  const nav = await sidebar(page)
  await nav.getByRole('link', { name: '权限示例', exact: true }).click()
  await expect(
    page.getByRole('heading', { name: '当前账户权限', level: 1 })
  ).toBeVisible()
  await expect(page.getByText('users:read', { exact: true })).toBeVisible()
  await page.getByRole('button', { name: '重新读取权限' }).click()
  await expect(page.getByRole('button', { name: '重新读取权限' })).toBeEnabled()
  await expect(page.getByText('users:write', { exact: true })).toHaveCount(0)
})
