import { expect, test, type Page } from 'playwright/test'

const versions = process.env.DEMO_TARGET_VERSION
  ? [process.env.DEMO_TARGET_VERSION]
  : ['latest', 'v0.0.0-smoke']
const siteBase = process.env.DEMO_SERVE_BASE ?? '/react-admin-starter/'
const versionBase = (version: string) =>
  `${siteBase}${version === 'latest' ? '' : `releases/${version}/`}`
async function login(page: Page, account: string) {
  await page
    .getByRole('textbox', { name: '邮箱', exact: true })
    .fill(`${account}@example.com`)
  await page.getByLabel('密码', { exact: true }).fill('Demo1234!')
  await page.getByRole('button', { name: '登录', exact: true }).click()
  await expect(
    page.getByRole('heading', { name: '用户管理示例' })
  ).toBeVisible()
}
async function logout(page: Page) {
  await page.getByRole('button', { name: '账户菜单' }).click()
  await page.getByRole('menuitem', { name: '退出登录' }).click()
  await page
    .getByRole('alertdialog', { name: '退出登录' })
    .getByRole('button', { name: '退出登录', exact: true })
    .click()
  await expect(page).toHaveURL(/#\/sign-in/)
}
for (const version of versions) {
  test(`static ${version}: scoped auth, hash refresh, navigation and logout`, async ({
    page,
  }) => {
    const base = versionBase(version)
    const apiResponses: boolean[] = []
    page.on('response', (response) => {
      if (response.url().includes('/api/'))
        apiResponses.push(response.fromServiceWorker())
    })
    await page.goto(`${base}#/users`)
    await expect(page).toHaveURL(/#\/sign-in\?redirect=/)
    const banner = page.getByRole('complementary', { name: '演示环境信息' })
    await expect(banner).toContainText(`版本：${version}`)
    await login(page, 'admin')
    await page.reload()
    await expect(
      page.getByRole('heading', { name: '用户管理示例' })
    ).toBeVisible()
    await expect(
      page.getByRole('button', { name: '添加用户', exact: true })
    ).toBeVisible()
    await page.getByRole('link', { name: '跳转到主要内容' }).focus()
    await page.keyboard.press('Enter')
    await expect(page.getByRole('main')).toBeFocused()
    await expect(page).toHaveURL(/#\/users/)
    await page.keyboard.press('Control+k')
    const search = page.getByRole('combobox', { name: '搜索页面或命令' })
    await search.fill('权限示例')
    await page.keyboard.press('ArrowDown')
    await page.keyboard.press('Enter')
    await expect(
      page.getByRole('heading', { name: '当前账户权限' })
    ).toBeVisible()
    await expect(page.getByText('users:write', { exact: true })).toBeVisible()
    await logout(page)
    await page.goto(`${base}#/users`)
    await expect(page).toHaveURL(/#\/sign-in/)
    expect(apiResponses.length).toBeGreaterThan(0)
    expect(apiResponses.every(Boolean)).toBe(true)
  })
}

test('version index links to real artifacts and the host has no SPA fallback', async ({
  page,
  request,
}) => {
  await page.goto(`${siteBase}versions.html`)
  await expect(
    page.getByRole('heading', { name: '演示版本', level: 1 })
  ).toBeVisible()
  for (const version of versions.filter((value) => value !== 'latest')) {
    await expect(
      page.getByRole('link', { name: version, exact: true })
    ).toHaveAttribute('href', versionBase(version))
  }
  expect((await request.get(`${siteBase}users`)).status()).toBe(404)
})

if (versions.length > 1) {
  test('latest and archived sessions remain independent in the same browser', async ({
    page,
    context,
  }) => {
    await page.goto(`${versionBase('latest')}#/users`)
    await login(page, 'admin')
    const archived = await context.newPage()
    await archived.goto(`${versionBase('v0.0.0-smoke')}#/users`)
    await expect(archived).toHaveURL(/#\/sign-in/)
    await login(archived, 'viewer')
    await expect(
      archived.getByRole('button', { name: '添加用户', exact: true })
    ).toHaveCount(0)
    await archived.reload()
    await expect(
      archived.getByRole('heading', { name: '用户管理示例' })
    ).toBeVisible()
    await logout(archived)
    await page.reload()
    await expect(
      page.getByRole('heading', { name: '用户管理示例' })
    ).toBeVisible()
    await expect(
      page.getByRole('button', { name: '添加用户', exact: true })
    ).toBeVisible()
  })
}
