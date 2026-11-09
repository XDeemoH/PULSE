// Division-style motion and synthesized sound (1.0.18): ring phases (sweep, heartbeat,
// ignite, afterglow), first-open mosaic reveal, number decode, and the Web Audio sfx.
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import vm from 'node:vm'

const source = readFileSync(new URL('../client.js', import.meta.url), 'utf8').replace(/\r\n/g, '\n')

function fakeAudio() {
  const log = []
  const param = () => ({ value: 0, setValueAtTime() {}, exponentialRampToValueAtTime() {} })
  const node = (kind) => ({ kind, connect() {}, start() { log.push(kind + ':start') }, stop() {}, frequency: param(), gain: param(), Q: param(), type: '' })
  class AudioContext {
    constructor() { this.state = 'suspended'; this.currentTime = 0; this.sampleRate = 8000; this.destination = {}; log.push('ctx') }
    resume() { this.state = 'running'; log.push('resume') }
    createOscillator() { return node('osc') }
    createGain() { return node('gain') }
    createBiquadFilter() { return node('filter') }
    createBufferSource() { return node('noise') }
    createBuffer(channels, length) { return { getChannelData: () => new Float32Array(length) } }
  }
  return { AudioContext, log }
}

function harness(options = {}) {
  const slots = []
  const effects = []
  let cursor = 0
  let runEffects = false
  const React = {
    Fragment: 'Fragment',
    createElement(type, props, ...children) { return { type, props: props || {}, children } },
    useState(initial) { const id = cursor++; if (!(id in slots)) slots[id] = typeof initial === 'function' ? initial() : initial; return [slots[id], (v) => { slots[id] = typeof v === 'function' ? v(slots[id]) : v }] },
    useRef(initial) { const id = cursor++; return slots[id] || (slots[id] = { current: initial }) },
    useEffect(callback, deps) {
      const id = cursor++
      const previous = effects[id]
      if (!runEffects || (previous && deps && deps.every((v, i) => v === previous[i]))) return
      effects[id] = deps
      callback()
    },
    useMemo(callback) { cursor++; return callback() },
    useCallback(callback) { cursor++; return callback },
    createContext(value) { return { _value: value, Provider: 'Provider' } },
    useContext(context) { return context._value },
  }
  const audio = fakeAudio()
  const timers = []
  let factory
  const context = vm.createContext({
    window: {
      __ModuleLoader__: { load(module) { factory = module.factory } },
      localStorage: { getItem: () => null, setItem() {} },
      sessionStorage: options.session || { data: {}, getItem(k) { return this.data[k] ?? null }, setItem(k, v) { this.data[k] = String(v) } },
      AudioContext: options.noAudio ? undefined : audio.AudioContext,
      matchMedia: () => ({ matches: Boolean(options.reducedMotion) }),
    },
    document: { getElementById: () => null },
    setTimeout: (fn, ms) => { timers.push({ fn, ms }); return timers.length },
    clearTimeout() {},
    setInterval: (fn, ms) => { timers.push({ fn, ms, every: true }); return timers.length },
    clearInterval() {},
    Date,
  })
  vm.runInContext(source.replace("return { inject: ['slots', 'locale'], apply: apply }",
    'return { RingSvg, useFirstReveal, decodeText, sfxPlay, sfxClickDelegate, sfxFor, setPref, setEffect, shell, prefs }'), context)
  const exports = factory((name) => (name === 'react' ? React : null))
  return {
    exports, audio, timers,
    render(fn, withEffects = true) { runEffects = withEffects; cursor = 0; const out = fn(); runEffects = false; return out },
  }
}
function all(tree, predicate, out = []) {
  if (!tree || typeof tree !== 'object') return out
  if (Array.isArray(tree)) { tree.forEach((child) => all(child, predicate, out)); return out }
  if (predicate(tree)) out.push(tree)
  all(tree.children, predicate, out)
  return out
}
const t = (key) => key
const model = { sum: 42, basis: 'round' }
const ring = (ui, props) => ui.render(() => ui.exports.RingSvg({ t, categories: [], model, size: 100, ...props }))

/* ── sound ─────────────────────────────────────────────────────────── */

