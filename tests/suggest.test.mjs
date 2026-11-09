// Auto-suggested Echo favorites (1.0.15): feedback classification, turn scoring,
// the host route over a live session, and the client suggestion strip.
import test from 'node:test'
import assert from 'node:assert/strict'
import { execFile } from 'node:child_process'
import { mkdtempSync, mkdirSync, readFileSync, realpathSync, rmSync, writeFileSync } from 'node:fs'
import { basename, dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import vm from 'node:vm'
import { feedbackOf, suggestEchoes } from '../suggest-core.js'

const testsRoot = realpathSync(dirname(fileURLToPath(import.meta.url)))
const helper = join(testsRoot, '..', 'test-support', 'route-host.mjs')

test('feedbackOf: pushback wins over praise; mild approval only counts in short replies', () => {
  assert.equal(feedbackOf('完美，就是这样'), 'praised')
  assert.equal(feedbackOf('nice, works now'), 'praised')
  assert.equal(feedbackOf('不错，但还是不行'), 'pushback')
  assert.equal(feedbackOf('报错了'), 'pushback')
  assert.equal(feedbackOf('可以，打包'), 'approved')
  assert.equal(feedbackOf('继续'), 'approved')
  assert.equal(feedbackOf('可以的话帮我把这个面板重新设计一下，顺便把右上角的圆盘改成每分钟一圈，再加一个按钮'), '')
  assert.equal(feedbackOf('帮我看看这个'), '')
  assert.equal(feedbackOf(''), '')
})

// DSH order: turn/start comes first, then the user message that started the turn.
let seq = 0
const ev = (type, data, time) => ({ seq: ++seq, type, time: time ?? seq * 1000, data })
const user = (text) => ev('user/message', { id: 'u' + seq, role: 'user', content: [{ type: 'text', text }] })
const reply = (id, text, turn) => ev('assistant/message', { turn, message: { id, role: 'assistant', content: [{ type: 'text', text }] } })
function turn(n, ask, body, end = { kind: 'completed' }) {
  const events = [ev('turn/start', { turn: n }), ev('user/message', { id: 'r' + n, role: 'user', content: [{ type: 'text', text: '<system-reminder>x</system-reminder>' }] })]
  if (ask) events.push(user(ask))
  events.push(...body)
  if (end) events.push(ev('turn/end', { turn: n, reason: end }))
  return events
}
const tools = (n, turnNo, failFirst = false) => Array.from({ length: n }, (_, i) => [
  ev('tool/call', { turn: turnNo, callId: 't' + turnNo + '-' + i, name: 'pwsh' }),
  ev('tool/result', { turn: turnNo, message: { toolCallId: 't' + turnNo + '-' + i, isError: failFirst && i === 0 } }),
]).flat()
const clean = (text) => (/^<system-reminder>/.test(text) ? '' : text)
function sample() {
  seq = 0
  return [
    ...turn(1, '做交付', [...tools(21, 1), ev('deliverables/presented', {}), reply('a1', '交付了', 1)]),
    ...turn(2, '小改一下', [...tools(1, 2, true), reply('a2', '改好了', 2)]),
    ...turn(3, '完美！再做一个', [reply('a3', '又做了一个', 3)]),
    ...turn(4, '还是不行，报错', [...tools(25, 4), ev('deliverables/presented', {}), reply('a4', '修了', 4)]),
    ...turn(5, '继续', [reply('a5', '最后一轮', 5)], { kind: 'interrupted' }),
    ...turn(6, '在跑', [reply('a6', '还没结束', 6)], null),
  ]
}

test('suggestEchoes scores finished turns by feedback, deliveries, recovery and size', () => {
  const list = suggestEchoes(sample(), { clean, limit: 10 })
  assert.deepEqual(list.map((s) => [s.messageId, s.score, s.reasons]), [
    ['a4', 4, ['approved', 'delivered', 'big']],
    ['a2', 4, ['praised', 'recovered']],
    ['a1', 3, ['delivered', 'big']],
  ], 'same score: newer first')
  const a2 = list.find((s) => s.messageId === 'a2')
  assert.equal(a2.ask, '小改一下', 'ask is the turn’s own prompt, not the previous one')
  assert.equal(a2.feedback, '完美！再做一个')
  assert.ok(!list.some((s) => s.messageId === 'a3'), 'pushback afterwards ("还是不行，报错") excludes the turn')
  assert.ok(!list.some((s) => s.messageId === 'a5' || s.messageId === 'a6'), 'interrupted and open turns are skipped')
})

test('suggestEchoes leaves out saved and dismissed anchors and honours the limit', () => {
  const events = sample()
  assert.deepEqual(suggestEchoes(events, { clean, saved: new Set(['a2']) }).map((s) => s.messageId), ['a4', 'a1'])
  assert.deepEqual(suggestEchoes(events, { clean, dismissed: ['a1', 'a4'] }).map((s) => s.messageId), ['a2'])
  assert.deepEqual(suggestEchoes(events, { clean, limit: 1 }).map((s) => s.messageId), ['a4'])
  assert.deepEqual(suggestEchoes([], {}), [])
})

test('suggestEchoes accepts older logs where the user message precedes turn/start', () => {
  seq = 0
  const events = [
    user('旧格式的提问'), ev('turn/start', { turn: 1 }), ...tools(22, 1), ev('deliverables/presented', {}), reply('b1', '好了', 1), ev('turn/end', { turn: 1 }),
    user('太棒了'), ev('turn/start', { turn: 2 }), reply('b2', 'ok', 2), ev('turn/end', { turn: 2 }),
  ]
  const [top] = suggestEchoes(events, { clean })
  assert.equal(top.messageId, 'b1')
  assert.equal(top.ask, '旧格式的提问')
  assert.deepEqual(top.reasons, ['praised', 'delivered', 'big'])
})

/* ── host route ─────────────────────────────────────────────────────── */

test('suggest route lists live-session candidates and drops turns already saved as Echo in that session', async () => {
  const base = mkdtempSync(join(testsRoot, 'pulse-routes-'))
  mkdirSync(join(base, '.dsh', 'running-panel'), { recursive: true })
  // a2 is already saved as an Echo in this session; a1 is saved in another session (does not count).
  writeFileSync(join(base, '.dsh', 'running-panel', 'echoes.json'), JSON.stringify({ version: 1, echoes: [
    { id: 'echo-1', sessionId: 's1', anchors: [{ messageId: 'a2' }], ranges: [], messages: [] },
    { id: 'echo-2', sessionId: 'other', anchors: [{ messageId: 'a1' }], ranges: [], messages: [] },
  ] }))
  const env = { ...process.env, PULSE_TEST_SESSIONS: JSON.stringify([{ id: 's1', header: { cwd: 'H:\\w' }, events: sample() }]) }
  delete env.NODE_TEST_CONTEXT
  const results = await new Promise((done, reject) => execFile(process.execPath, [helper, base, JSON.stringify([
    { path: '/dsh-running-panel/echo?suggest=s1' },
    { path: '/dsh-running-panel/echo?suggest=nobody' },
  ])], { env, encoding: 'utf8', timeout: 20000, maxBuffer: 8 * 1024 * 1024 }, (error, stdout, stderr) => {
    assert.equal(dirname(resolve(base)), testsRoot)
    assert.match(basename(base), /^pulse-routes-[A-Za-z0-9]+$/)
    rmSync(base, { recursive: true, force: true })
    if (error) return reject(new Error(stderr || error.message))
    done(JSON.parse(stdout.trim().split('\n').pop()))
  }))
  const [live, nobody] = results
  assert.deepEqual(live.body.suggestions.map((s) => s.messageId), ['a4', 'a1'], 'a2 is already an Echo here; a1 saved elsewhere still counts')
  assert.deepEqual(nobody.body.suggestions, [], 'closed or unknown sessions get no suggestions')
})

/* ── client strip ───────────────────────────────────────────────────── */

const source = readFileSync(new URL('../client.js', import.meta.url), 'utf8').replace(/\r\n/g, '\n')
function harness(suggestions) {
  const slots = []
  let cursor = 0
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
  let runEffects = false
  const requests = []
  const storage = {}
  let factory
  const context = vm.createContext({
    window: {
      __ModuleLoader__: { load(module) { factory = module.factory } },
      localStorage: { getItem: (k) => storage[k] ?? null, setItem: (k, v) => { storage[k] = v } },
      addEventListener() {}, removeEventListener() {}, dispatchEvent() {},
    },
    CustomEvent: class { constructor(type) { this.type = type } },
    fetch(url, options) {
      requests.push({ url, method: (options && options.method) || 'GET', body: options && options.body ? JSON.parse(options.body) : null })
      const body = url.includes('suggest=') ? { suggestions } : { ok: true }
      return Promise.resolve({ ok: true, json: () => Promise.resolve(body) })
    },
  })
  vm.runInContext(source.replace("return { inject: ['slots', 'locale'], apply: apply }", 'return { EchoSuggestions }'), context)
  const exports = factory((name) => (name === 'react' ? React : null))
  return {
    exports, requests, storage,
    render(props, effects = false) { runEffects = effects; cursor = 0; const tree = exports.EchoSuggestions(props); runEffects = false; return tree },
  }
}
function all(tree, predicate, out = []) {
  if (!tree || typeof tree !== 'object') return out
  if (Array.isArray(tree)) { tree.forEach((child) => all(child, predicate, out)); return out }
  if (predicate(tree)) out.push(tree)
  all(tree.children, predicate, out)
  return out
}
const flush = () => new Promise((done) => setImmediate(done))
const t = (key) => key
const props = { t, sessionId: 's1', phase: 'idle', round: 3 }

test('suggestion strip: renders nothing without suggestions; shows at most 3 with reasons; save and dismiss', async () => {
  const empty = harness([])
  assert.equal(empty.render(props, true), null)
  await flush()
  assert.equal(empty.render(props), null, 'no suggestions, no block')

  const list = ['m1', 'm2', 'm3', 'm4'].map((id, i) => ({ messageId: id, turn: i + 1, score: 3, reasons: i === 0 ? ['praised', 'big'] : ['delivered', 'big'], ask: '问题 ' + id, feedback: i === 0 ? '完美' : '', tools: 20 }))
  const ui = harness(list)
  ui.render(props, true)
  await flush(); await flush()
  let tree = ui.render(props)
  let rows = all(tree, (n) => n.props?.className === '__rp_suggestRow')
  assert.equal(rows.length, 3)
  assert.equal(all(rows[0], (n) => n.props?.['data-reason'] === 'praised')[0].children[0], 'suggestPraised')
  all(rows[0], (n) => n.type === 'button')[0].props.onClick()
  await flush(); await flush()
  assert.deepEqual(ui.requests.at(-1), { url: '/dsh-running-panel/echo', method: 'POST', body: { sessionId: 's1', messageId: 'm1' } })
  tree = ui.render(props)
  rows = all(tree, (n) => n.props?.className === '__rp_suggestRow')
  assert.deepEqual(rows.map((r) => r.props.key), ['m2', 'm3', 'm4'], 'saved row leaves, the 4th moves up')
  all(rows[0], (n) => n.type === 'button')[1].props.onClick()
  tree = ui.render(props)
  assert.deepEqual(all(tree, (n) => n.props?.className === '__rp_suggestRow').map((r) => r.props.key), ['m3', 'm4'])
  assert.ok(JSON.parse(ui.storage.__rp_echo_dismissed)['s1:m2'], 'dismissal is remembered per session')
})
