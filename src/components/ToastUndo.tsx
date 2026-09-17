import { useEffect } from 'react'

export function ToastUndo({ onUndo, onExpire, message = '已记录', busy = false }: {
  onUndo(): void | Promise<void>; onExpire(): void; message?: string; busy?: boolean
}) {
  useEffect(() => {
    const timer = window.setTimeout(onExpire, 5000)
    return () => window.clearTimeout(timer)
  }, [onExpire])

  return <div className="undo-toast" role="status">
    <span>{message}</span>
    <button type="button" disabled={busy} onClick={() => void onUndo()}>撤销</button>
  </div>
}
