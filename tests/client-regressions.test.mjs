import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import vm from 'node:vm'

const source = readFileSync(new URL('../client.js', import.meta.url), 'utf8').replace(/\r\n/g, '\n')
function section(start, end) {
  const first = source.indexOf(start), last = source.indexOf(end, first)
  assert.ok(first >= 0 && last > first, 'client source section exists')
  return source.slice(first, last)
}
function hooks() {
  const slots = [], effects = [], pending = []
  let cursor = 0
  const React = {
    Fragment: 'Fragment',
    createElement(type, props, ...children) { return { type, props: props || {}, children } },
    useState(initial) {
      const id = cursor++
      if (!(id in slots)) slots[id] = typeof initial === 'function' ? initial() : initial
      return [slots[id], value => { slots[id] = typeof value === 'function' ? value(slots[id]) : value }]
    },
    useRef(initial) {
      const id = cursor++
      return slots[id] || (slots[id] = { current: initial })
    },
    useMemo(callback, deps) {
      const id = cursor++, previous = slots[id]
      if (!previous || !deps.every((value, i) => value === previous.deps[i])) slots[id] = { deps, value: callback() }
      return slots[id].value
    },
    useCallback(callback, deps) { return React.useMemo(() => callback, deps) },
    // Shallow renderer: a context is just its current value (tests set it via `_value`).
    createContext(value) { const context = { _value: value }; context.Provider = 'Provider'; return context },
    useContext(context) { return context._value },
    useEffect(callback, deps) {
      const id = cursor++, previous = effects[id]
      if (previous && deps && deps.every((value, i) => value === previous.deps[i])) return
      pending.push(() => {
        previous?.cleanup?.()
        effects[id] = { deps, cleanup: callback() }
      })
    },
  }
  return {
    React,
    render(callback) { cursor = 0; const tree = callback(); while (pending.length) pending.shift()(); return tree },
    unmount() { effects.forEach(effect => effect?.cleanup?.()) },
  }
}
function nodes(tree, predicate, result = []) {
  if (!tree || typeof tree !== 'object') return result
  if (Array.isArray(tree)) { tree.forEach(child => nodes(child, predicate, result)); return result }
  if (predicate(tree)) result.push(tree)
  nodes(tree.children, predicate, result)
  nodes(tree.props?.body, predicate, result)
  return result
}
const flush = () => new Promise(resolve => setImmediate(resolve))

function catalogHarness() {
  const runtime = hooks()
  const context = vm.createContext({
    React: runtime.React, h: runtime.React.createElement,
    catalogStore: { data: { names: { 'skill:missing': { en: 'Missing skill' }, 'tool:missing_tool': { en: 'Missing tool' } } } },
    SEARCH_HINTS: {}, nameOf: (_, name) => name, altNameOf: () => '',
    tagOfItem: () => '', tagLabel: () => '', libOfItem: () => '', libLabel: () => '',
    dragPayload: () => ({ 'text/plain': '/missing ' }),
  })
  vm.runInContext(section('    function buildSearchEntries(', '    /**\n     * 把 @名称'), context)
  vm.runInContext(section('    function SearchResultRow(', '    function SearchResults('), context)
  return { context, runtime }
}
test('F06: name metadata does not prove a skill or tool is installed', () => {
  const { context } = catalogHarness()
  const entries = context.buildSearchEntries({ skills: { items: [] }, tools: { groups: [] }, cold: { items: [] } })
  assert.equal(entries.length, 2, 'catalog remains searchable')
  assert.ok(entries.every(entry => entry.availability === 'catalog'))
  assert.ok(entries.every(entry => !entry.hints.includes('installed')))
})
test('F06: runtime session and cold entries take precedence over name metadata', () => {
  const { context } = catalogHarness()
  const entries = context.buildSearchEntries({ skills: { items: [{ name: 'missing' }] }, tools: { groups: [] }, cold: { items: [{ name: 'parked' }] } })
  assert.equal(entries.filter(entry => entry.name === 'missing').length, 1)
  assert.equal(entries.find(entry => entry.name === 'missing').availability, 'session')
  assert.equal(entries.find(entry => entry.name === 'parked').availability, 'cold')
})
test('F08: parked skills with the same metadata name keep distinct directory identities in search', () => {
  const { context } = catalogHarness()
  const entries = context.buildSearchEntries({ skills: { items: [] }, tools: { groups: [] }, cold: { items: [
    { name: 'same', directoryName: 'first-dir' }, { name: 'same', directoryName: 'second-dir' },
  ] } })
  const cold = entries.filter(entry => entry.availability === 'cold')
  assert.equal(cold.length, 2)
  assert.deepEqual(Array.from(cold, entry => entry.directoryName), ['first-dir', 'second-dir'])
  assert.notEqual(cold[0].key, cold[1].key)
})
test('F06: catalog-only search entries cannot be dragged or inserted as an available capability', () => {
  const { context, runtime } = catalogHarness()
  const tree = runtime.render(() => context.SearchResultRow({
    t: key => key, entry: { kind: 'skill', name: 'missing', label: 'Missing', availability: 'catalog' },
    onInsert() { assert.fail('catalog-only entry must not be inserted') },
  }))
  assert.equal(tree.props.draggable, false)
  const button = nodes(tree, node => node.type === 'button')[0]
  assert.equal(button.props.disabled, true)
  assert.ok(nodes(tree, node => node.children?.includes('searchCatalog')).length > 0)
})