test('sfx: silent unless enabled; synthesizes with Web Audio; throttles repeats; unknown names do nothing', () => {
  const ui = harness()
  assert.equal(ui.exports.prefs.sfx, false, 'off by default')
  assert.equal(ui.exports.sfxPlay('click'), false)
  assert.equal(ui.audio.log.length, 0, 'no AudioContext is even created while off')
  ui.exports.setPref('sfx', true)
  assert.equal(ui.exports.sfxPlay('click'), true)
  assert.ok(ui.audio.log.includes('ctx') && ui.audio.log.includes('resume') && ui.audio.log.includes('osc:start'))
  assert.equal(ui.exports.sfxPlay('click'), false, 'same sound within 60 ms is dropped')
  assert.equal(ui.exports.sfxPlay('open'), true)
  assert.ok(ui.audio.log.includes('noise:start'), 'open uses a filtered noise sweep')
  assert.equal(ui.exports.sfxPlay('nope'), false)
  ui.exports.setPref('sfxVolume', 0)
  assert.equal(ui.exports.sfxPlay('done'), false, 'volume 0 is off')
  assert.equal(harness({ noAudio: true }).exports.sfxPlay('click'), false)
})

test('sfx click delegate: buttons click; self-voiced interactions are not doubled', () => {
  const ui = harness()
  ui.exports.setPref('sfx', true)
  const button = { disabled: false }
  const target = { closest: () => button }
  const before = ui.audio.log.filter((e) => e === 'osc:start').length
  ui.exports.sfxClickDelegate({ target, nativeEvent: {} })
  assert.equal(ui.audio.log.filter((e) => e === 'osc:start').length, before + 1)
  const event = { target, nativeEvent: {} }
  ui.exports.sfxFor(event, 'expand')
  assert.equal(event.nativeEvent.__rpSfx, true)
  const afterExpand = ui.audio.log.filter((e) => e === 'osc:start').length
  ui.exports.sfxClickDelegate(event)
  assert.equal(ui.audio.log.filter((e) => e === 'osc:start').length, afterExpand, 'flagged click is skipped')
  ui.exports.sfxClickDelegate({ target: { closest: () => null }, nativeEvent: {} })
  assert.equal(ui.audio.log.filter((e) => e === 'osc:start').length, afterExpand, 'non-buttons are silent')
})

/* ── ring ───────────────────────────────────────────────────────────── */

test('ring: one continuous inner ring (no gaps), a sweep group, a 12 o’clock mark; phase drives idle vs active', () => {
  const ui = harness()
  let svg = ring(ui, { phase: 'idle' })
  assert.equal(svg.props['data-phase'], 'idle')
  assert.equal(all(svg, (n) => n.type === 'mask').length, 0, 'the three-sector gaps were removed in 1.0.20')
  assert.equal(all(svg, (n) => n.props?.className === '__rp_ringSweep').length, 1)
  assert.equal(all(svg, (n) => n.props?.className === '__rp_ringMark').length, 1)
  svg = ring(ui, { active: true })
  assert.equal(svg.props['data-phase'], 'active', 'old callers passing only active still work')
})

test('ring: idle → active ignites once (sound only on the main ring); spent fades the sweep', () => {
  const ui = harness()
  ui.exports.setPref('sfx', true)
  ring(ui, { phase: 'idle', sound: true })
  const starts = () => ui.audio.log.filter((e) => e === 'osc:start').length
  const before = starts()
  let svg = ring(ui, { phase: 'active', sound: true })
  svg = ring(ui, { phase: 'active', sound: true })
  assert.equal(svg.props['data-ignite'], '1')
  assert.ok(starts() > before, 'ignite sound on the main ring')
  const clear = ui.timers.find((timer) => timer.ms === 700)
  clear.fn()
  svg = ring(ui, { phase: 'active', sound: true })
  assert.equal(svg.props['data-ignite'], undefined, 'flash clears after 700 ms')
  svg = ring(ui, { phase: 'spent', sound: true })
  assert.equal(svg.props['data-phase'], 'spent')

  const corner = harness()
  corner.exports.setPref('sfx', true)
  ring(corner, { phase: 'idle' })
  ring(corner, { phase: 'active' })
  assert.equal(corner.audio.log.length, 0, 'the corner ring never makes sound')
})

