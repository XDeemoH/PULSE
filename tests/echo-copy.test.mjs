// ECHO formatted copy (1.0.26): whole messages keep their Markdown and get an HTML rendering;
// a text selection inside one bubble copies just the selection, across bubbles copies them whole.
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import vm from 'node:vm'

const source = readFileSync(new URL('../client.js', import.meta.url), 'utf8').replace(/\r\n/g, '\n')
function load(windowExtra = {}) {
  let factory
  const context = vm.createContext({
    window: Object.assign({ __ModuleLoader__: { load(module) { factory = module.factory } }, localStorage: { getItem: () => null, setItem() {} } }, windowExtra),
  })
  vm.runInContext(source.replace("return { inject: ['slots', 'locale'], apply: apply }", 'return { echoMarkdownHtml, echoCopyPayload, copyEchoSelection }'), context)
  const React = { createElement: () => null, createContext: (v) => ({ _value: v }) }
  return factory((name) => (name === 'react' ? React : null))
}
const labels = { user: '用户', assistant: '助手' }
const messages = [
  { id: 'm1', role: 'user', text: '把 **B** 做了' },
  { id: 'm2', role: 'assistant', text: '## 结果\n\n- 一\n- `二`\n\n| a | b |\n|---|---|\n| 1 | 2 |\n\n```js\nx < 1\n```' },
  { id: 'm3', role: 'assistant', text: '好' },
]
function clip() {
  const data = {}
  return { data, event: { clipboardData: { setData: (k, v) => { data[k] = v } }, preventDefault() { this.prevented = true } } }
}

test('markdown → html: headings, lists, inline code, tables, fenced code; everything escaped', () => {
  const { echoMarkdownHtml } = load()
  const html = echoMarkdownHtml(messages[1].text)
  assert.match(html, /<h2>结果<\/h2>/)
  assert.match(html, /<ul><li>一<\/li><li><code>二<\/code><\/li><\/ul>/)
  assert.match(html, /<table><thead><tr><th>a<\/th><th>b<\/th><\/tr><\/thead><tbody><tr><td>1<\/td><td>2<\/td><\/tr><\/tbody><\/table>/)
  assert.match(html, /<pre><code>x &lt; 1<\/code><\/pre>/)
  assert.equal(echoMarkdownHtml('<script>alert(1)</script>'), '<p>&lt;script&gt;alert(1)&lt;/script&gt;</p>')
  assert.equal(echoMarkdownHtml('[x](javascript:alert(1))'), '<p>[x](javascript:alert(1))</p>', 'only http(s) links become anchors')
})

test('picked bubbles copy whole messages: raw markdown with role headers, plus html', () => {
  const { copyEchoSelection } = load({ getSelection: () => ({ isCollapsed: true, rangeCount: 0 }) })
  const { data, event } = clip()
  const payload = copyEchoSelection(event, null, { messages, picked: { m1: true, m2: true }, labels })
  assert.equal(payload.count, 2)
  assert.equal(data['text/plain'], '**用户**\n\n把 **B** 做了\n\n**助手**\n\n' + messages[1].text)
  assert.match(data['text/html'], /^<p><strong>用户<\/strong><\/p><p>把 <strong>B<\/strong> 做了<\/p><p><strong>助手<\/strong><\/p><h2>/)
  assert.ok(event.prevented)
})

test('a text selection inside one bubble copies the selection; across two bubbles copies both messages whole', () => {
  const nodes = messages.map((m) => ({ id: m.id, getAttribute: () => m.id }))
  const root = { contains: () => true, querySelectorAll: () => nodes }
  const selectionOver = (ids, text) => ({ isCollapsed: false, rangeCount: 1, anchorNode: {}, containsNode: (node) => ids.includes(node.id), toString: () => text })
  let current
  const { copyEchoSelection } = load({ getSelection: () => current })
  current = selectionOver(['m2'], '结果')
  let c = clip()
  copyEchoSelection(c.event, root, { messages, picked: {}, labels })
  assert.equal(c.data['text/plain'], '结果')
  current = selectionOver(['m2', 'm3'], 'partial')
  c = clip()
  const payload = copyEchoSelection(c.event, root, { messages, picked: {}, labels })
  assert.equal(payload.count, 2)
  assert.ok(c.data['text/plain'].startsWith('**助手**\n\n## 结果'))
  assert.ok(c.data['text/plain'].endsWith('**助手**\n\n好'))
})
