/**
 * 技能推荐的纯逻辑：根据「正在写的草稿 + 最近几条用户消息 + 本会话已用技能 + 历史用量」给技能打分。
 * 不调模型、不碰文件；Host 与测试共用。每条推荐都带看得懂的理由，不做黑箱。
 *
 * 文本匹配：
 * - 英文按单词切（≥3 个字符，去掉常见虚词），中文按相邻两字切（去掉「帮我」「一下」这类虚词拼接）；
 *   中文草稿另补常见说法的英文词（视频→video），这样也能匹配只有英文说明的技能。
 * - 技能的词来自：英文名各段（权重 3）、中文名（权重 3）、英文与中文说明（权重 1）。
 * - 词的价值按 IDF 算：越多技能共有的词（如 "code"、"文件"）越不值钱。
 * 信号与权重（得分再压到 0–1）：
 * - draft   草稿匹配 ×1.0   —— 最直接的意图
 * - recent  最近用户消息匹配 ×0.6（越近越重；只认技能名 / 中文名里的词）
 * - pair    和本会话已用技能常一起用（每个搭档 +3，最多算 3 个）
 * - habit   历史常用 ×0.12（只做加成，不会单靠它上榜）
 * 本会话已经加载过的技能 ×0.5：模型已经有它了，再推荐价值不大；已停用的 ×0.85：要多一步启用。
 * 另有：覆盖度（命中词越多越可信）、名字专注度（名字讲的是别的事就打折）、你点选过的加分，
 * 最后只保留不低于第一名 45% 的结果。
 */

export const SUGGEST_MIN = 0.25
export const SUGGEST_MAX = 12

const STOP = new Set(('the and for with use when this that you your from into any are can not all how what its via also skill skills user users asks used ' +
  'since step steps before after then than make makes made need needs new one more most using work works help helps like just only very ' +
  'about over such each other into onto out off our who why which while will would should could there their them they these those ' +
  'get got let lets want wants way ways thing things file files task tasks run runs set sets add adds based way does did done ' +
  'please thanks now here good well really maybe some something').split(/\s+/))
/** 含这些字的中文两字组多半是虚词拼接（帮我、一下、我把、查一），不当作词。 */
const HAN_FILLER = new Set(Array.from('一的了我你他她它们把个下这那是在和有就也都要帮给吧呢吗啊么点些得着过被让请再还又很太更最'))
const HAN_STOP = new Set(['做成', '好看', '可以', '然后', '现在', '需要', '东西', '问题', '看看', '一样', '什么', '怎么', '如何', '感觉', '觉得', '时候', '之后', '之前', '这样', '那样'])
/** 常见中文说法 → 英文说明里的词：中文草稿也能匹配只有英文说明的技能。 */
const ZH_EN = {
  视频: ['video'], 分镜: ['storyboard', 'shot'], 镜头: ['shot', 'camera'], 动画: ['animation', 'motion'], 图片: ['image'], 图像: ['image'],
  表格: ['spreadsheet', 'excel', 'xlsx'], 报告: ['report'], 网页: ['web', 'page'], 前端: ['frontend'], 界面: ['interface', 'ui'],
  测试: ['test', 'testing'], 文档: ['document', 'docs', 'docx'], 幻灯: ['slides', 'presentation'], 演示: ['presentation', 'slides'],
  代码: ['code'], 审查: ['review'], 评审: ['review'], 设计: ['design'], 音乐: ['music'], 音效: ['sound', 'audio'], 翻译: ['translate', 'translation'],
  数据: ['data'], 图表: ['chart', 'diagram'], 报错: ['error', 'debug'], 排错: ['debug', 'debugging'], 调试: ['debug', 'debugging'],
  爬虫: ['crawl', 'scrape'], 部署: ['deploy', 'deployment'], 接口: ['api', 'interface'], 重构: ['refactor'],
  架构: ['architecture'], 规划: ['plan', 'planning'], 计划: ['plan', 'planning'], 拆解: ['breakdown'], 安全: ['security'],
  性能: ['performance'], 小说: ['novel'], 剧本: ['script', 'screenplay'], 提示: ['prompt'], 浏览: ['browser'], 模组: ['mod'],
}

function hanTerms(run) {
  const chars = Array.from(run)
  const out = []
  for (let i = 0; i + 1 < chars.length; i += 1) {
    if (HAN_FILLER.has(chars[i]) || HAN_FILLER.has(chars[i + 1])) continue
    const pair = chars[i] + chars[i + 1]
    if (!HAN_STOP.has(pair)) out.push(pair)
  }
  return out
}

