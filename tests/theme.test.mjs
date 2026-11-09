import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import vm from 'node:vm'

const source = readFileSync(new URL('../client.js', import.meta.url), 'utf8').replace(/\r\n/g, '\n')

function slice(startText, endText) {
  const start = source.indexOf(startText)
  const end = source.indexOf(endText, start)
  assert.ok(start >= 0 && end > start, 'markers exist')
  return source.slice(start, end)
}

/* ── 主题判定：纯函数，直接跑 ─────────────────────────────────────────── */

const block = slice('function parseCssColor(value) {', 'function detectDshScheme() {')
const context = vm.createContext({ Math, Number, String })
vm.runInContext(block + '\nthis.schemeFromColor = schemeFromColor\nthis.parseCssColor = parseCssColor', context)
const { schemeFromColor, parseCssColor } = context

test('a light host background is detected as light', () => {
  assert.equal(schemeFromColor('#ffffff'), 'light')
  assert.equal(schemeFromColor('#f4f2ed'), 'light')
  assert.equal(schemeFromColor('rgb(250, 248, 243)'), 'light')
})

test('a dark host background is detected as dark', () => {
  assert.equal(schemeFromColor('#111416'), 'dark')
  assert.equal(schemeFromColor('#0f1216'), 'dark')
  assert.equal(schemeFromColor('rgba(18, 20, 24, 0.9)'), 'dark')
})

test('unparsable token values return null so the caller can fall back', () => {
  assert.equal(schemeFromColor(''), null)
  assert.equal(schemeFromColor('color-mix(in srgb, #fff 80%, #000)'), null)
  assert.equal(parseCssColor('var(--x)'), null)
})

test('short hex is expanded before measuring', () => {
  assert.deepEqual(Array.from(parseCssColor('#fff')), [255, 255, 255])
  assert.deepEqual(Array.from(parseCssColor('#0a0')), [0, 170, 0])
})

/* ── 亮色配色：关键前景/背景组合要过对比度 ────────────────────────────── */

function luminance(hex) {
  const rgb = parseCssColor(hex)
  const channels = rgb.map((value) => {
    const v = value / 255
    return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4)
  })
  return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2]
}

function contrast(a, b) {
  const la = luminance(a)
  const lb = luminance(b)
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05)
}

test('paper palette keeps text above 4.5:1 and accents above 3:1', () => {
  const paper = '#f4f2ed'
  assert.ok(contrast('#1b1f24', paper) >= 7, 'primary text')
  assert.ok(contrast('#4a545c', paper) >= 4.5, 'secondary text')
  assert.ok(contrast('#a04c00', paper) >= 4.5, 'amber text')
  assert.ok(contrast('#a63c22', paper) >= 4.5, 'rust text')
  assert.ok(contrast('#22736e', paper) >= 4.5, 'teal text')
  assert.ok(contrast('#45688f', paper) >= 4.5, 'slate text')
})

test('light rows use a warm tint instead of the host white surface', () => {
  const light = slice('html[data-rp-scheme="light"]', '.__rp_studioCanvas')
  assert.match(light, /--dsw-alias-bg-layer-2:rgba\(20,24,28,\.09\)/)
  assert.match(light, /--dsw-alias-bg-base:#f4f2ed/)
  assert.match(light, /\.__rp_root\[data-studio="1"\]/)
})

test('the scheme watcher is installed and removed with the plugin', () => {
  assert.ok(source.includes('function installSchemeWatch()'))
  assert.ok(source.includes("document.documentElement.setAttribute('data-rp-scheme', scheme)"))
  assert.ok(source.includes("'dsh-running-panel: dsh scheme'"))
  assert.ok(source.includes('new MutationObserver(schedule)'))
})

/* ── 宿主标记：DSH 把暗色写在 body[data-ds-dark-theme] 上 ─────────────── */

const hintBlock = slice('function parseCssColor(value) {', 'function applyDshScheme() {')

function detectWith(options) {
  const bodyHasDark = Boolean(options.bodyHasDark)
  const tokens = options.tokens || ['', '']
  const body = {
    className: options.bodyClass || '',
    hasAttribute: (name) => name === 'data-ds-dark-theme' && bodyHasDark,
    getAttribute: () => null,
  }
  const html = { className: '', getAttribute: (name) => (name === 'data-theme' ? options.htmlAttr || null : null) }
  let call = 0
  const window = {
    getComputedStyle: () => ({ getPropertyValue: () => tokens[call++] || '' }),
    matchMedia: () => ({ matches: Boolean(options.mediaLight) }),
  }
  const context = vm.createContext({ document: { body, documentElement: html }, window, Math, Number, String })
  vm.runInContext(hintBlock + '\nthis.detectDshScheme = detectDshScheme', context)
  return context.detectDshScheme()
}

test('the DSH dark-theme attribute on body wins over a light token', () => {
  assert.equal(detectWith({ bodyHasDark: true, tokens: ['#ffffff', '#ffffff'], mediaLight: true }), 'dark')
})

test('without the attribute the body token decides', () => {
  assert.equal(detectWith({ tokens: ['#f4f2ed', ''] }), 'light')
  assert.equal(detectWith({ tokens: ['#111416', ''] }), 'dark')
})

test('when no token can be read it falls back to the system preference', () => {
  assert.equal(detectWith({ tokens: ['', ''], mediaLight: true }), 'light')
  assert.equal(detectWith({ tokens: ['', ''], mediaLight: false }), 'dark')
})

test('a light/dark mark on html or body is honoured when tokens are missing', () => {
  assert.equal(detectWith({ tokens: ['', ''], htmlAttr: 'light' }), 'light')
  assert.equal(detectWith({ tokens: ['', ''], bodyClass: 'theme-dark' }), 'dark')
})

test('the watcher also observes the body, where DSH flips the theme', () => {
  assert.ok(source.includes('schemeObserver.observe(document.body'))
  assert.ok(source.includes("body.hasAttribute('data-ds-dark-theme')"))
})

/* ── 手动锁定：设置里的面板配色优先于宿主主题 ─────────────────────────── */

const effBlock = slice('function effectiveScheme() {', 'function applyDshScheme() {')

function effective(prefsScheme, detected) {
  const context = vm.createContext({
    prefs: { scheme: prefsScheme },
    detectDshScheme: () => detected,
  })
  vm.runInContext(effBlock + '\nthis.effectiveScheme = effectiveScheme', context)
  return context.effectiveScheme()
}

test('auto follows whatever the host reports', () => {
  assert.equal(effective('auto', 'light'), 'light')
  assert.equal(effective('auto', 'dark'), 'dark')
  assert.equal(effective(undefined, 'dark'), 'dark')
})

test('an explicit choice wins over the host', () => {
  assert.equal(effective('light', 'dark'), 'light')
  assert.equal(effective('dark', 'light'), 'dark')
})

test('the header button and the settings row drive the panel scheme', () => {
  assert.ok(source.includes('setPanelScheme(effectiveScheme() === \'light\' ? \'dark\' : \'light\')'))
  assert.ok(source.includes("t('schemeLabel')"))
  assert.ok(source.includes("['auto', t('schemeAuto')]"))
})
