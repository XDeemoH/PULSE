import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, mkdir, rm } from 'node:fs/promises'
import { resolve, join } from 'node:path'
import { spawnSync } from 'node:child_process'
import { historyTop } from '../history-core.js'

async function run(scenario) {
  const base = await mkdtemp(resolve('tests', 'isolation-'))
  try {
    const user = join(base, 'user'); const dsh = join(base, 'dsh')
    await mkdir(user, { recursive:true }); await mkdir(dsh, { recursive:true })
    const env = { ...process.env, USERPROFILE:user, HOME:user, HOMEDRIVE:user.slice(0,2), HOMEPATH:user.slice(2), DSH_HOME:dsh }
    const result = spawnSync(process.execPath, [resolve('test-support/storage-host.mjs'), base, scenario], { env, encoding:'utf8', timeout:15000 })
    assert.equal(result.status, 0, result.stderr || result.stdout)
    return JSON.parse(result.stdout.trim().split('\n').at(-1))
  } finally { await rm(base, { recursive:true, force:true }) }
}

test('F01 restart preserves untouched sessions and names', async () => {
  const data = JSON.parse((await run('resume')).file)
  assert.equal(data.sessions.old.tools.read, 8)
  assert.equal(data.sessions.old.tools.write, 4)
  assert.equal(data.sessions.old.skills.alpha, 3)
  assert.equal(data.sessions.other.tools.read, 2)
  assert.equal(data.sessions.other.skills.beta, 5)
})

test('F02 corrupt usage is not overwritten by a new event', async () => {
  assert.equal((await run('corrupt')).file, '{not valid JSON!')
})

for (const kind of [
  'totals-object', 'totals-row-key', 'totals-row-count', 'totals-row-infinite',
  'sessions-array', 'session-array', 'tools-array', 'skills-string', 'tools-negative',
  'lastAt-string', 'since-infinite', 'future-version',
]) {
  test('F02 preserves structurally invalid or unsupported usage: ' + kind, async () => {
    const result = await run('usage-invalid-' + kind)
    assert.equal(result.file, result.original, 'do not overwrite a store that cannot safely be interpreted')
    assert.equal(result.snapshot.storage.usage.ready, false)
    assert.ok(result.snapshot.storage.usage.error, 'surface an actionable load error')
  })
}

test('F03 failed Echo persistence must not report success', async () => {
  const response = await run('echo')
  assert.ok(response.status >= 400 || response.body.ok === false, JSON.stringify(response))
})

test('F10 explicit empty user skills set excludes all skill history', () => {
  assert.deepEqual(historyTop({ 'skill:built-in': { n:2 } }, { userSkills: new Set() }), [])
})


test('F09 cost uses full model-visible skill description', async () => {
  const response = await run('cost-meter')
  assert.equal(response.status, 200)
  const skill = response.body.cost.top.find(item => item.name === 'full-skill')
  assert.ok(skill && skill.tokens >= 400, JSON.stringify(response.body.cost))
})

test('F09 cost source declares fallback when meter throws', async () => {
  const response = await run('cost-fallback')
  assert.equal(response.status, 200)
  assert.match(response.body.cost.source, /fallback/i)
})



test('F01 newly active session survives 40-session retention', async () => {
  const data = JSON.parse((await run('recent')).file)
  assert.equal(data.sessions.old?.tools?.read, 1)
})


test('F03 failed Echo writes roll back POST, PATCH, DELETE and permit retry', async () => {
  const r = await run('echo-transaction')
  assert.equal(r.created.status, 200)
  for (const response of [r.failedPost, r.failedPatch, r.failedDelete]) assert.ok(response.status >= 400)
  assert.equal(r.after.status, 200)
  assert.notEqual(r.after.body.echo.title, 'SHOULD NOT PERSIST')
  assert.equal(r.all.body.echoes.length, 1)
  assert.equal(r.retry.status, 200)
})

test('F03 malformed Echo structure is preserved and cannot report successful write', async () => {
  const r = await run('echo-malformed')
  assert.ok(r.post.status >= 400)
  assert.equal(r.file, '{"echoes":{}}')
})
