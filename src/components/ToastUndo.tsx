import { useEffect } from 'react'

export function ToastUndo({ onUndo, onExpire }: { onUndo(): void | Promise<void>; onExpire(): void }) {
  useEffect(() => {
    const timer = window.setTimeout(onExpire, 5000)
    return () => window.clearTimeout(timer)
  }, [onExpire])

  return <div className="undo-toast" role="status">
    <span>已记录</span>
    <button type="button" onClick={() => void onUndo()}>撤销</button>
  </div>
}
