import {createHash} from 'node:crypto';
import {z} from 'zod';
export const IN_APP_ROUTE='/api/dsh-quickjot/in-app-reminders';
const idSchema=z.string().regex(/^[a-f0-9]{64}$/);
export const inAppEntrySchema=z.object({id:idSchema,itemId:z.string(),kind:z.enum(['todo','event']),title:z.string().max(200),body:z.string().max(1200),dueAt:z.string().datetime(),createdAt:z.string().datetime(),missed:z.boolean(),announcedAt:z.string().datetime().nullable(),readAt:z.string().datetime().nullable(),cancelled:z.boolean()}).strict();
export const inAppActionSchema=z.discriminatedUnion('op',[
  z.object({op:z.literal('claim')}).strict(),
  z.object({op:z.literal('read'),ids:z.array(idSchema).min(1).max(100)}).strict()
]);
export function inAppKey(item){return createHash('sha256').update(JSON.stringify([item.id,item.dueAt])).digest('hex');}
// Separate from WeChat's queue: a slow channel send must never block application reminders.
export class InAppReminders {
  constructor({records,getItems,now=Date.now}){Object.assign(this,{records,getItems,now});this.chain=Promise.resolve();this.closed=false;this.lastScan=null;}
  serial(fn){const work=this.chain.then(()=>{if(this.closed)throw Error('应用内提醒已停止');return fn();});this.chain=work.catch(()=>{});return work;}
  async close(){this.closed=true;await this.chain;}
  eligible(item,at=this.now()){return item&&!item.done&&['todo','event'].includes(item.kind)&&typeof item.dueAt==='string'&&Number.isFinite(Date.parse(item.dueAt))&&Date.parse(item.dueAt)<=at;}
  current(entry,items){const item=items.get(entry.itemId);return item&&!item.done&&['todo','event'].includes(item.kind)&&item.dueAt===entry.dueAt&&inAppKey(item)===entry.id;}
  async sync(){
    const at=this.now(),stamp=new Date(at).toISOString(),resumed=this.lastScan===null||at-this.lastScan>15000;
    const items=new Map(this.getItems().map(item=>[item.id,item]));
    for(const [id,entry] of this.records.entries()){
      if(!entry.cancelled&&!this.current(entry,items))await this.records.put(id,{...entry,cancelled:true,title:'',body:''});
    }
    for(const item of items.values()){
      if(!this.eligible(item,at))continue;
      const id=inAppKey(item),previous=this.records.get(id),body=(item.body??'').slice(0,1200);
      if(!previous){
        const late=at-Date.parse(item.dueAt);
        await this.records.put(id,inAppEntrySchema.parse({id,itemId:item.id,kind:item.kind,title:item.title,body,dueAt:item.dueAt,createdAt:stamp,missed:late>60000||(resumed&&late>1000),announcedAt:null,readAt:null,cancelled:false}));
      }else if(!previous.cancelled&&(previous.title!==item.title||previous.body!==body||previous.kind!==item.kind)){
        await this.records.put(id,{...previous,title:item.title,body,kind:item.kind});
      }
    }
    this.lastScan=at;
  }
  unread(){
    const items=new Map(this.getItems().map(item=>[item.id,item]));
    return [...this.records.entries()].map(([,entry])=>entry).filter(entry=>!entry.readAt&&!entry.cancelled&&this.current(entry,items)).sort((a,b)=>b.dueAt.localeCompare(a.dueAt)||a.id.localeCompare(b.id));
  }
  snapshot(){
    const all=this.unread();
    return {unread:all.slice(0,100),unreadCount:all.length,truncated:all.length>100,now:new Date(this.now()).toISOString(),timeZone:'Asia/Shanghai',channel:'in-app'};
  }
  list(){return this.serial(async()=>{await this.sync();return this.snapshot();});}
  operate(input){return this.serial(async()=>{
    const action=inAppActionSchema.parse(input);await this.sync();const stamp=new Date(this.now()).toISOString();
    if(action.op==='read'){
      for(const id of new Set(action.ids)){const entry=this.records.get(id);if(entry&&!entry.readAt)await this.records.put(id,{...entry,readAt:stamp});}
      return this.snapshot();
    }
    // Persist presentation claims BEFORE returning, across windows and restarts.
    // A lost reply does not mean read: the same entry remains in the unread inbox.
    const alerts=this.unread().filter(entry=>!entry.announcedAt).slice(0,20);
    for(const entry of alerts)await this.records.put(entry.id,{...entry,announcedAt:stamp,missed:entry.missed||this.now()-Date.parse(entry.dueAt)>60000});
    // Item mutations have their own queue; they may commit while the ledger write awaits.
    await this.sync();
    const latest=new Map(this.unread().map(entry=>[entry.id,entry]));
    return {...this.snapshot(),alerts:alerts.filter(entry=>latest.has(entry.id)).map(entry=>latest.get(entry.id))};
  });}
}
