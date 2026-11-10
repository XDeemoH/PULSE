// ECHO scene reconstruction (1.0.14): multi-frame session log decoding, the pure scene
// builder, the host route reading an on-disk log, and the client scene panel.
import test from 'node:test'
import assert from 'node:assert/strict'
import { execFile } from 'node:child_process'
import { mkdtempSync, mkdirSync, readFileSync, realpathSync, rmSync, writeFileSync } from 'node:fs'
import { basename, dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { promisify } from 'node:util'
import vm from 'node:vm'
import { zstdCompressSync, zstdDecompress } from 'node:zlib'
import { decodeSessionLog } from '../session-store.js'
import { buildScene, parseEventLines, skillNameOf } from '../scene-core.js'

const testsRoot = realpathSync(dirname(fileURLToPath(import.meta.url)))
const helper = join(testsRoot, '..', 'test-support', 'route-host.mjs')
const unzstd = promisify(zstdDecompress)

/* ── multi-frame logs ───────────────────────────────────────────────── */

test('decodeSessionLog reads every concatenated zstd frame, not just the first', async () => {
  const lines = ['{"type":"session","id":"s"}\n', '{"type":"turn/start","data":{"turn":1}}\n', '{"type":"turn/end","data":{"turn":1}}\n']
  const raw = Buffer.concat(lines.map((line) => zstdCompressSync(Buffer.from(line))))
  // Node 22 decodes only the first frame (why decodeSessionLog exists); Node 24 decodes all of them.
  // Either way, decodeSessionLog must return every line.
  assert.ok([lines[0], lines.join('')].includes((await unzstd(raw)).toString()), 'native zstd returns the first frame or all frames')
  assert.equal(await decodeSessionLog(raw, unzstd), lines.join(''))
  const torn = Buffer.concat([raw, zstdCompressSync(Buffer.from('{"type":"x"}\n')).subarray(0, 9)])
  assert.equal(await decodeSessionLog(torn, unzstd), lines.join(''), 'a half-written last frame is dropped')
  assert.equal(await decodeSessionLog(Buffer.from('{"type":"plain"}\n'), unzstd), '{"type":"plain"}\n', 'uncompressed passthrough')
})

test('decodeSessionLog merges a split when the magic number appears inside compressed data', async () => {
  const magic = Buffer.from([0x28, 0xb5, 0x2f, 0xfd])
  // Fake codec: a frame is MAGIC + payload; the payload "a" + MAGIC + "b" must not be cut at the inner magic.
  const raw = Buffer.concat([magic, Buffer.from('a'), magic, Buffer.from('b|'), magic, Buffer.from('c|')])
  const fake = (segment) => {
    const body = segment.subarray(4).toString('latin1')
    if (body === 'a') throw new Error('truncated frame')
    return Buffer.from(body.split(magic.toString('latin1')).join('+'), 'latin1')
  }
  assert.equal(await decodeSessionLog(raw, fake), 'a+b|c|')
})

/* ── scene builder ──────────────────────────────────────────────────── */

const ev = (seq, type, data, time) => ({ seq, type, time: time ?? 1000 + seq * 100, data })
function sampleEvents() {
  return [
    ev(1, 'session', {}),
    ev(2, 'request/header', { header: { config: { provider: 'deepseek-account', model: 'deepseek-flash', reasoningEffort: 'max' } } }),
    ev(3, 'user/message', { id: 'u1', role: 'user', content: [{ type: 'text', text: '<system-reminder>noise</system-reminder>' }] }),
    ev(4, 'user/message', { id: 'u2', role: 'user', content: [{ type: 'text', text: '把面板的目标条做出来' }] }),
    ev(5, 'turn/start', { turn: 7 }, 2000),
    ev(6, 'step/start', { turn: 7, step: 1 }),
    ev(7, 'assistant/message', { turn: 7, message: { id: 'a1', role: 'assistant', content: [{ type: 'tool-call', name: 'skill' }], source: { provider: 'deepseek-account', model: 'deepseek-flash' } }, usage: { inputTokens: 100, outputTokens: 20, cacheReadTokens: 5 } }),
    ev(8, 'tool/call', { turn: 7, callId: 'c1', name: 'skill', arguments: '{"name":"tdd"}' }, 2100),
    ev(9, 'tool/result', { turn: 7, message: { role: 'tool', toolCallId: 'c1', isError: false } }, 2150),
    ev(10, 'tool/call', { turn: 7, callId: 'c2', name: 'pwsh', arguments: '{"command":"secret stuff"}' }, 2200),
    ev(11, 'tool/call', { turn: 7, callId: 'c3', name: 'pwsh', arguments: '{}' }, 2300),
    ev(12, 'tool/result', { turn: 7, message: { role: 'tool', source: { callId: 'c2' }, isError: true } }, 2700),
    ev(13, 'tool/result', { turn: 7, message: { role: 'tool', toolCallId: 'c3' } }, 3300),
    ev(14, 'step/start', { turn: 7, step: 2 }),
    ev(15, 'assistant/message', { turn: 7, message: { id: 'a2', role: 'assistant', content: [{ type: 'text', text: '做好了。' }], source: { provider: 'deepseek-account', model: 'deepseek-flash' } }, usage: { inputTokens: 300, outputTokens: 40 } }),
    ev(16, 'turn/end', { turn: 7, reason: { kind: 'completed' } }, 6000),
    ev(17, 'user/message', { id: 'u3', role: 'user', content: [{ type: 'text', text: '下一轮' }] }),
    ev(18, 'turn/start', { turn: 8 }, 7000),
    ev(19, 'assistant/message', { turn: 8, message: { id: 'a3', role: 'assistant', content: [{ type: 'text', text: '还在跑' }] } }),
  ]
}
const clean = (text) => (/^<system-reminder>/.test(text) ? '' : text)

test('buildScene reconstructs the saved turn: prompt, timing, model, skills, tool chain, usage', () => {
  const scene = buildScene(sampleEvents(), 'a2', clean)
  assert.equal(scene.turn, 7)
  assert.equal(scene.ask, '把面板的目标条做出来', 'noise-only user messages are skipped')
  assert.equal(scene.answer, '做好了。')
  assert.equal(scene.durationMs, 4000)
  assert.equal(scene.endReason, 'completed')
  assert.equal(scene.model, 'deepseek-account/deepseek-flash')
  assert.equal(scene.reasoningEffort, 'max')
  assert.equal(scene.steps, 2)
  assert.deepEqual(scene.usage, { inputTokens: 400, outputTokens: 60, cacheReadTokens: 5 })
  assert.deepEqual(scene.skills, ['tdd'])
  assert.equal(scene.toolCount, 3)
  assert.deepEqual(scene.tools.map((t) => [t.name, t.skill, t.offsetMs, t.ms, t.ok]), [
    ['skill', 'tdd', 100, 50, true],
    ['pwsh', undefined, 200, 500, false],
    ['pwsh', undefined, 300, 1000, true],
  ])
  assert.deepEqual(scene.summary[0], { name: 'pwsh', skill: '', n: 2, ms: 1500, errors: 1 })
  assert.ok(!JSON.stringify(scene).includes('secret stuff'), 'tool arguments are never copied into the scene')
})

test('buildScene: a user-message anchor maps to the turn it started; open turns and unknown anchors', () => {
  assert.equal(buildScene(sampleEvents(), 'u2', clean).turn, 7)
  const open = buildScene(sampleEvents(), 'u3', clean)
  assert.equal(open.turn, 8)
  assert.equal(open.endReason, 'open')
  assert.equal(open.durationMs, 0)
  assert.equal(open.ask, '下一轮')
  assert.equal(buildScene(sampleEvents(), 'nope', clean), null)
  assert.equal(buildScene([], 'a1'), null)
  assert.equal(skillNameOf('{"skill":"x"}'), 'x')
  assert.equal(skillNameOf('not json'), '')
  assert.equal(parseEventLines('{"type":"a"}\n{broken\n\n{"type":"b"}').length, 2)
})

/* ── host route: scene from an on-disk session log ──────────────────── */

function routeFixture() {
  const base = mkdtempSync(join(testsRoot, 'pulse-routes-'))
  const dsh = join(base, '.dsh')
  const sessionDir = join(dsh, 'sessions', '--ws--', 'session-old')
  mkdirSync(sessionDir, { recursive: true })
  mkdirSync(join(dsh, 'running-panel'), { recursive: true })
  const lines = sampleEvents().map((event) => JSON.stringify(event) + '\n')
  // Two frames, like DSH's appended log.
  writeFileSync(join(sessionDir, 'session.v4.jsonl.zstd'), Buffer.concat([
    zstdCompressSync(Buffer.from(lines.slice(0, 6).join(''))),
    zstdCompressSync(Buffer.from(lines.slice(6).join(''))),
  ]))
  const echo = (id, sessionId, messageId) => ({ id, sessionId, createdAt: 1, updatedAt: 1, title: id, anchors: [{ messageId }], ranges: [], messages: [] })
  writeFileSync(join(dsh, 'running-panel', 'echoes.json'), JSON.stringify({ version: 1, echoes: [
    echo('echo-ok', 'session-old', 'a2'),
    echo('echo-gone', 'session-deleted', 'a2'),
    echo('echo-miss', 'session-old', 'not-in-log'),
  ] }))
  return base
}

function run(base, steps) {
  const env = { ...process.env }
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

test('echo scene route rebuilds from the multi-frame disk log of a closed session', async () => {
  const E = '/dsh-running-panel/echo'
  const [ok, gone, miss, unknown] = await run(routeFixture(), [
    { path: E + '?scene=echo-ok' },
    { path: E + '?scene=echo-gone' },
    { path: E + '?scene=echo-miss' },
    { path: E + '?scene=echo-nope' },
  ])
  assert.equal(ok.status, 200)
  assert.equal(ok.body.source, 'disk')
  assert.equal(ok.body.scene.turn, 7)
  assert.deepEqual(ok.body.scene.skills, ['tdd'])
  assert.equal(ok.body.scene.ask, '把面板的目标条做出来', 'the host cleans system reminders with cleanEchoText')
  assert.equal(gone.status, 409)
  assert.equal(gone.body.error, 'session_gone')
  assert.equal(miss.status, 404)
  assert.equal(miss.body.error, 'scene_not_found')
  assert.equal(unknown.status, 404)
})

/* ── client panel ───────────────────────────────────────────────────── */

const source = readFileSync(new URL('../client.js', import.meta.url), 'utf8').replace(/\r\n/g, '\n')
function harness(response) {
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
    fetch(url) { requests.push(url); return Promise.resolve({ ok: response.ok, status: response.ok ? 200 : 409, json: () => Promise.resolve(response.body) }) },
  })
  vm.runInContext(source.replace("return { inject: ['slots', 'locale'], apply: apply }", 'return { EchoScene }'), context)
  const exports = factory((name) => (name === 'react' ? React : null))
  return { exports, requests, render: (fn) => { cursor = 0; return fn() } }
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

test('scene panel fetches only on demand, then draws stats, skills and one tick per tool call', async () => {
  const scene = buildScene(sampleEvents(), 'a2', clean)
  const ui = harness({ ok: true, body: { scene, source: 'disk' } })
  let tree = ui.render(() => ui.exports.EchoScene({ t, echoId: 'echo-ok' }))
  assert.equal(ui.requests.length, 0, 'nothing is decoded until asked')
  all(tree, (n) => n.type === 'button')[0].props.onClick()
  await flush(); await flush()
  assert.deepEqual(ui.requests, ['/dsh-running-panel/echo?scene=echo-ok'])
  tree = ui.render(() => ui.exports.EchoScene({ t, echoId: 'echo-ok' }))
  const ticks = all(tree, (n) => n.props?.className === '__rp_sceneTick')
  assert.equal(ticks.length, 3)
  assert.equal(ticks[1].props['data-ok'], '0', 'the failed call is marked')
  assert.equal(ticks[0].props['data-skill'], '1')
  assert.equal(ticks[2].props.style.left, '7.5%', 'position = start offset / turn duration')
  assert.equal(all(tree, (n) => n.props?.className === '__rp_sceneSkill').length, 1)
  assert.equal(all(tree, (n) => n.type === 'button').length, 0, 'no reload button once shown')
})

test('scene panel says why when the session log is gone, and offers a retry', async () => {
  const ui = harness({ ok: false, body: { error: 'session_gone' } })
  let tree = ui.render(() => ui.exports.EchoScene({ t, echoId: 'echo-gone' }))
  all(tree, (n) => n.type === 'button')[0].props.onClick()
  await flush(); await flush()
  tree = ui.render(() => ui.exports.EchoScene({ t, echoId: 'echo-gone' }))
  const hint = all(tree, (n) => n.props?.className === '__rp_sceneHint')[0]
  assert.equal(hint.children[0], 'sceneGone')
  assert.equal(hint.props.role, 'alert')
  assert.equal(all(tree, (n) => n.type === 'button')[0].children[0], 'sceneRetry')
})
