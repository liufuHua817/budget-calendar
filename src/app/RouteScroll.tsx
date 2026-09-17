import { useLayoutEffect } from 'react'
import { useLocation } from 'react-router-dom'

export function RouteScroll({ ready }: { ready: boolean }) {
  const { pathname, search, hash } = useLocation()
  useLayoutEffect(() => {
    if (!ready) return
    const section = hash ? document.getElementById(hash.slice(1)) : null
    if (section) section.scrollIntoView({ block: 'start', behavior: 'instant' })
    else window.scrollTo({ top: 0, left: 0, behavior: 'instant' })
  }, [pathname, search, hash, ready])
  return null
}
