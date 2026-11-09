import { mkdir, writeFile, readFile, rm } from 'node:fs/promises'
import { homedir } from 'node:os'
import { resolve, join } from 'node:path'
import { Readable } from 'node:stream'
import { apply } from '../index.js'
const [base,sizeText,mode]=process.argv.slice(2), size=Number(sizeText)
if (resolve(homedir()).toLowerCase() !== resolve(join(base,'user')).toLowerCase() || resolve(process.env.DSH_HOME).toLowerCase() !== resolve(join(base,'dsh')).toLowerCase()) throw Error('unsafe fixture')
const dir=join(base,'dsh','running-panel');await mkdir(dir,{recursive:true})
const echoFile=join(dir,'echoes.json')
const echoes=Array.from({length:size},(_,i)=>({id:'e'+i,sessionId:i===0?'old':'s'+i,createdAt:i+1,updatedAt:i+1,title:'title'+i,note:'note'+i,tags:[],anchors:[{messageId:i===0?'m1':'other'+i,index:0,turn:7}],ranges:[{startIndex:0,endIndex:0}],messages:[{id:i===0?'m1':'other'+i,role:'user',text:'hello',index:0}],pending:i===0,pendingAfter:i===0?5:0,meta:{}}))
if (mode !== 'read') await writeFile(echoFile,JSON.stringify({version:1,echoes}))
const listeners={},routes={},disposers=[]
const messages=[{id:'m1',role:'user',content:[{type:'text',text:'hello'}]},{id:'m2',role:'user',content:[{type:'text',text:'second'}]}]
const session={id:'old',header:{},snapshotEvents:()=>[],deriveMessages:()=>messages}
const ctx={sessions:{get:id=>id==='old'?session:undefined,list:()=>[session]},webServer:{register(r){routes[r.path]=r.handler;return ()=>{}}},get(n){return this[n]},on(n,f){listeners[n]=f},effect(f){const d=f();if(typeof d==='function')disposers.push(d)}}
apply(ctx)
async function request(method,query='',body) { const req=Readable.from(body?[JSON.stringify(body)]:[]);req.method=method;req.url='/dsh-running-panel/echo'+query;return await new Promise((resolve,reject)=>{const res={writeHead(status){this.status=status},end(text){resolve({status:this.status,body:JSON.parse(text)})}};Promise.resolve(routes['/dsh-running-panel/echo'](req,res)).catch(reject)}) }
if (mode === 'read') {
  const before=await request('GET','?all=1')
  const disk=JSON.parse(await readFile(echoFile,'utf8'))
  for(const d of disposers.reverse()) d()
  await new Promise(r=>setTimeout(r,150))
  console.log(JSON.stringify({before,disk}))
} else {
const before=await request('GET','?all=1')
if (mode === 'write-failure') await mkdir(echoFile+'.tmp')
const duplicate=await request('POST','',{sessionId:'old',messageId:'m1'})
const beforeCreate=await readFile(echoFile,'utf8')
const created=await request('POST','',{sessionId:'old',messageId:'m2'})
const afterCreate=await readFile(echoFile,'utf8')
if (mode === 'write-failure') await rm(echoFile+'.tmp',{recursive:true,force:true})
const after=await request('GET','?all=1')
listeners['session/event'](session,{type:'user/message',data:{content:'new'}})
await new Promise(r=>setTimeout(r,650))
const disk=JSON.parse(await readFile(echoFile,'utf8'))
for(const d of disposers.reverse()) d()
await new Promise(r=>setTimeout(r,150))
console.log(JSON.stringify({before,duplicate,created,after,disk,beforeCreate,afterCreate}))

}
