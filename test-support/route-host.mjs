// Child host for tests/hardening.test.mjs: patches homedir before importing index.js
// (its path constants are computed at import), runs a list of route requests and
// prints the results as JSON. Never spawns a file manager: reveal requests used here
// are all rejected before the opener runs.
import os from 'node:os'
import { syncBuiltinESMExports } from 'node:module'
import { Readable } from 'node:stream'
import { dirname, resolve, basename } from 'node:path'
import { realpathSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import assert from 'node:assert/strict'

const [fixture, script] = process.argv.slice(2)
const testsRoot = realpathSync(resolve(dirname(fileURLToPath(import.meta.url)), '..', 'tests'))
assert.equal(dirname(resolve(fixture)), testsRoot)
assert.match(basename(fixture), /^pulse-routes-[A-Za-z0-9]+$/)
os.homedir = () => fixture
syncBuiltinESMExports()
delete process.env.DSH_HOME

const { apply } = await import('../index.js')
const routes = new Map()
const disposers = []
// Optional live sessions for route tests: [{ id, header: { cwd }, events?: [...] }, ...]
// A session with `events` gets snapshotEvents() returning them (live event log).
const fakeSessions = JSON.parse(process.env.PULSE_TEST_SESSIONS || '[]').map((session) =>
  Array.isArray(session.events) ? { ...session, snapshotEvents: () => session.events } : session)
const sessions = {
  get: (id) => fakeSessions.find((session) => session.id === id),
  list: () => fakeSessions,
}
// Optional fake model service for the translate route:
//   PULSE_TEST_LLM=json     answers every id in the prompt with "<id>中文" / "说明<id>"
//   PULSE_TEST_LLM=garbage  answers prose that is not JSON
// The prompts it received are printed to stderr-free stdout via the results (see llmCalls below).
const llmMode = process.env.PULSE_TEST_LLM || ''
const llmCalls = []
const llm = llmMode && {
  async *stream(options) {
    const prompt = options.messages[0].content[0].text
    llmCalls.push({ provider: options.provider, model: options.model, purpose: options.purpose, prompt })
    const ids = [...prompt.matchAll(/"id": "([^"]+)"/g)].map((m) => m[1])
    let text = llmMode === 'json'
      ? '```json\n' + JSON.stringify(ids.map((id) => ({ id, name: id + '中文。', desc: '说明' + id }))) + '\n```'
      : 'Sorry, I cannot do that.'
    // Goal inference: json mode answers a goal (with the decorations a model tends to add), garbage mode says NONE.
    if (options.purpose === 'pulse-goal') text = llmMode === 'json' ? '目标：「给面板加目标条」。' : 'NONE'
    // Ideas: a done-check prompt ("清单：") flags the first listed idea; an extraction prompt answers
    // one idea per "### <key>" turn marker ("方向 <key>").
    if (options.purpose === 'pulse-ideas') {
      if (prompt.includes('清单：')) {
        const first = /- (idea-[\w-]+)：/.exec(prompt)
        text = JSON.stringify(first ? [{ id: first[1], evidence: '助手说已经做完了' }] : [])
      } else {
        const keys = [...prompt.matchAll(/^### (\S+)/gm)].map((m) => m[1])
        text = JSON.stringify(keys.map((key) => ({ turn: key, source: 'assistant', text: '方向 ' + key + '。' })))
      }
    }
    yield { type: 'block-start', index: 0, blockType: 'text' }
    for (const piece of [text.slice(0, 10), text.slice(10)]) yield { type: 'text-delta', index: 0, text: piece }
    yield { type: 'finish', reason: { kind: 'stop' } }
  },
}
const services = {
  sessions,
  ...(llm ? { llm, agentDefaultModel: { currentSelection: () => ({ provider: 'deepseek', model: 'test-model' }) } } : {}),
}
// Optional DSH registries: PULSE_TEST_REGISTRY={"skills":[{name,description}],"tools":[{name,description}]}
// (plugin-provided skills / tools that never touch ~/.agents/skills).
const registry = JSON.parse(process.env.PULSE_TEST_REGISTRY || 'null')
if (registry) {
  services.skills = { list: async () => registry.skills || [] }
  services.tools = { schemas: () => registry.tools || [] }
}
const handlers = new Map()
apply({
  sessions,
  get: (name) => services[name],
  on(name, handler) { handlers.set(name, (handlers.get(name) || []).concat([handler])) },
  effect(fn) {
    const dispose = fn()
    if (typeof dispose === 'function') disposers.push(dispose)
  },
  webServer: { register(row) { routes.set(row.path, row.handler); return () => {} } },
})
// Let the async user-skill scan, cold scan and usage-store load settle.
await new Promise((done) => setTimeout(done, 200))
// Optional host events: PULSE_TEST_EMIT=[["tools/result", {exec}, {result}], ...]
for (const [name, ...args] of JSON.parse(process.env.PULSE_TEST_EMIT || '[]')) {
  for (const handler of handlers.get(name) || []) handler(...args)
}

function request({ method = 'GET', path, body, raw, padBytes, headers = {} }) {
  if (padBytes) raw = '{"pad":"' + 'x'.repeat(padBytes) + '"}'
  return new Promise((done, reject) => {
    const chunks = raw !== undefined ? [raw] : body === undefined ? [] : [JSON.stringify(body)]
    const req = Readable.from(chunks)
    req.method = method
    req.url = path
    req.headers = headers
    let status = 0
    const res = {
      writeHead(code) { status = code },
      write() {},
      on() {},
      end(text) {
        let parsed = null
        try { parsed = text ? JSON.parse(text) : null } catch { parsed = text }
        done({ status, body: parsed })
      },
    }
    Promise.resolve(routes.get(path.split('?')[0])(req, res)).catch(reject)
  })
}

const results = []
// "{{N:a.b.c}}" inside a step is replaced by results[N].body.a.b.c (ids the host assigned earlier in the run).
const resolveRefs = (step) => JSON.parse(JSON.stringify(step).replace(/\{\{(\d+):([\w.]+)\}\}/g, (_, index, path) =>
  String(path.split('.').reduce((value, key) => (value == null ? value : value[key]), results[Number(index)]?.body))))
for (const step of JSON.parse(script)) {
  // { "waitFor": "/path", "until": "running", "equals": false } polls a GET until body[until] === equals (≤ 5 s).
  if (step.waitFor) {
    let last = null
    for (let i = 0; i < 100; i += 1) {
      last = await request({ path: step.waitFor })
      const value = String(step.until).split('.').reduce((at, key) => (at == null ? at : at[key]), last.body)
      if (value === step.equals) break
      await new Promise((done) => setTimeout(done, 50))
    }
    results.push(last)
    continue
  }
  results.push(await request(resolveRefs(step)))
}
if (llmMode) results.push({ status: 0, body: { llmCalls } })
console.log(JSON.stringify(results))
for (const dispose of disposers.reverse()) await dispose()