function echoHarness() {
  const runtime = hooks(), requests = []
  const items = ['A', 'B'].map(id => ({ id, sessionId: 'session-' + id, sessionAlive: true, title: id }))
  const context = vm.createContext({
    React: runtime.React, h: runtime.React.createElement,
    useEchoes: () => [{ items }, () => {}],
    GroupSection: 'GroupSection', BookmarkIcon: 'BookmarkIcon', EchoContextModal: 'EchoContextModal',
    echoWorkspace: null, formatEchoWhen: () => '', fill: value => value, echoReadable: text => text,
    fetch(url) { return new Promise(resolve => requests.push({ url, resolve })) },
  })
  vm.runInContext(section('    function EchoGroup(', '    function SessionBoard('), context)
  const render = () => runtime.render(() => context.EchoGroup({ t: key => key }))
  let tree = render()
  nodes(tree, node => node.props?.className === '__rp_echoConvToggle').forEach(node => node.props.onClick())
  tree = render()
  const open = id => { nodes(tree, node => node.props?.className === '__rp_echoCard' && node.props.key === id)[0].props.onClick(); tree = render() }
  const modal = () => nodes(tree, node => node.type === 'EchoContextModal')[0]
  return {
    requests, open, modal, runtime,
    render() { tree = render(); return tree },
    resolve(index, body) { requests[index].resolve({ ok: true, json: async () => body }) },
  }
}
test('F07: closing A and opening B discards A full-context response', async () => {
  const ui = echoHarness()
  ui.open('A')
  ui.resolve(0, { echo: { id: 'A', messages: ['A preview'] } }); await flush(); ui.render()
  ui.modal().props.onLoadFull(); ui.render()
  ui.modal().props.onClose(); ui.render()
  ui.open('B')
  ui.resolve(2, { echo: { id: 'B', messages: ['B preview'] } }); await flush(); ui.render()
  ui.resolve(1, { messages: ['A FULL'], anchorMessageId: 'A-anchor' }); await flush(); ui.render()
  assert.equal(ui.modal().props.item.id, 'B')
  assert.equal(ui.modal().props.detail.messages[0], 'B preview')
  assert.equal(ui.modal().props.full, false)
  assert.equal(ui.modal().props.fullLoading, false)
})
test('F07: stale preview response cannot clear the newer modal detail', async () => {
  const ui = echoHarness()
  ui.open('A'); ui.modal().props.onClose(); ui.render(); ui.open('B')
  ui.resolve(1, { echo: { id: 'B', messages: ['B preview'] } }); await flush(); ui.render()
  ui.resolve(0, { echo: { id: 'A', messages: ['A preview'] } }); await flush(); ui.render()
  assert.equal(ui.modal().props.detail?.messages[0], 'B preview')
})
test('F07: a current full-context response still replaces its own preview', async () => {
  const ui = echoHarness()
  ui.open('A'); ui.resolve(0, { echo: { id: 'A', messages: ['A preview'] } }); await flush(); ui.render()
  ui.modal().props.onLoadFull(); ui.render()
  ui.resolve(1, { messages: ['A full'], anchorMessageId: 'A-anchor' }); await flush(); ui.render()
  assert.equal(ui.modal().props.detail.messages[0], 'A full')
  assert.equal(ui.modal().props.detail.id, 'A')
  assert.equal(ui.modal().props.full, true)
})

