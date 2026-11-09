/**
 * 技能「安装包」识别：这一批技能是哪次、从哪装进来的。
 *
 * 用户装技能通常是成批的（一个仓库、一个插件、一次 `npx skills add`），
 * 面板按这一批来分组，组名就是用户记得住的「作者/仓库」。
 *
 * 证据按可信度排序，前面的命中就不再往下看：
 *   1. ~/.agents/.skill-lock.json 里的 source（skills CLI 的安装记录）
 *   2. 目录里 .git/config 的 origin
 *   3. .claude-plugin/plugin.json 的 repository / homepage / author+name
 *   4. package.json 的 repository
 *   5. 安装器留下的标记文件（例如 `.mattpocock`），按标记名归组
 *   6. 都没有：同一时间窗（2 分钟）里一起出现的目录算一批
 * 第 6 类会先尝试并进同批里已知归属（catalog 登记）的多数派，再退回「某时某分安装」。
 *
 * 只读文件系统，不执行 git、不联网。
 */
import { readdir, readFile, stat } from 'node:fs/promises'
import { join } from 'node:path'

/** 目录里常见、但不代表「安装来源」的点文件。 */
const IGNORED_DOTFILES = new Set([
  '.git', '.github', '.gitignore', '.gitattributes', '.gitmodules', '.claude-plugin', '.DS_Store',
  '.npmignore', '.editorconfig', '.vscode', '.idea', '.prettierrc', '.prettierignore', '.eslintrc',
  '.eslintrc.json', '.nvmrc', '.env', '.env.example', '.third-party-licenses', '.cursor', '.husky',
])

export const BATCH_WINDOW_MS = 2 * 60 * 1000

