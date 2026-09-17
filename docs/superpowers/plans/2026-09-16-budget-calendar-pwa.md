# 发薪周期预算日历 PWA Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 构建并部署一个面向 iPhone 16 Pro Max、离线可用、账目只保存在本地的发薪周期动态预算日历 PWA。

**Architecture:** React 负责界面，纯 TypeScript 预算引擎负责所有金额计算，Dexie 封装 IndexedDB，业务服务协调周期、账目与备份。PWA 外壳通过 Service Worker 缓存静态资源；生产环境只部署静态文件，不包含远程数据库或业务后端。

**Tech Stack:** React、TypeScript、Vite、Dexie、Zod、React Router、Lucide React、Vitest、Testing Library、fake-indexeddb、vite-plugin-pwa、CSS/SVG 原生图表。

**Spec:** `docs/superpowers/specs/2026-09-16-budget-calendar-pwa-design.md`

## Global Constraints

- 周期从实际工资到账日开始，到下一次实际工资到账日前一天结束；预计发薪日只用于提前计算，不能自动创建下一期。
- 每 7 个周期日为一周，最后一周允许不足 7 天；所有分配按周期和周的实际天数计算。
- 所有金额在业务层和数据库中使用整数分，禁止用浮点数计算预算。
- 日期以设备本地 `YYYY-MM-DD` 保存，日期运算必须避免时区偏移。
- 日结余全部转入次日；周末结余加入下一周并按下一周实际天数均分。
- 当日预算消费超过今日可用时，对全部剩余日期重新分配剩余预算。
- 固定支出可记录和统计，但不得影响预算引擎。
- 账目只写入 IndexedDB，不上传远程服务。
- 第一版必须离线启动并支持离线增删改查。
- 第一版备份为带版本号的完整 JSON；恢复采用全量替换，不做合并。
- 主界面适配 iPhone 16 Pro Max 安全区域；主要点击目标至少 44 × 44 CSS 像素。
- 视觉使用已确认的蓝白浅色方案；第一版不实现深色模式。

## Target File Map

```text
budget-calendar/
├── public/
│   ├── icons/
│   │   ├── apple-touch-icon.png
│   │   ├── pwa-192x192.png
│   │   └── pwa-512x512.png
│   └── icon-source.svg
├── src/
│   ├── app/
│   │   ├── App.tsx
│   │   ├── AppStore.tsx
│   │   └── router.tsx
│   ├── components/
│   │   ├── AppShell.tsx
│   │   ├── BottomNav.tsx
│   │   ├── Money.tsx
│   │   ├── ToastUndo.tsx
│   │   └── EmptyState.tsx
│   ├── data/
│   │   ├── db.ts
│   │   ├── repositories.ts
│   │   └── backup.ts
│   ├── domain/
│   │   ├── models.ts
│   │   ├── dateKey.ts
│   │   ├── money.ts
│   │   └── budgetEngine.ts
│   ├── features/
│   │   ├── setup/SetupPage.tsx
│   │   ├── cycle/PaydayPrompt.tsx
│   │   ├── home/HomePage.tsx
│   │   ├── home/BudgetCalendar.tsx
│   │   ├── entry/EntryPage.tsx
│   │   ├── day/DayDetailPage.tsx
│   │   ├── history/HistoryPage.tsx
│   │   └── settings/SettingsPage.tsx
│   ├── services/
│   │   ├── cycleService.ts
│   │   └── transactionService.ts
│   ├── styles/
│   │   ├── tokens.css
│   │   └── global.css
│   ├── test/
│   │   └── setup.ts
│   └── main.tsx
├── tests/
│   └── acceptance.test.tsx
├── index.html
├── vite.config.ts
└── package.json
```

---

### Task 1: Project Foundation and Test Harness

**Files:**
- Create: `package.json`
- Create: `vite.config.ts`
- Create: `index.html`
- Create: `src/main.tsx`
- Create: `src/app/App.tsx`
- Create: `src/test/setup.ts`
- Create: `src/styles/tokens.css`
- Create: `src/styles/global.css`
- Test: `src/app/App.test.tsx`

**Interfaces:**
- Produces: Vite React TypeScript application with `npm test`, `npm run build`, and `npm run dev` commands.
- Produces: global CSS tokens consumed by every page.

- [ ] **Step 1: Scaffold the Vite React TypeScript app and install dependencies**

Run:

```bash
npm create vite@latest . -- --template react-ts
npm install dexie zod react-router-dom lucide-react
npm install -D vitest jsdom @testing-library/react @testing-library/jest-dom @testing-library/user-event fake-indexeddb vite-plugin-pwa
```

Expected: `package.json` contains React, Vite, TypeScript and the listed dependencies.

- [ ] **Step 2: Add deterministic scripts and Vitest configuration**

Set scripts in `package.json`:

```json
{
  "scripts": {
    "dev": "vite",
    "build": "tsc -b && vite build",
    "preview": "vite preview",
    "test": "vitest run",
    "test:watch": "vitest"
  }
}
```

Add to `vite.config.ts`:

```ts
/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    clearMocks: true,
  },
});
```

Add to `src/test/setup.ts`:

```ts
import '@testing-library/jest-dom/vitest';
import 'fake-indexeddb/auto';
```

- [ ] **Step 3: Write the failing application-shell test**

```tsx
import { render, screen } from '@testing-library/react';
import { App } from './App';

test('renders the product title', () => {
  render(<App />);
  expect(screen.getByRole('heading', { name: '预算日历' })).toBeInTheDocument();
});
```

- [ ] **Step 4: Run the test and verify failure**

Run: `npm test -- src/app/App.test.tsx`

Expected: FAIL because `App` does not yet render “预算日历”.

