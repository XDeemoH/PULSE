import { mkdir, readFile, open, rename, rm, lstat, realpath } from 'node:fs/promises'
import { join, resolve } from 'node:path'
import { randomUUID } from 'node:crypto'

const keyOf = value => process.platform === 'win32' ? value.toLowerCase() : value
export const validDirectoryName = name => typeof name === 'string' && name.length > 0 &&
  name !== '.' && name !== '..' && !/[\\/:\0]/.test(name) && !/[. ]$/.test(name)
const same = (a, b) => Boolean(a && b && !a.unsupported && !b.unsupported &&
  a.dev === b.dev && a.ino === b.ino && a.birthtimeNs === b.birthtimeNs)
const clone = value => JSON.parse(JSON.stringify(value))
const fail = message => { throw new Error(message) }
/** Per-request rejections: the journal is fine, so they must not become a sticky store error. */
const REQUEST_REJECTIONS = new Set(['bad name', 'missing', 'destination-conflict', 'plan-expired', 'unsupported-directory-identity'])
const validIdentity = value => value && ['dev', 'ino', 'birthtimeNs'].every(key =>
  typeof value[key] === 'string' && /^\d+$/.test(value[key])) && value.ino !== '0'

async function identityAt(path) {
  try {
    const stat = await lstat(path, { bigint: true })
    if (!stat.isDirectory() || stat.isSymbolicLink() || stat.ino === 0n) return { unsupported: true }
    return { dev: String(stat.dev), ino: String(stat.ino), birthtimeNs: String(stat.birthtimeNs) }
  } catch (error) {
    if (error.code === 'ENOENT') return null
    throw error
  }
}

async function canonicalRoot(path) {
  try { return await realpath(path) } catch (error) {
    if (error.code === 'ENOENT') return resolve(path)
    throw error
  }
}

// Windows scanners may briefly hold a directory or the journal target. Retry
// exactly once for those two errors, keeping the same OS lock and write intent.
async function renameWithRetry(from, to, verify = async () => {}) {
  for (let attempt = 0; attempt < 2; attempt += 1) {
    await verify()
    try {
      await rename(from, to)
      return
    } catch (error) {
      if (attempt !== 0 || !['EBUSY', 'EPERM'].includes(error.code)) throw error
      await new Promise(resolve => setTimeout(resolve, 150))
    }
  }
}

/** JSON is the durable write-ahead journal; SQLite supplies only an OS lock.
 * Its transaction stays open across filesystem awaits, and the OS releases it
 * on process death. No PID guessing, stale-lock deletion or npm dependency.
 */
