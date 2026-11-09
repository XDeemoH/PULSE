import test from 'node:test'
import assert from 'node:assert/strict'
import { historyTop } from '../history-core.js'

/**
 * 历史常用 = 落盘累计里“用户自己装的技能”的前几名。
 * 要保证：只算 skill:、按调用次数降序、最多 6 条、
 * share 的分母是过滤后的技能集合，timeShare 的分母是全部工具耗时。
 */

const totals = {
  'skill:novel-script-writer': { n: 30, ms: 9000, at: 1 },
  'skill:skyrim-mod-debug': { n: 10, ms: 3000, at: 2 },
  'skill:craft-anything': { n: 5, ms: 0, at: 3 },
  'skill:impeccable': { n: 1, ms: 0, at: 4 },
  'tool:read': { n: 100, ms: 12000 },
  'tool:pwsh': { n: 20, ms: 4000 },
}

test('historyTop 只算技能，按调用次数降序', () => {
  const rows = historyTop(totals)
  assert.deepEqual(
    rows.map((row) => row.name),
    ['novel-script-writer', 'skyrim-mod-debug', 'craft-anything', 'impeccable'],
  )
})

test('historyTop 最多返回 6 条', () => {
  const many = {}
  for (let i = 0; i < 20; i += 1) many['skill:s' + i] = { n: i, ms: 0, at: 0 }
  const rows = historyTop(many)
  assert.equal(rows.length, 6)
  assert.equal(rows[0].name, 's19')
})

test('userSkills 非空时只保留用户技能', () => {
  const rows = historyTop(totals, { userSkills: new Set(['novel-script-writer', 'craft-anything']) })
  assert.deepEqual(
    rows.map((row) => row.name),
    ['novel-script-writer', 'craft-anything'],
  )
})

test('share 的分母是过滤后的技能集合', () => {
  const rows = historyTop(totals, { userSkills: new Set(['novel-script-writer', 'craft-anything']) })
  const byName = Object.fromEntries(rows.map((row) => [row.name, row]))
  assert.equal(byName['novel-script-writer'].share, 86) // 30 / 35
  assert.equal(byName['craft-anything'].share, 14) // 5 / 35
})

test('timeShare 以全部工具耗时为分母，没有工具耗时时是 null（未测得）', () => {
  const rows = historyTop(totals)
  const byName = Object.fromEntries(rows.map((row) => [row.name, row]))
  assert.equal(byName['novel-script-writer'].timeShare, 56) // 9000 / 16000
  const noTools = historyTop({ 'skill:a': { n: 3, ms: 800 } })
  assert.equal(noTools[0].timeShare, null)
})

test('工时测到了但占比不足 1% 时是 0，不能当成未测得', () => {
  const rows = historyTop({
    'skill:a': { n: 1, ms: 5 },
    'tool:x': { n: 1, ms: 100000 },
  })
  assert.equal(rows[0].timeShare, 0)
})

test('缺字段、空表都不炸', () => {
  assert.deepEqual(historyTop({}), [])
  assert.deepEqual(historyTop(undefined), [])
  const rows = historyTop({ 'skill:a': { n: 2 }, 'skill:b': { n: 2 } })
  assert.equal(rows.length, 2)
  assert.equal(rows[0].ms, 0)
})

test('同次数按耗时降序，再按名字稳定排序', () => {
  const rows = historyTop({
    'skill:b': { n: 5, ms: 100 },
    'skill:a': { n: 5, ms: 900 },
    'skill:c': { n: 5, ms: 100 },
  })
  assert.deepEqual(
    rows.map((row) => row.name),
    ['a', 'b', 'c'],
  )
})

test('超大计数不丢精度', () => {
  const rows = historyTop({ 'skill:huge': { n: 50000, ms: 7200000 } })
  assert.equal(rows[0].n, 50000)
  assert.equal(rows[0].share, 100)
  assert.equal(rows[0].timeShare, null) // 没有 tool: 分母，未测得
})
