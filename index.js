/**
 * 「运行中」面板 · Host 半侧
 * ============================================================================
 * 下面每个服务名 / 事件名都用 cordis_inspect_query 在本机 DSH 0.2.1-rc.5 上核对过，
 * 不是猜的：
 *
 * 【技能】
 *   Service `skills`          ctx.skills.list({ cwd, signal }) -> SkillSummary[]
 *                             SkillSummary = { name, description, source, invocation, ... }
 *   Event   `skills/change`   技能提供者 / 运行时技能 / 目录可能变化（emit）→ 让清单缓存失效
 *   本版本没有 "skill/loaded" 之类的事件：一次技能真正的“加载动作”只体现为
 *   工具 `skill` 的一次调用。所以技能点亮只认 tools/result 里 exec.name === 'skill'
 *   且 result.isError !== true，并从 exec.arguments.name 取技能名。仅受技能规则影响不算。
 *
 * 【工具 / 回合】
 *   Service `tools`           ctx.tools.schemas() -> ToolSchema[]（当前已注册的全部工具）
 *   Event   `tools/result`    (exec, result) —— emit
 *                             exec.agent.id = 会话 id；exec.name = 工具名；
 *                             exec.arguments = 入参；result.isError = 失败 / 被拒绝
 *                             每次调用各发一次（并行同名调用 → 多次事件 → 计数多次）
 *   Event   `session/event`   (session, event) —— 持久事件流；emit
 *                             取 `turn/start` / `turn/end` 作为回合边界：
 *                             turn/end.reason 覆盖 completed / aborted / interrupted /
 *                             error / blocked / max-tokens，所以“用户中断”同样算回合结束。
 *
 * 【子代理】
 *   Event   `subagent/start`  info = { runId, provider, id, local }，id 即子会话 SessionId —— emit
 *   Event   `subagent/end`    info = { runId, provider, id, local, stopReason, ... } —— emit
 *   Service `sessions`        ctx.sessions.get(childId)?.header.parentSession 把子会话挂到父会话
 *                             （SessionHeader.parentSession / origin / delegationDepth）
 *                             子会话第一条 `user/message` 的文本就是它的任务描述
 *   Service `agents`          ctx.agents.get(sessionId) —— 本版本 Agent 只有 { id: SessionId }，
 *                             没有独立的命名 agent 实体，所以代理组只列子代理 + 人格卡，并写明原因。
 *
 * 【人格卡】
 *   Service `settings`        ctx.settings.describe() -> SettingsDescriptor[]（ns / value）
 *                             ns === 'soul-md' 时 value.sessions[sessionId] / value.active 是人格卡名；
 *                             兜底：session.header.agentPreset（Agent 预设名）
 *
 * 【传输】
 *   Service `webServer`       ctx.webServer.register({ kind: 'exact', path, handler })
 *   客户端用 EventSource 订阅 GET /dsh-running-panel/stream?session=<id>；
 *   Host 只在状态真的变化时推一份完整快照（80ms 合并突发）。没有轮询、没有定时读会话。
 * ============================================================================
 */

import { TAG_LABELS, SKILLS, TOOLS, GROUPS, TAG_GROUP, LIBRARIES, LIB_PREFIXES, LIB_IDS, SOURCES, MARKER_SOURCES } from './catalog.js'
import { ECHO_DEFAULTS, advanceEcho, createEcho, mergeCapture, qaFor, selectWindow, visibleFloors } from './echo-core.js'
import { INFER_EVERY_ROUNDS, goalsFor, inferPrompt, isGoal, openGoal, parseInferred, patchGoal, recordDshGoal, workspaceKey } from './goal-core.js'
import { addIdeas, donePrompt, extractPrompt, ideaTurns, ideasFor, markMaybeDone, parseDone, parseIdeas, patchIdea, syncGoal, turnsOf } from './idea-core.js'
import { TRANSLATE_BATCH, applyTranslations, parseTranslations, pendingTranslations, translationPrompt } from './translate-core.js'
import { historyTop } from './history-core.js'
import { groupSkillPacks, parseRepoUrl, scanSkillDirs } from './packs.js'
import { createUndoStore, validDirectoryName } from './undo-store.js'
import { createSessionDiskProbe, decodeSessionLog, findSessionOnDisk } from './session-store.js'
import { buildScene, parseEventLines } from './scene-core.js'
import { suggestEchoes } from './suggest-core.js'
import { activeProfile, loadoutPlan, removeProfile, saveProfile, switchPlan, updateProfile } from './profile-core.js'
import { catalogOverlayPath, readCatalogOverlay, updateCatalogOverlay } from './catalog-overlay.js'
import { spawn } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import { mkdir, readdir, readFile, rename, stat, writeFile } from 'node:fs/promises'
import { zstdDecompress } from 'node:zlib'
import { promisify } from 'node:util'
import { homedir } from 'node:os'
import { dirname, join } from 'node:path'

const PLUGIN_VERSION = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8')).version

const STREAM_PATH = '/dsh-running-panel/stream'
const SNAPSHOT_PATH = '/dsh-running-panel/snapshot'
const CATALOG_PATH = '/dsh-running-panel/catalog'
const STUDIO_PATH = '/dsh-running-panel/studio'
const CONTOUR_MODULE_PATH = '/dsh-running-panel/contour-field.mjs'
const ECHO_PATH = '/dsh-running-panel/echo'
const GOAL_PATH = '/dsh-running-panel/goal'
const TRANSLATE_PATH = '/dsh-running-panel/translate'
const IDEA_PATH = '/dsh-running-panel/idea'
const PROFILES_PATH = '/dsh-running-panel/profiles'
const LOADOUT_PATH = '/dsh-running-panel/loadout'
const SEARCH_PATH = '/dsh-running-panel/search'
/** 等高线工坊是一个单文件 HTML（约 46KB，图形全部由程序生成）；启动时读一次，路由直接吐。 */
const STUDIO_HTML = (() => {
  try {
    return readFileSync(new URL('./studio.html', import.meta.url), 'utf8')
  } catch {
    return ''
  }
})()
/** 工坊的连续场引擎（ESM），客户端动态 import 后直接拿来当面板背景。 */
const CONTOUR_MODULE_JS = (() => {
  try {
    return readFileSync(new URL('./vendor/contour-field.mjs', import.meta.url), 'utf8')
  } catch {
    return ''
  }
})()
/** 纯传输层保活，不携带任何会话状态，也不读取状态。 */
const HEARTBEAT_MS = 30_000
/** 事件合并窗口：同一批工具结果只推一次快照。 */
const COALESCE_MS = 80
/** 诊断仪阈值：同一工具连续失败这么多次 → 疑似卡住。 */
const STUCK_ERROR_STREAK = 3
/** 诊断仪阈值：同一工具在一轮里被调用这么多次 → 疑似原地打转。 */
const STUCK_REPEAT_CALLS = 12
/** 写接口的请求体上限：改名 / 收藏 / 停用的正常请求都在 KB 级。 */
const BODY_LIMIT = 256 * 1024
const zstdDecompressAsync = promisify(zstdDecompress)

/** 读 JSON 请求体，超过上限直接拒绝，不把整段读进内存。 */
async function readJsonBody(req, limit = BODY_LIMIT) {
  let raw = ''
  let size = 0
  for await (const chunk of req) {
    size += typeof chunk === 'string' ? Buffer.byteLength(chunk) : chunk.length
    if (size > limit) {
      const error = new Error('request body too large')
      error.status = 413
      throw error
    }
    raw += chunk
  }
  try {
    return JSON.parse(raw || '{}')
  } catch {
    const error = new Error('invalid JSON body')
    error.status = 400
    throw error
  }
}

const LOOPBACK = new Set(['localhost', '127.0.0.1', '[::1]', '::1'])
/**
 * 写接口不走 /api 鉴权，所以要挡跨站请求（CSRF）：任意网页都能对 localhost 发
 * text/plain 的「简单请求」而无需预检。浏览器会带 Sec-Fetch-Site / Origin，
 * 跨站就拒绝；同源、同站、回环开发代理和不带这些头的本地工具照常放行。
 */
export function crossSiteWrite(req) {
  const headers = (req && req.headers) || {}
  if (String(headers['sec-fetch-site'] || '') === 'cross-site') return true
  const origin = headers.origin
  if (origin === undefined || origin === '') return false
  if (origin === 'null') return true
  try {
    const from = new URL(String(origin)).hostname
    const to = new URL('http://' + String(headers.host || 'localhost')).hostname
    return from !== to && !LOOPBACK.has(from)
  } catch {
    return true
  }
}

const LOOPBACK_ADDRESS = /^(127\.\d+\.\d+\.\d+|::1|::ffff:127\.\d+\.\d+\.\d+)$/

/**
 * 宿主准入：所有 /dsh-running-panel/* 路由都是 webServer 上的 exact 注册，不经过 DSH 自己 /api 的
 * 信任与登录检查，所以每个请求先过一遍宿主的 `connection.admit(request)`——同一套「来源可信 +
 * 浏览器登录或 API 凭据」，并且只放行 owner Peer（DSH 约定：exact route 对非 owner Peer 返回 403）。
 * 宿主还没有 admit 时退到 `requestRejection`；连 connection 服务都没有的老宿主只放行本机回环
 * （对端地址与 Host 头都必须是回环，挡 DNS rebinding）。
 * @returns 0 = 放行；否则是要回给客户端的 HTTP 状态码（401 / 403 …）。
 */
export function admitRequest(connection, req) {
  if (connection && typeof connection.admit === 'function') {
    let admission
    try {
      admission = connection.admit(req)
    } catch {
      return 403 // 准入检查自己出错时不能放行
    }
    if (!admission || typeof admission !== 'object') return 403
    if ('rejection' in admission) return Number(admission.rejection) || 403
    const peer = admission.peer
    if (!peer) return 403
    // 宿主的 principal 是 { kind: 'owner' | … }（browserPeer 即 { kind: 'owner' }）；判断方式与宿主 exact route 一致。
    const principal = peer.principal
    const kind = principal && typeof principal === 'object' ? principal.kind : principal
    if (kind !== 'owner') return 403
    return 0
  }
  if (connection && typeof connection.requestRejection === 'function') {
    let status
    try {
      status = connection.requestRejection(req)
    } catch {
      return 403
    }
    return status === undefined || status === null ? 0 : Number(status) || 403
  }
  const address = String((req && req.socket && req.socket.remoteAddress) || '')
  let host = ''
  try {
    host = new URL('http://' + String((req && req.headers && req.headers.host) || '')).hostname
  } catch {
    host = ''
  }
  return LOOPBACK_ADDRESS.test(address) && LOOPBACK.has(host) ? 0 : 403
}

/** 跨平台「在文件管理器里打开」；子进程错误必须接住，否则会以未处理 error 事件打崩 Host。 */
function openInFileManager(target, select) {
  let command
  let args
  let options = { detached: true, stdio: 'ignore' }
  if (process.platform === 'win32') {
    command = 'explorer.exe'
    // explorer 只认 `/select,"路径"` 这种写法；Node 默认的整段加引号会让它打开「文档」。
    args = select ? ['/select,"' + target + '"'] : ['"' + target + '"']
    options = { ...options, windowsVerbatimArguments: true }
  } else if (process.platform === 'darwin') {
    command = 'open'
    args = select ? ['-R', target] : [target]
  } else {
    command = 'xdg-open'
    args = [select ? dirname(target) : target]
  }
  const child = spawn(command, args, options)
  child.on('error', () => {})
  child.unref()
}

export const inject = ['webServer', 'sessions']

/**
 * 显示名 / tag 词典（catalog.js）→ 客户端可以直接按语言分组的 JSON。
 * 客户端把它注册进 locale 服务，所以加语言不用改代码。
 *
 * 覆盖层 `~/.dsh/running-panel/catalog-overlay.json` 用来补 catalog.js 里没有的能力：
 * 新装的技能只要在这里加一条 { "skill:<id>": { "zh": …, "en": … } }，
 * 名字和悬停说明就跟着走，不用改代码、也不用重新打包。
 */
const OVERLAY_PATH = catalogOverlayPath()
let catalogPayload = null
let catalogStamp = ''
let overlayCache = { stamp: '', data: null, error: '' }

/** 读覆盖层；文件没变就直接用缓存，改了 mtime/size 才重新解析。 */
function readOverlay() {
  try {
    const next = readCatalogOverlay(OVERLAY_PATH)
    overlayCache = { stamp: next.stamp, data: next.data, error: '' }
  } catch (error) {
    // 外部编辑到一半或文件损坏时保留本进程最后一次有效翻译，绝不覆盖原件。
    overlayCache = { ...overlayCache, error: String(error && error.message || error) }
  }
  return overlayCache
}

/** 覆盖层里的多语言条目（names / descs）：空字符串不算数，免得把已有条目清空。 */
function mergeLocalized(target, source) {
  if (!source || typeof source !== 'object') return
  for (const [key, value] of Object.entries(source)) {
    if (!value || typeof value !== 'object') continue
    const clean = {}
    for (const [locale, text] of Object.entries(value)) {
      if (typeof text === 'string' && text.trim()) clean[locale] = text.trim()
    }
    if (!Object.keys(clean).length) continue
    target[key] = Object.assign({}, target[key], clean)
  }
}

/** 覆盖层里的单值条目（tagOf / libOf）。 */
function mergePlain(target, source) {
  if (!source || typeof source !== 'object') return
  for (const [key, value] of Object.entries(source)) {
    if (typeof value === 'string' && value.trim()) target[key] = value.trim()
  }
}

/**
 * 一个能力属于哪个来源库。顺序：显式登记 → 名字前缀（MCP 服务器名、插件前缀）→ 兜底。
 * 运行时没有 provenance 字段，所以这里只做“可解释”的判定，不做猜测式推断。
 */
function resolveLib(key) {
  for (const lib of Object.keys(LIB_IDS)) {
    if (LIB_IDS[lib].indexOf(key) !== -1) return lib
  }
  // 前缀规则匹配的是裸名字（去掉 `tool:` / `skill:`），否则 `mcp__…` 永远对不上。
  const bare = String(key).replace(/^(?:tool|skill):/, '')
  for (const [prefix, lib] of LIB_PREFIXES) {
    if (bare.slice(0, prefix.length) === prefix) return lib
  }
  return key.indexOf('skill:') === 0 ? 'user' : 'core'
}

/** 自装技能若是 git clone 下来的，把 origin 当仓库地址（读 .git/config，不调 git）。 */
const skillRepoCache = new Map()
function skillRepoUrl(name) {
  if (!name) return ''
  if (skillRepoCache.has(name)) return skillRepoCache.get(name)
  let url = ''
  try {
    const config = readFileSync(join(homedir(), '.agents', 'skills', name, '.git', 'config'), 'utf8')
    const match = config.match(/^\s*url\s*=\s*(.+)$/m)
    if (match) {
      url = match[1]
        .trim()
        .replace(/^git@([^:]+):/, 'https://$1/')
        .replace(/\.git$/, '')
    }
  } catch {
    /* 不是 git 仓库就没有仓库地址 */
  }
  skillRepoCache.set(name, url)
  return url
}

/**
 * 技能安装包（packs.js）：由 Host 扫描后写进来，buildCatalog 把它并进 libs / libOf。
 * stamp 变了 catalog 缓存就失效，快照里的 catalogVersion 也随之变化，客户端据此重拉词典。
 */
let packState = { stamp: '', packs: {}, packOf: {} }
export function setPackState(next) {
  packState = next && typeof next === 'object' ? next : { stamp: '', packs: {}, packOf: {} }
}

/** catalog 里登记了 GitHub 地址的库：地址 → 库 id，用来把扫描到的同源技能并回原库。 */
const LIB_BY_URL = new Map(
  Object.entries(SOURCES)
    .map(([lib, url]) => [parseRepoUrl(url), lib])
    .filter(([repo]) => repo)
    .map(([repo, lib]) => [repo.url.toLowerCase(), lib]),
)
export function libForUrl(url) {
  const repo = parseRepoUrl(url)
  return (repo && LIB_BY_URL.get(repo.url.toLowerCase())) || ''
}

function pad2(n) {
  return String(n).padStart(2, '0')
}

/** 没有仓库信息的一批：按安装时刻命名。 */
function batchLabel(at) {
  const d = new Date(at)
  const stamp = pad2(d.getMonth() + 1) + '-' + pad2(d.getDate()) + ' ' + pad2(d.getHours()) + ':' + pad2(d.getMinutes())
  return { zh: stamp + ' 批量安装', en: 'Installed ' + stamp }
}

export function buildCatalog() {
  const overlay = readOverlay()
  const stamp = overlay.stamp + ':' + overlay.error + ':' + packState.stamp
  if (catalogPayload && stamp === catalogStamp) return catalogPayload
  catalogStamp = stamp
  const tags = {}
  for (const [id, zh, en] of TAG_LABELS) tags[id] = { zh, en }
  const libs = {}
  const libMeta = {}
  const sources = Object.assign({}, SOURCES)
  for (const [id, zh, en] of LIBRARIES) {
    libs[id] = { zh, en }
    // 默认组名「作者/仓库」——用户记得住的是从哪装的；原来的中文名留作说明。
    const repo = parseRepoUrl(SOURCES[id])
    if (repo && /github\.com/.test(repo.url)) {
      libs[id] = { zh: repo.author + '/' + repo.repo, en: repo.author + '/' + repo.repo }
      libMeta[id] = { kind: 'catalog', description: zh, descriptionEn: en, author: repo.author, repo: repo.repo }
    }
  }
  const names = {}
  const tagOf = {}
  const libOf = {}
  const descs = {}
  for (const [id, zh, en, tag] of SKILLS) {
    names['skill:' + id] = { zh, en }
    tagOf['skill:' + id] = tag
  }
  for (const [id, zh, en, tag] of TOOLS) {
    names['tool:' + id] = { zh, en }
    tagOf['tool:' + id] = tag
  }
  const overlayLibOf = {}
  if (overlay && overlay.data) {
    mergeLocalized(names, overlay.data.names)
    mergeLocalized(descs, overlay.data.descs)
    mergePlain(tagOf, overlay.data.tagOf)
    mergePlain(overlayLibOf, overlay.data.libOf)
  }
  for (const pack of Object.values(packState.packs || {})) {
    const id = pack.id
    if (id === 'user') continue
    if (!libs[id]) libs[id] = pack.kind === 'batch' ? batchLabel(pack.installedAt) : { zh: pack.label || id, en: pack.label || id }
    if (pack.url && !sources[id]) sources[id] = pack.url
    libMeta[id] = Object.assign({}, libMeta[id] || { kind: pack.kind }, {
      installedAt: pack.installedAt || 0,
      count: pack.count || 0,
      author: pack.author || (libMeta[id] && libMeta[id].author) || '',
      repo: pack.repo || (libMeta[id] && libMeta[id].repo) || '',
      topic: pack.topic || '',
    })
    if (pack.description) libMeta[id].description = pack.description
    for (const member of pack.members || []) {
      const key = 'skill:' + member.name
      if (!overlayLibOf[key]) libOf[key] = id
    }
  }
  Object.assign(libOf, overlayLibOf)
  for (const key of Object.keys(names)) {
    if (!libOf[key]) libOf[key] = resolveLib(key)
  }
  // 用户右键改的组名：覆盖层 names['lib:<id>']，和条目改名同一套存储。
  for (const key of Object.keys(names)) {
    if (!key.startsWith('lib:')) continue
    const id = key.slice(4)
    if (libs[id]) libs[id] = Object.assign({}, libs[id], names[key])
  }
  catalogPayload = { version: 3, pluginVersion: PLUGIN_VERSION, stamp, overlayError: overlay.error, tags, libs, libMeta, names, tagOf, libOf, descs, sources }
  return catalogPayload
}

/** 某个技能在 catalog 里的归属（不含扫描结果），给时间窗归组投票用。 */
function catalogLibOf(name) {
  return resolveLib('skill:' + name)
}

/* ── 工具分区 ─────────────────────────────────────────────────────────────
 * 分区顺序即用户要求的顺序；名字先精确匹配，再前缀匹配，最后按描述关键词兜底。
 * 命中不了的进「其他」，不猜。
 */
const GROUP_ORDER = ['files', 'exec', 'search', 'web', 'media', 'office', 'agents', 'memory', 'other']
const GROUP_TITLES = {
  files: '文件读写',
  exec: '命令执行',
  search: '检索',
  web: '网络',
  media: '媒体生成',
  office: 'Office',
  agents: '代理协作',
  memory: '记忆与人格',
  other: '其他（未归类）',
}

const EXACT_GROUP = {
  read: 'files',
  write: 'files',
  edit: 'files',
  read_image: 'files',
  present: 'files',
  load_workspace_dependencies: 'files',
  str_replace_editor: 'files',

  pwsh: 'exec',
  bash: 'exec',
  pkill: 'exec',
  job_list: 'exec',
  job_output: 'exec',
  job_kill: 'exec',
  terminal_open: 'exec',
  terminal_list: 'exec',
  terminal_read: 'exec',
  terminal_send: 'exec',
  terminal_signal: 'exec',
  terminal_close: 'exec',

  glob: 'search',
  grep: 'search',
  lsp: 'search',
  session_search: 'search',
  session_trace: 'search',
  session_event_read: 'search',
  session_event_search: 'search',
  session_event_trace: 'search',

  web_search: 'web',
  web_fetch: 'web',

  subagent: 'agents',
  subagent_fork: 'agents',
  send_message: 'agents',
  list_agents: 'agents',
  interrupt_agent: 'agents',
  wait_agent: 'agents',
  workflow: 'agents',
  spawn_teammate: 'agents',
  list_subagent_models: 'agents',

  memory_read: 'memory',
  memory_append: 'memory',
  memory_rewrite: 'memory',
  memory_search: 'memory',
  soul_read: 'memory',
  soul_update: 'memory',
}

const PREFIX_GROUP = [
  ['mcp__', 'web'],
  ['whale_', 'media'],
  ['office_', 'office'],
  ['office', 'office'],
  ['xlsx', 'office'],
  ['docx', 'office'],
  ['pptx', 'office'],
  ['pdf', 'office'],
  ['subagent', 'agents'],
  ['workflow', 'agents'],
  ['team_', 'agents'],
  ['memory_', 'memory'],
  ['soul_', 'memory'],
  ['job_', 'exec'],
  ['terminal_', 'exec'],
]