export function createUndoStore({ directory, liveRoot, coldRoot }) {
  const file = join(directory, 'undo.json')
  const lockFile = join(directory, 'undo-lock.sqlite')
  let sqlitePromise
  let queue = Promise.resolve()
  let lastError = null
  let operationError = null

  function serial(operation) {
    const result = queue.then(operation)
    queue = result.catch(() => {})
    return result
  }

  async function rootsNow() {
    return { live: await canonicalRoot(liveRoot), cold: await canonicalRoot(coldRoot) }
  }

  function validate(data, roots) {
    if (!data || data.version !== 1 || !data.roots ||
      keyOf(String(data.roots.live)) !== keyOf(roots.live) || keyOf(String(data.roots.cold)) !== keyOf(roots.cold) ||
      !Array.isArray(data.plans) || !Array.isArray(data.pending)) fail('undo-journal-invalid-or-root-mismatch')
    const ids = new Set()
    for (const record of data.plans) {
      const plan = record && record.plan
      if (!plan || typeof plan.id !== 'string' || !plan.id || ids.has(plan.id) ||
        !Number.isFinite(plan.at) || !Array.isArray(plan.keep) || !Array.isArray(plan.park) ||
        !Number.isFinite(record.updatedAt) || !Array.isArray(record.entries)) fail('undo-journal-invalid-plan')
      ids.add(plan.id)
      for (const row of plan.keep.concat(plan.park)) {
        if (!row || typeof row.name !== 'string') fail('undo-journal-invalid-plan-row')
      }
      const names = new Set()
      for (const entry of record.entries) {
        if (!entry || !validDirectoryName(entry.directoryName) || !validIdentity(entry.identity) ||
          names.has(keyOf(entry.directoryName))) fail('undo-journal-invalid-ownership')
        names.add(keyOf(entry.directoryName))
      }
    }
    const operationIds = new Set()
    for (const op of data.pending) {
      if (!op || typeof op.id !== 'string' || !op.id || operationIds.has(op.id) ||
        !['park', 'restore'].includes(op.action) || !validDirectoryName(op.directoryName) ||
        !validIdentity(op.identity) || !Number.isFinite(op.at) ||
        (op.planId !== null && (typeof op.planId !== 'string' || !ids.has(op.planId))) ||
        (op.action === 'restore' && op.planId !== null)) fail('undo-journal-invalid-pending-operation')
      operationIds.add(op.id)
    }
    return data
  }

  async function load(roots) {
    try {
      const stat = await lstat(file)
      if (!stat.isFile() || stat.isSymbolicLink()) fail('undo-journal-not-regular-file')
      return validate(JSON.parse(await readFile(file, 'utf8')), roots)
    } catch (error) {
      if (error.code === 'ENOENT') return { version: 1, roots, plans: [], pending: [] }
      throw error
    }
  }

  async function persist(data) {
    const tmp = file + '.' + process.pid + '.' + randomUUID() + '.tmp'
    let handle
    try {
      handle = await open(tmp, 'wx', 0o600)
      await handle.writeFile(JSON.stringify(data), 'utf8')
      await handle.sync()
      await handle.close(); handle = null
      await renameWithRetry(tmp, file)
      // Windows does not permit opening directories for fsync. The file itself
      // was flushed before its atomic replacement; POSIX also flushes the entry.
      if (process.platform !== 'win32') {
        const parent = await open(directory, 'r')
        try { await parent.sync() } finally { await parent.close() }
      }
    } finally {
      if (handle) await handle.close().catch(() => {})
      await rm(tmp, { force: true }).catch(() => {})
    }
  }

  function retire(data, name) {
    for (const record of data.plans) {
      record.entries = record.entries.filter(entry => keyOf(entry.directoryName) !== keyOf(name))
    }
  }

  function finish(data, op, moved) {
    if (moved) {
      retire(data, op.directoryName)
      if (op.action === 'park' && op.planId) {
        const record = data.plans.find(row => row.plan.id === op.planId)
        if (!record) fail('undo-journal-missing-plan')
        record.entries.push({ directoryName: op.directoryName, identity: op.identity })
        record.updatedAt = Date.now()
      }
    }
    data.pending = data.pending.filter(row => row.id !== op.id)
    data.plans = data.plans.filter(record => record.entries.length || data.pending.some(op => op.planId === record.plan.id))
  }

  /** Resolve intents from identity observations only; recovery never moves files. */
  async function recover(data) {
    let changed = false
    for (const op of [...data.pending]) {
      const live = await identityAt(join(data.roots.live, op.directoryName))
      const cold = await identityAt(join(data.roots.cold, op.directoryName))
      const source = op.action === 'park' ? live : cold
      const target = op.action === 'park' ? cold : live
      if (same(target, op.identity) && !same(source, op.identity)) {
        finish(data, op, true); changed = true
      } else if (same(source, op.identity) && !same(target, op.identity)) {
        finish(data, op, false); changed = true
      }
      // Neither location holds the recorded object: preserve the intent and
      // refuse further moves rather than guessing from directory names.
    }
    if (changed) {
      await persist(data)
      operationError = null
    }
  }

  async function locked(operation) {
    return serial(async () => {
      let db
      let inTransaction = false
      try {
        await mkdir(directory, { recursive: true })
        sqlitePromise ||= import('node:sqlite')
        const { DatabaseSync } = await sqlitePromise
        db = new DatabaseSync(lockFile)
        db.exec('PRAGMA busy_timeout=0; BEGIN IMMEDIATE')
        inTransaction = true
        const roots = await rootsNow()
        if (keyOf(roots.live) === keyOf(roots.cold)) fail('undo-roots-must-differ')
        const data = await load(roots)
        await recover(data)
        lastError = null
        return await operation(data)
      } catch (error) {
        lastError = String(error && error.message ? error.message : error)
        throw error
      } finally {
        if (db) {
          if (inTransaction) { try { db.exec('ROLLBACK') } catch {} }
          db.close()
        }
      }
    })
  }

  function view(data, record) {
    if (!record) return null
    const applied = record.entries.map(entry => entry.directoryName)
    for (const op of data.pending) {
      if (op.action === 'park' && op.planId === record.plan.id && !applied.includes(op.directoryName)) applied.push(op.directoryName)
    }
    return applied.length ? { ...clone(record.plan), applied } : null
  }

  async function snapshot() {
    try {
      return await locked(async data => {
        const records = [...data.plans].sort((a, b) => b.updatedAt - a.updatedAt)
        const record = records.find(row => view(data, row))
        const undoPlan = view(data, record)
        let undoError = data.pending.length ? 'undo-pending-identity-mismatch' : operationError
        if (record && !undoError) {
          for (const entry of record.entries) {
            const cold = await identityAt(join(data.roots.cold, entry.directoryName))
            const live = await identityAt(join(data.roots.live, entry.directoryName))
            if (!same(cold, entry.identity)) { undoError = 'undo-directory-identity-mismatch: ' + entry.directoryName; break }
            if (live) { undoError = 'destination-conflict: ' + entry.directoryName; break }
          }
        }
        return { undoPlan, undoError }
      })
    } catch {
      return { undoPlan: null, undoError: lastError || 'undo-journal-unavailable' }
    }
  }

  async function getPlan(id) {
    return locked(async data => view(data, data.plans.find(row => row.plan.id === id)))
  }

  async function move(directoryName, action, { plan = null, undoPlanId = null } = {}) {
    let moved = false
    try {
      return await locked(async data => {
        if (!validDirectoryName(directoryName) || !['park', 'restore'].includes(action)) fail('bad name')
        if (data.pending.length) fail('undo-pending-identity-mismatch')
        const fromRoot = action === 'park' ? data.roots.live : data.roots.cold
        const toRoot = action === 'park' ? data.roots.cold : data.roots.live
        const from = join(fromRoot, directoryName)
        const to = join(toRoot, directoryName)
        const identity = await identityAt(from)
        if (undoPlanId) {
          const record = data.plans.find(row => row.plan.id === undoPlanId)
          const entry = record && record.entries.find(row => keyOf(row.directoryName) === keyOf(directoryName))
          if (!entry) fail('plan-expired')
          if (!same(identity, entry.identity)) fail('undo-directory-identity-mismatch')
        }
        if (!identity) fail('missing')
        if (identity.unsupported) fail('unsupported-directory-identity')
        if (await identityAt(to)) fail('destination-conflict')
        await mkdir(toRoot, { recursive: true })
        const checkedRoots = await rootsNow()
        if (keyOf(checkedRoots.live) !== keyOf(data.roots.live) || keyOf(checkedRoots.cold) !== keyOf(data.roots.cold)) fail('undo-root-changed')
        if (plan && action === 'park' && !data.plans.some(row => row.plan.id === plan.id)) {
          const original = clone(plan); delete original.applied
          data.plans.push({ plan: original, entries: [], updatedAt: Date.now() })
        }
        const op = { id: randomUUID(), action, directoryName, identity, planId: plan && action === 'park' ? plan.id : null, at: Date.now() }
        data.pending.push(op)
        await persist(data) // write-ahead: no rename before this durable intent
        await renameWithRetry(from, to, async () => {
          if (!same(await identityAt(from), identity)) fail('source-identity-changed')
          if (await identityAt(to)) fail('destination-conflict')
        })
        moved = true
        finish(data, op, true)
        await persist(data)
        operationError = null
        return { ok: true }
      })
    } catch (error) {
      const message = String(error && error.message ? error.message : error)
      if (moved || !REQUEST_REJECTIONS.has(message)) operationError = message
      return { ok: false, error: message, ...(moved ? { moved: true, recoveryPending: true } : {}) }
    }
  }

  return { snapshot, getPlan, move }
}
