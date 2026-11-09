// 1.0.10 hardening: behavioural regressions for the review fixes (host routes,
// session probe, undo store, and client editor / menu / locale helpers).
import test from 'node:test'
import assert from 'node:assert/strict'
import { execFile } from 'node:child_process'
import { existsSync, mkdtempSync, mkdirSync, readFileSync, realpathSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { basename, dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import vm from 'node:vm'
import { crossSiteWrite } from '../index.js'
import { SESSION_FILE, createSessionDiskProbe, sessionDiskVariants } from '../session-store.js'
import { createUndoStore } from '../undo-store.js'

const testsRoot = realpathSync(dirname(fileURLToPath(import.meta.url)))
const helper = join(testsRoot, '..', 'test-support', 'route-host.mjs')

/* ── CSRF guard ─────────────────────────────────────────────────────── */

test('crossSiteWrite refuses cross-site browser writes and keeps same-origin / tools working', () => {
  const req = (headers) => ({ headers })
  assert.equal(crossSiteWrite(req({})), false, 'no browser headers (CLI, tests) stays allowed')
  assert.equal(crossSiteWrite(req({ host: '127.0.0.1:7777', origin: 'http://127.0.0.1:7777' })), false)
  assert.equal(crossSiteWrite(req({ host: '127.0.0.1:7777', origin: 'http://localhost:5173' })), false, 'loopback dev proxy')
  assert.equal(crossSiteWrite(req({ host: '127.0.0.1:7777', 'sec-fetch-site': 'same-origin' })), false)
  assert.equal(crossSiteWrite(req({ host: '127.0.0.1:7777', origin: 'https://evil.example' })), true)
  assert.equal(crossSiteWrite(req({ host: '127.0.0.1:7777', 'sec-fetch-site': 'cross-site' })), true)
  assert.equal(crossSiteWrite(req({ host: '127.0.0.1:7777', origin: 'null' })), true, 'sandboxed/file origins')
})

/* ── Host routes (child process: homedir must be patched before import) ── */

function routeFixture() {
  const base = mkdtempSync(join(testsRoot, 'pulse-routes-'))
  const skill = join(base, '.agents', 'skills', 'pretty-dir')
  mkdirSync(skill, { recursive: true })
  writeFileSync(join(skill, 'SKILL.md'), '---\nname: pretty-name\ndescription: Name differs from directory.\n---\n')
  const store = join(base, '.dsh', 'running-panel')
  mkdirSync(store, { recursive: true })
  // Two sessions from an earlier run: they must not show up as ghost rows in the global view.
  writeFileSync(join(store, 'usage.json'), JSON.stringify({
    version: 1, since: 1, totals: [{ k: 'tool:read', n: 3, at: 1 }],
    sessions: { 'session-old-a': { tools: { read: 2 }, lastAt: 1 }, 'session-old-b': { tools: { read: 1 }, lastAt: 2 } },
  }))
  return {
    base,
    clean() {
      assert.equal(dirname(resolve(base)), testsRoot)
      assert.match(basename(base), /^pulse-routes-[A-Za-z0-9]+$/)
      rmSync(base, { recursive: true, force: true })
    },
  }
}

function runRoutes(base, steps) {
  const env = { ...process.env }
  delete env.NODE_TEST_CONTEXT
  return new Promise((done, reject) => execFile(process.execPath, [helper, base, JSON.stringify(steps)], {
    env, encoding: 'utf8', timeout: 20000, maxBuffer: 8 * 1024 * 1024,
  }, (error, stdout, stderr) => {
    if (error) return reject(new Error(stderr || error.message))
    done(JSON.parse(stdout.trim().split('\n').pop()))
  }))
}

test('host routes: side-effect GET refused, cross-site writes refused, oversized bodies refused', async () => {
  const fx = routeFixture()
  try {
    const [revealGet, revealCross, nameCross, big, badJson] = await runRoutes(fx.base, [
      { method: 'GET', path: '/dsh-running-panel/reveal' },
      { method: 'POST', path: '/dsh-running-panel/reveal', body: { kind: 'root' }, headers: { host: '127.0.0.1:1', origin: 'https://evil.example' } },
      { method: 'POST', path: '/dsh-running-panel/name', body: { kind: 'skill', name: 'x', text: 'y' }, headers: { 'sec-fetch-site': 'cross-site' } },
      { method: 'POST', path: '/dsh-running-panel/name', padBytes: 300 * 1024 },
      { method: 'POST', path: '/dsh-running-panel/park', raw: '{not json' },
    ])
    assert.equal(revealGet.status, 405, 'GET must not launch a file manager')
    assert.equal(revealCross.status, 403)
    assert.equal(nameCross.status, 403)
    assert.equal(big.status, 413)
    assert.equal(badJson.status, 400)
  } finally {
    fx.clean()
  }
})

test('host routes: rename writes the UI locale column; park resolves skill name to its directory', async () => {
  const fx = routeFixture()
  try {
    const [renamed, legacy, parked, missing, snapshot, global] = await runRoutes(fx.base, [
      { method: 'POST', path: '/dsh-running-panel/name', body: { kind: 'skill', name: 'pretty-name', field: 'name', text: 'Renamed', locale: 'en' } },
      { method: 'POST', path: '/dsh-running-panel/name', body: { kind: 'tool', name: 'read', field: 'desc', text: '读文件' } },
      { method: 'POST', path: '/dsh-running-panel/park', body: { action: 'park', name: 'pretty-name' } },
      { method: 'POST', path: '/dsh-running-panel/park', body: { action: 'park', name: 'does-not-exist' } },
      { method: 'GET', path: '/dsh-running-panel/snapshot?session=' },
      { method: 'GET', path: '/dsh-running-panel/snapshot?scope=global' },
    ])
    assert.equal(renamed.status, 200)
    assert.equal(renamed.body.locale, 'en')
    const overlay = JSON.parse(readFileSync(join(fx.base, '.dsh', 'running-panel', 'catalog-overlay.json'), 'utf8'))
    assert.deepEqual(overlay.names['skill:pretty-name'], { en: 'Renamed' }, 'English UI rename must not land in zh')
    assert.deepEqual(overlay.descs['tool:read'], { zh: '读文件' }, 'old clients without locale still write zh')

    assert.equal(parked.status, 200, JSON.stringify(parked.body))
    assert.equal(parked.body.directoryName, 'pretty-dir')
    assert.ok(existsSync(join(fx.base, '.agents', 'skills-parked', 'pretty-dir', 'SKILL.md')))

    assert.equal(missing.status, 404)
    assert.equal(snapshot.status, 200)
    assert.equal(snapshot.body.undoError, null, 'a rejected request must not become a sticky store error')

    assert.equal(global.status, 200)
    assert.equal(global.body.summary.observed, 0, 'sessions only known from usage.json are not observed this run')
    assert.deepEqual(global.body.recent, [])
  } finally {
    fx.clean()
  }
})

/* ── Session disk probe ─────────────────────────────────────────────── */

test('session probe rejects path-like ids and finds sessions created after the index was built', () => {
  const root = mkdtempSync(join(tmpdir(), 'pulse-probe-'))
  const write = (workspace, id) => {
    mkdirSync(join(root, workspace, id), { recursive: true })
    writeFileSync(join(root, workspace, id, SESSION_FILE), '')
  }
  try {
    assert.deepEqual(sessionDiskVariants('../etc'), [])
    assert.deepEqual(sessionDiskVariants('a/b'), [])
    assert.deepEqual(sessionDiskVariants('session-..'), ['session-..'])
    write('--w--', 'session-one')
    const probe = createSessionDiskProbe(root, 60000)
    assert.equal(probe('session-one'), true)
    assert.equal(probe('..'), false)
    write('--w2--', 'two')
    assert.equal(probe('session-two'), true, 'a stale index is rebuilt once before answering "gone"')
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})

/* ── Undo store ─────────────────────────────────────────────────────── */

test('undo store: per-request rejections are not reported as a persistent undo error', async () => {
  const base = mkdtempSync(join(tmpdir(), 'pulse-undo-'))
  try {
    const store = createUndoStore({ directory: join(base, 'state'), liveRoot: join(base, 'live'), coldRoot: join(base, 'cold') })
    mkdirSync(join(base, 'live'), { recursive: true })
    const missing = await store.move('ghost', 'park')
    assert.equal(missing.ok, false)
    assert.equal(missing.error, 'missing')
    const bad = await store.move('..', 'park')
    assert.equal(bad.error, 'bad name')
    const snapshot = await store.snapshot()
    assert.equal(snapshot.undoError, null)
  } finally {
    rmSync(base, { recursive: true, force: true })
  }
})

/* ── Client helpers (VM with a fake React) ──────────────────────────── */

const source = readFileSync(new URL('../client.js', import.meta.url), 'utf8').replace(/\r\n/g, '\n')
function section(start, end) {
  const first = source.indexOf(start)
  const last = source.indexOf(end, first)
  assert.ok(first >= 0 && last > first, 'client section exists: ' + start)
  return source.slice(first, last)
}
function fakeReact() {
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
  }
  return { React, render(fn) { cursor = 0; return fn() } }
}
function find(tree, predicate) {
  if (!tree || typeof tree !== 'object') return null
  if (Array.isArray(tree)) {
    for (const child of tree) { const hit = find(child, predicate); if (hit) return hit }
    return null
  }
  if (predicate(tree)) return tree
  return find(tree.children, predicate)
}
const key = (k, extra = {}) => ({ key: k, preventDefault() {}, nativeEvent: { isComposing: false, keyCode: 0, ...extra } })

function editorHarness(props) {
  const runtime = fakeReact()
  const context = vm.createContext({
    React: runtime.React, h: runtime.React.createElement, ReactDOM: null,
    fill: (template, k, v) => String(template).split('{' + k + '}').join(String(v)),
  })
  vm.runInContext(section('    function portalToBody(node) {', '    /** Electron 里 window.prompt'), context)
  vm.runInContext(section('    function EntryEditor(props) {', '    /** 调用记录'), context)
  const calls = { save: [], cancel: 0 }
  const all = {
    t: (k) => k, title: 'Rename', value: '旧名', multiline: false,
    onSave: (text) => calls.save.push(text), onCancel: () => { calls.cancel += 1 }, ...props,
  }
  const render = () => runtime.render(() => context.EntryEditor(all))
  return { render, calls, input: () => find(render(), (n) => n.type === 'input' || n.type === 'textarea') }
}

test('EntryEditor: IME composition Enter does not save; plain Enter saves; Esc cancels', () => {
  const ed = editorHarness()
  ed.input().props.onChange({ target: { value: '新名字' } })
  ed.input().props.onKeyDown(key('Enter', { isComposing: true }))
  ed.input().props.onKeyDown(key('Enter', { keyCode: 229 }))
  assert.deepEqual(ed.calls.save, [], 'choosing an IME candidate must not submit')
  ed.input().props.onKeyDown(key('Enter'))
  assert.deepEqual(ed.calls.save, ['新名字'])
  ed.input().props.onKeyDown(key('Escape'))
  assert.equal(ed.calls.cancel, 1)
})

test('EntryEditor: empty / too-long text cannot be saved and says why; save errors are shown', () => {
  const ed = editorHarness({ error: 'HTTP 500' })
  let tree = ed.render()
  assert.ok(find(tree, (n) => n.props && n.props.className === '__rp_editorError'), 'server error is visible in the dialog')
  ed.input().props.onChange({ target: { value: 'x'.repeat(61) } })
  tree = ed.render()
  const save = find(tree, (n) => n.type === 'button' && n.props['data-primary'] === '1')
  assert.equal(save.props.disabled, true)
  ed.input().props.onKeyDown(key('Enter'))
  assert.deepEqual(ed.calls.save, [])
  ed.input().props.onChange({ target: { value: '   ' } })
  assert.equal(find(ed.render(), (n) => n.type === 'button' && n.props['data-primary'] === '1').props.disabled, true)
})

test('portal wrapper stops synthetic events from bubbling to the row, but lets Escape through', () => {
  const context = vm.createContext({ h: (type, props, child) => ({ type, props, child }), ReactDOM: { createPortal: (node) => ({ portal: node }) }, document: { body: {} } })
  vm.runInContext(section('    function portalToBody(node) {', '    /** Electron 里 window.prompt'), context)
  const wrapped = context.portalToBody('dialog').portal
  assert.equal(wrapped.props.className, '__rp_portal')
  let stopped = 0
  const event = (k) => ({ key: k, stopPropagation() { stopped += 1 } })
  wrapped.props.onContextMenu(event())
  wrapped.props.onClick(event())
  wrapped.props.onKeyDown(event('Enter'))
  assert.equal(stopped, 3)
  wrapped.props.onKeyDown(event('Escape'))
  assert.equal(stopped, 3, 'window-level Esc handlers still close menus and dialogs')
})

test('localized(): zh-CN UI falls back to the zh column, not English', () => {
  const context = vm.createContext({ entryOverrides: { names: {}, descs: {} }, nameT: null, currentLocale: () => 'zh-CN' })
  vm.runInContext(section('    function localized(key, entry) {', '    /** 库对应的仓库地址'), context)
  assert.equal(context.localized('skill:x', { zh: '中文名', en: 'English' }), '中文名')
  context.currentLocale = () => 'en-US'
  assert.equal(context.localized('skill:x', { zh: '中文名', en: 'English' }), 'English')
  assert.equal(context.overlayLocale(), 'en')
  context.currentLocale = () => 'zh-CN'
  assert.equal(context.overlayLocale(), 'zh')
})

test('echoDragText clips by code point (no half surrogate pairs)', () => {
  const context = vm.createContext({})
  vm.runInContext(section('    function echoReadable(text) {', '    function escapeHtml('), context)
  const text = context.echoDragText({ title: 't', anchorFloor: 2, questionText: '😀'.repeat(300), answerText: 'a' }, null)
  const q = text.split('\n')[1]
  assert.equal(Array.from(q.slice(3)).length, 240)
  assert.ok(!/[\uD800-\uDBFF](?![\uDC00-\uDFFF])/.test(q), 'no lone high surrogate')
})
