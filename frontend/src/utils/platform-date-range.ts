import dayjs from 'dayjs'

export type DateRangeValue = [number, number] | null

const DAY_END_HOUR = 23
const DAY_END_MINUTE = 59
const DAY_END_SECOND = 59
const DAY_END_MS = 999

function startOfDay(value: number) {
  return dayjs(value).startOf('day').valueOf()
}

function endOfDay(value: number) {
  return dayjs(value)
    .hour(DAY_END_HOUR)
    .minute(DAY_END_MINUTE)
    .second(DAY_END_SECOND)
    .millisecond(DAY_END_MS)
    .valueOf()
}

function parseTime(value?: string | null) {
  if (!value) return null
  const time = new Date(value).getTime()
  return Number.isFinite(time) ? time : null
}

export function normalizeDateRange(value?: DateRangeValue): DateRangeValue {
  if (!value || value.length !== 2) {
    return null
  }

  const [first, second] = value
  if (!Number.isFinite(first) || !Number.isFinite(second)) {
    return null
  }

  const start = Math.min(first, second)
  const end = Math.max(first, second)
  return [startOfDay(start), endOfDay(end)]
}

const DAYS_PER_MONTH = 30
const MONTHS_PER_YEAR = 12

function getDurationParts(days: number) {
  const totalMonths = Math.floor(days / DAYS_PER_MONTH)
  const remainingDays = days - totalMonths * DAYS_PER_MONTH
  const years = Math.floor(totalMonths / MONTHS_PER_YEAR)
  const remainingMonths = totalMonths - years * MONTHS_PER_YEAR

  return {
    totalMonths,
    remainingDays,
    years,
    remainingMonths,
  }
}

function getRangeDays(range: [number, number]) {
  const start = dayjs(range[0]).startOf('day')
  const end = dayjs(range[1]).startOf('day')
  return end.diff(start, 'day') + 1
}

function formatConvertedDuration(days: number) {
  const { totalMonths, remainingDays, years, remainingMonths } = getDurationParts(days)
  if (totalMonths === 0) {
    return ''
  }

  const segments: string[] = []
  if (years > 0) segments.push(`${years} 年`)
  if (remainingMonths > 0) segments.push(`${remainingMonths} 个月`)
  if (remainingDays > 0) segments.push(`${remainingDays} 天`)
  return segments.join(' ')
}

export function formatDateRangeSummary(value?: DateRangeValue) {
  const range = normalizeDateRange(value)
  if (!range) {
    return ''
  }

  const days = getRangeDays(range)
  const converted = formatConvertedDuration(days)

  if (!converted) {
    return `已选择 ${days} 天`
  }

  return `已选择 ${days} 天（${converted}）`
}

export function formatDateRangeDuration(value?: DateRangeValue) {
  const range = normalizeDateRange(value)
  if (!range) {
    return ''
  }

  const days = getRangeDays(range)
  const converted = formatConvertedDuration(days)

  return converted ? `${days} 天，${converted}` : `${days} 天`
}

export function getDateRangeStartIso(value?: DateRangeValue) {
  const range = normalizeDateRange(value)
  return range ? new Date(range[0]).toISOString() : undefined
}

export function getDateRangeEndIso(value?: DateRangeValue) {
  const range = normalizeDateRange(value)
  return range ? new Date(range[1]).toISOString() : null
}

export function isoRangeToPickerRange(startsAt?: string | null, expiresAt?: string | null): DateRangeValue {
  const start = parseTime(startsAt)
  const end = parseTime(expiresAt)
  if (start === null || end === null) {
    return null
  }
  return normalizeDateRange([start, end])
}

export function dateToEndOfDayIso(value?: number | null) {
  if (!value || !Number.isFinite(value)) {
    return undefined
  }
  return new Date(endOfDay(value)).toISOString()
}
