import assert from 'node:assert/strict'
import os from 'node:os'
import fs from 'node:fs'
import { syncBuiltinESMExports } from 'node:module'
import { dirname, join, resolve, basename } from 'node:path'
import { fileURLToPath } from 'node:url'

const [fixture, mode, profile = 'default'] = process.argv.slice(2)
const root = fs.realpathSync(join(dirname(fileURLToPath(import.meta.url)), '..', 'tests'))
assert.equal(dirname(resolve(fixture)), root)
assert.match(basename(fixture), /^pulse-overlay-[A-Za-z0-9]+$/)
assert.equal(fs.realpathSync(fixture), resolve(fixture))
os.homedir = () => fixture
if (profile === 'custom') process.env.DSH_HOME = join(fixture, 'custom-profile')
else delete process.env.DSH_HOME
const overlay = join(process.env.DSH_HOME || join(fixture, '.dsh'), 'running-panel', 'catalog-overlay.json')
if (mode === 'hold-lock') {
  const { DatabaseSync } = await import('node:sqlite')
  fs.mkdirSync(dirname(overlay), { recursive: true })
  const db = new DatabaseSync(join(dirname(overlay), 'catalog-overlay-lock.sqlite'))
  db.exec('CREATE TABLE IF NOT EXISTS marker (id INTEGER); BEGIN IMMEDIATE')
  console.log('LOCKED')
  process.stdin.resume()
  process.stdin.on('end', () => { db.exec('ROLLBACK'); db.close() })
} else {
  const originalRead = fs.readFileSync
  const originalWrite = fs.writeFileSync
  if (mode === 'unreadable') fs.readFileSync = (path, ...args) => {
    if (String(path) === overlay || typeof path === 'number') throw Object.assign(new Error('injected overlay unreadable'), { code: 'EACCES' })
    return originalRead(path, ...args)
  }
  if (mode === 'write-failure') fs.writeFileSync = (path, data, ...args) => {
    if (String(path) === overlay || typeof path === 'number') {
      originalWrite(path, String(data).slice(0, 7), ...args)
      throw Object.assign(new Error('injected partial write'), { code: 'ENOSPC' })
    }
    return originalWrite(path, data, ...args)
  }
  if (mode === 'concurrent-edit') fs.writeFileSync = (path, data, ...args) => {
    const result = originalWrite(path, data, ...args)
    if (String(path) === overlay || typeof path === 'number') originalWrite(overlay, '{"names":{"skill:editor-change":{"zh":"编辑器的新翻译"}}}\n')
    return result
  }
  syncBuiltinESMExports()
  if (mode.startsWith('host-')) {
    const { apply } = await import('../index.js')
    const routes = new Map(), disposers = []
    const sessions = { get() {}, list: () => [] }
    apply({ sessions, get: name => name === 'sessions' ? sessions : name === 'connection' ? { admit: () => ({ peer: { principal: { kind: 'owner' } } }) } : undefined, on() {},
      effect(fn) { const dispose = fn(); if (typeof dispose === 'function') disposers.push(dispose) },
      webServer: { register(row) { routes.set(row.path, row.handler); return () => {} } },
    })
    const request = path => new Promise((done, reject) => {
      const req = { method: 'GET', url: path }
      let status
      const res = { writeHead(code) { status = code }, end(text) { done({ status, body: JSON.parse(text) }) } }
      Promise.resolve(routes.get(path)(req, res)).catch(reject)
    })
    const first = await request('/dsh-running-panel/catalog')
    if (mode === 'host-cache') originalWrite(overlay, '{broken by editor')
    const second = await request('/dsh-running-panel/catalog')
    const snapshot = await request('/dsh-running-panel/snapshot')
    console.log(JSON.stringify({ first, second, snapshot }))
    for (const dispose of disposers.reverse()) await dispose()
  } else {
    process.argv = [process.execPath, 'catalog-sync.mjs', ...(mode === 'report' ? [] : ['--write'])]
    await import('../tools/catalog-sync.mjs')
  }
}
