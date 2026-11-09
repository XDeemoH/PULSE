/**
 * 历史常用：从落盘累计里挑出“用户自己装的技能”的前几名。
 *
 * 规则（和面板口径一致）：
 * - 只算 `skill:` 键，按调用次数降序；
 * - 提供 `userSkills` 集合时只保留其中技能，空集合返回空结果；
 * - `share` 的分母是过滤后的技能次数总和；
 * - `timeShare` 的分母是全部工具耗时——技能耗时本身是工具耗时的一部分，混进来会重复计；
 * - 最多 `limit` 条（默认 6）。
 */
export function historyTop(totals, options = {}) {
  if (!totals || typeof totals !== 'object') return []
  const userSkills = options.userSkills
  const limit = Number.isInteger(options.limit) && options.limit > 0 ? options.limit : 6
  const filterByUser = userSkills && typeof userSkills.has === 'function'

  const rows = []
  let toolMs = 0
  for (const [key, value] of Object.entries(totals)) {
    const count = Math.max(0, Number(value && value.n) || 0)
    const ms = Math.max(0, Number(value && value.ms) || 0)
    if (key.startsWith('tool:')) {
      toolMs += ms
      continue
    }
    if (!key.startsWith('skill:')) continue
    const name = key.slice(6)
    if (!name) continue
    if (filterByUser && !userSkills.has(name)) continue
    rows.push({ key: key, name: name, n: count, ms: ms })
  }

  const countSum = rows.reduce((sum, row) => sum + row.n, 0)
  rows.sort(function (a, b) {
    return b.n - a.n || b.ms - a.ms || (a.name < b.name ? -1 : a.name > b.name ? 1 : 0)
  })
  return rows.slice(0, limit).map(function (row) {
    return {
      key: row.key,
      name: row.name,
      n: row.n,
      ms: row.ms,
      share: countSum ? Math.round((row.n / countSum) * 100) : 0,
      /* null = 没有工具耗时可当分母（未测得）；0 = 测到了但不到 1%。 */
      timeShare: toolMs ? Math.round((row.ms / toolMs) * 100) : null,
    }
  })
}
