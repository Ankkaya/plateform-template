import assert from 'node:assert/strict'
import test from 'node:test'
import {
  dateToEndOfDayIso,
  formatDateRangeDuration,
  formatDateRangeSummary,
  getDateRangeEndIso,
  getDateRangeStartIso,
  isoRangeToPickerRange,
  normalizeDateRange,
} from './platform-date-range.ts'

const localMs = (year, month, day, hour = 0, minute = 0, second = 0, ms = 0) => {
  return new Date(year, month - 1, day, hour, minute, second, ms).getTime()
}

test('normalizes date ranges to full local days', () => {
  const range = normalizeDateRange([
    localMs(2026, 1, 5, 15, 30),
    localMs(2026, 2, 4, 2, 10),
  ])

  assert.ok(range)
  assert.equal(new Date(range[0]).getHours(), 0)
  assert.equal(new Date(range[0]).getMinutes(), 0)
  assert.equal(new Date(range[1]).getHours(), 23)
  assert.equal(new Date(range[1]).getMinutes(), 59)
  assert.equal(new Date(range[1]).getSeconds(), 59)
})

test('summarizes selected days using 30-day months and 12-month years', () => {
  // 31 天 = 1 个月 1 天
  assert.equal(
    formatDateRangeSummary([localMs(2026, 1, 5), localMs(2026, 2, 4)]),
    '已选择 31 天（1 个月 1 天）',
  )
  // 30 天 = 1 个月
  assert.equal(
    formatDateRangeSummary([localMs(2026, 1, 1), localMs(2026, 1, 30)]),
    '已选择 30 天（1 个月）',
  )
  // 360 天 = 12 月 = 1 年
  assert.equal(
    formatDateRangeSummary([localMs(2026, 1, 1), localMs(2026, 12, 26)]),
    '已选择 360 天（1 年）',
  )
  // 365 天 = 12 个月 5 天 = 1 年 5 天
  assert.equal(
    formatDateRangeSummary([localMs(2026, 1, 1), localMs(2026, 12, 31)]),
    '已选择 365 天（1 年 5 天）',
  )
  // 不足 30 天，仅显示天数
  assert.equal(
    formatDateRangeSummary([localMs(2026, 1, 1), localMs(2026, 1, 10)]),
    '已选择 10 天',
  )
  // 400 天 = 13 个月 10 天 = 1 年 1 个月 10 天
  assert.equal(
    formatDateRangeSummary([localMs(2026, 1, 1), localMs(2027, 2, 4)]),
    '已选择 400 天（1 年 1 个月 10 天）',
  )
})

test('formats date range duration for compact table display', () => {
  assert.equal(
    formatDateRangeDuration([localMs(2026, 1, 1), localMs(2026, 12, 31)]),
    '365 天，1 年 5 天',
  )
  assert.equal(
    formatDateRangeDuration([localMs(2026, 1, 1), localMs(2026, 1, 10)]),
    '10 天',
  )
  assert.equal(formatDateRangeDuration(null), '')
})

test('converts picker ranges and single dates to rounded ISO strings', () => {
  const range = [localMs(2026, 3, 1, 12), localMs(2026, 3, 31, 1)]

  assert.equal(getDateRangeStartIso(range), new Date(localMs(2026, 3, 1)).toISOString())
  assert.equal(getDateRangeEndIso(range), new Date(localMs(2026, 3, 31, 23, 59, 59, 999)).toISOString())
  assert.equal(dateToEndOfDayIso(localMs(2026, 3, 15, 9)), new Date(localMs(2026, 3, 15, 23, 59, 59, 999)).toISOString())
})

test('builds picker ranges from ISO start and end values', () => {
  const range = isoRangeToPickerRange(
    new Date(localMs(2026, 4, 1, 9)).toISOString(),
    new Date(localMs(2026, 4, 30, 12)).toISOString(),
  )

  assert.deepEqual(range, normalizeDateRange([localMs(2026, 4, 1), localMs(2026, 4, 30)]))
  assert.equal(isoRangeToPickerRange(null, null), null)
})
