import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import vm from 'node:vm'
import { TOOLS } from '../catalog.js'

const source = readFileSync(new URL('../client.js', import.meta.url), 'utf8').replace(/\r\n/g, '\n')

function slice(startText, endText) {
  const start = source.indexOf(startText)
  assert.ok(start >= 0, 'start marker: ' + startText)
  const end = source.indexOf(endText, start)
  assert.ok(end > start, 'end marker: ' + endText)
  return source.slice(start, end)
}

/* ── 浮层定位：纯函数，直接跑 ─────────────────────────────────────────── */

const placementBlock = slice('var TIP_SHOW_DELAY', 'function currentViewport')
const placementContext = vm.createContext({})
vm.runInContext(placementBlock + '\nthis.clampTipPlacement = clampTipPlacement', placementContext)
const { clampTipPlacement } = placementContext

test('tooltip opens below the row when there is room', () => {
  const point = clampTipPlacement(
    { left: 100, top: 100, bottom: 120 },
    { width: 200, height: 40 },
    { width: 800, height: 600 },
  )
  assert.equal(point.left, 100)
  assert.equal(point.top, 126)
})

test('tooltip flips above the row when the bottom edge is close', () => {
  const point = clampTipPlacement(
    { left: 100, top: 560, bottom: 580 },
    { width: 200, height: 40 },
    { width: 800, height: 600 },
  )
  assert.equal(point.left, 100)
  assert.equal(point.top, 514)
})

test('tooltip is clamped horizontally and vertically inside the viewport', () => {
  const right = clampTipPlacement(
    { left: 790, top: 100, bottom: 120 },
    { width: 300, height: 40 },
    { width: 800, height: 600 },
  )
  assert.equal(right.left, 492)

  const tall = clampTipPlacement(
    { left: 0, top: 0, bottom: 0 },
    { width: 100, height: 90 },
    { width: 800, height: 90 },
  )
  assert.equal(tall.top, 8)
  assert.equal(tall.left, 8)
})

test('tooltip placement survives a zero-sized viewport without NaN', () => {
  const point = clampTipPlacement(
    { left: 10, top: 10, bottom: 20 },
    { width: 50, height: 20 },
    { width: 0, height: 0 },
  )
  assert.ok(Number.isInteger(point.left) && Number.isInteger(point.top))
  assert.ok(point.left >= 8 && point.top >= 8)
})

/* ── 文案：中文走本地词典，英文回落到宿主描述 ─────────────────────────── */

const tipBlock = slice('var SHORT_DESCS = {', '    function shortDescription(name, text) {')
function tipRuntime(locale, overlay = null) {
  const context = vm.createContext({})
  vm.runInContext(
    'var currentLocale = function () { return ' + JSON.stringify(locale) + ' }\n' +
      'var __overlay = ' + JSON.stringify(overlay) + '\n' +
      'var lookup = function (map, key) { return __overlay && __overlay[key] ? __overlay[key] : null }\n' +
      tipBlock +
      '\nthis.tipOf = tipOf\nthis.TOOL_TIPS = TOOL_TIPS\nthis.SHORT_DESCS = SHORT_DESCS',
    context,
  )
  return context
}

test('Chinese UI prefers the local one-line description', () => {
  const zh = tipRuntime('zh-CN')
  assert.equal(zh.tipOf('tool', 'schedule_create', 'Create a scheduled reminder.'), '按规则创建定时任务')
  assert.equal(zh.tipOf('skill', 'test-driven-development', 'Drives development with tests.'), '先写测试，再写实现')
})

test('Chinese UI falls back to the host text for unregistered capabilities', () => {
  const zh = tipRuntime('zh-CN')
  assert.equal(zh.tipOf('tool', 'third_party_thing', 'Does something custom. Extra detail here.'), 'Does something custom')
})

test('English UI keeps the host description', () => {
  const en = tipRuntime('en-US')
  assert.equal(en.tipOf('tool', 'schedule_create', 'Create a scheduled reminder.'), 'Create a scheduled reminder')
  assert.equal(en.tipOf('skill', 'test-driven-development', 'Drives development with tests.'), 'Drives development with tests')
})

