import { expect, test } from 'playwright/test'

// The ordinary production build (no mocks) against a same-origin API: /api is
// proxied to the conformance stand-in back end, a test double. Its admin
// account comes from src/contract/conformance/stand-in.node.ts.
const ADMIN = { email: 'admin@example.test', password: 'Secret123!' }

test('production build signs in, restores the session on reload and signs out against a same-origin API', async ({
  page,
}) => {
  await page.goto('/sign-in')
  expect(
    await page.evaluate(() =>
      navigator.serviceWorker.getRegistrations().then((items) => items.length)
    )
  ).toBe(0)
  await page
    .getByRole('textbox', { name: '邮箱', exact: true })
    .fill(ADMIN.email)
  await page.getByLabel('密码', { exact: true }).fill(ADMIN.password)
  await page.getByRole('button', { name: '登录', exact: true }).click()
  await expect(
    page.getByRole('heading', { name: '工作台', level: 1 })
  ).toBeVisible()

  // The HttpOnly session cookie restores the session after a full reload.
  await page.reload()
  await expect(
    page.getByRole('heading', { name: '工作台', level: 1 })
  ).toBeVisible()
  const cookies = await page.context().cookies()
  expect(cookies.find((cookie) => cookie.name === 'sid')?.httpOnly).toBe(true)

  // A protected page loads its data through the same-origin API.
  await page.goto('/users')
  await expect(
    page.getByRole('heading', { name: '用户管理示例' })
  ).toBeVisible()
  await expect(page.getByRole('table')).toBeVisible()

  await page.getByRole('button', { name: '账户菜单' }).click()
  await page.getByRole('menuitem', { name: '退出登录' }).click()
  await page
    .getByRole('alertdialog', { name: '退出登录' })
    .getByRole('button', { name: '退出登录', exact: true })
    .click()
  await expect(page).toHaveURL(/\/sign-in/)
  await page.goto('/users')
  await expect(page).toHaveURL(/\/sign-in\?redirect=/)
  await expect(page.getByRole('table')).toHaveCount(0)
})