const KEYWORD_GROUP = [
  ['image', 'media'],
  ['video', 'media'],
  ['render', 'media'],
  ['speech', 'media'],
  ['spreadsheet', 'office'],
  ['document', 'office'],
  ['presentation', 'office'],
  ['subagent', 'agents'],
  ['delegate', 'agents'],
  ['memory', 'memory'],
  ['persona', 'memory'],
]

function classifyTool(name, description) {
  if (EXACT_GROUP[name]) return EXACT_GROUP[name]
  const lower = String(name).toLowerCase()
  for (const [prefix, group] of PREFIX_GROUP) if (lower.startsWith(prefix)) return group
  const text = (lower + ' ' + String(description || '').toLowerCase())
  for (const [needle, group] of KEYWORD_GROUP) if (text.includes(needle)) return group
  return 'other'
}

/* ── 小工具 ───────────────────────────────────────────────────────────── */

function emptyState() {
  return {
    round: 0,
    phase: 'idle',
    spentAt: 0,
    running: false,
    title: '',
    tools: {},
    skills: {},
    /** 进行中的调用：callId -> { name, at }，用于和 tools/result 配对算耗时。 */
    calls: {},
    /** 本轮已测量的耗时合计（毫秒）。 */
    roundMs: 0,
    /** 本轮最慢的单次调用。 */
    roundSlowTool: '',
    roundSlowMs: 0,
    /** 最近一次加载的技能名；后续工具耗时按它归因到「工时占比」。 */
    activeSkill: '',
  }
}

/** 置顶项连续这么多轮没被再次调用，就退回它原本的分组。 */
const PIN_LIMIT = 4

function newRecord() {
  return {
    round: 0,
    total: 0,
    at: 0,
    error: false,
    lastRound: -1,
    pinnedAt: 0,
    misses: 0,
    /** 连续失败次数（成功一次就归零），用于“疑似卡住”。 */
    streak: 0,
    /** 耗时（毫秒）：最近一次 / 合计 / 最大，以及已测量的次数。 */
    lastMs: 0,
    totalMs: 0,
    maxMs: 0,
    measured: 0,
    /** 技能专属：加载后发生的工具调用耗时合计（归因，不是墙钟）。 */
    workMs: 0,
  }
}

/** 一次调用：本轮/累计计数、记录轮次、进入（或留在）“正在运行”区。 */
function touch(record, state, at) {
  state.lastSeen = Math.max(state.lastSeen || 0, at)
  record.round += 1
  record.total += 1
  record.at = at
  record.lastRound = state.round
  if (!record.pinnedAt) record.pinnedAt = at
  record.misses = 0
}

/**
 * 新回合开始：本轮计数归零、累计保留；
 * 已经在“正在运行”区但上一轮没被调用的，累计落选次数，满 PIN_LIMIT 次退回原分组。
 * 本轮再被调用会由 touch() 把落选次数清零并重新点亮。
 */
function decay(record, round) {
  if (record.pinnedAt) {
    if (record.lastRound !== round - 1) {
      record.misses = (record.misses || 0) + 1
      if (record.misses >= PIN_LIMIT) {
        record.pinnedAt = 0
        record.misses = 0
      }
    } else {
      record.misses = 0
    }
  }
  record.round = 0
  record.error = false
  // 失败连击只在同一轮里有意义：新一轮开始归零，避免上一轮的警报一直挂着。
  record.streak = 0
}

/** 取或建一条记录；首次创建时接上落盘的历史累计（base），重启后累计不会归零。 */
function recordFor(state, kind, name) {
  const bag = kind === 'tool' ? state.tools : state.skills
  let record = bag[name]
  if (!record) {
    record = newRecord()
    const saved = state.history && state.history[kind === 'tool' ? 'tools' : 'skills']
    record.base = (saved && saved[name]) || 0
    bag[name] = record
  }
  return record
}

function recordShape(record) {
  return {
    round: record.round,
    total: record.total + (record.base || 0),
    at: record.at,
    error: Boolean(record.error),
    pinned: Boolean(record.pinnedAt),
    pinnedAt: record.pinnedAt || 0,
    misses: record.misses || 0,
    streak: record.streak || 0,
    lastMs: record.lastMs || 0,
    totalMs: record.totalMs || 0,
    maxMs: record.maxMs || 0,
    measured: record.measured || 0,
    workMs: record.workMs || 0,
  }
}

