/**
 * 会话磁盘存活判定：内存 store 里没有 ≠ 会话没了。
 * DSH 把每个会话写在 $DSH_HOME/sessions/<workspace>/<id>/session.v4.jsonl.zstd，
 * 只要这个文件在，就是「还在，只是没打开」。
 */
import { existsSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

export const SESSION_FILE = 'session.v4.jsonl.zstd'

const ZSTD_MAGIC = Buffer.from([0x28, 0xb5, 0x2f, 0xfd])

/**
 * 会话日志是很多个 zstd 帧首尾相接（DSH 每次追加写一帧）。Node 的 zstdDecompress
 * 只解第一帧——以前只读到 `session` 头一行，旧会话的正文全丢。
 * 这里按帧魔数切开逐帧解；魔数也可能碰巧出现在压缩数据里，那一段解不开就并进下一段再试。
 * decompress: (Buffer) => Promise<Buffer> | Buffer
 */
export async function decodeSessionLog(raw, decompress) {
  const buffer = Buffer.isBuffer(raw) ? raw : Buffer.from(raw || [])
  if (buffer.length < 4 || buffer.indexOf(ZSTD_MAGIC) !== 0) return buffer.toString('utf8')
  const starts = []
  for (let at = 0; (at = buffer.indexOf(ZSTD_MAGIC, at)) >= 0; at += 4) starts.push(at)
  const parts = []
  let begin = 0
  for (let i = 1; i <= starts.length; i += 1) {
    const end = i < starts.length ? starts[i] : buffer.length
    try {
      parts.push(Buffer.from(await decompress(buffer.subarray(starts[begin], end))))
      begin = i
    } catch (error) {
      // 最后一段也解不开：前面解出来的照常返回，坏尾巴（写到一半的帧）丢掉。
      if (i === starts.length) break
    }
  }
  return Buffer.concat(parts).toString('utf8')
}

/** id 只能是单段目录名：挡掉 `..`、路径分隔符和空字节，避免探测任意路径。 */
function safeSegment(value) {
  return Boolean(value) && value !== '.' && value !== '..' && !/[\\/\0]/.test(value)
}

/** 根会话是 `session-<uuid>`，子代理会话可能是裸 uuid，两种都试。 */
export function sessionDiskVariants(id) {
  const raw = String(id || '').trim()
  if (!raw || !safeSegment(raw)) return []
  const variants = [raw]
  if (raw.startsWith('session-')) {
    const bare = raw.slice('session-'.length)
    if (safeSegment(bare)) variants.push(bare)
  } else variants.push('session-' + raw)
  return variants
}

function workspaceDirs(root) {
  try {
    return readdirSync(root, { withFileTypes: true }).filter((dir) => dir.isDirectory()).map((dir) => dir.name)
  } catch {
    return []
  }
}

/**
 * 在 session store 里找这个 id 的落盘文件；找不到返回 null。
 * 只读目录结构，不解压、不加载会话。
 */
export function findSessionOnDisk(root, id) {
  const variants = sessionDiskVariants(id)
  if (!variants.length || !root) return null
  for (const workspace of workspaceDirs(root)) {
    for (const variant of variants) {
      const file = join(root, workspace, variant, SESSION_FILE)
      if (existsSync(file)) return file
    }
  }
  return null
}

/**
 * 带 TTL 的判定器：面板每轮快照都会问，别每次都扫目录。
 * 每个 TTL 周期只列一次「工作区 → 会话目录名」索引（O(工作区) 次 readdir），
 * 之后每个 id 只做一次 existsSync，而不是 O(工作区) 次。
 * 否定结论只缓存很短时间：新建的会话不该被当成「已删除」整整一个 TTL。
 */
export function createSessionDiskProbe(root, ttlMs = 30000) {
  const cache = new Map()
  const negativeTtl = Math.min(ttlMs, 5000)
  let index = null
  let indexAt = 0

  let rebuilt = false
  function lookupIndex(now) {
    if (index && now - indexAt < ttlMs) return index
    rebuilt = true
    const next = new Map()
    for (const workspace of workspaceDirs(root)) {
      let ids = []
      try {
        ids = readdirSync(join(root, workspace), { withFileTypes: true })
      } catch {
        continue
      }
      for (const entry of ids) {
        if (!entry.isDirectory()) continue
        const list = next.get(entry.name)
        if (list) list.push(workspace)
        else next.set(entry.name, [workspace])
      }
    }
    index = next
    indexAt = now
    return index
  }

  return function sessionOnDisk(id) {
    const key = String(id || '')
    const variants = sessionDiskVariants(key)
    if (!variants.length || !root) return false
    const now = Date.now()
    const hit = cache.get(key)
    if (hit && now - hit.at < (hit.exists ? ttlMs : negativeTtl)) return hit.exists
    rebuilt = false
    const probe = () => {
      const dirs = lookupIndex(now)
      for (const variant of variants) {
        for (const workspace of dirs.get(variant) || []) {
          if (existsSync(join(root, workspace, variant, SESSION_FILE))) return true
        }
      }
      return false
    }
    let exists = probe()
    // 索引是旧的而这次没命中：会话可能是索引之后才建的，重建一次再下结论。
    if (!exists && !rebuilt) {
      index = null
      exists = probe()
    }
    cache.set(key, { at: now, exists })
    return exists
  }
}
