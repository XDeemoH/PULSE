import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const here = dirname(fileURLToPath(import.meta.url))
const src = readFileSync(join(here, '..', 'client.js'), 'utf8')

function extractArray(name) {
  const start = src.indexOf('var ' + name + ' = [')
  assert.ok(start >= 0, `client.js 里缺少 ${name}`)
  const end = src.indexOf(']', start)
  assert.ok(end > start, `${name} 没有闭合`)
  return src.slice(start, end + 1)
}

function extractFunction(name) {
  const start = src.indexOf('function ' + name + '() {')
  assert.ok(start >= 0, `client.js 里缺少 ${name}`)
  let depth = 0
  for (let i = src.indexOf('{', start); i < src.length; i += 1) {
    if (src[i] === '{') depth += 1
    else if (src[i] === '}') {
      depth -= 1
      if (depth === 0) return src.slice(start, i + 1)
    }
  }
  assert.fail(`${name} 的括号不平衡`)
}

const code =
  "var contourMaskCache = '';\n" +
  extractArray('CONTOUR_RINGS') +
  '\n' +
  extractArray('CONTOUR_STRAYS') +
  '\n' +
  extractFunction('contourMaskUri') +
  '\nreturn contourMaskUri();'
const uri = new Function(code)()

test('流光 mask 是 data URI，不是外链或空串', () => {
  assert.match(uri, /^data:image\/svg\+xml,/)
  assert.ok(uri.length > 500)
  assert.ok(uri.length < 5000, '不应把皮肤那份 225KB 底图抄进来')
})

test('mask 解码后是可用的 SVG：pattern + path + 填充引用', () => {
  const svg = decodeURIComponent(uri.slice('data:image/svg+xml,'.length))
  assert.match(svg, /<svg[^>]+viewBox="0 0 480 480"/)
  assert.match(svg, /<pattern[^>]+id="p"/)
  assert.match(svg, /fill="url\(#p\)"/)
  assert.equal((svg.match(/<path/g) || []).length, 7)
})
