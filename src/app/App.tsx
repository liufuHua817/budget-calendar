import { BrowserRouter } from 'react-router-dom'
import '../styles/global.css'
import { BudgetAppProvider } from './AppStore'
import { AppRoutes } from './router'
import { PwaUpdatePrompt } from './PwaUpdatePrompt'

export function App() {
  return <BudgetAppProvider><BrowserRouter><AppRoutes /><PwaUpdatePrompt /></BrowserRouter></BudgetAppProvider>
}