- [ ] **Step 5: Add the minimal app and visual tokens**

`src/app/App.tsx`:

```tsx
export function App() {
  return <h1>预算日历</h1>;
}
```

`src/styles/tokens.css`:

```css
:root {
  --color-bg: #f7f9fc;
  --color-surface: #ffffff;
  --color-text: #102449;
  --color-muted: #73809a;
  --color-primary: #246bfe;
  --color-danger: #ff6b4a;
  --color-success: #2f9e72;
  --radius-card: 18px;
  --safe-top: env(safe-area-inset-top, 0px);
  --safe-bottom: env(safe-area-inset-bottom, 0px);
}
```

- [ ] **Step 6: Verify foundation**

Run: `npm test -- src/app/App.test.tsx && npm run build`

Expected: test PASS and production build succeeds.

- [ ] **Step 7: Commit**

```bash
git add package.json package-lock.json vite.config.ts index.html src
git commit -m "chore: scaffold budget calendar app"
```

---

### Task 2: Domain Models, Date Keys, and Money Utilities

**Files:**
- Create: `src/domain/models.ts`
- Create: `src/domain/dateKey.ts`
- Create: `src/domain/dateKey.test.ts`
- Create: `src/domain/money.ts`
- Create: `src/domain/money.test.ts`

**Interfaces:**
- Produces: `DateKey`, `Cycle`, `Project`, `ProjectPreset`, `LedgerTransaction`, `DailyProjection`, `CycleProjection`.
- Produces: `addDays(date: DateKey, days: number): DateKey`, `daysBetween(start: DateKey, end: DateKey): number`, and `suggestNextPayDate(start: DateKey): DateKey`.
- Produces: `parseYuanToCents(input: string): number`, `formatCents(cents: number): string`, `distributeCents(total: number, count: number): number[]`.

- [ ] **Step 1: Define shared domain types**

`src/domain/models.ts`:

```ts
export type DateKey = `${number}-${number}-${number}`;
export type ExpenseType = 'budget' | 'fixed';
export type CycleStatus = 'active' | 'archived';

export interface Cycle {
  id: string;
  startDate: DateKey;
  endDate: DateKey;
  expectedNextPayDate: DateKey;
  totalBudgetCents: number;
  status: CycleStatus;
  createdAt: string;
  updatedAt: string;
}

export interface Project {
  id: string;
  name: string;
  icon: string;
  color: string;
  expenseType: ExpenseType;
  sortOrder: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ProjectPreset {
  id: string;
  projectId: string;
  amountCents: number;
  sortOrder: number;
}

export interface LedgerTransaction {
  id: string;
  cycleId: string;
  projectId: string;
  expenseType: ExpenseType;
  amountCents: number;
  localDate: DateKey;
  note: string;
  createdAt: string;
  updatedAt: string;
}

export interface DailyProjection {
  date: DateKey;
  dayIndex: number;
  weekIndex: number;
  baseBudgetCents: number;
  carryInCents: number;
  availableCents: number;
  budgetSpentCents: number;
  fixedSpentCents: number;
  carryOutCents: number;
  overspentCents: number;
}

export interface CycleProjection {
  cycleId: string;
  days: DailyProjection[];
  budgetSpentCents: number;
  fixedSpentCents: number;
  remainingBudgetCents: number;
  surplusCents: number;
  overspendCents: number;
}
```

- [ ] **Step 2: Write failing date and money tests**

```ts
expect(addDays('2026-09-16', 30)).toBe('2026-10-16');
expect(daysBetween('2026-09-16', '2026-10-15')).toBe(29);
expect(suggestNextPayDate('2026-01-31')).toBe('2026-02-28');
expect(suggestNextPayDate('2028-01-31')).toBe('2028-02-29');
expect(parseYuanToCents('53.58')).toBe(5358);
expect(formatCents(5358)).toBe('¥53.58');
expect(distributeCents(37500, 7)).toEqual([5358, 5357, 5357, 5357, 5357, 5357, 5357]);
expect(distributeCents(10, 3)).toEqual([4, 3, 3]);
```

- [ ] **Step 3: Run tests and verify failure**

Run: `npm test -- src/domain/dateKey.test.ts src/domain/money.test.ts`

Expected: FAIL because the utilities do not exist.

- [ ] **Step 4: Implement date-only arithmetic and integer money functions**

Use UTC internally only for arithmetic, never for persisted timestamps:

```ts
export function addDays(date: DateKey, days: number): DateKey {
  const [year, month, day] = date.split('-').map(Number);
  const value = new Date(Date.UTC(year, month - 1, day + days));
  return value.toISOString().slice(0, 10) as DateKey;
}

export function distributeCents(total: number, count: number): number[] {
  if (!Number.isInteger(total) || total < 0 || !Number.isInteger(count) || count <= 0) {
    throw new RangeError('Invalid cent distribution');
  }
  const base = Math.floor(total / count);
  const remainder = total % count;
  return Array.from({ length: count }, (_, index) => base + (index < remainder ? 1 : 0));
}
```

`parseYuanToCents` must accept only `0.01` through two decimal places and reject negative, empty, exponential and more-than-two-decimal inputs.

- [ ] **Step 5: Verify utilities**

Run: `npm test -- src/domain/dateKey.test.ts src/domain/money.test.ts`

Expected: all utility tests PASS.

- [x] **Step 6: Commit**

```bash
git add src/domain
git commit -m "feat: add date and money domain primitives"
```

---

### Task 3: Variable-Length Cycle Budget Allocation

**Files:**
- Create: `src/domain/budgetEngine.ts`
- Create: `src/domain/budgetEngine.test.ts`

