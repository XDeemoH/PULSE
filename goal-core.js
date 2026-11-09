/**
 * 目标层纯逻辑：不碰存储、不碰 DOM，Host 与测试共用。
 *
 * 目标就是 Echo 存储里的一条 `kind: 'goal'` 记录（共用 echoes.json、写队列、容量上限），
 * 但没有消息窗口。作用域是工作区（会话的 cwd），一个工作区同一时间只有一个 open 目标。
 *
 * 状态：
 * - open   当前目标
 * - done   完成。只有三种写入者：用户点「完成」、DSH 原生目标进入 complete、交接。
 * - stale  被新目标顶替（不等于完成，历史里单独标出）
 *
 * DSH 自己的 /goal 不存这里——它活在会话投影里，客户端直接读。这里只在它 complete 时
 * 记一条 done 历史（source: 'dsh'，按 dshGoalId 去重）。
 */

export const GOAL_TITLE_MAX = 200
export const GOAL_HISTORY_LIMIT = 20
const STATUSES = new Set(['open', 'done', 'stale'])
const SOURCES = new Set(['owner', 'inferred', 'dsh', 'handoff'])

export function isGoal(record) {
  return Boolean(record && record.kind === 'goal')
}

/** 工作区键：Windows 路径不分大小写、斜杠统一、去掉末尾分隔符。 */
export function workspaceKey(cwd) {
  const value = typeof cwd === 'string' ? cwd.trim() : ''
  if (!value) return ''
  let key = value.replace(/\\/g, '/').replace(/\/+$/, '')
  if (/^[A-Za-z]:/.test(key) || key.startsWith('//')) key = key.toLowerCase()
  return key || '/'
}

function cleanTitle(raw) {
  return String(raw == null ? '' : raw).replace(/\s+/g, ' ').trim()
}

function invalid(code) {
  const error = new Error(code)
  error.code = code
  error.status = 400
  throw error
}

export function validTitle(raw) {
  const title = cleanTitle(raw)
  if (!title) invalid('goal_title_empty')
  if ([...title].length > GOAL_TITLE_MAX) invalid('goal_title_too_long')
  return title
}

function goalId(now, salt) {
  return 'goal-' + Number(now).toString(36) + '-' + String(salt || Math.random().toString(36).slice(2, 8)).replace(/[^A-Za-z0-9_-]/g, '').slice(0, 48)
}

export function createGoal(input) {
  const options = input && typeof input === 'object' ? input : {}
  const now = Number.isFinite(options.now) ? options.now : Date.now()
  const sessionId = typeof options.sessionId === 'string' ? options.sessionId : ''
  if (!sessionId) invalid('goal_session_required')
  const workspace = workspaceKey(options.cwd)
  if (!workspace) invalid('goal_workspace_unknown')
  const source = SOURCES.has(options.source) ? options.source : 'owner'
  const status = options.status === 'done' ? 'done' : 'open'
  return {
    id: goalId(now, options.dshGoalId || options.salt),
    kind: 'goal',
    version: 1,
    sessionId,
    workspace,
    cwd: String(options.cwd),
    title: validTitle(options.title),
    status,
    source,
    dshGoalId: typeof options.dshGoalId === 'string' ? options.dshGoalId : undefined,
    createdAt: Number.isFinite(options.createdAt) ? options.createdAt : now,
    updatedAt: now,
    doneAt: status === 'done' ? now : 0,
  }
}

/** 一个工作区的视图：当前 open 目标 + 最近的历史（done / stale，新的在前）。 */
export function goalsFor(records, cwd, limit = GOAL_HISTORY_LIMIT) {
  const workspace = workspaceKey(cwd)
  const empty = { workspace, current: null, history: [], doneCount: 0 }
  if (!workspace) return empty
  const mine = (Array.isArray(records) ? records : []).filter(function (record) {
    return isGoal(record) && record.workspace === workspace
  })
  const open = mine
    .filter(function (record) { return record.status === 'open' })
    .sort(function (a, b) { return (b.createdAt || 0) - (a.createdAt || 0) })
  const past = mine
    .filter(function (record) { return record.status !== 'open' })
    .sort(function (a, b) { return (b.doneAt || b.updatedAt || 0) - (a.doneAt || a.updatedAt || 0) })
  return {
    workspace,
    current: open[0] ? publicGoal(open[0]) : null,
    history: past.slice(0, Math.max(0, limit)).map(publicGoal),
    doneCount: past.filter(function (record) { return record.status === 'done' }).length,
  }
}

export function publicGoal(record) {
  return {
    id: record.id,
    title: record.title,
    status: record.status,
    source: record.source,
    sessionId: record.sessionId,
    createdAt: record.createdAt || 0,
    updatedAt: record.updatedAt || 0,
    doneAt: record.doneAt || 0,
    dsh: record.source === 'dsh',
  }
}

/**
 * 新建一个 open 目标：同工作区里原来的 open 目标变 stale（被顶替，不算完成）。
 * 返回新的记录数组（不改入参）和新目标。
 */
export function openGoal(records, input) {
  const goal = createGoal(Object.assign({}, input, { status: 'open' }))
  const now = goal.updatedAt
  const next = (Array.isArray(records) ? records : []).map(function (record) {
    if (isGoal(record) && record.workspace === goal.workspace && record.status === 'open') {
      return Object.assign({}, record, { status: 'stale', updatedAt: now, doneAt: now })
    }
    return record
  })
  next.push(goal)
  return { records: next, goal }
}

