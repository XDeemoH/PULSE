// Auto-translation of new skills (1.0.13): pure selection / prompt / parse / merge,
// the host route driving a fake DSH `llm` service in a child process, and the client trigger.
import test from 'node:test'
import assert from 'node:assert/strict'
import { execFile } from 'node:child_process'
import { existsSync, mkdtempSync, mkdirSync, readFileSync, realpathSync, rmSync, writeFileSync } from 'node:fs'
import { basename, dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import vm from 'node:vm'
import { validateCatalogOverlay } from '../catalog-overlay.js'
import {
  DESC_MAX, NAME_MAX, applyTranslations, humanize, parseTranslations, pendingTranslations, translationPrompt,
} from '../translate-core.js'

const testsRoot = realpathSync(dirname(fileURLToPath(import.meta.url)))
const helper = join(testsRoot, '..', 'test-support', 'route-host.mjs')

/* ── pure model ─────────────────────────────────────────────────────── */

test('pendingTranslations: only missing Chinese is queued; curated catalog skills never get a machine description', () => {
  const skills = [
    { name: 'brand-new', description: 'Does a new thing.' },
    { name: 'renamed-by-hand', description: 'Has a manual zh name already.' },
    { name: 'tdd', description: 'Test-driven development.' },
    { name: 'no-desc', description: '' },
    { name: 'brand-new', description: 'duplicate dir' },
    { name: '', description: 'nameless' },
  ]
  const names = { 'skill:renamed-by-hand': { zh: '手改的名字' }, 'skill:tdd': { zh: '测试驱动', en: 'TDD' } }
  const descs = {}
  const queue = pendingTranslations(skills, names, descs, new Set(['tdd']))
  assert.deepEqual(queue.map((q) => [q.name, q.needName, q.needDesc]), [
    ['brand-new', true, true],
    ['no-desc', true, false],
    ['renamed-by-hand', false, true],
  ])
  assert.equal(pendingTranslations(skills, { ...names, 'skill:brand-new': { zh: 'x' }, 'skill:no-desc': { zh: 'y' } },
    { 'skill:brand-new': { zh: 'd' }, 'skill:renamed-by-hand': { zh: 'd' } }, ['tdd']).length, 0)
})

test('translationPrompt lists every id and asks for a bare JSON array', () => {
  const prompt = translationPrompt([{ name: 'a-skill', description: 'Alpha.' }, { name: 'b', description: '' }])
  assert.match(prompt, /"id": "a-skill"/)
  assert.match(prompt, /"id": "b"/)
  assert.match(prompt, /JSON 数组/)
})

test('parseTranslations: tolerates fences and chatter, keeps only batch ids, trims and caps lengths', () => {
  const batch = [
    { key: 'skill:a', name: 'a', needName: true, needDesc: true },
    { key: 'skill:b', name: 'b', needName: false, needDesc: true },
    { key: 'skill:c', name: 'c', needName: true, needDesc: false },
  ]
  const reply = 'Here you go:\n```json\n' + JSON.stringify([
    { id: 'a', name: ' 甲\n技能。 ', desc: '说明'.repeat(100) },
    { id: 'b', name: 'ignored because b keeps its name', desc: '乙的说明' },
    { id: 'c', name: '', desc: 'ignored' },
    { id: 'zzz', name: '不在本批', desc: 'x' },
    { id: 'a', name: '重复', desc: '重复' },
    'junk',
  ]) + '\n```\nDone.'
  const rows = parseTranslations(reply, batch)
  assert.deepEqual(rows.map((r) => r.id), ['a', 'b'])
  assert.equal(rows[0].name, '甲 技能', 'newline collapsed, trailing 。 removed')
  assert.equal(Array.from(rows[0].desc).length, DESC_MAX)
  assert.equal(rows[1].name, '', 'name not requested for b')
  assert.equal(rows[1].desc, '乙的说明')
  assert.deepEqual(parseTranslations('not json at all', batch), [])
  assert.deepEqual(parseTranslations('[{"id": "a", broken', batch), [])
  assert.ok(Array.from(parseTranslations(JSON.stringify([{ id: 'a', name: '长'.repeat(80) }]), batch)[0].name).length <= NAME_MAX)
})

test('applyTranslations: fills gaps only, never overwrites a manual zh, records provenance, validates', () => {
  const data = {
    names: { 'skill:kept': { zh: '用户手改', en: 'Kept' } },
    descs: { 'skill:kept': { zh: '手写说明' } },
  }
  const next = applyTranslations(data, [
    { key: 'skill:kept', id: 'kept', name: '机翻名', desc: '机翻说明' },
    { key: 'skill:new-one', id: 'new-one', name: '新技能', desc: '新说明' },
  ], { now: 7, model: 'deepseek/x' })
  assert.equal(next.names['skill:kept'].zh, '用户手改')
  assert.equal(next.descs['skill:kept'].zh, '手写说明')
  assert.deepEqual(next.names['skill:new-one'], { en: 'New one', zh: '新技能' })
  assert.deepEqual(next.descs['skill:new-one'], { zh: '新说明' })
  assert.deepEqual(next.autoTranslated, { 'skill:new-one': { at: 7, model: 'deepseek/x', name: '新技能', desc: '新说明' } })
  assert.equal(data.names['skill:new-one'], undefined, 'input not mutated')
  validateCatalogOverlay(next)
  assert.equal(applyTranslations(next, [{ key: 'skill:new-one', id: 'new-one', name: '再来', desc: '再来' }]), null, 'nothing new → no write')
  assert.equal(humanize('code-review'), 'Code review')
  assert.throws(() => validateCatalogOverlay({ autoTranslated: [] }), /autoTranslated/)
})

/* ── host route with a fake DSH llm service ─────────────────────────── */

function fixture(skills) {
  const base = mkdtempSync(join(testsRoot, 'pulse-routes-'))
  for (const [dir, front] of skills) {
    mkdirSync(join(base, '.agents', 'skills', dir), { recursive: true })
    writeFileSync(join(base, '.agents', 'skills', dir, 'SKILL.md'), '---\n' + front + '\n---\nbody\n')
  }
  mkdirSync(join(base, '.dsh', 'running-panel'), { recursive: true })
  return base
}

function run(base, steps, llmMode, registry) {
  const env = { ...process.env, PULSE_TEST_LLM: llmMode || '', PULSE_TEST_REGISTRY: registry ? JSON.stringify(registry) : '' }
  delete env.NODE_TEST_CONTEXT
  return new Promise((done, reject) => execFile(process.execPath, [helper, base, JSON.stringify(steps)], {
    env, encoding: 'utf8', timeout: 30000, maxBuffer: 8 * 1024 * 1024,
  }, (error, stdout, stderr) => {
    const overlayFile = join(base, '.dsh', 'running-panel', 'catalog-overlay.json')
    const overlay = existsSync(overlayFile) ? JSON.parse(readFileSync(overlayFile, 'utf8')) : null
    assert.equal(dirname(resolve(base)), testsRoot)
    assert.match(basename(base), /^pulse-routes-[A-Za-z0-9]+$/)
    rmSync(base, { recursive: true, force: true })
    if (error) return reject(new Error(stderr || error.message))
    done({ results: JSON.parse(stdout.trim().split('\n').pop()), overlay })
  }))
}

const T = '/dsh-running-panel/translate'
const waitIdle = { waitFor: T, until: 'running', equals: false }

test('translate route: new skills are translated through ctx.llm with the default model and written to the overlay', async () => {
  const base = fixture([
    ['fresh-dir', 'name: fresh-skill\ndescription: Makes fresh things.'],
    ['other', 'name: other-skill\ndescription: Another one.'],
    ['better-colors', 'name: better-colors\ndescription: Color advice.'],
  ])
  const { results, overlay } = await run(base, [
    { method: 'GET', path: T },
    { method: 'POST', path: T, body: {} },
    waitIdle,
    { method: 'POST', path: T, body: {}, headers: { 'sec-fetch-site': 'cross-site' } },
    { method: 'GET', path: '/dsh-running-panel/snapshot' },
  ], 'json')
  const [before, started, after, cross, snapshot, calls] = results
  assert.equal(before.body.pending, 2, 'better-colors is curated in catalog.js and already has a Chinese name')
  assert.equal(started.status, 202)
  assert.equal(started.body.running, true)
  assert.equal(after.body.lastError, '')
  assert.equal(after.body.lastCount, 2)
  assert.equal(after.body.pending, 0)
  assert.equal(after.body.model, 'deepseek/test-model')
  assert.equal(cross.status, 403)
  assert.equal(snapshot.body.translate.pending, 0, 'the session snapshot carries the status')
  assert.equal(calls.body.llmCalls.length, 1, 'one batched call')
  assert.equal(calls.body.llmCalls[0].purpose, 'pulse-translate')
  assert.equal(calls.body.llmCalls[0].model, 'test-model')
  assert.equal(overlay.names['skill:fresh-skill'].zh, 'fresh-skill中文', 'trailing 。 stripped')
  assert.equal(overlay.names['skill:fresh-skill'].en, 'Fresh skill')
  assert.equal(overlay.descs['skill:other-skill'].zh, '说明other-skill')
  assert.ok(overlay.autoTranslated['skill:fresh-skill'].at > 0)
  assert.equal(overlay.names['skill:better-colors'], undefined, 'curated skill untouched')
  assert.equal(overlay.descs['skill:better-colors'], undefined, 'and no machine description over the curated one')
})

test('translate route: no llm service, or an unparseable reply, fails closed with a reason and writes nothing', async () => {
  const skills = [['x', 'name: x-skill\ndescription: X.']]
  const missing = await run(fixture(skills), [{ method: 'POST', path: T, body: {} }, waitIdle])
  assert.equal(missing.results[1].body.lastError, 'llm_unavailable')
  assert.equal(missing.results[1].body.pending, 1)
  assert.equal(missing.overlay, null)
  const garbage = await run(fixture(skills), [{ method: 'POST', path: T, body: {} }, waitIdle], 'garbage')
  assert.equal(garbage.results[1].body.lastError, 'translate_unparseable')
  assert.equal(garbage.overlay, null)
})

/* ── client trigger ─────────────────────────────────────────────────── */

const source = readFileSync(new URL('../client.js', import.meta.url), 'utf8').replace(/\r\n/g, '\n')
function clientHarness() {
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
  const posts = []
  let factory
  const context = vm.createContext({
    window: { __ModuleLoader__: { load(module) { factory = module.factory } }, localStorage: { getItem: () => null, setItem() {} } },
    fetch(url, options) { posts.push({ url, method: options && options.method }); return Promise.resolve({ ok: true, json: () => Promise.resolve({}) }) },
  })
  vm.runInContext(source.replace("return { inject: ['slots', 'locale'], apply: apply }",
    'return { maybeAutoTranslate, TranslateSettings, translateStatusText, setPref, prefs }'), context)
  const exports = factory((name) => (name === 'react' ? React : null))
  return { exports, posts, render: (fn) => { cursor = 0; return fn() } }
}

test('auto-trigger: fires once per new batch, never while running, never after a failure, never when switched off', () => {
  const { exports, posts } = clientHarness()
  assert.equal(exports.prefs.autoTranslate, true, 'on by default')
  assert.equal(exports.maybeAutoTranslate({ pending: 3, running: false, lastError: '' }), false, 'but nothing runs before consent')
  assert.equal(posts.length, 0)
  exports.setPref('modelConsent', 'granted')
  assert.equal(exports.maybeAutoTranslate({ pending: 0, running: false, lastError: '' }), false)
  assert.equal(exports.maybeAutoTranslate({ pending: 3, running: false, lastError: '' }), true)
  assert.equal(exports.maybeAutoTranslate({ pending: 3, running: true, lastError: '' }), false, 'running')
  assert.equal(exports.maybeAutoTranslate({ pending: 3, running: false, lastError: '' }), false, 'same batch is not re-sent every frame')
  assert.equal(exports.maybeAutoTranslate({ pending: 0, running: false, lastError: '' }), false)
  assert.equal(exports.maybeAutoTranslate({ pending: 1, running: false, lastError: '' }), true, 'a newly installed skill triggers again')
  assert.equal(exports.maybeAutoTranslate({ pending: 0, running: false, lastError: '' }), false)
  assert.equal(exports.maybeAutoTranslate({ pending: 2, running: false, lastError: 'llm_unavailable' }), false, 'failures wait for a manual retry')
  exports.setPref('autoTranslate', false)
  assert.equal(exports.maybeAutoTranslate({ pending: 5, running: false, lastError: '' }), false, 'switched off')
  assert.deepEqual(posts.map((p) => [p.url, p.method]), [['/dsh-running-panel/translate', 'POST'], ['/dsh-running-panel/translate', 'POST']])
})

test('settings status text explains each state in plain words', () => {
  const { exports } = clientHarness()
  const t = (key) => key
  assert.equal(exports.translateStatusText(t, null), 'translateUnknown')
  assert.match(exports.translateStatusText(t, { running: true, model: 'deepseek/m' }), /translateRunning · deepseek\/m/)
  assert.equal(exports.translateStatusText(t, { lastError: 'llm_unavailable' }), 'translateNoLlm')
  assert.equal(exports.translateStatusText(t, { lastError: 'weird' }), 'translateFailedRaw')
  assert.equal(exports.translateStatusText(t, { pending: 4 }), 'translatePending')
  assert.equal(exports.translateStatusText(t, { pending: 0, lastAt: 1, lastCount: 2 }), 'translateDone')
  assert.equal(exports.translateStatusText(t, { pending: 0 }), 'translateNone')
})

test('pendingTranslations: tools are queued under tool:<name>; curated tools never get a machine description', () => {
  const queue = pendingTranslations([
    { kind: 'tool', name: 'workflow_lite', description: 'Run a workflow.' },
    { kind: 'tool', name: 'read', description: 'Read a file.' },
  ], { 'tool:read': { zh: '读取' } }, {}, new Set(['tool:read']))
  assert.deepEqual(queue.map((q) => [q.key, q.kind, q.needName, q.needDesc]), [['tool:workflow_lite', 'tool', true, true]])
})

test('translate route: plugin skills and tools from the DSH registries are translated too', async () => {
  const base = fixture([])
  const { results, overlay } = await run(base, [
    { method: 'GET', path: T },
    { method: 'POST', path: T, body: {} },
    waitIdle,
  ], 'json', {
    skills: [{ name: 'workflow-board', description: 'Board view for workflows.' }],
    tools: [{ name: 'workflow_lite', description: 'Workflow tool.' }],
  })
  assert.equal(results[0].body.pending, 2, 'registry skill + plugin tool, nothing on disk')
  assert.equal(results[2].body.pending, 0)
  assert.equal(overlay.names['skill:workflow-board'].zh, 'workflow-board中文')
  assert.equal(overlay.names['tool:workflow_lite'].zh, 'workflow_lite中文')
  assert.ok(overlay.autoTranslated['tool:workflow_lite'])
})
