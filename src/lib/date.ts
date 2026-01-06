type DateParts = {
  year: number
  monthIndex: number
  day: number
}

const pad2 = (value: number) => String(value).padStart(2, '0')

const parseDateKey = (dateKey: string): DateParts | null => {
  const [yearRaw, monthRaw, dayRaw] = dateKey.split('-')
  const year = Number(yearRaw)
  const monthIndex = Number(monthRaw) - 1
  const day = Number(dayRaw)

  if (!Number.isInteger(year) || !Number.isInteger(monthIndex) || !Number.isInteger(day)) {
    return null
  }

  return { year, monthIndex, day }
}

// Use local calendar parts (not UTC) to avoid date shifts around time zones.
export const getDateKey = (value: string | Date) => {
  const date = typeof value === 'string' ? new Date(value) : value
  if (Number.isNaN(date.getTime())) return ''

  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`
}

export const addDays = (date: Date, offset: number) => {
  const result = new Date(date)
  result.setDate(result.getDate() + offset)
  return result
}

// Default to midday to avoid DST edge cases when constructing a local date.
export const getDateFromKey = (dateKey: string, hour = 12) => {
  const parts = parseDateKey(dateKey)
  if (!parts) return new Date('')
  return new Date(parts.year, parts.monthIndex, parts.day, hour)
}

export const addDaysToKey = (dateKey: string, offset: number) => {
  const baseDate = getDateFromKey(dateKey, 12)
  return getDateKey(addDays(baseDate, offset))
}

export const getTodayRange = () => {
  const now = new Date()
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const end = addDays(start, 1)
  return { start, end }
}

export const getDateRange = (dateKey: string) => {
  const parts = parseDateKey(dateKey)
  if (!parts) {
    const invalid = new Date('')
    return { start: invalid, end: invalid }
  }

  const start = new Date(parts.year, parts.monthIndex, parts.day)
  const end = addDays(start, 1)
  return { start, end }
}

export const buildDayKey = (year: number, monthIndex: number, day: number) => {
  const date = new Date(year, monthIndex, day, 12)
  return getDateKey(date)
}