function snapshotHarness() {
  const runtime = hooks(), streams = []
  class EventSource {
    constructor(url) { this.url = url; streams.push(this) }
    close() { this.closed = true }
  }
  const context = vm.createContext({ React: runtime.React, EventSource })
  vm.runInContext(section('    function useSnapshot(', '    /* ── 全局看板'), context)
  return { streams, runtime, render: url => runtime.render(() => context.useSnapshot(url)) }
}
test('C01: changing stream session hides the old snapshot immediately', () => {
  const ui = snapshotHarness()
  ui.render('/stream?session=A')
  ui.streams[0].onmessage({ data: JSON.stringify({ session: { id: 'A' } }) })
  assert.equal(ui.render('/stream?session=A')[0].session.id, 'A')
  assert.equal(ui.render('/stream?session=B')[0], null)
  assert.equal(ui.streams[0].closed, true)
  ui.streams[1].onerror()
  assert.equal(ui.render('/stream?session=B')[0], null)
})
test('C01: an old stream callback cannot overwrite the new session snapshot', () => {
  const ui = snapshotHarness()
  ui.render('A'); ui.render('B')
  ui.streams[1].onmessage({ data: JSON.stringify({ session: { id: 'B' } }) })
  ui.streams[0].onmessage?.({ data: JSON.stringify({ session: { id: 'A' } }) })
  assert.equal(ui.render('B')[0].session.id, 'B')
})
test('C01: a reconnect on the same stream preserves its last snapshot', () => {
  const ui = snapshotHarness()
  ui.render('A'); ui.streams[0].onmessage({ data: JSON.stringify({ session: { id: 'A' } }) })
  ui.streams[0].onerror()
  const [snapshot, failed] = ui.render('A')
  assert.equal(snapshot.session.id, 'A')
  assert.equal(failed, true)
})

function planHarness() {
  const runtime = hooks(), requests = []
  const context = vm.createContext({
    React: runtime.React, prefs: { pins: {} }, budgetLimitTokens: () => 3000,
    snapshot: { session: { id: 'A' } },
    fetch(url, options) { return new Promise(resolve => requests.push({ url, body: JSON.parse(options.body), resolve })) },
  })
  vm.runInContext('function planActions() {\n' + section('      var planPair = React.useState(null)', '      if (planState && planState.plan)') +
    '\nreturn { state: planState, openPlan, applyPlan, undoPlan }\n}', context)
  let actions
  const render = () => { actions = runtime.render(() => context.planActions()); return actions }
  render()
  return { requests, render, get actions() { return actions }, resolve(index, body, ok = true) { requests[index].resolve({ ok, json: async () => body }) } }
}
test('F04: a partially failed undo stays visible and can be retried', async () => {
  const ui = planHarness()
  ui.actions.openPlan(); ui.resolve(0, { id: 'plan-1' }); await flush(); ui.render()
  ui.actions.applyPlan(['one', 'two']); ui.resolve(1, { ok: true, moved: 2, failed: [] }); await flush(); ui.render()
  ui.actions.undoPlan(); ui.resolve(2, { ok: false, moved: 1, movedNames: ['one'], failed: ['two'] }); await flush(); ui.render()
  assert.equal(ui.actions.state?.status, 'applied', 'keep the Undo action available')
  assert.equal(ui.actions.state.failedNames[0], 'two')
  assert.equal(ui.actions.state.undoFailed, true)
  ui.actions.undoPlan(); ui.resolve(3, { ok: true, moved: 1, failed: [] }); await flush(); ui.render()
  assert.equal(ui.actions.state, null)
})
test('F04: failed HTTP responses cannot close a plan even with an ok-shaped body', async () => {
  const ui = planHarness()
  ui.actions.openPlan(); ui.resolve(0, { id: 'plan-1' }); await flush(); ui.render()
  ui.actions.applyPlan(['one']); ui.resolve(1, { ok: true, moved: 1, failed: [] }); await flush(); ui.render()
  ui.actions.undoPlan(); ui.resolve(2, { ok: true, moved: 1, failed: [] }, false); await flush(); ui.render()
  assert.notEqual(ui.actions.state, null)
})

