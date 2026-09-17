import { ArrowLeft, Pencil, Plus, Trash2 } from 'lucide-react'
import { Link, Navigate, useParams } from 'react-router-dom'
import { useBudgetApp } from '../../app/BudgetAppContext'
import { EmptyState } from '../../components/EmptyState'
import { Money } from '../../components/Money'
import { ProjectBadge } from '../../components/ProjectBadge'
import { EntryTime } from '../../components/EntryTime'
import type { DateKey } from '../../domain/dateKey'
import type { ExpenseType, LedgerTransaction, Project } from '../../domain/models'

function title(date: DateKey) {
  return `${Number(date.slice(5, 7))}月${Number(date.slice(8, 10))}日`
}

function EntryGroup({ type, entries, projects, onRemove }: {
  type: ExpenseType
  entries: LedgerTransaction[]
  projects: Project[]
  onRemove(id: string): Promise<void>
}) {
  return <section className="day-section">
    <div className="day-section-title"><h2>{type === 'budget' ? '预算消费' : '固定支出'}</h2>
      {type === 'fixed' && <span>不占预算</span>}</div>
    {entries.length ? <div className="day-entry-list">{entries.map((entry) => {
      const project = projects.find((item) => item.id === entry.projectId)
      return <article key={entry.id}>
        <ProjectBadge project={project} />
        <div><strong>{project?.name ?? '已停用项目'}</strong><EntryTime entry={entry} />{entry.note && <small>{entry.note}</small>}</div>
        <Money cents={-entry.amountCents} />
        <div className="entry-actions"><Link to={`/entry?transaction=${entry.id}`} aria-label={`编辑${project?.name ?? '账目'}`}><Pencil size={16} /></Link>
          <button type="button" aria-label={`删除${project?.name ?? '账目'}`} onClick={() => void onRemove(entry.id)}><Trash2 size={16} /></button></div>
      </article>
    })}</div> : <EmptyState>这一天没有{type === 'budget' ? '预算消费' : '固定支出'}。</EmptyState>}
  </section>
}

export function DayDetailPage() {
  const app = useBudgetApp()
  const { date: rawDate } = useParams()
  const date = rawDate as DateKey
  const day = app.projection?.days.find((item) => item.date === date)
  if (!day) return <Navigate to="/" replace />
  const entries = app.transactions.filter((entry) => entry.localDate === date)
  const budgetEntries = entries.filter((entry) => entry.expenseType === 'budget')
  const fixedEntries = entries.filter((entry) => entry.expenseType === 'fixed')

  async function remove(id: string) {
    if (!window.confirm('确定删除这笔账目吗？')) return
    await app.removeTransaction(id)
  }

  return <main className="day-page">
    <header className="page-header"><Link to="/" aria-label="返回"><ArrowLeft /></Link><h1>{title(date)}</h1>
      <Link to={`/entry?date=${date}`} aria-label="补记一笔"><Plus /></Link></header>
    <section className="day-summary">
      <div><span>基础预算</span><Money cents={day.baseBudgetCents} /></div>
      <div><span>滚入结余</span><Money cents={day.carryInCents} /></div>
      <div className="day-primary"><span>今日可用</span><Money cents={day.availableCents} /></div>
      <div><span>预算消费</span><Money cents={day.budgetSpentCents} /></div>
      <div><span>{day.overspentCents > 0 ? '当日超支' : '当日结余'}</span>
        <Money cents={day.overspentCents > 0 ? day.overspentCents : day.carryOutCents} /></div>
    </section>
    <EntryGroup type="budget" entries={budgetEntries} projects={app.projects} onRemove={remove} />
    <EntryGroup type="fixed" entries={fixedEntries} projects={app.projects} onRemove={remove} />
  </main>
}
