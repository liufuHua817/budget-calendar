import { formatCents } from '../domain/money'

export function Money({ cents, className }: { cents: number; className?: string }) {
  return <span className={className}>{formatCents(cents)}</span>
}
