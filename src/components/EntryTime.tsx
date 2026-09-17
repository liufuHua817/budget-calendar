import type { LedgerTransaction } from '../domain/models'

export function EntryTime({ entry }: { entry: Pick<LedgerTransaction, 'createdAt' | 'localDate'> }) {
  const recorded = new Date(entry.createdAt)
  if (Number.isNaN(recorded.getTime())) return <span className="entry-time">记录时间未知</span>
  const year = recorded.getFullYear()
  const month = recorded.getMonth() + 1
  const day = recorded.getDate()
  const pad = (value: number) => String(value).padStart(2, '0')
  const dateKey = `${year}-${pad(month)}-${pad(day)}`
  const clock = `${pad(recorded.getHours())}:${pad(recorded.getMinutes())}`
  const fullTime = `${year}年${month}月${day}日 ${clock}`
  return <time className="entry-time" dateTime={entry.createdAt} title={`原始记账时间：${fullTime}`}>
    {dateKey === entry.localDate ? `记录于 ${clock}` : `录入于 ${fullTime}`}
  </time>
}
