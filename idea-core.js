/**
 * 灵感与分支：开发路上助手给出的方向、用户自己说的「以后再做」，按工作区统一收起来。
 * 纯逻辑，不碰文件和网络；Host 与测试共用。
 *
 * 一条灵感：{ id, workspace, cwd, text, source, sessionId, messageId, turn, status, goalId,
 *             maybeDone, createdAt, updatedAt, doneAt }
 * - source：assistant（助手给的方向）| user（用户说的以后再做）| manual | history（回填）
 * - status：open 待做 | doing 已设为目标 | done 已完成 | dropped 忽略
 * - maybeDone：模型对照最近对话判断「可能已经顺手做了」，{ at, evidence }；只提示，等用户确认
 *
 * 收集分两步：先用关键词预筛（大部分回合不花钱），命中了才请模型把方向提炼成一条条。
 */

import { workspaceKey } from './goal-core.js'

export const IDEA_TEXT_MAX = 80
export const IDEA_CAPACITY = 500
export const IDEAS_PER_CALL = 8

/* ── 预筛 ─────────────────────────────────────────────────────────── */

const ASSISTANT_CUE = /(下一步|下一轮|接下来|后续|还可以|也可以|可以考虑|值得做|建议|方向|路线图|还没做|没做的|还剩|待办|follow[- ]?up|next steps?|could also|consider|roadmap|later)/i
const LIST_LINE = /^\s*(?:[-*•·]|\d+[.、)）]|[①②③④⑤⑥⑦⑧⑨⑩]|[（(]\d+[)）])\s*\S/
const USER_CUE = /(以后|回头|之后再|晚点|下次|先不做|先放着|留着|记一下|记下来|备忘|todo|later|backlog)/i

const CUE_GLOBAL = new RegExp(ASSISTANT_CUE.source, 'gi')

/**
 * 助手在回答后段（后 45%）提到「下一步 / 还可以 / 还剩 …」，并且这个提示之后至少跟着两行列表项。
 * 正文中间的「建议你先…」不算：方向清单几乎总是放在回答末尾。
 */
export function assistantHasIdeas(text) {
  const value = String(text || '')
  if (value.length < 40) return false
  const tailStart = Math.floor(value.length * 0.55)
  let match
  let cueAt = -1
  CUE_GLOBAL.lastIndex = 0
  while ((match = CUE_GLOBAL.exec(value))) {
    if (match.index >= tailStart) {
      cueAt = match.index
      break
    }
  }
  if (cueAt < 0) return false
  const after = value.slice(cueAt).split(/\r?\n/).filter((line) => LIST_LINE.test(line))
  return after.length >= 2
}

/** 用户自己说了「以后 / 回头 / 先不做 / 记一下」。 */
export function userHasIdeas(text) {
  return USER_CUE.test(String(text || ''))
}

/* ── 模型提炼 ─────────────────────────────────────────────────────── */

function clip(text, max) {
  const value = String(text || '').replace(/\s+/g, ' ').trim()
  const chars = Array.from(value)
  return chars.length > max ? chars.slice(0, max - 1).join('') + '…' : value
}

/**
 * turns: [{ key, user, assistant }]（同一次调用可以带多轮，回填时用）
 * existing: 这个工作区已有灵感的文字（让模型只给新的）
 */
export function extractPrompt(turns, existing) {
  const rows = (Array.isArray(turns) ? turns : []).map((turn) =>
    '### ' + turn.key + '\n用户：' + clip(turn.user, 600) + '\n助手：' + clip(turn.assistant, 2400),
  )
  const known = (Array.isArray(existing) ? existing : []).slice(0, 60).map((text) => '- ' + clip(text, IDEA_TEXT_MAX))
  return [
    '下面是 AI 编程助手会话里的几轮对话。请找出其中「被提出、但这一轮没有去做」的开发方向 / 功能分支 / 改进点：',
    '- 助手列出的「下一步可以 / 还可以做 / 建议 / 还剩」里的每一项；',
    '- 用户说「以后 / 回头 / 先不做 / 记一下」的事。',
    '每条写成一句中文的动宾短语，具体到能判断是否完成，不超过 30 个字。这一轮已经做完的不要；和「已有」重复或同义的不要。',
    '只输出 JSON 数组，不要解释：[{"turn":"<### 后面的标记>","source":"assistant 或 user","text":"…"}]。没有就输出 []。',
    '',
    known.length ? '已有：\n' + known.join('\n') : '已有：（无）',
    '',
    rows.join('\n\n'),
  ].join('\n')
}