test('an unknown locale is treated as Chinese', () => {
  const none = tipRuntime('')
  assert.equal(none.tipOf('tool', 'read', 'Read a text file.'), '读取文本文件，可分段续读')
})

test('the overlay wins over both dictionaries and the host text', () => {
  const overlay = {
    'skill:answer-me-with-html': { zh: '一页 HTML 讲解', en: 'Answer me with HTML' },
  }
  const zh = tipRuntime('zh-CN', overlay)
  assert.equal(zh.tipOf('skill', 'answer-me-with-html', 'Turns an answer into a page.'), '一页 HTML 讲解')
  const en = tipRuntime('en-US', overlay)
  assert.equal(en.tipOf('skill', 'answer-me-with-html', 'Turns an answer into a page.'), 'Answer me with HTML')
})

test('an overlay without the active language falls back inside the entry', () => {
  const overlay = { 'skill:x': { zh: '中文说明' } }
  assert.equal(tipRuntime('en-US', overlay).tipOf('skill', 'x', 'Host text.'), '中文说明')
  assert.equal(tipRuntime('zh-CN', overlay).tipOf('skill', 'x', 'Host text.'), '中文说明')
})

test('an empty overlay entry does not shadow the dictionary', () => {
  const overlay = { 'tool:schedule_create': { zh: '', en: '' } }
  const zh = tipRuntime('zh-CN', overlay)
  assert.equal(zh.tipOf('tool', 'schedule_create', 'Create a scheduled reminder.'), '按规则创建定时任务')
})

test('every catalog tool has a Chinese one-liner', () => {
  const zh = tipRuntime('zh-CN')
  const missing = TOOLS.map(row => row[0]).filter(id => !zh.TOOL_TIPS[id])
  assert.deepEqual(missing, [])
  const ascii = TOOLS.map(row => row[0]).filter(id => !/[\u4e00-\u9fa5]/.test(zh.TOOL_TIPS[id] || ''))
  assert.deepEqual(ascii, [])
})

test('tool tips do not carry ids the catalog does not know', () => {
  const zh = tipRuntime('zh-CN')
  const known = new Set(TOOLS.map(row => row[0]))
  const stray = Object.keys(zh.TOOL_TIPS).filter(id => !known.has(id))
  assert.deepEqual(stray, [])
})

test('the zh and en UI dictionaries keep the same key set', () => {
  const zhBlock = slice('    var zh = {', '    var en = {')
  const enBlock = slice('    var en = {', '    /* ── 显示名')
  const keysOf = block => new Set([...block.matchAll(/^ {6}([A-Za-z_$][\w$]*):/gm)].map(match => match[1]))
  const zhKeys = keysOf(zhBlock)
  const enKeys = keysOf(enBlock)
  assert.ok(zhKeys.size > 200, 'dictionaries are parsed')
  assert.deepEqual([...zhKeys].filter(key => !enKeys.has(key)), [])
  assert.deepEqual([...enKeys].filter(key => !zhKeys.has(key)), [])
})

/* ── 接线：浮层挂在 body，行上交给 tipOf ─────────────────────────────── */

test('the hover layer is a fixed body-level layer, not a clipped pseudo element', () => {
  assert.ok(!source.includes('.__rp_row[data-desc]::after'), 'old pseudo-element tooltip removed')
  assert.ok(source.includes('.__rp_tipLayer{position:fixed'), 'fixed tooltip layer exists')
  const css = slice('.__rp_tipLayer{position:fixed', "}'\n")
  assert.match(css, /z-index:2147483000/, 'tooltip sits above panels')
  assert.match(css, /pointer-events:none/)
})

test('capability rows hand their description to tipOf', () => {
  assert.ok(source.includes("'data-desc': tipOf(props.kind, props.name, props.description) || undefined"))
  assert.ok(source.includes('function installRowTips()'))
  assert.ok(source.includes("'dsh-running-panel: row tips'"))
})