**Interfaces:**
- Consumes: domain models, `addDays`, `distributeCents`.
- Produces: `createInitialAllocations(totalBudgetCents: number, dayCount: number): number[]`.
- Produces: `calculateCycleProjection(cycle: Cycle, transactions: LedgerTransaction[], asOfDate: DateKey): CycleProjection`.

- [ ] **Step 1: Write failing initial-allocation tests**

```ts
test('allocates exactly 150000 cents across the actual 30-day pay cycle', () => {
  const days = createInitialAllocations(150000, 30);
  expect(days).toHaveLength(30);
  expect(days.reduce((sum, value) => sum + value, 0)).toBe(150000);
  expect(days.slice(28).reduce((sum, value) => sum + value, 0)).toBe(10000);
});

test('gives remainder cents to earlier dates', () => {
  const days = createInitialAllocations(101, 30);
  expect(days.reduce((sum, value) => sum + value, 0)).toBe(101);
  expect(days[0]).toBeGreaterThanOrEqual(days[29]);
});

test.each([28, 29, 30, 31, 35])('supports a %i-day cycle', (dayCount) => {
  const days = createInitialAllocations(150000, dayCount);
  expect(days).toHaveLength(dayCount);
  expect(days.reduce((sum, value) => sum + value, 0)).toBe(150000);
});
```

- [ ] **Step 2: Verify failure**

Run: `npm test -- src/domain/budgetEngine.test.ts`

Expected: FAIL because `createInitialAllocations` is missing.

- [ ] **Step 3: Implement actual-day distribution**

```ts
export function createInitialAllocations(
  totalBudgetCents: number,
  dayCount: number,
): number[] {
  return distributeCents(totalBudgetCents, dayCount);
}
```

- [ ] **Step 4: Add a projection test with no transactions**

Create a cycle from `2026-09-16` through `2026-10-15` and calculate as of `2026-09-16`. Assert that all 30 dates exist, each day has zero spend, future dates do not pre-emptively roll unused money, the fifth week contains only two days, and projection totals equal the cycle budget.

- [ ] **Step 5: Implement minimal projection construction**

Derive `dayCount = daysBetween(cycle.startDate, cycle.endDate) + 1`. Reject an end date before the start date. Build exactly `dayCount` `DailyProjection` rows from the cycle dates, actual-day allocations, and per-date budget/fixed transaction sums.

- [ ] **Step 6: Verify allocation and empty projection**

Run: `npm test -- src/domain/budgetEngine.test.ts`

Expected: all tests PASS.

- [ ] **Step 7: Commit**

```bash
git add src/domain/budgetEngine.ts src/domain/budgetEngine.test.ts
git commit -m "feat: allocate variable pay cycle budget"
```

---

### Task 4: Carryover, Overspending, and Deterministic Recalculation

**Files:**
- Modify: `src/domain/budgetEngine.ts`
- Modify: `src/domain/budgetEngine.test.ts`

**Interfaces:**
- Keeps: `calculateCycleProjection(cycle, transactions, asOfDate)` signature unchanged.
- Produces: complete daily projection and cycle totals for all budget rules.

- [ ] **Step 1: Add failing daily-carry test**

Create a 30-day, 150000-cent cycle; spend 3000 cents on day 1. Assert day 1 carry-out is 2000 and day 2 available equals day 2 base plus 2000.

- [ ] **Step 2: Add failing weekly-carry test**

Spend 28000 cents during week 1. Assert week 1 leaves 7000 cents and the sum of week 2 base allocations becomes 42000 cents, distributed with earlier-cent priority. Add a second case where week 4 leaves 7000 cents and the two-day final week receives its original 10000 cents plus the 7000-cent carry, divided across two actual dates.

- [ ] **Step 3: Add failing overspend-rebalance test**

Spend 6000 cents on day 1, 1000 cents above its available amount. Assert carry-out is zero and days 2—30 sum to `150000 - 6000`.

- [ ] **Step 4: Add failing fixed-expense and exhaustion tests**

Assert a 500000-cent fixed expense does not alter daily budgets. Assert cumulative budget spending above 150000 makes all future available amounts zero and reports the exact cycle overspend.

- [ ] **Step 5: Run tests and verify rule failures**

Run: `npm test -- src/domain/budgetEngine.test.ts`

Expected: new carryover and overspend tests FAIL.

- [ ] **Step 6: Implement the sequential calculator**

Use one mutable allocation array and process days in order. Only dates earlier than `asOfDate` are closed and allowed to roll a positive remainder forward. The `asOfDate` row shows live remainder without carrying it into tomorrow. An overspend on or before `asOfDate` still replans future dates immediately. For archived cycles, callers pass `addDays(cycle.endDate, 1)` so the last day closes.

```ts
const dayCount = daysBetween(cycle.startDate, cycle.endDate) + 1;
const allocations = createInitialAllocations(cycle.totalBudgetCents, dayCount);
let carryInCents = 0;
let cumulativeBudgetSpent = 0;

for (let index = 0; index < dayCount; index += 1) {
  const available = Math.max(0, allocations[index] + carryInCents);
  const budgetSpent = budgetSpentByDate.get(dates[index]) ?? 0;
  cumulativeBudgetSpent += budgetSpent;

  if (budgetSpent > available) {
    const remaining = Math.max(0, cycle.totalBudgetCents - cumulativeBudgetSpent);
    const futureCount = dayCount - index - 1;
    if (futureCount > 0) {
      const future = distributeCents(remaining, futureCount);
      allocations.splice(index + 1, future.length, ...future);
    }
    carryInCents = 0;
  } else {
    const remainder = available - budgetSpent;
    const isWeekEnd = index % 7 === 6;
    if (isWeekEnd && index < dayCount - 1) {
      const nextWeekStart = index + 1;
      const nextWeekLength = Math.min(7, dayCount - nextWeekStart);
      const nextWeekTotal = allocations
        .slice(nextWeekStart, nextWeekStart + nextWeekLength)
        .reduce((sum, value) => sum + value, 0) + remainder;
      allocations.splice(
        nextWeekStart,
        nextWeekLength,
        ...distributeCents(nextWeekTotal, nextWeekLength),
      );
      carryInCents = 0;
    } else {
      carryInCents = remainder;
    }
  }
}
```

