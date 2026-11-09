/**
 * ECHO 现场重建：从会话事件日志里还原收藏那一轮「当时发生了什么」。
 * 纯函数，不碰文件和网络；在线会话传 snapshotEvents()，旧会话传解码后的日志行。
 *
 * 一轮 = turn/start … turn/end。收藏锚点所在的那一轮就是现场：
 * - 触发：这一轮开始前最近的一条用户消息
 * - 工具链：tool/call ↔ tool/result 按 callId 配对，耗时 = 结果时间 − 调用时间（配不到就不填）
 * - 技能：工具 `skill` 的成功调用，参数里的技能名
 * - 模型、步数、token：assistant/message 的 source / usage 累加
 * 只读名字、时间和计数，不读工具参数和结果正文（技能名除外）。
 */

export const SCENE_TOOL_LIMIT = 200
const TEXT_LIMIT = 280

function textOf(content) {
  if (typeof content === 'string') return content
  if (!Array.isArray(content)) return ''
  return content
    .filter((block) => block && block.type === 'text' && typeof block.text === 'string')
    .map((block) => block.text)
    .join('\n')
}

function short(text) {
  const value = String(text || '').replace(/\s+/g, ' ').trim()
  const chars = Array.from(value)
  return chars.length > TEXT_LIMIT ? chars.slice(0, TEXT_LIMIT - 1).join('') + '…' : value
}

export function skillNameOf(args) {
  let value = args
  if (typeof value === 'string') {
    try {
      value = JSON.parse(value)
    } catch {
      return ''
    }
  }
  if (!value || typeof value !== 'object') return ''
  const raw = value.name ?? value.skill ?? value.skillName
  return typeof raw === 'string' ? raw.trim() : ''
}

function messageIdOf(event) {
  if (!event || !event.data) return ''
  if (event.type === 'user/message') return event.data.id || ''
  if (event.type === 'assistant/message') return (event.data.message && event.data.message.id) || ''
  return ''
}

/**
 * events: 事件数组（按日志顺序）
 * anchorMessageId: Echo 的锚点消息 id
 * clean: (text, role) => string —— 去掉系统提醒 / 检查点等噪音（Host 传 cleanEchoText）
 */
