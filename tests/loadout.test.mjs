// Skill loadout window (1.0.24): ad-hoc loadout plans, the loadout data route, auto budget,
// composition stats, fill-by-usage, and the window's equip / lock / preview flow.
import test from 'node:test'
import assert from 'node:assert/strict'
import { execFile } from 'node:child_process'
import { mkdtempSync, mkdirSync, readFileSync, realpathSync, rmSync, writeFileSync } from 'node:fs'
import { basename, dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import vm from 'node:vm'
import { loadoutPlan } from '../profile-core.js'

const testsRoot = realpathSync(dirname(fileURLToPath(import.meta.url)))
const helper = join(testsRoot, '..', 'test-support', 'route-host.mjs')

test('loadoutPlan: everything not equipped is parked (new ones too), cold equipped ones restored, in-use kept', () => {
  const plan = loadoutPlan(['a', 'cold-one', 'gone'], ['a', 'b', 'new', 'busy'], [{ name: 'cold-one', directoryName: 'cold-dir' }],
    new Map([['busy', [{ sessionId: 's2', title: '别的对话' }]]]), new Set(['a', 'b', 'new', 'busy']), '自定义')
  assert.deepEqual(plan.park, ['b', 'new'])
  assert.deepEqual(plan.restore, [{ name: 'cold-one', directoryName: 'cold-dir' }])
  assert.deepEqual(plan.keepInUse.map((r) => r.name), ['busy'])
  assert.deepEqual(plan.missing, ['gone'])
  assert.equal(plan.profileName, '自定义')
})

/* ── host ───────────────────────────────────────────────────────────── */

function run(steps) {
  const base = mkdtempSync(join(testsRoot, 'pulse-routes-'))
  for (const [name, desc] of [['a', 'x'.repeat(200)], ['b', 'y'.repeat(40)]]) {
    mkdirSync(join(base, '.agents', 'skills', name), { recursive: true })
    writeFileSync(join(base, '.agents', 'skills', name, 'SKILL.md'), '---\nname: ' + name + '\ndescription: ' + desc + '\n---\n')
  }
  mkdirSync(join(base, '.agents', 'skills', '.third-party-licenses'), { recursive: true })
  mkdirSync(join(base, '.dsh', 'running-panel'), { recursive: true })
  const env = {
    ...process.env,
    PULSE_TEST_SESSIONS: JSON.stringify([{ id: 's1', header: { cwd: 'H:\\w' } }, { id: 's2', header: { cwd: 'H:\\w' } }]),
    PULSE_TEST_REGISTRY: JSON.stringify({ skills: [{ name: 'a', description: 'x'.repeat(120) }, { name: 'b', description: 'y'.repeat(40) }, { name: 'builtin-one', description: 'z'.repeat(100) }] }),
    PULSE_TEST_EMIT: JSON.stringify([
      ['tools/result', { agent: { id: 's2' }, name: 'skill', arguments: '{"name":"a"}' }, { isError: false }],
      ['tools/result', { agent: { id: 's2' }, name: 'skill', arguments: '{"name":"b"}' }, { isError: false }],
    ]),
  }
  delete env.NODE_TEST_CONTEXT
  return new Promise((done, reject) => execFile(process.execPath, [helper, base, JSON.stringify(steps)], {
    env, encoding: 'utf8', timeout: 30000, maxBuffer: 8 * 1024 * 1024,
  }, (error, stdout, stderr) => {
    assert.equal(dirname(resolve(base)), testsRoot)
    assert.match(basename(base), /^pulse-routes-[A-Za-z0-9]+$/)
    rmSync(base, { recursive: true, force: true })
    if (error) return reject(new Error(stderr || error.message))
    done(JSON.parse(stdout.trim().split('\n').pop()))
  }))
}

test('loadout route: sizes, categories, usage, recent sessions, co-use, in-use, and built-ins as one locked block', async () => {
  const [data, preview, saved] = await run([
    { path: '/dsh-running-panel/loadout?session=s1' },
    { method: 'POST', path: '/dsh-running-panel/profiles', body: { previewSkills: ['b'], sessionId: 's1', label: '只要 b' } },
    { method: 'POST', path: '/dsh-running-panel/profiles', body: { name: '手拼', skills: ['b'] } },
  ])
  const a = data.body.skills.find((s) => s.name === 'a')
  const b = data.body.skills.find((s) => s.name === 'b')
  assert.equal(a.tokens, Math.round((1 + 120 + 7) / 4), 'size is what the model catalog carries, not the SKILL.md text')
  assert.ok(a.tokens > b.tokens)
  assert.ok(!data.body.skills.some((s) => s.name.startsWith('.')), 'hidden folders are not skills')
  assert.equal(a.live, true)
  assert.ok(['visual', 'code', 'thought', 'ops'].includes(a.group))
  assert.equal(a.uses, 1)
  assert.equal(a.recent[0].sessionId, 's2')
  assert.deepEqual(a.together, ['b'], 'a and b were used in the same conversation')
  assert.equal(a.inUse[0].sessionId, 's2', 'another conversation is using it')
  assert.equal(data.body.builtin.count, 1, 'built-in (not in ~/.agents/skills) counted once')
  assert.ok(data.body.builtin.tokens > 0)
  assert.ok(Array.isArray(data.body.profiles.profiles))
  assert.deepEqual(preview.body.park, [], 'a is in use by s2, so it is kept')
  assert.deepEqual(preview.body.keepInUse.map((r) => r.name), ['a'])
  assert.equal(preview.body.profileName, '只要 b')
  assert.deepEqual(saved.body.profiles[0].skills, ['b'], 'a hand-composed list can be saved as a profile')
})

/* ── client ─────────────────────────────────────────────────────────── */

const source = readFileSync(new URL('../client.js', import.meta.url), 'utf8').replace(/\r\n/g, '\n')
function harness(fetchImpl) {
  const slots = []
  let cursor = 0
  let runEffects = false
  const React = {
    Fragment: 'Fragment',
    createElement(type, props, ...children) { return { type, props: props || {}, children } },
    useState(initial) { const id = cursor++; if (!(id in slots)) slots[id] = typeof initial === 'function' ? initial() : initial; return [slots[id], (v) => { slots[id] = typeof v === 'function' ? v(slots[id]) : v }] },
    useRef(initial) { const id = cursor++; return slots[id] || (slots[id] = { current: initial }) },
    useEffect(callback) { cursor++; if (runEffects) callback() },
    useMemo(callback) { cursor++; return callback() },
    useCallback(callback) { cursor++; return callback },
    createContext(value) { return { _value: value, Provider: 'Provider' } },
    useContext(context) { return context._value },
  }
  const requests = []
  let factory
  const context = vm.createContext({
    setTimeout, clearTimeout,
    window: { __ModuleLoader__: { load(module) { factory = module.factory } }, localStorage: { getItem: () => null, setItem() {} } },
    fetch(url, options) {
      const body = options && options.body ? JSON.parse(options.body) : null
      requests.push({ url, body })
      return Promise.resolve({ ok: true, json: () => Promise.resolve(fetchImpl(url, body)) })
    },
  })
  vm.runInContext(source.replace("return { inject: ['slots', 'locale'], apply: apply }", 'return { LoadoutWindow, loadoutStats, fillByUsage, autoBudgetTokens, budgetLimitTokens, budgetWindow, setPref, SettingsSheet, BudgetSettings, uiStore }'), context)
  const api = factory((name) => (name === 'react' ? React : null))
  return { api, requests, render(fn, effects = false) { runEffects = effects; cursor = 0; const out = fn(); runEffects = false; return out } }
}
function all(tree, predicate, out = []) {
  if (!tree || typeof tree !== 'object') return out
  if (Array.isArray(tree)) { tree.forEach((child) => all(child, predicate, out)); return out }
  if (predicate(tree)) out.push(tree)
  all(tree.children, predicate, out)
  return out
}
const skill = (name, extra = {}) => ({ name, live: true, tokens: 100, tag: 'code', group: 'code', lib: 'user', uses: 0, lastAt: 0, description: '', recent: [], together: [], inUse: [], movable: true, ...extra })

test('auto budget: 1% of the context window, clamped to 3k–20k; fixed mode uses the setting', () => {
  const { api } = harness(() => ({}))
  assert.equal(api.autoBudgetTokens(1048576), 10486)
  assert.equal(api.autoBudgetTokens(128000), 3000, 'small windows get the floor')
  assert.equal(api.autoBudgetTokens(8000000), 20000, 'huge windows are capped: more skills means worse picks')
  assert.equal(api.autoBudgetTokens(0), 0)
  assert.equal(api.budgetLimitTokens(), 3000, 'unknown window → fixed value')
  api.setPref('budgetMode', 'fixed')
  api.setPref('budgetTokens', 5000)
  assert.equal(api.budgetLimitTokens(), 5000)
})

test('loadout stats show the category leaning; fill-by-usage stays inside the budget', () => {
  const { api } = harness(() => ({}))
  const skills = [skill('c1', { tokens: 300 }), skill('v1', { group: 'visual', tokens: 100 }), skill('t1', { group: 'thought', tokens: 50, uses: 9 }), skill('o1', { group: 'ops', tokens: 400, uses: 3 })]
  const stats = api.loadoutStats(skills, { c1: true, v1: true }, 200, 1000)
  assert.equal(stats.used, 600, 'built-ins count toward the budget')
  assert.equal(stats.bias, 'code')
  assert.equal(Math.round(stats.share.code * 100), 75)
  assert.equal(stats.over, false)
  const filled = api.fillByUsage(skills, { c1: true, v1: true }, 200, 1000)
  assert.deepEqual(Object.keys(filled).sort(), ['c1', 't1', 'v1'], 'o1 (400) would exceed the 1000 budget')
})

test('loadout window: click equips, a skill another conversation uses cannot be removed, apply previews first', async () => {
  const data = { skills: [skill('a', { live: false }), skill('busy', { inUse: [{ sessionId: 's2', title: '别的对话' }] })], builtin: { count: 0, tokens: 0 }, contextWindow: 1000000, profiles: { profiles: [] } }
  const ui = harness((url, body) => (String(url).includes('/loadout') ? data : body && body.previewSkills ? { switchId: 'sw', park: [], restore: [], keepNew: [], keepInUse: [], missing: [], profileName: '' } : {}))
  const t = (k) => k
  const render = (effects) => ui.render(() => ui.api.LoadoutWindow({ t, sessionId: 's1', onClose() {} }), effects)
  render(true)
  await new Promise((d) => setImmediate(d)); await new Promise((d) => setImmediate(d))
  let tree = render()
  const tile = (name) => all(tree, (n) => n.type === 'button' && n.props.className === '__rp_loTile' && n.props.title === name)[0]
  assert.equal(tile('a').props['aria-pressed'], 'false')
  tile('a').props.onClick({ nativeEvent: {} })
  tree = render()
  assert.equal(tile('a').props['aria-pressed'], 'true', 'clicking equips')
  assert.equal(tile('busy').props['data-locked'], '1')
  tile('busy').props.onClick({ nativeEvent: {} })
  tree = render()
  assert.equal(tile('busy').props['aria-pressed'], 'true', 'in-use skill stays equipped')
  assert.ok(JSON.stringify(tree).includes('loLockedNotice'), 'and the bar says why')
  all(tree, (n) => n.type === 'button' && n.children.includes('loApply'))[0].props.onClick()
  await new Promise((d) => setImmediate(d)); await new Promise((d) => setImmediate(d))
  const last = ui.requests.at(-1)
  assert.deepEqual(last.body.previewSkills.sort(), ['a', 'busy'])
  assert.equal(ui.requests.filter((r) => r.body && r.body.apply).length, 0, 'nothing moves before confirming')
})

test('settings window: category list on the left, one category at a time, yes/no rows keep their names', () => {
  const ui = harness(() => ({}))
  const t = (k) => k
  let tree = ui.render(() => ui.api.SettingsSheet({ t }))
  const cats = all(tree, (n) => n.props.className === '__rp_setCat')
  assert.deepEqual(cats.map((n) => n.children[0]), ['setCatGeneral', 'setCatVisual', 'setCatModel', 'setCatSound', 'setCatBackground', 'setCatBudget', 'setCatPricing'])
  assert.ok(all(tree, (n) => n.props.name === 'rp-corner').length === 1, 'general shows the corner switch')
  assert.equal(all(tree, (n) => n.type && n.type.name === 'BudgetSettings').length, 0, 'other categories are not rendered')
  cats[5].props.onClick({ nativeEvent: {} })
  tree = ui.render(() => ui.api.SettingsSheet({ t }))
  assert.equal(all(tree, (n) => n.type && n.type.name === 'BudgetSettings').length, 1, 'budget category')
  assert.ok(all(tree, (n) => n.props.className === '__rp_setPaneTitle')[0].children.join('').startsWith('setCatBudget'))
  all(tree, (n) => n.props.className === '__rp_setTab')[1].props.onClick({ nativeEvent: {} })
  tree = ui.render(() => ui.api.SettingsSheet({ t }))
  assert.ok(JSON.stringify(tree).includes('setAboutClient'), 'about tab shows versions')
})

test('loadout groups skills by library, collapsed until opened; a library can be equipped or removed in one go', async () => {
  const data = {
    skills: [skill('a1', { lib: 'repo:x/a', live: false }), skill('a2', { lib: 'repo:x/a', live: false }), skill('b1', { lib: 'repo:y/b', inUse: [{ sessionId: 's2', title: 'other' }] })],
    builtin: { count: 0, tokens: 0 }, contextWindow: 1000000, profiles: { profiles: [] },
  }
  const ui = harness(() => data)
  const t = (k) => k
  const render = (effects) => ui.render(() => ui.api.LoadoutWindow({ t, sessionId: 's1', onClose() {} }), effects)
  render(true)
  await new Promise((d) => setImmediate(d)); await new Promise((d) => setImmediate(d))
  let tree = render()
  assert.equal(all(tree, (n) => n.props.className === '__rp_loLib').length, 2)
  assert.equal(all(tree, (n) => n.props.className === '__rp_loTile').length, 0, 'collapsed: no tiles')
  const libButtons = () => all(tree, (n) => n.props.className === '__rp_loLibToggle')
  libButtons()[0].props.onClick()
  tree = render()
  assert.deepEqual(all(tree, (n) => n.props.className === '__rp_loTile').map((n) => n.props.title), ['a1', 'a2'], 'opened library shows its skills')
  const allBtn = (i) => all(tree, (n) => typeof n.props.className === 'string' && n.props.className.includes('__rp_loLibAll'))[i]
  assert.equal(allBtn(0).children[0], 'loLibAllOn')
  allBtn(0).props.onClick()
  tree = render()
  assert.equal(allBtn(0).children[0], 'loLibAllOff', 'whole library equipped')
  allBtn(1).props.onClick()
  tree = render()
  assert.ok(JSON.stringify(tree).includes('loLibKept'), 'in-use skill is kept and the bar says so')
  assert.equal(allBtn(1).children[0], 'loLibAllOff', 'b1 stays equipped')
})

test('budget line: rule is adjustable, the last seen context window is remembered, fixed value is the fallback', () => {
  const { api } = harness(() => ({}))
  assert.deepEqual({ ...api.budgetWindow() }, { tokens: 0, source: 'none' })
  assert.equal(api.budgetLimitTokens(), 3000, 'nothing seen yet → fallback')
  api.setPref('lastContextWindow', 1048576)
  assert.deepEqual({ ...api.budgetWindow() }, { tokens: 1048576, source: 'remembered' })
  assert.equal(api.budgetLimitTokens(), 10486, 'no live session, but the remembered window still drives the line')
  api.setPref('budgetRatio', 0.02)
  assert.equal(api.budgetLimitTokens(), 20000, '2% of 1M hits the cap')
  api.setPref('budgetMax', 50000)
  assert.equal(api.budgetLimitTokens(), 20972)
  api.setPref('budgetMin', 30000)
  assert.equal(api.autoBudgetTokens(128000), 30000, 'raised floor')
  api.setPref('budgetMax', 1000)
  assert.equal(api.autoBudgetTokens(8000000), 30000, 'a cap below the floor is lifted to the floor')
  api.setPref('budgetMode', 'fixed')
  api.setPref('budgetTokens', 4000)
  assert.equal(api.budgetLimitTokens(), 4000)
})

test('settings close fades out first (menu fade > 0), and closes at once when fade is 0', async () => {
  const ui = harness(() => ({}))
  const t = (k) => k
  ui.api.uiStore.set(true)
  let tree = ui.render(() => ui.api.SettingsSheet({ t }))
  all(tree, (n) => n.props.className === '__rp_setClose')[0].props.onClick()
  tree = ui.render(() => ui.api.SettingsSheet({ t }))
  assert.equal(all(tree, (n) => n.props.className === '__rp_setWrap')[0].props['data-closing'], '1')
  assert.equal(ui.api.uiStore.open, true, 'still mounted while fading')
  await new Promise((d) => setTimeout(d, 200))
  assert.equal(ui.api.uiStore.open, false)
  ui.api.setPref('menuFadeMs', 0)
  ui.api.uiStore.set(true)
  const fresh = harness(() => ({}))
  fresh.api.setPref('menuFadeMs', 0)
  fresh.api.uiStore.set(true)
  tree = fresh.render(() => fresh.api.SettingsSheet({ t }))
  all(tree, (n) => n.props.className === '__rp_setClose')[0].props.onClick()
  assert.equal(fresh.api.uiStore.open, false, 'fade 0 closes immediately')
})