Derive cycle totals only from transactions and the cycle budget.

- [ ] **Step 7: Add edit-order determinism test**

Pass the same transactions in different array orders and assert deep equality of projections.

- [ ] **Step 8: Verify the complete budget engine**

Run: `npm test -- src/domain/budgetEngine.test.ts`

Expected: all engine tests PASS.

- [ ] **Step 9: Commit**

```bash
git add src/domain/budgetEngine.ts src/domain/budgetEngine.test.ts
git commit -m "feat: implement dynamic budget carryover"
```

---

### Task 5: IndexedDB Schema and Repositories

**Files:**
- Create: `src/data/db.ts`
- Create: `src/data/repositories.ts`
- Create: `src/data/repositories.test.ts`

**Interfaces:**
- Produces: `BudgetDatabase extends Dexie` with cycles, projects, projectPresets, transactions and settings tables.
- Produces: repository functions `getActiveCycle`, `getCycleForDate`, `getTransactionsForCycle`, `replaceAllData`, and typed CRUD helpers.

- [ ] **Step 1: Write failing repository round-trip test**

Use a unique in-memory database name. Insert one cycle, project, preset and transaction, then read them back and assert exact integer amounts and date keys.

- [ ] **Step 2: Verify failure**

Run: `npm test -- src/data/repositories.test.ts`

Expected: FAIL because database modules do not exist.

- [ ] **Step 3: Define the Dexie schema**

```ts
export class BudgetDatabase extends Dexie {
  cycles!: Table<Cycle, string>;
  projects!: Table<Project, string>;
  projectPresets!: Table<ProjectPreset, string>;
  transactions!: Table<LedgerTransaction, string>;
  settings!: Table<{ key: string; value: unknown }, string>;

  constructor(name = 'budget-calendar') {
    super(name);
    this.version(1).stores({
      cycles: '&id, startDate, endDate, expectedNextPayDate, status',
      projects: '&id, expenseType, sortOrder, isActive',
      projectPresets: '&id, projectId, sortOrder',
      transactions: '&id, cycleId, projectId, localDate, [cycleId+localDate]',
      settings: '&key',
    });
  }
}
```

- [ ] **Step 4: Implement repositories and transactional replacement**

`replaceAllData` must use `db.transaction('rw', ...)`, clear every table, then bulk-add validated rows. If any write fails, Dexie must roll back all tables.

- [ ] **Step 5: Add rollback test**

Create existing data, attempt replacement with duplicate primary keys, assert rejection and assert existing data remains unchanged.

- [ ] **Step 6: Verify repositories**

Run: `npm test -- src/data/repositories.test.ts`

Expected: round-trip and rollback tests PASS.

- [ ] **Step 7: Commit**

```bash
git add src/data
git commit -m "feat: add local indexeddb persistence"
```

---

### Task 6: Cycle Lifecycle Service

**Files:**
- Create: `src/services/cycleService.ts`
- Create: `src/services/cycleService.test.ts`

**Interfaces:**
- Consumes: `BudgetDatabase`, date utilities and cycle types.
- Produces: `createFirstCycle(db, startDate, expectedNextPayDate, totalBudgetCents): Promise<Cycle>`.
- Produces: `getCycleAttentionState(cycle, today): 'current' | 'payday-confirmation-required'`.
- Produces: `rescheduleExpectedPayday(db, cycleId, expectedNextPayDate): Promise<Cycle>`.
- Produces: `confirmPaydayAndStartNextCycle(db, input): Promise<{ archived: Cycle; active: Cycle }>`.

- [ ] **Step 1: Write failing first-cycle test**

Assert that start `2026-09-16` and expected next payday `2026-10-16` produce end `2026-10-15`, status `active`, and exact 150000-cent budget. Assert that an expected payday on or before the start date is rejected.

- [ ] **Step 2: Write failing no-automatic-rollover test**

Given an active cycle with expected payday `2026-10-16`, call `getCycleAttentionState` for `2026-10-15` and `2026-10-16`. Assert the results are `current` then `payday-confirmation-required`, and assert the database still contains only the original active cycle.

- [ ] **Step 3: Write failing delayed-payday test**

Reschedule the expected payday from `2026-10-16` to `2026-10-18`. Assert the active cycle end becomes `2026-10-17`, no new cycle is created, and a projection now contains 32 actual days.

- [ ] **Step 4: Write failing confirmed-payday tests**

Cover on-time (`2026-10-16`), early (`2026-10-15`) and late (`2026-10-18`) salary arrival. For each case, assert the old cycle ends the day before the actual start, becomes archived, the new active cycle starts on the actual date with the explicitly confirmed budget and later expected payday, and no surplus or overspend changes the new budget. Add an existing transaction on the new start date and assert its `cycleId` is moved to the new cycle in the same transaction.

- [ ] **Step 5: Implement explicit salary-cycle lifecycle**

Generate IDs using `crypto.randomUUID()`. `createFirstCycle` and `rescheduleExpectedPayday` calculate `endDate` as `addDays(expectedNextPayDate, -1)`. `confirmPaydayAndStartNextCycle` validates that the actual start is after the old start, that the new expected payday is after the actual start, and that all cent values are positive integers. In one Dexie transaction it must:

1. set the old cycle `endDate` to `addDays(actualStartDate, -1)` and status to `archived`;
2. create the new active cycle with `endDate = addDays(expectedNextPayDate, -1)`;
3. update transactions whose `cycleId` is the old cycle and whose `localDate >= actualStartDate` to the new cycle ID;
4. persist the confirmed budget as the next default budget setting.

Never create a cycle from the current date alone, never fill skipped periods, and never transfer previous surplus or overspend.

- [ ] **Step 6: Verify lifecycle tests**

Run: `npm test -- src/services/cycleService.test.ts`

Expected: all cycle tests PASS.

- [ ] **Step 7: Commit**

```bash
git add src/services/cycleService.ts src/services/cycleService.test.ts
git commit -m "feat: manage explicit salary cycles"
```

---

### Task 7: Transaction Service and Five-Second Undo

**Files:**
- Create: `src/services/transactionService.ts`
- Create: `src/services/transactionService.test.ts`

**Interfaces:**
- Produces: `recordTransaction(db, input): Promise<LedgerTransaction>`.
- Produces: `updateTransaction(db, id, patch): Promise<LedgerTransaction>`.
- Produces: `deleteTransaction(db, id): Promise<void>`.
- Produces: `createUndoHandle(db, transactionId, ttlMs): { undo(): Promise<boolean>; expiresAt: number }`.

- [ ] **Step 1: Write failing validation tests**

Assert rejection for zero, negative, fractional-cent, unknown project and date outside the referenced cycle.

- [ ] **Step 2: Write failing snapshot-type test**

Record a budget transaction, change the project default type to fixed, and assert the stored transaction remains budget type.

- [ ] **Step 3: Write failing undo-expiry test**

Use fake timers. Assert undo before 5000 ms deletes the row, second undo returns false, and undo after 5000 ms returns false without deleting.

- [ ] **Step 4: Implement validated CRUD and undo handle**

Use `performance.now()` or injected clock for expiry tests. Every write must preserve integer cents and update ISO timestamps.

- [ ] **Step 5: Verify service tests**

Run: `npm test -- src/services/transactionService.test.ts`

Expected: all transaction tests PASS.

- [ ] **Step 6: Commit**

```bash
git add src/services/transactionService.ts src/services/transactionService.test.ts
git commit -m "feat: add transaction service and undo"
```

---

### Task 8: Versioned Backup and Transactional Restore

**Files:**
- Create: `src/data/backup.ts`
- Create: `src/data/backup.test.ts`

**Interfaces:**
- Produces: `BackupPayloadV1` with `format: 'budget-calendar-backup'` and `version: 1`.
- Produces: `exportBackup(db): Promise<BackupPayloadV1>`.
- Produces: `parseBackup(text: string): BackupPayloadV1`.
- Produces: `restoreBackup(db, payload): Promise<void>`.

- [ ] **Step 1: Define Zod backup schemas and failing parse tests**

Test valid V1 payload, wrong format, unsupported version, negative cents, malformed dates, expected payday not after cycle start, active-cycle end not equal to the day before expected payday, unknown project references and transaction dates outside their cycles.

- [ ] **Step 2: Verify parser tests fail**

Run: `npm test -- src/data/backup.test.ts`

Expected: FAIL because backup functions do not exist.

- [ ] **Step 3: Implement export and parse**

Export fields:

```ts
{
  format: 'budget-calendar-backup',
  version: 1,
  exportedAt: new Date().toISOString(),
  cycles,
  projects,
  projectPresets,
  transactions,
  settings,
}
```

After structural parsing, validate cross-table IDs and date ranges before returning the payload.

- [ ] **Step 4: Implement safe restore**

Create an in-memory pre-restore export, call `replaceAllData` in one transaction, then recalculate every cycle with `calculateCycleProjection`. If validation or replacement fails, the original database remains unchanged.

- [ ] **Step 5: Add full round-trip and rejection tests**

Export populated data, clear tables, restore and assert exact deep equality. Attempt malformed restore and assert preexisting data is intact.

- [ ] **Step 6: Verify backup tests**

Run: `npm test -- src/data/backup.test.ts`

Expected: all backup tests PASS.

- [ ] **Step 7: Commit**

```bash
git add src/data/backup.ts src/data/backup.test.ts
git commit -m "feat: add versioned local backups"
```

---

### Task 9: App Store, Routing, Setup, and Shell

**Files:**
- Create: `src/app/AppStore.tsx`
- Create: `src/app/router.tsx`
- Create: `src/components/AppShell.tsx`
- Create: `src/components/BottomNav.tsx`
- Create: `src/components/Money.tsx`
- Create: `src/components/EmptyState.tsx`
- Create: `src/features/setup/SetupPage.tsx`
- Create: `src/features/cycle/PaydayPrompt.tsx`
- Modify: `src/app/App.tsx`
- Test: `src/features/setup/SetupPage.test.tsx`
- Test: `src/features/cycle/PaydayPrompt.test.tsx`

**Interfaces:**
- Produces: `useBudgetApp()` with loaded cycle, projects, presets, transactions, projection and mutation actions.
- Produces routes: `/setup`, `/`, `/entry`, `/day/:date`, `/history`, `/settings`.

- [ ] **Step 1: Write failing first-run routing test**

With an empty database, render the router and assert the setup screen asks for actual salary date, expected next payday and budget. With a current active cycle, assert it redirects to the home page.

- [ ] **Step 2: Verify failure**

Run: `npm test -- src/features/setup/SetupPage.test.tsx`

Expected: FAIL because app store and routes do not exist.

- [ ] **Step 3: Implement the app store contract**

Expose:

```ts
interface BudgetAppActions {
  refresh(): Promise<void>;
  createFirstCycle(
    startDate: DateKey,
    expectedNextPayDate: DateKey,
    budgetCents: number,
  ): Promise<void>;
  rescheduleExpectedPayday(expectedNextPayDate: DateKey): Promise<void>;
  startNextCycle(input: {
    actualStartDate: DateKey;
    expectedNextPayDate: DateKey;
    budgetCents: number;
  }): Promise<void>;
  addTransaction(input: RecordTransactionInput): Promise<LedgerTransaction>;
  editTransaction(id: string, patch: UpdateTransactionInput): Promise<void>;
  removeTransaction(id: string): Promise<void>;
}
```

Every mutation awaits the database write and then calls `refresh()` so projection state is always derived from persisted data.

- [ ] **Step 4: Write the failing payday-confirmation tests**

At the expected payday, assert the home route shows “工资到账了吗？” instead of silently creating a cycle. Assert “还未到账” requires a later expected date and calls `rescheduleExpectedPayday`. Assert “工资已到账” requires the actual date, this-period budget and next expected payday, warns when today already has transactions, then calls `startNextCycle`.

- [ ] **Step 5: Build the setup form, payday prompt and shell**

Use native date inputs, yuan input parsed through `parseYuanToCents`, one primary submit button, safe-area padding and the four-item bottom navigation. Under the budget field show `可花预算 = 工资 - 房租 - 还款 - 固定账单 - 应急预留`. The payday prompt must not provide a dismiss action that would expose an unconfirmed daily budget.

- [ ] **Step 6: Verify setup and payday flows**

Run: `npm test -- src/features/setup/SetupPage.test.tsx src/features/cycle/PaydayPrompt.test.tsx`

Expected: first-run, active-cycle and explicit payday-confirmation tests PASS.

- [ ] **Step 7: Commit**

```bash
git add src/app src/components src/features/setup src/features/cycle
git commit -m "feat: add app shell and salary cycle setup"
```

---

### Task 10: Hybrid Home Screen and Variable-Length Calendar

**Files:**
- Create: `src/features/home/HomePage.tsx`
- Create: `src/features/home/BudgetCalendar.tsx`
- Create: `src/features/home/HomePage.test.tsx`
- Create: `src/components/ToastUndo.tsx`

**Interfaces:**
- Consumes: `useBudgetApp()` state/actions and `CycleProjection`.
- Produces: selected high-fidelity C layout.
- Produces: one-tap preset entry with visible 5-second undo.

- [ ] **Step 1: Write failing summary and calendar tests**

Render a known 30-day projection and assert exact text for `今日可用 ¥62.17`, `周期剩余 ¥1,326.40`, `剩余28天`, all 30 day cells, a two-cell final week, and current-day highlight. Repeat with a 31-day projection to prove rendering is data-driven.

- [ ] **Step 2: Write failing one-tap test**

Click “地铁 ¥3.60”; assert `addTransaction` receives today, project ID, budget type and 360 cents exactly once; assert undo toast appears.

- [ ] **Step 3: Verify failure**

Run: `npm test -- src/features/home/HomePage.test.tsx`

Expected: FAIL because home components do not exist.

- [ ] **Step 4: Implement the home layout**

Use semantic sections in this order: summary, quick presets, 7-column variable-row calendar, today list. Each day cell is a link to `/day/YYYY-MM-DD`. Use CSS Grid with `grid-template-columns: repeat(7, 1fr)` and render one cell for every projected date without filler budget days.

- [ ] **Step 5: Implement undo toast behavior**

Show a fixed-bottom toast above navigation, keep the undo button active for exactly 5000 ms, and clear the timer on unmount.

- [ ] **Step 6: Verify home tests**

Run: `npm test -- src/features/home/HomePage.test.tsx`

Expected: summary, variable-length grid, quick entry and undo tests PASS.

- [ ] **Step 7: Commit**

```bash
git add src/features/home src/components/ToastUndo.tsx
git commit -m "feat: build hybrid budget home screen"
```

---

### Task 11: Manual Entry and Day Detail

**Files:**
- Create: `src/features/entry/EntryPage.tsx`
- Create: `src/features/entry/EntryPage.test.tsx`
- Create: `src/features/day/DayDetailPage.tsx`
- Create: `src/features/day/DayDetailPage.test.tsx`

**Interfaces:**
- Consumes: app store CRUD actions, projects, presets and projection.
- Produces: full manual transaction create/edit form.
- Produces: date detail with budget and fixed sections.

- [ ] **Step 1: Write failing manual-entry tests**

Assert default type budget, type switch fixed, preset selection, custom amount entry, default today, past-date selection, note entry, validation message and exact cent conversion on save.

- [ ] **Step 2: Write failing date-detail tests**

Assert display of base budget, carry-in, available, budget spend, fixed spend and remainder/overspend. Assert budget and fixed transactions render in separate groups.

- [ ] **Step 3: Verify failure**

Run: `npm test -- src/features/entry/EntryPage.test.tsx src/features/day/DayDetailPage.test.tsx`

Expected: FAIL because pages do not exist.

- [ ] **Step 4: Implement manual entry**

Use large amount display, numeric keypad-friendly input (`inputMode="decimal"`), expense-type segmented control, project grid, native date input, note input and one blue save button. Disable save while a write is pending.

- [ ] **Step 5: Implement day detail and edit/delete actions**

Link edit to `/entry?transaction=<id>`. Require a confirmation dialog before delete. After edit/delete, navigate back to the same day so recalculated values are visible.

- [ ] **Step 6: Verify entry and detail tests**

Run: `npm test -- src/features/entry/EntryPage.test.tsx src/features/day/DayDetailPage.test.tsx`