/** 模型回答 → [{ turn, source, text }]；只收本批出现过的 turn 标记，去重、限长、限量。 */
export function parseIdeas(text, turnKeys) {
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
  const allowed = new Set(Array.isArray(turnKeys) ? turnKeys : [])
  const seen = new Set()
  const out = []
  for (const row of rows) {
    if (!row || typeof row !== 'object') continue
    const turn = typeof row.turn === 'string' ? row.turn.trim().replace(/^#+\s*/, '') : ''
    if (allowed.size && !allowed.has(turn)) continue
    const value = clip(String(row.text || '').replace(/[。.！!；;]+$/, ''), IDEA_TEXT_MAX)
    if (!value) continue
    const norm = normalizeIdea(value)
    if (seen.has(norm)) continue
    seen.add(norm)
    out.push({ turn, source: row.source === 'user' ? 'user' : 'assistant', text: value })
    if (out.length >= IDEAS_PER_CALL * Math.max(1, allowed.size || 1)) break
  }
  return out
}

/** 去重用的归一化：小写、去空白和标点。 */
export function normalizeIdea(text) {
  return String(text || '').toLowerCase().replace(/[\s\p{P}\p{S}]+/gu, '')
}

/* ── 存储操作（返回新数组，不改入参） ─────────────────────────────── */

function newId(now, salt) {
  return 'idea-' + Number(now).toString(36) + '-' + Math.random().toString(36).slice(2, 7) + (salt ? '-' + salt : '')
}

/**
 * 加一批灵感到某个工作区；同工作区里文字归一化后相同的（含已完成 / 忽略的）不重复加。
 * items: [{ text, source, sessionId, messageId, turn }]
 */
export function addIdeas(records, cwd, items, now = Date.now()) {
  const list = Array.isArray(records) ? records : []
  const workspace = workspaceKey(cwd)
  if (!workspace) return { records: list, added: [] }
  const known = new Set(list.filter((idea) => idea && idea.workspace === workspace).map((idea) => normalizeIdea(idea.text)))
  const added = []
  for (const item of Array.isArray(items) ? items : []) {
    const text = clip(item && item.text, IDEA_TEXT_MAX)
    const norm = normalizeIdea(text)
    if (!text || !norm || known.has(norm)) continue
    if (list.length + added.length >= IDEA_CAPACITY) break
    known.add(norm)
    added.push({
      id: newId(now, added.length),
      workspace,
      cwd: String(cwd),
      text,
      source: ['assistant', 'user', 'manual', 'history'].includes(item.source) ? item.source : 'assistant',
      sessionId: typeof item.sessionId === 'string' ? item.sessionId : '',
      messageId: typeof item.messageId === 'string' ? item.messageId : '',
      turn: Number.isFinite(item.turn) ? item.turn : 0,
      status: 'open',
      goalId: '',
      maybeDone: null,
      createdAt: Number.isFinite(item.at) ? item.at : now,
      updatedAt: now,
      doneAt: 0,
    })
  }
  return { records: list.concat(added), added }
}

const STATUSES = new Set(['open', 'doing', 'done', 'dropped'])

export function patchIdea(records, id, patch, now = Date.now()) {
  const list = Array.isArray(records) ? records : []
  const index = list.findIndex((idea) => idea && idea.id === id)
  if (index < 0) {
    const error = new Error('idea_not_found')
    error.code = 'idea_not_found'
    error.status = 404
    throw error
  }
  const input = patch && typeof patch === 'object' ? patch : {}
  const next = Object.assign({}, list[index], { updatedAt: now })
  if (input.status !== undefined) {
    if (!STATUSES.has(input.status)) {
      const error = new Error('idea_bad_status')
      error.code = 'idea_bad_status'
      error.status = 400
      throw error
    }
    next.status = input.status
    next.doneAt = input.status === 'done' ? now : 0
    next.maybeDone = null
    if (input.status === 'open') next.goalId = ''
  }
  if (typeof input.goalId === 'string') next.goalId = input.goalId
  if (input.dismissMaybe === true) next.maybeDone = null
  if (typeof input.text === 'string' && input.text.trim()) next.text = clip(input.text, IDEA_TEXT_MAX)
  return { records: list.map((idea, i) => (i === index ? next : idea)), idea: next }
}

/** 目标变化带动灵感：目标完成 → 关联的灵感完成；目标被顶替 / 移除 / 重开 → 回到待做或进行中。 */
export function syncGoal(records, goalId, goalStatus, now = Date.now()) {
  const list = Array.isArray(records) ? records : []
  if (!goalId) return { records: list, changed: 0 }
  let changed = 0
  const next = list.map((idea) => {
    if (!idea || idea.goalId !== goalId) return idea
    let status = idea.status
    if (goalStatus === 'done') status = 'done'
    else if (goalStatus === 'open') status = 'doing'
    else status = 'open'
    if (status === idea.status) return idea
    changed += 1
    return Object.assign({}, idea, {
      status,
      goalId: status === 'open' ? '' : idea.goalId,
      doneAt: status === 'done' ? now : 0,
      maybeDone: null,
      updatedAt: now,
    })
  })
  return { records: next, changed }
}

/** 一个工作区的视图：待做（含「可能已完成」）/ 进行中 / 已完成（最近 20 条）。 */
export function ideasFor(records, cwd) {
  const workspace = workspaceKey(cwd)
  const empty = { workspace, open: [], doing: [], done: [], counts: { open: 0, doing: 0, done: 0, maybeDone: 0 } }
  if (!workspace) return empty
  const mine = (Array.isArray(records) ? records : []).filter((idea) => idea && idea.workspace === workspace)
  const byNew = (a, b) => (b.createdAt || 0) - (a.createdAt || 0)
  const view = (idea) => ({
    id: idea.id,
    text: idea.text,
    source: idea.source,
    sessionId: idea.sessionId,
    messageId: idea.messageId,
    status: idea.status,
    goalId: idea.goalId || '',
    maybeDone: idea.maybeDone || null,
    createdAt: idea.createdAt || 0,
    doneAt: idea.doneAt || 0,
  })
  const open = mine.filter((idea) => idea.status === 'open').sort(byNew)
  const doing = mine.filter((idea) => idea.status === 'doing').sort(byNew)
  const done = mine.filter((idea) => idea.status === 'done').sort((a, b) => (b.doneAt || 0) - (a.doneAt || 0))
  return {
    workspace,
    open: open.slice(0, 50).map(view),
    doing: doing.map(view),
    done: done.slice(0, 20).map(view),
    counts: { open: open.length, doing: doing.length, done: done.length, maybeDone: open.filter((idea) => idea.maybeDone).length },
  }
}

/* ── 「可能已完成」检查 ───────────────────────────────────────────── */

/** ideas: [{ id, text }]；floors: 最近的自然语言楼层 [{ role, text }]。 */
export function donePrompt(ideas, floors) {
  const recent = []
  let used = 0
  const list = Array.isArray(floors) ? floors : []
  for (let i = list.length - 1; i >= 0 && used < 6000; i -= 1) {
    const floor = list[i]
    if (!floor || (floor.role !== 'user' && floor.role !== 'assistant')) continue
    const text = clip(floor.text, 900)
    if (!text) continue
    recent.unshift((floor.role === 'user' ? '用户：' : '助手：') + text)
    used += text.length
  }
  return [
    '下面是一份待做清单，和同一个项目最近的对话。判断清单里哪些事在对话里「已经做完了」（助手明确实现、修复或交付了）。',
    '只在有明确证据时才算；只是讨论过、计划过的不算。',
    '只输出 JSON 数组：[{"id":"<清单 id>","evidence":"一句话说明在对话里怎么看出来的"}]。没有就输出 []。',
    '',
    '清单：',
    (Array.isArray(ideas) ? ideas : []).map((idea) => '- ' + idea.id + '：' + clip(idea.text, IDEA_TEXT_MAX)).join('\n'),
    '',
    '最近的对话：',
    recent.join('\n'),
  ].join('\n')
}

export function parseDone(text, ids) {
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
  const allowed = new Set(Array.isArray(ids) ? ids : [])
  const out = []
  for (const row of Array.isArray(rows) ? rows : []) {
    if (!row || typeof row.id !== 'string' || !allowed.has(row.id)) continue
    out.push({ id: row.id, evidence: clip(row.evidence, 120) })
  }
  return out
}

/** 把检查结果标成「可能已完成」（不改状态）。 */
export function markMaybeDone(records, results, now = Date.now()) {
  const byId = new Map((Array.isArray(results) ? results : []).map((row) => [row.id, row]))
  let changed = 0
  const next = (Array.isArray(records) ? records : []).map((idea) => {
    const hit = idea && byId.get(idea.id)
    if (!hit || idea.status !== 'open') return idea
    changed += 1
    return Object.assign({}, idea, { maybeDone: { at: now, evidence: hit.evidence || '' }, updatedAt: now })
  })
  return { records: next, changed }
}

/* ── 从事件日志里切出「回合」（收集 / 回填共用） ─────────────────── */

function textOf(content) {
  if (typeof content === 'string') return content
  if (!Array.isArray(content)) return ''
  return content.filter((block) => block && block.type === 'text' && typeof block.text === 'string').map((block) => block.text).join('\n')
}

/**
 * events → [{ turn, user, assistant, messageId, at }]，只要已结束的回合。
 * 用户消息记在 turn/start 之后（老日志在之前，两种都认）；助手取这一轮最后一条有自然语言的消息。
 */
export function turnsOf(events, clean = (text) => text) {
  const out = []
  let current = null
  let pendingUser = ''
  for (const event of Array.isArray(events) ? events : []) {
    if (!event || typeof event.type !== 'string') continue
    const data = event.data || {}
    if (event.type === 'user/message') {
      const text = clean(textOf(data.content), 'user')
      if (!text) continue
      if (current && !current.user && !current.messageId) current.user = text
      else if (!current) pendingUser = text
      continue
    }
    if (event.type === 'turn/start' && typeof data.turn === 'number') {
      current = { turn: data.turn, user: pendingUser, assistant: '', messageId: '', at: event.time || 0 }
      pendingUser = ''
      continue
    }
    if (!current) continue
    if (event.type === 'assistant/message' && data.message && data.message.id) {
      const text = clean(textOf(data.message.content), 'assistant')
      if (text) {
        current.assistant = text
        current.messageId = data.message.id
      }
    } else if (event.type === 'turn/end' && data.turn === current.turn) {
      current.at = event.time || current.at
      if (current.messageId) out.push(current)
      current = null
    }
  }
  return out
}

/** 值得送去提炼的回合：助手给了方向列表，或用户说了以后再做。 */
export function ideaTurns(turns) {
  return (Array.isArray(turns) ? turns : []).filter((turn) => assistantHasIdeas(turn.assistant) || userHasIdeas(turn.user))
}

export default {
  IDEA_TEXT_MAX,
  IDEA_CAPACITY,
  IDEAS_PER_CALL,
  assistantHasIdeas,
  userHasIdeas,
  extractPrompt,
  parseIdeas,
  normalizeIdea,
  addIdeas,
  patchIdea,
  syncGoal,
  ideasFor,
  donePrompt,
  parseDone,
  markMaybeDone,
  turnsOf,
  ideaTurns,
}
