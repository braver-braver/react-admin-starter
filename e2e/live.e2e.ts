import { expect, test } from 'playwright/test'

const siteUrl = process.env.LIVE_DEMO_SITE_URL
const version = process.env.LIVE_DEMO_VERSION
const commit = process.env.LIVE_DEMO_COMMIT

if (!siteUrl || !version || !commit) {
  throw new Error(
    'LIVE_DEMO_SITE_URL, LIVE_DEMO_VERSION and LIVE_DEMO_COMMIT are required'
  )
}

const root = new URL(siteUrl.endsWith('/') ? siteUrl : `${siteUrl}/`)
const target = new URL(
  version === 'latest' ? './' : `releases/${version}/`,
  root
)

test('published Pages version, auth, data and permissions work in a real browser', async ({
  page,
  request,
}) => {
  // Pages/CDN may briefly serve an older deployment. Check provenance rather
  // than passing against a stale page or sleeping for a guessed duration.
  await expect
    .poll(
      async () => {
        try {
          const metadataUrl = new URL(`demo.json?verify=${Date.now()}`, target)
          const result = await request.get(metadataUrl.toString(), {
            timeout: 8000,
            failOnStatusCode: false,
            headers: { 'Cache-Control': 'no-cache' },
          })
          if (!result.ok()) return false
          const metadata: {
            version?: string
            commit?: string
            base?: string
          } = await result.json()
          return (
            metadata.version === version &&
            metadata.commit === commit &&
            metadata.base === target.pathname
          )
        } catch {
          return false
        }
      },
      { timeout: 120_000, intervals: [1000, 3000, 5000] }
    )
    .toBe(true)

  const serviceWorkerResponses: boolean[] = []
  page.on('response', (response) => {
    if (response.url().includes('/api/')) {
      serviceWorkerResponses.push(response.fromServiceWorker())
    }
  })

  await page.goto(`${target.toString()}#/users`)
  await expect(page).toHaveURL(/#\/sign-in/)
  await expect(
    page.getByRole('complementary', { name: '演示环境信息' })
  ).toContainText(`版本：${version}`)

  await page
    .getByRole('textbox', { name: '邮箱', exact: true })
    .fill('admin@example.com')
  await page.getByLabel('密码', { exact: true }).fill('Demo1234!')
  await page.getByRole('button', { name: '登录', exact: true }).click()
  await expect(
    page.getByRole('heading', { name: '用户管理示例' })
  ).toBeVisible()
  await expect(
    page.getByRole('button', { name: '添加用户', exact: true })
  ).toBeVisible()

  await page.reload()
  await expect(
    page.getByRole('heading', { name: '用户管理示例' })
  ).toBeVisible()

  await page.getByRole('button', { name: '账户菜单' }).click()
  await page.getByRole('menuitem', { name: '退出登录' }).click()
  await page
    .getByRole('alertdialog', { name: '退出登录' })
    .getByRole('button', { name: '退出登录', exact: true })
    .click()
  await expect(page).toHaveURL(/#\/sign-in/)
  expect(serviceWorkerResponses.length).toBeGreaterThan(0)
  expect(serviceWorkerResponses.every(Boolean)).toBe(true)

  await page
    .getByRole('textbox', { name: '邮箱', exact: true })
    .fill('viewer@example.com')
  await page.getByLabel('密码', { exact: true }).fill('Demo1234!')
  await page.getByRole('button', { name: '登录', exact: true }).click()
  await expect(
    page.getByRole('heading', { name: '用户管理示例' })
  ).toBeVisible()
  await expect(
    page.getByRole('button', { name: '添加用户', exact: true })
  ).toHaveCount(0)

  const versions = await request.get(new URL('versions.html', root).toString())
  expect(versions.ok()).toBe(true)
  expect(await versions.text()).toContain('演示版本')
})
