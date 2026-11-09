import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, mkdir, rm } from 'node:fs/promises'
import { resolve, join } from 'node:path'
import { spawnSync } from 'node:child_process'

async function run(size, mode = 'normal') {
  const base = await mkdtemp(resolve('tests', 'echo-capacity-'))
  try {
    const user = join(base, 'user')
    const dsh = join(base, 'dsh')
    await mkdir(user)
    await mkdir(dsh)
    const env = {
      ...process.env,
      HOME: user,
      USERPROFILE: user,
      HOMEDRIVE: user.slice(0, 2),
      HOMEPATH: user.slice(2),
      DSH_HOME: dsh,
    }
    function child(kind) {
      const result = spawnSync(process.execPath, [
        resolve('test-support/echo-capacity-host.mjs'), base, String(size), kind,
      ], { env, encoding: 'utf8', timeout: 15000 })
      assert.equal(result.status, 0, result.stderr || result.stdout)
      return JSON.parse(result.stdout.trim().split('\n').at(-1))
    }
    const result = child(mode)
    result.restarted = child('read')
    return result
  } finally {
    await rm(base, { recursive: true, force: true })
  }
}

for (const count of [200, 201]) {
  test(`full ${count}-item library preserves all items and allows same anchor update`, async () => {
    const result = await run(count)
    assert.deepEqual(result.before.body.capacity, { count, limit: 200 })
    assert.equal(result.before.body.echoes.find(echo => echo.id === 'e0').anchorTurn, 7)
    assert.equal(result.duplicate.status, 200)
    assert.equal(result.duplicate.body.merged, true)

    assert.equal(result.created.status, 409)
    assert.equal(result.created.body.error, 'echo_capacity_reached')
    assert.deepEqual(result.created.body.capacity, { count, limit: 200 })
    assert.equal(result.created.body.count, count)
    assert.equal(result.created.body.limit, 200)
    assert.equal(result.afterCreate, result.beforeCreate, 'rejection must not write the store')

    assert.equal(result.after.body.echoes.length, count)
    assert.equal(result.disk.echoes.length, count)
    assert.deepEqual(result.restarted.before.body.capacity, { count, limit: 200 })
    assert.equal(result.restarted.disk.echoes.length, count)
    assert.deepEqual(
      new Set(result.disk.echoes.map(echo => echo.id)),
      new Set(Array.from({ length: count }, (_, i) => 'e' + i)),
    )
    assert.equal(result.disk.echoes.find(echo => echo.id === 'e0').note, 'note0')
  })
}

test('one free slot admits a new anchor without evicting old favorites', async () => {
  const result = await run(199)
  assert.deepEqual(result.before.body.capacity, { count: 199, limit: 200 })
  assert.equal(result.created.status, 200)
  assert.equal(result.after.body.echoes.length, 200)
  assert.equal(result.disk.echoes.length, 200)
  for (let i = 0; i < 199; i++) {
    assert.ok(result.disk.echoes.some(echo => echo.id === 'e' + i))
  }
})

test('failed update at capacity preserves every preexisting item and reports failure', async () => {
  const result = await run(200, 'write-failure')
  assert.ok(result.duplicate.status >= 400)
  assert.equal(result.created.status, 409)
  assert.equal(result.restarted.disk.echoes.length, 200)
  for (let i = 0; i < 200; i++) {
    assert.equal(result.restarted.disk.echoes.find(echo => echo.id === 'e' + i).note, 'note' + i)
  }
})