Expected: all tests PASS.

- [ ] **Step 7: Commit**

```bash
git add src/features/entry src/features/day
git commit -m "feat: add manual entry and daily details"
```

---

### Task 12: Cycle History and Statistics

**Files:**
- Create: `src/features/history/HistoryPage.tsx`
- Create: `src/features/history/HistoryPage.test.tsx`

**Interfaces:**
- Consumes: cycles, projects, transactions and `calculateCycleProjection`.
- Produces: current/historical cycle cards, variable week bars, category donut and fixed-expense summary.

- [ ] **Step 1: Write failing summary tests**

Assert exact rendering of budget 1500.00, spent 173.60, surplus 86.40 or overspend, fixed expense 5000.00 and “不占预算”.

- [ ] **Step 2: Write failing aggregation tests**

Provide transactions for three projects across a 30-day cycle. Assert five week labels render, the final label represents only two days, and category totals sum to the exact budget spending total.

- [ ] **Step 3: Verify failure**

Run: `npm test -- src/features/history/HistoryPage.test.tsx`

Expected: FAIL because history page does not exist.

- [ ] **Step 4: Implement native charts without a chart dependency**

Use CSS grid bars with height percentage based on the maximum week spend. Use an accessible SVG donut with `stroke-dasharray`; render a text legend containing exact cent-formatted totals so information does not depend on color.

- [ ] **Step 5: Add no-spending state**

A cycle with no spending shows its actual dates, zero spending and full surplus without drawing misleading category segments. Because cycles are never auto-created, no `empty` cycle status exists.

- [ ] **Step 6: Verify statistics tests**

Run: `npm test -- src/features/history/HistoryPage.test.tsx`

Expected: summary, chart data and empty-state tests PASS.

- [ ] **Step 7: Commit**

```bash
git add src/features/history
git commit -m "feat: add cycle history and statistics"
```

---

### Task 13: Quick Project Management and Backup UI

**Files:**
- Create: `src/features/settings/SettingsPage.tsx`
- Create: `src/features/settings/SettingsPage.test.tsx`
- Modify: `src/app/AppStore.tsx`

**Interfaces:**
- Consumes: project/preset repositories and backup APIs.
- Consumes: active cycle and explicit salary-cycle actions from `useBudgetApp()`.
- Produces: create/edit/deactivate/reorder project flows.
- Produces: current expected payday editing and early “工资已到账” entry point.
- Produces: browser download for export and file-picker restore flow.

- [ ] **Step 1: Write failing project-management tests**

Assert project rows show multiple amounts, type, edit control and 44px controls. Add a project with two presets, reorder it, deactivate it and assert it disappears from home shortcuts but remains resolvable for history.

- [ ] **Step 2: Write failing backup UI tests**

Assert export creates a JSON Blob named `budget-calendar-backup-YYYYMMDD-HHmmss.json`. Assert restore previews export time, cycle count, transaction count and project count before confirmation.

- [ ] **Step 3: Write failing salary-cycle settings tests**

Assert settings shows the active cycle range and expected payday. Changing the expected payday must call `rescheduleExpectedPayday`; tapping “工资已到账，开始新周期” must open the same validated form used by `PaydayPrompt`, allowing an early actual payday without automatically creating anything.

- [ ] **Step 4: Verify failure**

Run: `npm test -- src/features/settings/SettingsPage.test.tsx`

Expected: FAIL because settings page does not exist.

- [ ] **Step 5: Implement project and preset editing**

Use explicit up/down controls for accessible ordering instead of drag-only behavior. Validate unique nonempty project names and positive integer-cent presets. Allow the same project to contain 270 and 360 cents.

- [ ] **Step 6: Implement salary-cycle controls and export/restore UI**

Reuse the payday form component so date and budget validation stays identical between automatic attention state and settings. Create the Blob from `JSON.stringify(payload, null, 2)`. Before restore, parse and show counts; after confirmation, create a pre-restore download, perform transactional restore, refresh app state and navigate home.

- [ ] **Step 7: Add the unencrypted-backup warning**

Place this exact copy next to export: `备份文件包含个人消费数据，请妥善保存在 iCloud Drive。`

- [ ] **Step 8: Verify settings tests**

Run: `npm test -- src/features/settings/SettingsPage.test.tsx`

Expected: project management and backup tests PASS.

- [ ] **Step 9: Commit**

```bash
git add src/features/settings src/app/AppStore.tsx
git commit -m "feat: add project settings and backup controls"
```

---

### Task 14: PWA Manifest, Offline Shell, and iPhone Assets

**Files:**
- Modify: `vite.config.ts`
- Modify: `index.html`
- Create: `public/icon-source.svg`
- Create: `public/icons/apple-touch-icon.png`
- Create: `public/icons/pwa-192x192.png`
- Create: `public/icons/pwa-512x512.png`
- Create: `src/app/PwaUpdatePrompt.tsx`
- Test: `src/app/PwaUpdatePrompt.test.tsx`

**Interfaces:**
- Produces: installable PWA manifest and offline app-shell cache.
- Produces: non-disruptive update prompt that never refreshes during an active form submission.

- [ ] **Step 1: Add PWA configuration**

Configure `VitePWA`:

```ts
VitePWA({
  registerType: 'prompt',
  includeAssets: ['icons/apple-touch-icon.png'],
  manifest: {
    name: '预算日历',
    short_name: '预算日历',
    description: '发薪周期动态预算与快速记账',
    theme_color: '#f7f9fc',
    background_color: '#f7f9fc',
    display: 'standalone',
    start_url: '/',
    icons: [
      { src: '/icons/pwa-192x192.png', sizes: '192x192', type: 'image/png' },
      { src: '/icons/pwa-512x512.png', sizes: '512x512', type: 'image/png' },
    ],
  },
  workbox: {
    navigateFallback: '/index.html',
    globPatterns: ['**/*.{js,css,html,svg,png}'],
  },
})
```

