#!/usr/bin/env node
/**
 * client.js 由 client/NN-*.js 按文件名顺序原样拼接而成（不打包、不转译）。
 * 各片段共享同一个 __ModuleLoader__ 工厂闭包，所以顺序就是原来的源码顺序。
 *
 *   node tools/build-client.mjs          重新生成 client.js
 *   node tools/build-client.mjs --check  只检查 client.js 是否与片段一致（CI / 测试用）
 */
import { readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(fileURLToPath(new URL('.', import.meta.url)), '..')
/** 片段里的 __PULSE_CLIENT_VERSION__ 在构建时换成 package.json 的版本：界面靠它发现 Host 还是旧版。 */
export function buildClient() {
  const dir = join(root, 'client')
  const version = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8')).version
  return readdirSync(dir)
    .filter((name) => /^\d{2}-[a-z0-9-]+\.js$/.test(name))
    .sort()
    .map((name) => readFileSync(join(dir, name), 'utf8'))
    .join('')
    .split('__PULSE_CLIENT_' + 'VERSION__')
    .join(version)
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const built = buildClient()
  const target = join(root, 'client.js')
  if (process.argv.includes('--check')) {
    if (readFileSync(target, 'utf8') !== built) {
      console.error('client.js is out of date: run `node tools/build-client.mjs`')
      process.exitCode = 1
    } else console.log('client.js is up to date')
  } else {
    writeFileSync(target, built)
    console.log('wrote client.js (' + built.length + ' chars)')
  }
}