function skillNameFromArguments(args) {
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

function truncate(text, limit) {
  const value = String(text || '').replace(/\s+/g, ' ').trim()
  return value.length > limit ? value.slice(0, limit - 1) + '…' : value
}

function sessionTitle(ctx, session) {
  if (!session) return ''
  try {
    const titles = ctx.get('sessionTitle')
    const snapshot = titles && typeof titles.get === 'function' ? titles.get(session) : undefined
    if (snapshot && typeof snapshot === 'object') {
      const value = snapshot.title ?? snapshot.value ?? snapshot.text
      if (typeof value === 'string' && value.trim()) return value.trim()
    }
  } catch {
    /* 标题只是装饰，读不到就不显示 */
  }
  return ''
}

function firstUserText(session) {
  if (!session || typeof session.snapshotEvents !== 'function') return ''
  try {
    const events = session.snapshotEvents()
    for (const event of events) {
      if (!event || event.type !== 'user/message') continue
      const text = contentText(event.data && event.data.content)
      if (text) return text
    }
  } catch {
    /* 会话尚未落盘 */
  }
  return ''
}

/** ContentBlock[] -> 纯文本（用于取子代理的任务描述）。 */
function contentText(content) {
  if (!Array.isArray(content)) return ''
  return content
    .filter((block) => block && block.type === 'text' && typeof block.text === 'string')
    .map((block) => block.text)
    .join(' ')
    .trim()
}

/** 用 Host tokenMeter 的单条估价；服务不可用才退回 chars/4，并在快照里标明。 */
function estimateTextTokens(meter, text, sources) {
  const value = String(text || '')
  if (meter && typeof meter.estimateMessage === 'function') {
    try {
      const tokens = meter.estimateMessage({
        id: 'running-panel-cost-estimate',
        role: 'user',
        content: [{ type: 'text', text: value }],
        source: { kind: 'user' },
      })
      if (Number.isFinite(tokens) && tokens >= 0) {
        if (sources) sources.add('tokenMeter.estimateMessage')
        return tokens
      }
    } catch {
      /* fall through */
    }
  }
  if (sources) sources.add('chars/4 fallback')
  return Math.ceil(value.length / 4)
}

/* ── 插件本体 ─────────────────────────────────────────────────────────── */

export function apply(ctx) {
  /** sessionId -> 该会话本轮的计数与阶段（内存态；不写会话日志，不改变任何既有行为） */
  const states = new Map()
  /** 因长期空闲被清出内存的会话：sessionId -> { tools, skills, lastAt }（单会话累计的基线） */
  const retiredSessions = new Map()
  /** childId -> 子代理运行记录 */
  const runs = new Map()
  /** 已连接的 EventSource 客户端 */
  const clients = new Set()
  /** cwd -> 技能清单（由 skills/change 失效，不做定时刷新） */
  const skillCache = new Map()
  let flushTimer = null

  const get = (name) => {
    try {
      return ctx.get(name)
    } catch {
      return undefined
    }
  }

  /**
   * 取 Session。子会话的 SessionId 与根会话的形态可能不同（根会话是 `session-<uuid>`，
   * subagent 运行时给出的 id 也可能是裸 uuid），三种写法都试一次，避免因为前缀
   * 差异把父子关系或任务描述丢掉。
   */
  function sessionFor(id) {
    if (!id) return undefined
    const sessions = get('sessions')
    if (!sessions || typeof sessions.get !== 'function') return undefined
    const candidates = [id, 'session-' + id, String(id).replace(/^session-/, '')]
    for (const candidate of candidates) {
      try {
        const session = sessions.get(candidate)
        if (session) return session
      } catch {
        /* 换下一种写法 */
      }
    }
    return undefined
  }

  function stateOf(sessionId) {
    let state = states.get(sessionId)
    if (!state) {
      state = emptyState()
      // 清理过又回来的会话：接回它的单会话基线，计数不从 0 开始。
      const retired = retiredSessions.get(sessionId)
      if (retired) {
        state.history = retired
        retiredSessions.delete(sessionId)
      }
      states.set(sessionId, state)
    }
    return state
  }

  /** 会话标题只在会话还活着时读得到，读到就缓存；全局视图靠它显示“哪个任务”。 */
  function rememberTitle(sessionId, session) {
    const state = stateOf(sessionId)
    if (state.title) return state.title
    const title = sessionTitle(ctx, session || sessionFor(sessionId))
    if (title) state.title = title
    return state.title
  }

  /* 事件：Agent 运行状态（emit，payload = { agent, status }）—— 全局视图用它判定“正在运行”。 */
  ctx.on('agent/status', (payload) => {
    const id = payload && payload.agent && payload.agent.id
    if (!id) return
    const state = stateOf(id)
    state.running = payload.status === 'running'
    markDirty()
  })

  /* 事件：回合边界 —— 新回合清掉 spent 痕迹回到 idle；回合结束把 active 一起熄灭。 */
  ctx.on('session/event', (session, event) => {
    if (!session || !event) return
    const id = session.id
    if (!id) return
    if (event.type === 'user/message' || event.type === 'assistant/message') advanceEchoes(id)
    if (event.type === 'user/message') {
      // 子代理的任务描述 = 子会话第一条 user/message 的文本。
      // 子会话结束后会离开内存 store，所以必须在事件到达时抓下来，不能等快照时再读。
      const run = runs.get(id)
      if (run && !run.label) {
        const text = contentText(event.data && event.data.content)
        if (text) {
          run.label = truncate(text, 140)
          markDirty()
        }
      }
      return
    }
    if (event.type === 'turn/start') {
      const state = stateOf(id)
      const turn = event.data && typeof event.data.turn === 'number' ? event.data.turn : state.round + 1
      // 新回合：清掉上一回合的 spent 痕迹（按 round 归零，渲染层只看 round 判断状态），
      // 但每条记录的 total（本会话累计次数）必须保留。
      state.round = turn
      state.phase = 'idle'
      state.spentAt = 0
      state.running = true
      state.calls = {}
      state.roundMs = 0
      state.roundInputTokens = 0
      state.roundOutputTokens = 0
      state.roundSlowTool = ''
      state.roundSlowMs = 0
      state.activeSkill = ''
      rememberTitle(id, session)
      for (const record of Object.values(state.tools)) decay(record, turn)
      for (const record of Object.values(state.skills)) decay(record, turn)
      markDirty()
      return
    }
    if (event.type === 'assistant/message' && event.data && event.data.usage) {
      const state = stateOf(id)
      const usage = event.data.usage
      const input = Number(usage.inputTokens) || 0
      const output = Number(usage.outputTokens) || 0
      state.inputTokens = (state.inputTokens || 0) + input
      state.outputTokens = (state.outputTokens || 0) + output
      state.roundInputTokens = (state.roundInputTokens || 0) + input
      state.roundOutputTokens = (state.roundOutputTokens || 0) + output
      markDirty()
      return
    }
    if (event.type === 'turn/end') {
      const state = stateOf(id)
      state.running = false
      if (state.phase === 'active') {
        state.phase = 'spent'
        state.spentAt = typeof event.time === 'number' ? event.time : Date.now()
        markDirty()
      }
      return
    }
    // 耗时起点：durable `tool/call` 带 callId 与 time，和 tools/result 配对成墙钟耗时。
    if (event.type === 'tool/call') {
      const data = event.data || {}
      const callId = data.callId
      if (!callId) return
      const state = stateOf(id)
      state.calls[callId] = { name: String(data.name || ''), at: typeof event.time === 'number' ? event.time : Date.now() }
      return
    }
  })

  /* 事件：每一次工具调用结束（并行同名调用会来多次，所以次数会把并行算成多次）。 */
  ctx.on('tools/result', (exec, result) => {
    if (!exec) return
    const sessionId = exec.agent && exec.agent.id
    const name = typeof exec.name === 'string' ? exec.name : ''
    if (!sessionId || !name) return
    const state = stateOf(sessionId)
    const at = Date.now()
    const failed = Boolean(result && result.isError)

    const record = recordFor(state, 'tool', name)
    touch(record, state, at)
    if (failed) {
      record.error = true
      record.streak += 1
    } else {
      record.streak = 0
    }

    // 耗时：拿 session/event 记下的 tool/call 起点配对。配不到（插件中途加载）就不填，绝不估算。
    const measured = measureCall(state, exec, at)
    if (measured) {
      record.lastMs = measured
      record.totalMs += measured
      record.maxMs = Math.max(record.maxMs, measured)
      record.measured += 1
      state.roundMs += measured
      if (measured > state.roundSlowMs) {
        state.roundSlowMs = measured
        state.roundSlowTool = name
      }
    }

    // 工时归因：技能加载后发生的工具耗时记到该技能头上。
    // 这是启发式，不是墙钟；并行调用、跨轮沿用都会让数字有偏差，UI 里写明。
    if (measured && name !== 'skill' && state.activeSkill) {
      const owner = recordFor(state, 'skill', state.activeSkill)
      owner.workMs = (owner.workMs || 0) + measured
    }

    if (name === 'skill' && !failed) {
      const skillName = skillNameFromArguments(exec.arguments)
      if (skillName) {
        const entry = recordFor(state, 'skill', skillName)
        touch(entry, state, at)
        if (measured) {
          entry.lastMs = measured
          entry.totalMs += measured
          entry.maxMs = Math.max(entry.maxMs, measured)
          entry.measured += 1
        }
        state.activeSkill = skillName
      }
    }

    // 回合已经结束（含中断）后再落地的结果不再把面板翻回高亮。
    if (state.phase !== 'spent') {
      state.phase = 'active'
      state.spentAt = 0
    }
    markDirty()
  })

  /* 事件：子代理生命周期 —— 挂到父会话下，结束时整棵子树转 spent。 */
  ctx.on('subagent/start', (info) => {
    if (!info || !info.id) return
    const childId = info.id
    const child = sessionFor(childId)
    const parentId = (child && child.header && child.header.parentSession) || ''
    const previous = runs.get(childId) || {}
    runs.set(childId, {
      parentId: parentId || previous.parentId || '',
      provider: info.provider || previous.provider || '',
      startedAt: Date.now(),
      endedAt: 0,
      stopReason: '',
      label: previous.label || '',
    })
    const state = stateOf(childId)
    state.phase = 'active'
    state.spentAt = 0
    markDirty()
  })

  ctx.on('subagent/end', (info) => {
    if (!info || !info.id) return
    const childId = info.id
    const run = runs.get(childId) || { parentId: '', provider: info.provider || '', startedAt: Date.now() }
    run.endedAt = Date.now()
    run.stopReason = typeof info.stopReason === 'string' ? info.stopReason : ''
    runs.set(childId, run)
    const state = states.get(childId)
    if (state) {
      state.phase = 'spent'
      state.spentAt = run.endedAt
    }
    markDirty()
  })

  ctx.on('skills/change', () => {
    skillCache.clear()
    scanColdSkills()
    scanUserSkills()
    scanPacks()
    markDirty()
  })

  /* ── 快照 ───────────────────────────────────────────────────────────── */

  /**
   * 技能清单：优先 `sessionSkillCatalog`（Service `sessionSkillCatalog`，
   * `list({ sessionId }, signal) -> { skills: SkillEntry[] }` —— 按该会话的 cwd 与
   * preset 组合出“这个会话看得见的技能”，不需要激活冷 Agent）；
   * 没有会话时退回 `skills.list({ cwd })` 的全局层。
   * 缓存按会话 / cwd 分桶，只由 `skills/change` 失效，不做定时刷新。
   */
  async function listSkills(sessionId) {
    const key = sessionId || '@global'
    const cached = skillCache.get(key)
    if (cached) return cached

    const catalog = get('sessionSkillCatalog')
    if (sessionId && catalog && typeof catalog.list === 'function') {
      try {
        const value = await catalog.list({ sessionId }, new AbortController().signal)
        const entries = (value && Array.isArray(value.skills) ? value.skills : []).map((item) => ({
          name: String(item.name || ''),
          description: truncate(item.description || item.whenToUse || '', 160),
          costDescription: String(item.description || item.whenToUse || '').slice(0, CATALOG_DESCRIPTION_MAX),
          source: typeof item.path === 'string' && item.path ? 'filesystem' : '',
          chars: String(item.name || '').length + String(item.description || '').length,
          modelInvocable: item.modelInvocable !== false,
        }))
        const snapshotValue = { observable: true, list: entries }
        skillCache.set(key, snapshotValue)
        return snapshotValue
      } catch (error) {
        // 会话还没进 store 等情况：继续走全局层，并把原因记下来
        const fallback = await listSkillsGlobal()
        return Object.assign({}, fallback, {
          note: '会话级技能目录读取失败（' + String(error && error.message ? error.message : error) + '），已退回全局技能层。',
        })
      }
    }
    return listSkillsGlobal()
  }

  /**
   * 模型真正看到的技能目录：全局层 + 当前会话 preset 层。
   * 会话还活着时用 agent 作用域拿精确集合；会话已关闭就退回全局层。
   * 面板以前只统计 `sessionSkillCatalog`（单会话切片），和模型实际收到的目录对不上。
   */
  async function modelSkillCatalog(session) {
    const service = get('skills')
    if (!service || typeof service.list !== 'function') return null
    const cwd = session && session.header && typeof session.header.cwd === 'string' ? session.header.cwd : undefined
    const signal = new AbortController().signal
    const agents = get('agents')
    const agent = session && agents && typeof agents.get === 'function' ? agents.get(session.id) : undefined
    try {
      const list =
        agent && typeof service.snapshot === 'function'
          ? (await service.snapshot({ cwd, scope: agent, signal })).skills
          : await service.list({ cwd, signal })
      return (Array.isArray(list) ? list : []).filter((item) => {
        if (!item || !item.invocation) return true
        return item.invocation.modelInvocable !== false
      })
    } catch {
      return null
    }
  }

  /** 目录一行的真实体积：`- \`name\`: description`，描述按 tool-skill 的默认上限 500 截断。 */
  const CATALOG_DESCRIPTION_MAX = 500
  function catalogLineChars(item) {
    const name = String((item && item.name) || '')
    const description = String((item && item.description) || '').slice(0, CATALOG_DESCRIPTION_MAX)
    return name.length + description.length + 7
  }

  async function listSkillsGlobal() {
    const key = '@global'
    const cached = skillCache.get(key)
    if (cached) return cached
    const service = get('skills')
    if (!service || typeof service.list !== 'function') {
      return { observable: false, list: [], reason: 'Host 没有 `skills` 服务（skills 插件未装配），技能清单读不到。' }
    }
    try {
      const summaries = await service.list({})
      const value = {
        observable: true,
        list: (Array.isArray(summaries) ? summaries : []).map((item) => ({
          name: String(item.name || ''),
          description: truncate(item.description || item.whenToUse || '', 160),
          costDescription: String(item.description || item.whenToUse || '').slice(0, CATALOG_DESCRIPTION_MAX),
          source: typeof item.source === 'string' ? item.source : '',
          chars: String(item.name || '').length + String(item.description || '').length,
          modelInvocable: item.modelInvocable !== false,
        })),
      }
      skillCache.set(key, value)
      return value
    } catch (error) {
      return { observable: false, list: [], reason: '`skills.list()` 失败：' + String(error && error.message ? error.message : error) }
    }
  }

  /**
   * 工具清单：优先用该会话持久日志里的工具表
   * `session.toolHistory() -> { tools: ToolSchema[], updates: [{ additions }] }` ——
   * 这是模型真正拿到的那套工具（包含 preset 作用域挂载的工具），
   * 而 `ctx.tools.schemas()` 只返回全局层，会漏掉 read / pwsh / skill 这些。
   */
  function sessionToolSchemas(session) {
    if (!session || typeof session.toolHistory !== 'function') return null
    try {
      const history = session.toolHistory()
      if (!history) return null
      const merged = new Map()
      for (const tool of history.tools || []) {
        if (tool && tool.name) merged.set(tool.name, tool)
      }
      for (const update of history.updates || []) {
        for (const tool of (update && update.additions) || []) {
          if (tool && tool.name) merged.set(tool.name, tool)
        }
      }
      return merged.size ? Array.from(merged.values()) : null
    } catch {
      return null
    }
  }

  function listTools(session) {
    const fromSession = sessionToolSchemas(session)
    if (fromSession) return buildToolGroups(fromSession, 'session.toolHistory')
    const tools = get('tools')
    if (!tools || typeof tools.schemas !== 'function') {
      return { observable: false, total: 0, groups: [], reason: 'Host 没有 `tools` 服务，工具清单读不到。' }
    }
    let schemas = []
    try {
      schemas = tools.schemas() || []
    } catch (error) {
      return { observable: false, total: 0, groups: [], reason: '`tools.schemas()` 失败：' + String(error) }
    }
    return buildToolGroups(schemas, 'tools.schemas')
  }

  function buildToolGroups(schemas, source) {
    const buckets = new Map(GROUP_ORDER.map((id) => [id, []]))
    for (const schema of schemas) {
      if (!schema || !schema.name) continue
      const group = classifyTool(schema.name, schema.description)
      buckets.get(group).push({
        name: String(schema.name),
        description: truncate(schema.description || '', 160),
      })
    }
    const groups = GROUP_ORDER.filter((id) => id !== 'other' || buckets.get('other').length > 0).map((id) => ({
      id,
      title: GROUP_TITLES[id],
      items: buckets.get(id).sort((a, b) => a.name.localeCompare(b.name)),
    }))
    return { observable: true, total: groups.reduce((sum, group) => sum + group.items.length, 0), groups, source }
  }

  function childLabel(childId) {
    const session = sessionFor(childId)
    if (!session) return ''
    const text = firstUserText(session)
    return text ? truncate(text, 140) : ''
  }

  /** 子会话 id 与父会话 id 的前缀形态未必一致，比较前统一去掉 `session-`。 */
  function normalizeId(id) {
    return String(id || '').replace(/^session-/, '')
  }

  function collectChildren(rootId) {
    const byParent = new Map()
    for (const [childId, run] of runs) {
      let parentId = run.parentId
      if (!parentId) {
        const child = sessionFor(childId)
        parentId = (child && child.header && child.header.parentSession) || ''
        run.parentId = parentId
      }
      if (!parentId) continue
      const key = normalizeId(parentId)
      if (!byParent.has(key)) byParent.set(key, [])
      byParent.get(key).push(childId)
    }
    const out = []
    const walk = (parentKey, depth, seen) => {
      const list = byParent.get(parentKey) || []
      for (const childId of list) {
        if (seen.has(childId)) continue
        seen.add(childId)
        const run = runs.get(childId) || {}
        const state = states.get(childId)
        const tools = state
          ? Object.entries(state.tools)
              .map(([name, record]) => ({
                name,
                count: record.round,
                total: record.total + (record.base || 0),
                at: record.at,
                error: Boolean(record.error),
              }))
              .sort((a, b) => b.at - a.at)
          : []
        const ended = Boolean(run.endedAt)
        out.push({
          id: childId,
          depth,
          label: run.label || childLabel(childId) || '（子会话已结束，任务描述未能捕获）',
          provider: run.provider || '',
          startedAt: run.startedAt || 0,
          endedAt: run.endedAt || 0,
          stopReason: run.stopReason || '',
          phase: ended ? 'spent' : 'active',
          tools,
        })
        walk(normalizeId(childId), depth + 1, seen)
      }
    }
    walk(normalizeId(rootId), 0, new Set())
    return out
  }

  /**
   * 人格卡 / Agent 预设。
   * 1) 设置文档里“卡片仓库”形状的 section（soul-md 的 value 含有 cards + active + sessions）
   *    → 该会话选中的卡 → 默认卡；
   * 2) 兜底 Agent 预设：session.header.agentPreset，或 agentPresets.resolve() 解出的当前预设。
   * 两者都读不到才把这一项标为不可观测，不编名字。
   */
  function personaCardFromSettings(sessionId) {
    try {
      const settings = get('settings')
      const rows = settings && typeof settings.describe === 'function' ? settings.describe({ redactSecrets: true }) : []
      for (const row of Array.isArray(rows) ? rows : []) {
        const value = row && row.value
        if (!value || typeof value !== 'object') continue
        const cards = value.cards
        if (!cards || typeof cards !== 'object' || !('active' in value)) continue
        const sessions = value.sessions && typeof value.sessions === 'object' ? value.sessions : {}
        const chosen = sessionId ? sessions[sessionId] : undefined
        const ns = typeof row.ns === 'string' ? row.ns : 'settings'
        if (chosen === 'none') return { state: 'none', name: '', ns }
        if (typeof chosen === 'string' && chosen) return { state: 'session', name: chosen, ns }
        if (typeof value.active === 'string' && value.active) return { state: 'default', name: value.active, ns }
        // 卡片仓库存在，但本会话没选、默认卡也为空
        return { state: 'none', name: '', ns }
      }
    } catch {
      /* 没有 settings 服务，或该 profile 没有卡片型命名空间 */
    }
    return null
  }

  async function agentPresetName(session) {
    const header = session && session.header ? session.header : undefined
    const declarative = header && typeof header.agentPreset === 'string' ? header.agentPreset : ''
    const presets = get('agentPresets')
    if (presets && typeof presets.resolve === 'function') {
      try {
        const preset = await presets.resolve(declarative || undefined)
        if (preset) {
          const name = preset.title || preset.name || preset.id || ''
          if (typeof name === 'string' && name) return name
        }
      } catch {
        /* 解析失败就退回 header */
      }
    }
    return declarative
  }

  async function personaFor(sessionId, session) {
    const card = personaCardFromSettings(sessionId)
    const preset = await agentPresetName(session)
    if (card && card.name) {
      return {
        observable: true,
        kind: 'persona-card',
        name: card.name,
        preset,
        source: 'settings:' + card.ns,
        label: card.name + (card.state === 'default' ? '（默认卡）' : ''),
      }
    }
    if (card && card.state === 'none') {
      return {
        observable: true,
        kind: 'persona-card',
        name: '',
        preset,
        source: 'settings:' + card.ns,
        label: preset ? '未启用人格卡（回退 Agent 预设）' : '未启用人格卡',
      }
    }
    if (preset) {
      return {
        observable: true,
        kind: 'agent-preset',
        name: preset,
        preset,
        source: 'agentPresets.resolve() / session.header.agentPreset',
        label: preset,
      }
    }
    return {
      observable: false,
      kind: 'none',
      name: '',
      preset: '',
      source: '',
      label: '',
      reason: '既没有读到卡片型人格设置，也没有解析出当前 Agent 预设，人格卡名称不可观测。',
    }
  }

  /**
   * 会话标题：优先用 title 服务的生成标题；没有就退回首条用户消息的前 40 个字。
   * 两者都没有才是空 —— 这时客户端显示「未命名会话」，绝不把 session id 当名字。
   * 结果缓存在 state.title 上，避免每次推送都扫一遍会话日志。
   */
  function deriveTitle(state, session) {
    if (state && state.title) return state.title
    const fromService = sessionTitle(ctx, session)
    if (fromService) {
      if (state) state.title = fromService
      return fromService
    }
    const prompt = truncate(firstUserText(session), 40)
    if (prompt) {
      if (state) state.title = prompt
      return prompt
    }
    return ''
  }

  function sessionMeta(sessionId, session) {
    if (!sessionId) {
      return { id: '', title: '', cwd: '', phase: 'idle', round: 0, spentAt: 0, subagent: false, parentId: '' }
    }
    const state = states.get(sessionId)
    const header = (session && session.header) || {}
    return {
      id: sessionId,
      title: deriveTitle(state, session),
      cwd: typeof header.cwd === 'string' ? header.cwd : '',
      phase: state ? state.phase : 'idle',
      round: state ? state.round : 0,
      spentAt: state ? state.spentAt : 0,
      roundMs: state ? state.roundMs : 0,
      slowest: state && state.roundSlowTool ? { tool: state.roundSlowTool, ms: state.roundSlowMs } : null,
      subagent: header.origin === 'subagent' || Boolean(header.parentSession),
      parentId: typeof header.parentSession === 'string' ? header.parentSession : '',
    }
  }

  async function buildSnapshot(sessionId) {
    const session = sessionId ? sessionFor(sessionId) : undefined
    const meta = sessionMeta(sessionId, session)
    const state = sessionId ? states.get(sessionId) : undefined
    const skills = await listSkills(sessionId)
    const modelSkills = await modelSkillCatalog(session)
    const modelChars = modelSkills ? modelSkills.reduce((sum, item) => sum + catalogLineChars(item), 0) : 0
    const tools = listTools(session)
    const tokenMeter = get('tokenMeter')
    const parkableSkills = userSkillNames()
    const costSources = new Set()
    const estimateCost = (text) => estimateTextTokens(tokenMeter, text, costSources)
    const costSkills = modelSkills
      ? modelSkills.map((item) => ({
          name: String(item.name || ''),
          description: String(item.description || item.whenToUse || '').slice(0, CATALOG_DESCRIPTION_MAX),
          modelInvocable: true,
        }))
      : skills.list.map((item) => ({ ...item, description: item.costDescription || item.description }))
    const skillTokens = new Map(
      costSkills.map((item) => [
        item.name,
        estimateCost(String(item.name || '') + '\n' + String(item.description || '')),
      ]),
    )
    const toolSchemas = sessionToolSchemas(session) || (function () {
      try {
        const service = get('tools')
        return service && typeof service.schemas === 'function' ? service.schemas() || [] : []
      } catch {
        return []
      }
    })()
    const schemaTokens = new Map(
      toolSchemas.map((schema) => [
        schema && schema.name,
        estimateCost(JSON.stringify(schema || {})),
      ]),
    )
    const skillsInventory = skills.list.map((item) => ({
      name: item.name,
      description: item.description,
      source: item.source,
      modelInvocable: Boolean(item.modelInvocable),
      tokens: skillTokens.has(item.name)
        ? skillTokens.get(item.name)
        : estimateCost(item.name + '\n' + (item.costDescription || item.description || '')),
      /** 只有 ~/.agents/skills 里的用户技能能被 /park 物理移走；内置技能为 false。 */
      parkable: parkableSkills.has(item.name),
      /** 自装技能若是 git clone 下来的，把 origin 当仓库地址给行内 ↗ 用。 */
      repoUrl: skillRepoUrl(userSkillDirectory(item.name) || item.name),
      state: state && state.skills[item.name] ? recordShape(state.skills[item.name]) : null,
    }))
    const groups = tools.groups.map((group) => ({
      id: group.id,
      title: group.title,
      items: group.items.map((item) => ({
        name: item.name,
        description: item.description,
        tokens: schemaTokens.has(item.name) ? schemaTokens.get(item.name) : estimateCost(item.name + '\n' + (item.description || '')),
        state: state && state.tools[item.name] ? recordShape(state.tools[item.name]) : null,
      })),
    }))
    const costItems = []
    for (const item of costSkills) {
      const tokens = skillTokens.get(item.name) || 0
      if (item.modelInvocable && tokens > 0) costItems.push({ kind: 'skill', name: item.name, tokens: tokens })
    }
    for (const group of groups) {
      for (const item of group.items) {
        if (item.tokens > 0) costItems.push({ kind: 'tool', name: item.name, tokens: item.tokens })
      }
    }
    const cost = {
      estimated: true,
      source: costSources.size ? Array.from(costSources).join(' + ') : 'no estimable input',
      scope: modelSkills ? 'model-catalog' : 'session-catalog fallback',
      totalTokens: costItems.reduce((sum, item) => sum + item.tokens, 0),
      top: costItems.slice().sort((a, b) => b.tokens - a.tokens).slice(0, 5),
    }
    const persona = await personaFor(sessionId, session)
    let context = null
    if (session && tokenMeter && typeof tokenMeter.contextPressure === 'function') {
      try {
        const pressure = tokenMeter.contextPressure(session)
        if (pressure && (Number.isFinite(pressure.pressureTokens) || Number.isFinite(pressure.contextWindow))) {
          const used = Number.isFinite(pressure.pressureTokens) ? pressure.pressureTokens : 0
          const window = Number.isFinite(pressure.contextWindow) ? pressure.contextWindow : 0
          context = {
            pressureTokens: used,
            contextWindow: window,
            pct: window > 0 ? Math.min(999, Math.round((used / window) * 100)) : null,
          }
        }
      } catch {
        context = null
      }
    }
    const agentsObservable = Boolean(get('subagents'))
    const notes = []
    if (!agentsObservable) {
      notes.push('Host 没有 `subagents` 服务，`subagent/start` / `subagent/end` 不会发出，子代理活动不可观测。')
    }
    if (persona.reason) notes.push(persona.reason)
    if (!skills.observable) notes.push(skills.reason)
    if (!tools.observable) notes.push(tools.reason)
    notes.push(
      '本版本没有独立的 agent 实体：Agent 只有 { id: SessionId }，子代理就是带 parentSession 的子会话，因此代理组只列子代理与人格卡。',
    )
    notes.push('技能只在工具 `skill` 真的被调用并成功时点亮；仅受某技能规则影响不会被推断为“已加载”。')

    return {
      version: 1,
      pluginVersion: PLUGIN_VERSION,
      /** 词典版本：变了客户端就重拉 /catalog（新装技能、分组变化、外部改了覆盖层）。 */
      catalogVersion: buildCatalog().stamp,
      time: Date.now(),
      session: meta,
      storage: storageStatus(),
      /** 目标层：本会话工作区的 PULSE 目标；DSH 原生 /goal 由客户端从会话投影读。 */
      goal: goalView(meta.cwd),
      /** 模型推断的目标提议（只在内存里，按会话）：{ status, title, round, at, error }。 */
      goalProposal: goalProposals.get(sessionId) || null,
      /** 新技能自动翻译：待翻译数、是否在跑、上次结果。由客户端按设置触发。 */
      translate: (refreshTranslatePending(false), translateStatus()),
      /** 灵感与分支：本会话工作区的待做 / 进行中 / 已完成，以及收集、检查、回填的状态。 */
      ideas: ideasView(meta.cwd),
      ...await undoSnapshot(),
      /** 供应商 usage 的实测累计；没有 usage 就是 0，不估算。 */
      tokens: {
        input: (state && state.inputTokens) || 0,
        output: (state && state.outputTokens) || 0,
        roundInput: (state && state.roundInputTokens) || 0,
        roundOutput: (state && state.roundOutputTokens) || 0,
      },
      observability: {
        skills: skills.observable,
        tools: tools.observable,
        agents: agentsObservable,
      },
      skills: { observable: skills.observable, count: skillsInventory.length, items: skillsInventory },
      tools: { observable: tools.observable, total: tools.total, groups },
      /** 置顶区：技能与工具混排，按进入先后稳定排序，供面板顶部的「正在运行」用。 */
      running: pinnedEntries(state),
      /** Host tokenMeter 的最新上下文压力；没有记录时为 null，不估算。 */
      context: context,
      /** 提示词成本估算：单项按 name/description/schema 估价，不是账单。 */
      cost: cost,
      /** 公告预算：模型真实目录（全局层 + 会话层）＋冷层索引，这才是每轮注入的体积。 */
      budget: {
        chars: modelChars + coldPromptText().length,
        liveChars: modelChars,
        coldChars: coldPromptText().length,
        /** 目录里模型可调用（modelInvocable）的技能条数。 */
        skills: modelSkills ? modelSkills.length : 0,
        tokens: Math.round((modelChars + coldPromptText().length) / 4),
        observable: modelSkills !== null,
        /** 会话切片：面板「技能」组用的口径，和上面不是一回事。 */
        sessionChars: skills.list.reduce((sum, item) => sum + (item.chars || 0), 0),
        sessionSkills: skills.list.length,
      },
      /** 历史：落盘后的跨会话累计，重启不丢。 */
      history: {
        since: lifetime.since,
        ready: storeReady,
        /** 只统计用户自己装的技能，官方内置的不算——用户想知道的是"我装了哪些常用的"。 */
        top: storeReady ? historyTop(totalsForWrite(), { userSkills: installedSkillNames(), limit: 40 }) : [],
        toolTop: (function () {
          if (!storeReady) return []
          const totals = totalsForWrite()
          return Object.keys(totals)
            .filter((key) => key.startsWith('tool:'))
            .map((key) => ({ key: key, n: totals[key].n }))
            .sort((a, b) => b.n - a.n)
            .slice(0, 3)
        })(),
      },
      /** 圆环：四个大类的本轮 / 累计调用数。 */
      categories: categoryStats(state),
      /** 冷层：物理停用、只以一行提示存在的技能。 */
      cold: {
        count: coldList.length,
        chars: coldPromptText().length,
        ready: coldReady,
        section: Boolean(promptService && typeof promptService.section === 'function'),
        items: coldList.slice(0, 40),
      },
      /** 诊断：可能卡住的信号。 */
      alerts: alertsFor(state),
      agents: {
        observable: agentsObservable,
        hasAgentEntity: false,
        persona,
        children: collectChildren(sessionId || ''),
      },
      notes,
    }
  }

  /**
   * 对话右上角圆盘只要「本轮构成 + 公告预算 + 阶段」：不估 token、不列技能 / 工具清单、
   * 不读撤销日志。它每 4 s 拉一次，完整快照对它太重。
   */
  async function buildCornerSnapshot(sessionId) {
    const session = sessionId ? sessionFor(sessionId) : undefined
    const state = sessionId ? states.get(sessionId) : undefined
    const modelSkills = await modelSkillCatalog(session)
    const modelChars = modelSkills ? modelSkills.reduce((sum, item) => sum + catalogLineChars(item), 0) : 0
    const coldChars = coldPromptText().length
    return {
      version: 1,
      view: 'corner',
      pluginVersion: PLUGIN_VERSION,
      time: Date.now(),
      session: { id: sessionId, phase: state ? state.phase : 'idle', round: state ? state.round : 0 },
      categories: categoryStats(state),
      budget: {
        chars: modelChars + coldChars,
        liveChars: modelChars,
        coldChars: coldChars,
        skills: modelSkills ? modelSkills.length : 0,
        tokens: Math.round((modelChars + coldChars) / 4),
        observable: modelSkills !== null,
      },
    }
  }

  /**
   * 圆环统计的数据：把每个能力按 tag 归到四个大类，分别累加本轮 / 累计调用次数。
   * 刻意跳过工具 `skill` 本身——技能加载已经记在对应的技能条目上，否则会被算两次。
   */
  function categoryStats(state) {
    const out = {}
    for (const id of GROUPS) out[id] = { id, round: 0, total: 0 }
    if (!state) return GROUPS.map((id) => out[id])
    const catalog = buildCatalog()
    const add = (kind, name, record) => {
      const tag = catalog.tagOf[kind + ':' + name]
      const group = TAG_GROUP[tag] || 'ops'
      out[group].round += record.round || 0
      out[group].total += record.total || 0
    }
    for (const [name, record] of Object.entries(state.tools)) {
      if (name === 'skill') continue
      add('tool', name, record)
    }
    for (const [name, record] of Object.entries(state.skills)) add('skill', name, record)
    return GROUPS.map((id) => out[id])
  }

  /** 一个会话当前值得提示的异常（结构化，文案由客户端按语言组装）。 */
  function alertsFor(state) {
    if (!state) return []
    const out = []
    for (const [name, record] of Object.entries(state.tools)) {
      if (record.streak >= STUCK_ERROR_STREAK) out.push({ kind: 'errors', tool: name, count: record.streak })
    }
    // 重复计数只对「目录里没有登记的工具」生效：pwsh / web_fetch / read 这类官方工具
    // 本来就会在一轮里连着调几十次，算成卡住只会天天误报。
    const catalog = buildCatalog()
    for (const [name, record] of Object.entries(state.tools)) {
      if (record.round < STUCK_REPEAT_CALLS) continue
      if (catalog.tagOf['tool:' + name]) continue
      out.push({ kind: 'repeat', tool: name, count: record.round })
    }
    out.sort((a, b) => b.count - a.count)
    return out
  }

  /** 配对 tool/call 的起点算墙钟耗时；配不到就返回 0（不估算、不显示）。 */
  function measureCall(state, exec, now) {
    const callId = exec && exec.callId
    if (!callId) return 0
    const started = state.calls[callId]
    if (!started) return 0
    delete state.calls[callId]
    const ms = now - started.at
    return ms > 0 ? ms : 0
  }
    /* ── 冷层（停用技能）：物理挪出目录 + 一行提示换回 8k 索引 ──────────── */

    /**
     * 停用的技能被挪到 `~/.agents/skills-parked/`，技能注册表根本看不见它们。
     * 这里只做一件事：把名字 + 极短线索写进系统提示词的一段，
     * 让模型“知道它们存在、也知道什么时候该问”，成本约 45 字符/条，而不是完整描述的 330 字符。
     */
    const PARKED_DIR = join(homedir(), '.agents', 'skills-parked')
    let coldList = []
    let coldReady = false

    function parseFrontmatter(text) {
      const match = String(text).match(/^---\r?\n([\s\S]*?)\r?\n---/)
      const out = {}
      if (!match) return out
      for (const line of match[1].split(/\r?\n/)) {
        const kv = line.match(/^([A-Za-z_-]+):\s*(.*)$/)
        if (!kv) continue
        let value = kv[2].trim()
        if (
          (value.charAt(0) === '"' && value.charAt(value.length - 1) === '"') ||
          (value.charAt(0) === "'" && value.charAt(value.length - 1) === "'")
        ) {
          value = value.slice(1, -1)
        }
        out[kv[1]] = value
      }
      return out
    }

    /** 用户自装技能的名字集合：来自 ~/.agents/skills 目录，官方内置的不在其中。 */
    let userSkillNamesCache = null
    /** 技能名（frontmatter name）→ 目录名。两者可以不同，停用 / 打开目录必须按目录名。 */
    let userSkillDirs = new Map()

    async function scanUserSkills() {
      try {
        const entries = await readdir(join(homedir(), '.agents', 'skills'), { withFileTypes: true })
        const names = new Set()
        const dirs = new Map()
        for (const entry of entries) {
          if (!entry.isDirectory()) continue
          let name = entry.name
          try {
            const text = await readFile(join(homedir(), '.agents', 'skills', entry.name, 'SKILL.md'), 'utf8')
            name = parseFrontmatter(text).name || entry.name
          } catch {
            /* 没有 SKILL.md 就按目录名 */
          }
          names.add(name)
          if (!dirs.has(name)) dirs.set(name, entry.name)
        }
        userSkillNamesCache = names
        userSkillDirs = dirs
      } catch {
        userSkillNamesCache = new Set()
        userSkillDirs = new Map()
      }
    }

    function userSkillNames() {
      return userSkillNamesCache || new Set()
    }

    /** 历史常用的口径：自装技能，包括已停用到冷层的（停用不该抹掉它的历史）。 */
    function installedSkillNames() {
      const names = new Set(userSkillNames())
      for (const row of coldList) names.add(row.name)
      for (const name of Object.keys(packState.packOf || {})) names.add(name)
      return names
    }

    /* ── 技能安装包：live + 冷层一起扫，停用 / 启用不改变一个技能属于哪一批 ── */
    let packScan = null
    async function scanPacks() {
      if (packScan) return packScan
      packScan = (async () => {
        try {
          const rows = await scanSkillDirs(
            [
              { root: join(homedir(), '.agents', 'skills'), state: 'live' },
              { root: PARKED_DIR, state: 'cold' },
            ],
            join(homedir(), '.agents', '.skill-lock.json'),
            MARKER_SOURCES,
          )
          const grouped = groupSkillPacks(rows, { knownLib: catalogLibOf, libForUrl })
          const stamp = JSON.stringify(Object.values(grouped.packs).map((pack) => [pack.id, pack.members.map((m) => m.name)]))
          if (stamp !== packState.stamp) {
            setPackState({ stamp, packs: grouped.packs, packOf: grouped.packOf })
            markDirty()
          }
        } catch {
          /* 扫描失败就沿用上一次的分组 */
        } finally {
          packScan = null
        }
      })()
      return packScan
    }

    /** 技能名 → ~/.agents/skills 下的目录名；不是自装技能就返回空串。 */
    function userSkillDirectory(name) {
      return userSkillDirs.get(name) || ''
    }


    async function scanColdSkills() {
      try {
        const entries = await readdir(PARKED_DIR, { withFileTypes: true })
        const rows = []
        for (const entry of entries) {
          if (!entry.isDirectory()) continue
          try {
            const text = await readFile(join(PARKED_DIR, entry.name, 'SKILL.md'), 'utf8')
            const front = parseFrontmatter(text)
            const name = front.name || entry.name
            const cue = String(front.description || '')
              .replace(/\s+/g, ' ')
              .trim()
              .slice(0, 18)
            rows.push({ name: name, directoryName: entry.name, cue: cue })
          } catch {
            /* 目录里没有 SKILL.md 就跳过 */
          }
        }
        // 线索优先用 catalog 里的中文短名（接口设计 / 排错恢复 …），比截断英文描述有用得多。
        const catalog = buildCatalog()
        for (const row of rows) {
          const entry = catalog.names['skill:' + row.name]
          if (entry && entry.zh) row.cue = entry.zh
        }
        rows.sort((a, b) => a.name.localeCompare(b.name))
        coldList = rows
      } catch {
        coldList = []
      }
      coldReady = true
    }

    /** 系统提示词里的那一段：没有停用技能时返回空串，不占位置。 */
    function coldPromptText() {
      if (!coldList.length) return ''
      const lines = coldList.map((row) => '- ' + row.name + (row.cue ? ' — ' + row.cue : ''))
      return (
        '以下技能已停用（不在索引里）。任务明显需要时，先告诉用户「有对应技能，是否启用」，不要自己重写：\n' +
        lines.join('\n') +
        '\n（共 ' + coldList.length + ' 个）'
      )
    }

    /* ── 历史统计落盘（只存计数与时间戳，不存会话正文） ──────────────── */

    /**
     * 存哪里：$DSH_HOME/running-panel/usage.json。
     * 面板是观测者，不是第二份会话日志——所以这里只有计数和时间，没有内容。
     */
    const STORE_DIR = join(process.env.DSH_HOME || join(homedir(), '.dsh'), 'running-panel')
    const STORE_FILE = join(STORE_DIR, 'usage.json')
    const ECHO_FILE = join(STORE_DIR, 'echoes.json')
    const undoStore = createUndoStore({ directory: STORE_DIR, liveRoot: join(homedir(), '.agents', 'skills'), coldRoot: PARKED_DIR })
    /**
     * 撤销状态快照要拿 SQLite 锁、读日志、比对目录身份；以前每次推送（突发时每 80 ms、每个订阅端）
     * 都做一遍。现在缓存：本进程每次 move 后立即失效，另有 10 s 兜底，覆盖其他进程（桌面 / 网页两个 DSH）。
     */
    const UNDO_SNAPSHOT_TTL = 10_000
    let undoSnapshotCache = null
    function undoSnapshot() {
      const now = Date.now()
      if (!undoSnapshotCache || now - undoSnapshotCache.at > UNDO_SNAPSHOT_TTL) {
        const pending = undoStore.snapshot()
        undoSnapshotCache = { at: now, pending }
        pending.catch(() => {
          if (undoSnapshotCache && undoSnapshotCache.pending === pending) undoSnapshotCache = null
        })
      }
      return undoSnapshotCache.pending
    }
    function invalidateUndoSnapshot() {
      undoSnapshotCache = null
    }
    /**
     * 「原会话还在吗」：内存 store 里没有不等于没了——DSH 把会话落在
     * $DSH_HOME/sessions/<workspace>/<id>/session.v4.jsonl.zstd，磁盘在就是在。
     */
    const SESSION_STORE_DIR = join(process.env.DSH_HOME || join(homedir(), '.dsh'), 'sessions')
    const sessionOnDisk = createSessionDiskProbe(SESSION_STORE_DIR)
    /** 跨会话、跨重启的累计：`tool:read` -> { n, at }。 */
    const lifetime = { since: 0, totals: {} }
    let storeReady = false
    let storeError = ''
    let usageWriteQueue = Promise.resolve()
    let saveTimer = null
    /** Echo：用户主动收藏的对话快照；和 usage 分开文件，避免观测数据动辄重写。 */
    const echoStore = { version: 1, echoes: [] }
    let echoReady = false
    let echoReadError = ''
    let echoError = ''
    let echoWriteQueue = Promise.resolve()
    let echoMutationQueue = Promise.resolve()
    let echoSaveTimer = null

    function storageStatus() {
      const overlay = readOverlay()
      return {
        catalog: { ready: !overlay.error, error: overlay.error },
        usage: { ready: storeReady, error: storeError },
        echoes: { ready: echoReady, error: echoError },
      }
    }

    function validUsageStore(data) {
      const object = (value) => value && typeof value === 'object' && !Array.isArray(value)
      const nonnegative = (value) => Number.isFinite(value) && value >= 0
      const optionalNumber = (row, key) => row[key] === undefined || nonnegative(row[key])
      if (!object(data) || (data.version !== undefined && data.version !== 1)) return false
      if (!optionalNumber(data, 'since') || !optionalNumber(data, 'updatedAt')) return false
      if (data.totals !== undefined && (!Array.isArray(data.totals) || data.totals.some((row) =>
        !object(row) || typeof row.k !== 'string' || !row.k || !nonnegative(row.n) ||
        !optionalNumber(row, 'at') || !optionalNumber(row, 'ms')))) return false
      if (data.sessions !== undefined) {
        if (!object(data.sessions)) return false
        for (const row of Object.values(data.sessions)) {
          if (!object(row) || !optionalNumber(row, 'lastAt')) return false
          for (const key of ['tools', 'skills']) {
            if (row[key] !== undefined && (!object(row[key]) || !Object.values(row[key]).every(nonnegative))) return false
          }
        }
      }
      return true
    }

    async function loadStore() {
      try {
        const data = JSON.parse(await readFile(STORE_FILE, 'utf8'))
        if (!validUsageStore(data)) throw new Error('Invalid or unsupported usage store')
        if (data && typeof data === 'object') {
          if (Array.isArray(data.totals)) {
            for (const row of data.totals) {
              if (row && row.k && Number.isFinite(row.n)) {
                lifetime.totals[row.k] = { n: row.n, at: row.at || 0, ms: Number.isFinite(row.ms) ? row.ms : 0 }
              }
            }
          }
          if (Number.isFinite(data.since)) lifetime.since = data.since
          if (data.sessions && typeof data.sessions === 'object') {
            for (const id of Object.keys(data.sessions)) {
              const saved = data.sessions[id]
              if (!saved || typeof saved !== 'object') continue
              const state = stateOf(id)
              state.history = { tools: saved.tools || {}, skills: saved.skills || {}, lastAt: saved.lastAt || 0 }
              // 载入可能晚于事件：给已经建好的记录补上基线，避免这一段被漏算。
              for (const [name, record] of Object.entries(state.tools)) {
                if (!record.base) record.base = state.history.tools[name] || 0
              }
              for (const [name, record] of Object.entries(state.skills)) {
                if (!record.base) record.base = state.history.skills[name] || 0
              }
            }
          }
        }
      } catch (error) {
        if (!error || error.code !== 'ENOENT') {
          storeError = 'Usage history could not be loaded; original file preserved: ' + String(error && error.message || error)
          return
        }
      }
      if (!lifetime.since) lifetime.since = Date.now()
      storeReady = true
      scheduleSave()
    }

    function scheduleSave() {
      if (!storeReady || saveTimer) return
      saveTimer = setTimeout(function () {
        saveTimer = null
        saveStore()
      }, 1500)
    }

    /* ── Echo：用户主动收藏的对话片段 ─────────────────────────────────── */

    let echoLoadPromise = null

    async function loadEchoes() {
      try {
        const data = JSON.parse(await readFile(ECHO_FILE, 'utf8'))
        if (!data || !Array.isArray(data.echoes) || data.echoes.some(function (echo) {
          return !echo || typeof echo.id !== 'string' || typeof echo.sessionId !== 'string'
        })) throw new Error('Invalid Echo store')
        echoStore.echoes = data.echoes
      } catch (error) {
        if (!error || error.code !== 'ENOENT') {
          echoReadError = 'Echo store could not be loaded; original file preserved: ' + String(error && error.message || error)
          echoError = echoReadError
        }
      }
      echoReady = true
    }

    function ensureEchoes() {
      if (echoReady) return Promise.resolve()
      if (!echoLoadPromise) echoLoadPromise = loadEchoes()
      return echoLoadPromise
    }

    function scheduleEchoSave() {
      if (!echoReady || echoSaveTimer) return
      echoSaveTimer = setTimeout(function () {
        echoSaveTimer = null
        enqueueEchoMutation(() => saveEchoes()).catch(() => {})
      }, 400)
    }

    function enqueueEchoMutation(action) {
      const pending = echoMutationQueue.then(action)
      echoMutationQueue = pending.catch(() => {})
      return pending
    }

    function echoTransaction(action) {
      return enqueueEchoMutation(async () => {
        const before = JSON.stringify(echoStore.echoes)
        try {
          return await action()
        } catch (error) {
          echoStore.echoes = JSON.parse(before)
          throw error
        }
      })
    }

    function saveEchoes() {
      const pending = echoWriteQueue.then(async () => {
        try {
          if (!echoReady || echoReadError) throw new Error(echoReadError || 'Echo store is not ready')
          const payload = JSON.stringify(echoStore)
          await mkdir(STORE_DIR, { recursive: true })
          const tmp = ECHO_FILE + '.tmp'
          await writeFile(tmp, payload, 'utf8')
          await rename(tmp, ECHO_FILE)
          echoError = ''
        } catch (error) {
          echoError = String(error && error.message || error)
          throw error
        }
      })
      echoWriteQueue = pending.catch(() => {})
      return pending
    }

    const ECHO_CAPACITY = 200
    function echoCapacity() {
      return { count: echoStore.echoes.length, limit: ECHO_CAPACITY }
    }

    function echoSessionTitle(echo) {
      const session = sessionForEcho(echo.sessionId)
      return (
        (session && sessionTitle(ctx, session)) ||
        (echo.meta && echo.meta.sessionTitle) ||
        echo.title ||
        ''
      )
    }

    function echoSummary(echo) {
      const qa = qaFor(echo)
      const anchor = echo.anchors && echo.anchors[0] ? echo.anchors[0] : null
      const anchorMessage = anchor && Array.isArray(echo.messages)
        ? echo.messages.find(function (message) { return message && message.id === anchor.messageId })
        : null
      const anchorAt = (anchor && Number(anchor.at)) || (anchorMessage && Number(anchorMessage.at)) || echo.updatedAt || 0
      const anchorFloor = anchor && Number.isFinite(anchor.index) ? Math.max(1, anchor.index + 1) : 1
      return {
        id: echo.id,
        sessionId: echo.sessionId,
        title: echo.title || '',
        sessionTitle: echoSessionTitle(echo),
        sessionAlive: Boolean(sessionForEcho(echo.sessionId)) || sessionOnDisk(echo.sessionId),
        anchorAt: anchorAt,
        anchorTurn: (anchor && Number(anchor.turn)) || (anchorMessage && Number(anchorMessage.turn)) || 0,
        anchorFloor: anchorFloor,
        questionText: qa.questionText,
        answerText: qa.answerText,
        anchorMessageId: echo.anchors && echo.anchors[0] ? echo.anchors[0].messageId : '',
        note: echo.note || '',
        tags: Array.isArray(echo.tags) ? echo.tags : [],
        createdAt: echo.createdAt || 0,
        updatedAt: echo.updatedAt || 0,
        messageCount: Array.isArray(echo.messages) ? echo.messages.length : 0,
        anchorCount: Array.isArray(echo.anchors) ? echo.anchors.length : 0,
        pending: Boolean(echo.pending),
        pendingAfter: Number(echo.pendingAfter) || 0,
        ranges: Array.isArray(echo.ranges) ? echo.ranges : [],
      }
    }

    function findEcho(id) {
      return echoStore.echoes.find(function (echo) {
        return echo && echo.id === id && !isGoal(echo)
      })
    }

    function listEchoes(sessionId) {
      return echoStore.echoes
        .filter(function (echo) {
          return echo && echo.sessionId === sessionId && !isGoal(echo)
        })
        .sort(function (a, b) {
          return (b.updatedAt || 0) - (a.updatedAt || 0)
        })
        .map(echoSummary)
    }

    function listAllEchoes() {
      return echoStore.echoes
        .filter(function (echo) {
          return !isGoal(echo)
        })
        .sort(function (a, b) {
          return (b.updatedAt || 0) - (a.updatedAt || 0)
        })
        .map(echoSummary)
    }

    function sessionForEcho(id) {
      if (!id) return undefined
      let session = ctx.sessions.get(id)
      if (!session && !String(id).startsWith('session-')) session = ctx.sessions.get('session-' + id)
      if (!session && String(id).startsWith('session-')) session = ctx.sessions.get(String(id).slice(8))
      return session
    }

    /** 把一条消息清洗成人类可读文本；自动检查点、工具行、运行环境行都丢掉。 */
    function cleanEchoText(raw, role) {
      const value = String(raw || '').trim()
      if (
        !value ||
        /^(?:<goal_round>|<goal_complete>|<system-reminder>|This is an automatically generated checkpoint|Time sampled|Current runtime context|Current working directory|Browser time zone|Tokens prefixed|The available skill catalog changed)/i.test(value) ||
        (role === 'assistant' && /^工具[:：]/.test(value))
      ) {
        return ''
      }
      return value
        .replace(/<goal_round>[\s\S]*?<\/goal_round>/gi, '')
        .replace(/<goal_complete>[\s\S]*?<\/goal_complete>/gi, '')
        .replace(/<system-reminder>[\s\S]*?<\/system-reminder>/gi, '')
        .split('\n')
        .filter(function (line) {
          return !/^(?:Image "|Normalized copy|Source dimensions|request preview|Time sampled|Browser time zone)/i.test(line.trim())
        })
        .join('\n')
        .replace(/[ \t]+/g, ' ')
        .replace(/\n{3,}/g, '\n\n')
        .trim()
        .slice(0, 8000)
    }

    /** 从 durable Session 事件/消息还原可收藏的“楼”；只存文本，不存工具名。 */
    function collectEchoFloors(session) {
      const metaById = new Map()
      let turn = 0
      for (const event of session.snapshotEvents()) {
        if (!event || !event.data) continue
        if (event.type === 'turn/start') {
          if (typeof event.data.turn === 'number') turn = event.data.turn
          continue
        }
        if (event.type === 'user/message' && event.data.id) {
          metaById.set(event.data.id, { turn: turn, at: event.time })
        } else if (event.type === 'assistant/message' && event.data.message && event.data.message.id) {
          metaById.set(event.data.message.id, {
            turn: typeof event.data.turn === 'number' ? event.data.turn : turn,
            at: event.time,
          })
        }
      }
      return visibleFloors(
        session.deriveMessages().map(function (message) {
          const meta = metaById.get(message.id) || {}
          const text = cleanEchoText(contentText(message.content) || '', message.role)
          if (!text) return null
          return {
            id: message.id,
            role: message.role,
            text: text,
            at: meta.at || 0,
            turn: meta.turn || 0,
          }
        }),
      ).filter(function (message) {
        return message && message.text && message.role !== 'tool'
      })
    }

    /**
     * deriveMessages() 可能被 DSH 折叠/压缩掉旧消息；事件日志通常还在。
     * all 保留工具调用层用于按 messageId 定位，natural 只留可收藏问答。
     */
    function collectEventFloors(session) {
      const all = []
      const natural = []
      const seen = new Set()
      let turn = 0
      for (const event of session.snapshotEvents()) {
        if (!event || !event.data) continue
        if (event.type === 'turn/start') {
          if (typeof event.data.turn === 'number') turn = event.data.turn
          continue
        }
        let message = null
        if (event.type === 'user/message') message = event.data
        else if (event.type === 'assistant/message') message = event.data.message
        if (!message || !message.id || seen.has(message.id)) continue
        seen.add(message.id)
        const role = message.role || (event.type === 'user/message' ? 'user' : 'assistant')
        if (role !== 'user' && role !== 'assistant') continue
        const text = cleanEchoText(contentText(message.content) || '', role)
        const item = {
          id: message.id,
          role: role,
          text: text,
          at: event.time,
          turn: typeof event.data.turn === 'number' ? event.data.turn : turn,
        }
        all.push(item)
        if (text) natural.push(item)
      }
      return { all: all, natural: natural }
    }

    const SESSION_HOME = join(process.env.DSH_HOME || join(homedir(), '.dsh'), 'sessions')
    const PROJ_HOME = join(process.env.DSH_HOME || join(homedir(), '.dsh'), 'storages', 'session_projcache', 'sessions')
    let archiveSearchIndex = null
    let archiveSearchAt = 0
    let archiveSearchPromise = null
    /** 每个会话日志按 mtime+size 缓存解析结果：重建索引时只解压真正变过的文件。 */
    const archiveFileCache = new Map()

    async function walkSessionLogs(dir, out) {
      let entries = []
      try {
        entries = await readdir(dir, { withFileTypes: true })
      } catch {
        return
      }
      for (const entry of entries) {
        const path = join(dir, entry.name)
        if (entry.isDirectory()) await walkSessionLogs(path, out)
        else if (entry.isFile() && entry.name === 'session.v4.jsonl.zstd') out.push(path)
      }
    }

    async function archiveTitle(sessionId) {
      try {
        const data = JSON.parse(await readFile(join(PROJ_HOME, sessionId + '.json'), 'utf8'))
        const title = data && data.record && data.record.rows && data.record.rows.title && data.record.rows.title.val
        if (typeof title === 'string' && title.trim()) return title.trim()
      } catch {
        /* fall through */
      }
      return ''
    }

    async function ensureArchiveSearchIndex() {
      if (archiveSearchIndex && Date.now() - archiveSearchAt < 120000) return archiveSearchIndex
      if (archiveSearchPromise) return archiveSearchPromise
      archiveSearchPromise = (async function () {
        const files = []
        await walkSessionLogs(SESSION_HOME, files)
        const rows = []
        const live = new Set(files)
        for (const cached of archiveFileCache.keys()) if (!live.has(cached)) archiveFileCache.delete(cached)
        for (const file of files) {
          const sessionId = file.split(/[\\/]/).slice(-2, -1)[0]
          if (!sessionId) continue
          let info
          try {
            info = await stat(file)
          } catch {
            continue
          }
          const cached = archiveFileCache.get(file)
          if (cached && cached.mtimeMs === info.mtimeMs && cached.size === info.size) {
            for (const row of cached.rows) rows.push(row)
            continue
          }
          let text = ''
          try {
            const raw = await readFile(file)
            try {
              // 异步解压：同步版本会在大日志上把整个 Host 事件循环卡住几百毫秒。
              // 日志是多帧拼接，必须逐帧解；只解第一帧会只剩 `session` 头一行。
              text = await decodeSessionLog(raw, zstdDecompressAsync)
            } catch {
              text = raw.toString('utf8')
            }
          } catch {
            continue
          }
          const fileRows = []
          let title = await archiveTitle(sessionId)
          let floor = 0
          let turn = 0
          for (const line of text.split(/\r?\n/)) {
            if (!line.trim()) continue
            let event
            try {
              event = JSON.parse(line)
            } catch {
              continue
            }
            if (!event || !event.data) continue
            if (event.type === 'turn/start' && typeof event.data.turn === 'number') {
              turn = event.data.turn
              continue
            }
            let message = null
            if (event.type === 'user/message') message = event.data
            else if (event.type === 'assistant/message') message = event.data.message
            if (!message || !message.id) continue
            const role = message.role || (event.type === 'user/message' ? 'user' : 'assistant')
            if (role !== 'user' && role !== 'assistant') continue
            const clean = cleanEchoText(contentText(message.content) || '', role)
            if (!clean) continue
            floor += 1
            if (!title && role === 'user') title = clean.slice(0, 80)
            fileRows.push({
              sessionId: sessionId,
              sessionTitle: title,
              messageId: message.id,
              turn: typeof event.data.turn === 'number' ? event.data.turn : turn,
              floor: floor,
              // 索引常驻内存：每楼只留前 2000 字（搜索片段只需要命中附近的上下文）。
              text: clean.length > 2000 ? clean.slice(0, 2000) : clean,
            })
          }
          archiveFileCache.set(file, { mtimeMs: info.mtimeMs, size: info.size, rows: fileRows })
          for (const row of fileRows) rows.push(row)
        }
        archiveSearchIndex = rows
        archiveSearchAt = Date.now()
        return rows
      })()
      try {
        return await archiveSearchPromise
      } finally {
        archiveSearchPromise = null
      }
    }

    function nearestNaturalAnchor(all, messageId) {
      const anchorIndex = all.findIndex(function (message) {
        return message.id === messageId
      })
      if (anchorIndex < 0) return null
      for (let i = anchorIndex + 1; i < all.length; i += 1) {
        if (all[i].role === 'assistant' && all[i].text) return all[i]
      }
      for (let i = anchorIndex - 1; i >= 0; i -= 1) {
        if (all[i].role === 'assistant' && all[i].text) return all[i]
      }
      for (let i = anchorIndex + 1; i < all.length; i += 1) {
        if (all[i].role === 'user' && all[i].text) return all[i]
      }
      return null
    }

    function captureFor(session, messageId) {
      let floors = collectEchoFloors(session)
      let capture = selectWindow(floors, messageId, ECHO_DEFAULTS.before, ECHO_DEFAULTS.after)
      let effectiveAnchorId = messageId
      if (!capture) {
        // 旧消息可能已经被 DSH 折叠出 deriveMessages；事件日志通常仍保留。
        const eventFloors = collectEventFloors(session)
        capture = selectWindow(eventFloors.natural, messageId, ECHO_DEFAULTS.before, ECHO_DEFAULTS.after)
        if (capture) {
          floors = eventFloors.natural
        } else {
          // 收藏按钮有时挂在只有工具调用的 assistant 层；落到同一回合最近的回答。
          const fallback = nearestNaturalAnchor(eventFloors.all, messageId)
          if (fallback) {
            capture = selectWindow(eventFloors.natural, fallback.id, ECHO_DEFAULTS.before, ECHO_DEFAULTS.after)
            if (capture) {
              floors = eventFloors.natural
              effectiveAnchorId = fallback.id
            }
          }
        }
      }
      if (!capture) return null
      return {
        floors,
        capture,
        effectiveAnchorId,
        meta: {
          cwd: session.header && session.header.cwd,
          agentPreset: session.header && session.header.agentPreset,
          sessionTitle: sessionTitle(ctx, session),
          requestedAnchorId: messageId,
        },
      }
    }

    async function favoriteEcho(sessionId, messageId) {
      await ensureEchoes()
      const session = sessionForEcho(sessionId)
      if (!session) return { code: 404, error: 'session_not_live' }
      const data = captureFor(session, messageId)
      if (!data) return { code: 404, error: 'message_not_found' }
      const anchorId = data.effectiveAnchorId || messageId
      const now = Date.now()
      const existing = echoStore.echoes.find(function (echo) {
        return (
          echo &&
          echo.sessionId === session.id &&
          Array.isArray(echo.anchors) &&
          echo.anchors.some(function (anchor) {
            return anchor && anchor.messageId === anchorId
          })
        )
      })
      let echo
      let merged = false
      if (existing) {
        echo = mergeCapture(existing, data.capture, ECHO_DEFAULTS.mergeGap, now)
        const index = echoStore.echoes.indexOf(existing)
        if (index >= 0) echoStore.echoes[index] = echo
        merged = true
      } else {
        if (echoStore.echoes.length >= ECHO_CAPACITY) {
          const capacity = echoCapacity()
          return { code: 409, body: { error: 'echo_capacity_reached', capacity, count: capacity.count, limit: capacity.limit } }
        }
        echo = createEcho({
          sessionId: session.id,
          messages: data.floors,
          anchorId: anchorId,
          now: now,
          meta: data.meta,
        })
        if (!echo) return { code: 404, error: 'message_not_found' }
        echoStore.echoes.push(echo)
      }
      await saveEchoes()
      return {
        code: 200,
        body: {
          ok: true,
          echo: echoSummary(echo),
          merged: merged,
          pending: Boolean(echo.pending),
          before: Math.max(0, data.capture.anchorIndex - data.capture.startIndex),
          after: Math.max(0, data.capture.endIndex - data.capture.anchorIndex),
        },
      }
    }

    function advanceEchoes(sessionId) {
      if (!echoReady || !sessionId) return
      enqueueEchoMutation(() => advanceEchoesNow(sessionId)).catch(() => {})
    }

    function advanceEchoesNow(sessionId) {
      const pending = echoStore.echoes.filter(function (echo) {
        return echo && echo.sessionId === sessionId && (echo.pending || echo.pendingAfter > 0)
      })
      if (!pending.length) return
      const session = sessionForEcho(sessionId)
      if (!session) return
      const floors = collectEchoFloors(session)
      let changed = false
      for (const echo of pending) {
        const next = advanceEcho(echo, floors, Date.now(), ECHO_DEFAULTS.mergeGap)
        if (JSON.stringify(next) !== JSON.stringify(echo)) {
          const index = echoStore.echoes.indexOf(echo)
          if (index >= 0) echoStore.echoes[index] = next
          changed = true
        }
      }
      if (changed) scheduleEchoSave()
    }

    async function sessionSearchHandler(req, res) {
      const send = (code, body) => {
        res.writeHead(code, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' })
        res.end(JSON.stringify(body))
      }
      try {
        const url = new URL(req.url ?? SEARCH_PATH, 'http://dsh.invalid')
        const query = String(url.searchParams.get('q') || '').trim().slice(0, 80)
        if (query.length < 2) return send(400, { error: 'query too short' })
        const needle = query.toLowerCase()
        const items = []
        let live = []
        try {
          live = typeof ctx.sessions.list === 'function' ? ctx.sessions.list() : []
        } catch {
          live = []
        }
        for (const session of live) {
          const eventFloors = collectEventFloors(session)
          const floors = eventFloors.natural.length ? eventFloors.natural : collectEchoFloors(session)
          const title = sessionTitle(ctx, session) || ''
          for (let i = 0; i < floors.length; i += 1) {
            const message = floors[i]
            const text = String(message.text || '')
            const at = text.toLowerCase().indexOf(needle)
            if (at < 0) continue
            const start = Math.max(0, at - 45)
            const end = Math.min(text.length, at + needle.length + 75)
            items.push({
              sessionId: session.id,
              sessionTitle: title,
              messageId: message.id,
              turn: message.turn || 0,
              floor: i + 1,
              snippet: (start > 0 ? '…' : '') + text.slice(start, end).replace(/\s+/g, ' ') + (end < text.length ? '…' : ''),
            })
            if (items.length >= 20) break
          }
          if (items.length >= 20) break
        }
        const seen = new Set(items.map(function (item) { return item.sessionId + ':' + item.messageId }))
        if (items.length < 20) {
          let archiveRows = []
          try {
            archiveRows = await ensureArchiveSearchIndex()
          } catch {
            archiveRows = []
          }
          for (const row of archiveRows) {
            if (items.length >= 20) break
            if (seen.has(row.sessionId + ':' + row.messageId)) continue
            const at = row.text.toLowerCase().indexOf(needle)
            if (at < 0) continue
            const start = Math.max(0, at - 45)
            const end = Math.min(row.text.length, at + needle.length + 75)
            items.push({
              sessionId: row.sessionId,
              sessionTitle: row.sessionTitle,
              messageId: row.messageId,
              turn: row.turn,
              floor: row.floor,
              snippet: (start > 0 ? '…' : '') + row.text.slice(start, end).replace(/\s+/g, ' ') + (end < row.text.length ? '…' : ''),
            })
            seen.add(row.sessionId + ':' + row.messageId)
          }
        }
        return send(200, { items: items.slice(0, 20), hasMore: items.length >= 20 })
      } catch (error) {
        return send((error && error.status) || 500, { error: String(error && error.message ? error.message : error) })
      }
    }

    async function echoHandler(req, res) {      const send = (code, body) => {
        res.writeHead(code, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' })
        res.end(JSON.stringify(body))
      }
      try {
        await ensureEchoes()
        const url = new URL(req.url ?? ECHO_PATH, 'http://dsh.invalid')
        if (req.method !== 'GET' && crossSiteWrite(req)) return send(403, { error: 'cross-site request refused' })
        if (req.method === 'GET') {
          await echoMutationQueue
          if (url.searchParams.get('all') === '1') {
            return send(200, { echoes: listAllEchoes(), capacity: echoCapacity() })
          }
          const suggestFor = url.searchParams.get('suggest')
          if (suggestFor) return send(200, { suggestions: echoSuggestions(suggestFor) })
          const sceneId = url.searchParams.get('scene')
          if (sceneId) {
            const echo = findEcho(sceneId)
            if (!echo) return send(404, { error: 'echo_not_found' })
            const scene = await echoScene(echo)
            if (scene.error) return send(scene.code, { error: scene.error })
            return send(200, { scene: scene.scene, source: scene.source })
          }
          const contextId = url.searchParams.get('context')
          if (contextId) {
            const echo = findEcho(contextId)
            if (!echo) return send(404, { error: 'echo_not_found' })
            const session = sessionForEcho(echo.sessionId)
            if (!session) return send(409, { error: 'session_gone' })
            const eventFloors = collectEventFloors(session)
            return send(200, {
              messages: eventFloors.natural.length ? eventFloors.natural : collectEchoFloors(session),
              anchorMessageId: echo.anchors && echo.anchors[0] ? echo.anchors[0].messageId : '',
              sessionTitle: sessionTitle(ctx, session) || echoSessionTitle(echo),
              sessionAlive: true,
            })
          }
          const id = url.searchParams.get('id')
          if (id) {
            const echo = findEcho(id)
            return echo ? send(200, { echo: echo }) : send(404, { error: 'echo_not_found' })
          }
          const sessionId = url.searchParams.get('session')
          if (!sessionId) return send(400, { error: 'session required' })
          return send(200, { echoes: listEchoes(sessionId) })
        }
        if (req.method === 'POST') {
          const body = await readJsonBody(req)
          const sessionId = typeof body.sessionId === 'string' ? body.sessionId : ''
          const messageId = typeof body.messageId === 'string' ? body.messageId : ''
          if (!sessionId || !messageId) return send(400, { error: 'sessionId and messageId required' })
          const result = await echoTransaction(() => favoriteEcho(sessionId, messageId))
          return send(result.code, result.body || { error: result.error })
        }
        if (req.method === 'PATCH') {
          const body = await readJsonBody(req)
          const result = await echoTransaction(async () => {
            const echo = findEcho(body.id)
            if (!echo) return { code: 404, body: { error: 'echo_not_found' } }
            if (typeof body.title === 'string') echo.title = body.title.slice(0, 120)
            if (typeof body.note === 'string') echo.note = body.note.slice(0, 2000)
            if (Array.isArray(body.tags)) echo.tags = body.tags.filter((tag) => typeof tag === 'string').slice(0, 12)
            echo.updatedAt = Date.now()
            await saveEchoes()
            return { code: 200, body: { ok: true, echo: echoSummary(echo) } }
          })
          return send(result.code, result.body)
        }
        if (req.method === 'DELETE') {
          const id = url.searchParams.get('id')
          const result = await echoTransaction(async () => {
            const index = echoStore.echoes.findIndex(function (echo) {
              return echo && echo.id === id && !isGoal(echo)
            })
            if (index < 0) return { code: 404, body: { error: 'echo_not_found' } }
            echoStore.echoes.splice(index, 1)
            await saveEchoes()
            return { code: 200, body: { ok: true } }
          })
          return send(result.code, result.body)
        }
        return send(405, { error: 'method not allowed' })
      } catch (error) {
        return send((error && error.status) || 500, { error: String(error && error.message ? error.message : error) })
      }
    }

    /* ── 目标层：存在 Echo 存储里的 kind:'goal' 记录，按工作区（cwd）分 ───────── */

    /* ── ECHO 现场重建：收藏那一轮的触发、工具链、技能、耗时、模型 ───────────── */

    /**
     * 自动提议收藏：只看打开着的会话（提议是「刚才那一轮值得留」，不翻旧账）。
     * 按 会话 + 事件数 缓存；已收藏的锚点排除。只提议，写入仍走用户点的 POST /echo。
     */
    const suggestCache = new Map()
    function echoSuggestions(sessionId) {
      const session = sessionForEcho(sessionId)
      if (!session || typeof session.snapshotEvents !== 'function') return []
      let events
      try {
        events = Array.from(session.snapshotEvents())
      } catch {
        return []
      }
      const saved = new Set()
      for (const echo of echoStore.echoes) {
        if (!echo || isGoal(echo) || echo.sessionId !== session.id) continue
        for (const anchor of echo.anchors || []) if (anchor && anchor.messageId) saved.add(anchor.messageId)
      }
      const key = session.id + ':' + events.length + ':' + [...saved].sort().join(',')
      const cached = suggestCache.get(session.id)
      if (cached && cached.key === key) return cached.value
      const value = suggestEchoes(events, { clean: cleanEchoText, saved, limit: 10 })
      suggestCache.set(session.id, { key, value })
      if (suggestCache.size > 32) suggestCache.delete(suggestCache.keys().next().value)
      return value
    }

    /** 磁盘日志解析结果按 文件 mtime+size 缓存（最多 16 份），反复打开同一个 Echo 不重复解压。 */
    const sceneDiskCache = new Map()

    async function echoScene(echo) {
      const anchorId = echo.anchors && echo.anchors[0] ? echo.anchors[0].messageId : ''
      if (!anchorId) return { code: 409, error: 'echo_has_no_anchor' }
      const session = sessionForEcho(echo.sessionId)
      if (session && typeof session.snapshotEvents === 'function') {
        let events = []
        try {
          events = Array.from(session.snapshotEvents())
        } catch {
          events = []
        }
        const scene = buildScene(events, anchorId, cleanEchoText)
        // 在线会话可能已经把老事件折叠掉了：找不到就再去磁盘全量日志里找。
        if (scene) return { scene, source: 'live' }
      }
      const file = findSessionOnDisk(SESSION_STORE_DIR, echo.sessionId)
      if (!file) return { code: 409, error: 'session_gone' }
      let info
      try {
        info = await stat(file)
      } catch {
        return { code: 409, error: 'session_gone' }
      }
      const key = file + ':' + info.mtimeMs + ':' + info.size
      let events = sceneDiskCache.get(key)
      if (!events) {
        events = parseEventLines(await decodeSessionLog(await readFile(file), zstdDecompressAsync))
        for (const old of sceneDiskCache.keys()) if (old.startsWith(file + ':')) sceneDiskCache.delete(old)
        sceneDiskCache.set(key, events)
        while (sceneDiskCache.size > 16) sceneDiskCache.delete(sceneDiskCache.keys().next().value)
      }
      const scene = buildScene(events, anchorId, cleanEchoText)
      return scene ? { scene, source: 'disk' } : { code: 404, error: 'scene_not_found' }
    }

    function goalView(cwd) {
      if (!echoReady || echoReadError) return null
      return goalsFor(echoStore.echoes, cwd)
    }

    function goalCwd(sessionId) {
      const session = sessionForEcho(sessionId)
      const cwd = session && session.header && typeof session.header.cwd === 'string' ? session.header.cwd : ''
      return { session, cwd }
    }

    async function goalHandler(req, res) {
      const send = (code, body) => {
        res.writeHead(code, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' })
        res.end(JSON.stringify(body))
      }
      try {
        await ensureEchoes()
        if (req.method !== 'GET' && crossSiteWrite(req)) return send(403, { error: 'cross-site request refused' })
        const url = new URL(req.url ?? GOAL_PATH, 'http://dsh.invalid')
        if (req.method === 'GET') {
          await echoMutationQueue
          const { cwd } = goalCwd(url.searchParams.get('session') || '')
          if (!cwd) return send(404, { error: 'session_not_live' })
          return send(200, { goal: goalView(cwd) })
        }
        if (echoReadError) return send(503, { error: echoReadError })
        if (req.method === 'POST') {
          const body = await readJsonBody(req)
          const sessionId = typeof body.sessionId === 'string' ? body.sessionId : ''
          const { session, cwd } = goalCwd(sessionId)
          if (!session) return send(404, { error: 'session_not_live' })
          if (!cwd) return send(409, { error: 'goal_workspace_unknown' })
          const result = await echoTransaction(async () => {
            let outcome
            if (body.infer === true) {
              // 推断目标不碰 Echo 存储：只在内存里起一次后台调用，结果随快照推给面板。
              return { code: 202, body: { proposal: startGoalInference(session, body.force === true) } }
            }
            if (body.dsh && typeof body.dsh === 'object') {
              // DSH 原生目标完成：只记一条 done 历史，同一个目标只记一次。
              outcome = recordDshGoal(echoStore.echoes, {
                sessionId: session.id,
                cwd,
                dshGoalId: typeof body.dsh.id === 'string' ? body.dsh.id : '',
                title: body.dsh.objective,
                createdAt: Number(body.dsh.createdAt) || undefined,
              })
              if (!outcome.goal) return { code: 200, body: { ok: true, duplicate: true, goal: goalView(cwd) } }
            } else {
              outcome = openGoal(echoStore.echoes, {
                sessionId: session.id,
                cwd,
                title: body.title,
                source: body.source === 'inferred' ? 'inferred' : 'owner',
              })
            }
            if (outcome.records.length > ECHO_CAPACITY) {
              const capacity = echoCapacity()
              return { code: 409, body: { error: 'echo_capacity_reached', capacity, count: capacity.count, limit: capacity.limit } }
            }
            echoStore.echoes = outcome.records
            await saveEchoes()
            return { code: 200, body: { ok: true, goal: goalView(cwd) } }
          })
          if (result.code === 200) {
            await syncIdeasWithGoals() // 新目标会把旧目标顶成 stale：关联的灵感回到待做
            markDirty()
          }
          return send(result.code, result.body)
        }
        if (req.method === 'PATCH') {
          const body = await readJsonBody(req)
          const result = await echoTransaction(async () => {
            const outcome = patchGoal(echoStore.echoes, typeof body.id === 'string' ? body.id : '', {
              title: body.title,
              status: body.status,
              source: body.confirm === true ? 'owner' : undefined,
            })
            echoStore.echoes = outcome.records
            await saveEchoes()
            return { code: 200, body: { ok: true, goal: goalView(outcome.goal.cwd) } }
          })
          await syncIdeasWithGoals() // 目标完成 → 关联灵感完成；重开 → 回到进行中
          markDirty()
          return send(result.code, result.body)
        }
        if (req.method === 'DELETE') {
          const id = url.searchParams.get('id') || ''
          const result = await echoTransaction(async () => {
            const index = echoStore.echoes.findIndex(function (record) {
              return isGoal(record) && record.id === id
            })
            if (index < 0) return { code: 404, body: { error: 'goal_not_found' } }
            const removed = echoStore.echoes[index]
            echoStore.echoes.splice(index, 1)
            await saveEchoes()
            return { code: 200, body: { ok: true, goal: goalView(removed.cwd) } }
          })
          if (result.code === 200) {
            await syncIdeasWithGoals() // 目标被移除：关联的灵感回到待做
            markDirty()
          }
          return send(result.code, result.body)
        }
        return send(405, { error: 'method not allowed' })
      } catch (error) {
        return send((error && error.status) || 500, { error: String(error && (error.code || error.message) || error) })
      }
    }

    /* ── 新技能自动翻译：后台用 DSH 的默认模型补中文名 / 中文说明，只补缺 ───────── */

    /**
     * 走 DSH Host 的 `llm` 服务（和 DSH 自己的上下文压缩、会话标题是同一个入口），
     * 模型取 `agentDefaultModel` 的当前选择。由客户端按设置触发，Host 不会自己跑。
     * 结果经 updateCatalogOverlay 写进覆盖层（带锁、校验、外部编辑检测），手改过的永远优先。
     */
    const TRANSLATE_SCAN_TTL = 60_000
    const TRANSLATE_TIMEOUT = 120_000
    const TRANSLATE_ROUNDS = 5
    const translateState = { running: false, pending: 0, checkedAt: 0, lastAt: 0, lastCount: 0, lastError: '', model: '' }
    let translateScan = null
    let translatePendingRun = null
    const coded = (code, message) => Object.assign(new Error(message || code), { code })
    // catalog.js 收录的条目：技能按名字，工具按 `tool:<名字>`（客户端对它们有精选中文说明）。
    const CURATED_SKILLS = new Set([...SKILLS.map((row) => row[0]), ...TOOLS.map((row) => 'tool:' + row[0])])

    async function readSkillDescriptions() {
      if (translateScan && Date.now() - translateScan.at < TRANSLATE_SCAN_TTL) return translateScan.skills
      const skills = []
      for (const root of [join(homedir(), '.agents', 'skills'), PARKED_DIR]) {
        let entries = []
        try {
          entries = await readdir(root, { withFileTypes: true })
        } catch {
          continue
        }
        for (const entry of entries) {
          if (!entry.isDirectory()) continue
          try {
            const front = parseFrontmatter(await readFile(join(root, entry.name, 'SKILL.md'), 'utf8'))
            skills.push({ name: front.name || entry.name, description: front.description || '' })
          } catch {
            /* 没有 SKILL.md 的目录不是技能 */
          }
        }
      }
      // DSH 插件带来的技能不在 ~/.agents/skills 里，只在技能注册表里（比如 @xiaoso/dsh-workflow-lite）。
      const skillService = get('skills')
      if (skillService && typeof skillService.list === 'function') {
        try {
          const listed = await skillService.list({ signal: new AbortController().signal })
          for (const item of Array.isArray(listed) ? listed : []) {
            if (item && item.name) skills.push({ name: String(item.name), description: String(item.description || item.whenToUse || '') })
          }
        } catch {
          /* 注册表读不到就只用磁盘扫描 */
        }
      }
      // 工具同理：插件注册的工具名（workflow_lite 之类）也补中文名。
      const toolService = get('tools')
      if (toolService && typeof toolService.schemas === 'function') {
        try {
          for (const schema of toolService.schemas() || []) {
            if (schema && schema.name) skills.push({ kind: 'tool', name: String(schema.name), description: String(schema.description || '') })
          }
        } catch {
          /* 读不到就跳过工具 */
        }
      }
      translateScan = { at: Date.now(), skills }
      return skills
    }

    async function translationQueue() {
      const catalog = buildCatalog()
      return pendingTranslations(await readSkillDescriptions(), catalog.names, catalog.descs, CURATED_SKILLS)
    }

    function translateStatus() {
      return { ...translateState }
    }

    /** 待翻译数量：快照里带着，过期了就在后台重算一次（不阻塞推送）。 */
    function refreshTranslatePending(force) {
      if (translatePendingRun) return translatePendingRun
      if (!force && Date.now() - translateState.checkedAt < TRANSLATE_SCAN_TTL) return Promise.resolve()
      translatePendingRun = translationQueue()
        .then((queue) => {
          translateState.checkedAt = Date.now()
          if (queue.length !== translateState.pending) {
            translateState.pending = queue.length
            markDirty()
          }
        })
        .catch(() => {})
        .finally(() => {
          translatePendingRun = null
        })
      return translatePendingRun
    }

    function translateTarget() {
      const llm = get('llm')
      if (!llm || typeof llm.stream !== 'function') throw coded('llm_unavailable')
      const defaults = get('agentDefaultModel')
      const selection = defaults && typeof defaults.currentSelection === 'function' ? defaults.currentSelection() : null
      if (!selection || !selection.provider || !selection.model) throw coded('no_default_model')
      return { llm, provider: selection.provider, model: selection.model }
    }

    function callTranslateModel(target, prompt) {
      return callModel(target, prompt, { purpose: 'pulse-translate', maxTokens: 4096, timeoutMs: TRANSLATE_TIMEOUT, timeoutCode: 'translate_timeout' })
    }

    /** 一次后台模型调用（翻译、推断目标共用），拼出全部 text 块。 */
    async function callModel(target, prompt, options) {
      const controller = new AbortController()
      const timer = setTimeout(() => controller.abort(), options.timeoutMs)
      const blocks = new Map()
      let finish = null
      try {
        const stream = target.llm.stream({
          provider: target.provider,
          model: target.model,
          messages: [{ role: 'user', content: [{ type: 'text', text: prompt }] }],
          maxTokens: options.maxTokens,
          purpose: options.purpose,
          signal: controller.signal,
        })
        for await (const chunk of stream) {
          if (!chunk) continue
          if (chunk.type === 'text-delta') blocks.set(chunk.index, (blocks.get(chunk.index) || '') + String(chunk.text || ''))
          else if (chunk.type === 'block-end' && chunk.block && chunk.block.type === 'text') blocks.set(chunk.index, String(chunk.block.text || ''))
          else if (chunk.type === 'finish') finish = chunk.reason
        }
      } catch (error) {
        throw coded(controller.signal.aborted ? options.timeoutCode || 'model_timeout' : String((error && error.code) || 'llm_failed'), error && error.message)
      } finally {
        clearTimeout(timer)
      }
      if (finish && (finish.kind === 'error' || finish.kind === 'aborted')) {
        throw coded('llm_' + finish.kind, finish.failure && finish.failure.message)
      }
      return [...blocks.keys()].sort((a, b) => a - b).map((key) => blocks.get(key)).join('')
    }

    async function runTranslation() {
      if (translateState.running) return
      translateState.running = true
      translateState.lastError = ''
      markDirty()
      let written = 0
      try {
        const target = translateTarget()
        translateState.model = target.provider + '/' + target.model
        for (let round = 0; round < TRANSLATE_ROUNDS; round += 1) {
          const queue = await translationQueue()
          if (!queue.length) break
          const batch = queue.slice(0, TRANSLATE_BATCH)
          const results = parseTranslations(await callTranslateModel(target, translationPrompt(batch)), batch)
          if (!results.length) throw coded('translate_unparseable')
          const outcome = await updateCatalogOverlay(OVERLAY_PATH, (data) => applyTranslations(data, results, { model: translateState.model }))
          if (outcome && outcome.written) written += results.length
          markDirty()
          // 模型漏了几个就先停：下一轮还会选到同样的条目，不在这里反复花钱。
          if (results.length < batch.length) break
        }
      } catch (error) {
        translateState.lastError = String((error && (error.code || error.message)) || error)
      } finally {
        translateState.running = false
        translateState.lastAt = Date.now()
        translateState.lastCount = written
        translateScan = null
        await refreshTranslatePending(true)
        markDirty()
      }
    }

    /* ── 灵感与分支：开发路上冒出来的方向，按工作区收起来 ─────────────────── */

    /**
     * 存在 $DSH_HOME/running-panel/ideas.json（和 Echo 分开，上限 500 条）。
     * - 收集：一轮结束后面板请求 capture；只看这个会话还没扫过的回合（最多 5 个），
     *   关键词预筛命中才调一次模型提炼，结果按文字去重。
     * - 完成：设为目标的灵感跟着目标走（目标完成 → 灵感完成）；别处顺手做掉的，
     *   由 check 请模型对照最近对话标「可能已完成」，等用户确认。
     * - 回填：把同一工作区的磁盘日志扫一遍（先 estimate 告诉用户要调几次模型）。
     */
    const IDEA_FILE = join(STORE_DIR, 'ideas.json')
    const ideaStore = { version: 1, ideas: [], scanned: {} }
    let ideaReady = false
    let ideaError = ''
    let ideaLoad = null
    let ideaQueue = Promise.resolve()
    const ideaState = new Map() // workspace → { capturing, checking, backfill, lastError, lastAt }
    const IDEA_TIMEOUT = 90_000
    const IDEA_BATCH_CHARS = 6000

    async function loadIdeas() {
      try {
        const data = JSON.parse(await readFile(IDEA_FILE, 'utf8'))
        if (!data || !Array.isArray(data.ideas)) throw new Error('Invalid idea store')
        ideaStore.ideas = data.ideas.filter((idea) => idea && typeof idea.id === 'string')
        ideaStore.scanned = data.scanned && typeof data.scanned === 'object' ? data.scanned : {}
      } catch (error) {
        if (!error || error.code !== 'ENOENT') ideaError = 'Idea store could not be loaded; original file preserved: ' + String(error && error.message || error)
      }
      ideaReady = true
    }
    function ensureIdeas() {
      if (ideaReady) return Promise.resolve()
      if (!ideaLoad) ideaLoad = loadIdeas()
      return ideaLoad
    }
    /** 串行改 + 原子写：action 返回 true 才落盘。 */
    function ideaMutation(action) {
      const pending = ideaQueue.then(async () => {
        await ensureIdeas()
        if (ideaError) throw coded('idea_store_unreadable', ideaError)
        const changed = await action()
        if (!changed) return false
        await mkdir(STORE_DIR, { recursive: true })
        const tmp = IDEA_FILE + '.tmp'
        await writeFile(tmp, JSON.stringify(ideaStore), 'utf8')
        await rename(tmp, IDEA_FILE)
        return true
      })
      ideaQueue = pending.catch(() => {})
      return pending
    }
    function ideaStateFor(workspace) {
      let state = ideaState.get(workspace)
      if (!state) {
        state = { capturing: false, checking: false, backfill: null, lastError: '', lastAt: 0, lastAdded: 0 }
        ideaState.set(workspace, state)
      }
      return state
    }
    function ideasView(cwd) {
      if (!ideaReady) return null
      const view = ideasFor(ideaStore.ideas, cwd)
      const state = ideaStateFor(view.workspace)
      return Object.assign(view, { error: ideaError, state: { capturing: state.capturing, checking: state.checking, backfill: state.backfill, lastError: state.lastError, lastAt: state.lastAt, lastAdded: state.lastAdded } })
    }

    /** 灵感跟着目标走：按每条灵感关联的目标当前状态重算（目标增删改之后调用）。 */
    async function syncIdeasWithGoals() {
      await ideaMutation(() => {
        let changed = false
        for (const idea of ideaStore.ideas.filter((row) => row.goalId)) {
          const goal = echoStore.echoes.find((record) => isGoal(record) && record.id === idea.goalId)
          const status = goal ? goal.status : 'removed'
          const out = syncGoal(ideaStore.ideas, idea.goalId, status)
          if (out.changed) {
            ideaStore.ideas = out.records
            changed = true
          }
        }
        return changed
      }).catch(() => {})
    }

    /** 一批回合 → 一次模型调用 → 新灵感。turns: [{ key, user, assistant, sessionId, messageId, turn, at }] */
    async function extractIdeasFromTurns(cwd, turns, source) {
      if (!turns.length) return []
      const existing = ideasFor(ideaStore.ideas, cwd)
      const known = existing.open.concat(existing.doing, existing.done).map((idea) => idea.text)
      const reply = await callModel(translateTarget(), extractPrompt(turns, known), { purpose: 'pulse-ideas', maxTokens: 3072, timeoutMs: IDEA_TIMEOUT, timeoutCode: 'idea_timeout' })
      const byKey = new Map(turns.map((turn) => [turn.key, turn]))
      return parseIdeas(reply, turns.map((turn) => turn.key)).map((row) => {
        const turn = byKey.get(row.turn) || turns[0]
        return { text: row.text, source: source === 'history' ? 'history' : row.source, sessionId: turn.sessionId, messageId: turn.messageId, turn: turn.turn, at: turn.at }
      })
    }

    /** 这个会话还没扫过的已结束回合（最多 5 个），命中预筛的送去提炼。 */
    async function captureIdeas(session) {
      const cwd = session.header && session.header.cwd
      const workspace = workspaceKey(cwd)
      const state = ideaStateFor(workspace)
      if (!workspace || state.capturing) return
      state.capturing = true
      markDirty()
      try {
        await ensureIdeas()
        const turns = turnsOf(Array.from(session.snapshotEvents()), cleanEchoText)
        const marker = ideaStore.scanned[session.id] || ''
        const from = marker ? turns.findIndex((turn) => turn.messageId === marker) + 1 : Math.max(0, turns.length - 5)
        const fresh = turns.slice(Math.max(from, turns.length - 5))
        if (!fresh.length) return
        const candidates = ideaTurns(fresh).map((turn) => Object.assign({}, turn, { key: 'T' + turn.turn, sessionId: session.id }))
        const items = candidates.length ? await extractIdeasFromTurns(cwd, candidates, 'live') : []
        await ideaMutation(() => {
          ideaStore.scanned[session.id] = fresh[fresh.length - 1].messageId
          const out = addIdeas(ideaStore.ideas, cwd, items)
          ideaStore.ideas = out.records
          state.lastAdded = out.added.length
          return true
        })
        state.lastError = ''
        state.lastAt = Date.now()
      } catch (error) {
        state.lastError = String((error && (error.code || error.message)) || error)
      } finally {
        state.capturing = false
        markDirty()
      }
    }

    /** 请模型对照这个会话最近的对话，把可能已经做掉的待做灵感标出来。 */
    async function checkIdeasDone(session) {
      const cwd = session.header && session.header.cwd
      const workspace = workspaceKey(cwd)
      const state = ideaStateFor(workspace)
      if (!workspace || state.checking) return
      state.checking = true
      markDirty()
      try {
        await ensureIdeas()
        const open = ideasFor(ideaStore.ideas, cwd).open.filter((idea) => !idea.maybeDone).slice(0, 40)
        if (!open.length) return
        const reply = await callModel(translateTarget(), donePrompt(open, collectEventFloors(session).natural), { purpose: 'pulse-ideas', maxTokens: 2048, timeoutMs: IDEA_TIMEOUT, timeoutCode: 'idea_timeout' })
        const hits = parseDone(reply, open.map((idea) => idea.id))
        await ideaMutation(() => {
          const out = markMaybeDone(ideaStore.ideas, hits)
          ideaStore.ideas = out.records
          return out.changed > 0
        })
        state.lastError = ''
      } catch (error) {
        state.lastError = String((error && (error.code || error.message)) || error)
      } finally {
        state.checking = false
        markDirty()
      }
    }

    /** 同一工作区的磁盘日志 → 命中预筛的回合（回填 / 估算共用）。 */
    async function historyIdeaTurns(cwd) {
      const workspace = workspaceKey(cwd)
      const files = []
      await walkSessionLogs(SESSION_STORE_DIR, files)
      const out = []
      let sessions = 0
      for (const file of files) {
        let events
        try {
          events = parseEventLines(await decodeSessionLog(await readFile(file), zstdDecompressAsync))
        } catch {
          continue
        }
        const header = events.find((event) => event.type === 'session')
        if (!header || workspaceKey(header.cwd) !== workspace) continue
        sessions += 1
        const sessionId = String(header.id || '')
        const turns = turnsOf(events, cleanEchoText)
        for (const turn of ideaTurns(turns)) out.push(Object.assign({}, turn, { key: 'S' + out.length, sessionId }))
        if (turns.length) out.lastBySession = Object.assign(out.lastBySession || {}, { [sessionId]: turns[turns.length - 1].messageId })
      }
      out.sessions = sessions
      return out
    }
    function batchTurns(turns) {
      const batches = []
      let current = []
      let size = 0
      for (const turn of turns) {
        const cost = Math.min(600, turn.user.length) + Math.min(2400, turn.assistant.length)
        if (current.length && size + cost > IDEA_BATCH_CHARS) {
          batches.push(current)
          current = []
          size = 0
        }
        current.push(turn)
        size += cost
      }
      if (current.length) batches.push(current)
      return batches
    }

    async function backfillIdeas(cwd) {
      const workspace = workspaceKey(cwd)
      const state = ideaStateFor(workspace)
      if (!workspace || (state.backfill && state.backfill.running)) return
      state.backfill = { running: true, done: 0, total: 0, added: 0, error: '' }
      markDirty()
      try {
        await ensureIdeas()
        const turns = await historyIdeaTurns(cwd)
        const batches = batchTurns(turns)
        state.backfill.total = batches.length
        markDirty()
        for (const batch of batches) {
          const items = await extractIdeasFromTurns(cwd, batch, 'history')
          await ideaMutation(() => {
            const out = addIdeas(ideaStore.ideas, cwd, items)
            ideaStore.ideas = out.records
            state.backfill.added += out.added.length
            return out.added.length > 0
          })
          state.backfill.done += 1
          markDirty()
        }
        // 回填过的会话记下扫描位置：之后的实时收集不再重复这些回合。
        await ideaMutation(() => {
          Object.assign(ideaStore.scanned, turns.lastBySession || {})
          return true
        })
      } catch (error) {
        state.backfill.error = String((error && (error.code || error.message)) || error)
      } finally {
        state.backfill.running = false
        markDirty()
      }
    }

    async function ideaHandler(req, res) {
      const send = (code, body) => {
        res.writeHead(code, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' })
        res.end(JSON.stringify(body))
      }
      try {
        await ensureIdeas()
        await ensureEchoes()
        const url = new URL(req.url ?? IDEA_PATH, 'http://dsh.invalid')
        if (req.method !== 'GET' && crossSiteWrite(req)) return send(403, { error: 'cross-site request refused' })
        if (req.method === 'GET') {
          const { cwd } = goalCwd(url.searchParams.get('session') || '')
          if (!cwd) return send(404, { error: 'session_not_live' })
          if (url.searchParams.get('estimate') === '1') {
            const turns = await historyIdeaTurns(cwd)
            return send(200, { sessions: turns.sessions || 0, turns: turns.length, calls: batchTurns(turns).length })
          }
          return send(200, { ideas: ideasView(cwd) })
        }
        if (req.method === 'POST') {
          const body = await readJsonBody(req)
          const { session, cwd } = goalCwd(typeof body.sessionId === 'string' ? body.sessionId : '')
          if (!session) return send(404, { error: 'session_not_live' })
          if (!cwd) return send(409, { error: 'goal_workspace_unknown' })
          if (body.capture === true) {
            if (typeof session.snapshotEvents === 'function') captureIdeas(session).catch(() => {})
            return send(202, { ideas: ideasView(cwd) })
          }
          if (body.check === true) {
            checkIdeasDone(session).catch(() => {})
            return send(202, { ideas: ideasView(cwd) })
          }
          if (body.backfill === true) {
            backfillIdeas(cwd).catch(() => {})
            return send(202, { ideas: ideasView(cwd) })
          }
          if (typeof body.text === 'string') {
            await ideaMutation(() => {
              const out = addIdeas(ideaStore.ideas, cwd, [{ text: body.text, source: 'manual', sessionId: session.id }])
              ideaStore.ideas = out.records
              return out.added.length > 0
            })
            markDirty()
            return send(200, { ideas: ideasView(cwd) })
          }
          if (typeof body.goalFrom === 'string') {
            // 把一条灵感设为当前目标：目标写进 Echo 存储，灵感标「进行中」并关联目标。
            const idea = ideaStore.ideas.find((row) => row.id === body.goalFrom)
            if (!idea) return send(404, { error: 'idea_not_found' })
            const goal = await echoTransaction(async () => {
              const outcome = openGoal(echoStore.echoes, { sessionId: session.id, cwd, title: idea.text, source: 'owner' })
              if (outcome.records.length > ECHO_CAPACITY) throw coded('echo_capacity_reached')
              echoStore.echoes = outcome.records
              await saveEchoes()
              return outcome.goal
            })
            await ideaMutation(() => {
              const out = patchIdea(ideaStore.ideas, idea.id, { status: 'doing', goalId: goal.id })
              ideaStore.ideas = out.records
              return true
            })
            await syncIdeasWithGoals()
            markDirty()
            return send(200, { ideas: ideasView(cwd), goal: goalView(cwd) })
          }
          return send(400, { error: 'unknown idea action' })
        }
        if (req.method === 'PATCH') {
          const body = await readJsonBody(req)
          let cwd = ''
          await ideaMutation(() => {
            const out = patchIdea(ideaStore.ideas, typeof body.id === 'string' ? body.id : '', { status: body.status, dismissMaybe: body.dismissMaybe === true, text: body.text })
            ideaStore.ideas = out.records
            cwd = out.idea.cwd
            return true
          })
          markDirty()
          return send(200, { ideas: ideasView(cwd) })
        }
        return send(405, { error: 'method not allowed' })
      } catch (error) {
        const status = (error && error.status) || (error && error.code === 'echo_capacity_reached' ? 409 : 500)
        return send(status, { error: String(error && (error.code || error.message) || error) })
      }
    }

    /* ── 用模型推断目标（提议） ─────────────────────────────────────────── */

    const GOAL_INFER_TIMEOUT = 60_000
    /** sessionId → { status: running|ready|none|error, title, round, at, error } */
    const goalProposals = new Map()

    /**
     * 起一次推断：同一会话在跑就不重复；上次结果离现在不到 INFER_EVERY_ROUNDS 轮就复用（force 除外）。
     * 返回当前状态，结果出来后 markDirty() 推给面板。
     */
    function startGoalInference(session, force) {
      const id = session.id
      const round = (states.get(id) && states.get(id).round) || 0
      const previous = goalProposals.get(id)
      if (previous && previous.status === 'running') return previous
      if (previous && !force && previous.status !== 'error' && round < previous.round + INFER_EVERY_ROUNDS) return previous
      const state = { status: 'running', title: '', round, at: Date.now(), error: '' }
      goalProposals.set(id, state)
      if (goalProposals.size > 64) goalProposals.delete(goalProposals.keys().next().value)
      markDirty()
      ;(async () => {
        try {
          const prompt = inferPrompt(collectEventFloors(session).natural)
          if (!prompt) {
            state.status = 'none'
            return
          }
          const title = parseInferred(await callModel(translateTarget(), prompt, { purpose: 'pulse-goal', maxTokens: 2048, timeoutMs: GOAL_INFER_TIMEOUT, timeoutCode: 'infer_timeout' }))
          state.title = title
          state.status = title ? 'ready' : 'none'
        } catch (error) {
          state.status = 'error'
          state.error = String((error && (error.code || error.message)) || error)
        } finally {
          state.at = Date.now()
          markDirty()
        }
      })()
      return state
    }

    async function translateHandler(req, res) {
      const send = (code, body) => {
        res.writeHead(code, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' })
        res.end(JSON.stringify(body))
      }
      try {
        if (req.method === 'GET') {
          await refreshTranslatePending(true)
          return send(200, translateStatus())
        }
        if (req.method === 'POST') {
          if (crossSiteWrite(req)) return send(403, { error: 'cross-site request refused' })
          await readJsonBody(req)
          if (!translateState.running) runTranslation().catch(() => {})
          return send(202, translateStatus())
        }
        return send(405, { error: 'method not allowed' })
      } catch (error) {
        return send((error && error.status) || 500, { error: String(error && error.message ? error.message : error) })
      }
    }


    /** 落盘用的总计：已落盘的基线 + 本次运行新增（不重复累加）。 */
    /** 被清理的会话：本次运行的增量并进跨会话累计，单会话计数留一份精简记录供落盘。 */
    function foldIntoLifetime(state) {
      const add = (key, n, at, ms) => {
        if (!n) return
        const row = lifetime.totals[key] || { n: 0, at: 0, ms: 0 }
        lifetime.totals[key] = { n: row.n + n, at: Math.max(row.at || 0, at || 0), ms: (row.ms || 0) + (ms || 0) }
      }
      const tools = { ...(state.history && state.history.tools) }
      const skills = { ...(state.history && state.history.skills) }
      for (const [name, record] of Object.entries(state.tools)) {
        add('tool:' + name, record.total, record.at, record.totalMs)
        if (record.total + (record.base || 0)) tools[name] = record.total + (record.base || 0)
      }
      for (const [name, record] of Object.entries(state.skills)) {
        add('skill:' + name, record.total, record.at, record.workMs)
        if (record.total + (record.base || 0)) skills[name] = record.total + (record.base || 0)
      }
      const id = [...states.entries()].find(([, value]) => value === state)
      if (id) retiredSessions.set(id[0], { tools, skills, lastAt: Math.max(state.lastSeen || 0, state.spentAt || 0) })
    }

    function totalsForWrite() {
      const totals = Object.assign({}, lifetime.totals)
      const add = function (key, n, at, ms) {
        if (!n) return
        const row = totals[key] || { n: 0, at: 0, ms: 0 }
        totals[key] = { n: row.n + n, at: Math.max(row.at, at || 0), ms: (row.ms || 0) + (ms || 0) }
      }
      for (const state of states.values()) {
        for (const [name, record] of Object.entries(state.tools)) {
          add('tool:' + name, record.total, record.at, record.totalMs)
        }
        for (const [name, record] of Object.entries(state.skills)) {
          // 技能自身的加载耗时很短；工时占比用「加载后工具耗时」的归因值。
          add('skill:' + name, record.total, record.at, record.workMs)
        }
      }
      return totals
    }

    function saveStore() {
      const pending = usageWriteQueue.then(writeUsageStore)
      usageWriteQueue = pending
      return pending
    }

    async function writeUsageStore() {
      if (!storeReady) return false
      try {
        const totals = totalsForWrite()
        const rows = []
        for (const [id, state] of states) {
          const tools = { ...(state.history && state.history.tools) }
          const skills = { ...(state.history && state.history.skills) }
          for (const [name, record] of Object.entries(state.tools)) {
            const n = record.total + (record.base || 0)
            if (n) tools[name] = n
          }
          for (const [name, record] of Object.entries(state.skills)) {
            const n = record.total + (record.base || 0)
            if (n) skills[name] = n
          }
          if (Object.keys(tools).length || Object.keys(skills).length) {
            rows.push({ id: id, tools: tools, skills: skills, lastAt: state.lastSeen || state.spentAt || (state.history && state.history.lastAt) || 0 })
          }
        }
        for (const [id, row] of retiredSessions) {
          if (!states.has(id)) rows.push({ id: id, tools: row.tools, skills: row.skills, lastAt: row.lastAt })
        }
        // 只保留最近 40 个会话，避免文件无限长大。
        rows.sort(function (a, b) {
          return b.lastAt - a.lastAt
        })
        const sessions = {}
        for (const row of rows.slice(0, 40)) sessions[row.id] = { tools: row.tools, skills: row.skills, lastAt: row.lastAt }
        const payload = {
          version: 1,
          since: lifetime.since,
          updatedAt: Date.now(),
          totals: Object.keys(totals)
            .map(function (k) {
              return { k: k, n: totals[k].n, at: totals[k].at, ms: totals[k].ms || 0 }
            })
            .sort(function (a, b) {
              return b.n - a.n
            })
            .slice(0, 400),
          sessions: sessions,
        }
        await mkdir(STORE_DIR, { recursive: true })
        const tmp = STORE_FILE + '.tmp'
        await writeFile(tmp, JSON.stringify(payload), 'utf8')
        await rename(tmp, STORE_FILE)
        storeError = ''
        return true
      } catch (error) {
        storeError = 'Usage history has not been saved: ' + String(error && error.message || error)
        return false
      }
    }

  /* ── 全局快照：整个 DSH 里被观测到的任务 ──────────────────────────── */

  /** “正在运行”区里的条目：技能与工具混排，顺序按进入时间，稳定不跳。 */
  function pinnedEntries(state) {
    if (!state) return []
    const out = []
    for (const [name, record] of Object.entries(state.skills)) {
      if (!record.pinnedAt) continue
      out.push({ kind: 'skill', name, group: 'skill', state: recordShape(record) })
    }
    for (const [name, record] of Object.entries(state.tools)) {
      if (!record.pinnedAt) continue
      out.push({ kind: 'tool', name, group: classifyTool(name, ''), state: recordShape(record) })
    }
    out.sort((a, b) => a.state.pinnedAt - b.state.pinnedAt)
    return out
  }

  function observedThisRun(state) {
    if (!state) return false
    if (state.running || state.round > 0 || state.lastSeen || state.phase !== 'idle') return true
    return Object.values(state.tools).some((record) => record.total > 0) ||
      Object.values(state.skills).some((record) => record.total > 0)
  }

  function callsOf(state) {
    if (!state) return []
    return Object.entries(state.tools)
      .map(([name, record]) => ({
        name,
        count: record.round,
        total: record.total + (record.base || 0),
        at: record.at,
        error: Boolean(record.error),
        ms: record.lastMs || 0,
        totalMs: record.totalMs || 0,
      }))
      .sort((a, b) => b.at - a.at)
  }

  /**
   * 全局视图：所有被观测到的会话（根会话 + 它们挂着的子代理），
   * 「正在运行」按 agent/status / turn 事件判定，其余进「最近结束」。
   * 只读内存态 + 会话 store，不轮询。
   */
  async function buildGlobalSnapshot() {
    const sessions = get('sessions')
    if (sessions && typeof sessions.list === 'function') {
      try {
        for (const live of sessions.list()) rememberTitle(live.id, live)
      } catch {
        /* store 不可枚举时只靠事件里缓存过的标题 */
      }
    }

    const roots = []
    for (const [id, state] of states) {
      // loadStore 会为落盘历史里的 40 个会话建空 state；它们本次运行没有任何活动，
      // 不该在全局视图里冒出成排的「未命名会话」。
      if (!observedThisRun(state)) continue
      const session = sessionFor(id)
      const run = runs.get(id)
      const parentId =
        (session && session.header && session.header.parentSession) || (run && run.parentId) || ''
      if (parentId) continue
      const calls = callsOf(state)
      const lastAt = calls.reduce((max, call) => Math.max(max, call.at || 0), state.spentAt || 0)
      roots.push({
        id,
        title: state.title || '',
        running: Boolean(state.running),
        phase: state.phase,
        round: state.round,
        spentAt: state.spentAt,
        lastAt,
        calls,
        alerts: alertsFor(state),
        active: calls.filter((call) => call.count > 0),
        tokens: {
          input: state.inputTokens || 0,
          output: state.outputTokens || 0,
          roundInput: state.roundInputTokens || 0,
          roundOutput: state.roundOutputTokens || 0,
        },
        children: collectChildren(id).map((child) => ({
          id: child.id,
          label: child.label,
          phase: child.phase,
          startedAt: child.startedAt,
          endedAt: child.endedAt,
          stopReason: child.stopReason,
          calls: child.tools,
        })),
      })
    }

    const weight = (row) => (row.running ? 2 : row.phase === 'active' ? 1 : 0)
    roots.sort((a, b) => weight(b) - weight(a) || b.lastAt - a.lastAt)

    const running = roots.filter((row) => row.running || row.phase === 'active' || row.children.some((child) => child.phase === 'active'))
    const recent = roots.filter((row) => !running.includes(row))

    const skills = Boolean(get('sessionSkillCatalog') || get('skills'))
    const tools = Boolean(get('tools'))

    return {
      version: 1,
      pluginVersion: PLUGIN_VERSION,
      time: Date.now(),
      mode: 'global',
      storage: storageStatus(),
      ...await undoSnapshot(),
      summary: {
        running: running.length,
        observed: roots.length,
        recent: recent.length,
      },
      running,
      recent: recent.slice(0, 8),
      observability: { skills, tools, agents: Boolean(get('subagents')) },
      notes: [
        '全局视图只列出本插件启动后观测到过活动的会话；Harness 重启前发生的事不会被追溯。',
        '「正在运行」来自 `agent/status` 与 `turn/start` / `turn/end`，不是定时扫出来的。',
        '子代理是带 parentSession 的子会话，挂在它所属的会话下面。',
        '技能 / 工具清单属于单个会话，在右侧栏（当前会话）里看。',
      ],
    }
  }

  /* ── 推送 ───────────────────────────────────────────────────────────── */

  function write(client, payload) {
    try {
      client.res.write('data: ' + JSON.stringify(payload) + '\n\n')
    } catch {
      clients.delete(client)
    }
  }

  /**
   * 内存态只增不减会让长时间运行的 Host 慢慢变胖：超过 6 小时没有活动、也不在内存会话 store 里的
   * 会话状态与子代理记录清掉（累计次数已落盘，不会丢）。最多每 10 分钟检查一次。
   */
  const PRUNE_IDLE_MS = 6 * 60 * 60 * 1000
  let lastPrune = Date.now()
  function pruneMemory(now) {
    if (now - lastPrune < 10 * 60 * 1000) return
    lastPrune = now
    for (const [id, run] of runs) {
      if (run.endedAt && now - run.endedAt > PRUNE_IDLE_MS) runs.delete(id)
    }
    for (const [id, state] of states) {
      if (state.running || runs.has(id)) continue
      const last = Math.max(state.lastSeen || 0, state.spentAt || 0)
      if (!last || now - last < PRUNE_IDLE_MS) continue
      if (sessionFor(id)) continue
      // 先把这段运行期的增量并进基线，再删：保证 usage.json 的累计不回退。
      foldIntoLifetime(state)
      states.delete(id)
    }
  }

  function markDirty() {
    pruneMemory(Date.now())
    scheduleSave()
    if (flushTimer) return
    flushTimer = setTimeout(flush, COALESCE_MS)
  }

  async function flush() {
    flushTimer = null
    for (const client of Array.from(clients)) {
      try {
        write(client, await snapshotFor(client))
      } catch {
        /* 单个客户端失败不影响其他面板 */
      }
    }
  }

  /** 一个订阅端的快照：`scope=global`（左侧总览）或某个会话（右侧当前会话）。 */
  function snapshotFor(client) {
    return client.scope === 'global' ? buildGlobalSnapshot() : buildSnapshot(client.sessionId)
  }

  function streamHandler(req, res) {
    const url = new URL(req.url || STREAM_PATH, 'http://127.0.0.1')
    const sessionId = url.searchParams.get('session') || ''
    const scope = url.searchParams.get('scope') === 'global' ? 'global' : 'session'
    res.writeHead(200, {
      'content-type': 'text/event-stream; charset=utf-8',
      'cache-control': 'no-store, no-cache, must-revalidate',
      connection: 'keep-alive',
      'x-accel-buffering': 'no',
    })
    res.write(': running-panel\n\n')
    const client = { res, sessionId, scope }
    clients.add(client)
    snapshotFor(client)
      .then((snapshot) => write(client, snapshot))
      .catch(() => {})
    // 仅用于避免代理/内核回收空闲连接；负载是注释行，不读任何会话状态。
    const heartbeat = setInterval(() => {
      try {
        res.write(': keepalive\n\n')
      } catch {
        /* 连接已断，close 会清理 */
      }
    }, HEARTBEAT_MS)
    res.on('close', () => {
      clearInterval(heartbeat)
      clients.delete(client)
    })
    res.on('error', () => {
      clearInterval(heartbeat)
      clients.delete(client)
    })
  }

  /** 停用/启用：park = 移出技能目录，restore = 移回。只动 ~/.agents 下的两个目录。 */
  const PLAN_TTL_MS = 15 * 60 * 1000
  /** 预览可以过期；已执行的移动记录保留到撤销完成，不受新预览影响。 */
  const pendingPlans = new Map()
  let parkingQueue = Promise.resolve()

  function serializeParking(operation) {
    const result = parkingQueue.then(operation)
    parkingQueue = result.catch(() => {})
    return result
  }
  /**
   * 预算方案：算 → 给人看 → 确认才动文件。
   * 旧版 `/optimize` 直接按「没调用过 + 字符多」乱停，已经不做了。
   */
  async function optimizeHandler(req, res) {
    const send = (code, body) => {
      res.writeHead(code, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' })
      res.end(JSON.stringify(body))
    }
    if (req.method !== 'POST') return send(405, { error: 'POST only' })
    if (crossSiteWrite(req)) return send(403, { error: 'cross-site request refused' })
    try {
      const body = await readJsonBody(req)
      if (body.dryRun === true) {
        const plan = await buildBudgetPlan(body.sessionId, body)
        for (const [id, pending] of pendingPlans) {
          if (Date.now() - pending.at > PLAN_TTL_MS) pendingPlans.delete(id)
        }
        pendingPlans.set(plan.id, plan)
        return send(200, plan)
      }
      if (typeof body.planId === 'string' && body.planId) {
        return await serializeParking(async () => {
          const mode = body.undo === true ? 'undo' : 'apply'
          const applied = await undoStore.getPlan(body.planId)
          const plan = applied || (mode === 'apply' ? pendingPlans.get(body.planId) : null)
          if (!plan || (!applied && Date.now() - plan.at > PLAN_TTL_MS)) {
            return send(409, { error: 'plan-expired' })
          }
          return applyBudgetPlan(plan, mode, send, body.park)
        })
      }
      return send(400, { error: 'dryRun or planId required' })
    } catch (error) {
      send((error && error.status) || 500, { error: String(error && error.message ? error.message : error) })
    }
  }

  /**
   * 预算方案：只算不写盘。核心集 = 钉住的技能 ∪ 钉住的库 ∪ 近 7 天用过的。
   * 其余按「最久没用 + 字符最多」排序，停到软目标以内。
   */
  /**
   * 其它打开着的会话「正在用」的技能：skill name → [{ sessionId, title }]。
   * 正在用 = 还在「正在运行」区（最近 4 轮内调用过），或 2 小时内调用过。
   * 停用会把目录挪走：那些会话下一轮就调不到它，已经读进上下文的技能说明还在，
   * 但它引用的脚本 / 模板 / 文档路径会失效——所以停用前要先看这里。
   */
  const IN_USE_WINDOW = 2 * 60 * 60 * 1000
  function skillsInUse(excludeSessionId) {
    const out = new Map()
    const now = Date.now()
    for (const [id, state] of states) {
      if (!id || id === excludeSessionId || !state || !state.skills) continue
      const session = sessionFor(id)
      if (!session) continue
      for (const [name, record] of Object.entries(state.skills)) {
        if (!record || !(record.pinnedAt || record.round > 0 || (record.at && now - record.at <= IN_USE_WINDOW))) continue
        const list = out.get(name) || []
        list.push({ sessionId: id, title: deriveTitle(state, session) || id })
        out.set(name, list)
      }
    }
    return out
  }

  async function buildBudgetPlan(sessionId, options) {
    const session = sessionFor(sessionId)
    const modelSkills = (await modelSkillCatalog(session)) || []
    // 自动方案连当前会话一起算：任何打开着的会话正在用的技能都保留。
    const inUse = skillsInUse('')
    const catalog = buildCatalog()
    const totals = totalsForWrite()
    const now = Date.now()
    const week = 7 * 24 * 60 * 60 * 1000
    const pins = options && options.pins && typeof options.pins === 'object' ? options.pins : {}
    const pinnedSkills = new Set(Array.isArray(pins.skills) ? pins.skills : [])
    const pinnedLibs = new Set(Array.isArray(pins.libs) ? pins.libs : [])
    const limitTokens = Math.min(200000, Math.max(500, Math.round(Number(options && options.limitTokens) || 3000)))
    const limitChars = limitTokens * 4
    const coldChars = coldPromptText().length

    const libOf = (name) => catalog.libOf['skill:' + name] || 'user'
    const liveSkillsDir = join(homedir(), '.agents', 'skills')
    const rows = modelSkills.map((item) => {
      const name = String(item.name || '')
      const usage = totals['skill:' + name] || { n: 0, at: 0 }
      const lib = libOf(name)
      const pinned = pinnedSkills.has(name)
      const libPinned = pinnedLibs.has(lib)
      const recent = Number(usage.at) > 0 && now - Number(usage.at) <= week
      const usedBy = inUse.get(name) || []
      return {
        name: name,
        lib: lib,
        chars: catalogLineChars(item),
        used: usage.n || 0,
        lastUsed: usage.at || 0,
        core: pinned || libPinned || recent || usedBy.length > 0,
        why: usedBy.length ? 'inUse' : pinned ? 'pinned' : libPinned ? 'library' : recent ? 'recent' : 'idle',
        inUse: usedBy,
        /** 只有 ~/.agents/skills 里的目录能搬；内置/预设技能不在这个范围。 */
        movable: existsSync(join(liveSkillsDir, userSkillDirectory(name) || name)),
      }
    })

    const beforeChars = rows.reduce((sum, row) => sum + row.chars, 0) + coldChars
    const keep = rows.filter((row) => row.core)
    const candidates = rows
      .filter((row) => !row.core && row.movable)
      .sort((a, b) => a.lastUsed - b.lastUsed || b.chars - a.chars)

    let afterChars = beforeChars
    const park = []
    if (afterChars > limitChars) {
      for (const row of candidates) {
        if (afterChars <= limitChars) break
        park.push(row)
        // 进冷层后仍留一行索引：name + cue，cue 取 18 字符
        const coldCharsRow = row.name.length + 22
        afterChars += coldCharsRow - row.chars
      }
    }

    return {
      id: 'plan-' + now.toString(36) + '-' + Math.random().toString(36).slice(2, 8),
      at: now,
      dryRun: true,
      limitTokens: limitTokens,
      limitChars: limitChars,
      before: { chars: beforeChars, tokens: Math.round(beforeChars / 4), skills: rows.length },
      after: { chars: Math.max(coldChars, afterChars), tokens: Math.round(Math.max(coldChars, afterChars) / 4) },
      keep: keep.map(planRow),
      park: park.map(planRow),
      cold: { count: coldList.length, chars: coldChars },
      withinBudget: beforeChars <= limitChars,
    }
  }

  function planRow(row) {
    return {
      name: row.name,
      lib: row.lib,
      chars: row.chars,
      used: row.used,
      lastUsed: row.lastUsed,
      why: row.why,
      movable: row.movable === true,
      days: row.lastUsed ? Math.max(0, Math.round((Date.now() - row.lastUsed) / 86400000)) : -1,
      // 别的打开着的会话正在用：方案里显示是谁（标题），不带会话正文。
      inUse: Array.isArray(row.inUse) ? row.inUse.map((s) => ({ sessionId: s.sessionId, title: s.title })) : [],
    }
  }

  /** 普通启停和预算撤销共享写前日志、目录身份检查及跨进程锁。 */
  const moveSkillDirectory = (directoryName, action, options) =>
    undoStore.move(directoryName, action, options).finally(invalidateUndoSnapshot)

  /** 旧客户端用显示名；新客户端用扫描得到的目录标识。歧义不能猜。 */
  function restoreDirectoryName(name, explicitDirectory) {
    if (explicitDirectory) {
      return validDirectoryName(name) ? { directoryName: name } : { error: 'bad name' }
    }
    if (typeof name !== 'string' || !name) return { error: 'bad name' }
    const matches = coldList.filter((row) => row.name === name || row.directoryName === name)
    if (matches.length > 1) return { error: 'ambiguous-name' }
    const directoryName = matches.length ? matches[0].directoryName : name
    return validDirectoryName(directoryName) ? { directoryName } : { error: 'bad name' }
  }

  /** 应用 / 撤销：只动 ~/.agents 下两个目录，逐条返回结果。 */
  async function applyBudgetPlan(plan, mode, send, selected) {
    // 撤销只还原真正搬动过的那批；应用可以用调用方选定的清单覆盖方案默认值。
    const picked =
      mode === 'apply' && Array.isArray(selected)
        ? selected.filter((name) => typeof name === 'string' && name)
        : null
    const source = mode === 'undo'
      ? (plan.applied || [])
      : picked !== null ? picked : (plan.park || []).map((row) => row.name)
    const names = [...new Set(source.map((row) => (typeof row === 'string' ? row : row.name)))]
    const action = mode === 'undo' ? 'restore' : 'park'
    const results = []
    for (const name of names) {
      // 方案里是技能名；应用时换成真实目录名（撤销清单本来就是目录名）。
      const directoryName = mode === 'undo' ? name : userSkillDirectory(name) || name
      results.push({ name, ...await moveSkillDirectory(directoryName, action, mode === 'undo' ? { undoPlanId: plan.id } : { plan }) })
    }
    await scanColdSkills()
    markDirty()
    const moved = results.filter((row) => row.ok && !row.skipped).map((row) => row.name)
    if (mode === 'apply' && moved.length) pendingPlans.delete(plan.id)
    const failed = results.filter((row) => !row.ok)
    send(200, {
      ok: failed.length === 0,
      action: action,
      planId: plan.id,
      moved: moved.length,
      movedNames: moved,
      failed: failed.map((row) => row.name),
      results,
      cold: coldList.length,
    })
  }

  /* ── 技能配置：按工作类型保存启用的技能组合，切换时生成可撤销的方案 ───── */

  /**
   * 存在 running-panel/skill-profiles.json：{ version, profiles, lastSwitch }。
   * 切换 = 停用一批 + 恢复一批。停用走预算方案同一套写前日志（可撤销、校验目录身份）；
   * 恢复的那批记在 lastSwitch.restored，撤销切换时先按日志恢复被停用的，再把它们重新停用。
   */
  const PROFILE_FILE = join(STORE_DIR, 'skill-profiles.json')
  const profileStore = { version: 1, profiles: [], lastSwitch: null }
  let profileLoaded = false
  let profileError = ''
  let profileQueue = Promise.resolve()
  const pendingSwitches = new Map()

  async function loadProfiles() {
    if (profileLoaded) return
    try {
      const data = JSON.parse(await readFile(PROFILE_FILE, 'utf8'))
      if (!data || !Array.isArray(data.profiles)) throw new Error('Invalid profile store')
      profileStore.profiles = data.profiles.filter((p) => p && typeof p.id === 'string' && Array.isArray(p.skills))
      profileStore.lastSwitch = data.lastSwitch || null
    } catch (error) {
      if (!error || error.code !== 'ENOENT') profileError = 'Profile store could not be loaded; original file preserved: ' + String(error && error.message || error)
    }
    profileLoaded = true
  }
  function profileMutation(action) {
    const pending = profileQueue.then(async () => {
      await loadProfiles()
      if (profileError) throw Object.assign(new Error(profileError), { code: 'profile_store_unreadable', status: 503 })
      const changed = await action()
      if (changed === false) return
      await mkdir(STORE_DIR, { recursive: true })
      const tmp = PROFILE_FILE + '.tmp'
      await writeFile(tmp, JSON.stringify(profileStore, null, 2), 'utf8')
      await rename(tmp, PROFILE_FILE)
    })
    profileQueue = pending.catch(() => {})
    return pending
  }
  async function liveSkillState() {
    await scanUserSkills()
    await scanColdSkills()
    const liveRoot = join(homedir(), '.agents', 'skills')
    // 隐藏目录（.third-party-licenses 之类）不是技能，配置切换和装配都不碰它。
    const live = [...userSkillNames()].filter((name) => !String(name).startsWith('.'))
    const movable = new Set(live.filter((name) => existsSync(join(liveRoot, userSkillDirectory(name) || name))))
    return { live, cold: coldList.map((row) => ({ name: row.name, directoryName: row.directoryName })), movable }
  }
  async function profilesView() {
    await loadProfiles()
    const { live } = await liveSkillState()
    return {
      profiles: profileStore.profiles.map((p) => ({ id: p.id, name: p.name, skills: p.skills, libs: p.libs || [], count: p.skills.length, updatedAt: p.updatedAt })),
      active: activeProfile(profileStore.profiles, live),
      lastSwitch: profileStore.lastSwitch,
      liveCount: live.length,
      error: profileError,
    }
  }

  /**
   * 装配窗口的数据：每个自装技能（启用 / 冷层）的占用、类别、使用、最近用在哪、常和谁一起用、
   * 是否被别的会话占用；内置技能（搬不动）合成一段；当前模型的上下文窗口；技能配置。
   */
  function usageSessionRows() {
    const rows = []
    for (const [id, state] of states) {
      const skills = { ...(state.history && state.history.skills) }
      for (const [name, record] of Object.entries(state.skills)) {
        const n = record.total + (record.base || 0)
        if (n) skills[name] = n
      }
      if (Object.keys(skills).length) rows.push({ id, skills, lastAt: state.lastSeen || state.spentAt || (state.history && state.history.lastAt) || 0, title: deriveTitle(state, sessionFor(id)) })
    }
    for (const [id, row] of retiredSessions) {
      if (!states.has(id) && row.skills && Object.keys(row.skills).length) rows.push({ id, skills: row.skills, lastAt: row.lastAt || 0, title: '' })
    }
    return rows.sort((a, b) => b.lastAt - a.lastAt).slice(0, 40)
  }

  async function loadoutHandler(req, res) {
    const send = (code, body) => {
      res.writeHead(code, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' })
      res.end(JSON.stringify(body))
    }
    try {
      if (req.method !== 'GET') return send(405, { error: 'GET only' })
      const url = new URL(req.url || LOADOUT_PATH, 'http://127.0.0.1')
      const sessionId = url.searchParams.get('session') || ''
      const session = sessionFor(sessionId)
      const state = await liveSkillState()
      const catalog = buildCatalog()
      const totals = totalsForWrite()
      const described = new Map()
      for (const row of await readSkillDescriptions()) if (row && row.kind !== 'tool' && !described.has(row.name)) described.set(row.name, row.description || '')
      const rows = usageSessionRows()
      const titles = new Map()
      for (const row of rows) if (!row.title) titles.set(row.id, await archiveTitle(String(row.id)).catch(() => ''))
      const inUse = skillsInUse(sessionId)
      const coldByName = new Map(state.cold.map((row) => [row.name, row.directoryName]))
      // 隐藏目录（.third-party-licenses 之类）不是技能。
      const names = [...new Set([...state.live, ...state.cold.map((row) => row.name)])].filter((name) => !String(name).startsWith('.'))
      // 体积按模型实际收到的目录行算（和侧栏公告预算同一口径）；不在目录里的（冷层）才按 SKILL.md 描述估。
      const modelCatalog = (await modelSkillCatalog(session)) || []
      const catalogByName = new Map(modelCatalog.filter(Boolean).map((item) => [String(item.name || ''), item]))
      const skills = names.map((name) => {
        const key = 'skill:' + name
        const description = String(described.get(name) || '')
        const tag = catalog.tagOf[key] || 'other'
        const usage = totals[key] || { n: 0, at: 0 }
        const recent = rows.filter((row) => row.skills[name]).slice(0, 3).map((row) => ({ sessionId: row.id, title: row.title || titles.get(row.id) || '', at: row.lastAt }))
        const together = new Map()
        for (const row of rows) {
          if (!row.skills[name]) continue
          for (const other of Object.keys(row.skills)) if (other !== name) together.set(other, (together.get(other) || 0) + 1)
        }
        return {
          name,
          live: state.live.includes(name),
          directoryName: coldByName.get(name) || userSkillDirectory(name) || name,
          movable: state.movable.has(name) || coldByName.has(name),
          tokens: Math.max(1, Math.round(catalogLineChars(catalogByName.get(name) || { name, description }) / 4)),
          tag,
          group: TAG_GROUP[tag] || 'ops',
          lib: catalog.libOf[key] || 'user',
          uses: usage.n || 0,
          lastAt: usage.at || 0,
          description: description.slice(0, 400),
          recent,
          together: [...together.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3).map((pair) => pair[0]),
          inUse: inUse.get(name) || [],
        }
      })
      // 内置 / 预设技能：在模型目录里、但不是自装的，搬不动，合成一段算进预算。
      const userSet = new Set(names)
      const builtin = modelCatalog.filter((item) => item && !userSet.has(String(item.name || '')))
      let contextWindow = 0
      const meter = get('tokenMeter')
      if (session && meter && typeof meter.contextPressure === 'function') {
        try {
          const pressure = meter.contextPressure(session)
          if (pressure && Number.isFinite(pressure.contextWindow)) contextWindow = pressure.contextWindow
        } catch {
          contextWindow = 0
        }
      }
      return send(200, {
        skills,
        builtin: { count: builtin.length, tokens: Math.round(builtin.reduce((sum, item) => sum + catalogLineChars(item), 0) / 4) },
        contextWindow,
        profiles: await profilesView(),
      })
    } catch (error) {
      return send((error && error.status) || 500, { error: String(error && (error.code || error.message) || error) })
    }
  }

  async function profilesHandler(req, res) {
    const send = (code, body) => {
      res.writeHead(code, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' })
      res.end(JSON.stringify(body))
    }
    try {
      if (req.method === 'GET') return send(200, await profilesView())
      if (crossSiteWrite(req)) return send(403, { error: 'cross-site request refused' })
      const url = new URL(req.url || PROFILES_PATH, 'http://127.0.0.1')
      if (req.method === 'DELETE') {
        await profileMutation(() => {
          profileStore.profiles = removeProfile(profileStore.profiles, url.searchParams.get('id') || '')
        })
        return send(200, await profilesView())
      }
      const body = await readJsonBody(req)
      if (req.method === 'PATCH') {
        const skills = body.overwrite === true ? [...(await liveSkillState()).live] : undefined
        await profileMutation(() => {
          profileStore.profiles = updateProfile(profileStore.profiles, typeof body.id === 'string' ? body.id : '', { name: body.name, skills, libs: body.overwrite === true ? body.libs : undefined }).profiles
        })
        return send(200, await profilesView())
      }
      if (req.method !== 'POST') return send(405, { error: 'method not allowed' })
      if (typeof body.name === 'string') {
        // 保存当前配置：此刻启用着的自装技能 + 面板里钉住的库。
        // 装配窗口传来手拼的清单就存它；否则存此刻启用着的。
        const skills = Array.isArray(body.skills) ? body.skills.filter((v) => typeof v === 'string') : (await liveSkillState()).live
        await profileMutation(() => {
          profileStore.profiles = saveProfile(profileStore.profiles, { name: body.name, skills, libs: body.libs }).profiles
        })
        return send(200, await profilesView())
      }
      if (Array.isArray(body.previewSkills)) {
        // 装配窗口里手拼的组合：没装上的都停用（别的会话在用的除外），装上但在冷层的恢复。
        await loadProfiles()
        const state = await liveSkillState()
        const plan = loadoutPlan(body.previewSkills.filter((v) => typeof v === 'string'), state.live, state.cold, skillsInUse(typeof body.sessionId === 'string' ? body.sessionId : ''), state.movable, typeof body.label === 'string' ? body.label.slice(0, 40) : '')
        const id = 'switch-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 7)
        pendingSwitches.set(id, Object.assign({ id, at: Date.now() }, plan))
        return send(200, Object.assign({ switchId: id }, plan))
      }
      if (typeof body.preview === 'string') {
        await loadProfiles()
        const state = await liveSkillState()
        const plan = switchPlan(profileStore.profiles, body.preview, state.live, state.cold, skillsInUse(typeof body.sessionId === 'string' ? body.sessionId : ''), state.movable)
        const id = 'switch-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 7)
        pendingSwitches.set(id, Object.assign({ id, at: Date.now() }, plan))
        for (const [key, row] of pendingSwitches) if (Date.now() - row.at > PLAN_TTL_MS) pendingSwitches.delete(key)
        return send(200, Object.assign({ switchId: id }, plan))
      }
      if (typeof body.apply === 'string') {
        const pending = pendingSwitches.get(body.apply)
        if (!pending) return send(409, { error: 'plan-expired' })
        return await serializeParking(async () => {
          pendingSwitches.delete(body.apply)
          // 停用这批挂在一个预算方案日志上：撤销时按目录身份逐个恢复。
          // 结构和预算方案一致（撤销日志会校验 keep / park；「撤销上次停用」对话框会读 before / after）。
          const plan = {
            id: 'plan-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 8),
            at: Date.now(),
            dryRun: false,
            kind: 'profile',
            profileId: pending.profileId,
            profileName: pending.profileName,
            limitTokens: 0,
            limitChars: 0,
            before: { chars: 0, tokens: 0, skills: pending.park.length },
            after: { chars: 0, tokens: 0 },
            keep: [],
            park: pending.park.map((name) => ({ name, lib: '', chars: 0, used: 0, lastUsed: 0, why: 'profile', movable: true, days: -1, inUse: [] })),
          }
          const parked = []
          const restored = []
          const failed = []
          for (const name of pending.park) {
            const result = await moveSkillDirectory(userSkillDirectory(name) || name, 'park', { plan })
            if (result.ok) parked.push(name)
            else failed.push({ name, action: 'park', error: result.error })
          }
          for (const row of pending.restore) {
            const result = await moveSkillDirectory(row.directoryName, 'restore')
            if (result.ok) restored.push(row.directoryName)
            else failed.push({ name: row.name, action: 'restore', error: result.error })
          }
          await scanColdSkills()
          await scanUserSkills()
          markDirty()
          await profileMutation(() => {
            profileStore.lastSwitch = { planId: parked.length ? plan.id : '', profileId: pending.profileId, profileName: pending.profileName, parked, restored, at: Date.now() }
          })
          return send(200, { ok: failed.length === 0, parked, restored, failed, libs: pending.libs || [], view: await profilesView() })
        })
      }
      if (body.undo === true) {
        await loadProfiles()
        const last = profileStore.lastSwitch
        if (!last) return send(409, { error: 'nothing-to-undo' })
        return await serializeParking(async () => {
          const failed = []
          // 先把恢复出来的那批放回冷层（释放目录名），再按日志把被停用的恢复。
          for (const directoryName of last.restored || []) {
            const result = await moveSkillDirectory(directoryName, 'park')
            if (!result.ok) failed.push({ name: directoryName, action: 'park', error: result.error })
          }
          if (last.planId) {
            const recorded = await undoStore.getPlan(last.planId)
            for (const directoryName of (recorded && recorded.applied) || []) {
              const result = await moveSkillDirectory(directoryName, 'restore', { undoPlanId: last.planId })
              if (!result.ok) failed.push({ name: directoryName, action: 'restore', error: result.error })
            }
          }
          await scanColdSkills()
          await scanUserSkills()
          markDirty()
          await profileMutation(() => {
            profileStore.lastSwitch = null
          })
          return send(200, { ok: failed.length === 0, failed, view: await profilesView() })
        })
      }
      return send(400, { error: 'unknown profile action' })
    } catch (error) {
      return send((error && error.status) || 500, { error: String(error && (error.code || error.message) || error) })
    }
  }

  async function parkHandler(req, res) {
    const send = (code, body) => {
      res.writeHead(code, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' })
      res.end(JSON.stringify(body))
    }
    if (req.method !== 'POST') return send(405, { error: 'POST only' })
    if (crossSiteWrite(req)) return send(403, { error: 'cross-site request refused' })
    try {
      const body = await readJsonBody(req)
      const action = body.action === 'park' ? 'park' : body.action === 'restore' ? 'restore' : ''
      if (!action) return send(400, { error: 'bad request' })
      return await serializeParking(async () => {
        if (action === 'restore') await scanColdSkills()
        const explicitMany = Array.isArray(body.directoryNames)
        const batch = explicitMany || Array.isArray(body.names)
        const explicitDirectory = batch ? explicitMany : typeof body.directoryName === 'string'
        const names = batch
          ? (explicitMany ? body.directoryNames : body.names)
          : [explicitDirectory ? body.directoryName : body.name]
        if (!names.length || names.length > 200) return send(400, { error: 'bad request' })
        // 停用前检查别的打开着的会话：正在用就先拒绝，告诉面板是哪些会话；用户确认后带 force 再来。
        const inUse = action === 'park' && body.force !== true ? skillsInUse(typeof body.sessionId === 'string' ? body.sessionId : '') : new Map()
        const skillNameOf = (name) => {
          if (!explicitDirectory) return name
          for (const [skill, directory] of userSkillDirs) if (directory === name) return skill
          return name
        }
        const results = []
        for (const name of names) {
          const busyIn = inUse.get(skillNameOf(name))
          if (busyIn && busyIn.length) {
            results.push({ name, ok: false, error: 'in-use', sessions: busyIn })
            continue
          }
          const parkDirectory = explicitDirectory || typeof name !== 'string' ? name : userSkillDirectory(name) || name
          const resolved = action === 'restore'
            ? restoreDirectoryName(name, explicitDirectory)
            : validDirectoryName(parkDirectory) ? { directoryName: parkDirectory } : { error: 'bad name' }
          if (resolved.error) {
            results.push({ name, ok: false, error: resolved.error })
          } else {
            results.push({ name, directoryName: resolved.directoryName, ...await moveSkillDirectory(resolved.directoryName, action) })
          }
        }
        await scanColdSkills()
        markDirty()
        const failed = results.filter((row) => !row.ok)
        if (batch) {
          return send(200, {
            ok: failed.length === 0,
            action,
            results,
            restored: results.filter((row) => row.ok).length,
            failed: failed.map((row) => row.name),
            cold: coldList.length,
          })
        }
        const result = results[0]
        const code = result.ok ? 200 : result.error === 'missing' ? 404
          : result.error === 'bad name' ? 400
          : result.error === 'destination-conflict' || result.error === 'ambiguous-name' || result.error === 'in-use' ? 409 : 500
        return send(code, { ...result, action, cold: coldList.length })
      })
    } catch (error) {
      send((error && error.status) || 500, { error: String(error && error.message ? error.message : error) })
    }
  }
  function studioHandler(req, res) {
    if (!STUDIO_HTML) {
      res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8', 'cache-control': 'no-store' })
      res.end('contour studio is not bundled')
      return
    }
    res.writeHead(200, {
      'content-type': 'text/html; charset=utf-8',
      'cache-control': 'no-store',
      'content-length': Buffer.byteLength(STUDIO_HTML),
    })
    res.end(STUDIO_HTML)
  }

  function contourModuleHandler(req, res) {
    if (!CONTOUR_MODULE_JS) {
      res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8', 'cache-control': 'no-store' })
      res.end('contour field module is not bundled')
      return
    }
    res.writeHead(200, {
      'content-type': 'text/javascript; charset=utf-8',
      'cache-control': 'no-store',
      'content-length': Buffer.byteLength(CONTOUR_MODULE_JS),
    })
    res.end(CONTOUR_MODULE_JS)
  }

  function snapshotHandler(req, res) {
    const url = new URL(req.url || SNAPSHOT_PATH, 'http://127.0.0.1')
    const sessionId = url.searchParams.get('session') || ''
    const pending =
      url.searchParams.get('scope') === 'global'
        ? buildGlobalSnapshot()
        : url.searchParams.get('view') === 'corner'
          ? buildCornerSnapshot(sessionId)
          : buildSnapshot(sessionId)
    pending
      .then((snapshot) => {
        res.writeHead(200, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' })
        res.end(JSON.stringify(snapshot))
      })
      .catch((error) => {
        res.writeHead(500, { 'content-type': 'application/json; charset=utf-8' })
        res.end(JSON.stringify({ error: String(error && error.message ? error.message : error) }))
      })
  }


  scanColdSkills()
  scanUserSkills()
  scanPacks()
  const promptService = get('systemPrompt')
  if (promptService && typeof promptService.section === 'function') {
    ctx.effect(
      () =>
        promptService.section({
          name: 'pulse:cold-skills',
          order: 985,
          text: () => coldPromptText(),
        }),
      'dsh-running-panel: cold skills hint',
    )
  }
  // 打开本地技能目录（只允许固定根目录，不接受客户端传路径）。
  function revealHandler(req, res) {
    const send = (code, body) => {
      res.writeHead(code, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' })
      res.end(JSON.stringify(body))
    }
    const done = () => {
      res.writeHead(204, { 'cache-control': 'no-store' })
      res.end()
    }
    // 有副作用（拉起文件管理器）的接口只收 POST：GET 能被 <img>/预取从任意网页触发。
    if (req.method !== 'POST') return send(405, { ok: false, error: 'POST only' })
    if (crossSiteWrite(req)) return send(403, { ok: false, error: 'cross-site request refused' })
    ;(async () => {
      try {
        const body = await readJsonBody(req)
        const liveRoot = join(homedir(), '.agents', 'skills')
        // 不带 kind（旧客户端 / 「打开技能目录」按钮）= 打开技能根目录。
        if (body.kind === undefined || body.kind === 'root') {
          openInFileManager(liveRoot, false)
          return done()
        }
        const name = typeof body.name === 'string' ? body.name.trim() : ''
        if (body.kind !== 'skill' || !name || name.length > 200) {
          return send(400, { ok: false, error: 'bad request' })
        }
        // 技能名先换成目录名（frontmatter name 可以和目录名不同），冷层同理；
        // 最终只接受单段目录名，挡掉路径穿越。
        const cold = coldList.find((row) => row.name === name || row.directoryName === name)
        const candidates = [userSkillDirectory(name), cold && cold.directoryName, name].filter(validDirectoryName)
        let dir = ''
        for (const directoryName of candidates) {
          const live = join(liveRoot, directoryName)
          const parked = join(PARKED_DIR, directoryName)
          dir = existsSync(live) ? live : existsSync(parked) ? parked : ''
          if (dir) break
        }
        if (!dir) return send(404, { ok: false, error: 'not found' })
        if (body.file === true) {
          const skillFile = join(dir, 'SKILL.md')
          if (!existsSync(skillFile)) return send(404, { ok: false, error: 'no skill file' })
          openInFileManager(skillFile, true)
        } else {
          openInFileManager(dir, false)
        }
        return done()
      } catch (error) {
        return send((error && error.status) || 500, { ok: false, error: String((error && error.message) || error) })
      }
    })()
  }

  /** 重命名 / 改描述：写进用户覆盖层的 names|descs[kind:name][locale]。 */
  async function nameHandler(req, res) {
    const send = (code, body) => {
      res.writeHead(code, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' })
      res.end(JSON.stringify(body))
    }
    if (req.method !== 'POST') return send(405, { error: 'POST only' })
    if (crossSiteWrite(req)) return send(403, { error: 'cross-site request refused' })
    try {
      const body = await readJsonBody(req)
      // lib = 安装包 / 来源库的组名（右键改名）。
      const kind = body.kind === 'skill' || body.kind === 'tool' || body.kind === 'lib' ? body.kind : ''
      const name = typeof body.name === 'string' ? body.name.trim() : ''
      const field = body.field === 'desc' ? 'desc' : 'name'
      const text = typeof body.text === 'string' ? body.text.trim() : typeof body.zh === 'string' ? body.zh.trim() : ''
      // 英文界面改名要写 en，否则重载后名字又变回去；旧客户端不传 locale 时仍写 zh。
      const locale = body.locale === 'en' ? 'en' : 'zh'
      const limit = field === 'desc' ? 400 : 60
      if (!kind || !name || name.length > 200 || !text || text.length > limit) return send(400, { error: 'bad request' })
      const key = kind + ':' + name
      const section = field === 'desc' ? 'descs' : 'names'
      const result = await updateCatalogOverlay(catalogOverlayPath(), (data) => {
        const rows = Object.assign({}, data[section] || {})
        rows[key] = Object.assign({}, rows[key] || {}, { [locale]: text })
        const next = Object.assign({}, data, { version: 1 })
        next[section] = rows
        return next
      })
      return send(200, { ok: true, key: key, field: field, locale: locale, text: text, written: Boolean(result && result.written) })
    } catch (error) {
      send((error && error.status) || 500, { ok: false, error: String((error && error.message) || error) })
    }
  }

  // 每个路由先过宿主准入（见 admitRequest）。connection 服务在宿主异步初始化之后才出现，所以按请求读取，不在挂载时缓存。
  let warnedNoConnection = false
  const admitted = (handler) => (req, res) => {
    let connection
    try {
      connection = ctx.get('connection')
    } catch {
      connection = undefined
    }
    if (!connection && !warnedNoConnection) {
      warnedNoConnection = true
      console.warn('[running-panel] host connection service unavailable; only loopback requests are admitted')
    }
    const status = admitRequest(connection, req)
    if (status) {
      res.writeHead(status, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' })
      res.end(JSON.stringify({ ok: false, error: status === 401 ? 'DSH login required' : 'forbidden' }))
      return
    }
    return handler(req, res)
  }

  // 异步载入；载入失败时保留原文件并通过快照报告。
  loadStore()
  ensureEchoes()
  ensureIdeas()
  ctx.effect(() =>
    ctx.webServer.register({ kind: 'exact', path: PROFILES_PATH, handler: admitted(profilesHandler) }),
  )
  ctx.effect(() =>
    ctx.webServer.register({ kind: 'exact', path: LOADOUT_PATH, handler: admitted(loadoutHandler) }),
  )
  ctx.effect(() =>
    ctx.webServer.register({ kind: 'exact', path: IDEA_PATH, handler: admitted(ideaHandler) }),
  )

  ctx.effect(() =>
    ctx.webServer.register({ kind: 'exact', path: STREAM_PATH, handler: admitted(streamHandler) }),
  )
  ctx.effect(() =>
    ctx.webServer.register({ kind: 'exact', path: SNAPSHOT_PATH, handler: admitted(snapshotHandler) }),
  )
  ctx.effect(() =>
    ctx.webServer.register({ kind: 'exact', path: '/dsh-running-panel/park', handler: admitted(parkHandler) }),
  )
  ctx.effect(() =>
    ctx.webServer.register({ kind: 'exact', path: '/dsh-running-panel/reveal', handler: admitted(revealHandler) }),
  )
  ctx.effect(() =>
    ctx.webServer.register({ kind: 'exact', path: '/dsh-running-panel/name', handler: admitted(nameHandler) }),
  )
  ctx.effect(() =>
    ctx.webServer.register({ kind: 'exact', path: ECHO_PATH, handler: admitted(echoHandler) }),
  )
  ctx.effect(() =>
    ctx.webServer.register({ kind: 'exact', path: GOAL_PATH, handler: admitted(goalHandler) }),
  )
  ctx.effect(() =>
    ctx.webServer.register({ kind: 'exact', path: TRANSLATE_PATH, handler: admitted(translateHandler) }),
  )
  ctx.effect(() =>
    ctx.webServer.register({ kind: 'exact', path: SEARCH_PATH, handler: admitted(sessionSearchHandler) }),
  )
  ctx.effect(() =>
    ctx.webServer.register({ kind: 'exact', path: '/dsh-running-panel/optimize', handler: admitted(optimizeHandler) }),
  )
  ctx.effect(() =>
    ctx.webServer.register({ kind: 'exact', path: STUDIO_PATH, handler: admitted(studioHandler) }),
  )
  ctx.effect(() =>
    ctx.webServer.register({ kind: 'exact', path: CONTOUR_MODULE_PATH, handler: admitted(contourModuleHandler) }),
  )

  // 显示名 / tag 词典：客户端启动时取一次，注册进 locale 服务。
  ctx.effect(() =>
    ctx.webServer.register({
      kind: 'exact',
      path: CATALOG_PATH,
      handler: admitted((req, res) => {
        res.writeHead(200, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' })
        res.end(JSON.stringify(buildCatalog()))
      }),
    }),
  )
  ctx.effect(() => () => {
    saveStore()
    if (echoReady && !echoReadError) enqueueEchoMutation(() => saveEchoes()).catch(() => {})
    if (saveTimer) clearTimeout(saveTimer)
    if (echoSaveTimer) clearTimeout(echoSaveTimer)
    if (flushTimer) clearTimeout(flushTimer)
    flushTimer = null
    for (const client of Array.from(clients)) {
      try {
        client.res.end()
      } catch {
        /* 已断开 */
      }
    }
    clients.clear()
  })
}