/**
 * DSH 原生目标完成：记一条 done 历史。同一个 dshGoalId 只记一次（返回 goal: null 表示已有）。
 */
export function recordDshGoal(records, input) {
  const options = input && typeof input === 'object' ? input : {}
  const dshGoalId = typeof options.dshGoalId === 'string' ? options.dshGoalId.trim() : ''
  if (!dshGoalId) invalid('goal_dsh_id_required')
  const list = Array.isArray(records) ? records : []
  if (list.some(function (record) { return isGoal(record) && record.dshGoalId === dshGoalId })) {
    return { records: list, goal: null }
  }
  const goal = createGoal(Object.assign({}, options, { status: 'done', source: 'dsh', dshGoalId }))
  return { records: list.concat([goal]), goal }
}

/** 改标题 / 改状态。done ↔ open 都允许（误点完成可以撤回）；reopen 会把别的 open 顶成 stale。 */
export function patchGoal(records, id, patch, now = Date.now()) {
  const list = Array.isArray(records) ? records : []
  const index = list.findIndex(function (record) { return isGoal(record) && record.id === id })
  if (index < 0) {
    const error = new Error('goal_not_found')
    error.code = 'goal_not_found'
    error.status = 404
    throw error
  }
  const input = patch && typeof patch === 'object' ? patch : {}
  const current = list[index]
  const changes = { updatedAt: now }
  if (input.title !== undefined) changes.title = validTitle(input.title)
  if (input.status !== undefined) {
    if (!STATUSES.has(input.status)) invalid('goal_bad_status')
    changes.status = input.status
    changes.doneAt = input.status === 'open' ? 0 : now
  }
  if (input.source === 'owner' && current.source === 'inferred') changes.source = 'owner'
  const updated = Object.assign({}, current, changes)
  const next = list.map(function (record, i) {
    if (i === index) return updated
    if (changes.status === 'open' && isGoal(record) && record.workspace === updated.workspace && record.status === 'open') {
      return Object.assign({}, record, { status: 'stale', updatedAt: now, doneAt: now })
    }
    return record
  })
  return { records: next, goal: updated }
}

/**
 * 专注模式的判定：行在目标开始之后被调用过就算相关。
 * since 为 0（没有目标）时一律相关——没有目标就不该变淡任何东西。
 */
export function relevantSince(state, since) {
  if (!(since > 0)) return true
  return Boolean(state && Number(state.at) >= since)
}

/* ── 用模型推断目标：只产出提议，写入仍要用户点「设为目标」 ─────────── */

export const INFER_CONTEXT_CHARS = 3000
export const INFER_TITLE_MAX = 60
/** 同一会话两次推断之间至少隔几轮（没目标时也不每轮都花钱）。 */
export const INFER_EVERY_ROUNDS = 3

/** floors: [{ role, text }]（自然语言楼层，旧→新）。从最新往回取，直到字数上限。 */
export function inferPrompt(floors) {
  const picked = []
  let used = 0
  const list = Array.isArray(floors) ? floors : []
  for (let i = list.length - 1; i >= 0; i -= 1) {
    const floor = list[i]
    if (!floor || (floor.role !== 'user' && floor.role !== 'assistant')) continue
    let text = String(floor.text || '').replace(/\s+/g, ' ').trim()
    if (!text) continue
    const room = INFER_CONTEXT_CHARS - used
    if (room <= 40) break
    if (text.length > Math.min(room, 800)) text = text.slice(0, Math.min(room, 800)) + '…'
    picked.unshift((floor.role === 'user' ? '用户：' : '助手：') + text)
    used += text.length
  }
  if (!picked.length) return ''
  return [
    '下面是一段 AI 编程助手会话的最近几轮。用一句简体中文概括「用户在这个会话里要完成的目标」。',
    '要求：动宾结构，具体到能判断是否完成，不超过 30 个字，不加引号、不加句号、不解释。',
    '例：给 PULSE 面板加目标条和专注模式；修复 Echo 收藏后详情一直加载中。',
    '如果看不出一个明确的目标（闲聊、只问了一个问题），只输出 NONE。',
    '',
    picked.join('\n'),
  ].join('\n')
}

/** 模型回答 → 目标文本；看不出目标或格式不对返回空串。 */
export function parseInferred(text) {
  const line = String(text || '')
    .split(/\r?\n/)
    .map((row) => row.trim())
    .find((row) => row && !/^```/.test(row))
  if (!line || /^none\b/i.test(line) || /^(无|没有明确)/.test(line)) return ''
  const value = line
    .replace(/^(目标|goal)\s*[:：]\s*/i, '')
    .replace(/[。.！!]+$/, '')
    .replace(/^["'“”‘’「『]+|["'“”‘’」』]+$/g, '')
    .replace(/[。.！!]+$/, '')
    .trim()
  if (!value) return ''
  const chars = Array.from(value)
  return chars.length > INFER_TITLE_MAX ? chars.slice(0, INFER_TITLE_MAX).join('') : value
}

export default {
  INFER_CONTEXT_CHARS,
  INFER_TITLE_MAX,
  INFER_EVERY_ROUNDS,
  inferPrompt,
  parseInferred,
  GOAL_TITLE_MAX,
  GOAL_HISTORY_LIMIT,
  isGoal,
  workspaceKey,
  validTitle,
  createGoal,
  goalsFor,
  publicGoal,
  openGoal,
  recordDshGoal,
  patchGoal,
  relevantSince,
}
