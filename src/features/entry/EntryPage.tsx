import { useMemo, useState, type FormEvent } from 'react'
import { ArrowLeft } from 'lucide-react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { useBudgetApp } from '../../app/BudgetAppContext'
import type { DateKey } from '../../domain/dateKey'
import type { ExpenseType } from '../../domain/models'
import { formatCents, parseYuanToCents } from '../../domain/money'

export function EntryPage() {
  const app = useBudgetApp()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const transactionId = searchParams.get('transaction')
  const existing = app.transactions.find((entry) => entry.id === transactionId)
  const initialType = existing?.expenseType ?? 'budget'
  const initialProjects = app.projects.filter((project) => project.isActive && project.expenseType === initialType)
  const [expenseType, setExpenseType] = useState<ExpenseType>(initialType)
  const [projectId, setProjectId] = useState(existing?.projectId ?? initialProjects[0]?.id ?? '')
  const [amount, setAmount] = useState(existing ? (existing.amountCents / 100).toFixed(2) : '')
  const [date, setDate] = useState<DateKey>((existing?.localDate ?? searchParams.get('date') ?? app.today) as DateKey)
  const [note, setNote] = useState(existing?.note ?? '')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const visibleProjects = useMemo(
    () => app.projects.filter((project) => project.isActive && project.expenseType === expenseType),
    [app.projects, expenseType],
  )

  if (!app.cycle) return null
  const cycle = app.cycle

  function chooseType(nextType: ExpenseType) {
    setExpenseType(nextType)
    const first = app.projects.find((project) => project.isActive && project.expenseType === nextType)
    setProjectId(first?.id ?? '')
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    let amountCents: number
    try {
      amountCents = parseYuanToCents(amount)
    } catch {
      setError('请输入有效金额，最多两位小数')
      return
    }
    if (!projectId) {
      setError('请选择一个项目')
      return
    }
    try {
      setError('')
      setSaving(true)
      if (existing) {
        await app.editTransaction(existing.id, { projectId, expenseType, amountCents, localDate: date, note })
      } else {
        await app.addTransaction({ cycleId: cycle.id, projectId, expenseType, amountCents, localDate: date, note })
      }
      navigate(`/day/${date}`, { replace: true })
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : '保存失败，请重试')
    } finally {
      setSaving(false)
    }
  }

  return <main className="entry-page">
    <header className="page-header">
      <Link to={existing ? `/day/${existing.localDate}` : '/'} aria-label="返回"><ArrowLeft /></Link>
      <h1>{existing ? '编辑账目' : '记一笔'}</h1><span />
    </header>
    <form className="entry-form" onSubmit={submit}>
      <div className="segment-control" aria-label="支出类型">
        <button type="button" aria-pressed={expenseType === 'budget'} onClick={() => chooseType('budget')}>预算消费</button>
        <button type="button" aria-pressed={expenseType === 'fixed'} onClick={() => chooseType('fixed')}>固定支出</button>
      </div>

      <div className="amount-field">
        <label htmlFor="entry-amount">金额</label>
        <div><span>¥</span><input id="entry-amount" inputMode="decimal" value={amount}
          onChange={(event) => setAmount(event.target.value)} placeholder="0.00" /></div>
      </div>

      <section className="entry-section">
        <h2>选择项目</h2>
        {visibleProjects.length ? <div className="project-picker">{visibleProjects.map((project) =>
          <button key={project.id} type="button" className={projectId === project.id ? 'selected' : ''} aria-label={project.name}
            aria-pressed={projectId === project.id} onClick={() => setProjectId(project.id)}>
            <span style={{ backgroundColor: `${project.color}18`, color: project.color }}>{project.name.slice(0, 1)}</span>{project.name}
          </button>)}</div> : <p className="empty-state">此类型还没有项目，请先到设置添加。</p>}
      </section>

      {app.presets.some((preset) => preset.projectId === projectId) && <section className="entry-section">
        <h2>常用金额</h2>
        <div className="preset-row">{app.presets.filter((preset) => preset.projectId === projectId).map((preset) => {
          const project = app.projects.find((item) => item.id === preset.projectId)
          return <button key={preset.id} type="button" aria-label={`${project?.name ?? ''} ${formatCents(preset.amountCents)}`}
            onClick={() => setAmount((preset.amountCents / 100).toFixed(2))}>{formatCents(preset.amountCents)}</button>
        })}</div>
      </section>}

      <div className="entry-fields">
        <label><span>日期</span><input type="date" value={date} min={cycle.startDate} max={cycle.endDate}
          onChange={(event) => setDate(event.target.value as DateKey)} /></label>
        <label><span>备注</span><input value={note} onChange={(event) => setNote(event.target.value)} placeholder="可选" /></label>
      </div>
      {expenseType === 'fixed' && <p className="fixed-note">固定支出会被统计，但不会扣减可花预算。</p>}
      {error && <p className="form-error" role="alert">{error}</p>}
      <button className="primary-button entry-submit" disabled={saving} type="submit">{saving ? '正在保存…' : '保存账目'}</button>
    </form>
  </main>
}
