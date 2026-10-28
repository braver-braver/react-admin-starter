import { expect, test } from 'playwright/test'

test('built app serves sign-in without mocks and rejects demo authentication', async ({
  page,
}) => {
  await page.goto('/sign-in')
  await expect(
    page.getByRole('textbox', { name: '邮箱', exact: true })
  ).toBeVisible()
  await expect(page.getByText('演示密码', { exact: false })).toHaveCount(0)
  expect(
    await page.evaluate(() =>
      navigator.serviceWorker.getRegistrations().then((items) => items.length)
    )
  ).toBe(0)
  await page
    .getByRole('textbox', { name: '邮箱', exact: true })
    .fill('admin@example.com')
  await page.getByLabel('密码', { exact: true }).fill('Demo1234!')
  await page.getByRole('button', { name: '登录', exact: true }).click()
  await expect(page.getByRole('alert')).toBeVisible()
  await expect(page).toHaveURL(/\/sign-in$/)
  await page.goto('/users')
  await expect(page.getByRole('heading', { name: '用户管理示例' })).toHaveCount(
    0
  )
  await expect(page.getByRole('heading', { name: '500' })).toBeVisible()
})
