import { useState, type ChangeEvent, type FormEvent } from 'react'
import { ArrowDown, ArrowUp, Download, Pencil, Plus, Share2, Upload } from 'lucide-react'
import { useBudgetApp } from '../../app/BudgetAppContext'
import type { BackupPayloadV1 } from '../../data/backup'
import { parseBackup } from '../../data/backup'
import type { DateKey } from '../../domain/dateKey'
import type { ExpenseType, Project } from '../../domain/models'
import { formatCents, parseYuanToCents } from '../../domain/money'
import { PaydayPrompt } from '../cycle/PaydayPrompt'
import { ProjectBadge } from '../../components/ProjectBadge'
import { useSearchParams } from 'react-router-dom'

function shortDate(date: string) {
  return `${Number(date.slice(5, 7))}月${Number(date.slice(8, 10))}日`
}

function backupFilename(exportedAt: string, prefix = 'budget-calendar-backup') {
  const compact = exportedAt.replace(/[-:]/g, '').replace('T', '-').slice(0, 15)
  return `${prefix}-${compact}.json`
}

function downloadJson(payload: BackupPayloadV1, prefix?: string) {
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' })
  if (typeof URL.createObjectURL !== 'function') return
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = backupFilename(payload.exportedAt, prefix)
  anchor.click()
  URL.revokeObjectURL(url)
}

export function SettingsPage() {
  const app = useBudgetApp()
  const [searchParams] = useSearchParams()
  const paydaySource = `${app.cycle?.id}:${app.cycle?.expectedNextPayDate}`
  const [paydayDraft, setPaydayDraft] = useState<{ source: string; value: DateKey }>()
  const expectedDate = paydayDraft?.source === paydaySource
    ? paydayDraft.value : app.cycle?.expectedNextPayDate ?? app.today
  const [earlyCycle, setEarlyCycle] = useState(false)
  const [editing, setEditing] = useState<Project | 'new' | undefined>(() => searchParams.get('addProject') === '1' ? 'new' : undefined)
  const [preview, setPreview] = useState<BackupPayloadV1>()
  const [message, setMessage] = useState('')
  if (!app.cycle) return null

  if (earlyCycle) return <PaydayPrompt cycle={app.cycle} today={app.today} transactions={app.transactions}
    onReschedule={app.rescheduleExpectedPayday} onStartNextCycle={async (input) => {
      await app.startNextCycle(input)
      setEarlyCycle(false)
    }} initialMode="received" />

  async function savePayday(event: FormEvent) {
    event.preventDefault()
    try {
      await app.rescheduleExpectedPayday(expectedDate)
      setMessage('预计发薪日已保存')
    } catch (cause) {
      setMessage(cause instanceof Error ? cause.message : '保存失败')
    }
  }

  async function exportData() {
    const payload = await app.createBackup()
    downloadJson(payload)
  }

  async function chooseBackup(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    if (!file) return
    try {
      const text = await file.text()
      setPreview(parseBackup(text))
      setMessage('')
    } catch {
      setMessage('备份文件无效或已损坏')
    }
  }

  async function restore() {
    if (!preview) return
    const safetyBackup = await app.createBackup()
    downloadJson(safetyBackup, 'budget-calendar-before-restore')
    await app.restoreFromBackup(preview)
    setPreview(undefined)
    setMessage('数据已恢复')
  }

  return <main className="settings-page">
    <header className="simple-header"><p>数据仅保存在此设备</p><h1>设置</h1></header>

    <section className="settings-card">
      <div className="settings-title"><div><span>发薪周期</span><h2>当前周期</h2></div></div>
      <p className="cycle-range">{shortDate(app.cycle.startDate)} – {shortDate(app.cycle.endDate)}</p>
      <form className="inline-date-form" onSubmit={savePayday}>
        <label><span>预计发薪日</span><input type="date" value={expectedDate}
          onChange={(event) => setPaydayDraft({ source: paydaySource, value: event.target.value as DateKey })} /></label>
        <button type="submit">保存发薪日</button>
      </form>
      <button className="outline-button full-button" type="button" onClick={() => setEarlyCycle(true)}>工资已到账，开始新周期</button>
    </section>

    <section className="settings-card" id="projects">
      <div className="settings-title"><div><span>快速记账</span><h2>自定义项目</h2></div>
        <button type="button" onClick={() => setEditing('new')}><Plus size={17} />添加项目</button></div>
      <div className="project-settings-list">{app.projects.filter((project) => project.isActive).map((project, index, list) => {
        const amounts = app.presets.filter((preset) => preset.projectId === project.id)
          .map((preset) => formatCents(preset.amountCents)).join(' · ')
        return <article key={project.id}>
          <ProjectBadge project={project} />
          <div><strong>{project.name}</strong><small>{project.expenseType === 'fixed' ? '固定支出' : '预算消费'}{amounts ? ` · ${amounts}` : ''}</small></div>
          <div className="project-row-actions">
            <button disabled={index === 0} aria-label={`上移${project.name}`} onClick={() => void app.moveProject(project.id, -1)}><ArrowUp size={15} /></button>
            <button disabled={index === list.length - 1} aria-label={`下移${project.name}`} onClick={() => void app.moveProject(project.id, 1)}><ArrowDown size={15} /></button>
            <button aria-label={`编辑${project.name}`} onClick={() => setEditing(project)}><Pencil size={15} /></button>
            <button aria-label={`停用${project.name}`} onClick={() => void app.deactivateProject(project.id)}>停用</button>
          </div>
        </article>
      })}</div>
      {editing && <ProjectForm key={editing === 'new' ? 'new' : editing.id} project={editing === 'new' ? undefined : editing} onCancel={() => setEditing(undefined)}
        onSave={async (input) => { await app.saveProject(input); setEditing(undefined) }}
        presetAmounts={editing === 'new' ? [] : app.presets.filter((preset) => preset.projectId === editing.id).map((preset) => preset.amountCents)} />}
    </section>

    <section className="settings-card">
      <div className="settings-title"><div><span>本地数据</span><h2>备份与恢复</h2></div></div>
      <p className="backup-warning">备份文件包含个人消费数据，请妥善保存在 iCloud Drive。</p>
      <div className="backup-actions">
        <button className="outline-button" type="button" onClick={() => void exportData()}><Download size={17} />导出完整备份</button>
        <label className="outline-button"><Upload size={17} />选择备份文件<input type="file" accept="application/json" aria-label="选择备份文件" onChange={(event) => void chooseBackup(event)} /></label>
      </div>
      {preview && <div className="restore-preview"><h3>恢复前确认</h3><p>导出时间 {new Date(preview.exportedAt).toLocaleString('zh-CN')}</p>
        <div><span>周期 {preview.cycles.length} 个</span><span>账目 {preview.transactions.length} 笔</span><span>项目 {preview.projects.length} 个</span></div>
        <button className="danger-button" type="button" onClick={() => void restore()}>确认替换本机数据</button></div>}
    </section>

    <section className="settings-card install-card">
      <div className="settings-title"><div><span>主屏幕应用</span><h2>安装到 iPhone</h2></div><Share2 size={20} aria-hidden="true" /></div>
      <p>不需要安装额外环境，直接用 Safari 打开部署网址：</p>
      <strong>Safari → 分享 → 添加到主屏幕 → 作为网页 App 打开 → 添加</strong>
      <small>安装后可从桌面启动；账目仍只保存在这台 iPhone 的浏览器中。</small>
    </section>
    {message && <p className="settings-message" role="status">{message}</p>}
    <p className="version-note">预算日历 · 本地离线版</p>
  </main>
}

