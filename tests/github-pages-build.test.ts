import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { describe, expect, test } from 'vitest'

describe('GitHub Pages build', () => {
  test('uses the repository subpath for assets and PWA installation', () => {
    const require = createRequire(import.meta.url)
    execFileSync(process.execPath, [require.resolve('typescript/bin/tsc'), '-b'], { cwd: process.cwd(), stdio: 'pipe' })
    execFileSync(process.execPath, ['node_modules/vite/bin/vite.js', 'build'], {
      cwd: process.cwd(),
      env: { ...process.env, GITHUB_ACTIONS: 'true' },
      stdio: 'pipe',
    })

    const html = readFileSync('dist/index.html', 'utf8')
    const manifest = readFileSync('dist/manifest.webmanifest', 'utf8')

    expect(html).toContain('/budget-calendar/assets/')
    expect(html).toContain('/budget-calendar/icons/apple-touch-icon.png')
    expect(manifest).toContain('"start_url":"./"')
    expect(manifest).toContain('"src":"icons/pwa-192x192.png"')
  }, 15_000)
})
