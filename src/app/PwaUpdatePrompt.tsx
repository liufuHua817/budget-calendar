import { useRegisterSW } from 'virtual:pwa-register/react'

export function PwaUpdatePrompt() {
  const { needRefresh: [needRefresh, setNeedRefresh], updateServiceWorker } = useRegisterSW()
  if (!needRefresh) return null
  return <aside className="update-prompt" role="status">
    <div><strong>新版本已准备好</strong><span>记账完成后再更新也可以</span></div>
    <button type="button" onClick={() => void updateServiceWorker(true)}>安全更新</button>
    <button type="button" aria-label="稍后更新" onClick={() => setNeedRefresh(false)}>稍后</button>
  </aside>
}
