import { lstatSync, fstatSync, openSync, closeSync, readFileSync, writeFileSync, fsyncSync, mkdirSync, realpathSync, renameSync, unlinkSync } from 'node:fs'
import { homedir } from 'node:os'
import { join, dirname, basename } from 'node:path'
import { createHash, randomUUID } from 'node:crypto'

export const catalogOverlayPath = () => join(process.env.DSH_HOME || join(homedir(), '.dsh'), 'running-panel', 'catalog-overlay.json')
const object = value => value !== null && typeof value === 'object' && !Array.isArray(value)
const safeKey = key => !['__proto__', 'constructor', 'prototype'].includes(key)
const invalid = message => { throw new Error('catalog-overlay: ' + message) }

/** Unversioned overlays are the documented legacy format; version 1 is current. */
export function validateCatalogOverlay(data) {
  if (!object(data)) invalid('root must be an object')
  if (Object.hasOwn(data, 'version') && data.version !== 1) invalid('unsupported version')
  for (const section of ['names', 'descs', 'tagOf', 'libOf']) {
    if (!Object.hasOwn(data, section)) continue
    const rows = data[section]
    if (!object(rows)) invalid(section + ' must be an object')
    for (const [key, value] of Object.entries(rows)) {
      if (!safeKey(key)) invalid('unsafe mapping key')
      if (section === 'names' || section === 'descs') {
        if (!object(value)) invalid(section + '.' + key + ' must be a locale object')
        for (const [locale, text] of Object.entries(value)) {
          if (!safeKey(locale) || typeof text !== 'string') invalid('locale values must be strings')
        }
      } else if (typeof value !== 'string') invalid(section + ' values must be strings')
    }
  }
  // 自动翻译的出处记录：{ "skill:<id>": { at, model?, name?, desc? } }，只给界面区分机翻用。
  if (Object.hasOwn(data, 'autoTranslated')) {
    if (!object(data.autoTranslated)) invalid('autoTranslated must be an object')
    for (const [key, value] of Object.entries(data.autoTranslated)) {
      if (!safeKey(key) || !object(value)) invalid('autoTranslated.' + key + ' must be an object')
    }
  }
  return data
}

function info(path) {
  try { return lstatSync(path, { bigint: true }) } catch (error) {
    if (error.code === 'ENOENT') return null
    throw error
  }
}
const identity = stat => stat && [stat.dev, stat.ino, stat.mtimeNs, stat.size].join(':')
function regular(stat) {
  if (!stat || !stat.isFile() || stat.isSymbolicLink()) invalid('expected a regular file, not a symlink or directory')
}

/** Missing is the only empty-config case. All unreadable/invalid files throw. */
export function readCatalogOverlay(file = catalogOverlayPath()) {
  const before = info(file)
  if (!before) return { exists: false, data: {}, stamp: 'missing' }
  regular(before)
  const fd = openSync(file, 'r')
  try {
    const opened = fstatSync(fd, { bigint: true })
    regular(opened)
    if (identity(opened) !== identity(before)) invalid('file changed while opening')
    const text = readFileSync(fd, 'utf8')
    const after = info(file)
    regular(after)
    if (identity(after) !== identity(before) || identity(fstatSync(fd, { bigint: true })) !== identity(before)) invalid('file changed while reading')
    const data = validateCatalogOverlay(JSON.parse(text))
    return { exists: true, data, stamp: identity(after) + ':' + createHash('sha256').update(text).digest('hex') }
  } finally { closeSync(fd) }
}

/** Serialize cooperating CLI writers and atomically replace a fully flushed file.
 * A pre-commit reread also detects external editor changes; external programs do
 * not participate in this lock and must not edit during the final rename itself.
 */
export async function updateCatalogOverlay(file, update) {
  mkdirSync(dirname(file), { recursive: true })
  const parent = realpathSync(dirname(file))
  const target = join(parent, basename(file))
  const lockFile = join(parent, 'catalog-overlay-lock.sqlite')
  const existingLock = info(lockFile)
  if (existingLock) regular(existingLock)
  const { DatabaseSync } = await import('node:sqlite')
  const db = new DatabaseSync(lockFile)
  let transaction = false
  let temporary = null
  let fd
  let ownsTemporary = false
  try {
    db.exec('PRAGMA busy_timeout=0; BEGIN IMMEDIATE')
    transaction = true
    const before = readCatalogOverlay(target)
    const next = await update(structuredClone(before.data), before.exists)
    if (next === null || next === undefined) return { written: false, data: before.data }
    validateCatalogOverlay(next)
    temporary = target + '.' + process.pid + '.' + randomUUID() + '.tmp'
    fd = openSync(temporary, 'wx', 0o600)
    ownsTemporary = true
    writeFileSync(fd, JSON.stringify(next, null, 2) + '\n', 'utf8')
    fsyncSync(fd)
    closeSync(fd); fd = undefined
    if (readCatalogOverlay(target).stamp !== before.stamp) invalid('changed by another editor; no update written')
    renameSync(temporary, target)
    ownsTemporary = false
    if (process.platform !== 'win32') {
      const directory = openSync(parent, 'r')
      try { fsyncSync(directory) } finally { closeSync(directory) }
    }
    return { written: true, data: next }
  } finally {
    try {
      if (fd !== undefined) closeSync(fd)
      // Best-effort cleanup: a failed unlink must never mask the real error above.
      if (ownsTemporary) { try { unlinkSync(temporary) } catch { /* leave the stray .tmp */ } }
    } finally {
      try { if (transaction) db.exec('ROLLBACK') } finally { db.close() }
    }
  }
}
