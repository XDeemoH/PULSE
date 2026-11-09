// Skill profiles (1.0.23): save / rename / overwrite / delete, switch plans (park, restore,
// keep new, keep in-use, missing), apply through the undoable park path, and undo a switch.
import test from 'node:test'
import assert from 'node:assert/strict'
import { execFile } from 'node:child_process'
import { existsSync, mkdtempSync, mkdirSync, readFileSync, realpathSync, rmSync, writeFileSync } from 'node:fs'
import { basename, dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import vm from 'node:vm'
import { activeProfile, removeProfile, saveProfile, switchPlan, updateProfile } from '../profile-core.js'

const testsRoot = realpathSync(dirname(fileURLToPath(import.meta.url)))
const helper = join(testsRoot, '..', 'test-support', 'route-host.mjs')

/* ── pure ───────────────────────────────────────────────────────────── */

test('save / update / remove profiles with name rules', () => {
  let { profiles, profile } = saveProfile([], { name: '  写代码 ', skills: ['b', 'a', 'a'], libs: ['lib1'] }, 1)
  assert.equal(profile.name, '写代码')
  assert.deepEqual(profile.skills, ['a', 'b'], 'deduped and sorted')
  assert.throws(() => saveProfile(profiles, { name: '写代码', skills: [] }), { code: 'profile_name_taken' })
  assert.throws(() => saveProfile(profiles, { name: '  ', skills: [] }), { code: 'profile_name_empty' })
  ;({ profiles } = updateProfile(profiles, profile.id, { name: '编程', skills: ['c'] }, 2))
  assert.equal(profiles[0].name, '编程')
  assert.deepEqual(profiles[0].skills, ['c'])
  assert.deepEqual(removeProfile(profiles, profile.id), [])
  assert.throws(() => removeProfile([], 'x'), { code: 'profile_not_found' })
})

test('switchPlan: parks known skills outside the profile, restores cold ones in it, keeps new and in-use, reports missing', () => {
  const profiles = [
    { id: 'code', name: '写代码', skills: ['tdd', 'review', 'gone'] },
    { id: 'video', name: '剪视频', skills: ['shotcraft', 'review'] },
  ]
  const plan = switchPlan(
    profiles, 'code',
    ['review', 'shotcraft', 'brand-new', 'busy'],
    [{ name: 'tdd', directoryName: 'tdd-dir' }],
    new Map([['shotcraft', [{ sessionId: 's2', title: '剪片' }]]]),
    new Set(['review', 'shotcraft', 'brand-new', 'busy']),
  )
  assert.deepEqual(plan.park, [], 'shotcraft is in use elsewhere; busy is in no profile')
  assert.deepEqual(plan.keepInUse.map((r) => r.name), ['shotcraft'])
  assert.deepEqual(plan.keepNew, ['brand-new', 'busy'])
  assert.deepEqual(plan.restore, [{ name: 'tdd', directoryName: 'tdd-dir' }])
  assert.deepEqual(plan.missing, ['gone'])
  const free = switchPlan(profiles, 'code', ['review', 'shotcraft'], [], new Map(), new Set(['review', 'shotcraft']))
  assert.deepEqual(free.park, ['shotcraft'])
  assert.equal(activeProfile(profiles, ['shotcraft', 'review', 'brand-new']), 'video', 'unknown skills do not break the match')
  assert.equal(activeProfile(profiles, ['review']), '')
})

/* ── host ───────────────────────────────────────────────────────────── */

function fixture(names) {
  const base = mkdtempSync(join(testsRoot, 'pulse-routes-'))
  for (const name of names) {
    mkdirSync(join(base, '.agents', 'skills', name), { recursive: true })
    writeFileSync(join(base, '.agents', 'skills', name, 'SKILL.md'), '---\nname: ' + name + '\ndescription: d\n---\n')
  }
  mkdirSync(join(base, '.dsh', 'running-panel'), { recursive: true })
  return base
}
function run(base, steps, emit = []) {
  const env = {
    ...process.env,
    PULSE_TEST_SESSIONS: JSON.stringify([{ id: 's1', header: { cwd: 'H:\\w' } }, { id: 's2', header: { cwd: 'H:\\w' } }]),
    PULSE_TEST_EMIT: JSON.stringify(emit),
  }
  delete env.NODE_TEST_CONTEXT
  return new Promise((done, reject) => execFile(process.execPath, [helper, base, JSON.stringify(steps)], {
    env, encoding: 'utf8', timeout: 30000, maxBuffer: 8 * 1024 * 1024,
  }, (error, stdout, stderr) => {
    const live = (name) => existsSync(join(base, '.agents', 'skills', name))
    const state = { a: live('a'), b: live('b'), c: live('c') }
    assert.equal(dirname(resolve(base)), testsRoot)
    assert.match(basename(base), /^pulse-routes-[A-Za-z0-9]+$/)
    rmSync(base, { recursive: true, force: true })
    if (error) return reject(new Error(stderr || error.message))
    done({ results: JSON.parse(stdout.trim().split('\n').pop()), state })
  }))
}
const R = '/dsh-running-panel/profiles'

test('profiles route: save, switch (park + restore through the undoable path), and undo the switch', async () => {
  const { results, state } = await run(fixture(['a', 'b', 'c']), [
    { method: 'POST', path: R, body: { name: '全部', libs: ['x'] } },                                   // 0: a b c
    { method: 'POST', path: '/dsh-running-panel/park', body: { name: 'c', action: 'park' } },           // 1
    { method: 'POST', path: R, body: { name: '精简' } },                                                // 2: a b
    { method: 'POST', path: R, body: { preview: '{{0:profiles.0.id}}', sessionId: 's1' } },             // 3: → 全部
    { method: 'POST', path: R, body: { apply: '{{3:switchId}}' } },                                     // 4: restore c
    { method: 'POST', path: R, body: { preview: '{{2:profiles.1.id}}', sessionId: 's1' } },             // 5: → 精简
    { method: 'POST', path: R, body: { apply: '{{5:switchId}}' } },                                     // 6: park c
    { method: 'POST', path: R, body: { undo: true } },                                                   // 7: c back
    { method: 'POST', path: R, body: { apply: '{{5:switchId}}' } },                                     // 8: preview is single-use
    { method: 'POST', path: R, body: { name: '全部' } },                                                // 9: duplicate name
    { path: '/dsh-running-panel/snapshot?session=s1' },                                                // 10
  ])
  assert.deepEqual(results[0].body.profiles[0].skills, ['a', 'b', 'c'])
  assert.deepEqual(results[0].body.profiles[0].libs, ['x'])
  assert.deepEqual(results[2].body.profiles[1].skills, ['a', 'b'])
  assert.deepEqual(results[3].body.restore.map((r) => r.name), ['c'])
  assert.deepEqual(results[3].body.park, [])
  assert.deepEqual(results[4].body.restored, ['c'])
  assert.deepEqual(results[4].body.libs, ['x'], 'pinned libraries come with the profile')
  assert.equal(results[4].body.view.active, results[0].body.profiles[0].id, 'now matches 全部')
  assert.deepEqual(results[5].body.park, ['c'])
  assert.deepEqual(results[6].body.parked, ['c'])
  assert.ok(results[6].body.view.lastSwitch.planId, 'the park half is journaled for undo')
  assert.equal(results[7].body.ok, true)
  assert.equal(results[7].body.view.lastSwitch, null)
  assert.equal(results[8].status, 409)
  assert.equal(results[8].body.error, 'plan-expired')
  assert.equal(results[9].status, 409)
  assert.equal(results[10].body.undoError, null, 'the undo journal stays valid after a profile switch')
  assert.deepEqual(state, { a: true, b: true, c: true }, 'after undo c is enabled again')
})

test('profiles route: switching keeps skills another conversation is using', async () => {
  const { results, state } = await run(fixture(['a', 'b']), [
    { method: 'POST', path: R, body: { name: '两个' } },
    { method: 'PATCH', path: R, body: { id: '{{0:profiles.0.id}}', name: '两个技能' } },
    { method: 'POST', path: R, body: { name: '只有 b' } },
    { method: 'PATCH', path: R, body: { id: '{{2:profiles.1.id}}', overwrite: true } },
  ], [['tools/result', { agent: { id: 's2' }, name: 'skill', arguments: '{"name":"a"}' }, { isError: false }]])
  assert.equal(results[1].body.profiles[0].name, '两个技能')
  // Make "只有 b" really contain only b, then preview from s1 while s2 uses a.
  const second = await run(fixture(['a', 'b']), [
    { method: 'POST', path: R, body: { name: '全部' } },
    { method: 'POST', path: '/dsh-running-panel/park', body: { name: 'a', action: 'park', force: true } },
    { method: 'POST', path: R, body: { name: '只有 b' } },
    { method: 'POST', path: '/dsh-running-panel/park', body: { names: ['a'], action: 'restore' } },
    { method: 'POST', path: R, body: { preview: '{{2:profiles.1.id}}', sessionId: 's1' } },
  ], [['tools/result', { agent: { id: 's2' }, name: 'skill', arguments: '{"name":"a"}' }, { isError: false }]])
  const preview = second.results[4].body
  assert.deepEqual(preview.park, [])
  assert.deepEqual(preview.keepInUse.map((r) => [r.name, r.sessions[0].sessionId]), [['a', 's2']])
  assert.equal(state.a && state.b, true)
})

/* ── client ─────────────────────────────────────────────────────────── */

const source = readFileSync(new URL('../client.js', import.meta.url), 'utf8').replace(/\r\n/g, '\n')
test('profiles dialog previews before switching and offers undo after', async () => {
  const slots = []
  let cursor = 0
  let runEffects = false
  const React = {
    Fragment: 'Fragment',
    createElement(type, props, ...children) { return { type, props: props || {}, children } },
    useState(initial) { const id = cursor++; if (!(id in slots)) slots[id] = typeof initial === 'function' ? initial() : initial; return [slots[id], (v) => { slots[id] = typeof v === 'function' ? v(slots[id]) : v }] },
    useRef(initial) { const id = cursor++; return slots[id] || (slots[id] = { current: initial }) },
    useEffect(callback) { cursor++; if (runEffects) callback() },
    useMemo(callback) { cursor++; return callback() },
    useCallback(callback) { cursor++; return callback },
    createContext(value) { return { _value: value, Provider: 'Provider' } },
    useContext(context) { return context._value },
  }
  const view = { profiles: [{ id: 'p1', name: '写代码', skills: ['a'], libs: [], count: 1 }], active: '', lastSwitch: null, liveCount: 2 }
  const preview = { switchId: 'sw1', profileName: '写代码', park: ['b'], restore: [], keepNew: [], keepInUse: [], missing: [] }
  const applied = { ok: true, parked: ['b'], restored: [], failed: [], libs: [], view: Object.assign({}, view, { active: 'p1', lastSwitch: { profileName: '写代码' } }) }
  const requests = []
  let factory
  const context = vm.createContext({
    window: { __ModuleLoader__: { load(module) { factory = module.factory } }, localStorage: { getItem: () => null, setItem() {} } },
    fetch(url, options) {
      const body = options && options.body ? JSON.parse(options.body) : null
      requests.push({ method: (options && options.method) || 'GET', body })
      const value = !body ? view : body.preview ? preview : body.apply ? applied : view
      return Promise.resolve({ ok: true, json: () => Promise.resolve(value) })
    },
  })
  vm.runInContext(source.replace("return { inject: ['slots', 'locale'], apply: apply }", 'return { ProfilesDialog }'), context)
  const ui = factory((name) => (name === 'react' ? React : null))
  const all = (tree, predicate, out = []) => {
    if (!tree || typeof tree !== 'object') return out
    if (Array.isArray(tree)) { tree.forEach((child) => all(child, predicate, out)); return out }
    if (predicate(tree)) out.push(tree)
    all(tree.children, predicate, out)
    return out
  }
  const t = (k) => k
  const render = (effects = false) => { runEffects = effects; cursor = 0; const out = ui.ProfilesDialog({ t, sessionId: 's1', onClose() {} }); runEffects = false; return out }
  const flush = async () => { await new Promise((d) => setImmediate(d)); await new Promise((d) => setImmediate(d)) }
  render(true)
  await flush()
  let tree = render()
  all(tree, (n) => n.type === 'button' && n.children.includes('profileSwitch'))[0].props.onClick()
  await flush()
  assert.deepEqual(requests.at(-1).body, { preview: 'p1', sessionId: 's1' })
  tree = render()
  assert.ok(all(tree, (n) => n.props?.['data-kind'] === 'park').length, 'preview lists what will be parked')
  assert.equal(requests.filter((r) => r.body && r.body.apply).length, 0, 'nothing moves before confirming')
  all(tree, (n) => n.type === 'button' && n.children.includes('profileConfirm'))[0].props.onClick({ nativeEvent: {} })
  await flush()
  assert.deepEqual(requests.at(-1).body, { apply: 'sw1' })
  tree = render()
  assert.ok(all(tree, (n) => n.type === 'button' && n.children.includes('profileUndo')).length, 'undo offered after switching')
})
