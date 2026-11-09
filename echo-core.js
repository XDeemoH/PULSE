/**
 * Echo 纯逻辑层：不碰 DOM、不碰存储，Host/Client 共用。
 *
 * 约定：
 * - 楼 = role 为 user / assistant 的消息；tool/system/developer 不单独计数。
 * - 窗口 = 锚点前 10 楼 + 锚点 + 锚点后 5 楼。
 * - 同 session 内，窗口重叠或间隔 <= mergeGap 楼则视为同一个 Echo。
 */

export const ECHO_DEFAULTS = Object.freeze({
  before: 10,
  after: 5,
  mergeGap: 5,
})

const FLOOR_ROLES = new Set(['user', 'assistant'])

export function visibleFloors(messages) {
  return (Array.isArray(messages) ? messages : []).filter(function (message) {
    return message && FLOOR_ROLES.has(message.role)
  })
}

function rangeOf(startIndex, endIndex, list) {
  return {
    startIndex,
    endIndex,
    startMessageId: list[startIndex] ? list[startIndex].id : undefined,
    endMessageId: list[endIndex] ? list[endIndex].id : undefined,
  }
}

export function selectWindow(floors, anchorId, before = ECHO_DEFAULTS.before, after = ECHO_DEFAULTS.after) {
  const list = Array.isArray(floors) ? floors : []
  const anchorIndex = list.findIndex(function (message) {
    return message && message.id === anchorId
  })
  if (anchorIndex < 0) return null
  const safeBefore = Math.max(0, Math.floor(Number(before) || 0))
  const safeAfter = Math.max(0, Math.floor(Number(after) || 0))
  const startIndex = Math.max(0, anchorIndex - safeBefore)
  const endIndex = Math.min(list.length - 1, anchorIndex + safeAfter)
  const pendingAfter = Math.max(0, anchorIndex + safeAfter - (list.length - 1))
  return {
    anchorIndex,
    startIndex,
    endIndex,
    pendingAfter,
    anchor: list[anchorIndex],
    messages: list.slice(startIndex, endIndex + 1).map(function (message, offset) {
      return Object.assign({}, message, { index: startIndex + offset })
    }),
    range: rangeOf(startIndex, endIndex, list),
  }
}

function rangeDistance(a, b) {
  if (a.startIndex <= b.endIndex && b.startIndex <= a.endIndex) return 0
  if (b.startIndex > a.endIndex) return b.startIndex - a.endIndex
  return a.startIndex - b.endIndex
}

export function mergeTarget(echoes, sessionId, range, mergeGap = ECHO_DEFAULTS.mergeGap) {
  const list = Array.isArray(echoes) ? echoes : []
  const gap = Math.max(0, Math.floor(Number(mergeGap) || 0))
  let best = null
  let bestDistance = Infinity
  for (const echo of list) {
    if (!echo || echo.sessionId !== sessionId) continue
    const ranges = Array.isArray(echo.ranges) ? echo.ranges : []
    for (const existing of ranges) {
      const distance = rangeDistance(existing, range)
      if (distance > gap) continue
      if (distance < bestDistance || (distance === bestDistance && best && echo.createdAt < best.createdAt)) {
        best = echo
        bestDistance = distance
      }
    }
  }
  return best
}

export function unionRanges(ranges) {
  const sorted = (Array.isArray(ranges) ? ranges : [])
    .filter(function (range) {
      return range && Number.isFinite(range.startIndex) && Number.isFinite(range.endIndex)
    })
    .map(function (range) {
      return {
        startIndex: Math.min(range.startIndex, range.endIndex),
        endIndex: Math.max(range.startIndex, range.endIndex),
      }
    })
    .sort(function (a, b) {
      return a.startIndex - b.startIndex || a.endIndex - b.endIndex
    })
  const out = []
  for (const range of sorted) {
    const last = out[out.length - 1]
    if (last && range.startIndex <= last.endIndex + 1) {
      last.endIndex = Math.max(last.endIndex, range.endIndex)
    } else {
      out.push({ startIndex: range.startIndex, endIndex: range.endIndex })
    }
  }
  return out
}

export function dedupeMessages(messages) {
  const seen = new Set()
  const out = []
  for (const message of Array.isArray(messages) ? messages : []) {
    if (!message || !message.id || seen.has(message.id)) continue
    seen.add(message.id)
    out.push(message)
  }
  return out
}

function titleOf(messages) {
  const first = messages.find(function (message) {
    return message.role === 'user' && typeof message.text === 'string'
  })
  if (!first) return ''
  return first.text.replace(/\s+/g, ' ').trim().slice(0, 60)
}

function echoId(now, anchor) {
  const stamp = Number(now || Date.now()).toString(36)
  return 'echo-' + stamp + '-' + String(anchor && anchor.id ? anchor.id : '0').replace(/[^A-Za-z0-9_-]/g, '').slice(0, 64)
}

