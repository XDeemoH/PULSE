// Ideas & branches (1.0.21): prefilter, extraction prompt / parsing, store operations,
// goal linkage, "maybe done" checks, turn slicing, host routes (capture, goal, check,
// backfill), and the client panel / goal-bar integration.
import test from 'node:test'
import assert from 'node:assert/strict'
import { execFile } from 'node:child_process'
import { mkdtempSync, mkdirSync, readFileSync, realpathSync, rmSync, writeFileSync } from 'node:fs'
import { basename, dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import vm from 'node:vm'
import { zstdCompressSync } from 'node:zlib'
import {
  IDEA_CAPACITY, addIdeas, assistantHasIdeas, donePrompt, extractPrompt, ideaTurns, ideasFor, markMaybeDone,
  normalizeIdea, parseDone, parseIdeas, patchIdea, syncGoal, turnsOf, userHasIdeas,
} from '../idea-core.js'

const testsRoot = realpathSync(dirname(fileURLToPath(import.meta.url)))
const helper = join(testsRoot, '..', 'test-support', 'route-host.mjs')
const CWD = 'H:\\Work\\Proj'

const LISTED = '做完了目标条，测试都过了。这一轮改了三个文件，补了两条测试，性能也没有变化。\n\n下一步可以考虑：\n1. 收集品地图\n2. 历史回填\n3. 单技能批次标签'

/* ── prefilter ─────────────────────────────────────────────────────── */

test('assistantHasIdeas: a cue near the end followed by a list; mid-answer advice or prose-only does not count', () => {
  assert.equal(assistantHasIdeas(LISTED), true)
  assert.equal(assistantHasIdeas('建议你先：\n- 看日志\n- 重启\n' + '后面是很长的正文，'.repeat(30)), false, 'cue early in the answer')
  assert.equal(assistantHasIdeas('正文'.repeat(40) + '下一步可以考虑收集品地图和历史回填。'), false, 'no list after the cue')
  assert.equal(assistantHasIdeas('短'), false)
  assert.equal(userHasIdeas('这个先不做，以后再说'), true)
  assert.equal(userHasIdeas('打包'), false)
})

/* ── extraction ───────────────────────────────────────────────────── */

test('extractPrompt carries turn markers and existing ideas; parseIdeas keeps batch turns only, dedupes and trims', () => {
  const prompt = extractPrompt([{ key: 'T3', user: '继续', assistant: LISTED }], ['历史回填'])
  assert.match(prompt, /### T3/)
  assert.match(prompt, /已有：\n- 历史回填/)
  const rows = parseIdeas('```json\n' + JSON.stringify([
    { turn: 'T3', source: 'assistant', text: '做收集品地图。' },
    { turn: '### T3', source: 'user', text: '做 收集品地图' },
    { turn: 'T9', text: '不在本批' },
    { turn: 'T3', text: '' },
    'junk',
  ]) + '\n```', ['T3'])
  assert.deepEqual(rows, [{ turn: 'T3', source: 'assistant', text: '做收集品地图' }], 'duplicate after normalization dropped')
  assert.deepEqual(parseIdeas('not json', ['T3']), [])
  assert.equal(normalizeIdea('做 收集品-地图！'), '做收集品地图')
})

/* ── store ─────────────────────────────────────────────────────────── */

test('addIdeas dedupes within a workspace (also against done ones) and keeps workspaces apart', () => {
  let { records, added } = addIdeas([], CWD, [{ text: '收集品地图', source: 'assistant', sessionId: 's', messageId: 'm' }, { text: '收集品 地图。' }], 10)
  assert.equal(added.length, 1, 'normalized duplicate in the same batch')
  ;({ records } = patchIdea(records, added[0].id, { status: 'done' }, 11))
  let again = addIdeas(records, 'h:/work/proj/', [{ text: '收集品地图' }])
  assert.equal(again.added.length, 0, 'a done idea is not re-added')
  again = addIdeas(records, 'H:\\Other', [{ text: '收集品地图' }])
  assert.equal(again.added.length, 1, 'other workspace is separate')
  assert.equal(addIdeas([], '', [{ text: 'x' }]).added.length, 0, 'no workspace, no ideas')
  const full = Array.from({ length: IDEA_CAPACITY }, (_, i) => ({ id: 'i' + i, workspace: 'x', text: 't' + i }))
  assert.equal(addIdeas(full, CWD, [{ text: 'one more' }]).added.length, 0, 'capacity is a hard limit')
})

test('patchIdea and syncGoal: ideas follow their goal (done / reopened / superseded / removed)', () => {
  let { records, added } = addIdeas([], CWD, [{ text: 'A' }, { text: 'B' }], 1)
  const [a, b] = added
  ;({ records } = patchIdea(records, a.id, { status: 'doing', goalId: 'g1' }, 2))
  let out = syncGoal(records, 'g1', 'done', 3)
  assert.equal(out.records.find((i) => i.id === a.id).status, 'done')
  out = syncGoal(out.records, 'g1', 'open', 4)
  assert.equal(out.records.find((i) => i.id === a.id).status, 'doing', 'reopened goal → in progress again')
  out = syncGoal(out.records, 'g1', 'stale', 5)
  const back = out.records.find((i) => i.id === a.id)
  assert.equal(back.status, 'open')
  assert.equal(back.goalId, '', 'superseded goal releases the idea')
  assert.equal(out.records.find((i) => i.id === b.id).status, 'open', 'unrelated idea untouched')
  assert.throws(() => patchIdea(records, 'nope', { status: 'done' }), { code: 'idea_not_found' })
  assert.throws(() => patchIdea(records, a.id, { status: 'weird' }), { code: 'idea_bad_status' })
})

test('ideasFor groups by status; maybe-done checks only flag open ideas and never change status', () => {
  let { records, added } = addIdeas([], CWD, [{ text: 'A' }, { text: 'B' }, { text: 'C' }], 1)
  ;({ records } = patchIdea(records, added[2].id, { status: 'dropped' }))
  const prompt = donePrompt(added.slice(0, 2).map((i) => ({ id: i.id, text: i.text })), [{ role: 'assistant', text: 'A 做完了' }])
  assert.match(prompt, /清单：/)
  const hits = parseDone(JSON.stringify([{ id: added[0].id, evidence: '助手说 A 做完了' }, { id: 'nope' }]), added.map((i) => i.id))
  assert.equal(hits.length, 1)
  const marked = markMaybeDone(records, hits, 9)
  const view = ideasFor(marked.records, CWD)
  assert.equal(view.counts.open, 2)
  assert.equal(view.counts.maybeDone, 1)
  assert.equal(view.open.find((i) => i.id === added[0].id).status, 'open', 'still open until confirmed')
  assert.equal(view.counts.done, 0)
  assert.equal(ideasFor(marked.records, 'H:\\Other').counts.open, 0)
})

/* ── turn slicing ──────────────────────────────────────────────────── */

let seq = 0
const ev = (type, data) => ({ seq: ++seq, type, time: seq * 1000, data })
const user = (text) => ev('user/message', { id: 'u' + seq, role: 'user', content: [{ type: 'text', text }] })
const reply = (id, text, turn) => ev('assistant/message', { turn, message: { id, role: 'assistant', content: [{ type: 'text', text }] } })
function sessionEvents() {
  seq = 0
  return [
    ev('session', { }), // header is added by the disk fixture
    ev('turn/start', { turn: 1 }), user('做目标条'), reply('a1', LISTED, 1), ev('turn/end', { turn: 1, reason: { kind: 'completed' } }),
    ev('turn/start', { turn: 2 }), user('这个先不做，以后再说'), reply('a2', '好的，记下了。', 2), ev('turn/end', { turn: 2 }),
    ev('turn/start', { turn: 3 }), user('打包'), reply('a3', '打好了。', 3), ev('turn/end', { turn: 3 }),
    ev('turn/start', { turn: 4 }), user('还在跑'), reply('a4', '…', 4),
  ]
}

test('turnsOf slices finished turns in both log orders; ideaTurns keeps the ones worth a model call', () => {
  const turns = turnsOf(sessionEvents())
  assert.deepEqual(turns.map((t) => [t.turn, t.user, t.messageId]), [[1, '做目标条', 'a1'], [2, '这个先不做，以后再说', 'a2'], [3, '打包', 'a3']])
  assert.deepEqual(ideaTurns(turns).map((t) => t.turn), [1, 2], 'listed directions + "later"; plain turns skipped')
  seq = 0
  const old = [user('旧格式'), ev('turn/start', { turn: 1 }), reply('b1', 'ok', 1), ev('turn/end', { turn: 1 })]
  assert.equal(turnsOf(old)[0].user, '旧格式')
})

/* ── host routes ───────────────────────────────────────────────────── */

function fixture(withHistory) {
  const base = mkdtempSync(join(testsRoot, 'pulse-routes-'))
  mkdirSync(join(base, '.dsh', 'running-panel'), { recursive: true })
  if (withHistory) {
    const dir = join(base, '.dsh', 'sessions', '--w--', 'session-old')
    mkdirSync(dir, { recursive: true })
    const events = sessionEvents()
    events[0] = { type: 'session', id: 'session-old', cwd: CWD }
    writeFileSync(join(dir, 'session.v4.jsonl.zstd'), zstdCompressSync(Buffer.from(events.map((e) => JSON.stringify(e)).join('\n') + '\n')))
  }
  return base
}
function run(base, steps, live = true) {
  const sessions = live ? [{ id: 's1', header: { cwd: CWD }, events: sessionEvents() }] : [{ id: 's1', header: { cwd: CWD } }]
  const env = { ...process.env, PULSE_TEST_LLM: 'json', PULSE_TEST_SESSIONS: JSON.stringify(sessions) }
  delete env.NODE_TEST_CONTEXT
  return new Promise((done, reject) => execFile(process.execPath, [helper, base, JSON.stringify(steps)], {
    env, encoding: 'utf8', timeout: 30000, maxBuffer: 8 * 1024 * 1024,
  }, (error, stdout, stderr) => {
    let store = null
    try { store = JSON.parse(readFileSync(join(base, '.dsh', 'running-panel', 'ideas.json'), 'utf8')) } catch { store = null }
    assert.equal(dirname(resolve(base)), testsRoot)
    assert.match(basename(base), /^pulse-routes-[A-Za-z0-9]+$/)
    rmSync(base, { recursive: true, force: true })
    if (error) return reject(new Error(stderr || error.message))
    done({ results: JSON.parse(stdout.trim().split('\n').pop()), store })
  }))
}
const I = '/dsh-running-panel/idea'
const view = I + '?session=s1'

test('capture: one model call for the cue turns, ideas linked to their message; re-capture is free', async () => {
  const { results, store } = await run(fixture(false), [
    { method: 'POST', path: I, body: { sessionId: 's1', capture: true } },
    { waitFor: view, until: 'ideas.state.capturing', equals: false },
    { method: 'POST', path: I, body: { sessionId: 's1', capture: true } },
    { waitFor: view, until: 'ideas.state.capturing', equals: false },
  ])
  const ideas = results[1].body.ideas
  assert.deepEqual(ideas.open.map((i) => i.text).sort(), ['方向 T1', '方向 T2'])
  assert.equal(ideas.open.find((i) => i.text === '方向 T1').messageId, 'a1', 'jump-back target')
  assert.equal(ideas.open[0].sessionId, 's1')
  const calls = results.at(-1).body.llmCalls
  assert.equal(calls.length, 1, 'second capture has nothing new to scan')
  assert.equal(calls[0].purpose, 'pulse-ideas')
  assert.equal(store.scanned.s1, 'a3', 'scan marker at the last finished turn')
})

test('an idea made into the goal is in progress, and completing the goal completes the idea', async () => {
  const { results } = await run(fixture(false), [
    { method: 'POST', path: I, body: { sessionId: 's1', text: '做收集品地图' } },
    { method: 'POST', path: I, body: { sessionId: 's1', goalFrom: '{{0:ideas.open.0.id}}' } },
    { method: 'PATCH', path: '/dsh-running-panel/goal', body: { id: '{{1:goal.current.id}}', status: 'done' } },
    { path: view },
  ])
  const [added, made, , after] = results
  assert.equal(added.body.ideas.open[0].source, 'manual')
  assert.equal(made.body.goal.current.title, '做收集品地图')
  assert.equal(made.body.ideas.doing[0].text, '做收集品地图')
  assert.equal(after.body.ideas.counts.done, 1, 'goal done → idea done')
  assert.equal(after.body.ideas.counts.doing, 0)
})

test('check marks ideas "maybe done" without completing them; PATCH confirms or dismisses', async () => {
  const { results } = await run(fixture(false), [
    { method: 'POST', path: I, body: { sessionId: 's1', text: '第一条' } },
    { method: 'POST', path: I, body: { sessionId: 's1', check: true } },
    { waitFor: view, until: 'ideas.state.checking', equals: false },
    { method: 'PATCH', path: I, body: { id: '{{0:ideas.open.0.id}}', dismissMaybe: true } },
    { method: 'PATCH', path: I, body: { id: '{{0:ideas.open.0.id}}', status: 'dropped' } },
  ])
  const checked = results[2].body.ideas
  assert.equal(checked.counts.maybeDone, 1)
  assert.equal(checked.open[0].maybeDone.evidence, '助手说已经做完了')
  assert.equal(results[3].body.ideas.counts.maybeDone, 0)
  assert.equal(results[4].body.ideas.counts.open, 0, 'dropped ideas leave the list')
})

test('backfill: estimate first, then collect from the workspace’s disk logs and mark them scanned', async () => {
  const { results, store } = await run(fixture(true), [
    { path: I + '?estimate=1&session=s1' },
    { method: 'POST', path: I, body: { sessionId: 's1', backfill: true } },
    { waitFor: view, until: 'ideas.state.backfill.running', equals: false },
  ], false)
  assert.deepEqual(results[0].body, { sessions: 1, turns: 2, calls: 1 })
  const ideas = results[2].body.ideas
  assert.equal(ideas.counts.open, 2)
  assert.ok(ideas.open.every((i) => i.source === 'history'))
  assert.equal(ideas.state.backfill.added, 2)
  assert.equal(store.scanned['session-old'], 'a3')
})

/* ── client ────────────────────────────────────────────────────────── */

const source = readFileSync(new URL('../client.js', import.meta.url), 'utf8').replace(/\r\n/g, '\n')
function harness() {
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
  const requests = []
  let factory
  const context = vm.createContext({
    window: { __ModuleLoader__: { load(module) { factory = module.factory } }, localStorage: { getItem: () => null, setItem() {} } },
    fetch(url, options) {
      requests.push({ url, method: (options && options.method) || 'GET', body: options && options.body ? JSON.parse(options.body) : null })
      return Promise.resolve({ ok: true, json: () => Promise.resolve({}) })
    },
  })
  vm.runInContext(source.replace("return { inject: ['slots', 'locale'], apply: apply }", 'return { GoalBar, IdeaPanel, setPref }'), context)
  const exports = factory((name) => (name === 'react' ? React : null))
  return { exports, requests, render(fn, effects = false) { runEffects = effects; cursor = 0; const out = fn(); runEffects = false; return out } }
}
function all(tree, predicate, out = []) {
  if (!tree || typeof tree !== 'object') return out
  if (Array.isArray(tree)) { tree.forEach((child) => all(child, predicate, out)); return out }
  if (predicate(tree)) out.push(tree)
  all(tree.children, predicate, out)
  return out
}
const t = (key) => key
const idea = (id, extra = {}) => ({ id, text: '灵感 ' + id, source: 'assistant', sessionId: 's1', messageId: 'm-' + id, status: 'open', maybeDone: null, createdAt: 1, doneAt: 0, ...extra })
const ideasView = (open = [], extra = {}) => ({ workspace: 'h:/work/proj', open, doing: [], done: [], counts: { open: open.length, doing: 0, done: 0, maybeDone: open.filter((i) => i.maybeDone).length }, state: {}, ...extra })
const emptyGoal = { workspace: 'h:/work/proj', current: null, history: [], doneCount: 0 }

test('idea panel: rows with source and jump-back; maybe-done rows ask to confirm; make-goal posts goalFrom', async () => {
  const ui = harness()
  const props = { t, sessionId: 's1', ideas: ideasView([idea('a'), idea('b', { maybeDone: { at: 1, evidence: '做完了' } })]) }
  let tree = ui.render(() => ui.exports.IdeaPanel(props))
  const rows = all(tree, (n) => n.props?.className === '__rp_idea')
  assert.equal(rows.length, 2)
  assert.ok(all(rows[1], (n) => n.props?.['data-kind'] === 'maybe').length, 'maybe-done chip')
  assert.ok(all(rows[1], (n) => n.type === 'button' && n.children.includes('ideaConfirmDone')).length)
  assert.equal(all(rows[1], (n) => n.type === 'button' && n.children.includes('ideaToGoal')).length, 0, 'confirm first, not make-goal')
  all(rows[0], (n) => n.type === 'button' && n.children.includes('ideaToGoal'))[0].props.onClick()
  await new Promise((done) => setImmediate(done))
  assert.deepEqual(ui.requests.at(-1), { url: '/dsh-running-panel/idea', method: 'POST', body: { sessionId: 's1', goalFrom: 'a' } })
  assert.ok(all(rows[0], (n) => n.type === 'button' && n.props.title === 'ideaJump').length, 'jump back to the conversation')
})

test('goal bar: with no goal the newest open idea is the proposal; it shows an ideas toggle and asks to capture once per round', async () => {
  const ui = harness()
  const props = { t, sessionId: 's1', sessionTitle: '会话标题', goal: emptyGoal, dsh: null, phase: 'idle', round: 2, ideas: ideasView([idea('x')]) }
  ui.render(() => ui.exports.GoalBar(props), true)
  assert.equal(ui.requests.filter((r) => r.body && r.body.capture).length, 0, 'no capture before consent')
  ui.exports.setPref('modelConsent', 'granted')
  ui.exports.setPref('collectIdeas', true)
  const next = { ...props, round: 3 }
  let tree = ui.render(() => ui.exports.GoalBar(next), true)
  ui.render(() => ui.exports.GoalBar(next), true)
  const captures = ui.requests.filter((r) => r.body && r.body.capture)
  assert.equal(captures.length, 1, 'one capture per session round')
  assert.equal(ui.requests.filter((r) => r.body && r.body.infer).length, 0, 'no model inference when an idea can be proposed')
  tree = ui.render(() => ui.exports.GoalBar(props))
  const bar = all(tree, (n) => n.props?.className === '__rp_goal')[0]
  assert.equal(bar.props['data-source'], 'idea')
  assert.match(JSON.stringify(tree), /灵感 x/)
  all(tree, (n) => n.type === 'button' && n.children.includes('goalAccept'))[0].props.onClick()
  await new Promise((done) => setImmediate(done))
  assert.deepEqual(ui.requests.at(-1).body, { sessionId: 's1', goalFrom: 'x' })
  assert.ok(all(tree, (n) => n.type === 'button' && /ideaBarCount/.test(n.children[0])).length, 'ideas toggle on the proposal bar')
})
