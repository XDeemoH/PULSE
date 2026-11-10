// Host admission: every /dsh-running-panel/* route must pass the host's connection.admit() before its handler runs.
import test from 'node:test'
import assert from 'node:assert/strict'
import { apply, admitRequest } from '../index.js'

const req = (over = {}) => ({ method: 'GET', url: '/dsh-running-panel/snapshot', headers: { host: 'localhost:3094' }, socket: { remoteAddress: '127.0.0.1' }, ...over })

test('admit(): rejection statuses are passed through', () => {
  assert.equal(admitRequest({ admit: () => ({ rejection: 401 }) }, req()), 401)
  assert.equal(admitRequest({ admit: () => ({ rejection: 403 }) }, req()), 403)
})

test('admit(): only the owner Peer is let through', () => {
  assert.equal(admitRequest({ admit: () => ({ peer: { principal: { kind: 'owner' } } }) }, req()), 0)
  assert.equal(admitRequest({ admit: () => ({ peer: { principal: { kind: 'remote' } } }) }, req()), 403)
  assert.equal(admitRequest({ admit: () => ({ peer: {} }) }, req()), 403)
  assert.equal(admitRequest({ admit: () => ({}) }, req()), 403)
})

test('admit(): a gate that throws or answers garbage never admits', () => {
  assert.equal(admitRequest({ admit: () => { throw new Error('boom') } }, req()), 403)
  assert.equal(admitRequest({ admit: () => null }, req()), 403)
})

test('older hosts: requestRejection() is used when admit() is missing', () => {
  assert.equal(admitRequest({ requestRejection: () => undefined }, req()), 0)
  assert.equal(admitRequest({ requestRejection: () => 401 }, req()), 401)
  assert.equal(admitRequest({ requestRejection: () => { throw new Error('boom') } }, req()), 403)
})

test('no connection service: loopback peer AND loopback Host only (no DNS rebinding, no LAN)', () => {
  assert.equal(admitRequest(undefined, req()), 0)
  assert.equal(admitRequest(undefined, req({ socket: { remoteAddress: '::ffff:127.0.0.1' }, headers: { host: '127.0.0.1:3094' } })), 0)
  assert.equal(admitRequest(undefined, req({ socket: { remoteAddress: '192.168.1.20' } })), 403)
  assert.equal(admitRequest(undefined, req({ headers: { host: 'attacker.example:3094' } })), 403)
  assert.equal(admitRequest(undefined, req({ socket: {} })), 403)
})

test('every registered route answers the rejection and never reaches its handler', async () => {
  const routes = new Map()
  const disposers = []
  let admits = 0
  const services = {
    sessions: { get() {}, list: () => [] },
    connection: { admit: () => { admits++; return { rejection: 401 } } },
  }
  apply({
    sessions: services.sessions, get: (name) => services[name], on() {},
    effect(fn) { const d = fn(); if (typeof d === 'function') disposers.push(d); return d },
    webServer: { register(row) { routes.set(row.path, row.handler); return () => {} } },
  })
  try {
    assert.ok(routes.size >= 16, `expected all routes registered, got ${routes.size}`)
    for (const [path, handler] of routes) {
      const result = await new Promise((done) => {
        const res = {
          status: 0, body: '',
          writeHead(s) { this.status = s; return this }, setHeader() {}, write(c) { this.body += c; return true },
          end(c) { if (c) this.body += c; done(this) }, on() {}, once() {}, flushHeaders() {},
        }
        handler(req({ url: path, method: 'POST', headers: { host: 'localhost:3094', 'content-type': 'application/json' } }), res)
      })
      assert.equal(result.status, 401, `${path} should be refused`)
      assert.match(result.body, /login required/i, `${path} body`)
    }
    assert.equal(admits, routes.size)
  } finally {
    for (const d of disposers.reverse()) await d()
  }
})
