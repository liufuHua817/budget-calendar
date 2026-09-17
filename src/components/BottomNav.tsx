import { ChartNoAxesCombined, ReceiptText, House, Settings } from 'lucide-react'
import { NavLink } from 'react-router-dom'

const items = [
  { to: '/', label: '首页', icon: House, end: true },
  { to: '/entry', label: '记账', icon: ReceiptText },
  { to: '/history', label: '历史', icon: ChartNoAxesCombined },
  { to: '/settings', label: '设置', icon: Settings },
]

export function BottomNav() {
  return <nav className="bottom-nav" aria-label="主要导航">
    {items.map(({ to, label, icon: Icon, end }) => <NavLink key={to} to={to} end={end}
      className={({ isActive }) => isActive ? 'active' : ''}>
      <Icon size={21} strokeWidth={2.2} aria-hidden="true" />
      <span>{label}</span>
    </NavLink>)}
  </nav>
}
