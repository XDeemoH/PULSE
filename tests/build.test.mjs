import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { buildClient } from '../tools/build-client.mjs'

test('client.js is exactly the concatenation of client/NN-*.js (run tools/build-client.mjs after editing)', () => {
  const built = buildClient()
  const shipped = readFileSync(new URL('../client.js', import.meta.url), 'utf8')
  assert.ok(built === shipped, 'client.js is out of date: run `node tools/build-client.mjs`')
  assert.doesNotThrow(() => new Function(shipped), 'client.js parses')
})
