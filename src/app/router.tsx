import type { ReactNode } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import { AppShell } from '../components/AppShell'
import { PaydayPrompt } from '../features/cycle/PaydayPrompt'
import { DayDetailPage } from '../features/day/DayDetailPage'
import { EntryPage } from '../features/entry/EntryPage'
import { HomePage } from '../features/home/HomePage'
import { HistoryPage } from '../features/history/HistoryPage'
import { SetupPage } from '../features/setup/SetupPage'
import { SettingsPage } from '../features/settings/SettingsPage'
import { useBudgetApp } from './BudgetAppContext'

function LoadingScreen() {
  return <main className="loading-screen" aria-label="正在载入">正在载入…</main>
}

function HomeRoute() {
  const app = useBudgetApp()
  if (app.loading) return <LoadingScreen />
  if (!app.cycle) return <Navigate to="/setup" replace />
  if (app.attentionState === 'payday-confirmation-required') {
    return <PaydayPrompt cycle={app.cycle} today={app.today} transactions={app.transactions}
      onReschedule={app.rescheduleExpectedPayday} onStartNextCycle={app.startNextCycle} />
  }
  return <AppShell><HomePage /></AppShell>
}

function SetupRoute() {
  const { loading, cycle } = useBudgetApp()
  if (loading) return <LoadingScreen />
  if (cycle) return <Navigate to="/" replace />
  return <SetupPage />
}

function ProtectedRoute({ children }: { children: ReactNode }) {
  const { loading, cycle } = useBudgetApp()
  if (loading) return <LoadingScreen />
  if (!cycle) return <Navigate to="/setup" replace />
  return <AppShell>{children}</AppShell>
}

export function AppRoutes() {
  return <Routes>
    <Route path="/" element={<HomeRoute />} />
    <Route path="/setup" element={<SetupRoute />} />
      <Route path="/entry" element={<ProtectedRoute><EntryPage /></ProtectedRoute>} />
      <Route path="/ledger" element={<Navigate to="/entry" replace />} />
      <Route path="/day/:date" element={<ProtectedRoute><DayDetailPage /></ProtectedRoute>} />
      <Route path="/history" element={<ProtectedRoute><HistoryPage /></ProtectedRoute>} />
      <Route path="/settings" element={<ProtectedRoute><SettingsPage /></ProtectedRoute>} />
    <Route path="*" element={<Navigate to="/" replace />} />
  </Routes>
}