test('F08: all three restore controls send directory identity instead of metadata name', async () => {
  const runtime = hooks(), requests = []
  const context = vm.createContext({
    React: runtime.React, h: runtime.React.createElement, usePrefs() {}, prefs: { folds: {} }, setFold() {},
    nameOf: (_, name) => name, altNameOf: () => '', libLabel: name => name, fill: text => text,
    sourceOf: () => '', RepoButton: 'RepoButton', ColdRow: 'ColdRow',
    useLibMenu: () => [() => {}, [null, null]], libTip: () => '',
    fetch(url, options) { requests.push(JSON.parse(options.body)); return Promise.resolve({ ok: true, json: async () => ({ ok: true }) }) },
  })
  vm.runInContext(section('    function SearchResultRow(', '    function SearchResults('), context)
  vm.runInContext(section('    function ColdGroup(', '    /**\n     * 预算方案弹层'), context)
  const item = { name: 'metadata-name', directoryName: 'real-directory' }
  let tree = runtime.render(() => context.SearchResultRow({ t: key => key, entry: { ...item, kind: 'skill', availability: 'cold' } }))
  nodes(tree, node => node.type === 'button')[0].props.onClick(); await flush()
  assert.equal(requests[0].directoryName, 'real-directory')
  const nextRuntime = hooks(); context.React = nextRuntime.React
  tree = nextRuntime.render(() => context.ColdGroup({ t: key => key, lib: 'user', items: [item] }))
  nodes(tree, node => node.props?.className === '__rp_libRestore')[0].props.onClick(); await flush()
  assert.deepEqual(requests[1].directoryNames, ['real-directory'])
  const rowRuntime = hooks(); context.React = rowRuntime.React
  tree = rowRuntime.render(() => context.ColdRow({ t: key => key, item }))
  nodes(tree, node => node.type === 'button')[0].props.onClick(); await flush()
  assert.equal(requests[2].directoryName, 'real-directory')
})

function moduleHarness(extra = {}) {
  const runtime = hooks()
  let factory
  const context = vm.createContext({ ...extra, window: { __ModuleLoader__: { load(module) { factory = module.factory } } } })
  const instrumented = source.replace("return { inject: ['slots', 'locale'], apply: apply }",
    'return { GlobalBoard, SessionBoard, Panel, BudgetPlanDialog }')
  vm.runInContext(instrumented, context)
  const exports = factory(name => {
    if (name === 'react') return runtime.React
    if (name === 'react-dom') return null
    throw new Error('unexpected module ' + name)
  })
  return { exports, runtime }
}
test('F09: storage failures render an alert in global and session views; healthy storage stays quiet', () => {
  const { exports, runtime } = moduleHarness()
  const storage = { usage: { ready: true, error: 'disk full' }, echoes: { ready: true, error: '' } }
  const globalSnapshot = { storage, summary: { running: 0, observed: 0 }, running: [], recent: [] }
  let tree = runtime.render(() => exports.GlobalBoard({ t: key => key, snapshot: globalSnapshot }))
  assert.ok(nodes(tree, node => node.props?.role === 'alert').length > 0)
  tree = runtime.render(() => exports.GlobalBoard({ t: key => key, snapshot: { ...globalSnapshot, storage: { usage: { error: '' }, echoes: { error: '' } } } }))
  assert.equal(nodes(tree, node => node.props?.role === 'alert').length, 0)
  const session = moduleHarness()
  const useState = session.runtime.React.useState
  session.runtime.React.useState = initial => useState(initial === '' ? 'search query' : initial)
  const sessionSnapshot = { storage, session: { id: 'A' }, skills: { items: [] } }
  tree = session.runtime.render(() => session.exports.SessionBoard({ t: key => key, snapshot: sessionSnapshot }))
  assert.ok(nodes(tree, node => node.props?.role === 'alert').length > 0, 'session warning remains visible while searching')
})

