import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, mkdir, writeFile, readFile, rm, rename, realpath } from 'node:fs/promises'
import { execFile } from 'node:child_process'
import { dirname, join, resolve, basename } from 'node:path'
import { fileURLToPath } from 'node:url'
const root=await realpath(dirname(fileURLToPath(import.meta.url)))
async function fixture(run) {
  const dir=await mkdtemp(join(root,'pulse-undo-child-'))
  try { await run(dir) } finally {
    assert.equal(dirname(resolve(dir)),root);assert.match(basename(dir),/^pulse-undo-child-[A-Za-z0-9]+$/)
    await rm(dir,{recursive:true,force:true})
  }
}
const live=(p)=>join(p,'.agents','skills','demo'), cold=(p)=>join(p,'.agents','skills-parked','demo')
async function make(dir,text='original') {await mkdir(dir,{recursive:true});await writeFile(join(dir,'SKILL.md'),`---\nname: demo\ndescription: test\n---\n${text}`)}
async function child(dir,action,id='') {
  const result=await new Promise((done)=>execFile(process.execPath,[resolve('test-support/undo-child.mjs'),dir,action,id],{encoding:'utf8',timeout:10000},(error,stdout,stderr)=>done({error,stdout,stderr})))
  assert.equal(result.error,null,result.stderr||result.stdout)
  return JSON.parse(result.stdout.trim().split('\n').at(-1))
}
test('undo works after a real process restart',()=>fixture(async dir=>{
  await make(live(dir));const applied=await child(dir,'apply');assert.equal(applied.result.body.moved,1)
  const undone=await child(dir,'undo',applied.planId);assert.equal(undone.body.ok,true,JSON.stringify(undone));assert.match(await readFile(join(live(dir),'SKILL.md'),'utf8'),/original/)
}))
test('undo conflict survives restart and is retryable',()=>fixture(async dir=>{
  await make(live(dir));const applied=await child(dir,'apply');await make(live(dir),'conflict')
  const fail=await child(dir,'undo',applied.planId);assert.notEqual(fail.body.ok,true);assert.match(await readFile(join(live(dir),'SKILL.md'),'utf8'),/conflict/)
  await rm(live(dir),{recursive:true,force:true});const retry=await child(dir,'undo',applied.planId);assert.equal(retry.body.ok,true,JSON.stringify(retry));assert.match(await readFile(join(live(dir),'SKILL.md'),'utf8'),/original/)
}))
test('replacement cold directory is never restored as owned',()=>fixture(async dir=>{
  await make(live(dir));const applied=await child(dir,'apply');await rename(cold(dir),cold(dir)+'-original');await make(cold(dir),'replacement')
  const result=await child(dir,'undo',applied.planId);assert.notEqual(result.body.ok,true);assert.match(await readFile(join(cold(dir),'SKILL.md'),'utf8'),/replacement/)
}))
test('ordinary restore retires old plan across restart',()=>fixture(async dir=>{
  await make(live(dir));const applied=await child(dir,'apply');assert.equal((await child(dir,'restore')).body.ok,true)
  const second=await child(dir,'apply');assert.equal(second.result.body.moved,1)
  const old=await child(dir,'undo',applied.planId);assert.notEqual(old.body.ok,true)
  assert.match(await readFile(join(cold(dir),'SKILL.md'),'utf8'),/original/)
  const undoSecond=await child(dir,'undo',second.planId);assert.equal(undoSecond.body.ok,true,JSON.stringify(undoSecond))
}))

async function crashingChild(dir,action) {
  const r=await new Promise(done=>execFile(process.execPath,[resolve('test-support/undo-child.mjs'),dir,action],{encoding:'utf8',timeout:10000},(error,stdout,stderr)=>done({error,stdout,stderr})))
  assert.equal(r.error?.code,action === 'crash-before' ? 78 : 79,r.stderr||r.stdout)
  const id=/PLAN (plan-[^\s]+)/.exec(r.stdout)?.[1];assert.ok(id,r.stdout);return id
}
test('crash immediately before directory rename leaves original intact',()=>fixture(async dir=>{
  await make(live(dir));await crashingChild(dir,'crash-before');assert.match(await readFile(join(live(dir),'SKILL.md'),'utf8'),/original/)
}))
test('crash immediately after directory rename is recoverable in a new process',()=>fixture(async dir=>{
  await make(live(dir));const id=await crashingChild(dir,'crash-after');assert.match(await readFile(join(cold(dir),'SKILL.md'),'utf8'),/original/)
  const undone=await child(dir,'undo',id);assert.equal(undone.body.ok,true,JSON.stringify(undone));assert.match(await readFile(join(live(dir),'SKILL.md'),'utf8'),/original/)
}))

for (const [label, corrupted] of [ ['invalid JSON', '{broken'], ['unknown version', '{"version":999,"plans":[]}'] ]) {
  test('corrupt or unknown undo journal fails closed without overwriting: ' + label,()=>fixture(async dir=>{
    await make(live(dir));const store=join(dir,'.dsh','running-panel');await mkdir(store,{recursive:true})
    const journal=join(store,'undo.json');await writeFile(journal,corrupted)
    const result=await child(dir,'apply');assert.notEqual(result.result.body.ok,true,JSON.stringify(result))
    assert.equal(await readFile(journal,'utf8'),corrupted);assert.match(await readFile(join(live(dir),'SKILL.md'),'utf8'),/original/)
  }))
}
