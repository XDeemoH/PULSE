import { mkdir, writeFile, readFile, rm } from 'node:fs/promises'
import { homedir } from 'node:os'
import { join, resolve } from 'node:path'
import { Readable } from 'node:stream'
import { apply } from '../index.js'

const [base, scenario] = process.argv.slice(2)
if (resolve(homedir()).toLowerCase() !== resolve(join(base, 'user')).toLowerCase()) throw new Error('Unsafe home directory')
if (resolve(process.env.DSH_HOME).toLowerCase() !== resolve(join(base, 'dsh')).toLowerCase()) throw new Error('Unsafe DSH_HOME')
const dir = join(base, 'dsh', 'running-panel')
await mkdir(dir, { recursive: true })
const file = join(dir, 'usage.json')
const initial = JSON.stringify({ since: 1, totals: [{ k: 'tool:read', n: 9 }, { k: 'tool:write', n: 4 }], sessions: { old: { tools: { read: 7, write: 4 }, skills: { alpha: 3 } }, other: { tools: { read: 2 }, skills: { beta: 5 } } } })
if (scenario === 'resume') await writeFile(file, initial)
if (scenario === 'recent') {
  const sessions = Object.fromEntries(Array.from({ length: 40 }, (_, i) => ['archive-' + i, { tools: { read: 1 }, skills: {}, lastAt: 100 + i }]))
  await writeFile(file, JSON.stringify({ since:1, totals:[{ k:'tool:read', n:40 }], sessions }))
}
if (scenario === 'corrupt') await writeFile(file, '{not valid JSON!')
const invalidUsage = {
  'totals-object': '{"version":1,"totals":{"tool:read":{"n":99}},"sessions":{}}',
  'totals-row-key': '{"version":1,"totals":[{"k":9,"n":99}]}',
  'totals-row-count': '{"version":1,"totals":[{"k":"tool:read","n":-1}]}',
  'totals-row-infinite': '{"version":1,"totals":[{"k":"tool:read","n":1e999}]}',
  'sessions-array': '{"version":1,"sessions":[]}',
  'session-array': '{"version":1,"sessions":{"old":[]}}',
  'tools-array': '{"version":1,"sessions":{"old":{"tools":[]}}}',
  'skills-string': '{"version":1,"sessions":{"old":{"skills":{"alpha":"7"}}}}',
  'tools-negative': '{"version":1,"sessions":{"old":{"tools":{"read":-1}}}}',
  'lastAt-string': '{"version":1,"sessions":{"old":{"lastAt":"yesterday"}}}',
  'since-infinite': '{"version":1,"since":1e999}',
  'future-version': '{"version":2,"totals":[],"sessions":{}}',
}
const invalidUsageKind = scenario.startsWith('usage-invalid-') ? scenario.slice('usage-invalid-'.length) : ''
if (invalidUsageKind) {
  if (!invalidUsage[invalidUsageKind]) throw new Error('Unknown invalid usage fixture')
  await writeFile(file, invalidUsage[invalidUsageKind])
}
if (scenario === 'echo') await mkdir(join(dir, 'echoes.json'))
if (scenario === 'echo-malformed') await writeFile(join(dir, 'echoes.json'), '{"echoes":{}}')
const listeners = {}, routes = {}, disposers = []
const session = { id: 'old', header: {}, snapshotEvents: () => [], deriveMessages: () => [{ id: 'm1', role: 'user', content: [{type:'text',text:'hello'}] }, { id: 'm2', role: 'user', content: [{type:'text',text:'world'}] }] }
const sessions = { get: id => id === 'old' ? session : undefined, list: () => [session] }
const ctx = { sessions, connection: { admit: () => ({ peer: { principal: { kind: 'owner' } } }) }, webServer: { register(route) { routes[route.path] = route.handler; return () => {} } }, get(name) { return this[name] }, on(name, fn) { listeners[name] = fn }, effect(fn) { const d = fn(); if (typeof d === 'function') disposers.push(d) } }
if (scenario.startsWith('cost-')) {
  const long = { name: 'full-skill', description: 'D'.repeat(400), invocation: { modelInvocable: true } }
  ctx.skills = { list: async () => [long], snapshot: async () => ({ skills: [long] }) }
  ctx.agents = { get: () => ({ id: 'old' }) }
  ctx.sessionSkillCatalog = { list: async () => ({ skills: [{ name:'full-skill', description:'D'.repeat(160), modelInvocable:true }] }) }
  ctx.tokenMeter = { estimateMessage(message) { if (scenario === 'cost-fallback') throw new Error('fake meter unavailable'); return message.content[0].text.length } }
}
apply(ctx)
await new Promise(r => setTimeout(r, 300))
let result
if (scenario === 'resume' || scenario === 'corrupt' || scenario === 'recent' || invalidUsageKind) {
  listeners['tools/result']({ agent: { id: 'old' }, name: 'read', arguments: {} }, {})
  await new Promise(r => setTimeout(r, 1900))
  result = { file: await readFile(file, 'utf8') }
  if (invalidUsageKind) {
    result.original = invalidUsage[invalidUsageKind]
    const req = { method: 'GET', url: '/dsh-running-panel/snapshot?session=old' }
    result.snapshot = await new Promise((resolve, reject) => {
      const res = { writeHead() {}, end(body) { resolve(JSON.parse(body)) } }
      Promise.resolve(routes['/dsh-running-panel/snapshot'](req, res)).catch(reject)
    })
  }
} else if (scenario.startsWith('cost-')) {
  const req = { method: 'GET', url: '/dsh-running-panel/snapshot?session=old' }
  result = await new Promise((resolve, reject) => { const res = { writeHead(status) { this.status = status }, end(body) { resolve({ status: this.status, body: JSON.parse(body) }) } }; Promise.resolve(routes['/dsh-running-panel/snapshot'](req, res)).catch(reject) })
} else if (scenario === 'echo-transaction' || scenario === 'echo-malformed') {
  async function request(method, url, body) {
    const req = Readable.from(body ? [JSON.stringify(body)] : []); req.method = method; req.url = url
    return await new Promise((resolve, reject) => { const res = { writeHead(status) { this.status = status }, end(body) { resolve({ status: this.status, body: JSON.parse(body) }) } }; Promise.resolve(routes['/dsh-running-panel/echo'](req, res)).catch(reject) })
  }
  const path = '/dsh-running-panel/echo'
  if (scenario === 'echo-malformed') {
    const post = await request('POST', path, {sessionId:'old', messageId:'m1'})
    result = { post, file: await readFile(join(dir, 'echoes.json'), 'utf8') }
  } else {
    const created = await request('POST', path, {sessionId:'old', messageId:'m1'})
    const id = created.body.echo.id
    const tmp = join(dir, 'echoes.json.tmp')
    await mkdir(tmp)
    const failedPost = await request('POST', path, {sessionId:'old', messageId:'m2'})
    const failedPatch = await request('PATCH', path, {id, title:'SHOULD NOT PERSIST'})
    const failedDelete = await request('DELETE', path + '?id=' + encodeURIComponent(id))
    const after = await request('GET', path + '?id=' + encodeURIComponent(id))
    const all = await request('GET', path + '?all=1')
    await rm(tmp, {recursive:true, force:true})
    const retry = await request('DELETE', path + '?id=' + encodeURIComponent(id))
    result = { created, failedPost, failedPatch, failedDelete, after, all, retry }
  }
} else if (scenario === 'echo') {
  const req = Readable.from([JSON.stringify({ sessionId:'old', messageId:'m1' })]); req.method = 'POST'; req.url = '/dsh-running-panel/echo'
  result = await new Promise((resolve, reject) => { const res = { writeHead(status) { this.status = status }, end(body) { resolve({ status: this.status, body: JSON.parse(body) }) } }; Promise.resolve(routes['/dsh-running-panel/echo'](req, res)).catch(reject) })
}
for (const dispose of disposers) dispose()
await new Promise(r => setTimeout(r, 150))
console.log(JSON.stringify(result))