const durablePlan = () => ({
  id: 'persisted-plan', at: 1,
  before: { chars: 200, tokens: 50, skills: 3 },
  keep: [{ name: 'one', chars: 60, movable: true }],
  park: [{ name: 'two', chars: 70, movable: true }, { name: 'three', chars: 70, movable: true }],
  applied: ['one', 'three'],
})
function durableUndoHarness(undoPlan, undoError = '') {
  const requests = []
  const ui = moduleHarness({ fetch(url, options) { return new Promise(resolve => requests.push({ url, body: JSON.parse(options.body), resolve })) } })
  let snapshot = {
    session: { id: 'after-restart', phase: 'idle' },
    skills: { items: [], count: 0, observable: true }, tools: { total: 0, groups: [], observable: true },
    agents: { observable: true, persona: { observable: false }, children: [] },
    budget: { chars: 0, tokens: 0, skills: 0 }, undoPlan, undoError,
  }
  let tree
  const render = () => { tree = ui.runtime.render(() => ui.exports.SessionBoard({ t: key => key, snapshot })); return tree }
  render()
  return {
    ...ui, requests, render,
    setSnapshot(value) { snapshot = { ...snapshot, ...value }; return render() },
    button(key) { return nodes(tree, node => node.type === 'button' && node.children?.includes(key))[0] },
    dialog() { return nodes(tree, node => node.type?.name === 'BudgetPlanDialog')[0] },
    resolve(index, body, ok = true) { requests[index].resolve({ ok, json: async () => body }) },
  }
}
test('durable undo: a restarted panel exposes a manual entry without opening a dialog', () => {
  const ui = durableUndoHarness(durablePlan())
  assert.ok(ui.button('planRecoverUndo'))
  assert.ok(ui.button('optimize'), 'new budget previews remain available')
  assert.equal(ui.dialog(), undefined, 'snapshot arrival must not open a modal')
  ui.button('planRecoverUndo').props.onClick(); ui.render()
  assert.equal(ui.dialog().props.applied, true)
  assert.equal(ui.dialog().props.moved, 2)
  assert.equal(ui.dialog().props.plan.id, 'persisted-plan')
  assert.equal(ui.requests.length, 0, 'viewing the recovered plan does not move files')
})
test('durable undo: conflict keeps the recovered plan retryable using its stable id', async () => {
  const ui = durableUndoHarness(durablePlan())
  ui.button('planRecoverUndo').props.onClick(); ui.render()
  ui.dialog().props.onUndo(); ui.render()
  assert.equal(ui.dialog().props.applied, true, 'an in-flight undo must keep the restore view')
  assert.equal(ui.dialog().props.busy, true)
  assert.equal(ui.requests[0].body.planId, 'persisted-plan')
  assert.equal(ui.requests[0].body.undo, true)
  ui.resolve(0, { ok: false, moved: 1, movedNames: ['one'], failed: ['three'] }); await flush(); ui.render()
  assert.equal(ui.dialog().props.applied, true)
  assert.equal(ui.dialog().props.moved, 1)
  assert.equal(ui.dialog().props.undoFailed, true)
  assert.equal(ui.dialog().props.failedNames[0], 'three')
  ui.dialog().props.onUndo(); ui.resolve(1, { ok: true, moved: 1, movedNames: ['three'], failed: [] }); await flush(); ui.render()
  assert.equal(ui.dialog(), undefined)
  ui.setSnapshot({ undoPlan: null })
  assert.equal(ui.button('planRecoverUndo'), undefined)
})
test('durable undo: opening a new preview does not auto-reopen or replace it with the saved plan', async () => {
  const ui = durableUndoHarness(durablePlan())
  ui.button('optimize').props.onClick(); ui.render()
  assert.equal(ui.requests[0].body.dryRun, true)
  ui.resolve(0, { id: 'new-preview', keep: [], park: [] }); await flush(); ui.render()
  assert.equal(ui.dialog().props.plan.id, 'new-preview')
  assert.equal(ui.dialog().props.applied, false)
  ui.setSnapshot({ undoPlan: durablePlan() })
  assert.equal(ui.dialog().props.plan.id, 'new-preview')
})
test('durable undo: missing undo plan stays hidden and journal errors remain visible', () => {
  const ui = durableUndoHarness(null, 'journal could not be loaded')
  assert.equal(ui.button('planRecoverUndo'), undefined)
  assert.ok(nodes(ui.render(), node => node.props?.role === 'alert' && node.children?.includes('undoStoreError')).length > 0)
  assert.equal(ui.dialog(), undefined)
})
test('durable undo: recovered dialog lists only still-applied rows as parked', () => {
  const ui = moduleHarness({ document: { querySelector: () => null } })
  const tree = ui.runtime.render(() => ui.exports.BudgetPlanDialog({ t: key => key, plan: durablePlan(), applied: true, moved: 2 }))
  const parkedNames = nodes(tree, node => node.props?.className === '__rp_planItem' && node.props['data-parked'] === '1')
    .map(row => nodes(row, node => node.props?.className === '__rp_planItemName')[0].children[0])
  assert.deepEqual(parkedNames.sort(), ['One', 'Three'])
})

