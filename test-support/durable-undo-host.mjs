import assert from 'node:assert/strict'
import os from 'node:os'
import fsp from 'node:fs/promises'
import { syncBuiltinESMExports } from 'node:module'
import { resolve, join, dirname, basename } from 'node:path'
import { fileURLToPath } from 'node:url'
import { Readable } from 'node:stream'

const [fixture, mode, id] = process.argv.slice(2)
const testsRoot = await fsp.realpath(join(dirname(fileURLToPath(import.meta.url)), '..', 'tests'))
assert.equal(dirname(resolve(fixture)), testsRoot)
assert.match(basename(fixture), /^pulse-durable-undo-[A-Za-z0-9]+$/)
assert.equal(await fsp.realpath(fixture), resolve(fixture))
os.homedir = () => fixture
process.env.DSH_HOME = join(fixture, '.dsh')
const store = join(process.env.DSH_HOME, 'running-panel')
if (mode === 'hold-lock') {
  const { DatabaseSync } = await import('node:sqlite')
  await fsp.mkdir(store, { recursive: true })
  const db = new DatabaseSync(join(store, 'undo-lock.sqlite'))
  db.exec('CREATE TABLE IF NOT EXISTS lock_marker (id INTEGER); BEGIN IMMEDIATE')
  console.log('LOCKED')
  process.stdin.resume()
  process.stdin.on('end', () => { db.exec('ROLLBACK'); db.close() })
} else {
  const originalOpen = fsp.open
  const originalRename = fsp.rename
  let journalRenames = 0
  let directoryRenames = 0
  if (mode === 'write-fail') fsp.open = async (path, ...args) => {
    if (String(path).includes('undo.json.') && String(path).endsWith('.tmp')) throw Object.assign(new Error('injected journal failure'), { code: 'EACCES' })
    return originalOpen(path, ...args)
  }
  if (mode === 'commit-fail') fsp.rename = async (from, to) => {
    if (String(to) === join(store, 'undo.json') && ++journalRenames >= 2) throw Object.assign(new Error('injected commit failure'), { code: 'EACCES' })
    return originalRename(from, to)
  }
  if (mode.startsWith('journal-')) fsp.rename = async (from, to) => {
    if (String(to) === join(store, 'undo.json') && ++journalRenames === 1) {
      const code = mode.slice(8)
      throw Object.assign(new Error('injected journal rename ' + code), { code })
    }
    return originalRename(from, to)
  }
  if (mode.startsWith('rename-')) fsp.rename = async (from, to) => {
    if (String(from) === join(fixture, '.agents', 'skills', 'demo')) {
      directoryRenames += 1
      if (directoryRenames === 1) {
        if (mode === 'rename-replaced') {
          await originalRename(from, String(from) + '-original')
          await fsp.mkdir(from)
          await fsp.writeFile(join(from, 'SKILL.md'), 'replacement must remain live')
        }
        if (mode === 'rename-target') {
          await fsp.mkdir(to)
          await fsp.writeFile(join(to, 'SKILL.md'), 'conflicting target must survive')
        }
        const code = mode === 'rename-replaced' || mode === 'rename-target' ? 'EPERM' : mode.slice(7)
        throw Object.assign(new Error('injected rename ' + code), { code })
      }
    }
    return originalRename(from, to)
  }
  syncBuiltinESMExports()
  const { apply } = await import('../index.js')
  const routes = new Map()
  const disposers = []
  const services = { sessions: { get() {}, list: () => [] }, skills: { list: async () => [{ name: 'demo', description: 'fixture' }] }, connection: { admit: () => ({ peer: { principal: { kind: 'owner' } } }) } }
  apply({ sessions: services.sessions, get: name => services[name], on() {},
    effect(fn) { const dispose = fn(); if (typeof dispose === 'function') disposers.push(dispose) },
    webServer: { register(row) { routes.set(row.path, row.handler); return () => {} } },
  })
  const request = (path, body) => new Promise((done, reject) => {
    const req = Readable.from(body === undefined ? [] : [JSON.stringify(body)])
    req.method = body === undefined ? 'GET' : 'POST'; req.url = path
    let status
    const res = { writeHead(code) { status = code }, end(text) { done({ status, body: JSON.parse(text) }) } }
    Promise.resolve(routes.get(path)(req, res)).catch(reject)
  })
  let output
  if (mode === 'snapshot') output = await request('/dsh-running-panel/snapshot')
  else if (mode === 'undo') output = await request('/dsh-running-panel/optimize', { planId: id, undo: true })
  else {
    const preview = await request('/dsh-running-panel/optimize', { dryRun: true, pins: { skills: ['demo'] } })
    output = { plan: preview.body, response: await request('/dsh-running-panel/optimize', { planId: preview.body.id, park: ['demo'] }) }
    if (mode === 'write-fail') output.snapshot = await request('/dsh-running-panel/snapshot')
  }
  if (mode.startsWith('rename-')) output.directoryRenames = directoryRenames
  if (mode.startsWith('journal-')) output.journalRenames = journalRenames
  console.log(JSON.stringify(output))
  for (const dispose of disposers.reverse()) await dispose()
}
