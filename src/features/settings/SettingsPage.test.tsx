import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, expect, test } from 'vitest'
import { MemoryRouter } from 'react-router-dom'
import { BudgetAppProvider } from '../../app/AppStore'
import { AppRoutes } from '../../app/router'
import { exportBackup } from '../../data/backup'
import { BudgetDatabase } from '../../data/db'
import { createFirstCycle } from '../../services/cycleService'

const databases: BudgetDatabase[] = []

async function setup() {
  const database = new BudgetDatabase(`settings-test-${crypto.randomUUID()}`)
  databases.push(database)
  await createFirstCycle(database, '2026-09-16', '2026-10-16', 150_000)
  return database
}

function renderSettings(database: BudgetDatabase) {
  return render(<BudgetAppProvider database={database} today={() => '2026-09-18'}>
    <MemoryRouter initialEntries={['/settings']}><AppRoutes /></MemoryRouter>
  </BudgetAppProvider>)
}

afterEach(async () => Promise.all(databases.splice(0).map((database) => database.delete())))

test('creates a custom project with multiple preset amounts', async () => {
  const database = await setup()
  renderSettings(database)
  const user = userEvent.setup()

  expect(await screen.findByRole('heading', { name: '设置' })).toBeInTheDocument()
  await user.click(screen.getByRole('button', { name: '添加项目' }))
  await user.type(screen.getByLabelText('项目名称'), '地铁')
  await user.type(screen.getByLabelText('预设金额'), '2.7')
  await user.click(screen.getByRole('button', { name: '添加金额' }))
  await user.type(screen.getByLabelText('预设金额'), '3.6')
  await user.click(screen.getByRole('button', { name: '保存项目' }))

  expect(await screen.findByText('地铁')).toBeInTheDocument()
  expect(screen.getByText(/¥2\.70 · ¥3\.60/)).toBeInTheDocument()
  await waitFor(async () => expect((await database.projectPresets.orderBy('sortOrder').toArray())
    .map((preset) => preset.amountCents)).toEqual([270, 360]))
})

test('edits the expected payday and opens an early new-cycle form', async () => {
  const database = await setup()
  renderSettings(database)
  const user = userEvent.setup()
  await screen.findByRole('heading', { name: '设置' })

  expect(screen.getByText('9月16日 – 10月15日')).toBeInTheDocument()
  await user.clear(screen.getByLabelText('预计发薪日'))
  await user.type(screen.getByLabelText('预计发薪日'), '2026-10-18')
  await user.click(screen.getByRole('button', { name: '保存发薪日' }))
  await waitFor(async () => expect((await database.cycles.toArray())[0].expectedNextPayDate).toBe('2026-10-18'))

  await user.click(await screen.findByRole('button', { name: '工资已到账，开始新周期' }))
  expect(screen.getByRole('heading', { name: '开始新发薪周期' })).toBeInTheDocument()
  await user.clear(screen.getByLabelText('下次预计发薪日'))
  await user.type(screen.getByLabelText('下次预计发薪日'), '2026-10-20')
  await user.click(screen.getByRole('button', { name: '确认开始新周期' }))
  await screen.findByRole('heading', { name: '设置' })
  expect(screen.getByLabelText('预计发薪日')).toHaveValue('2026-10-20')
})

test('previews a valid backup and warns that exports are unencrypted', async () => {
  const database = await setup()
  const payload = await exportBackup(database)
  renderSettings(database)
  const user = userEvent.setup()
  await screen.findByRole('heading', { name: '设置' })

  expect(screen.getByText('备份文件包含个人消费数据，请妥善保存在 iCloud Drive。')).toBeInTheDocument()
  const file = new File([JSON.stringify(payload)], 'backup.json', { type: 'application/json' })
  await user.upload(screen.getByLabelText('选择备份文件'), file)

  expect(await screen.findByText('恢复前确认')).toBeInTheDocument()
  expect(screen.getByText('周期 1 个')).toBeInTheDocument()
  expect(screen.getByText('账目 0 笔')).toBeInTheDocument()
  expect(screen.getByText('项目 0 个')).toBeInTheDocument()
})

test('shows the exact iPhone home-screen installation path', async () => {
  const database = await setup()
  renderSettings(database)

  expect(await screen.findByRole('heading', { name: '安装到 iPhone' })).toBeInTheDocument()
  expect(screen.getByText('Safari → 分享 → 添加到主屏幕 → 作为网页 App 打开 → 添加')).toBeInTheDocument()
})
