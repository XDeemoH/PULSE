/**
 * 自动提议收藏：从会话事件里挑出「可能值得收藏」的回合，只提议、不写入。
 * 纯函数；不调模型，每条提议都带看得懂的理由。
 *
 * 一个已结束的回合按信号打分，≥ SUGGEST_THRESHOLD 才提议：
 * - praised  +3  下一条用户消息明显肯定（完美 / 不错 / 搞定 / nice …）
 * - approved +1  下一条用户消息是轻度认可（可以 / 好的 / 谢谢 / 继续 / 打包 …）
 * - pushback −3  下一条用户消息在纠错（不对 / 还是不行 / 报错 …）——有这个就不提
 * - delivered +2 这一轮交付了文件（deliverables/presented）
 * - recovered +1 中途有工具失败，最后正常结束
 * - big       +1 大回合：≥ 20 次工具调用或 ≥ 3 分钟
 * 锚点 = 这一轮最后一条有自然语言的 assistant 消息（和手动收藏的按钮落点一致）。
 */

export const SUGGEST_THRESHOLD = 3
export const SUGGEST_LIMIT = 3

const STRONG = /(完美|太棒|漂亮|厉害|不错|很好|真好|搞定|成功了|没问题了|正是我要的|就是这样|perfect|awesome|great|excellent|nice|love it|works now|exactly)/i
const MILD = /(^|[\s，,。.!！])(可以|好的|好了|行了|ok|okay|谢谢|thanks|thank you|继续|下一步|打包|提交|commit|ship it|lgtm)/i
const PUSHBACK = /(不对|错了|不行|没用|不是这样|还是不|又坏|有问题|报错|失败了|bug|wrong|broken|doesn'?t work|not working|still)/i

function textOf(content) {
  if (typeof content === 'string') return content
  if (!Array.isArray(content)) return ''
  return content
    .filter((block) => block && block.type === 'text' && typeof block.text === 'string')
    .map((block) => block.text)
    .join('\n')
}

function short(text, limit = 120) {
  const value = String(text || '').replace(/\s+/g, ' ').trim()
  const chars = Array.from(value)
  return chars.length > limit ? chars.slice(0, limit - 1).join('') + '…' : value
}

/** 用户反馈的分类：pushback 优先（「不错，但还是不行」算纠错）。 */
export function feedbackOf(text) {
  const value = String(text || '').trim()
  if (!value) return ''
  if (PUSHBACK.test(value)) return 'pushback'
  if (STRONG.test(value)) return 'praised'
  // 轻度认可只看短消息：长消息里出现「可以」多半是在提新需求。
  if (Array.from(value).length <= 40 && MILD.test(value)) return 'approved'
  return ''
}

/**
 * events: 会话事件（按日志顺序）
 * options.clean(text, role): 去噪（Host 传 cleanEchoText）
 * options.saved: 已收藏的锚点 messageId 集合
 * options.dismissed: 用户忽略过的 messageId 集合
 */
export function suggestEchoes(events, options = {}) {
  const clean = typeof options.clean === 'function' ? options.clean : (text) => text
  const saved = options.saved instanceof Set ? options.saved : new Set(options.saved || [])
  const dismissed = options.dismissed instanceof Set ? options.dismissed : new Set(options.dismissed || [])
  const limit = Number.isFinite(options.limit) ? options.limit : SUGGEST_LIMIT
  const list = Array.isArray(events) ? events.filter((event) => event && typeof event.type === 'string') : []

  // DSH 把开启第 N 轮的用户消息记在 turn/start 之后（老日志可能在之前，两种都认）。
  // 所以上一轮的反馈 = 它结束后第一条有内容的用户消息，不管落在哪一轮里。
  const turns = []
  let current = null
  let lastUser = ''
  let awaiting = null
  for (const event of list) {
    const data = event.data || {}
    if (event.type === 'user/message') {
      const text = clean(textOf(data.content), 'user')
      if (!text) continue
      if (awaiting) {
        awaiting.feedback = text
        awaiting = null
      }
      if (current && !current.askSet && !current.anchor) {
        current.ask = text
        current.askSet = true
      }
      lastUser = text
      continue
    }
    if (event.type === 'turn/start' && typeof data.turn === 'number') {
      current = { turn: data.turn, startedAt: event.time || 0, endedAt: 0, ended: false, completed: false, ask: lastUser, askSet: false, anchor: '', answer: '', tools: 0, errors: 0, delivered: false, feedback: null }
      turns.push(current)
      continue
    }
    if (!current) continue
    if (event.type === 'tool/call') current.tools += 1
    else if (event.type === 'tool/result' && data.message && data.message.isError === true) current.errors += 1
    else if (event.type === 'deliverables/presented') current.delivered = true
    else if (event.type === 'assistant/message' && data.message && data.message.id) {
      const text = clean(textOf(data.message.content), 'assistant')
      if (text) {
        current.anchor = data.message.id
        current.answer = text
      }
    } else if (event.type === 'turn/end' && data.turn === current.turn) {
      current.ended = true
      current.endedAt = event.time || 0
      current.completed = !data.reason || data.reason.kind === 'completed'
      awaiting = current
      current = null
    }
  }

  const out = []
  for (const turn of turns) {
    if (!turn.ended || !turn.completed || !turn.anchor) continue
    if (saved.has(turn.anchor) || dismissed.has(turn.anchor)) continue
    const reasons = []
    let score = 0
    const feedback = feedbackOf(turn.feedback)
    if (feedback === 'pushback') continue
    if (feedback === 'praised') { score += 3; reasons.push('praised') }
    if (feedback === 'approved') { score += 1; reasons.push('approved') }
    if (turn.delivered) { score += 2; reasons.push('delivered') }
    if (turn.errors > 0) { score += 1; reasons.push('recovered') }
    const durationMs = turn.endedAt && turn.startedAt ? turn.endedAt - turn.startedAt : 0
    if (turn.tools >= 20 || durationMs >= 180000) { score += 1; reasons.push('big') }
    if (score < SUGGEST_THRESHOLD) continue
    out.push({
      messageId: turn.anchor,
      turn: turn.turn,
      score,
      reasons,
      ask: short(turn.ask),
      answer: short(turn.answer),
      feedback: feedback ? short(turn.feedback, 60) : '',
      at: turn.endedAt,
      tools: turn.tools,
      durationMs,
    })
  }
  // 分高的在前，同分新的在前。
  return out.sort((a, b) => b.score - a.score || b.at - a.at).slice(0, Math.max(0, limit))
}

export default { SUGGEST_THRESHOLD, SUGGEST_LIMIT, feedbackOf, suggestEchoes }