test('ring: budget arc has a bright edge and a leading tick; intro draws the outer ring and decodes the number', () => {
  const ui = harness()
  let svg = ring(ui, { phase: 'idle', budget: { chars: 50, limit: 100 } })
  assert.equal(all(svg, (n) => n.props?.className === '__rp_budgetEdge').length, 1)
  const tick = all(svg, (n) => n.props?.className === '__rp_budgetTick')[0]
  assert.equal(Math.round(Number(tick.props.x1)), 50, 'at 50% the tick sits at 6 o’clock')
  assert.ok(Number(tick.props.y1) > 70)
  assert.equal(all(ring(ui, { phase: 'idle', budget: { chars: 200, limit: 100 } }), (n) => n.props?.className === '__rp_budgetTick').length, 0, 'over budget: dot, no tick')
  const intro = harness()
  svg = ring(intro, { phase: 'idle', intro: true })
  assert.equal(svg.props['data-intro'], '1')
  assert.equal(all(svg, (n) => n.props?.className === '__rp_ringIntroMask').length, 1)
  const num = all(svg, (n) => n.props?.className === '__rp_ringNum')[0]
  assert.equal(num.children[0].length, 2, 'scrambled digits keep the width')
  assert.equal(all(ring(harness(), { phase: 'idle' }), (n) => n.props?.className === '__rp_ringIntroMask').length, 0)
})

test('decodeText settles left to right and ends on the real text', () => {
  const ui = harness()
  const fixed = () => 0
  assert.equal(ui.exports.decodeText('128', 0, 10, fixed), '000')
  assert.equal(ui.exports.decodeText('128', 4, 10, fixed), '100')
  assert.equal(ui.exports.decodeText('128', 7, 10, fixed), '120')
  assert.equal(ui.exports.decodeText('128', 10, 10, fixed), '128')
})

/* ── first open ─────────────────────────────────────────────────────── */

test('first-open reveal plays once per launch, steps the pixel grid, and respects settings', () => {
  const ui = harness()
  let on = ui.render(() => ui.exports.useFirstReveal(false))
  assert.equal(on, false, 'waits for the panel to have data')
  ui.render(() => ui.exports.useFirstReveal(true))
  on = ui.render(() => ui.exports.useFirstReveal(true))
  assert.equal(on, true)
  const steps = ui.timers.filter((timer) => timer.ms < 2100).map((timer) => timer.ms)
  assert.deepEqual(steps, [250, 400, 550, 700, 850, 1000, 1150, 1300], 'pixel size 20 → 2 in eight steps after a blank-glass pause')
  ui.timers.find((timer) => timer.ms === 2100).fn()
  assert.equal(ui.render(() => ui.exports.useFirstReveal(true)), false)
  const root = ui.exports.shell([], t, { reveal: true })
  assert.equal(root.props['data-reveal'], '1')
  assert.ok(all(root, (n) => n.props?.className === '__rp_inner')[0].props.style.filter.includes('__rp_px'))
  assert.equal(ui.exports.shell([], t).props['data-reveal'], undefined)

  const reduced = harness({ reducedMotion: true })
  reduced.render(() => reduced.exports.useFirstReveal(true))
  assert.equal(reduced.render(() => reduced.exports.useFirstReveal(true)), false, 'reduced motion skips it')
  const off = harness()
  off.exports.setEffect('reveal', false)
  off.render(() => off.exports.useFirstReveal(true))
  assert.equal(off.render(() => off.exports.useFirstReveal(true)), false, 'reveal effect off skips it')
})

test('ring number never sticks on a decode glyph: once the intro ends it shows the real value', () => {
  const ui = harness()
  let svg = ring(ui, { phase: 'idle', intro: true })
  const decodeTick = ui.timers.find((timer) => timer.every && timer.ms === 110)
  decodeTick.fn(); decodeTick.fn(); decodeTick.fn()
  svg = ring(ui, { phase: 'idle', intro: true })
  assert.notEqual(all(svg, (n) => n.props?.className === '__rp_ringNum')[0].children[0], undefined)
  // The intro ends before the (throttled) decode finished: the real number must come back.
  svg = ring(ui, { phase: 'idle', intro: false })
  assert.equal(all(svg, (n) => n.props?.className === '__rp_ringNum')[0].children[0], '42')
})

test('first-open reveal is not replayed when the panel is remounted in the same DSH session', () => {
  const session = { data: {}, getItem(k) { return this.data[k] ?? null }, setItem(k, v) { this.data[k] = String(v) } }
  const first = harness({ session })
  first.render(() => first.exports.useFirstReveal(true))
  assert.equal(first.render(() => first.exports.useFirstReveal(true)), true)
  // A remount that re-evaluates the client (new module scope) shares sessionStorage.
  const again = harness({ session })
  again.render(() => again.exports.useFirstReveal(true))
  assert.equal(again.render(() => again.exports.useFirstReveal(true)), false)
})
