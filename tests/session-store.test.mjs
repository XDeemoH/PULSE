import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { SESSION_FILE, createSessionDiskProbe, findSessionOnDisk, sessionDiskVariants } from '../session-store.js'

function store() {
  const root = mkdtempSync(join(tmpdir(), 'pulse-sessions-'))
  const write = (workspace, id) => {
    const dir = join(root, workspace, id)
    mkdirSync(dir, { recursive: true })
    writeFileSync(join(dir, SESSION_FILE), '')
  }
  return { root, write, clean: () => rmSync(root, { recursive: true, force: true }) }
}

test('sessionDiskVariants 同时试带前缀和裸 id', () => {
  assert.deepEqual(sessionDiskVariants('abc'), ['abc', 'session-abc'])
  assert.deepEqual(sessionDiskVariants('session-abc'), ['session-abc', 'abc'])
  assert.deepEqual(sessionDiskVariants(''), [])
})

test('findSessionOnDisk 跨工作区目录找落盘会话', () => {
  const s = store()
  try {
    s.write('--workspace-a--', 'session-1111')
    s.write('--workspace-b--', '2222')
    assert.ok(findSessionOnDisk(s.root, 'session-1111'))
    assert.ok(findSessionOnDisk(s.root, '1111'), '裸 id 也能命中带前缀目录')
    assert.ok(findSessionOnDisk(s.root, '2222'))
    assert.ok(findSessionOnDisk(s.root, 'session-2222'), '带前缀 id 也能命中裸目录')
    assert.equal(findSessionOnDisk(s.root, 'missing'), null)
    assert.equal(findSessionOnDisk(join(s.root, 'nope'), '2222'), null)
  } finally {
    s.clean()
  }
})

test('createSessionDiskProbe 在 TTL 内复用结果，过期后重查', () => {
  const s = store()
  try {
    s.write('--w--', 'session-abc')
    const probe = createSessionDiskProbe(s.root, 0)
    assert.equal(probe('session-abc'), true)
    rmSync(join(s.root, '--w--'), { recursive: true, force: true })
    assert.equal(probe('session-abc'), false, 'ttl=0 立刻重查')
    const cached = createSessionDiskProbe(s.root, 60000)
    s.write('--w--', 'session-xyz')
    assert.equal(cached('session-xyz'), true)
    rmSync(join(s.root, '--w--'), { recursive: true, force: true })
    assert.equal(cached('session-xyz'), true, 'TTL 内保留旧结论')
  } finally {
    s.clean()
  }
})
