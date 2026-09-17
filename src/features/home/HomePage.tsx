import { useCallback, useMemo, useState } from 'react'
import { CalendarRange, ChevronRight, Plus } from 'lucide-react'
import { Link } from 'react-router-dom'
import { useBudgetApp } from '../../app/BudgetAppContext'
import { EmptyState } from '../../components/EmptyState'
import { Money } from '../../components/Money'
import { ToastUndo } from '../../components/ToastUndo'
import { daysBetween } from '../../domain/dateKey'
import { formatCents } from '../../domain/money'
import { BudgetCalendar } from './BudgetCalendar'

function formatRange(startDate: string, endDate: string) {
  const show = (date: string) => `${Number(date.slice(5, 7))}月${Number(date.slice(8, 10))}日`
  return `${show(startDate)} – ${show(endDate)}`
}

export function HomePage() {
  const app = useBudgetApp()
  const [undoId, setUndoId] = useState<string>()
  const [savingPreset, setSavingPreset] = useState<string>()
  const [error, setError] = useState('')
  const clearUndo = useCallback(() => setUndoId(undefined), [])
  const todayProjection = app.projection?.days.find((day) => day.date === app.today)
  const todayEntries = app.transactions.filter((entry) => entry.localDate === app.today)
  const projectMap = useMemo(() => new Map(app.projects.map((project) => [project.id, project])), [app.projects])

  if (!app.cycle || !app.projection) return null

  const remainingDays = Math.max(0, daysBetween(app.today, app.cycle.endDate) + 1)
  const activeProjects = app.projects.filter((project) => project.isActive)
  const quickPresets = activeProjects.flatMap((project) => app.presets
    .filter((preset) => preset.projectId === project.id)
    .map((preset) => ({ project, preset })))

  async function quickAdd(projectId: string, amountCents: number, presetId: string) {
    const project = projectMap.get(projectId)
    if (!project) return
    try {
      setError('')
      setSavingPreset(presetId)
      const transaction = await app.addTransaction({
        cycleId: app.cycle!.id,
        projectId,
        expenseType: project.expenseType,
        amountCents,
        localDate: app.today,
        note: '',
      })
      setUndoId(transaction.id)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : '记账失败，请重试')
    } finally {
      setSavingPreset(undefined)
    }
  }

  async function undo() {
    if (!undoId) return
    await app.removeTransaction(undoId)
    setUndoId(undefined)
  }

  return <main className="home-page">
    <header className="home-header">
      <div><h1>预算日历</h1><p><CalendarRange size={15} aria-hidden="true" />{formatRange(app.cycle.startDate, app.cycle.endDate)}</p></div>
      <Link className="header-action" to="/entry" aria-label="记一笔"><Plus size={22} /></Link>
    </header>

    <section className="budget-hero" aria-label="预算概览">
      <p>今日可用</p>
      <Money cents={todayProjection?.availableCents ?? 0} className="hero-money" />
      <div className="hero-meta">
        <div><span>周期剩余</span><Money cents={app.projection.remainingBudgetCents} /></div>
        <div><span>时间进度</span><strong>剩余 {remainingDays} 天</strong></div>
      </div>
    </section>

    <section className="home-section">
      <div className="section-title"><div><span>快速记账</span><h2>常用项目</h2></div><Link to="/settings">管理</Link></div>
      {quickPresets.length ? <div className="quick-grid">{quickPresets.map(({ project, preset }) =>
        <button key={preset.id} type="button" disabled={savingPreset === preset.id}
          aria-label={`${project.name} ${formatCents(preset.amountCents)}`}
          onClick={() => void quickAdd(project.id, preset.amountCents, preset.id)}>
          <span className="project-badge" style={{ backgroundColor: `${project.color}18`, color: project.color }}>{project.name.slice(0, 1)}</span>
          <span>{project.name}</span><strong>{formatCents(preset.amountCents)}</strong>
        </button>)}</div> : <EmptyState>还没有快捷项目，可在设置里添加。</EmptyState>}
      {error && <p className="form-error" role="alert">{error}</p>}
    </section>

    <section className="home-section calendar-section">
      <div className="section-title"><div><span>发薪周期</span><h2>周期日历</h2></div></div>
      <BudgetCalendar projection={app.projection} today={app.today} />
    </section>

    <section className="home-section today-section">
      <div className="section-title"><div><span>今天</span><h2>今日账目</h2></div><Link to={`/day/${app.today}`}>全部 <ChevronRight size={15} /></Link></div>
      {todayEntries.length ? <div className="today-list">{todayEntries.map((entry) => {
        const project = projectMap.get(entry.projectId)
        return <Link key={entry.id} to={`/entry?transaction=${entry.id}`}>
          <span className="project-badge" style={{ backgroundColor: `${project?.color ?? '#73809a'}18`, color: project?.color }}>{project?.name.slice(0, 1) ?? '?'}</span>
          <span><strong>{project?.name ?? '已停用项目'}</strong><small>{entry.expenseType === 'fixed' ? '固定支出 · 不占预算' : '预算消费'}</small></span>
          <Money cents={-entry.amountCents} />
        </Link>
      })}</div> : <EmptyState>今天还没有账目。</EmptyState>}
    </section>

    {undoId && <ToastUndo onUndo={undo} onExpire={clearUndo} />}
  </main>
}