test('Echo capacity refusal explains the limit and stays retryable after deleting an item', async () => {
  const runtime = hooks(), notices = []
  let full = true
  const context = vm.createContext({
    React: runtime.React, h: runtime.React.createElement, BookmarkIcon: 'BookmarkIcon', sessionStore: { id: '' },
    echoT: key => key === 'echoCapacityFull' ? 'Full {n}/{limit}; delete an echo, then retry' : key,
    fill: (text, key, value) => text.replace('{' + key + '}', value),
    showEchoNotice: notice => notices.push(notice),
    window: { dispatchEvent() {} }, CustomEvent: class {},
    fetch: async () => ({ ok: !full, json: async () => full
      ? { error: 'echo_capacity_reached', capacity: { count: 200, limit: 200 } }
      : { ok: true } }),
  })
  vm.runInContext(section('    function EchoActionButton(', '    function useEchoes('), context)
  const render = () => runtime.render(() => context.EchoActionButton({ sessionId: 'A', messageId: 'm' }))
  render().props.onClick(); await flush()
  let button = render()
  assert.match(button.props['aria-label'], /Full 200\/200; delete/)
  assert.equal(button.props.disabled, false)
  assert.equal(notices.at(-1)?.key, 'echoCapacityFull')
  full = false; button.props.onClick(); await flush(); button = render()
  assert.equal(button.props['aria-pressed'], 'true')
})
test('Catalog overlay read failures are visible and old snapshots remain compatible', () => {
  const { exports, runtime } = moduleHarness()
  const snapshot = { summary: { running: 0, observed: 0 }, running: [], recent: [], storage: { catalog: { ready: true, error: 'invalid overlay' } } }
  const tree = runtime.render(() => exports.GlobalBoard({ t: key => key, snapshot }))
  assert.ok(nodes(tree, node => node.props?.role === 'alert' && node.children?.includes('storageCatalogError')).length)
})

