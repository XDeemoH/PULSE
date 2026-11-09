import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import vm from 'node:vm'

const source = readFileSync(new URL('../index.js', import.meta.url), 'utf8').replace(/\r\n/g, '\n')

/**
 * 只抽出 alertsFor 这一段：index.js 是 Host 半边，整体 import 会拖进 DSH 服务，
 * 但这段逻辑本身是纯函数（只依赖 buildCatalog 的 tagOf 和两个阈值）。
 */
function alertsRuntime() {
  const match = source.match(/function alertsFor\(state\) \{[\s\S]*?\n {2}\}\n/)
  assert.ok(match, 'alertsFor exists')
  const context = vm.createContext({})
  vm.runInContext(
    'const STUCK_ERROR_STREAK = 3\n' +
      'const STUCK_REPEAT_CALLS = 12\n' +
      'const CATALOG_KNOWN = { tagOf: { "tool:pwsh": "ops", "tool:web_fetch": "web", "tool:read": "files" } }\n' +
      'function buildCatalog() { return CATALOG_KNOWN }\n' +
      match[0] +
      '\nthis.alertsFor = alertsFor',
    context,
  )
  return context.alertsFor
}

const alertsFor = alertsRuntime()

test('routine official tools are not reported as stuck', () => {
  const alerts = alertsFor({
    tools: {
      pwsh: { round: 20, streak: 0 },
      web_fetch: { round: 15, streak: 0 },
      read: { round: 13, streak: 0 },
    },
  })
  assert.equal(alerts.length, 0)
})

test('an unregistered tool called many times in one round is reported', () => {
  const alerts = alertsFor({ tools: { craft_anything_probe: { round: 12, streak: 0 } } })
  assert.equal(alerts.length, 1)
  assert.equal(alerts[0].kind, 'repeat')
  assert.equal(alerts[0].tool, 'craft_anything_probe')
})

test('consecutive failures still report for official tools', () => {
  const alerts = alertsFor({ tools: { pwsh: { round: 4, streak: 3 } } })
  assert.equal(alerts.length, 1)
  assert.equal(alerts[0].kind, 'errors')
  assert.equal(alerts[0].count, 3)
})

test('alerts are sorted by count, worst first', () => {
  const alerts = alertsFor({
    tools: {
      custom_a: { round: 14, streak: 0 },
      custom_b: { round: 30, streak: 0 },
      pwsh: { round: 40, streak: 0 },
    },
  })
  assert.equal(alerts.length, 2)
  assert.equal(alerts[0].tool, 'custom_b')
  assert.equal(alerts[1].tool, 'custom_a')
})
