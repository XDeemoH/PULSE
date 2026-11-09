import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { frontmatterName, groupSkillPacks, parseRepoUrl, scanSkillDirs } from '../packs.js'

test('parseRepoUrl understands https, ssh, git+, github: and owner/repo shorthand', () => {
  const expect = { author: 'mattpocock', repo: 'skills', url: 'https://github.com/mattpocock/skills' }
  assert.deepEqual(parseRepoUrl('https://github.com/mattpocock/skills.git'), expect)
  assert.deepEqual(parseRepoUrl('git@github.com:mattpocock/skills.git'), expect)
  assert.deepEqual(parseRepoUrl('git+https://github.com/mattpocock/skills'), expect)
  assert.deepEqual(parseRepoUrl({ type: 'git', url: 'github:mattpocock/skills' }), expect)
  assert.deepEqual(parseRepoUrl('mattpocock/skills'), expect)
  assert.deepEqual(parseRepoUrl('https://github.com/a/b/tree/main/skills'), { author: 'a', repo: 'b', url: 'https://github.com/a/b' })
  assert.equal(parseRepoUrl(''), null)
  assert.equal(parseRepoUrl('not a url'), null)
})

test('frontmatterName reads only the frontmatter block', () => {
  assert.equal(frontmatterName('---\nname: "tdd"\ndescription: x\n---\nname: body'), 'tdd')
  assert.equal(frontmatterName('no frontmatter'), '')
})

test('scanSkillDirs + groupSkillPacks: lock, git, plugin, marker, majority batch and time batch', async () => {
  const base = mkdtempSync(join(tmpdir(), 'pulse-packs-'))
  const live = join(base, 'skills')
  const cold = join(base, 'skills-parked')
  const skill = (root, dir, name, extra = {}) => {
    mkdirSync(join(root, dir), { recursive: true })
    writeFileSync(join(root, dir, 'SKILL.md'), '---\nname: ' + name + '\ndescription: d\n---\n')
    for (const [file, text] of Object.entries(extra)) {
      mkdirSync(join(root, dir, file, '..'), { recursive: true })
      writeFileSync(join(root, dir, file), text)
    }
  }
  try {
    skill(live, 'archify', 'archify')
    skill(live, 'lieflat', 'lieflat-less-ai-tone', { '.git/config': '[remote "origin"]\n\turl = git@github.com:someone/lieflat.git\n' })
    skill(live, 'video', 'video-shotcraft', { '.claude-plugin/plugin.json': JSON.stringify({ name: 'video-shotcraft', description: 'Cinematic videos', repository: 'https://github.com/Vincentwei1021/video-shotcraft' }) })
    skill(live, 'tdd', 'tdd', { '.mattpocock': 'engineering\n' })
    skill(cold, 'grill-me', 'grill-me', { '.mattpocock': 'productivity\n' })
    skill(live, 'better-ui', 'better-ui')
    skill(live, 'teardown', 'teardown')
    skill(live, 'loner', 'loner')
    writeFileSync(join(base, 'lock.json'), JSON.stringify({ version: 3, skills: { archify: { source: 'tt-a1i/archify', sourceUrl: 'https://github.com/tt-a1i/archify.git', installedAt: '2026-10-19T23:42:21.652Z' } } }))
    {
      const rows = await scanSkillDirs([{ root: live, state: 'live' }, { root: cold, state: 'cold' }], join(base, 'lock.json'))
      assert.equal(rows.length, 8)
      // Directory birth times in a fresh temp dir are all "now": force two time batches.
      const now = Date.now()
      for (const row of rows) row.createdAt = row.name === 'loner' ? now + 10 * 60 * 1000 : now
      const { packs, packOf } = groupSkillPacks(rows, {
        knownLib: (name) => (name.startsWith('better-') ? 'better' : ''),
        libForUrl: (url) => (/video-shotcraft/.test(url) ? 'video-lib' : ''),
      })
      assert.equal(packOf['archify'], 'repo:tt-a1i/archify')
      assert.equal(packs['repo:tt-a1i/archify'].label, 'tt-a1i/archify')
      assert.equal(packs['repo:tt-a1i/archify'].installedAt, Date.parse('2026-10-19T23:42:21.652Z'))
      assert.equal(packOf['lieflat-less-ai-tone'], 'repo:someone/lieflat')
      assert.equal(packOf['video-shotcraft'], 'video-lib', 'same URL as a catalog library keeps that library id')
      assert.equal(packs['video-lib'].description, 'Cinematic videos')
      assert.equal(packOf['tdd'], 'marker:mattpocock')
      assert.equal(packOf['grill-me'], 'marker:mattpocock', 'parked skills stay in their install group')
      assert.equal(packs['marker:mattpocock'].count, 2)
      assert.equal(packOf['teardown'], 'better', 'unregistered batch-mates join the batch majority library')
      assert.equal(packOf['better-ui'], 'better')
      assert.match(packOf['loner'], /^batch:/)
    }
  } finally {
    rmSync(base, { recursive: true, force: true })
  }
})
