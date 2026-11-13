import test from 'node:test'
import assert from 'node:assert/strict'
import { suggestSkills, tokenize, SUGGEST_MAX } from '../skill-suggest-core.js'

const skills = [
  { name: 'pdf', zh: 'PDF 生成', description: 'Create, read and merge PDF files.', descriptionZh: '生成、读取、合并 PDF 文件', live: true, tokens: 200, group: 'ops', uses: 20, together: ['xlsx'] },
  { name: 'xlsx', zh: '表格处理', description: 'Spreadsheet editing with formulas and charts.', descriptionZh: '编辑电子表格、公式和图表', live: true, tokens: 190, group: 'ops', uses: 30, together: ['pdf'] },
  { name: 'archify', zh: '图解页面', description: 'Interactive diagrams and architecture pages.', descriptionZh: '制作流程图、架构图等图解页面', live: false, movable: true, tokens: 300, group: 'visual', uses: 3, together: ['pdf'] },
  { name: 'debugging-and-error-recovery', zh: '排错与恢复', description: 'Systematic debugging of errors and failing tests.', descriptionZh: '系统地排查报错和失败的测试', live: false, movable: true, tokens: 280, group: 'code', uses: 9, together: [] },
  { name: 'frontend-design', zh: '前端设计', description: 'Distinctive frontend interfaces and web pages.', descriptionZh: '设计有辨识度的前端界面和网页', live: true, tokens: 380, group: 'visual', uses: 50, together: ['archify'] },
]

test('tokenize: English words and Chinese bigrams, no single Han characters', () => {
  assert.deepEqual(tokenize('Make a PDF 报告'), ['pdf', '报告'])
  assert.deepEqual(tokenize('帮我排查一下'), ['排查'])
  assert.deepEqual(tokenize('排错'), ['排错'])
  assert.deepEqual(tokenize('图'), [])
})

test('draft in Chinese finds the right skill through its Chinese name and description', () => {
  const top = suggestSkills(skills, { draft: '帮我把季度数据做成 PDF 报告' })
  assert.equal(top[0].name, 'pdf')
  assert.equal(top[0].reasons[0].kind, 'draft')
  const bug = suggestSkills(skills, { draft: '脚本又报错了，帮我排查一下' })
  assert.equal(bug[0].name, 'debugging-and-error-recovery')
  assert.equal(bug[0].live, false)
  assert.equal(bug[0].movable, true)
})

test('no content signal: habit alone never puts a skill on the list', () => {
  assert.deepEqual(suggestSkills(skills, { draft: '' }), [])
  assert.deepEqual(suggestSkills(skills, { draft: '你好' }), [])
})

test('skills used together with ones already loaded this session are suggested, with the partner as reason', () => {
  const out = suggestSkills(skills, { draft: '', used: ['pdf'] })
  const archify = out.find((row) => row.name === 'archify')
  assert.ok(archify, 'archify pairs with pdf')
  assert.equal(archify.reasons[0].kind, 'pair')
  assert.equal(archify.reasons[0].text, 'PDF 生成')
})

test('recent user messages count, the latest more than older ones', () => {
  const out = suggestSkills(skills, { draft: '', recent: ['把首页的前端界面改好看一点'] })
  assert.equal(out[0].name, 'frontend-design')
  assert.equal(out[0].reasons[0].kind, 'recent')
})

test('loaded skills are down-weighted, dismissed ones excluded, results capped and sorted', () => {
  const fresh = suggestSkills(skills, { draft: 'PDF 报告' })[0]
  const loaded = suggestSkills(skills, { draft: 'PDF 报告', used: ['pdf'] }).find((row) => row.name === 'pdf')
  assert.ok(!loaded || loaded.match < fresh.match)
  if (loaded) assert.equal(loaded.loaded, true)
  assert.equal(suggestSkills(skills, { draft: 'PDF 报告', dismissed: ['pdf'] }).some((row) => row.name === 'pdf'), false)
  const many = Array.from({ length: 40 }, (_, i) => ({ name: 'pdf-tool-' + i, description: 'pdf helper', live: true })).concat(Array.from({ length: 300 }, (_, i) => ({ name: 'other-' + i, description: 'unrelated thing ' + i, live: true })))
  const capped = suggestSkills(many, { draft: 'pdf' })
  assert.equal(capped.length, SUGGEST_MAX)
  for (let i = 1; i < capped.length; i += 1) assert.ok(capped[i - 1].match >= capped[i].match)
})

test('garbage input never throws', () => {
  assert.deepEqual(suggestSkills(null, null ?? {}), [])
  assert.deepEqual(suggestSkills([null, {}, { name: '.hidden' }], { draft: 'x' }), [])
})

test('stemming matches word forms: debugging ~ debug, reviewed ~ review', async () => {
  const { stem } = await import('../skill-suggest-core.js')
  assert.equal(stem('debugging'), 'debug')
  assert.equal(stem('reviewed'), 'review')
  assert.equal(stem('running'), 'run')
  assert.equal(stem('class'), 'class')
})

test('coverage and name focus: a skill matching several words beats one that only shares a word with its name', () => {
  const pool = [
    { name: 'game-mod-debug', zh: '游戏模组排错', description: 'Debug game mod load order.', live: true },
    { name: 'debugging-and-error-recovery', zh: '排错恢复', description: 'Systematic debugging of errors and failing builds.', live: true },
  ]
  const out = suggestSkills(pool, { draft: 'the build keeps failing with an error' })
  assert.equal(out[0].name, 'debugging-and-error-recovery')
})

test('weak tail matches far below the best one are not shown; clicks from the dock add a small boost', () => {
  const pool = skills.concat([{ name: 'misc', description: 'A report helper with many other words', live: true }])
  const out = suggestSkills(pool, { draft: '帮我把季度数据做成 PDF 报告' })
  assert.ok(out.every((row) => row.match >= out[0].match * 0.45))
  const base = suggestSkills(skills, { draft: '图表' }).find((row) => row.name === 'xlsx')
  const boosted = suggestSkills(skills, { draft: '图表', picked: { xlsx: 5 } }).find((row) => row.name === 'xlsx')
  assert.ok(boosted, 'boosted result present')
  assert.ok(boosted.match > (base ? base.match : 0))
  assert.ok(boosted.reasons.some((reason) => reason.kind === 'picked') || boosted.reasons.length === 2)
})

test('skills already referenced in the draft are not suggested and their names do not leak into matching', async () => {
  const { extractReferences } = await import('../skill-suggest-core.js')
  const pool = skills.concat([{ name: 'craft-anything', zh: '逆向调研', description: 'Research any software or game interface with evidence.', live: true, together: ['frontend-design'] }])
  const ref = extractReferences('/craft-anything 看看这个游戏的界面', pool, [])
  assert.deepEqual(ref.names, ['craft-anything'])
  assert.ok(!ref.text.includes('craft'))
  const out = suggestSkills(pool, { draft: '/craft-anything 帮我把季度数据做成 PDF 报告' })
  assert.equal(out.some((row) => row.name === 'craft-anything'), false)
  assert.equal(out[0].name, 'pdf')
  // 引用块（界面传来的文字，可能是中文名）同样识别；被引用的技能照样带出常用搭档。
  const chip = suggestSkills(pool, { draft: '', referenced: ['逆向调研'] })
  assert.equal(chip.some((row) => row.name === 'craft-anything'), false)
  assert.ok(chip.some((row) => row.name === 'frontend-design' && row.reasons[0].kind === 'pair'))
  // 不是技能的斜杠词保持原样
  assert.equal(extractReferences('路径 /usr/bin 下', pool, []).text, '路径 /usr/bin 下')
})
