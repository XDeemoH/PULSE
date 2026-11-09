import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, mkdir, writeFile, readFile, rm, realpath, symlink, readdir, lstat } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { dirname, join, resolve, basename } from 'node:path'
import { fileURLToPath } from 'node:url'
import { execFile, spawn } from 'node:child_process'
const root = await realpath(dirname(fileURLToPath(import.meta.url)))
const helper = join(root, '..', 'test-support', 'catalog-overlay-host.mjs')
const overlayAt = (base, custom = false) => join(base, custom ? 'custom-profile' : '.dsh', 'running-panel', 'catalog-overlay.json')
async function fixture(run) {
  const base = await mkdtemp(join(root, 'pulse-overlay-'))
  try {
    const skill = join(base, '.agents', 'skills', 'overlay-test-one')
    await mkdir(skill, { recursive: true })
    await writeFile(join(skill, 'SKILL.md'), '---\nname: Overlay one\ndescription: English description. More detail.\n---\n')
    await mkdir(dirname(overlayAt(base)), { recursive: true })
    await run(base)
  } finally {
    assert.equal(dirname(resolve(base)), root)
    assert.match(basename(base), /^pulse-overlay-[A-Za-z0-9]+$/)
    assert.equal(await realpath(base), resolve(base))
    await rm(base, { recursive: true, force: true })
  }
}
async function cli(base, mode = 'write', custom = false) {
  const env = { ...process.env }; delete env.NODE_TEST_CONTEXT
  return await new Promise(done => execFile(process.execPath, [helper, base, mode, custom ? 'custom' : 'default'], {
    env, encoding: 'utf8', timeout: 15000,
  }, (error, stdout, stderr) => done({ code: error?.code || 0, stdout, stderr })))
}

for (const [label, text] of [
  ['malformed JSON', '{broken'], ['null root', 'null'], ['array root', '[]'],
  ['unknown version', '{"version":9,"names":{}}'], ['array mapping', '{"names":[]}'],
  ['non-object translation', '{"names":{"skill:existing":"translated"}}'],
  ['non-string locale', '{"descs":{"skill:existing":{"zh":4}}}'],
  ['invalid plain mapping', '{"tagOf":{"skill:existing":{}}}'],
]) {
  test('T01 preserves and rejects ' + label, () => fixture(async base => {
    const file = overlayAt(base)
    await writeFile(file, text)
    const result = await cli(base)
    assert.notEqual(result.code, 0, JSON.stringify(result))
    assert.equal(await readFile(file, 'utf8'), text)
  }))
}

test('T01 unreadable overlay is not treated as missing or replaced', () => fixture(async base => {
  const file = overlayAt(base), original = '{"names":{"skill:old":{"zh":"原翻译"}}}'
  await writeFile(file, original)
  const result = await cli(base, 'unreadable')
  assert.notEqual(result.code, 0)
  assert.equal(await readFile(file, 'utf8'), original)
}))

test('T01 seeding a missing name preserves existing localized descriptions', () => fixture(async base => {
  await writeFile(overlayAt(base), JSON.stringify({ descs: { 'skill:overlay-test-one': { zh: '用户说明', en: 'user English', fr: 'texte' } }, notes: 'keep metadata' }))
  const result = await cli(base)
  assert.equal(result.code, 0, result.stderr)
  const data = JSON.parse(await readFile(overlayAt(base), 'utf8'))
  assert.deepEqual(data.descs['skill:overlay-test-one'], { zh: '用户说明', en: 'user English', fr: 'texte' })
  assert.equal(data.names['skill:overlay-test-one'].en, 'Overlay one')
  assert.equal(data.notes, 'keep metadata')
}))

test('T01 explicit DSH_HOME receives overlay and default profile remains untouched', () => fixture(async base => {
  const original = '{"names":{"skill:default":{"zh":"默认目录翻译"}}}'
  await writeFile(overlayAt(base), original)
  const result = await cli(base, 'write', true)
  assert.equal(result.code, 0, result.stderr)
  assert.equal(existsSync(overlayAt(base, true)), true)
  assert.equal(await readFile(overlayAt(base), 'utf8'), original)
  assert.equal(JSON.parse(await readFile(overlayAt(base, true), 'utf8')).names['skill:overlay-test-one'].en, 'Overlay one')
}))

test('T01 partial write failure leaves original bytes intact', () => fixture(async base => {
  const original = '{"names":{"skill:existing":{"zh":"原翻译"}}}\n'
  await writeFile(overlayAt(base), original)
  const result = await cli(base, 'write-failure')
  assert.notEqual(result.code, 0)
  assert.equal(await readFile(overlayAt(base), 'utf8'), original)
}))

test('T01 detects an external edit before committing the replacement', () => fixture(async base => {
  await writeFile(overlayAt(base), '{"names":{}}')
  const result = await cli(base, 'concurrent-edit')
  assert.notEqual(result.code, 0)
  assert.deepEqual(JSON.parse(await readFile(overlayAt(base), 'utf8')), { names: { 'skill:editor-change': { zh: '编辑器的新翻译' } } })
}))

test('T01 simultaneous writer lock refuses an update without changing the overlay', () => fixture(async base => {
  const original = '{"names":{}}'
  await writeFile(overlayAt(base), original)
  const env = { ...process.env }; delete env.NODE_TEST_CONTEXT
  const holder = spawn(process.execPath, [helper, base, 'hold-lock'], { env, stdio: ['pipe', 'pipe', 'pipe'] })
  const closed = new Promise(resolve => holder.on('close', resolve))
  try {
    await new Promise((resolve, reject) => {
      holder.once('error', reject)
      holder.stdout.on('data', chunk => { if (String(chunk).includes('LOCKED')) resolve() })
      holder.once('exit', code => reject(new Error('lock holder exited: ' + code)))
    })
    assert.notEqual((await cli(base)).code, 0)
    assert.equal(await readFile(overlayAt(base), 'utf8'), original)
  } finally { holder.kill(); await closed }
}))

