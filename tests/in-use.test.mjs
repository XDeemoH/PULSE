// Parking a skill another open conversation is using (1.0.23): the host refuses unless
// forced, the budget plan keeps it, and the panel asks before forcing.
import test from 'node:test'
import assert from 'node:assert/strict'
import { execFile } from 'node:child_process'
import { existsSync, mkdtempSync, mkdirSync, readFileSync, realpathSync, rmSync, writeFileSync } from 'node:fs'
import { basename, dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import vm from 'node:vm'

const testsRoot = realpathSync(dirname(fileURLToPath(import.meta.url)))
const helper = join(testsRoot, '..', 'test-support', 'route-host.mjs')

function fixture() {
  const base = mkdtempSync(join(testsRoot, 'pulse-routes-'))
  for (const name of ['busy-skill', 'idle-skill']) {
    mkdirSync(join(base, '.agents', 'skills', name), { recursive: true })
    writeFileSync(join(base, '.agents', 'skills', name, 'SKILL.md'), '---\nname: ' + name + '\ndescription: ' + 'x'.repeat(400) + '\n---\n')
  }
  mkdirSync(join(base, '.dsh', 'running-panel'), { recursive: true })
  return base
}
function run(base, steps) {
  const sessions = [{ id: 's1', header: { cwd: 'H:\\w' } }, { id: 's2', header: { cwd: 'H:\\w' } }]
  const env = {
    ...process.env,
    PULSE_TEST_SESSIONS: JSON.stringify(sessions),
    PULSE_TEST_REGISTRY: JSON.stringify({ skills: [{ name: 'busy-skill', description: 'x'.repeat(400) }, { name: 'idle-skill', description: 'x'.repeat(400) }] }),
    // Conversation s2 just loaded busy-skill.
    PULSE_TEST_EMIT: JSON.stringify([['tools/result', { agent: { id: 's2' }, name: 'skill', arguments: '{"name":"busy-skill"}' }, { isError: false }]]),
  }
  delete env.NODE_TEST_CONTEXT
  return new Promise((done, reject) => execFile(process.execPath, [helper, base, JSON.stringify(steps)], {
    env, encoding: 'utf8', timeout: 20000, maxBuffer: 8 * 1024 * 1024,
  }, (error, stdout, stderr) => {
    const parked = existsSync(join(base, '.agents', 'skills-parked', 'busy-skill'))
    assert.equal(dirname(resolve(base)), testsRoot)
    assert.match(basename(base), /^pulse-routes-[A-Za-z0-9]+$/)
    rmSync(base, { recursive: true, force: true })
    if (error) return reject(new Error(stderr || error.message))
    done({ results: JSON.parse(stdout.trim().split('\n').pop()), parked })
  }))
}
const P = '/dsh-running-panel/park'

test('park refuses a skill another open conversation is using, names it, and only moves it when forced', async () => {
  const { results, parked } = await run(fixture(), [
    { method: 'POST', path: P, body: { name: 'busy-skill', action: 'park', sessionId: 's1' } },
    { method: 'POST', path: P, body: { names: ['busy-skill', 'idle-skill'], action: 'park', sessionId: 's1' } },
    { method: 'POST', path: P, body: { name: 'busy-skill', action: 'park', sessionId: 's1', force: true } },
  ])
  const [refused, batch, forced] = results
  assert.equal(refused.status, 409)
  assert.equal(refused.body.error, 'in-use')
  assert.deepEqual(refused.body.sessions.map((s) => s.sessionId), ['s2'])
  assert.deepEqual(batch.body.results.map((r) => [r.name, r.ok, r.error || '']), [['busy-skill', false, 'in-use'], ['idle-skill', true, '']], 'batch skips the busy one, moves the rest')
  assert.equal(forced.status, 200)
  assert.equal(parked, true)
})

test('the conversation that is using the skill may park it itself (only other conversations block)', async () => {
  const { results } = await run(fixture(), [{ method: 'POST', path: P, body: { name: 'busy-skill', action: 'park', sessionId: 's2' } }])
  assert.equal(results[0].status, 200)
})

test('the budget plan keeps skills another conversation is using, with who is using them', async () => {
  const { results } = await run(fixture(), [{ method: 'POST', path: '/dsh-running-panel/optimize', body: { dryRun: true, sessionId: 's1', limitTokens: 500 } }])
  const plan = results[0].body
  const keep = plan.keep.find((row) => row.name === 'busy-skill')
  assert.ok(keep, 'kept')
  assert.equal(keep.why, 'inUse')
  assert.equal(keep.inUse[0].sessionId, 's2')
  assert.ok(!plan.keep.some((row) => row.name === 'idle-skill'), 'the idle one is not protected')
})

/* ── client ─────────────────────────────────────────────────────────── */

const source = readFileSync(new URL('../client.js', import.meta.url), 'utf8').replace(/\r\n/g, '\n')
test('the row asks before forcing a park that another conversation would feel', async () => {
  const slots = []
  let cursor = 0
  const React = {
    Fragment: 'Fragment',
    createElement(type, props, ...children) { return { type, props: props || {}, children } },
    useState(initial) { const id = cursor++; if (!(id in slots)) slots[id] = typeof initial === 'function' ? initial() : initial; return [slots[id], (v) => { slots[id] = typeof v === 'function' ? v(slots[id]) : v }] },
    useRef(initial) { const id = cursor++; return slots[id] || (slots[id] = { current: initial }) },
    useEffect() { cursor++ },
    useMemo(callback) { cursor++; return callback() },
    useCallback(callback) { cursor++; return callback },
    createContext(value) { return { _value: value, Provider: 'Provider' } },
    useContext(context) { return context._value },
  }
  const requests = []
  let factory
  const context = vm.createContext({
    window: { __ModuleLoader__: { load(module) { factory = module.factory } }, localStorage: { getItem: () => null, setItem() {} } },
    fetch(url, options) {
      const body = JSON.parse(options.body)
      requests.push(body)
      if (!body.force) return Promise.resolve({ ok: false, status: 409, json: () => Promise.resolve({ error: 'in-use', sessions: [{ sessionId: 's2', title: '另一个对话' }] }) })
      return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve({ ok: true }) })
    },
  })
  vm.runInContext(source.replace("return { inject: ['slots', 'locale'], apply: apply }", 'return { CapabilityRow, setActiveSession, ConfirmDialog }'), context)
  const ui = factory((name) => (name === 'react' ? React : null))
  ui.setActiveSession('s1')
  const render = () => { cursor = 0; return ui.CapabilityRow({ t: (k) => (k === 'inUseMessage' ? '{sessions} 正在用' : k), kind: 'skill', name: 'busy-skill', parkable: true, state: null, phase: 'idle' }) }
  const all = (tree, predicate, out = []) => {
    if (!tree || typeof tree !== 'object') return out
    if (Array.isArray(tree)) { tree.forEach((child) => all(child, predicate, out)); return out }
    if (predicate(tree)) out.push(tree)
    all(tree.children, predicate, out)
    return out
  }
  let tree = render()
  // The ⊘ button on the row (aria-label parkSkill) triggers the same park as the menu.
  const parkButton = all(tree, (n) => n.type === 'button' && n.props['aria-label'] === 'parkSkill')[0]
  assert.ok(parkButton, 'park button present')
  parkButton.props.onClick({})
  await new Promise((done) => setImmediate(done)); await new Promise((done) => setImmediate(done))
  assert.deepEqual(requests[0], { name: 'busy-skill', action: 'park', sessionId: 's1', force: false })
  tree = render()
  const dialog = all(tree, (n) => n.type === ui.ConfirmDialog)[0]
  assert.ok(dialog, 'confirmation shown instead of failing')
  assert.match(dialog.props.message, /另一个对话/)
  dialog.props.onConfirm()
  await new Promise((done) => setImmediate(done))
  assert.equal(requests[1].force, true, 'confirmed → forced')
})
