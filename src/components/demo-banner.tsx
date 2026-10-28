export function DemoBanner() {
  if (!__DEMO_BUILD__ || !__DEMO_METADATA__) return null
  const { version, commit, base } = __DEMO_METADATA__
  const siteBase = base.replace(/releases\/[^/]+\/$/, '')
  return (
    <aside
      aria-label='演示环境信息'
      className='border-b bg-amber-100 px-4 py-2 text-center text-sm text-amber-950'
    >
      <p>演示环境 · 数据仅保存在浏览器，请勿输入真实密码或个人信息。</p>
      <p>
        版本：{version} · 提交：{commit.slice(0, 7)}
        {' · '}
        <a href={`${siteBase}versions.html`} className='underline'>
          查看历史版本
        </a>
      </p>
    </aside>
  )
}
