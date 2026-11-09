import test from 'node:test'
import assert from 'node:assert/strict'
import {
  ECHO_DEFAULTS,
  visibleFloors,
  selectWindow,
  mergeTarget,
  unionRanges,
  dedupeMessages,
  mergeCapture,
  createEcho,
  advanceEcho,
  qaFor,
} from '../echo-core.js'

function floors(count, start = 0) {
  const roles = ['user', 'assistant']
  return Array.from({ length: count }, (_, i) => ({
    id: 'm' + (start + i),
    role: roles[i % 2],
    text: 'message ' + (start + i),
    at: 1000 + start + i,
    turn: Math.floor((start + i) / 2) + 1,
  }))
}

test('visibleFloors counts only user and assistant messages', () => {
  const messages = [
    { id: 'sys', role: 'system', text: 'system' },
    { id: 'u1', role: 'user', text: 'u1' },
    { id: 't1', role: 'tool', text: 'tool' },
    { id: 'a1', role: 'assistant', text: 'a1' },
    { id: 'd1', role: 'developer', text: 'dev' },
  ]
  assert.deepEqual(
    visibleFloors(messages).map((m) => m.id),
    ['u1', 'a1'],
  )
})

test('selectWindow takes 10 before and 5 after around the anchor', () => {
  const list = floors(40)
  const window = selectWindow(list, 'm20')
  assert.equal(window.anchorIndex, 20)
  assert.equal(window.startIndex, 10)
  assert.equal(window.endIndex, 25)
  assert.equal(window.messages.length, 16)
  assert.equal(window.pendingAfter, 0)
  assert.equal(window.messages[0].id, 'm10')
  assert.equal(window.messages.at(-1).id, 'm25')
})

test('selectWindow clamps at the start and records pending future floors', () => {
  const list = floors(12)
  const window = selectWindow(list, 'm10')
  assert.equal(window.startIndex, 0)
  assert.equal(window.endIndex, 11)
  assert.equal(window.pendingAfter, 4)
  assert.equal(window.messages[0].id, 'm0')
})

test('selectWindow returns null for a missing anchor', () => {
  assert.equal(selectWindow(floors(5), 'missing'), null)
})

test('mergeTarget matches overlap or a close gap in the same session only', () => {
  const echoes = [
    { id: 'a', sessionId: 's1', ranges: [{ startIndex: 10, endIndex: 20 }] },
    { id: 'b', sessionId: 's2', ranges: [{ startIndex: 10, endIndex: 20 }] },
  ]
  assert.equal(mergeTarget(echoes, 's1', { startIndex: 21, endIndex: 30 }, 5)?.id, 'a')
  assert.equal(mergeTarget(echoes, 's1', { startIndex: 26, endIndex: 30 }, 5), null)
  assert.equal(mergeTarget(echoes, 's2', { startIndex: 20, endIndex: 25 }, 5)?.id, 'b')
})

test('unionRanges merges overlapping and adjacent ranges', () => {
  assert.deepEqual(
    unionRanges([
      { startIndex: 10, endIndex: 20 },
      { startIndex: 18, endIndex: 25 },
      { startIndex: 30, endIndex: 35 },
    ]),
    [
      { startIndex: 10, endIndex: 25 },
      { startIndex: 30, endIndex: 35 },
    ],
  )
})

test('dedupeMessages keeps the first instance and input order', () => {
  const list = [
    { id: 'a', text: 'first' },
    { id: 'b', text: 'b' },
    { id: 'a', text: 'second' },
  ]
  assert.deepEqual(dedupeMessages(list).map((m) => m.text), ['first', 'b'])
})

test('createEcho carries the window, anchor and defaults', () => {
  const list = floors(30)
  const echo = createEcho({
    sessionId: 's1',
    messages: list,
    anchorId: 'm12',
    now: 123456,
  })
  assert.ok(echo.id.startsWith('echo-'))
  assert.equal(echo.sessionId, 's1')
  assert.equal(echo.anchors.length, 1)
  assert.equal(echo.anchors[0].messageId, 'm12')
  assert.equal(echo.messages.length, 16)
  assert.equal(echo.pending, false)
  assert.equal(echo.createdAt, 123456)
  assert.equal(echo.updatedAt, 123456)
  assert.equal(echo.title, 'message 2')
})

test('mergeCapture unions ranges, dedupes messages and adds the anchor', () => {
  const list = floors(30)
  const echo = createEcho({ sessionId: 's1', messages: list, anchorId: 'm12', now: 1 })
  const capture = selectWindow(visibleFloors(list), 'm18')
  const merged = mergeCapture(echo, capture, 5, 2)
  assert.equal(merged.anchors.length, 2)
  assert.deepEqual(
    merged.ranges.map((r) => [r.startIndex, r.endIndex]),
    [[2, 23]],
  )
  assert.equal(merged.messages.length, 22)
  assert.equal(merged.updatedAt, 2)
  assert.equal(new Set(merged.messages.map((m) => m.id)).size, merged.messages.length)
})

test('advanceEcho fills the pending after-window when more floors arrive', () => {
  const list = floors(12)
  const echo = createEcho({ sessionId: 's1', messages: list, anchorId: 'm10', now: 1 })
  assert.equal(echo.pending, true)
  assert.equal(echo.pendingAfter, 4)
  const advanced = advanceEcho(echo, floors(20), 2)
  assert.equal(advanced.pending, false)
  assert.equal(advanced.pendingAfter, 0)
  assert.deepEqual(advanced.ranges.map((r) => [r.startIndex, r.endIndex]), [[0, 15]])
  assert.equal(advanced.messages.length, 16)
  assert.equal(advanced.updatedAt, 2)
})

test('qaFor puts the clicked assistant answer after its user question', () => {
  const list = floors(20)
  const echo = createEcho({ sessionId: 's1', messages: list, anchorId: 'm11', now: 1 })
  const qa = qaFor(echo)
  assert.equal(qa.questionId, 'm10')
  assert.equal(qa.answerId, 'm11')
  assert.equal(qa.questionText, 'message 10')
  assert.equal(qa.answerText, 'message 11')
})

test('ECHO_DEFAULTS fixes the 10/5 window and merge gap', () => {
  assert.equal(ECHO_DEFAULTS.before, 10)
  assert.equal(ECHO_DEFAULTS.after, 5)
  assert.equal(ECHO_DEFAULTS.mergeGap, 5)
})
