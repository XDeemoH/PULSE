#!/usr/bin/env node
/**
 * 扫 `~/.agents/skills`（含 skills-parked）下的 SKILL.md，找出 catalog.js 和
 * 覆盖层里都没有的能力，打印一份可以直接粘的 JSON。
 *
 *   node tools/catalog-sync.mjs           只报告
 *   node tools/catalog-sync.mjs --write   把 en 侧先写进覆盖层（zh 留空，等翻译）
 *
 * 覆盖层：`$DSH_HOME/running-panel/catalog-overlay.json`（默认 ~/.dsh）
 * 形状见 README「Localization」，Host 的 /catalog 会把它合并进 names / descs。
 */
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'
import { SKILLS } from '../catalog.js'
import { catalogOverlayPath, readCatalogOverlay, updateCatalogOverlay } from '../catalog-overlay.js'

const OVERLAY = catalogOverlayPath()
const ROOTS = [
  join(homedir(), '.agents', 'skills'),
  join(homedir(), '.agents', 'skills-parked'),
]

/** 只认 SKILL.md 顶部 `---` 里那一小段；正文怎么长都不影响。 */
function frontmatter(text) {
  const match = String(text).match(/^---\r?\n([\s\S]*?)\r?\n---/)
  const out = {}
  if (!match) return out
  for (const line of match[1].split(/\r?\n/)) {
    const pair = line.match(/^([A-Za-z_][\w-]*):\s*(.*)$/)
    if (!pair) continue
    out[pair[1]] = pair[2].replace(/^["']|["']$/g, '').trim()
  }
  return out
}

function firstSentence(text, limit = 72) {
  const value = String(text || '').replace(/\s+/g, ' ').trim()
  if (!value) return ''
  const first = value.split(/[。.!?；;]/)[0] || value
  return first.length > limit ? first.slice(0, limit - 1) + '…' : first
}

function scanSkills() {
  const found = []
  for (const root of ROOTS) {
    let dirs = []
    try {
      dirs = readdirSync(root, { withFileTypes: true })
    } catch {
      continue
    }
    for (const entry of dirs) {
      if (!entry.isDirectory()) continue
      const file = join(root, entry.name, 'SKILL.md')
      if (!existsSync(file)) continue
      const meta = frontmatter(readFileSync(file, 'utf8'))
      found.push({
        id: entry.name,
        name: meta.name || entry.name,
        description: firstSentence(meta.description || ''),
      })
    }
  }
  return found
}

function seedOverlay(overlay, skills) {
  const known = new Set(SKILLS.map((row) => row[0]))
  const covered = new Set(
    Object.keys(overlay.names || {})
      .filter((key) => key.startsWith('skill:'))
      .map((key) => key.slice('skill:'.length)),
  )
  const missing = skills.filter((item) => !known.has(item.id) && !covered.has(item.id))
  if (!missing.length) {
    console.log('catalog-sync: nothing missing')
    return null
  }
  const patch = { names: {}, descs: {} }
  for (const item of missing) {
    const key = 'skill:' + item.id
    patch.names[key] = { en: item.name, ...overlay.names?.[key] }
    if (item.description) patch.descs[key] = { en: item.description, ...overlay.descs?.[key] }
    console.log(`missing  ${item.id}`)
    console.log(`         en: ${item.name}`)
    console.log(`         desc: ${item.description || '(no description)'}`)
  }
  overlay.names = Object.assign({}, overlay.names, patch.names)
  overlay.descs = Object.assign({}, overlay.descs, patch.descs)
  return overlay
}

async function main() {
  const skills = scanSkills()
  if (!process.argv.includes('--write')) {
    if (seedOverlay(readCatalogOverlay(OVERLAY).data, skills)) {
      console.log('\nrun with --write to seed the English side into the overlay, then fill "zh".')
    }
    return
  }
  const result = await updateCatalogOverlay(OVERLAY, (overlay, exists) => seedOverlay(exists ? overlay : { version: 1 }, skills))
  if (result.written) {
    console.log(`\nwrote overlay to ${OVERLAY}`)
    console.log('fill each "zh" next to "en"; empty strings are ignored by the host.')
  }
}

main().catch(error => {
  console.error('catalog-sync: ' + String(error && error.message || error))
  process.exitCode = 1
})
