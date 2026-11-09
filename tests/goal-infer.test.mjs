// Model-inferred goal proposals (1.0.16): prompt and parsing, the host inference
// through a fake DSH llm, and the goal bar showing / requesting the proposal.
import test from 'node:test'
import assert from 'node:assert/strict'
import { execFile } from 'node:child_process'
import { mkdtempSync, mkdirSync, readFileSync, realpathSync, rmSync } from 'node:fs'
import { basename, dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import vm from 'node:vm'
import { INFER_CONTEXT_CHARS, INFER_TITLE_MAX, inferPrompt, parseInferred } from '../goal-core.js'

const testsRoot = realpathSync(dirname(fileURLToPath(import.meta.url)))
const helper = join(testsRoot, '..', 'test-support', 'route-host.mjs')

test('inferPrompt keeps the newest turns within the budget and labels speakers', () => {
  assert.equal(inferPrompt([]), '')
  assert.equal(inferPrompt([{ role: 'tool', text: 'x' }, { role: 'user', text: '   ' }]), '')
  const floors = Array.from({ length: 20 }, (_, i) => ({ role: i % 2 ? 'assistant' : 'user', text: '第' + i + '楼 ' + 'x'.repeat(500) }))
  const prompt = inferPrompt(floors)
  assert.match(prompt, /用户：第18楼/)
  assert.match(prompt, /助手：第19楼/)
  assert.doesNotMatch(prompt, /第0楼/, 'old turns fall out of the budget')
  const body = prompt.split('\n').filter((line) => /^(用户|助手)：/.test(line)).join('')
  assert.ok(body.length <= INFER_CONTEXT_CHARS + 200)
  assert.match(prompt, /NONE/)
})

test('parseInferred strips decorations, honours NONE and caps the length', () => {
  assert.equal(parseInferred('目标：「给面板加目标条」。'), '给面板加目标条')
  assert.equal(parseInferred('```\n修复 Echo 详情一直加载中\n```'), '修复 Echo 详情一直加载中')
  assert.equal(parseInferred('"Ship the goal bar."'), 'Ship the goal bar')
  assert.equal(parseInferred('NONE'), '')
  assert.equal(parseInferred('none — just chatting'), '')
  assert.equal(parseInferred('无明确目标'), '')
  assert.equal(parseInferred(''), '')
  assert.equal(Array.from(parseInferred('长'.repeat(200))).length, INFER_TITLE_MAX)
})

/* ── host ───────────────────────────────────────────────────────────── */

const events = [
  { type: 'turn/start', time: 1, data: { turn: 1 } },
  { type: 'user/message', time: 2, data: { id: 'u1', role: 'user', content: [{ type: 'text', text: '帮我给 PULSE 面板加一个目标条' }] } },
  { type: 'assistant/message', time: 3, data: { turn: 1, message: { id: 'a1', role: 'assistant', content: [{ type: 'text', text: '好的，先看看面板结构。' }] } } },
  { type: 'turn/end', time: 4, data: { turn: 1, reason: { kind: 'completed' } } },
]

function run(steps, llmMode) {
  const base = mkdtempSync(join(testsRoot, 'pulse-routes-'))
  mkdirSync(join(base, '.dsh', 'running-panel'), { recursive: true })
  const env = { ...process.env, PULSE_TEST_LLM: llmMode || '', PULSE_TEST_SESSIONS: JSON.stringify([{ id: 's1', header: { cwd: 'H:\\Work' }, events }]) }
  delete env.NODE_TEST_CONTEXT
  return new Promise((done, reject) => execFile(process.execPath, [helper, base, JSON.stringify(steps)], {
    env, encoding: 'utf8', timeout: 20000, maxBuffer: 8 * 1024 * 1024,
  }, (error, stdout, stderr) => {
    assert.equal(dirname(resolve(base)), testsRoot)
    assert.match(basename(base), /^pulse-routes-[A-Za-z0-9]+$/)
    rmSync(base, { recursive: true, force: true })
    if (error) return reject(new Error(stderr || error.message))
    done(JSON.parse(stdout.trim().split('\n').pop()))
  }))
}
const G = '/dsh-running-panel/goal'
const S = '/dsh-running-panel/snapshot?session=s1'
const settled = { waitFor: S, until: 'goalProposal.status', equals: 'ready' }

test('goal inference runs in the background, reaches the snapshot, and is throttled per session', async () => {
  const results = await run([
    { method: 'POST', path: G, body: { sessionId: 's1', infer: true } },
    settled,
    { method: 'POST', path: G, body: { sessionId: 's1', infer: true } },
    { method: 'POST', path: G, body: { sessionId: 's1', infer: true, force: true } },
    settled,
    { path: G + '?session=s1' },
  ], 'json')
  const [started, ready, reused, forced, readyAgain, goalView, calls] = results
  assert.equal(started.status, 202)
  assert.equal(started.body.proposal.status, 'running')
  assert.equal(ready.body.goalProposal.title, '给面板加目标条')
  assert.equal(reused.body.proposal.status, 'ready', 'same round → cached, no second call')
  assert.equal(forced.body.proposal.status, 'running')
  assert.equal(readyAgain.body.goalProposal.status, 'ready')
  assert.equal(goalView.body.goal.current, null, 'an inference never writes a goal')
  assert.equal(calls.body.llmCalls.length, 2)
  assert.equal(calls.body.llmCalls[0].purpose, 'pulse-goal')
  assert.match(calls.body.llmCalls[0].prompt, /用户：帮我给 PULSE 面板加一个目标条/)
})

test('goal inference: NONE becomes no proposal; a missing llm service is reported, not thrown', async () => {
  const none = await run([{ method: 'POST', path: G, body: { sessionId: 's1', infer: true } }, { waitFor: S, until: 'goalProposal.status', equals: 'none' }], 'garbage')
  assert.equal(none[1].body.goalProposal.title, '')
  const missing = await run([{ method: 'POST', path: G, body: { sessionId: 's1', infer: true } }, { waitFor: S, until: 'goalProposal.status', equals: 'error' }])
  assert.equal(missing[1].body.goalProposal.error, 'llm_unavailable')
})

/* ── client ─────────────────────────────────────────────────────────── */

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
      requests.push({ url, method: options && options.method, body: options && options.body ? JSON.parse(options.body) : null })
      return Promise.resolve({ ok: true, json: () => Promise.resolve({}) })
    },
  })
  vm.runInContext(source.replace("return { inject: ['slots', 'locale'], apply: apply }", 'return { GoalBar, shouldInferGoal, setPref, shell, switchMode }'), context)
  const exports = factory((name) => (name === 'react' ? React : null))
  return { exports, requests, render(props, effects = false) { runEffects = effects; cursor = 0; const tree = exports.GoalBar(props); runEffects = false; return tree } }
}
function all(tree, predicate, out = []) {
  if (!tree || typeof tree !== 'object') return out
  if (Array.isArray(tree)) { tree.forEach((child) => all(child, predicate, out)); return out }
  if (predicate(tree)) out.push(tree)
  all(tree.children, predicate, out)
  return out
}
const t = (key) => key
const emptyGoal = { workspace: 'h:/work', current: null, history: [], doneCount: 0 }
const base = { t, sessionId: 's1', sessionTitle: '会话标题', goal: emptyGoal, dsh: null, phase: 'idle', round: 4 }

