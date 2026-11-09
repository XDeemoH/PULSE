/**
 * 技能配置：按工作类型保存「哪些自装技能启用着」，一键切换。
 * 纯逻辑，Host 与测试共用；真正搬目录走 Host 的可撤销停用 / 恢复。
 *
 * 一份配置：{ id, name, skills: [技能名], libs: [钉住的库], createdAt, updatedAt }
 *
 * 切换规则（switchPlan）：
 * - 停用：启用着、且被某份配置认识（出现在任何一份配置里）、但不在目标配置里的技能
 * - 恢复：在目标配置里、但现在在冷层的技能
 * - 保留·新装：启用着、但不在任何配置里的技能（装了之后还没归档到配置，不动它）
 * - 保留·在用：本该停用、但别的打开着的会话正在用（不动，标出是谁）
 * - 找不到：目标配置里有、但既不启用也不在冷层（被卸载了）
 */

export const PROFILE_NAME_MAX = 40
export const PROFILE_LIMIT = 30

function cleanName(raw) {
  const name = String(raw == null ? '' : raw).replace(/\s+/g, ' ').trim()
  const chars = Array.from(name)
  return chars.length > PROFILE_NAME_MAX ? chars.slice(0, PROFILE_NAME_MAX).join('') : name
}

function invalid(code, status = 400) {
  const error = new Error(code)
  error.code = code
  error.status = status
  throw error
}

const uniqueSorted = (list) => [...new Set((Array.isArray(list) ? list : []).filter((v) => typeof v === 'string' && v))].sort()

export function saveProfile(profiles, input, now = Date.now()) {
  const list = Array.isArray(profiles) ? profiles : []
  const name = cleanName(input && input.name)
  if (!name) invalid('profile_name_empty')
  if (list.some((p) => p.name === name)) invalid('profile_name_taken', 409)
  if (list.length >= PROFILE_LIMIT) invalid('profile_limit', 409)
  const profile = {
    id: 'profile-' + Number(now).toString(36) + '-' + Math.random().toString(36).slice(2, 7),
    name,
    skills: uniqueSorted(input.skills),
    libs: uniqueSorted(input.libs),
    createdAt: now,
    updatedAt: now,
  }
  return { profiles: list.concat([profile]), profile }
}

export function updateProfile(profiles, id, patch, now = Date.now()) {
  const list = Array.isArray(profiles) ? profiles : []
  const index = list.findIndex((p) => p.id === id)
  if (index < 0) invalid('profile_not_found', 404)
  const next = Object.assign({}, list[index], { updatedAt: now })
  if (patch && patch.name !== undefined) {
    const name = cleanName(patch.name)
    if (!name) invalid('profile_name_empty')
    if (list.some((p, i) => i !== index && p.name === name)) invalid('profile_name_taken', 409)
    next.name = name
  }
  if (patch && Array.isArray(patch.skills)) next.skills = uniqueSorted(patch.skills)
  if (patch && Array.isArray(patch.libs)) next.libs = uniqueSorted(patch.libs)
  return { profiles: list.map((p, i) => (i === index ? next : p)), profile: next }
}

export function removeProfile(profiles, id) {
  const list = Array.isArray(profiles) ? profiles : []
  if (!list.some((p) => p.id === id)) invalid('profile_not_found', 404)
  return list.filter((p) => p.id !== id)
}

/**
 * live: 启用着的自装技能名；cold: [{ name, directoryName }] 冷层；
 * inUse: Map(name → [{ sessionId, title }])（别的会话正在用）；movable: Set(可以搬的技能名)
 */
export function switchPlan(profiles, profileId, live, cold, inUse, movable) {
  const list = Array.isArray(profiles) ? profiles : []
  const profile = list.find((p) => p.id === profileId)
  if (!profile) invalid('profile_not_found', 404)
  const target = new Set(profile.skills)
  const known = new Set(list.flatMap((p) => p.skills))
  const liveSet = new Set(Array.isArray(live) ? live : [])
  const coldRows = Array.isArray(cold) ? cold : []
  const coldNames = new Set(coldRows.map((row) => row.name))
  const busy = inUse instanceof Map ? inUse : new Map()
  const canMove = movable instanceof Set ? movable : new Set(liveSet)
  const park = []
  const keepInUse = []
  const keepNew = []
  for (const name of [...liveSet].sort()) {
    if (target.has(name)) continue
    if (!known.has(name)) {
      keepNew.push(name)
      continue
    }
    if (busy.has(name)) {
      keepInUse.push({ name, sessions: busy.get(name) })
      continue
    }
    if (canMove.has(name)) park.push(name)
  }
  const restore = coldRows.filter((row) => target.has(row.name)).map((row) => ({ name: row.name, directoryName: row.directoryName }))
  const missing = [...target].filter((name) => !liveSet.has(name) && !coldNames.has(name)).sort()
  return { profileId: profile.id, profileName: profile.name, libs: profile.libs, park, restore, keepNew, keepInUse, missing }
}

/**
 * 装配窗口里手拼的组合（不必存成配置）：target 就是「要启用的全部自装技能」。
 * 用户在窗口里看得到每一个技能，所以没装上的就是要停用的（新装的也一样）；
 * 别的会话正在用的仍然保留，标出是谁。
 */
export function loadoutPlan(target, live, cold, inUse, movable, name = '') {
  const want = new Set(Array.isArray(target) ? target : [])
  const liveSet = new Set(Array.isArray(live) ? live : [])
  const coldRows = Array.isArray(cold) ? cold : []
  const coldNames = new Set(coldRows.map((row) => row.name))
  const busy = inUse instanceof Map ? inUse : new Map()
  const canMove = movable instanceof Set ? movable : new Set(liveSet)
  const park = []
  const keepInUse = []
  for (const skill of [...liveSet].sort()) {
    if (want.has(skill)) continue
    if (busy.has(skill)) {
      keepInUse.push({ name: skill, sessions: busy.get(skill) })
      continue
    }
    if (canMove.has(skill)) park.push(skill)
  }
  const restore = coldRows.filter((row) => want.has(row.name)).map((row) => ({ name: row.name, directoryName: row.directoryName }))
  const missing = [...want].filter((skill) => !liveSet.has(skill) && !coldNames.has(skill)).sort()
  return { profileId: '', profileName: String(name || ''), libs: [], park, restore, keepNew: [], keepInUse, missing }
}

/** 哪份配置和现在启用的技能完全一致（只看被配置认识的技能）；没有返回 ''。 */
export function activeProfile(profiles, live) {
  const list = Array.isArray(profiles) ? profiles : []
  const known = new Set(list.flatMap((p) => p.skills))
  const current = [...new Set(Array.isArray(live) ? live : [])].filter((name) => known.has(name)).sort().join('\n')
  const hit = list.find((p) => [...p.skills].sort().join('\n') === current)
  return hit ? hit.id : ''
}

export default { PROFILE_NAME_MAX, PROFILE_LIMIT, saveProfile, updateProfile, removeProfile, switchPlan, loadoutPlan, activeProfile }
