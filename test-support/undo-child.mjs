import os from 'node:os'
import fs from 'node:fs'
import { syncBuiltinESMExports } from 'node:module'
import { resolve, join } from 'node:path'
import { Readable } from 'node:stream'
const [fixture, action, planId] = process.argv.slice(2)
if (!fixture || !resolve(fixture).includes('pulse-undo-child-')) throw new Error('unsafe fixture')
os.homedir = () => resolve(fixture)
if (action === 'crash-before' || action === 'crash-after') {
  const originalRename = fs.promises.rename
  fs.promises.rename = async (from, to) => {
    const expectedFrom = join(resolve(fixture), '.agents', 'skills', 'demo')
    const expectedTo = join(resolve(fixture), '.agents', 'skills-parked', 'demo')
    if (resolve(from) === expectedFrom && resolve(to) === expectedTo) {
      if (action === 'crash-before') process.exit(78)
      await originalRename(from, to)
      process.exit(79)
    }
    return originalRename(from, to)
  }
}
syncBuiltinESMExports()
process.env.DSH_HOME = join(resolve(fixture), '.dsh')
const { apply } = await import('../index.js')
const routes = new Map(), disposers = []
const services = { sessions:{get(){}, list:()=>[]}, skills:{list:async()=>[{name:'demo',description:'test'}]} }
apply({ sessions:services.sessions, get: name=>services[name], on(){}, effect(fn){ const d=fn(); if(typeof d==='function') disposers.push(d) }, webServer:{register(route){routes.set(route.path,route.handler);return ()=>{}}} })
async function req(path, body) {
 const request=Readable.from([JSON.stringify(body)]);request.method='POST';request.url=path
 return await new Promise((done,reject)=>{let code;const response={writeHead(n){code=n},end(text){done({code,body:JSON.parse(text)})}};Promise.resolve(routes.get(path)(request,response)).catch(reject)})
}
let result
if(action==='apply' || action.startsWith('crash-')) {const plan=await req('/dsh-running-panel/optimize',{dryRun:true,pins:{skills:['demo']}});if(action.startsWith('crash-')) process.stdout.write('PLAN '+plan.body.id+'\n');result={planId:plan.body.id, result:await req('/dsh-running-panel/optimize',{planId:plan.body.id,park:['demo']})}}
else if(action==='undo') result=await req('/dsh-running-panel/optimize',{planId,undo:true})
else if(action==='restore') result=await req('/dsh-running-panel/park',{action:'restore',directoryName:'demo'})
else throw new Error('bad action')
for(const dispose of disposers.reverse()) await dispose()
await new Promise(resolve=>setTimeout(resolve,200))
console.log(JSON.stringify(result))