function navigationHarness({ hidden = false, scrollWorks = true, loaded = true, exists = true, wrongSession = false, externalHidden = false } = {}) {
  const context = vm.createContext({ setTimeout, clearTimeout })
  vm.runInContext(section('    // #region echo-navigation-core', '    // #endregion echo-navigation-core'), context)
  let now = 0, active = 'A', pages = 0, scrolled = 0, beforematch = 0
  let visible = false, matched = loaded
  const scroller = { getBoundingClientRect: () => ({ top: 0, bottom: 500, left: 0, right: 600 }), parentElement: null }
  const outer = { parentElement: null }
  const root = {
    getAttribute: key => key === 'data-conversation-session' ? wrongSession ? 'B' : 'A' : null,
    querySelectorAll: selector => selector === '[data-chat-node-key]' && matched ? [node] : [],
    contains: candidate => candidate === node || candidate === scroller, parentElement: outer,
  }
  scroller.parentElement = root
  const node = {
    isConnected: true, parentElement: scroller,
    getAttribute: key => key === 'data-chat-node-key' ? 'exact-key' : null,
    hasAttribute: key => key === 'hidden' && hidden,
    closest: selector => selector === '[data-conversation-scroll]' ? scroller : hidden ? node : null,
    getBoundingClientRect: () => ({ top: visible ? 50 : 900, bottom: visible ? 150 : 1000, left: 0, right: 500, width: 500, height: 100 }),
    getClientRects: () => hidden ? [] : [{}],
    dispatchEvent(event) { if (event.type === 'beforematch') { beforematch++; hidden = false } },
    scrollIntoView() { scrolled++; if (scrollWorks) visible = true },
  }
  const session = {
    open: async () => {}, getSnapshot: () => ({ openState: 'open', hasMore: !matched, loadingOlder: false }),
    loadOlder: async () => { pages++; if (exists) matched = true },
  }
  const services = {
    workspace: { openSession: () => { active = 'A' }, selection: { getSnapshot: () => ({ sessionId: active }) } },
    sessions: { binding: () => ({ session }) },
    conversation: { binding: () => ({ activate() {}, target: () => ({ getSnapshot: () => ({
      order: matched ? ['exact-key'] : [],
      nodes: { get: () => ({ key: 'exact-key', kind: 'assistant-step', data: { finalNode: { messageId: 'anchor' } } }) },
    }) }) }) },
    document: { querySelectorAll: selector => selector === '[data-conversation-session]' ? [root] : [], documentElement: { clientHeight: 700, clientWidth: 800 } },
    Event: class { constructor(type, options) { this.type = type; Object.assign(this, options) } },
    style: element => ({ display: 'block', visibility: 'visible', opacity: externalHidden && element === outer ? '0' : '1', overflowY: 'auto', overflowX: 'auto' }),
    now: () => now, delay: async ms => { now += ms }, timers: { setTimeout, clearTimeout },
    isCurrent: () => true,
  }
  return { context, services, node, setActive(value) { active = value }, counts: () => ({ pages, scrolled, beforematch }) }
}
test('Echo navigation loads missing history and reveals the exact assistant anchor before reporting success', async () => {
  const ui = navigationHarness({ loaded: false, hidden: true })
  const result = await ui.context.locateEchoAnchor({ sessionId: 'A', anchorMessageId: 'anchor' }, ui.services)
  assert.equal(result.ok, true)
  assert.equal(result.node, ui.node)
  assert.equal(ui.counts().pages, 1)
  assert.ok(ui.counts().beforematch > 0)
  assert.ok(ui.counts().scrolled > 0)
})
test('Echo navigation never reports success for a row outside the target session or viewport', async () => {
  for (const options of [{ wrongSession: true }, { scrollWorks: false }, { externalHidden: true }]) {
    const ui = navigationHarness(options)
    const result = await ui.context.locateEchoAnchor({ sessionId: 'A', anchorMessageId: 'anchor' }, ui.services)
    assert.equal(result.ok, false)
  }
})
test('Echo navigation stops bounded history loads and refuses missing message identity', async () => {
  const ui = navigationHarness({ loaded: false, exists: false })
  const result = await ui.context.locateEchoAnchor({ sessionId: 'A', anchorMessageId: 'anchor' }, ui.services)
  assert.equal(result.ok, false)
  assert.ok(ui.counts().pages <= 12)
  const missing = await ui.context.locateEchoAnchor({ sessionId: 'A', answerText: 'same words' }, ui.services)
  assert.equal(missing.ok, false)
})
test('Echo navigation cancels a superseded request or a manual session switch', async () => {
  const ui = navigationHarness({ loaded: false })
  ui.services.delay = async () => { ui.setActive('B') }
  const result = await ui.context.locateEchoAnchor({ sessionId: 'A', anchorMessageId: 'anchor' }, ui.services)
  assert.equal(result.ok, false)
  assert.equal(result.reason, 'cancelled')
  ui.services.isCurrent = () => false
  const replaced = await ui.context.locateEchoAnchor({ sessionId: 'A', anchorMessageId: 'anchor' }, ui.services)
  assert.equal(replaced.reason, 'cancelled')
})

