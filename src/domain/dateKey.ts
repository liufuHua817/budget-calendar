export type DateKey = `${number}-${number}-${number}`

function parseDateKey(date: DateKey): [number, number, number] {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date)
  if (!match) throw new RangeError('Invalid date key')

  const parts: [number, number, number] = [Number(match[1]), Number(match[2]), Number(match[3])]
  const value = new Date(Date.UTC(parts[0], parts[1] - 1, parts[2]))
  if (value.toISOString().slice(0, 10) !== date) throw new RangeError('Invalid date key')
  return parts
}

function toUtcMilliseconds(date: DateKey): number {
  const [year, month, day] = parseDateKey(date)
  return Date.UTC(year, month - 1, day)
}

function toDateKey(value: Date): DateKey {
  return value.toISOString().slice(0, 10) as DateKey
}

export function addDays(date: DateKey, days: number): DateKey {
  if (!Number.isInteger(days)) throw new RangeError('Days must be an integer')
  const [year, month, day] = parseDateKey(date)
  return toDateKey(new Date(Date.UTC(year, month - 1, day + days)))
}

export function daysBetween(start: DateKey, end: DateKey): number {
  return Math.round((toUtcMilliseconds(end) - toUtcMilliseconds(start)) / 86_400_000)
}

export function suggestNextPayDate(start: DateKey): DateKey {
  const [year, month, day] = parseDateKey(start)
  const nextMonthStart = new Date(Date.UTC(year, month, 1))
  const targetYear = nextMonthStart.getUTCFullYear()
  const targetMonth = nextMonthStart.getUTCMonth()
  const lastDay = new Date(Date.UTC(targetYear, targetMonth + 1, 0)).getUTCDate()
  return toDateKey(new Date(Date.UTC(targetYear, targetMonth, Math.min(day, lastDay))))
}
