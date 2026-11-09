/**
 * 新技能自动翻译的纯逻辑：选出待翻译条目、拼提示词、解析模型输出、合并进覆盖层。
 * 不碰网络、不碰文件，Host 与测试共用。
 *
 * 规则：
 * - 只补缺：已有中文名 / 中文说明（catalog.js 或覆盖层，包括用户手改的）一律不动。
 * - 写进覆盖层的条目同时记一笔 autoTranslated[key]，界面和以后的逻辑能分清哪些是机翻。
 * - 模型输出不可信：只接受本批里的 id，去掉换行、限长，空的丢掉。
 */

export const TRANSLATE_BATCH = 20
export const NAME_MAX = 24
export const DESC_MAX = 120

const hasZh = (row) => Boolean(row && typeof row.zh === 'string' && row.zh.trim())

function oneLine(value, max) {
  const text = String(value == null ? '' : value).replace(/\s+/g, ' ').trim()
  const chars = Array.from(text)
  return chars.length > max ? chars.slice(0, max).join('') : text
}

/** 技能 id → 英文显示名的兜底：code-review → Code review。 */
export function humanize(id) {
  const words = String(id || '').replace(/[-_]+/g, ' ').trim()
  return words ? words.charAt(0).toUpperCase() + words.slice(1) : ''
}

/**
 * skills: [{ name, description }]（自装技能，含冷层）
 * names / descs: 合并后的词典（catalog.js + 覆盖层），键为 `skill:<id>`
 * curated: catalog.js 收录的技能 id。客户端对它们有精选中文短说明（覆盖层会压过它），
 *          所以这些只补名字、不补说明。
 */
export function pendingTranslations(skills, names, descs, curated) {
  const known = curated instanceof Set ? curated : new Set(Array.isArray(curated) ? curated : [])
  const seen = new Set()
  const out = []
  for (const skill of Array.isArray(skills) ? skills : []) {
    const name = skill && typeof skill.name === 'string' ? skill.name.trim() : ''
    // 工具也走这里（DSH 插件带来的工具同样没有中文名）：kind:'tool' → 键 `tool:<name>`。
    const kind = skill && skill.kind === 'tool' ? 'tool' : 'skill'
    if (!name || seen.has(name)) continue
    seen.add(name)
    const key = kind + ':' + name
    const description = oneLine(skill.description, 600)
    const needName = !hasZh(names && names[key])
    const needDesc = Boolean(description) && !known.has(key) && !known.has(name) && !hasZh(descs && descs[key])
    if (!needName && !needDesc) continue
    out.push({ key, name, kind, description, needName, needDesc })
  }
  return out.sort((a, b) => a.name.localeCompare(b.name))
}

export function translationPrompt(batch) {
  const rows = batch.map((item) => ({ id: item.name, description: item.description || '' }))
  return [
    '把下面这些 AI agent 技能 / 工具翻译成简体中文，用于一个面板的能力列表。',
    '每个技能给两样：',
    '- name：中文短名，2～8 个字，说清它是干什么的，不要直译 id，不要加引号或标点结尾。例：tdd → 测试驱动；diagnosing-bugs → 难 bug 诊断；writing-for-agents → 写给 agent 的文档。',
    '- desc：一句中文说明，不超过 50 个字，说它在什么时候用、做什么。description 为空就给空字符串。',
    '专有名词（产品名、文件格式、命令）保留原文。',
    '只输出一个 JSON 数组，不要任何解释或代码块标记，格式：[{"id":"<原 id>","name":"…","desc":"…"}]',
    '',
    JSON.stringify(rows, null, 1),
  ].join('\n')
}

/** 从模型输出里取 JSON 数组；容忍 ``` 包裹和前后多余文字。 */
export function parseTranslations(text, batch) {
  const raw = String(text || '')
  const start = raw.indexOf('[')
  const end = raw.lastIndexOf(']')
  if (start < 0 || end <= start) return []
  let rows
  try {
    rows = JSON.parse(raw.slice(start, end + 1))
  } catch {
    return []
  }
  if (!Array.isArray(rows)) return []
  const wanted = new Map(batch.map((item) => [item.name, item]))
  const out = []
  const done = new Set()
  for (const row of rows) {
    if (!row || typeof row !== 'object') continue
    const item = wanted.get(typeof row.id === 'string' ? row.id.trim() : '')
    if (!item || done.has(item.name)) continue
    const name = item.needName ? oneLine(row.name, NAME_MAX).replace(/[。．.！!，,；;：:]+$/, '') : ''
    const desc = item.needDesc ? oneLine(row.desc, DESC_MAX) : ''
    if (!name && !desc) continue
    done.add(item.name)
    out.push({ key: item.key, id: item.name, name, desc })
  }
  return out
}

/**
 * 合并进覆盖层数据（在覆盖层的写锁里调用，data 是锁内刚读到的最新内容）。
 * 返回新数据；什么都没变返回 null（调用方据此不写文件）。
 */
export function applyTranslations(data, results, meta = {}) {
  const next = data && typeof data === 'object' ? structuredClone(data) : {}
  if (next.version === undefined && Object.keys(next).length === 0) next.version = 1
  next.names = next.names && typeof next.names === 'object' ? next.names : {}
  next.descs = next.descs && typeof next.descs === 'object' ? next.descs : {}
  next.autoTranslated = next.autoTranslated && typeof next.autoTranslated === 'object' ? next.autoTranslated : {}
  const at = Number.isFinite(meta.now) ? meta.now : Date.now()
  let changed = false
  for (const row of Array.isArray(results) ? results : []) {
    const record = { at }
    if (meta.model) record.model = String(meta.model)
    if (row.name && !hasZh(next.names[row.key])) {
      const current = next.names[row.key] && typeof next.names[row.key] === 'object' ? next.names[row.key] : {}
      next.names[row.key] = Object.assign({ en: humanize(row.id) }, current, { zh: row.name })
      record.name = row.name
    }
    if (row.desc && !hasZh(next.descs[row.key])) {
      const current = next.descs[row.key] && typeof next.descs[row.key] === 'object' ? next.descs[row.key] : {}
      next.descs[row.key] = Object.assign({}, current, { zh: row.desc })
      record.desc = row.desc
    }
    if (record.name || record.desc) {
      next.autoTranslated[row.key] = record
      changed = true
    }
  }
  return changed ? next : null
}

export default {
  TRANSLATE_BATCH,
  NAME_MAX,
  DESC_MAX,
  humanize,
  pendingTranslations,
  translationPrompt,
  parseTranslations,
  applyTranslations,
}