test('shouldInferGoal: only with no goal, after the turn ends, not after a failure, and only when enabled', () => {
  const { exports } = harness()
  assert.equal(exports.shouldInferGoal(base, false), false, 'nothing runs before the user consents to background model calls')
  exports.setPref('modelConsent', 'granted')
  assert.equal(exports.shouldInferGoal(base, false), true)
  assert.equal(exports.shouldInferGoal({ ...base, phase: 'active' }, false), false, 'not while the agent runs')
  assert.equal(exports.shouldInferGoal(base, true), false, 'dismissed')
  assert.equal(exports.shouldInferGoal({ ...base, goal: { ...emptyGoal, current: { id: 'g' } } }, false), false)
  assert.equal(exports.shouldInferGoal({ ...base, dsh: { phase: 'active' } }, false), false)
  assert.equal(exports.shouldInferGoal({ ...base, proposal: { status: 'running' } }, false), false)
  assert.equal(exports.shouldInferGoal({ ...base, proposal: { status: 'error' } }, false), false, 'no automatic retry')
  assert.equal(exports.shouldInferGoal({ ...base, goal: null }, false), false, 'storage not ready')
  exports.setPref('inferGoal', false)
  assert.equal(exports.shouldInferGoal(base, false), false)
})

test('goal bar: asks for an inference once per round, then shows the model proposal and accepts it as inferred', async () => {
  const ui = harness()
  ui.exports.setPref('modelConsent', 'granted')
  ui.render(base, true)
  ui.render(base, true)
  assert.deepEqual(ui.requests.map((r) => r.body), [{ sessionId: 's1', infer: true }], 'one request per session round')
  let tree = ui.render({ ...base, proposal: { status: 'running', title: '', round: 4 } })
  assert.match(JSON.stringify(tree), /goalInferring/)
  assert.match(JSON.stringify(tree), /会话标题/, 'session title stands in while inferring')
  tree = ui.render({ ...base, proposal: { status: 'ready', title: '给面板加目标条', round: 4 } })
  const bar = all(tree, (n) => n.props?.className === '__rp_goal')[0]
  assert.equal(bar.props['data-source'], 'model')
  assert.equal(bar.props.title, 'goalInferredModelTip')
  all(tree, (n) => n.type === 'button' && n.children.includes('goalAccept'))[0].props.onClick()
  await new Promise((done) => setImmediate(done))
  assert.deepEqual(ui.requests.at(-1).body, { sessionId: 's1', title: '给面板加目标条', source: 'inferred' })
})

