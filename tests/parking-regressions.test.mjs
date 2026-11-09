import test, { after } from 'node:test'
import assert from 'node:assert/strict'
import os from 'node:os'
import { syncBuiltinESMExports } from 'node:module'
import { mkdtemp, mkdir, writeFile, readFile, rename, realpath, rm } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { basename, dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { Readable } from 'node:stream'
import { execFile } from 'node:child_process'

// Only the parent creates/removes the fixture. It waits for the child to exit,
// including any asynchronous saves started by plugin disposal, before cleanup.
// The Windows AppContainer temp directory denies directory rename in this
// environment. Keep fixtures under the writable test root and always remove
// only the newly created directory after its owning child process has exited.
const temporaryRoot = await realpath(dirname(fileURLToPath(import.meta.url)))
const realUserHome = resolve(os.homedir())
async function assertFixture(target) {
  const absolute = resolve(target)
  assert.equal(dirname(absolute), temporaryRoot)
  assert.match(basename(absolute), /^pulse-parking-regressions-[A-Za-z0-9]+$/)
  assert.notEqual(absolute, realUserHome)
  assert.equal(await realpath(absolute), absolute)
}

if (!process.env.PULSE_PARKING_TEST_FIXTURE) {
  test('parking regressions in an isolated child process', async (t) => {
    const target = await mkdtemp(join(temporaryRoot, 'pulse-parking-regressions-'))
    try {
      await assertFixture(target)
      const childEnv = { ...process.env, PULSE_PARKING_TEST_FIXTURE: target }
      delete childEnv.NODE_TEST_CONTEXT
      const result = await new Promise((done) => {
        execFile(process.execPath, ['--test', '--test-reporter=tap', fileURLToPath(import.meta.url)], {
          env: childEnv,
          maxBuffer: 1024 * 1024,
        }, (error, stdout, stderr) => done({ error, stdout, stderr }))
      })
      t.diagnostic(result.stdout.trim())
      assert.equal(result.error, null, result.stderr || result.stdout)
      assert.match(result.stdout, /# tests 8\b/)
      assert.match(result.stdout, /# pass 8\b/)
    } finally {
      await assertFixture(target)
      await rm(target, { recursive: true, force: true })
    }
    assert.equal(existsSync(target), false)
  })
} else {
// Never use the user's real home: all handlers run against the checked fixture.
const fixture = process.env.PULSE_PARKING_TEST_FIXTURE
await assertFixture(fixture)
os.homedir = () => fixture
syncBuiltinESMExports()
process.env.DSH_HOME = join(fixture, '.dsh')
const { apply } = await import('../index.js')
const live = (name) => join(fixture, '.agents', 'skills', name)
const cold = (name) => join(fixture, '.agents', 'skills-parked', name)
const disposers = []
after(async () => {
  for (const dispose of disposers.reverse()) await dispose()
})

function harness(names = []) {
  const routes = new Map()
  const services = {
    sessions: { get() {}, list: () => [] },
    skills: { list: async () => names.map(name => ({ name, description: 'fixture skill' })) },
  }
  apply({
    sessions: services.sessions, get: name => services[name], on() {},
    effect(fn) {
      const dispose = fn()
      if (typeof dispose === 'function') disposers.push(dispose)
      return dispose
    },
    webServer: { register(row) { routes.set(row.path, row.handler); return () => {} } },
  })
  async function request(path, body, method = 'POST') {
    const req = Readable.from(body === undefined ? [] : [JSON.stringify(body)])
    req.method = method
    req.url = path
    return new Promise((resolve, reject) => {
      let code
      const res = { writeHead(n) { code = n }, end(text) { resolve({ code, body: JSON.parse(text) }) } }
      Promise.resolve(routes.get(path.split('?')[0])(req, res)).catch(reject)
    })
  }
  const optimize = body => request('/dsh-running-panel/optimize', body)
  const park = body => request('/dsh-running-panel/park', body)
  return {
    request, optimize, park,
    plan: async () => (await optimize({ dryRun: true, pins: { skills: names } })).body,
    snapshot: async () => (await request('/dsh-running-panel/snapshot', undefined, 'GET')).body,
  }
}

async function skill(dir, name, contents = 'original') {
  await mkdir(dir, { recursive: true })
  await writeFile(join(dir, 'SKILL.md'), `---\nname: ${name}\ndescription: fixture\n---\n${contents}`)
}

test('F04 undo reports destination conflict, preserves original, and permits retry', async () => {
  const name = 'undo-conflict'
  await skill(live(name), name)
  const h = harness([name])
  const plan = await h.plan()
  const applied = await h.optimize({ planId: plan.id, park: [name] })
  assert.equal(applied.body.moved, 1, JSON.stringify(applied))
  await skill(live(name), name, 'new version')
  const failed = await h.optimize({ planId: plan.id, undo: true })
  assert.equal(failed.body.ok, false)
  assert.deepEqual(failed.body.failed, [name])
  assert.match(await readFile(join(cold(name), 'SKILL.md'), 'utf8'), /original/)
  assert.match(await readFile(join(live(name), 'SKILL.md'), 'utf8'), /new version/)
  await rename(live(name), join(fixture, '.agents', 'saved-new-version'))
  const retried = await h.optimize({ planId: plan.id, undo: true })
  assert.equal(retried.body.ok, true)
  assert.equal(retried.body.moved, 1)
  assert.equal(existsSync(cold(name)), false)
})

test('F04 partial undo keeps only the failed rows available for retry', async () => {
  const names = ['partial-a', 'partial-b']
  for (const name of names) await skill(live(name), name)
  const h = harness(names)
  const plan = await h.plan()
  await h.optimize({ planId: plan.id, park: names })
  await skill(live(names[1]), names[1], 'conflicting version')
  const partial = (await h.optimize({ planId: plan.id, undo: true })).body
  assert.equal(partial.ok, false)
  assert.equal(partial.moved, 1)
  assert.deepEqual(partial.failed, [names[1]])
  await rename(live(names[1]), join(fixture, '.agents', 'saved-partial-version'))
  const retried = (await h.optimize({ planId: plan.id, undo: true })).body
  assert.equal(retried.ok, true)
  assert.equal(retried.moved, 1)
  assert.deepEqual(retried.movedNames, [names[1]])
})

test('F04 bulk restore reports a conflict without replacing either version', async () => {
  const name = 'bulk-conflict'
  await skill(live(name), name, 'live version')
  await skill(cold(name), name, 'cold version')
  const result = (await harness().park({ action: 'restore', names: [name] })).body
  assert.equal(result.ok, false)
  assert.deepEqual(result.failed, [name])
  assert.equal(result.results[0].error, 'destination-conflict')
  assert.match(await readFile(join(live(name), 'SKILL.md'), 'utf8'), /live version/)
  assert.match(await readFile(join(cold(name), 'SKILL.md'), 'utf8'), /cold version/)
})

test('F05 second dry run and second apply preserve the first applied plan undo', async () => {
  const names = ['preview-a', 'preview-b']
  for (const name of names) await skill(live(name), name)
  const h = harness(names)
  const first = await h.plan()
  await h.optimize({ planId: first.id, park: [names[0]] })
  const second = await h.plan()
  await h.optimize({ planId: second.id, park: [names[1]] })
  const undone = await h.optimize({ planId: first.id, undo: true })
  assert.equal(undone.code, 200)
  assert.equal(undone.body.ok, true)
  assert.equal(existsSync(live(names[0])), true)
  assert.equal(existsSync(cold(names[1])), true)
  assert.equal((await h.optimize({ planId: second.id, undo: true })).body.ok, true)
})

test('ordinary restore retires old undo ownership before another plan parks the same folder', async () => {
  for (const batch of [false, true]) {
    const names = [`ownership-${batch}-a`, `ownership-${batch}-b`]
    for (const name of names) await skill(live(name), name)
    const h = harness(names)
    const first = await h.plan()
    await h.optimize({ planId: first.id, park: names })
    const restoredName = process.platform === 'win32' ? names[0].toUpperCase() : names[0]
    const restored = await h.park(batch
      ? { action: 'restore', directoryNames: [restoredName] }
      : { action: 'restore', directoryName: restoredName })
    assert.equal(restored.body.ok, true)
    const second = await h.plan()
    assert.equal((await h.optimize({ planId: second.id, park: [names[0]] })).body.ok, true)
    const oldUndo = await h.optimize({ planId: first.id, undo: true })
    assert.equal(oldUndo.body.ok, true)
    assert.deepEqual(oldUndo.body.movedNames, [names[1]])
    assert.equal(existsSync(cold(names[0])), true, 'old plan must not restore the new plan owner')
    const newUndo = await h.optimize({ planId: second.id, undo: true })
    assert.equal(newUndo.body.ok, true, JSON.stringify(newUndo))
  }
})

test('F08 cold snapshot retains directory identity and legacy display-name restore works', async () => {
  const folder = 'different-folder'
  const name = 'different-display-name'
  await skill(cold(folder), name)
  const h = harness()
  await h.park({ action: 'restore', names: ['known-missing'] })
  const item = (await h.snapshot()).cold.items.find(row => row.name === name)
  assert.equal(item.directoryName, folder)
  const restored = await h.park({ action: 'restore', name: item.name })
  assert.equal(restored.code, 200, JSON.stringify(restored))
  assert.equal(existsSync(live(folder)), true)
  assert.equal(existsSync(cold(folder)), false)
})

test('F08 duplicate display names require explicit directory identity', async () => {
  for (const folder of ['duplicate-a', 'duplicate-b']) await skill(cold(folder), 'same-display-name')
  const h = harness()
  const ambiguous = await h.park({ action: 'restore', name: 'same-display-name' })
  assert.equal(ambiguous.code, 409)
  assert.equal(ambiguous.body.error, 'ambiguous-name')
  assert.equal(existsSync(cold('duplicate-a')), true)
  const one = await h.park({ action: 'restore', directoryName: 'duplicate-a' })
  assert.equal(one.code, 200)
  assert.equal(existsSync(live('duplicate-a')), true)
  assert.equal(existsSync(cold('duplicate-b')), true)
  const two = await h.park({ action: 'restore', directoryNames: ['duplicate-b'] })
  assert.equal(two.body.ok, true)
  assert.equal(existsSync(live('duplicate-b')), true)
})

test('parking rejects parent directory identities and duplicate concurrent undo cannot move twice', async () => {
  const name = 'serial-undo'
  await skill(live(name), name)
  const h = harness([name])
  assert.equal((await h.park({ action: 'restore', directoryName: '..' })).code, 400)
  const plan = await h.plan()
  await h.optimize({ planId: plan.id, park: [name] })
  const responses = await Promise.all([
    h.optimize({ planId: plan.id, undo: true }), h.optimize({ planId: plan.id, undo: true }),
  ])
  assert.equal(responses.filter(row => row.body.ok === true).length, 1)
  assert.equal(responses.filter(row => row.code === 409).length, 1)
  assert.equal(existsSync(live(name)), true)
})
}
