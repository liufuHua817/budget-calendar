import { useState } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { Link } from 'react-router-dom'
import type { DateKey } from '../../domain/dateKey'
import type { CycleProjection } from '../../domain/models'

function amount(cents: number) {
  return (cents / 100).toLocaleString('zh-CN', { maximumFractionDigits: 2 })
}

export function BudgetCalendar({ projection, today }: { projection: CycleProjection; today: DateKey }) {
  const months = [...new Set(projection.days.map((day) => day.date.slice(0, 7)))]
  const initialMonth = months.includes(today.slice(0, 7)) ? today.slice(0, 7) : months[0]
  const [selectedMonth, setSelectedMonth] = useState(initialMonth)
  const month = months.includes(selectedMonth) ? selectedMonth : initialMonth
  if (!month) return null
  const index = months.indexOf(month)
  const [year, monthNumber] = month.split('-').map(Number)
  const offset = (new Date(Date.UTC(year, monthNumber - 1, 1)).getUTCDay() + 6) % 7
  const count = new Date(Date.UTC(year, monthNumber, 0)).getUTCDate()
  const days = new Map(projection.days.map((day) => [day.date, day]))

  return <section className="budget-calendar" aria-label="本周期日历">
    <div className="section-title calendar-heading"><h2>收支日历</h2>
      <div className="month-switcher">
        <button type="button" aria-label="上个月" disabled={index === 0} onClick={() => setSelectedMonth(months[index - 1])}><ChevronLeft size={18} /></button>
        <span aria-live="polite">{year}年{monthNumber}月</span>
        <button type="button" aria-label="下个月" disabled={index === months.length - 1} onClick={() => setSelectedMonth(months[index + 1])}><ChevronRight size={18} /></button>
      </div>
    </div>
    <div className="calendar-legend"><span className="positive">+ 结余</span><span className="negative">− 超支</span><span className="today-key">今天暂计</span><span>— 未到</span></div>
    <div className="calendar-weekdays" aria-hidden="true">{['一', '二', '三', '四', '五', '六', '日'].map((name) => <span key={name}>{name}</span>)}</div>
    <div className="calendar-grid">
      {Array.from({ length: offset }, (_, i) => <span key={`blank-${i}`} className="calendar-blank" aria-hidden="true" />)}
      {Array.from({ length: count }, (_, i) => {
        const number = i + 1
        const date = `${month}-${String(number).padStart(2, '0')}` as DateKey
        const day = days.get(date)
        if (!day) return <span className="calendar-outside" key={date} aria-label={`${monthNumber}月${number}日，不在本周期`}>{number}</span>
        const future = date > today
        const isToday = date === today
        const balance = day.availableCents - day.budgetSpentCents
        const state = future ? 'future' : balance < 0 ? 'overspent' : balance > 0 ? 'surplus' : 'balanced'
        const label = future ? '未到' : isToday
          ? `${balance < 0 ? '今日已超支' : '今日暂余'}${amount(Math.abs(balance))}元`
          : `${balance < 0 ? '超支' : balance > 0 ? '结余' : '收支平衡'}${balance === 0 ? '' : `${amount(Math.abs(balance))}元`}`
        const value = future ? '—' : `${balance > 0 ? '+' : balance < 0 ? '−' : ''}${amount(Math.abs(balance))}`
        return <Link key={date} to={`/day/${date}`} className={`calendar-day ${state}${isToday ? ' today' : ''}`}
          data-calendar-day data-date={date} data-week={day.weekIndex + 1}
          aria-current={isToday ? 'date' : undefined} aria-label={`${monthNumber}月${number}日，${label}`}>
          <span className="calendar-date">{number}{isToday && <i aria-hidden="true" />}</span><strong title={label}>{value}</strong>
        </Link>
      })}
    </div>
    <p className="calendar-caption">单位：元 · 点日期看明细<span>当日额度 − 预算消费</span></p>
    <details className="budget-explainer"><summary>结余怎么算？</summary><p>当日额度包含滚入结余，减去预算消费后得到当日结余或超支。今天的金额会继续变化，未记录消费按 0 计算。固定支出不占预算。每天的结余不能相加作为周期结余。</p></details>
  </section>
}
