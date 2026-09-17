import type { BudgetDatabase } from './db'

// First-run setup only: existing ledgers are never populated or overwritten.
export async function seedDefaultProjects(db: BudgetDatabase) {
  if (await db.projects.count()) return
  const now = new Date().toISOString()
  const defaults = [
    { name: '餐饮', icon: 'utensils', color: '#B96B59', expenseType: 'budget' as const },
    { name: '交通', icon: 'train', color: '#60768F', expenseType: 'budget' as const },
    { name: '日用', icon: 'shop', color: '#9E8163', expenseType: 'budget' as const },
    { name: '其他', icon: 'circle', color: '#627C79', expenseType: 'budget' as const },
    { name: '房租', icon: 'house', color: '#807568', expenseType: 'fixed' as const },
  ]
  await db.projects.bulkAdd(defaults.map((project, sortOrder) => ({
    ...project, id: crypto.randomUUID(), sortOrder, isActive: true, createdAt: now, updatedAt: now,
  })))
}
