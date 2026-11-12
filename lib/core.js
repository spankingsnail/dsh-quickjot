import { randomUUID, createHash } from 'node:crypto';
import { z } from 'zod';
export const NS = 'dsh-quickjot';
export const ROUTE = '/api/dsh-quickjot/items';
const targetSchema = z.object({botId:z.string().min(1).max(128),targetId:z.string().min(1).max(128),routeHash:z.string().optional()}).strict();
function routeHash(target) {if(!target.kind||!target.route)return undefined;const stable=value=>value&&typeof value==='object'?Object.fromEntries(Object.keys(value).sort().map(key=>[key,stable(value[key])])):value;return createHash('sha256').update(JSON.stringify(stable({kind:target.kind,route:target.route}))).digest('hex');}
const reminderSchema = z.object({at:z.string(),state:z.enum(['pending','sending','sent','failed','uncertain','cancelled']),target:targetSchema,missed:z.boolean(),attemptedAt:z.string().nullable(),sentAt:z.string().nullable(),error:z.string().nullable()}).strict();
export const tagsSchema=z.array(z.string().trim().min(1).max(30)).max(12).transform(tags=>[...new Set(tags)]);
export const itemSchema = z.object({id:z.string(),revision:z.number().int().positive(),kind:z.enum(['note','todo','event']),title:z.string().min(1).max(200),body:z.string().max(12000),tags:tagsSchema.default([]),done:z.boolean(),dueAt:z.string().nullable(),reminder:reminderSchema.nullable(),createdAt:z.string(),updatedAt:z.string()}).strict();
export const preferenceSchema = z.object({target:targetSchema.nullable()}).strict();
export function shanghai(value=Date.now()) { return new Intl.DateTimeFormat('sv-SE',{timeZone:'Asia/Shanghai',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit',hourCycle:'h23'}).format(new Date(value)); }
// Wall-clock dates are deliberately NOT interpreted in the machine's local timezone.
export function parseShanghai(value) {
  if(value===null || value==='') return null;
  if(typeof value!=='string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2})?$/.test(value)) throw new Error('时间需明确到日期和时分，格式 YYYY-MM-DDTHH:mm，时区 Asia/Shanghai；不明确先询问。');
  const d=new Date(value+'+08:00');
  if(!Number.isFinite(d.getTime()) || shanghai(d).slice(0,16)!==value.slice(0,16).replace('T',' ')) throw new Error('无效日期或时间');
  return d.toISOString();
}
export function wall(value) {return value ? shanghai(value).slice(0,16).replace(' ','T') : '';}
export class Notebook {
  constructor({items,preferences,getIm,now=Date.now}) { Object.assign(this,{items,preferences,getIm,now}); this.chain=Promise.resolve(); this.stopped=false; this.lastTick=null; this.abort=new AbortController(); }
  serial(fn) { const work=this.chain.then(()=>{if(this.stopped) throw new Error('随手记已卸载'); return fn();}); this.chain=work.catch(()=>{}); return work; }
  async close() { this.stopped=true; this.abort.abort(); await this.chain; }
  snapshot() {return {items:[...this.items.entries()].map(([,v])=>v).sort((a,b)=>b.createdAt.localeCompare(a.createdAt)),preference:this.preferences.get('reminders')??{target:null},now:shanghai(this.now()),timeZone:'Asia/Shanghai'};}
  async boundedDiscovery(operation) {
    const signal=AbortSignal.any([this.abort.signal,AbortSignal.timeout(8000)]);
    signal.throwIfAborted();
    return new Promise((resolve,reject)=>{
      const abort=()=>reject(new Error('微信目标查询超时或插件已停止'));
      signal.addEventListener('abort',abort,{once:true});
      Promise.resolve().then(operation).then(resolve,reject).finally(()=>signal.removeEventListener('abort',abort));
    });
  }
  async targets() {
    const im=this.getIm(); if(!im) return {available:false,targets:[],message:'DSH-IM 服务未启用；便签、待办和日程仍可保存；微信提醒未启用。'};
    try {return await this.boundedDiscovery(async()=>{
      const bots=(await im.listBots()).filter(b=>b.channel==='weixin'); const targets=[];
      for(const bot of bots){ const result=await im.listTargets(bot.botId); const savedTargets=Array.isArray(result)?result:result.targets; for(const t of savedTargets) targets.push({botId:bot.botId,targetId:t.targetId,name:t.name||t.targetId,routeHash:routeHash(t)}); }
      return {available:true,targets,message:targets.length?'只使用已保存的微信投递目标':'本地事项可正常保存；微信提醒未启用，请在设置 → IM机器人 → 微信中测试并保存投递目标。'};
    });} catch {return {available:false,targets:[],message:'微信投递服务暂不可用，请检查 IM机器人连接后刷新；便签、待办和日程仍可保存；微信提醒未启用。'};}
  }
  async validateTarget(target) {if(!target) throw new Error('请先在随手记中选择已保存的默认微信目标，或明确指定已有目标。'); targetSchema.parse(target); const list=await this.targets(); const saved=list.targets.find(t=>t.botId===target.botId&&t.targetId===target.targetId); if(!saved) throw new Error('未找到已保存的微信投递目标，请先在 IM机器人设置中配置。'); if(target.routeHash&&target.routeHash!==saved.routeHash) throw Object.assign(new Error('微信收件目标已修改，请重新确认收件人并设置提醒。'),{code:'target-changed'}); return {botId:target.botId,targetId:target.targetId,...(saved.routeHash?{routeHash:saved.routeHash}:{})};}
  mutate(action,token) {return this.serial(async()=>{
    if(action.op==='preference') {const target=action.target===null?null:await this.validateTarget(action.target); await this.preferences.put('reminders',{target}); return {target};}
    if(action.op==='create') {
      const id=token ? createHash('sha256').update(token).digest('hex').slice(0,32):randomUUID();
      if(this.items.get(id)) return this.items.get(id);
      const data=this.fields(action); const stamp=new Date(this.now()).toISOString();
      let reminder=null;
      if(action.remindAt) { const target=await this.validateTarget(action.target??this.preferences.get('reminders')?.target); reminder=this.reminder(action.remindAt,target); }
      const item=itemSchema.parse({id,revision:1,...data,done:false,reminder,createdAt:stamp,updatedAt:stamp}); await this.items.put(id,item); return item;
    }
    const current=this.items.get(action.id); if(!current) throw new Error('事项不存在，请刷新。');
    if(action.revision!==current.revision) throw new Error('事项已被其他对话修改，请刷新后重试。');
    if(current.reminder?.state==='sending') throw new Error('提醒正在发送，待发送结束后再修改。');
    if(action.op==='delete') {await this.items.delete(current.id); return {deleted:current.id};}
    let next={...current};
    if(action.op==='complete') {next.done=action.done??true; if(next.done&&next.reminder?.state==='pending') next.reminder={...next.reminder,state:'cancelled'};}
    else if(action.op==='retry') {
      if(!current.reminder || !['failed','uncertain'].includes(current.reminder.state)) throw new Error('只有失败或结果不确定的提醒可重试。');
      if(current.done) throw new Error('已完成事项不再提醒');
      next.reminder={...current.reminder,state:'pending',error:null};
    }
    else if(action.op==='update') {
      next={...next,...this.fields({...current,...action,dueAt:action.dueAt===undefined?wall(current.dueAt):action.dueAt})};
      if(action.remindAt!==undefined) next.reminder=action.remindAt ? this.reminder(action.remindAt,await this.validateTarget(action.target??current.reminder?.target??this.preferences.get('reminders')?.target)) : null;
    } else throw new Error('不支持的操作');
    next.revision++; next.updatedAt=new Date(this.now()).toISOString(); itemSchema.parse(next); await this.items.put(next.id,next); return next;
  }); }
  fields(a) {if(!['note','todo','event'].includes(a.kind)) throw new Error('事项类型无效'); if(typeof a.title!=='string'||!a.title.trim()||a.title.length>200) throw new Error('标题须为 1–200 字'); const dueAt=parseShanghai(a.dueAt??null); if(a.kind==='event'&&!dueAt) throw new Error('日程必须指定明确时间；请先询问用户。'); return {kind:a.kind,title:a.title.trim(),body:a.body??'',tags:tagsSchema.parse(a.tags??[]),dueAt};}
  reminder(at,target) {const parsed=parseShanghai(at); if(!parsed || Date.parse(parsed)<=this.now()) throw new Error('提醒时间必须在未来；请确认日期、时分（Asia/Shanghai）。'); return {at:parsed,target,state:'pending',missed:false,attemptedAt:null,sentAt:null,error:null};}
  recover() { return this.serial(async()=>{for(const [,item] of this.items.entries()) if(item.reminder?.state==='sending') await this.items.put(item.id,{...item,revision:item.revision+1,reminder:{...item.reminder,state:'uncertain',error:'上次运行在发送期间中断；为避免重复发送，不自动重试。请核对微信后手动重试。'}});}); }
  tick() {return this.serial(async()=>{
    const resumed=this.lastTick===null || this.now()-this.lastTick>25000;
    this.lastTick=this.now();
    for(const [,candidate] of this.items.entries()) {
      if(this.stopped) return;
      if(candidate.done||candidate.reminder?.state!=='pending'||Date.parse(candidate.reminder.at)>this.now()) continue;
      const at=this.now(),r={...candidate.reminder,state:'sending',missed:at-Date.parse(candidate.reminder.at)>60000 || (resumed && at-Date.parse(candidate.reminder.at)>1000),attemptedAt:new Date(at).toISOString(),error:null};
      let item={...candidate,revision:candidate.revision+1,reminder:r};
      await this.items.put(item.id,item); // Durable claim BEFORE irreversible channel send.
      try {
        const im=this.getIm(); if(!im) throw new Error('DSH-IM 服务不可用');
        await this.validateTarget(r.target);
        const text=`${r.missed?'【错过提醒 · 恢复运行后补发】':'【随手记提醒】'}\n${item.title}\n原定：${shanghai(r.at)}（上海）${item.body?'\n'+item.body.slice(0,1200):''}`;
        const result=await im.send(r.target.botId,r.target.targetId,text,{signal:AbortSignal.any([this.abort.signal,AbortSignal.timeout(30000)]),format:'plain'});
        if(result?.sent!==true) throw Object.assign(new Error('发送未返回确认'),{code:'send-result-unknown'});
        item={...item,reminder:{...r,state:'sent',sentAt:new Date(this.now()).toISOString()}};
      } catch(error) {
        // No automatic retry: timeout / transport errors may already have delivered.
        const definitelyRejected=['unknown-bot','unknown-target','bot-not-connected','account-changed','target-changed','capability-unavailable','provider-unavailable'].includes(error.code)||error.message==='DSH-IM 服务不可用'||error.message.startsWith('未找到');
        item={...item,reminder:{...r,state:definitelyRejected?'failed':'uncertain',error:String(error.code??error.message).slice(0,300)}};
      }
      await this.items.put(item.id,item);
    }
  }); }
}