- [ ] **Step 2: Create deterministic app icons**

Create a square SVG with deep navy background and a white seven-column calendar mark plus a small coin dot; do not encode a fixed row count. Convert it without changing artwork:

```bash
convert -background none public/icon-source.svg -resize 180x180 public/icons/apple-touch-icon.png
convert -background none public/icon-source.svg -resize 192x192 public/icons/pwa-192x192.png
convert -background none public/icon-source.svg -resize 512x512 public/icons/pwa-512x512.png
```

- [ ] **Step 3: Add iPhone metadata**

`index.html` must include viewport cover and the touch icon:

```html
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<meta name="theme-color" content="#f7f9fc">
<link rel="apple-touch-icon" href="/icons/apple-touch-icon.png">
```

- [ ] **Step 4: Write and implement update-prompt test**

Mock `useRegisterSW`. Assert the prompt renders only when `needRefresh` is true and the user must tap “安全更新” before `updateServiceWorker(true)` is called.

- [ ] **Step 5: Verify production PWA output**

Run:

```bash
npm test -- src/app/PwaUpdatePrompt.test.tsx
npm run build
test -f dist/manifest.webmanifest
test -f dist/sw.js
```

Expected: tests PASS; manifest and service worker exist.

- [ ] **Step 6: Commit**

```bash
git add vite.config.ts index.html public src/app/PwaUpdatePrompt.tsx src/app/PwaUpdatePrompt.test.tsx
git commit -m "feat: make budget calendar installable offline"
```

---

### Task 15: Integrated Acceptance, Accessibility, and Production Deployment

**Files:**
- Create: `tests/acceptance.test.tsx`
- Create: `docs/iphone-installation.md`
- Create: `docs/release-checklist.md`
- Modify: `src/styles/global.css`
- Modify: `README.md`

**Interfaces:**
- Consumes: complete application.
- Produces: verified production build, stable HTTPS deployment and iPhone installation instructions.

- [ ] **Step 1: Write integrated acceptance tests**

Cover this exact workflow in Testing Library with fake IndexedDB:

1. Create a cycle starting on salary date 2026-09-16, with expected next payday 2026-10-16 and 1500.00 budget; verify the projection contains 30 days.
2. Create Metro project with 2.70 and 3.60 presets.
3. One-tap 3.60 and verify today totals.
4. Add fixed expense 5000.00 and verify budget remains unchanged.
5. Add an overspending transaction and verify future daily budget decreases.
6. Edit the past transaction and verify all future projections update.
7. Reach 2026-10-16 and verify no cycle is created until salary is confirmed.
8. Choose “还未到账”, move expected payday to 2026-10-18 and verify the current cycle extends and recalculates.
9. Confirm salary on 2026-10-18, set the next expected payday and verify the old cycle archives independently while the new cycle receives exactly the confirmed budget.
10. Export, clear database, restore and verify exact data equality.

- [ ] **Step 2: Run full tests and fix only observed failures**

Run: `npm test`

Expected: all unit, component and acceptance tests PASS with no unhandled promise rejection.

- [ ] **Step 3: Apply final accessibility and safe-area checks**

Ensure focus indicators are visible, icon-only buttons have Chinese accessible names, status colors also have text labels, and bottom navigation uses:

```css
padding-bottom: max(12px, env(safe-area-inset-bottom));
```

Use a 430 × 932 CSS-pixel viewport review for iPhone 16 Pro Max proportions.

- [ ] **Step 4: Produce and inspect the release build**

Run:

```bash
npm run build
npm run preview -- --host 0.0.0.0
```

Verify: home, quick entry, date detail, history, settings, export and restore; no console error; no horizontal overflow at 430px width.

- [ ] **Step 5: Verify offline behavior**

Load the production preview once, stop the preview network connection in browser developer tools, reload the installed app shell, add a transaction and confirm it persists after another reload.

- [ ] **Step 6: Write user-facing installation and release checklists**

`docs/iphone-installation.md` must include Safari → Share → Add to Home Screen → Open as Web App → Add, plus iCloud Drive backup and restore steps.

`docs/release-checklist.md` must require full test pass, build pass, stable HTTPS URL, manifest, service worker, icons, offline launch, backup round-trip and iPhone safe-area verification.

- [ ] **Step 7: Commit verified release candidate**

```bash
git add tests docs src/styles/global.css README.md
git commit -m "test: verify budget calendar release"
```

- [ ] **Step 8: Deploy the exact verified commit to static HTTPS hosting**

Deploy only the `dist/` output from the verified commit. Record the immutable commit SHA and final stable URL in `README.md`. Do not deploy source files or any local IndexedDB data.

- [ ] **Step 9: Perform iPhone acceptance**

On iPhone 16 Pro Max: open the stable URL in Safari, add it as a web app, launch from the icon, complete one budget and one fixed transaction, enable airplane mode, relaunch, confirm both records remain, export a backup to iCloud Drive, and restore that backup after a controlled test reset.

- [ ] **Step 10: Commit deployment documentation**

```bash
git add README.md docs/iphone-installation.md docs/release-checklist.md
git commit -m "docs: record production deployment"
```

---

## Final Verification Commands

Run from the project root:

```bash
npm test
npm run build
git status --short
```

Expected:

- Every test passes.
- Production build exits with status 0.
- `dist/manifest.webmanifest` and `dist/sw.js` exist.
- Git working tree contains no unintended changes.
- The production URL serves the exact verified build.
