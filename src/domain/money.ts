export function parseYuanToCents(input: string): number {
  if (!/^(?:0\.\d{1,2}|[1-9]\d*(?:\.\d{1,2})?)$/.test(input)) {
    throw new RangeError('Amount must be positive with at most two decimals')
  }

  const [yuan, decimal = ''] = input.split('.')
  const cents = Number(yuan) * 100 + Number(decimal.padEnd(2, '0'))
  if (!Number.isSafeInteger(cents) || cents <= 0) throw new RangeError('Amount is out of range')
  return cents
}

export function formatCents(cents: number): string {
  if (!Number.isSafeInteger(cents)) throw new RangeError('Cents must be a safe integer')
  const sign = cents < 0 ? '-' : ''
  const absolute = Math.abs(cents)
  const yuan = Math.floor(absolute / 100).toLocaleString('en-US')
  return `${sign}¥${yuan}.${String(absolute % 100).padStart(2, '0')}`
}

export function distributeCents(total: number, count: number): number[] {
  if (!Number.isSafeInteger(total) || total < 0 || !Number.isInteger(count) || count <= 0) {
    throw new RangeError('Invalid cent distribution')
  }

  const base = Math.floor(total / count)
  const remainder = total % count
  return Array.from({ length: count }, (_, index) => base + (index < remainder ? 1 : 0))
}
