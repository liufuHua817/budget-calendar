import { addDays } from '../../domain/dateKey'
import { calculateCycleProjection } from '../../domain/budgetEngine'
import type { Cycle, LedgerTransaction } from '../../domain/models'
import { formatCents } from '../../domain/money'
import { useBudgetApp } from '../../app/BudgetAppContext'
import { EmptyState } from '../../components/EmptyState'
import { Money } from '../../components/Money'

function shortDate(date: string) {
  return `${Number(date.slice(5, 7))}月${Number(date.slice(8, 10))}日`
}

export function HistoryPage() {
  const app = useBudgetApp()
  return <main className="history-page">
    <header className="simple-header"><p>每期独立结算</p><h1>周期统计</h1></header>
    {app.cycles.map((cycle) => <CycleReport key={cycle.id} cycle={cycle}
      transactions={app.allTransactions.filter((entry) => entry.cycleId === cycle.id)}
      today={app.today} projects={app.projects} />)}
  </main>
}

function CycleReport({ cycle, transactions, today, projects }: {
  cycle: Cycle
  transactions: LedgerTransaction[]
  today: typeof cycle.startDate
  projects: ReturnType<typeof useBudgetApp>['projects']
}) {
  const asOf = cycle.status === 'archived' ? addDays(cycle.endDate, 1) : today
  const projection = calculateCycleProjection(cycle, transactions, asOf)
  const budgetEntries = transactions.filter((entry) => entry.expenseType === 'budget')
  const weekCount = Math.ceil(projection.days.length / 7)
  const weeks = Array.from({ length: weekCount }, (_, index) => {
    const days = projection.days.filter((day) => day.weekIndex === index)
    return {
      index,
      dayCount: days.length,
      spent: days.reduce((sum, day) => sum + day.budgetSpentCents, 0),
    }
  })
  const maxWeek = Math.max(1, ...weeks.map((week) => week.spent))
  const categories = projects.map((project) => ({
    project,
    amount: budgetEntries.filter((entry) => entry.projectId === project.id)
      .reduce((sum, entry) => sum + entry.amountCents, 0),
  })).filter((item) => item.amount > 0)
  const segments = categories.map((item, index) => ({
    ...item,
    percent: item.amount / projection.budgetSpentCents * 100,
    offset: categories.slice(0, index)
      .reduce((sum, category) => sum + category.amount, 0) / projection.budgetSpentCents * 100,
  }))

  return <article className="cycle-report">
    <header className="cycle-report-head">
      <div><span>{cycle.status === 'active' ? '当前周期' : '已结束'}</span><h2>{shortDate(cycle.startDate)} – {shortDate(cycle.endDate)}</h2></div>
      <span className={projection.overspendCents ? 'danger-tag' : 'success-tag'}>
        {projection.overspendCents ? '超支' : '有盈余'}
      </span>
    </header>
    <div className="cycle-totals">
      <div><span>周期预算</span><Money cents={cycle.totalBudgetCents} /></div>
      <div><span>预算消费</span><Money cents={projection.budgetSpentCents} /></div>
      {projection.budgetSpentCents > 0 && <div className={projection.overspendCents ? 'danger-total' : 'success-total'}>
        <span>{projection.overspendCents ? '周期超支' : '周期盈余'}</span>
        <Money cents={projection.overspendCents || projection.surplusCents} />
      </div>}
      <div><span>固定支出</span><small>不占预算</small><Money cents={projection.fixedSpentCents} /></div>
    </div>

    <section className="chart-card"><h3>每周预算消费</h3>
      <div className="week-chart">{weeks.map((week) => <div key={week.index} data-week-bar>
        <div><i style={{ height: `${Math.max(4, week.spent / maxWeek * 100)}%` }} /></div>
        <strong>{formatCents(week.spent)}</strong>
        <span>第{week.index + 1}周 · {week.dayCount}天</span>
      </div>)}</div>
    </section>

    <section className="chart-card"><h3>项目分布</h3>
      {categories.length ? <div className="category-chart">
        <svg viewBox="0 0 42 42" role="img" aria-label="预算消费项目占比">
          <circle className="donut-track" cx="21" cy="21" r="15.9155" fill="transparent" strokeWidth="7" />
          {segments.map(({ project, percent, offset }) => <circle key={project.id} cx="21" cy="21" r="15.9155" fill="transparent" stroke={project.color}
            strokeWidth="7" strokeDasharray={`${percent} ${100 - percent}`} strokeDashoffset={-offset} />)}
        </svg>
        <div className="category-legend">{categories.map(({ project, amount }) => <div key={project.id}>
          <i style={{ background: project.color }} /><span>{project.name}</span><strong>{formatCents(amount)}</strong>
        </div>)}</div>
      </div> : <EmptyState>本周期还没有预算消费</EmptyState>}
    </section>
  </article>
}
