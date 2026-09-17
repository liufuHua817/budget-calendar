import { useState, type FormEvent } from 'react'
import { useBudgetApp } from '../../app/BudgetAppContext'
import { suggestNextPayDate, type DateKey } from '../../domain/dateKey'
import { parseYuanToCents } from '../../domain/money'

export function SetupPage() {
  const { today, createFirstCycle } = useBudgetApp()
  const [startDate, setStartDate] = useState<DateKey>(today)
  const [expectedNextPayDate, setExpectedNextPayDate] = useState<DateKey>(suggestNextPayDate(today))
  const [budget, setBudget] = useState('')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    try {
      setError('')
      setSaving(true)
      await createFirstCycle(startDate, expectedNextPayDate, parseYuanToCents(budget))
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : '保存失败，请重试')
    } finally {
      setSaving(false)
    }
  }

  return (
    <main className="setup-page">
      <section className="setup-card">
        <p className="eyebrow">欢迎使用</p>
        <h1>开始第一个发薪周期</h1>
        <p className="setup-intro">从这次工资到账日开始，按每天可用额度帮你控制花销。</p>
        <form onSubmit={submit} className="form-stack">
          <label>
            <span>本次工资到账日</span>
            <input type="date" value={startDate} onChange={(event) => {
              const value = event.target.value as DateKey
              setStartDate(value)
              setExpectedNextPayDate(suggestNextPayDate(value))
            }} required />
          </label>
          <label>
            <span>下次预计发薪日</span>
            <input type="date" value={expectedNextPayDate} min={startDate}
              onChange={(event) => setExpectedNextPayDate(event.target.value as DateKey)} required />
          </label>
          <div className="field-group">
            <label htmlFor="setup-budget">本周期可花预算</label>
            <div className="money-input"><span>¥</span><input id="setup-budget" value={budget}
              onChange={(event) => setBudget(event.target.value)} inputMode="decimal"
              placeholder="1500" aria-describedby="budget-hint" required /></div>
          </div>
          <p id="budget-hint" className="form-hint">建议：工资 - 房租 - 还款 - 固定账单 - 应急预留</p>
          {error && <p className="form-error" role="alert">{error}</p>}
          <button className="primary-button" disabled={saving} type="submit">
            {saving ? '正在创建…' : '开始记账'}
          </button>
        </form>
      </section>
    </main>
  )
}
