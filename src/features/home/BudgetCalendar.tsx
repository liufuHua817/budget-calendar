import { Link } from 'react-router-dom'
import type { DateKey } from '../../domain/dateKey'
import type { CycleProjection } from '../../domain/models'

function dayNumber(date: DateKey) {
  return Number(date.slice(-2))
}

function monthDay(date: DateKey) {
  return `${Number(date.slice(5, 7))}月${dayNumber(date)}日`
}

export function BudgetCalendar({ projection, today }: { projection: CycleProjection; today: DateKey }) {
  return <div className="budget-calendar" aria-label="本周期日历">
    <div className="calendar-weekdays" aria-hidden="true">
      {['1', '2', '3', '4', '5', '6', '7'].map((day) => <span key={day}>第{day}日</span>)}
    </div>
    <div className="calendar-grid">
      {projection.days.map((day) => {
        const classNames = [
          'calendar-day',
          day.date === today ? 'today' : '',
          day.budgetSpentCents > 0 ? 'spent' : '',
          day.overspentCents > 0 ? 'overspent' : '',
        ].filter(Boolean).join(' ')
        return <Link
          key={day.date}
          to={`/day/${day.date}`}
          className={classNames}
          data-calendar-day
          data-date={day.date}
          data-week={day.weekIndex + 1}
          aria-current={day.date === today ? 'date' : undefined}
          aria-label={`${monthDay(day.date)}，可用预算${day.availableCents / 100}元`}
        >
          <span>{dayNumber(day.date)}</span>
          {day.budgetSpentCents > 0 && <i aria-hidden="true" />}
        </Link>
      })}
    </div>
  </div>
}