test('tracker bar: DSH rounds become progress segments (capped at 24); tracked tag shown', () => {
  const ui = harness()
  const dsh = (rounds, max) => ({ id: 'g', objective: 'native', phase: 'active', rounds, max, createdAt: 1, blocked: '' })
  let tree = ui.render({ ...base, dsh: dsh(2, 8) })
  let segs = all(tree, (n) => n.props?.className === '__rp_goalSeg')
  assert.equal(segs.length, 8)
  assert.equal(segs.filter((n) => n.props['data-on'] === '1').length, 2)
  assert.ok(all(tree, (n) => n.props?.className === '__rp_goalTag' && n.children[0] === 'goalTagTracked').length)
  tree = ui.render({ ...base, dsh: dsh(50, 100) })
  segs = all(tree, (n) => n.props?.className === '__rp_goalSeg')
  assert.equal(segs.length, 24)
  assert.equal(segs.filter((n) => n.props['data-on'] === '1').length, 12)
  tree = ui.render({ ...base, goal: { ...emptyGoal, current: { id: 'p', title: 'pulse', source: 'owner', createdAt: 1 } } })
  assert.equal(all(tree, (n) => n.props?.className === '__rp_goalSeg').length, 0, 'PULSE goals have no rounds to draw')
})

test('tactical grid is on in visual mode and off in performance mode', () => {
  const ui = harness()
  assert.equal(ui.exports.shell([], t).props['data-effect-grid'], 'on')
  ui.exports.switchMode('performance')
  assert.equal(ui.exports.shell([], t).props['data-effect-grid'], 'off')
})

test('an inferred goal that is not confirmed yet reads "unconfirmed ◇", without an extra ? badge', () => {
  const ui = harness()
  let tree = ui.render({ ...base, goal: { ...emptyGoal, current: { id: 'p', title: '推断的目标', source: 'inferred', createdAt: 1 } } })
  const tag = all(tree, (n) => n.props?.className === '__rp_goalTag')[0]
  assert.equal(tag.children[0], 'goalTagUnconfirmed')
  assert.equal(all(tree, (n) => n.props?.className === '__rp_goalMark')[0].children[0], '◇')
  assert.equal(all(tree, (n) => n.props?.className === '__rp_goalBadge' && n.children[0] === '?').length, 0)
  tree = ui.render({ ...base, goal: { ...emptyGoal, current: { id: 'p', title: '确认过的目标', source: 'owner', createdAt: 1 } } })
  assert.equal(all(tree, (n) => n.props?.className === '__rp_goalTag')[0].children[0], 'goalTagTracked')
  assert.equal(all(tree, (n) => n.props?.className === '__rp_goalMark')[0].children[0], '◆')
})
