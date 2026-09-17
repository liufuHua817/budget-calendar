import { useMemo, useState, type FormEvent } from 'react'
import { addDays, suggestNextPayDate, type DateKey } from '../../domain/dateKey'
import type { Cycle, LedgerTransaction } from '../../domain/models'
import { parseYuanToCents } from '../../domain/money'

export interface PaydayPromptProps {
  cycle: Cycle
  today: DateKey
  transactions: LedgerTransaction[]
  onReschedule(date: DateKey): Promise<void>
  onStartNextCycle(input: {
    actualStartDate: DateKey
    expectedNextPayDate: DateKey
    budgetCents: number
  }): Promise<void>
  initialMode?: 'question' | 'received'
}

type Mode = 'question' | 'delay' | 'received'

function centsForInput(cents: number) {
  const yuan = Math.floor(cents / 100)
  const fraction = cents % 100
  return fraction ? `${yuan}.${String(fraction).padStart(2, '0').replace(/0$/, '')}` : String(yuan)
}

export function PaydayPrompt({ cycle, today, transactions, onReschedule, onStartNextCycle, initialMode = 'question' }: PaydayPromptProps) {
  const [mode, setMode] = useState<Mode>(initialMode)
  const [newExpectedDate, setNewExpectedDate] = useState<DateKey>(addDays(today, 1))
  const [actualStartDate, setActualStartDate] = useState<DateKey>(today)
  const [nextExpectedDate, setNextExpectedDate] = useState<DateKey>(suggestNextPayDate(today))
  const [budget, setBudget] = useState(centsForInput(cycle.totalBudgetCents))
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const movedCount = useMemo(
    () => transactions.filter((entry) => entry.localDate >= actualStartDate).length,
    [actualStartDate, transactions],
  )

  async function submitDelay(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (newExpectedDate <= today) {
      setError('新的预计发薪日必须晚于今天')
      return
    }
    try {
      setError('')
      setSaving(true)
      await onReschedule(newExpectedDate)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : '保存失败，请重试')
    } finally {
      setSaving(false)
    }
  }

  async function submitReceived(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    try {
      setError('')
      setSaving(true)
      await onStartNextCycle({
        actualStartDate,
        expectedNextPayDate: nextExpectedDate,
        budgetCents: parseYuanToCents(budget),
      })
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : '保存失败，请重试')
    } finally {
      setSaving(false)
    }
  }

  return (
    <main className="payday-page">
      <section className="payday-card">
        {mode === 'question' && <>
          <div className="payday-icon" aria-hidden="true">¥</div>
          <p className="eyebrow">预计发薪日已到</p>
          <h1>工资到账了吗？</h1>
          <p className="setup-intro">确认后才会结束当前周期，你的账目不会丢失。</p>
          <div className="choice-actions">
            <button className="primary-button" onClick={() => setMode('received')}>工资已到账</button>
            <button className="secondary-button" onClick={() => setMode('delay')}>还未到账</button>
          </div>
        </>}

        {mode === 'delay' && <form className="form-stack" onSubmit={submitDelay}>
          <button className="text-button" type="button" onClick={() => setMode('question')}>返回</button>
          <h1>延长当前周期</h1>
          <label><span>新的预计发薪日</span><input type="date" min={addDays(today, 1)}
            value={newExpectedDate} onChange={(event) => setNewExpectedDate(event.target.value as DateKey)} required /></label>
          {error && <p className="form-error" role="alert">{error}</p>}
          <button className="primary-button" disabled={saving} type="submit">延长当前周期</button>
        </form>}

        {mode === 'received' && <form className="form-stack" onSubmit={submitReceived}>
          <button className="text-button" type="button" onClick={() => setMode('question')}>返回</button>
          <h1>开始新发薪周期</h1>
          <label><span>工资实际到账日</span><input type="date" value={actualStartDate}
            onChange={(event) => {
              const value = event.target.value as DateKey
              setActualStartDate(value)
              setNextExpectedDate(suggestNextPayDate(value))
            }} required /></label>
          <label><span>下次预计发薪日</span><input type="date" value={nextExpectedDate}
            onChange={(event) => setNextExpectedDate(event.target.value as DateKey)} required /></label>
          <div className="field-group"><label htmlFor="next-cycle-budget">本周期可花预算</label><div className="money-input"><span>¥</span><input
            id="next-cycle-budget" value={budget} onChange={(event) => setBudget(event.target.value)} inputMode="decimal" required /></div></div>
          {movedCount > 0 && <p className="move-warning">当天已有 {movedCount} 笔账目，将转入新周期。</p>}
          {error && <p className="form-error" role="alert">{error}</p>}
          <button className="primary-button" disabled={saving} type="submit">确认开始新周期</button>
        </form>}
      </section>
    </main>
  )
}
