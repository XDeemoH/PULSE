import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, mkdir, writeFile, readFile, rm, realpath } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { execFile, spawn } from 'node:child_process'
import { dirname, join, resolve, basename } from 'node:path'
import { fileURLToPath } from 'node:url'
const root = await realpath(dirname(fileURLToPath(import.meta.url)))
const helper = join(root, '..', 'test-support', 'durable-undo-host.mjs')
const live = dir => join(dir, '.agents', 'skills', 'demo')
const cold = dir => join(dir, '.agents', 'skills-parked', 'demo')
async function isolated(run) {
  const dir = await mkdtemp(join(root, 'pulse-durable-undo-'))
  try {
    await mkdir(live(dir), { recursive: true })
    await writeFile(join(live(dir), 'SKILL.md'), '---\nname: demo\ndescription: fixture\n---\noriginal')
    await run(dir)
  } finally {
    assert.equal(dirname(resolve(dir)), root)
    assert.match(basename(dir), /^pulse-durable-undo-[A-Za-z0-9]+$/)
    assert.equal(await realpath(dir), resolve(dir))
    await rm(dir, { recursive: true, force: true })
  }
}
async function child(dir, mode, id = '') {
  const env = { ...process.env }; delete env.NODE_TEST_CONTEXT
  const result = await new Promise(done => execFile(process.execPath, [helper, dir, mode, id], { env, encoding: 'utf8', timeout: 15000 }, (error, stdout, stderr) => done({ error, stdout, stderr })))
  assert.equal(result.error, null, result.stderr || result.stdout)
  return JSON.parse(result.stdout.trim().split('\n').at(-1))
}

test('durable undo snapshot discovers original plan after process exit', () => isolated(async dir => {
  const applied = await child(dir, 'apply')
  assert.equal(applied.response.body.ok, true)
  const snapshot = await child(dir, 'snapshot')
  assert.equal(snapshot.body.undoPlan?.id, applied.plan.id)
  assert.deepEqual(snapshot.body.undoPlan.applied, ['demo'])
  assert.deepEqual(snapshot.body.undoPlan.keep, applied.plan.keep)
  assert.equal(snapshot.body.undoError, null)
}))

test('journal write failure must precede and prevent a directory move', () => isolated(async dir => {
  const applied = await child(dir, 'write-fail')
  assert.notEqual(applied.response.body.ok, true)
  assert.equal(existsSync(live(dir)), true)
  assert.equal(existsSync(cold(dir)), false)
  assert.match(applied.snapshot.body.undoError || '', /injected journal failure/)
}))

test('failed post-move journal commit leaves recoverable write-ahead intent', () => isolated(async dir => {
  const applied = await child(dir, 'commit-fail')
  assert.notEqual(applied.response.body.ok, true)
  assert.equal(existsSync(cold(dir)), true)
  const snapshot = await child(dir, 'snapshot')
  assert.equal(snapshot.body.undoPlan?.id, applied.plan.id)
  const undone = await child(dir, 'undo', applied.plan.id)
  assert.equal(undone.body.ok, true, JSON.stringify(undone))
  assert.match(await readFile(join(live(dir), 'SKILL.md'), 'utf8'), /original/)
}))

test('another writer is refused and process death releases the OS lock', () => isolated(async dir => {
  const env = { ...process.env }; delete env.NODE_TEST_CONTEXT
  const holder = spawn(process.execPath, [helper, dir, 'hold-lock'], { env, stdio: ['pipe', 'pipe', 'pipe'] })
  const closed = new Promise(resolve => holder.on('close', resolve))
  try {
    await new Promise((resolve, reject) => {
      holder.once('error', reject)
      holder.stdout.on('data', chunk => { if (String(chunk).includes('LOCKED')) resolve() })
      holder.once('exit', code => reject(new Error('lock process exited early: ' + code)))
    })
    const applied = await child(dir, 'apply')
    assert.notEqual(applied.response.body.ok, true)
    assert.equal(existsSync(live(dir)), true)
  } finally {
    holder.kill()
    await closed
  }
  const applied = await child(dir, 'apply')
  assert.equal(applied.response.body.ok, true, JSON.stringify(applied))
  assert.equal(existsSync(cold(dir)), true)
}))

for (const code of ['EBUSY', 'EPERM']) {
  test('write-ahead move retries one transient directory rename ' + code, () => isolated(async dir => {
    const result = await child(dir, 'rename-' + code)
    assert.equal(result.response.body.ok, true, JSON.stringify(result))
    assert.equal(result.directoryRenames, 2)
    assert.equal(existsSync(live(dir)), false)
    assert.match(await readFile(join(cold(dir), 'SKILL.md'), 'utf8'), /original/)
    assert.equal((await child(dir, 'undo', result.plan.id)).body.ok, true)
  }))
}

test('retry rechecks source identity and never moves a replacement directory', () => isolated(async dir => {
  const result = await child(dir, 'rename-replaced')
  assert.equal(result.response.body.ok, false)
  assert.equal(result.directoryRenames, 1)
  assert.match(result.response.body.results[0].error, /source-identity-changed/)
  assert.match(await readFile(join(live(dir), 'SKILL.md'), 'utf8'), /replacement must remain live/)
  assert.equal(existsSync(cold(dir)), false)
}))

test('non-transient rename errors are not retried', () => isolated(async dir => {
  const result = await child(dir, 'rename-EACCES')
  assert.equal(result.response.body.ok, false)
  assert.equal(result.directoryRenames, 1)
  assert.equal(existsSync(live(dir)), true)
  assert.equal(existsSync(cold(dir)), false)
}))

test('retry rechecks destination and never overwrites a newly appeared target', () => isolated(async dir => {
  const result = await child(dir, 'rename-target')
  assert.equal(result.response.body.ok, false)
  assert.equal(result.directoryRenames, 1)
  assert.match(result.response.body.results[0].error, /destination-conflict/)
  assert.match(await readFile(join(live(dir), 'SKILL.md'), 'utf8'), /original/)
  assert.match(await readFile(join(cold(dir), 'SKILL.md'), 'utf8'), /conflicting target must survive/)
}))

for (const code of ['EBUSY', 'EPERM']) {
  test('journal replacement retries the same flushed write on ' + code, () => isolated(async dir => {
    const result = await child(dir, 'journal-' + code)
    assert.equal(result.response.body.ok, true, JSON.stringify(result))
    assert.equal(result.journalRenames, 3)
    assert.equal((await child(dir, 'undo', result.plan.id)).body.ok, true)
  }))
}