export function buildScene(events, anchorMessageId, clean = (text) => text) {
  const list = Array.isArray(events) ? events.filter((event) => event && typeof event.type === 'string') : []
  const anchorAt = list.findIndex((event) => messageIdOf(event) === anchorMessageId)
  if (anchorAt < 0) return null

  // 锚点属于哪一轮：自己带 turn 就用；否则取它之前最近的 turn/start。
  let turn = list[anchorAt].data && typeof list[anchorAt].data.turn === 'number' ? list[anchorAt].data.turn : null
  if (turn === null) {
    for (let i = anchorAt; i >= 0; i -= 1) {
      if (list[i].type === 'turn/start' && list[i].data && typeof list[i].data.turn === 'number') {
        turn = list[i].data.turn
        break
      }
    }
  }
  // 用户消息常在 turn/start 之前：往后找它开启的那一轮。
  if (list[anchorAt].type === 'user/message') {
    for (let i = anchorAt + 1; i < list.length; i += 1) {
      if (list[i].type === 'turn/start' && list[i].data && typeof list[i].data.turn === 'number') {
        turn = list[i].data.turn
        break
      }
      if (list[i].type === 'user/message') break
    }
  }
  if (turn === null) return null

  const startIndex = list.findIndex((event) => event.type === 'turn/start' && event.data && event.data.turn === turn)
  if (startIndex < 0) return null
  let endIndex = list.length - 1
  for (let i = startIndex + 1; i < list.length; i += 1) {
    const event = list[i]
    if (event.type === 'turn/end' && event.data && event.data.turn === turn) {
      endIndex = i
      break
    }
    if (event.type === 'turn/start' && event.data && event.data.turn !== turn) {
      endIndex = i - 1
      break
    }
  }
  const start = list[startIndex]
  const end = list[endIndex]
  const finished = end.type === 'turn/end'

  // 触发：这一轮开始前（或开头）最近的一条有内容的用户消息。
  let ask = ''
  let askAt = 0
  for (let i = startIndex; i >= 0; i -= 1) {
    const event = list[i]
    if (event.type === 'turn/end' && i < startIndex) break
    if (event.type !== 'user/message') continue
    const text = clean(textOf(event.data && event.data.content), 'user')
    if (text) {
      ask = short(text)
      askAt = event.time || 0
      break
    }
  }
  if (!ask) {
    for (let i = startIndex; i <= endIndex; i += 1) {
      if (list[i].type !== 'user/message') continue
      const text = clean(textOf(list[i].data && list[i].data.content), 'user')
      if (text) {
        ask = short(text)
        askAt = list[i].time || 0
        break
      }
    }
  }

  const calls = new Map()
  const tools = []
  const skills = []
  const models = new Map()
  const usage = { inputTokens: 0, outputTokens: 0, cacheReadTokens: 0 }
  let steps = 0
  let answer = ''
  let reasoningEffort = ''
  for (let i = 0; i <= endIndex; i += 1) {
    const event = list[i]
    if (event.type === 'request/header' && event.data && event.data.header && event.data.header.config) {
      const effort = event.data.header.config.reasoningEffort
      if (typeof effort === 'string') reasoningEffort = effort
    }
    if (i < startIndex) continue
    const data = event.data || {}
    if (event.type === 'step/start') steps += 1
    else if (event.type === 'tool/call' && data.callId) {
      const row = { name: String(data.name || ''), at: event.time || 0, ms: 0, ok: null }
      if (row.name === 'skill') row.skill = skillNameOf(data.arguments)
      calls.set(data.callId, row)
      if (tools.length < SCENE_TOOL_LIMIT) tools.push(row)
    } else if (event.type === 'tool/result') {
      const message = data.message || {}
      const callId = message.toolCallId || (message.source && message.source.callId)
      const row = callId && calls.get(callId)
      if (row) {
        row.ok = message.isError !== true
        if (event.time && row.at && event.time >= row.at) row.ms = event.time - row.at
        if (row.skill && row.ok && !skills.includes(row.skill)) skills.push(row.skill)
      }
    } else if (event.type === 'assistant/message' && data.message) {
      const source = data.message.source || {}
      if (source.model) {
        const key = (source.provider ? source.provider + '/' : '') + source.model
        models.set(key, (models.get(key) || 0) + 1)
      }
      if (data.usage) {
        usage.inputTokens += Number(data.usage.inputTokens) || 0
        usage.outputTokens += Number(data.usage.outputTokens) || 0
        usage.cacheReadTokens += Number(data.usage.cacheReadTokens) || 0
      }
      const text = clean(textOf(data.message.content), 'assistant')
      if (text) answer = short(text)
    }
  }

  const byName = new Map()
  for (const row of tools) {
    const key = row.name === 'skill' && row.skill ? 'skill:' + row.skill : row.name
    const agg = byName.get(key) || { name: row.name, skill: row.skill || '', n: 0, ms: 0, errors: 0 }
    agg.n += 1
    agg.ms += row.ms
    if (row.ok === false) agg.errors += 1
    byName.set(key, agg)
  }
  const model = [...models.entries()].sort((a, b) => b[1] - a[1])[0]
  const startedAt = start.time || 0
  const endedAt = finished ? end.time || 0 : 0
  return {
    turn,
    startedAt,
    endedAt,
    durationMs: endedAt && startedAt ? Math.max(0, endedAt - startedAt) : 0,
    endReason: finished && end.data && end.data.reason ? String(end.data.reason.kind || '') : finished ? 'completed' : 'open',
    ask,
    askAt,
    answer,
    model: model ? model[0] : '',
    reasoningEffort,
    steps,
    usage,
    skills,
    tools: tools.map((row) => ({ name: row.name, skill: row.skill || undefined, offsetMs: row.at && startedAt ? Math.max(0, row.at - startedAt) : 0, ms: row.ms, ok: row.ok })),
    toolCount: calls.size,
    toolsTruncated: calls.size > tools.length,
    summary: [...byName.values()].sort((a, b) => b.ms - a.ms || b.n - a.n),
  }
}

/** 日志文本（JSONL）→ 事件数组；坏行跳过。 */
export function parseEventLines(text) {
  const out = []
  for (const line of String(text || '').split(/\r?\n/)) {
    if (!line.trim()) continue
    try {
      const event = JSON.parse(line)
      if (event && typeof event.type === 'string') out.push(event)
    } catch {
      /* 写到一半的行 */
    }
  }
  return out
}

export default { SCENE_TOOL_LIMIT, skillNameOf, buildScene, parseEventLines }
