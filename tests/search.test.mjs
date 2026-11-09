import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const here = dirname(fileURLToPath(import.meta.url))
const src = readFileSync(join(here, '..', 'client.js'), 'utf8')
const start = src.indexOf('// #region search-core')
const end = src.indexOf('// #endregion search-core')

assert.ok(start >= 0 && end > start, 'client.js 里缺少 search-core 区块')

const loaded = new Function(
  src.slice(start, end) + '\nreturn { splitSearchTerms, searchEntries, dragPayload }',
)()
const { splitSearchTerms, searchEntries, dragPayload } = loaded

const entries = [
  {
    key: 'skill:novel-script-writer',
    kind: 'skill',
    name: 'novel-script-writer',
    label: '小说与剧本',
    alt: 'Fiction & scripts',
    desc: '写小说、网文、故事、剧本和 AI 短剧剧本',
    tag: '文字',
    lib: '自装技能',
    hints: '剧本 小说 分镜 短剧 对白 故事',
    availability: 'session',
  },
  {
    key: 'tool:whale_studio',
    kind: 'tool',
    name: 'whale_studio',
    label: '节点式工坊',
    alt: 'Node studio',
    desc: '在聊天区打开鲸影节点式工坊',
    tag: '视频',
    lib: 'whale',
    hints: '工作台 节点 画布 分镜 视频 流水线',
    availability: 'session',
  },
  {
    key: 'tool:mcp__chrome-devtools__list_mcp_resources',
    kind: 'tool',
    name: 'mcp__chrome-devtools__list_mcp_resources',
    label: '列出 MCP 资源',
    alt: 'List MCP resources',
    desc: 'List resources available from an MCP server.',
    tag: '网络',
    lib: 'chrome-devtools',
    hints: 'mcp 资源 清单',
    availability: 'session',
  },
  {
    key: 'tool:mcp__chrome-devtools__click',
    kind: 'tool',
    name: 'mcp__chrome-devtools__click',
    label: '点击',
    alt: 'Click',
    desc: 'Clicks on the provided element',
    tag: '网络',
    lib: 'chrome-devtools',
    hints: 'mcp 浏览器 点击',
    availability: 'session',
  },
  {
    key: 'skill:office-xlsx',
    kind: 'skill',
    name: 'office-xlsx',
    label: 'Excel 表格',
    alt: 'Excel workbook',
    desc: '创建、读取、编辑和验证 Excel 工作簿',
    tag: '文档',
    lib: 'DSH 内置技能',
    hints: '表格 Excel 数据',
    availability: 'cold',
  },
  {
    key: 'skill:source-driven-development',
    kind: 'skill',
    name: 'source-driven-development',
    label: '按官方文档实现',
    alt: 'Source-driven development',
    desc: '按官方文档写代码',
    tag: '代码',
    lib: '自装技能',
    hints: '官方文档 代码',
    availability: 'installed',
  },
]

test('splitSearchTerms 按空白与中英文逗号切词', () => {
  assert.deepEqual(splitSearchTerms('剧本  工作台，分镜、对白'), ['剧本', '工作台', '分镜', '对白'])
  assert.deepEqual(splitSearchTerms('   '), [])
})

test('空查询不返回结果', () => {
  assert.equal(searchEntries(entries, '').length, 0)
  assert.equal(searchEntries(entries, '   ').length, 0)
})

test('「工作台」靠关键词命中节点式工坊，而不是靠名字', () => {
  const rows = searchEntries(entries, '工作台')
  assert.ok(rows.some((row) => row.entry.key === 'tool:whale_studio'))
})

test('多关键词是并集：剧本 + 工作台 两个都出来', () => {
  const keys = searchEntries(entries, '剧本 工作台').map((row) => row.entry.key)
  assert.ok(keys.includes('skill:novel-script-writer'))
  assert.ok(keys.includes('tool:whale_studio'))
})

test('命中更多关键词的条目排在前面', () => {
  const rows = searchEntries(entries, 'mcp 资源')
  assert.equal(rows[0].entry.key, 'tool:mcp__chrome-devtools__list_mcp_resources')
  assert.ok(rows.some((row) => row.entry.key === 'tool:mcp__chrome-devtools__click'))
})

test('精确名称优先于描述命中', () => {
  const rows = searchEntries(entries, '点击')
  assert.equal(rows[0].entry.key, 'tool:mcp__chrome-devtools__click')
})

test('命中两个词的工具，压过只靠 mcp__ 前缀命中的工具', () => {
  const mixed = [
    {
      key: 'tool:list_mcp_resources',
      kind: 'tool',
      name: 'list_mcp_resources',
      label: '列出 MCP 资源',
      alt: 'List MCP resources',
      desc: 'List resources available from an MCP server.',
      tag: '元',
      lib: 'mcp',
      hints: '',
      availability: 'session',
    },
    {
      key: 'tool:mcp__chrome-devtools__press_key',
      kind: 'tool',
      name: 'mcp__chrome-devtools__press_key',
      label: '按键',
      alt: 'Press key',
      desc: 'Press a key combination.',
      tag: '网络',
      lib: 'chrome-devtools',
      hints: '',
      availability: 'session',
    },
  ]
  const rows = searchEntries(mixed, 'MCP 资源')
  assert.equal(rows[0].entry.key, 'tool:list_mcp_resources')
})

test('可插入项排在冷层与未挂载之前', () => {
  const rows = searchEntries(entries, '技能')
  const rank = { session: 0, cold: 1, installed: 2 }
  const availabilities = rows.map((row) => row.entry.availability)
  for (let i = 1; i < availabilities.length; i += 1) {
    assert.ok(rank[availabilities[i - 1]] <= rank[availabilities[i]])
  }
})

test('技能拖拽写 /英文本名，不是 @中文名', () => {
  assert.deepEqual(
    dragPayload({ kind: 'skill', name: 'novel-script-writer', label: '小说与剧本' }),
    { 'text/plain': '/novel-script-writer ' },
  )
})

test('工具拖拽写反引号 id，工具没有 / 引用', () => {
  assert.deepEqual(
    dragPayload({ kind: 'tool', name: 'whale_studio', label: '节点式工坊' }),
    { 'text/plain': '`whale_studio` ' },
  )
})
