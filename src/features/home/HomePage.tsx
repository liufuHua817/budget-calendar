import { useCallback, useMemo, useRef, useState, type CSSProperties } from 'react'
import { CalendarDays, ChevronRight, Grid3X3, Plus, Sun, ChevronUp } from 'lucide-react'
import { Link } from 'react-router-dom'
import { useBudgetApp } from '../../app/BudgetAppContext'
import { EmptyState } from '../../components/EmptyState'
import { Money } from '../../components/Money'
import { ProjectBadge } from '../../components/ProjectBadge'
import { projectAppearance } from '../../components/projectAppearance'
import { ToastUndo } from '../../components/ToastUndo'
import { daysBetween } from '../../domain/dateKey'
import { formatCents } from '../../domain/money'
import { BudgetCalendar } from './BudgetCalendar'

function shortDate(date: string) { return `${Number(date.slice(5, 7))}月${Number(date.slice(8, 10))}日` }

export function HomePage() {
  const app = useBudgetApp()
  const [undoEntry, setUndoEntry] = useState<{ id: string; label: string }>()
  const [busy, setBusy] = useState(false)
  const busyRef = useRef(false)
  const [expanded, setExpanded] = useState(false)
  const [error, setError] = useState('')
  const clearUndo = useCallback(() => setUndoEntry(undefined), [])
  const todayProjection = app.projection?.days.find((day) => day.date === app.today)
  const todayEntries = app.transactions.filter((entry) => entry.localDate === app.today).sort((a, b) => b.createdAt.localeCompare(a.createdAt))
  const projectMap = useMemo(() => new Map(app.projects.map((project) => [project.id, project])), [app.projects])
  if (!app.cycle || !app.projection) return null
  const quickPresets = app.projects.filter((project) => project.isActive).flatMap((project) => app.presets
    .filter((preset) => preset.projectId === project.id).map((preset) => ({ project, preset })))
  const visiblePresets = expanded ? quickPresets : quickPresets.slice(0, 7)
  const balance = todayProjection ? todayProjection.availableCents - todayProjection.budgetSpentCents : 0

  async function quickAdd(projectId: string, amountCents: number) {
    const project = projectMap.get(projectId)
    if (!project || busyRef.current) return
    busyRef.current = true
    setBusy(true)
    try {
      setError('')
      const transaction = await app.addTransaction({ cycleId: app.cycle!.id, projectId, expenseType: project.expenseType, amountCents, localDate: app.today, note: '' })
      setUndoEntry({ id: transaction.id, label: `已记录 ${project.name} ${formatCents(amountCents)}` })
    } catch (cause) { setError(cause instanceof Error ? cause.message : '记账失败，请重试') }
    finally { busyRef.current = false; setBusy(false) }
  }

  async function undo() {
    if (!undoEntry || busyRef.current) return
    busyRef.current = true
    setBusy(true)
    try { await app.removeTransaction(undoEntry.id); setUndoEntry(undefined) }
    catch { setError('撤销失败，请重试') }
    finally { busyRef.current = false; setBusy(false) }
  }

  return <main className="home-page">
    <header className="home-header"><div><h1>预算日历</h1><p>{shortDate(app.cycle.startDate)} — {shortDate(app.cycle.endDate)}</p></div>
      <Link className="header-action" to="/entry" aria-label="记一笔"><Plus size={24} /></Link></header>
    <section className={`budget-hero${balance < 0 ? ' is-overspent' : ''}`} aria-label="预算概览">
      <div className="hero-top"><div><p>{!todayProjection ? '周期尚未开始' : balance < 0 ? '今日已超支' : '今天还能花'}</p>
        <Money cents={Math.abs(balance)} className="hero-money" /></div>
        <div className="hero-date"><Sun size={28} strokeWidth={1.6} /><span>今天 {Number(app.today.slice(5, 7))}.{Number(app.today.slice(8))}</span></div></div>
      <p className="hero-detail">今日额度 <Money cents={todayProjection?.availableCents ?? 0} /> · 已花 <Money cents={todayProjection?.budgetSpentCents ?? 0} /></p>
      <div className="hero-meta"><div><span>{app.projection.overspendCents > 0 ? '周期超支' : '周期剩余'}</span><Money cents={app.projection.overspendCents || app.projection.remainingBudgetCents} /></div>
        <div><span>距发薪日</span><strong>{Math.max(0, daysBetween(app.today, app.cycle.expectedNextPayDate))} 天</strong></div></div>
    </section>
    <section className="home-section quick-section" aria-label="快速记账">
      <div className="section-title"><h2>快速记账</h2><Link to="/settings#projects">管理</Link></div>
      {quickPresets.length ? <div className="quick-grid" id="quick-presets">
        {visiblePresets.map(({ project, preset }) => <button key={preset.id} type="button" disabled={busy || !todayProjection}
          style={{ '--project-color': projectAppearance(project).color } as CSSProperties}
          aria-label={`${project.name} ${formatCents(preset.amountCents)}`} onClick={() => void quickAdd(project.id, preset.amountCents)}>
          <ProjectBadge project={project} /><span className="quick-name">{project.name}</span><strong>{formatCents(preset.amountCents)}</strong>
          {project.expenseType === 'fixed' && <small>不占预算</small>}
        </button>)}
        {quickPresets.length > 7 && <button type="button" className="quick-more" aria-label={expanded ? '收起快捷记账' : '展开全部快捷记账'}
          aria-expanded={expanded} aria-controls="quick-presets" onClick={() => setExpanded(!expanded)}>
          <span className="project-badge">{expanded ? <ChevronUp size={24} /> : <Grid3X3 size={24} />}</span>
          <span>{expanded ? '收起' : '全部'}</span><small>共 {quickPresets.length} 项</small>
        </button>}
      </div> : <div className="quick-empty"><CalendarDays size={24} strokeWidth={1.6} /><p>把常花的金额放在这里，下次一点就记。</p><Link to="/settings#projects">设置常用金额 <ChevronRight size={16} /></Link></div>}
      {error && <p className="form-error" role="alert">{error}</p>}
    </section>
    <section className="home-section calendar-section"><BudgetCalendar key={app.cycle.id} projection={app.projection} today={app.today} /></section>
    <section className="home-section today-section"><div className="section-title"><h2>今日账目</h2>
      {todayProjection && <Link to={`/day/${app.today}`}>全部 <ChevronRight size={15} /></Link>}</div>
      {todayEntries.length ? <div className="today-list">{todayEntries.slice(0, 3).map((entry) => {
        const project = projectMap.get(entry.projectId)
        return <Link key={entry.id} to={`/entry?transaction=${entry.id}`}><ProjectBadge project={project} />
          <span><strong>{project?.name ?? '已停用项目'}</strong><small>{entry.expenseType === 'fixed' ? '固定支出 · 不占预算' : '预算消费'}</small></span><Money cents={-entry.amountCents} /></Link>
      })}</div> : <EmptyState>今天还没有账目。<Link to="/entry">记下第一笔</Link></EmptyState>}
    </section>
    {undoEntry && <ToastUndo key={undoEntry.id} message={undoEntry.label} busy={busy} onUndo={undo} onExpire={clearUndo} />}
  </main>
}