function ProjectForm({ project, presetAmounts, onSave, onCancel }: {
  project?: Project
  presetAmounts: number[]
  onSave(input: { id?: string; name: string; icon: string; color: string; expenseType: ExpenseType; presetAmountsCents: number[] }): Promise<void>
  onCancel(): void
}) {
  const [name, setName] = useState(project?.name ?? '')
  const [expenseType, setExpenseType] = useState<ExpenseType>(project?.expenseType ?? 'budget')
  const [amounts, setAmounts] = useState(presetAmounts)
  const [pendingAmount, setPendingAmount] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  function collectAmounts() {
    if (!pendingAmount.trim()) return amounts
    try {
      return [...new Set([...amounts, parseYuanToCents(pendingAmount.trim())])]
    } catch {
      throw new Error('请输入大于 0 的金额，最多两位小数')
    }
  }
  function addAmount() {
    try {
      setAmounts(collectAmounts())
      setPendingAmount('')
      setError('')
    } catch (cause) {
      setError((cause as Error).message)
    }
  }
  async function submit(event: FormEvent) {
    event.preventDefault()
    if (saving) return
    try {
      const presetAmountsCents = collectAmounts()
      setError('')
      setSaving(true)
      await onSave({ id: project?.id, name, icon: project?.icon ?? 'circle', color: project?.color ?? '#246bfe', expenseType, presetAmountsCents })
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : '保存失败')
    } finally {
      setSaving(false)
    }
  }
  return <form className="project-form" id="project-form" onSubmit={submit}>
    <h3>{project ? '编辑项目' : '添加项目'}</h3>
    <label><span>项目名称</span><input value={name} onChange={(event) => setName(event.target.value)} /></label>
    <div className="segment-control"><button type="button" aria-pressed={expenseType === 'budget'} onClick={() => setExpenseType('budget')}>预算消费</button>
      <button type="button" aria-pressed={expenseType === 'fixed'} onClick={() => setExpenseType('fixed')}>固定支出</button></div>
    <div className="preset-editor"><label><span>预设金额</span><input value={pendingAmount} onChange={(event) => setPendingAmount(event.target.value)} placeholder="例如 2.7" inputMode="decimal" /></label>
      <button className="outline-button" type="button" onClick={addAmount}>添加金额</button></div>
    {amounts.length > 0 && <div className="preset-chips">{amounts.map((amount) => <button type="button" key={amount}
      aria-label={`删除金额 ${formatCents(amount)}`} onClick={() => setAmounts(amounts.filter((value) => value !== amount))}>{formatCents(amount)} <span aria-hidden="true">×</span></button>)}</div>}
    <p>可添加多个常用金额，点击金额标签移除。</p>{error && <p className="form-error" role="alert">{error}</p>}
    <div><button className="secondary-button" type="button" disabled={saving} onClick={onCancel}>取消</button><button className="primary-button" type="submit" disabled={saving}>{saving ? '保存中…' : '保存项目'}</button></div>
  </form>
}