/** 粗略词干：debugging → debug，reviews → review；只动 5 个字母以上的英文词，两边一致即可，不求语言学正确。 */
export function stem(word) {
  if (word.length <= 5 || /[^a-z]/.test(word)) return word
  if (word.endsWith('ing')) return word.slice(0, -3).replace(/(.)\1$/, '$1')
  if (word.endsWith('ies')) return word.slice(0, -3) + 'y'
  if (word.endsWith('ed')) return word.slice(0, -2).replace(/(.)\1$/, '$1')
  if (word.endsWith('es') && /(ch|sh|x|ss)es$/.test(word)) return word.slice(0, -2)
  if (word.endsWith('s') && !word.endsWith('ss')) return word.slice(0, -1)
  return word
}

/** 文本 → 词数组：英文单词（小写，≥3 个字符，常见虚词除外）+ 中文相邻两字（虚词拼接除外）。 */
export function tokenize(text) {
  const out = []
  const value = String(text || '').toLowerCase()
  for (const word of value.match(/[a-z0-9][a-z0-9+#.]*[a-z0-9+#]|[a-z0-9]{2,}/g) || []) {
    if ((word.length >= 3 || /^(ui|ux|ai|3d|qa|db|pr|ci|cd)$/.test(word)) && !STOP.has(word)) out.push(stem(word))
  }
  for (const run of value.match(/\p{Script=Han}+/gu) || []) out.push(...hanTerms(run))
  return out
}

/** 同义的中文说法：拆成 ≈ 拆解，排查 ≈ 排错。 */
const ZH_ZH = { 拆成: ['拆解'], 拆分: ['拆解'], 排查: ['排错'], 颜色: ['配色'], 调色: ['配色'], 漏洞: ['安全'], 字体: ['排版'], 合并: ['审查'], 方案: ['设计'], 讲解: ['重讲'] }

/**
 * 草稿 / 消息 → 带权的查询词 [词, 权重]：原词 1，补出来的同义词 0.6（同义只是猜测，不该和原词一样重）。
 * 补词包括中文常见说法对应的英文词（匹配只有英文说明的技能）和少量中文同义词。
 */
export function queryTerms(text) {
  const weights = new Map()
  const put = (term, weight) => weights.set(term, Math.max(weights.get(term) || 0, weight))
  const base = tokenize(text)
  for (const term of base) put(term, 1)
  for (const term of base) {
    for (const word of ZH_EN[term] || []) put(stem(word), 0.6)
    for (const word of ZH_ZH[term] || []) put(word, 0.6)
  }
  return [...weights.entries()]
}

/** 技能 → 带权词表 Map<词, 权重>。名字里的词比说明里的值钱。 */
export function skillTerms(skill) {
  const terms = new Map()
  const add = (text, weight) => {
    for (const term of tokenize(text)) terms.set(term, Math.max(terms.get(term) || 0, weight))
  }
  add(String(skill.name || '').replace(/[-_]+/g, ' '), 3)
  add(skill.zh, 3)
  add(skill.description, 1)
  add(skill.descriptionZh, 1)
  return terms
}

/** 所有技能的 IDF：log(1 + N / 含该词的技能数)。 */
export function inverseFrequency(termSets) {
  const df = new Map()
  for (const terms of termSets) for (const term of terms.keys()) df.set(term, (df.get(term) || 0) + 1)
  const n = Math.max(1, termSets.length)
  const idf = new Map()
  for (const [term, count] of df) idf.set(term, Math.log(1 + n / count))
  return idf
}

/**
 * 一段文本和一个技能词表的匹配度、命中了几个不同的词（hits），以及贡献最大的词（作理由用）。
 * textTerms 可以是词数组，也可以是 queryTerms 的 [词, 权重] 数组。
 */
export function overlap(textTerms, terms, idf, minWeight = 0) {
  let score = 0
  let hits = 0
  let best = ''
  let bestValue = 0
  const query = new Map((Array.isArray(textTerms) ? textTerms : []).map((item) => (Array.isArray(item) ? item : [item, 1])))
  for (const [term, queryWeight] of query) {
    const weight = terms.get(term)
    if (!weight || weight < minWeight) continue
    const value = weight * queryWeight * (idf.get(term) || 1)
    score += value
    hits += queryWeight >= 1 ? 1 : 0.6
    if (value > bestValue) {
      bestValue = value
      best = term
    }
  }
  return { score, hits, term: best }
}

const squash = (x) => 1 - Math.exp(-x)

/**
 * 名字专注度：技能名里的词（按 IDF 加权）被草稿说中了多少。名字讲的是别的事（如「上古卷轴 Mod 排错」
 * 之于一般的脚本报错）时打折，最多打到 0.6；名字被说中越多越接近 1。
 */
function nameFocus(terms, queryTerms, idf) {
  const query = new Set(queryTerms.map((item) => (Array.isArray(item) ? item[0] : item)))
  let total = 0
  let hit = 0
  for (const [term, weight] of terms) {
    if (weight < 3) continue
    const value = idf.get(term) || 1
    total += value
    if (query.has(term)) hit += value
  }
  return total ? 0.6 + 0.4 * Math.min(1, (hit / total) * 2) : 1
}

/**
 * skills: [{ name, zh?, description?, descriptionZh?, live, movable, tokens, group, uses, together: string[] }]
 * context: { draft?, recent?: string[]（新→旧）, used?: string[]（本会话已加载）, dismissed?: string[] }
 * 返回按得分排序的推荐：[{ name, zh, match(0–1), reasons: [{ kind, text }], live, movable, tokens, group }]
 */
export function suggestSkills(skills, context = {}) {
  const list = (Array.isArray(skills) ? skills : []).filter((skill) => skill && typeof skill.name === 'string' && skill.name && !skill.name.startsWith('.'))
  if (!list.length) return []
  const dismissed = new Set(Array.isArray(context.dismissed) ? context.dismissed : [])
  const used = new Set(Array.isArray(context.used) ? context.used : [])
  const termSets = list.map(skillTerms)
  const idf = inverseFrequency(termSets)
  const draftTerms = queryTerms(context.draft)
  const recent = (Array.isArray(context.recent) ? context.recent : []).slice(0, 3).map(queryTerms)
  // 搭档关系双向算：已用技能把它列为常用搭档，或它把某个已用技能列为常用搭档，都算一次。
  const togetherOf = (skill) => (Array.isArray(skill.together) ? skill.together : [])
  const partnersOf = (skill) => list.filter((other) => other !== skill && used.has(other.name) && (togetherOf(other).includes(skill.name) || togetherOf(skill).includes(other.name)))
  const usesMax = Math.max(1, ...list.map((skill) => Number(skill.uses) || 0))
  const picked = context.picked && typeof context.picked === 'object' ? context.picked : {}
  // 覆盖度：命中词越多越可信。只撞上一个泛词的技能，在别人命中多个词时要让位。
  const draftHits = list.map((skill, index) => overlap(draftTerms, termSets[index], idf))
  const maxHits = Math.max(0, ...draftHits.map((hit) => hit.hits))
  const results = []
  list.forEach((skill, index) => {
    if (dismissed.has(skill.name)) return
    const terms = termSets[index]
    const reasons = []
    const draft = draftHits[index]
    const coverage = maxHits > 1 && draft.hits ? Math.pow(draft.hits / maxHits, 0.7) : 1
    let raw = draft.score * coverage * nameFocus(terms, draftTerms, idf)
    if (draft.term) reasons.push({ kind: 'draft', text: draft.term, weight: draft.score })
    let recentScore = 0
    let recentTerm = ''
    recent.forEach((tokens, i) => {
      const hit = overlap(tokens, terms, idf, 3) // 旧消息只认技能名里的词：说明里的泛词太容易误中
      const value = hit.score * (1 - i * 0.25)
      if (value > recentScore) recentTerm = hit.term || recentTerm
      recentScore += value
    })
    raw += recentScore * 0.6
    if (recentTerm && !reasons.some((reason) => reason.text === recentTerm)) reasons.push({ kind: 'recent', text: recentTerm, weight: recentScore * 0.6 })
    const partners = used.has(skill.name) ? [] : partnersOf(skill)
    if (partners.length) {
      const value = Math.min(3, partners.length) * 3
      raw += value
      reasons.push({ kind: 'pair', text: partners[0].zh || partners[0].name, weight: value })
    }
    if (raw <= 0) return // 没有任何内容相关的信号：历史常用不足以单独上榜
    const habit = (Number(skill.uses) || 0) / usesMax
    raw += habit * 0.12 * 4
    if (habit >= 0.5) reasons.push({ kind: 'habit', text: '', weight: habit * 0.48 })
    // 你从推荐栏里点过它：小幅加分（最多 +1.5），让推荐慢慢贴近你的习惯。
    const picks = Number(picked[skill.name]) || 0
    if (picks > 0) {
      raw += Math.min(1.5, Math.log2(1 + picks) * 0.6)
      reasons.push({ kind: 'picked', text: '', weight: 0.3 })
    }
    if (used.has(skill.name)) raw *= 0.5
    // 已停用的技能要多一步启用，同等相关时让可直接用的排前面（仍会显示）。
    if (skill.live === false) raw *= 0.85
    const match = squash(raw / 8)
    if (match < SUGGEST_MIN) return
    reasons.sort((a, b) => b.weight - a.weight)
    results.push({
      name: skill.name,
      zh: skill.zh || '',
      match: Math.round(match * 100) / 100,
      reasons: reasons.slice(0, 2).map((reason) => ({ kind: reason.kind, text: reason.text })),
      live: skill.live !== false,
      movable: Boolean(skill.movable),
      tokens: Number(skill.tokens) || 0,
      group: skill.group || 'ops',
      loaded: used.has(skill.name),
    })
  })
  results.sort((a, b) => b.match - a.match || a.name.localeCompare(b.name))
  // 相对门槛：低于第一名 45% 的多半是凑数的弱匹配，不展示。
  const floor = results.length ? results[0].match * 0.45 : 0
  return results.filter((row) => row.match >= floor).slice(0, SUGGEST_MAX)
}
