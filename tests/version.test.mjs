// Client/host version mismatch (1.0.17): the client carries its build version and says
// plainly when the host loaded inside DSH is older, instead of surfacing raw route errors.
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import vm from 'node:vm'
import { buildClient } from '../tools/build-client.mjs'

const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'))
const source = readFileSync(new URL('../client.js', import.meta.url), 'utf8').replace(/\r\n/g, '\n')

test('the build stamps package.json version into the client', () => {
  assert.ok(buildClient().includes("var CLIENT_VERSION = '" + pkg.version + "'"))
  assert.ok(!source.includes('__PULSE_CLIENT_' + 'VERSION__'), 'no unreplaced placeholder ships')
})

function harness() {
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
  let factory
  const context = vm.createContext({ window: { __ModuleLoader__: { load(module) { factory = module.factory } }, localStorage: { getItem: () => null, setItem() {} } } })
  vm.runInContext(source.replace("return { inject: ['slots', 'locale'], apply: apply }",
    'return { shell, VersionMismatch, hostOutdated, translateStatusText, setSeen: function (v) { pluginVersionSeen = v } }'), context)
  return factory((name) => (name === 'react' ? React : null))
}
const t = (key) => key
const banner = (tree) => {
  const inner = tree.children.find((child) => child && child.props && child.props.className === '__rp_scroll').children[0]
  return inner.children[0]
}

test('the panel shell shows a version banner only when the host reports a different version', () => {
  const ui = harness()
  assert.equal(ui.hostOutdated(), false, 'no snapshot yet → no claim')
  ui.setSeen(pkg.version)
  assert.equal(ui.hostOutdated(), false)
  assert.equal(ui.VersionMismatch({ t }), null)
  ui.setSeen('1.0.10')
  assert.equal(ui.hostOutdated(), true)
  const node = ui.VersionMismatch({ t })
  assert.equal(node.props.role, 'alert')
  assert.equal(node.children[0], 'versionMismatch')
  assert.equal(banner(ui.shell(['content'], t)).type, ui.VersionMismatch, 'shell puts the banner above every view')
})

test('features that need the new host explain the mismatch instead of raw errors', () => {
  const ui = harness()
  ui.setSeen('1.0.10')
  assert.equal(ui.translateStatusText(t, null), 'hostOutdatedShort', 'old host sends no translate status')
  ui.setSeen(pkg.version)
  assert.equal(ui.translateStatusText(t, null), 'translateUnknown')
})