test('T01 missing overlay can be seeded and successful update leaves no temporary file', () => fixture(async base => {
  const result = await cli(base)
  assert.equal(result.code, 0, result.stderr)
  assert.equal(JSON.parse(await readFile(overlayAt(base), 'utf8')).names['skill:overlay-test-one'].en, 'Overlay one')
  assert.deepEqual((await readdir(dirname(overlayAt(base)))).filter(name => name.endsWith('.tmp')), [])
}))

test('T01 a directory at overlay path fails without touching its contents', () => fixture(async base => {
  await mkdir(overlayAt(base))
  await writeFile(join(overlayAt(base), 'marker'), 'preserve')
  assert.notEqual((await cli(base)).code, 0)
  assert.equal(await readFile(join(overlayAt(base), 'marker'), 'utf8'), 'preserve')
}))

test('T01 final symlink is refused and its target remains unchanged', t => fixture(async base => {
  const target = join(base, 'linked-user-file.json')
  const original = '{"names":{"skill:existing":{"zh":"链接指向的用户内容"}}}'
  await writeFile(target, original)
  let preservedFile = target
  try { await symlink(target, overlayAt(base), 'file') } catch (error) {
    if (process.platform !== 'win32' || error.code !== 'EPERM') throw error
    // Windows sandbox has no file-symlink privilege; exercise a real junction
    // instead, not a mocked lstat result or a skipped safety check.
    const directory = join(base, 'linked-user-directory')
    await mkdir(directory)
    preservedFile = join(directory, 'marker')
    await writeFile(preservedFile, original)
    await symlink(directory, overlayAt(base), 'junction')
    t.diagnostic('Windows file symlinks unavailable; verified a real final-path junction')
  }
  const result = await cli(base)
  assert.notEqual(result.code, 0)
  assert.match(result.stderr, /regular file/)
  assert.equal((await lstat(overlayAt(base))).isSymbolicLink(), true)
  assert.equal(await readFile(preservedFile, 'utf8'), original)
}))

test('T01 file appearing during a missing-file update is preserved', () => fixture(async base => {
  assert.equal(existsSync(overlayAt(base)), false)
  assert.notEqual((await cli(base, 'concurrent-edit')).code, 0)
  assert.deepEqual(JSON.parse(await readFile(overlayAt(base), 'utf8')), { names: { 'skill:editor-change': { zh: '编辑器的新翻译' } } })
}))

test('T01 already covered skills do not rewrite user formatting or translations', () => fixture(async base => {
  const original = '{  "names": {"skill:overlay-test-one": {"zh":"用户标题"}} }\n'
  await writeFile(overlayAt(base), original)
  assert.equal((await cli(base)).code, 0)
  assert.equal(await readFile(overlayAt(base), 'utf8'), original)
}))

test('T01 Host retains last valid translations and exposes a later parse failure', () => fixture(async base => {
  await writeFile(overlayAt(base), '{"names":{"skill:overlay-test-one":{"zh":"保留此翻译"}}}')
  const result = await cli(base, 'host-cache')
  assert.equal(result.code, 0, result.stderr)
  const output = JSON.parse(result.stdout.trim().split('\n').at(-1))
  assert.equal(output.first.body.names['skill:overlay-test-one'].zh, '保留此翻译')
  assert.equal(output.second.body.names['skill:overlay-test-one']?.zh, '保留此翻译')
  assert.ok(output.second.body.overlayError)
  assert.equal(output.snapshot.body.storage.catalog.ready, false)
  assert.ok(output.snapshot.body.storage.catalog.error)
  assert.equal(await readFile(overlayAt(base), 'utf8'), '{broken by editor')
}))

test('T01 Host exposes bad startup data without modifying it', () => fixture(async base => {
  await writeFile(overlayAt(base), '{broken startup')
  const result = await cli(base, 'host-startup')
  assert.equal(result.code, 0, result.stderr)
  const output = JSON.parse(result.stdout.trim().split('\n').at(-1))
  assert.ok(output.second.body.overlayError)
  assert.equal(output.snapshot.body.storage.catalog.ready, false)
  assert.equal(await readFile(overlayAt(base), 'utf8'), '{broken startup')
}))

test('T01 Host honors custom DSH_HOME and reports the loaded plugin version', () => fixture(async base => {
  await writeFile(overlayAt(base), '{"names":{"skill:overlay-test-one":{"zh":"默认目录"}}}')
  await mkdir(dirname(overlayAt(base, true)), { recursive: true })
  await writeFile(overlayAt(base, true), '{"names":{"skill:overlay-test-one":{"zh":"自定义目录"}}}')
  const result = await cli(base, 'host-custom', true)
  assert.equal(result.code, 0, result.stderr)
  const output = JSON.parse(result.stdout.trim().split('\n').at(-1))
  assert.equal(output.second.body.names['skill:overlay-test-one'].zh, '自定义目录')
  const pkg = JSON.parse(await readFile(join(root, '..', 'package.json'), 'utf8'))
  assert.equal(output.second.body.version, 3)
  assert.equal(output.second.body.pluginVersion, pkg.version)
  assert.equal(output.snapshot.body.pluginVersion, pkg.version)
}))
