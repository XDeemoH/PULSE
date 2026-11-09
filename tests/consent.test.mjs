// Background model calls need explicit consent (1.0.22): the card shows until the user
// decides, and modelAllowed() gates every automatic call on consent + its own toggle.
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import vm from 'node:vm'

const source = readFileSync(new URL('../client.js', import.meta.url), 'utf8').replace(/\r\n/g, '\n')
function harness(saved) {
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
  const context = vm.createContext({ window: { __ModuleLoader__: { load(module) { factory = module.factory } }, localStorage: { getItem: () => (saved ? JSON.stringify(saved) : null), setItem() {} } } })
  vm.runInContext(source.replace("return { inject: ['slots', 'locale'], apply: apply }", 'return { ModelConsent, modelAllowed, setPref, prefs, loadPrefs }'), context)
  const exports = factory((name) => (name === 'react' ? React : null))
  exports.loadPrefs() // the plugin reads saved prefs in apply(); do the same here
  return { exports, render: (fn) => { cursor = 0; return fn() } }
}
function all(tree, predicate, out = []) {
  if (!tree || typeof tree !== 'object') return out
  if (Array.isArray(tree)) { tree.forEach((child) => all(child, predicate, out)); return out }
  if (predicate(tree)) out.push(tree)
  all(tree.children, predicate, out)
  return out
}
const t = (key) => key

test('consent card: shown until a decision; allow enables background calls, decline keeps them off', () => {
  const ui = harness()
  assert.equal(ui.exports.prefs.modelConsent, '')
  assert.equal(ui.exports.modelAllowed('autoTranslate'), false)
  let card = ui.render(() => ui.exports.ModelConsent({ t }))
  assert.equal(card.props.className, '__rp_consent')
  assert.equal(all(card, (n) => n.type === 'li').length, 3, 'lists what each feature sends')
  all(card, (n) => n.type === 'button' && n.children.includes('consentAllow'))[0].props.onClick()
  assert.equal(ui.exports.modelAllowed('autoTranslate'), true)
  assert.equal(ui.render(() => ui.exports.ModelConsent({ t })), null, 'decided → card gone')
  ui.exports.setPref('inferGoal', false)
  assert.equal(ui.exports.modelAllowed('inferGoal'), false, 'each feature keeps its own switch')
  ui.exports.setPref('modelConsent', 'declined')
  assert.equal(ui.exports.modelAllowed('autoTranslate'), false)
  assert.equal(ui.render(() => ui.exports.ModelConsent({ t })), null)
})

test('a saved decision survives reload; anything else counts as undecided', () => {
  assert.equal(harness({ modelConsent: 'granted' }).exports.modelAllowed('collectIdeas'), true)
  assert.equal(harness({ modelConsent: 'declined' }).exports.prefs.modelConsent, 'declined')
  assert.equal(harness({ modelConsent: 'yes please' }).exports.prefs.modelConsent, '')
})
