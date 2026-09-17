import { HashRouter } from 'react-router-dom'
import '../styles/global.css'
import { BudgetAppProvider } from './AppStore'
import { AppRoutes } from './router'
import { PwaUpdatePrompt } from './PwaUpdatePrompt'
import { RouteScroll } from './RouteScroll'
import { useBudgetApp } from './BudgetAppContext'

function AppContent() {
  const { loading } = useBudgetApp()
  return <><AppRoutes /><RouteScroll ready={!loading} /><PwaUpdatePrompt /></>
}

export function App() {
  return <BudgetAppProvider><HashRouter><AppContent /></HashRouter></BudgetAppProvider>
}
