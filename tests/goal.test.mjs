// Goal layer (1.0.12): pure goal model, real host routes in a child process,
// and the client goal bar / focus helpers rendered with a shallow fake React.
import test from 'node:test'
import assert from 'node:assert/strict'
import { execFile } from 'node:child_process'
import { mkdtempSync, mkdirSync, readFileSync, realpathSync, rmSync } from 'node:fs'
import { basename, dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import vm from 'node:vm'
import {
  GOAL_TITLE_MAX, goalsFor, isGoal, openGoal, patchGoal, recordDshGoal, relevantSince, workspaceKey,
} from '../goal-core.js'

const testsRoot = realpathSync(dirname(fileURLToPath(import.meta.url)))
const helper = join(testsRoot, '..', 'test-support', 'route-host.mjs')
const CWD = 'H:\\Work\\Proj'

/* ── pure model ─────────────────────────────────────────────────────── */

test('workspaceKey: Windows paths ignore case, slash style and trailing separators', () => {
  assert.equal(workspaceKey('H:\\Work\\Proj\\'), workspaceKey('h:/work/proj'))
  assert.notEqual(workspaceKey('/home/a/Proj'), workspaceKey('/home/a/proj'), 'POSIX paths stay case-sensitive')
  assert.equal(workspaceKey(''), '')
  assert.equal(workspaceKey(undefined), '')
})

test('openGoal: one open goal per workspace; the previous one is superseded, never marked done', () => {
  let { records, goal: first } = openGoal([], { sessionId: 's1', cwd: CWD, title: '  ship   1.0.12 ', now: 10 })
  assert.equal(first.title, 'ship 1.0.12', 'whitespace collapsed')
  assert.equal(first.status, 'open')
  ;({ records } = openGoal(records, { sessionId: 's2', cwd: 'h:/work/proj/', title: 'second', now: 20 }))
  ;({ records } = openGoal(records, { sessionId: 's3', cwd: 'H:\\Other', title: 'elsewhere', now: 30 }))
  const view = goalsFor(records, CWD)
  assert.equal(view.current.title, 'second')
  assert.deepEqual(view.history.map((g) => [g.title, g.status]), [['ship 1.0.12', 'stale']])
  assert.equal(view.doneCount, 0, 'superseded is not done')
  assert.equal(goalsFor(records, 'H:\\Other').current.title, 'elsewhere', 'other workspaces untouched')
})

test('patchGoal: done, reopen (supersedes the other open goal), edit, confirm an inferred proposal', () => {
  let { records, goal: a } = openGoal([], { sessionId: 's', cwd: CWD, title: 'A', source: 'inferred', now: 1 })
  ;({ records } = patchGoal(records, a.id, { status: 'done' }, 2))
  assert.equal(goalsFor(records, CWD).current, null)
  assert.equal(goalsFor(records, CWD).doneCount, 1)
  let b
  ;({ records, goal: b } = openGoal(records, { sessionId: 's', cwd: CWD, title: 'B', now: 3 }))
  ;({ records } = patchGoal(records, a.id, { status: 'open', title: 'A again', source: 'owner' }, 4))
  const view = goalsFor(records, CWD)
  assert.equal(view.current.title, 'A again')
  assert.equal(view.current.source, 'owner', 'editing confirms the proposal')
  assert.equal(view.current.doneAt, 0)
  assert.deepEqual(view.history.map((g) => [g.id, g.status]), [[b.id, 'stale']])
  assert.throws(() => patchGoal(records, 'nope', { status: 'done' }), { code: 'goal_not_found' })
  assert.throws(() => patchGoal(records, a.id, { status: 'archived' }), { code: 'goal_bad_status' })
  assert.throws(() => patchGoal(records, a.id, { title: '   ' }), { code: 'goal_title_empty' })
  assert.throws(() => patchGoal(records, a.id, { title: '字'.repeat(GOAL_TITLE_MAX + 1) }), { code: 'goal_title_too_long' })
})

test('recordDshGoal: a completed DSH /goal is recorded once as done history', () => {
  const input = { sessionId: 's', cwd: CWD, dshGoalId: 'g-1', title: 'native objective', now: 5 }
  let { records, goal } = recordDshGoal([], input)
  assert.equal(goal.status, 'done')
  assert.equal(goal.source, 'dsh')
  const again = recordDshGoal(records, input)
  assert.equal(again.goal, null)
  assert.equal(again.records.length, 1)
  const view = goalsFor(records, CWD)
  assert.equal(view.current, null, 'a DSH goal never becomes the PULSE current goal')
  assert.equal(view.history[0].dsh, true)
  assert.throws(() => recordDshGoal([], { ...input, dshGoalId: '' }), { code: 'goal_dsh_id_required' })
})

test('relevantSince: no goal dims nothing; with a goal only rows used since it started stay bright', () => {
  assert.equal(relevantSince(undefined, 0), true)
  assert.equal(relevantSince({ at: 1 }, 0), true)
  assert.equal(relevantSince(undefined, 100), false, 'never used this session')
  assert.equal(relevantSince({ at: 99 }, 100), false)
  assert.equal(relevantSince({ at: 100 }, 100), true)
  assert.equal(isGoal({ kind: 'goal' }), true)
  assert.equal(isGoal({ id: 'echo-1' }), false)
})

/* ── host routes ────────────────────────────────────────────────────── */

function runRoutes(steps, sessions) {
  const base = mkdtempSync(join(testsRoot, 'pulse-routes-'))
  mkdirSync(join(base, '.dsh', 'running-panel'), { recursive: true })
  const env = { ...process.env, PULSE_TEST_SESSIONS: JSON.stringify(sessions) }
  delete env.NODE_TEST_CONTEXT
  return new Promise((done, reject) => execFile(process.execPath, [helper, base, JSON.stringify(steps)], {
    env, encoding: 'utf8', timeout: 20000, maxBuffer: 8 * 1024 * 1024,
  }, (error, stdout, stderr) => {
    const store = (() => {
      try { return JSON.parse(readFileSync(join(base, '.dsh', 'running-panel', 'echoes.json'), 'utf8')) } catch { return null }
    })()
    assert.equal(dirname(resolve(base)), testsRoot)
    assert.match(basename(base), /^pulse-routes-[A-Za-z0-9]+$/)
    rmSync(base, { recursive: true, force: true })
    if (error) return reject(new Error(stderr || error.message))
    done({ results: JSON.parse(stdout.trim().split('\n').pop()), store })
  }))
}

test('goal routes: create, supersede, complete, DSH record, delete; Echo listing never shows goals', async () => {
  const sessions = [
    { id: 's1', header: { cwd: CWD } },
    { id: 's2', header: { cwd: 'h:/work/proj' } },
    { id: 'nocwd', header: {} },
  ]
  const G = '/dsh-running-panel/goal'
  const { results, store } = await runRoutes([
    { method: 'POST', path: G, body: { sessionId: 's1', title: 'first goal' } },
    { method: 'POST', path: G, body: { sessionId: 's2', title: 'second goal', source: 'inferred' } },
    { method: 'GET', path: G + '?session=s1' },
    { method: 'POST', path: G, body: { sessionId: 's1', dsh: { id: 'dsh-7', objective: 'native', createdAt: 3 } } },
    { method: 'POST', path: G, body: { sessionId: 's1', dsh: { id: 'dsh-7', objective: 'native', createdAt: 3 } } },
    { method: 'GET', path: '/dsh-running-panel/echo?all=1' },
    { method: 'POST', path: G, body: { sessionId: 'gone', title: 'x' } },
    { method: 'POST', path: G, body: { sessionId: 'nocwd', title: 'x' } },
    { method: 'POST', path: G, body: { sessionId: 's1', title: '' } },
    { method: 'POST', path: G, body: { sessionId: 's1', title: 'x' }, headers: { 'sec-fetch-site': 'cross-site' } },
    { method: 'PATCH', path: G, body: { id: 'missing', status: 'done' } },
  ], sessions)
  const [create1, create2, get, dsh, dshAgain, echoes, gone, nocwd, empty, cross, missing] = results
  assert.equal(create1.status, 200)
  assert.equal(create2.status, 200)
  assert.equal(create2.body.goal.current.title, 'second goal', 's2 shares the workspace with s1')
  assert.equal(create2.body.goal.current.source, 'inferred')
  assert.deepEqual(get.body.goal.history.map((g) => [g.title, g.status]), [['first goal', 'stale']])
  assert.equal(dsh.body.goal.history[0].title, 'native')
  assert.equal(dshAgain.body.duplicate, true)
  assert.deepEqual(echoes.body.echoes, [], 'goals are not Echo cards')
  assert.equal(echoes.body.capacity.count, 3, 'but they share the Echo capacity')
  assert.equal(gone.status, 404)
  assert.equal(nocwd.status, 409)
  assert.equal(empty.status, 400)
  assert.equal(empty.body.error, 'goal_title_empty')
  assert.equal(cross.status, 403)
  assert.equal(missing.status, 404)
  assert.equal(store.echoes.filter((r) => r.kind === 'goal').length, 3, 'persisted to echoes.json')
})

test('goal routes: snapshot carries the goal; PATCH done / reopen and DELETE; Echo DELETE cannot remove a goal', async () => {
  const sessions = [{ id: 's1', header: { cwd: CWD } }]
  const G = '/dsh-running-panel/goal'
  const { results, store } = await runRoutes([
    { method: 'POST', path: G, body: { sessionId: 's1', title: 'finish me' } },
    { method: 'GET', path: '/dsh-running-panel/snapshot?session=s1' },
    { method: 'PATCH', path: G, body: { id: '{{0:goal.current.id}}', status: 'done' } },
    { method: 'DELETE', path: '/dsh-running-panel/echo?id={{0:goal.current.id}}' },
    { method: 'PATCH', path: G, body: { id: '{{0:goal.current.id}}', status: 'open', title: 'finish me, really' } },
    { method: 'POST', path: G, body: { sessionId: 's1', title: 'throwaway' } },
    { method: 'DELETE', path: G + '?id={{5:goal.current.id}}' },
    { method: 'DELETE', path: G + '?id={{5:goal.current.id}}' },
  ], sessions)
  const [create, snapshot, done, echoDelete, reopen, , removed, removedAgain] = results
  const id = create.body.goal.current.id
  assert.match(id, /^goal-/)
  assert.equal(snapshot.status, 200)
  assert.equal(snapshot.body.goal.current.id, id, 'the session snapshot carries the workspace goal')
  assert.equal(done.body.goal.current, null)
  assert.equal(done.body.goal.doneCount, 1)
  assert.equal(echoDelete.status, 404, 'the Echo route does not see goals')
  assert.equal(reopen.body.goal.current.title, 'finish me, really')
  assert.equal(removed.status, 200)
  assert.equal(removed.body.goal.current, null, 'deleting the replacement leaves no open goal')
  assert.deepEqual(removed.body.goal.history.map((g) => [g.title, g.status]), [['finish me, really', 'stale']])
  assert.equal(removedAgain.status, 404)
  assert.equal(store.echoes.length, 1)
})

/* ── client: goal bar and focus helpers ─────────────────────────────── */

const source = readFileSync(new URL('../client.js', import.meta.url), 'utf8').replace(/\r\n/g, '\n')

function hooks() {
  const slots = []
  let cursor = 0
  const React = {
    Fragment: 'Fragment',
    createElement(type, props, ...children) { return { type, props: props || {}, children } },
    useState(initial) {
      const id = cursor++
      if (!(id in slots)) slots[id] = typeof initial === 'function' ? initial() : initial
      return [slots[id], (value) => { slots[id] = typeof value === 'function' ? value(slots[id]) : value }]
    },
    useRef(initial) { const id = cursor++; return slots[id] || (slots[id] = { current: initial }) },
    useEffect() { cursor++ },
    useMemo(callback) { cursor++; return callback() },
    useCallback(callback) { cursor++; return callback },
    createContext(value) { return { _value: value, Provider: 'Provider' } },
    useContext(context) { return context._value },
  }
  return { React, render(fn) { cursor = 0; return fn() } }
}
function all(tree, predicate, out = []) {
  if (!tree || typeof tree !== 'object') return out
  if (Array.isArray(tree)) { tree.forEach((child) => all(child, predicate, out)); return out }
  if (predicate(tree)) out.push(tree)
  all(tree.children, predicate, out)
  return out
}
const text = (tree) => all(tree, () => true).flatMap((n) => n.children.filter((c) => typeof c === 'string')).join(' ')

function goalHarness(extra = {}) {
  const runtime = hooks()
  const requests = []
  let factory
  const context = vm.createContext({
    window: { __ModuleLoader__: { load(module) { factory = module.factory } }, localStorage: { getItem: () => null, setItem() {} } },
    fetch(url, options) {
      requests.push({ url, method: options.method, body: options.body ? JSON.parse(options.body) : null })
      return Promise.resolve({ ok: true, json: () => Promise.resolve({ ok: true }) })
    },
    ...extra,
  })
  const instrumented = source.replace("return { inject: ['slots', 'locale'], apply: apply }",
    'return { GoalBar, GoalInput, goalFocusSince, goalRelevant, readDshGoal, dshGoalLive, setPref, prefs, SettingsSheet, useSnapshot, LibraryGroup, FocusContext }')
  vm.runInContext(instrumented, context)
  const exports = factory((name) => {
    if (name === 'react') return runtime.React
    if (name === 'react-dom') return null
    throw new Error('unexpected module ' + name)
  })
  return { exports, runtime, requests }
}
const t = (key) => key
const pulseView = (current, history = [], doneCount = 0) => ({ workspace: 'h:/work/proj', current, history, doneCount })

test('goal bar: no goal + session title shows a ? proposal that writes nothing until accepted', async () => {
  const { exports, runtime, requests } = goalHarness()
  const props = { t, sessionId: 's1', sessionTitle: '重构 client.js', goal: pulseView(null), dsh: null }
  let tree = runtime.render(() => exports.GoalBar(props))
  const bar = all(tree, (n) => n.props?.className === '__rp_goal')[0]
  assert.equal(bar.props['data-kind'], 'proposal')
  assert.match(text(tree), /重构 client\.js/)
  assert.equal(requests.length, 0, 'showing a proposal never writes')
  all(tree, (n) => n.type === 'button' && n.children.includes('goalAccept'))[0].props.onClick()
  await new Promise((done) => setImmediate(done))
  assert.deepEqual(requests[0], { url: '/dsh-running-panel/goal', method: 'POST', body: { sessionId: 's1', title: '重构 client.js', source: 'inferred' } })
})

test('goal bar: a live DSH /goal wins and is read-only; the PULSE goal shows when DSH is complete', () => {
  const { exports, runtime } = goalHarness()
  const dsh = { id: 'g', objective: 'native objective', phase: 'active', rounds: 2, max: 8, createdAt: 50, blocked: '' }
  const pulse = pulseView({ id: 'p', title: 'pulse goal', source: 'owner', createdAt: 10 }, [], 3)
  let tree = runtime.render(() => exports.GoalBar({ t, sessionId: 's1', goal: pulse, dsh }))
  let bar = all(tree, (n) => n.props?.className === '__rp_goal')[0]
  assert.equal(bar.props['data-kind'], 'dsh')
  assert.match(text(tree), /native objective/)
  bar.props.onClick()
  tree = runtime.render(() => exports.GoalBar({ t, sessionId: 's1', goal: pulse, dsh }))
  assert.match(text(tree), /goalDshManaged/)
  assert.equal(all(tree, (n) => n.type === 'button' && n.children.includes('goalDone')).length, 0, 'no PULSE verbs on a DSH goal')

  const fresh = goalHarness()
  tree = fresh.runtime.render(() => fresh.exports.GoalBar({ t, sessionId: 's1', goal: pulse, dsh: { ...dsh, phase: 'complete' } }))
  bar = all(tree, (n) => n.props?.className === '__rp_goal')[0]
  assert.equal(bar.props['data-kind'], 'pulse')
  assert.match(text(tree), /pulse goal/)
})

test('goal bar: the drawer edits the PULSE goal; IME Enter does not submit; Done sends status', async () => {
  const { exports, runtime, requests } = goalHarness()
  const props = { t, sessionId: 's1', goal: pulseView({ id: 'p1', title: 'old', source: 'owner', createdAt: 1 }), dsh: null }
  let tree = runtime.render(() => exports.GoalBar(props))
  all(tree, (n) => n.props?.className === '__rp_goal')[0].props.onClick()
  tree = runtime.render(() => exports.GoalBar(props))
  all(tree, (n) => n.type === 'button' && n.children.includes('goalEdit'))[0].props.onClick()
  tree = runtime.render(() => exports.GoalBar(props))
  // GoalInput is a child component; render it directly with the props the bar passed.
  const inputNode = all(tree, (n) => typeof n.type === 'function' && n.props.initial === 'old')[0]
  assert.ok(inputNode, 'edit opens the inline input prefilled with the current title')
  // A second module instance gives the input its own hook slots; onSubmit still calls the bar's patch().
  const inputHarness = goalHarness()
  const renderInput = () => inputHarness.runtime.render(() => inputHarness.exports.GoalInput(inputNode.props))
  let input = all(renderInput(), (n) => n.type === 'input')[0]
  input.props.onChange({ target: { value: 'new title' } })
  input = all(renderInput(), (n) => n.type === 'input')[0]
  input.props.onKeyDown({ key: 'Enter', preventDefault() {}, nativeEvent: { isComposing: true } })
  assert.equal(requests.length, 0, 'IME candidate Enter must not save')
  input.props.onKeyDown({ key: 'Enter', preventDefault() {}, nativeEvent: { isComposing: false, keyCode: 13 } })
  await new Promise((done) => setImmediate(done))
  assert.deepEqual(requests[0].body, { id: 'p1', title: 'new title', confirm: true })
  assert.equal(requests[0].method, 'PATCH')

  tree = runtime.render(() => exports.GoalBar(props))
  const done = all(tree, (n) => n.type === 'button' && n.children.includes('goalDone'))[0]
  done.props.onClick()
  await new Promise((resolveTick) => setImmediate(resolveTick))
  assert.deepEqual(requests[1].body, { id: 'p1', status: 'done' })
})

test('focus helpers: DSH goal start wins while live; no goal means no dimming', () => {
  const { exports } = goalHarness()
  const pulse = pulseView({ id: 'p', title: 'x', createdAt: 10 })
  assert.equal(exports.goalFocusSince(null, pulse), 10)
  assert.equal(exports.goalFocusSince({ phase: 'active', createdAt: 50 }, pulse), 50)
  assert.equal(exports.goalFocusSince({ phase: 'complete', createdAt: 50 }, pulse), 10)
  assert.equal(exports.goalFocusSince(null, pulseView(null)), 0)
  assert.equal(exports.goalFocusSince(null, null), 0)
  assert.equal(exports.goalRelevant(undefined, 0), true)
  assert.equal(exports.goalRelevant({ at: 9 }, 10), false)
  assert.equal(exports.goalRelevant({ at: 10 }, 10), true)
  assert.equal(exports.prefs.focusMode, false, 'focus mode is off by default')
})

test('readDshGoal maps the DSH goal projection and tolerates absent / malformed values', () => {
  const { exports } = goalHarness()
  const face = (value) => ({ getSnapshot: () => value })
  assert.equal(exports.readDshGoal(face(null)), null)
  assert.equal(exports.readDshGoal(face({ goal: {} })), null)
  assert.equal(exports.readDshGoal({ getSnapshot() { throw new Error('closed') } }), null)
  const goal = exports.readDshGoal(face({
    goal: { id: 'g', objective: 'do it', phase: 'blocked', blockedReason: { code: 'x', message: 'needs input' }, maxGoalRounds: 12, revision: 3 },
    roundsStarted: 4, createdAt: 77, updatedAt: 80,
  }))
  assert.deepEqual({ ...goal }, { id: 'g', revision: 3, objective: 'do it', phase: 'blocked', rounds: 4, max: 12, createdAt: 77, blocked: 'needs input' })
})

test('settings sheet shows the plugin version reported by the snapshot stream, bottom-right', () => {
  let source
  class FakeEventSource { constructor() { source = this } close() {} }
  const { exports, runtime } = goalHarness({ EventSource: FakeEventSource })
  const sheet = () => runtime.render(() => exports.SettingsSheet({ t }))
  assert.equal(all(sheet(), (n) => n.props?.className === '__rp_sheetVersion').length, 0, 'nothing before the first snapshot')
  // useSnapshot belongs to the same module instance; run its effect once and push one frame through it.
  const useEffect = runtime.React.useEffect
  runtime.React.useEffect = (callback) => { callback() }
  runtime.render(() => exports.useSnapshot('/dsh-running-panel/stream?session=s1'))
  runtime.React.useEffect = useEffect
  source.onmessage({ data: JSON.stringify({ pluginVersion: '1.0.12' }) })
  const version = all(sheet(), (n) => n.props?.className === '__rp_sheetVersion')
  assert.equal(version.length, 1)
  assert.equal(version[0].children[0], 'PULSE v1.0.12')
})

test('focus mode: a collapsed install group dims only when none of its items ran since the goal started', () => {
  const { exports, runtime } = goalHarness()
  const items = [{ name: 'a', state: { at: 5 } }, { name: 'b' }]
  const header = (since, list) => {
    exports.FocusContext._value = since
    const tree = runtime.render(() => exports.LibraryGroup({ t, kind: 'skill', lib: 'repo:x/y', items: list, phase: 'idle' }))
    return all(tree, (n) => n.props?.className === '__rp_libRow')[0].props['data-unfocused']
  }
  assert.equal(header(0, items), undefined, 'no goal, no dimming')
  assert.equal(header(10, items), '1', 'nothing in the group ran after the goal started')
  assert.equal(header(10, [{ name: 'a', state: { at: 12 } }, { name: 'b' }]), undefined, 'one relevant item keeps the group bright')
})
