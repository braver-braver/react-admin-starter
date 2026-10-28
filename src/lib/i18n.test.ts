import { describe, expect, it } from 'vitest'
import {
  catalog,
  defaultLocale,
  formatDateTime,
  formatMonthShort,
  formatNumber,
  t,
} from './i18n'

describe('i18n catalog', () => {
  it('defaults to zh-CN and switches catalog by locale', () => {
    expect(defaultLocale).toBe('zh-CN')
    expect(t('cancel')).toBe('取消')
    expect(t('cancel', 'en-US')).toBe('Cancel')
  })

  it('keeps the same keys in every locale', () => {
    const zhKeys = Object.keys(catalog['zh-CN']).sort()
    const enKeys = Object.keys(catalog['en-US']).sort()
    expect(enKeys).toEqual(zhKeys)
  })

  it('has no empty or untranslated placeholder values', () => {
    for (const locale of Object.keys(catalog) as (keyof typeof catalog)[]) {
      for (const [key, value] of Object.entries(catalog[locale])) {
        expect(value.trim(), `${locale}.${key}`).not.toBe('')
      }
    }
  })

  it('formats dates with Intl instead of hand-written patterns', () => {
    const date = new Date('2026-10-28T09:05:00+08:00')
    expect(formatMonthShort(date, 'zh-CN')).toBe('10月')
    expect(formatMonthShort(date, 'en-US')).toBe('Oct')
    expect(formatDateTime(date, 'zh-CN')).not.toBe(
      formatDateTime(date, 'en-US')
    )
    expect(formatDateTime(date, 'zh-CN')).toContain('2026')
    expect(formatDateTime(date, 'en-US')).toContain('2026')
  })

  it('formats numbers with grouping per locale', () => {
    expect(formatNumber(1234.5, 'zh-CN')).toBe('1,234.5')
    expect(formatNumber(1234.5, 'en-US')).toBe('1,234.5')
    expect(formatNumber(0.42, 'zh-CN', { style: 'percent' })).toBe('42%')
  })
})