test('Echo 卡片可拖拽，并带 text/plain 引用载荷', () => {
  assert.match(source, /draggable: true/)
  assert.match(source, /setData\('text\/plain', echoDragText\(item\)\)/)
  assert.match(source, /application\/x-pulse-echo/)
  const helper = section('function echoDragText', 'function BookmarkIcon')
  assert.ok(helper.includes('第'), '引用块带楼号')
  assert.ok(helper.includes('Q: ') && helper.includes('A: '), '引用块含问答')
  assert.ok(helper.includes('slice(0, max - 1)'), '超长要截断')
})

test('公告预算侧栏只保留占用量一行', () => {
  const block = section("t('budgetLabel')", "t('optimize')")
  assert.ok(block.includes('formatTokens(budgetLimitTokens())'), '保留 用量 / 预算线（按 token，与装配窗口一致）')
  assert.ok(!block.includes("t('budgetTokens')"), '删掉 token 行')
  assert.ok(!block.includes("t('budgetSkills')"), '删掉技能数行')
  assert.ok(!block.includes("t('costTotal')"), '删掉成本行')
  assert.ok(!block.includes("t('coldLine')"), '删掉冷层行')
})

test('Echo 详情用气泡布局，并且可以框选复制', () => {
  assert.match(source, /\.__rp_echoContext \*\{user-select:text/)
  assert.match(source, /__rp_echoCtxMsg\[data-role="user"\]\{align-self:flex-end/)
  assert.match(source, /function copyEchoSelection/)
  assert.match(source, /setData\('text\/html', html\)/)
  assert.match(source, /onCopy: function \(event\) \{\s*\n\s*afterCopy\(copyEchoSelection\(event, contextRef\.current, copyOpts\)\)/)
})

test('条目支持右键菜单：重命名、跳目录、复制、钉住、停用', () => {
  assert.match(source, /function RowMenu\(props\)/)
  assert.match(source, /onContextMenu: openMenu/)
  assert.match(source, /'\/dsh-running-panel\/name'/)
  assert.match(source, /'\/dsh-running-panel\/reveal'/)
  assert.match(source, /menuReveal/)
  assert.match(source, /menuPark/)
  assert.match(source, /refreshCatalog\(\)/)
})

test('条目编辑不再用 window.prompt（Electron 里是空实现）', () => {
  assert.ok(!/window\.prompt\(/.test(source), '不能再用 window.prompt')
  assert.match(source, /function EntryEditor\(props\)/)
  assert.match(source, /function EntryCalls\(props\)/)
  assert.match(source, /field: field, text: text/)
  assert.match(source, /entryOverrides\[section\]\[key\] = text/)
  assert.match(source, /var section = field === 'desc' \? 'descs' : 'names'/)
  assert.match(source, /menuEditDesc/)
  assert.match(source, /menuCalls/)
})

test('对话框 portal 到 body 后仍能拿到琥珀色变量', () => {
  assert.match(source, /__rp_confirmWrap\{[^}]*--rp-amber:#d89140/)
  assert.match(source, /__rp_editorBtn\[data-primary="1"\]\{background:var\(--rp-amber,#d89140\)/)
})
