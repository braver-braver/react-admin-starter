/**
 * 轻量共享文案表：只收录会被多个组件复用的界面字符串。
 * 不引入 i18n 框架与 Provider；确需运行时切换语言时再升级为更完整的方案。
 */
export const catalog = {
  'zh-CN': {
    close: '关闭',
    cancel: '取消',
    continue: '继续',
    select: '请选择',
    loading: '加载中…',
    clearSelection: '清除选择',
    toggleSidebar: '切换侧边栏',
    sidebarTitle: '侧边栏',
    sidebarDescription: '移动端侧边栏导航。',
    commandTitle: '命令面板',
    commandDescription: '搜索要执行的命令…',
    noResults: '没有匹配结果。',
    serverError: '操作失败，请稍后重试。',
    noContent: '没有返回内容。',
    comingSoonTitle: '即将上线！',
    comingSoonDescription: '该页面尚未创建，敬请期待。',
  },
  'en-US': {
    close: 'Close',
    cancel: 'Cancel',
    continue: 'Continue',
    select: 'Select',
    loading: 'Loading…',
    clearSelection: 'Clear selection',
    toggleSidebar: 'Toggle sidebar',
    sidebarTitle: 'Sidebar',
    sidebarDescription: 'Displays the mobile sidebar.',
    commandTitle: 'Command Palette',
    commandDescription: 'Search for a command to run…',
    noResults: 'No results found.',
    serverError: 'Something went wrong. Please try again.',
    noContent: 'No content returned.',
    comingSoonTitle: 'Coming soon!',
    comingSoonDescription: 'This page has not been created yet. Stay tuned.',
  },
} as const

export type Locale = keyof typeof catalog
export type MessageKey = keyof (typeof catalog)['zh-CN']

/** 中文优先：未显式指定语言时一律使用 zh-CN */
export const defaultLocale: Locale = 'zh-CN'

export function t(key: MessageKey, locale: Locale = defaultLocale): string {
  return catalog[locale][key]
}

const monthFormatters = new Map<Locale, Intl.DateTimeFormat>()
const dateTimeFormatters = new Map<Locale, Intl.DateTimeFormat>()

function monthFormatter(locale: Locale) {
  let formatter = monthFormatters.get(locale)
  if (!formatter) {
    formatter = new Intl.DateTimeFormat(locale, { month: 'short' })
    monthFormatters.set(locale, formatter)
  }
  return formatter
}

function dateTimeFormatter(locale: Locale) {
  let formatter = dateTimeFormatters.get(locale)
  if (!formatter) {
    formatter = new Intl.DateTimeFormat(locale, {
      dateStyle: 'medium',
      timeStyle: 'short',
    })
    dateTimeFormatters.set(locale, formatter)
  }
  return formatter
}

/** 月历下拉等处的短月份名称，交给 Intl 处理区域差异 */
export function formatMonthShort(date: Date, locale: Locale = defaultLocale) {
  return monthFormatter(locale).format(date)
}

/** 表格与审计流水的日期时间展示，避免手写拼接 */
export function formatDateTime(
  value: Date | string | number,
  locale: Locale = defaultLocale
) {
  const date = value instanceof Date ? value : new Date(value)
  return dateTimeFormatter(locale).format(date)
}

/** 计数与统计的本地化数字格式 */
export function formatNumber(
  value: number,
  locale: Locale = defaultLocale,
  options?: Intl.NumberFormatOptions
) {
  return new Intl.NumberFormat(locale, options).format(value)
}