/** 只认 SKILL.md 顶部 `---` 里那一小段。 */
export function frontmatterName(text) {
  const match = String(text || '').match(/^---\r?\n([\s\S]*?)\r?\n---/)
  if (!match) return ''
  const line = match[1].split(/\r?\n/).find((row) => /^name:\s*/.test(row))
  if (!line) return ''
  return line.replace(/^name:\s*/, '').trim().replace(/^["']|["']$/g, '')
}

/** 各种仓库地址 → { author, repo, url }；认不出返回 null。 */
export function parseRepoUrl(value) {
  const raw = String((value && (value.url || value)) || '').trim()
  if (!raw) return null
  const match =
    raw.match(/^(?:git\+)?https?:\/\/(?:www\.)?([^/]+)\/([^/\s]+)\/([^/\s#?]+?)(?:\.git)?(?:[/#?].*)?$/i) ||
    raw.match(/^git@([^:]+):([^/\s]+)\/([^/\s]+?)(?:\.git)?$/i) ||
    raw.match(/^(github):([^/\s]+)\/([^/\s]+?)(?:\.git)?$/i)
  if (match) {
    const host = match[1].toLowerCase() === 'github' ? 'github.com' : match[1].toLowerCase()
    return { author: match[2], repo: match[3], url: 'https://' + host + '/' + match[2] + '/' + match[3] }
  }
  // skills CLI 的 source 简写：owner/repo
  const short = raw.match(/^([A-Za-z0-9_.-]+)\/([A-Za-z0-9_.-]+)$/)
  if (short) return { author: short[1], repo: short[2], url: 'https://github.com/' + short[1] + '/' + short[2] }
  return null
}

async function readJson(path) {
  try {
    return JSON.parse(await readFile(path, 'utf8'))
  } catch {
    return null
  }
}

async function readText(path, limit = 64 * 1024) {
  try {
    const text = await readFile(path, 'utf8')
    return text.length > limit ? text.slice(0, limit) : text
  } catch {
    return ''
  }
}

function repoEvidence(kind, repo, extra = {}) {
  return {
    kind,
    id: 'repo:' + (repo.author + '/' + repo.repo).toLowerCase(),
    label: repo.author + '/' + repo.repo,
    author: repo.author,
    repo: repo.repo,
    url: repo.url,
    ...extra,
  }
}

/** 一个技能目录的安装证据（不含时间窗归组）。 */
export async function skillEvidence(dir, dirName, lock, markerSources = {}) {
  const locked = lock && lock.skills && lock.skills[dirName]
  if (locked) {
    const repo = parseRepoUrl(locked.sourceUrl || locked.source)
    if (repo) return repoEvidence('lock', repo, { installedAt: Date.parse(locked.installedAt) || 0 })
  }
  const gitConfig = await readText(join(dir, '.git', 'config'))
  const origin = gitConfig.match(/\[remote "origin"\][^[]*?url\s*=\s*(.+)/)
  if (origin) {
    const repo = parseRepoUrl(origin[1].trim())
    if (repo) return repoEvidence('git', repo)
  }
  const plugin = await readJson(join(dir, '.claude-plugin', 'plugin.json'))
  if (plugin && typeof plugin === 'object') {
    const repo = parseRepoUrl(plugin.repository) || parseRepoUrl(plugin.homepage)
    const description = typeof plugin.description === 'string' ? plugin.description : ''
    if (repo) return repoEvidence('plugin', repo, { description })
    const author = plugin.author && (plugin.author.name || plugin.author)
    if (typeof plugin.name === 'string' && plugin.name) {
      const label = (typeof author === 'string' && author ? author + '/' : '') + plugin.name
      return { kind: 'plugin', id: 'plugin:' + label.toLowerCase(), label, author: typeof author === 'string' ? author : '', repo: plugin.name, url: '', description }
    }
  }
  const pkg = await readJson(join(dir, 'package.json'))
  if (pkg && pkg.repository) {
    const repo = parseRepoUrl(pkg.repository)
    if (repo) return repoEvidence('package', repo, { description: typeof pkg.description === 'string' ? pkg.description : '' })
  }
  let entries = []
  try {
    entries = await readdir(dir, { withFileTypes: true })
  } catch {
    entries = []
  }
  for (const entry of entries) {
    if (!entry.isFile() || !entry.name.startsWith('.') || IGNORED_DOTFILES.has(entry.name)) continue
    const marker = entry.name.slice(1)
    if (!/^[A-Za-z0-9][A-Za-z0-9_-]{1,39}$/.test(marker)) continue
    const topic = (await readText(join(dir, entry.name), 200)).trim().split(/\r?\n/)[0].slice(0, 40)
    const known = parseRepoUrl(markerSources[marker.toLowerCase()])
    if (known) return repoEvidence('marker', known, { topic })
    return { kind: 'marker', id: 'marker:' + marker.toLowerCase(), label: marker, author: marker, repo: '', url: '', topic }
  }
  return null
}

/**
 * 扫描若干技能根目录，返回每个技能目录的原始信息。
 * roots: [{ root, state: 'live' | 'cold' }]
 */
export async function scanSkillDirs(roots, lockFile, markerSources = {}) {
  const lock = lockFile ? await readJson(lockFile) : null
  const rows = []
  for (const { root, state } of roots) {
    let entries = []
    try {
      entries = await readdir(root, { withFileTypes: true })
    } catch {
      continue
    }
    for (const entry of entries) {
      if (!entry.isDirectory() || entry.name.startsWith('.')) continue
      const dir = join(root, entry.name)
      const skillText = await readText(join(dir, 'SKILL.md'), 8 * 1024)
      if (!skillText) continue
      let created = 0
      try {
        const info = await stat(dir)
        // 安装时刻：创建时间与目录修改时间取较早者（有的文件系统没有可靠的 birthtime）。
        const times = [info.birthtimeMs, info.mtimeMs].map(Number).filter((value) => value > 0)
        created = times.length ? Math.min(...times) : 0
      } catch {
        created = 0
      }
      rows.push({
        dirName: entry.name,
        name: frontmatterName(skillText) || entry.name,
        state,
        createdAt: Math.round(created),
        evidence: await skillEvidence(dir, entry.name, lock, markerSources),
      })
    }
  }
  return rows
}

/**
 * 把扫描结果归成「安装包」。纯函数，便于测试。
 * options.knownLib(name) → catalog 里登记的库 id（没有就返回空串）。
 * 返回 { packs: { [id]: Pack }, packOf: { [skillName]: id } }
 */
export function groupSkillPacks(rows, options = {}) {
  const knownLib = typeof options.knownLib === 'function' ? options.knownLib : () => ''
  const libForUrl = typeof options.libForUrl === 'function' ? options.libForUrl : () => ''
  const window = Number(options.windowMs) > 0 ? options.windowMs : BATCH_WINDOW_MS
  const packs = {}
  const packOf = {}
  const add = (id, base, row) => {
    if (!packs[id]) {
      packs[id] = {
        id,
        kind: base.kind,
        label: base.label,
        author: base.author || '',
        repo: base.repo || '',
        url: base.url || '',
        description: base.description || '',
        topic: base.topic || '',
        installedAt: 0,
        members: [],
      }
    }
    const pack = packs[id]
    if (!pack.description && base.description) pack.description = base.description
    const at = (row.evidence && row.evidence.installedAt) || row.createdAt || 0
    if (at && (!pack.installedAt || at < pack.installedAt)) pack.installedAt = at
    pack.members.push({ name: row.name, dirName: row.dirName, state: row.state })
    packOf[row.name] = id
  }

  const loose = []
  for (const row of rows) {
    if (!row.evidence) {
      loose.push(row)
      continue
    }
    // 仓库地址和 catalog 已登记的库相同：沿用那个库 id，钉住 / 折叠状态不丢。
    const lib = row.evidence.url ? libForUrl(row.evidence.url) : ''
    add(lib || row.evidence.id, lib ? { ...row.evidence, catalogLib: lib } : row.evidence, row)
    if (lib) packs[lib].catalogLib = lib
  }

  // 时间窗归组：按创建时间排序，相邻间隔 ≤ window 的算同一批。
  loose.sort((a, b) => a.createdAt - b.createdAt)
  const batches = []
  for (const row of loose) {
    const last = batches[batches.length - 1]
    if (last && row.createdAt && row.createdAt - last.end <= window) {
      last.rows.push(row)
      last.end = row.createdAt
    } else {
      batches.push({ start: row.createdAt, end: row.createdAt, rows: [row] })
    }
  }
  for (const batch of batches) {
    const votes = {}
    for (const row of batch.rows) {
      const lib = knownLib(row.name)
      if (lib && lib !== 'user') votes[lib] = (votes[lib] || 0) + 1
    }
    const ranked = Object.entries(votes).sort((a, b) => b[1] - a[1])
    if (ranked.length && ranked[0][1] * 2 >= Object.values(votes).reduce((sum, n) => sum + n, 0)) {
      // 同一分钟装进来、且多数已知归属同一个库：整批并进去（没登记的同伴多半来自同一个仓库）。
      const lib = ranked[0][0]
      for (const row of batch.rows) add(lib, { kind: 'catalog', label: '', catalogLib: lib }, row)
      packs[lib].catalogLib = lib
      continue
    }
    if (batch.rows.length === 1 && !batch.start) {
      add('user', { kind: 'user', label: '' }, batch.rows[0])
      continue
    }
    const id = 'batch:' + new Date(batch.start).toISOString().slice(0, 16)
    for (const row of batch.rows) add(id, { kind: 'batch', label: '' }, row)
  }
  for (const pack of Object.values(packs)) {
    pack.count = pack.members.length
    pack.members.sort((a, b) => a.name.localeCompare(b.name))
  }
  return { packs, packOf }
}