export function createEcho(options) {
  const input = options && typeof options === 'object' ? options : {}
  const floors = visibleFloors(input.messages)
  const window = selectWindow(floors, input.anchorId, input.before, input.after)
  if (!window) return null
  const now = Number.isFinite(input.now) ? input.now : Date.now()
  const anchor = window.anchor
  return {
    id: echoId(now, anchor),
    version: 1,
    sessionId: input.sessionId,
    createdAt: now,
    updatedAt: now,
    title: titleOf(window.messages),
    note: '',
    tags: [],
    anchors: [
      {
        messageId: anchor.id,
        index: window.anchorIndex,
        turn: anchor.turn,
        at: anchor.at,
      },
    ],
    ranges: [window.range],
    messages: window.messages,
    pending: window.pendingAfter > 0,
    pendingAfter: window.pendingAfter,
    meta: input.meta || {},
  }
}

export function mergeCapture(echo, capture, mergeGap = ECHO_DEFAULTS.mergeGap, now = Date.now()) {
  if (!echo || !capture) return echo
  // Host 现在按会话收敛成一条 Echo；是否合并由调用方决定，这里只负责并集。
  const anchors = Array.isArray(echo.anchors) ? echo.anchors.slice() : []
  if (!anchors.some(function (anchor) { return anchor.messageId === capture.anchor.id })) {
    anchors.push({
      messageId: capture.anchor.id,
      index: capture.anchorIndex,
      turn: capture.anchor.turn,
      at: capture.anchor.at,
    })
  }
  const mergedRanges = unionRanges(
    (Array.isArray(echo.ranges) ? echo.ranges : []).concat([capture.range]),
  )
  const list = (Array.isArray(echo.messages) ? echo.messages : []).concat(capture.messages)
  const mergedMessages = dedupeMessages(list).sort(function (a, b) {
    const ai = typeof a.index === 'number' ? a.index : Number.MAX_SAFE_INTEGER
    const bi = typeof b.index === 'number' ? b.index : Number.MAX_SAFE_INTEGER
    return ai - bi
  })
  const pendingAfter = Math.max(
    0,
    capture.pendingAfter,
    Number(echo.pendingAfter) || 0,
  )
  return Object.assign({}, echo, {
    anchors,
    ranges: mergedRanges,
    messages: mergedMessages,
    pending: pendingAfter > 0,
    pendingAfter,
    updatedAt: now,
  })
}

export function advanceEcho(echo, floors, now = Date.now(), mergeGap = ECHO_DEFAULTS.mergeGap) {
  if (!echo || !Array.isArray(floors)) return echo
  let next = echo
  let pendingAfter = 0
  let touched = false
  for (const anchor of Array.isArray(echo.anchors) ? echo.anchors : []) {
    const capture = selectWindow(floors, anchor.messageId, ECHO_DEFAULTS.before, ECHO_DEFAULTS.after)
    if (!capture) continue
    next = mergeCapture(next, capture, mergeGap, now)
    pendingAfter = Math.max(pendingAfter, capture.pendingAfter)
    touched = true
  }
  if (!touched) return echo
  return Object.assign({}, next, {
    pending: pendingAfter > 0,
    pendingAfter,
  })
}

export function qaFor(echo, limits = {}) {
  const messages = Array.isArray(echo && echo.messages) ? echo.messages : []
  const anchors = Array.isArray(echo && echo.anchors) ? echo.anchors : []
  const anchorId = anchors[0] && anchors[0].messageId
  let anchorIndex = messages.findIndex(function (message) {
    return message && message.id === anchorId
  })
  if (anchorIndex < 0) anchorIndex = messages.length - 1
  let question = null
  let answer = null
  for (let i = anchorIndex; i >= 0; i -= 1) {
    if (messages[i] && messages[i].role === 'user') {
      question = messages[i]
      break
    }
  }
  if (anchorIndex >= 0 && messages[anchorIndex] && messages[anchorIndex].role === 'assistant') {
    answer = messages[anchorIndex]
  } else {
    for (let i = anchorIndex + 1; i < messages.length; i += 1) {
      if (messages[i] && messages[i].role === 'assistant') {
        answer = messages[i]
        break
      }
    }
  }
  if (!question) {
    question = messages.find(function (message) {
      return message && message.role === 'user'
    })
  }
  if (!answer) {
    answer = messages.find(function (message) {
      return message && message.role === 'assistant'
    })
  }
  const qLimit = Number(limits.question) > 0 ? Number(limits.question) : 600
  const aLimit = Number(limits.answer) > 0 ? Number(limits.answer) : 1200
  return {
    questionId: question ? question.id : undefined,
    answerId: answer ? answer.id : undefined,
    questionText: question ? String(question.text || '').slice(0, qLimit) : '',
    answerText: answer ? String(answer.text || '').slice(0, aLimit) : '',
  }
}

export default {
  ECHO_DEFAULTS,
  visibleFloors,
  selectWindow,
  mergeTarget,
  unionRanges,
  dedupeMessages,
  createEcho,
  mergeCapture,
  advanceEcho,
  qaFor,
}
