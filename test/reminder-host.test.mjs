import test from 'node:test';
import assert from 'node:assert/strict';
import {Notebook} from '../src/core.mjs';
import {mountInAppReminders} from '../src/reminder-host.mjs';
import {IN_APP_ROUTE} from '../src/reminder-core.mjs';
function table(){const data=new Map();return {data,get:id=>data.get(id),entries:()=>data.entries(),put:async(id,value)=>{data.set(id,structuredClone(value));},delete:async id=>data.delete(id)};}
async function fixture(){
  let now=Date.parse('2026-11-11T02:00:00Z'),closed=false,spec;const items=table(),preferences=table(),notifications=table(),effects=[],routes=new Map(),tools=new Map();
  const notebook=new Notebook({items,preferences,getIm:()=>undefined,now:()=>now});
  const ctx={effect:fn=>{const off=fn();if(typeof off==='function')effects.push(off);},storageDomain:{open:async value=>{spec=value;return {table:name=>{assert.equal(name,'notifications');return notifications;},close:async()=>{closed=true;}};}},connection:{fetch:{register:value=>{routes.set(value.path,value);return()=>routes.delete(value.path);}}},tools:{register:value=>{tools.set(value.name,value);return()=>tools.delete(value.name);}}};
  const book=await mountInAppReminders(ctx,notebook),route=routes.get(IN_APP_ROUTE);
  const call=async action=>{const response=await route.fetch(new Request('http://localhost'+IN_APP_ROUTE,action?{method:'POST',body:JSON.stringify(action)}:{}));return {status:response.status,value:await response.json(),headers:response.headers};};
  return {notebook,items,notifications,book,call,routes,tools,get spec(){return spec;},get closed(){return closed;},advance:ms=>{now+=ms;},close:async()=>{for(const off of effects.reverse())await off();await notebook.close();}};
}
test('mount adds a dedicated domain, authenticated shared route and bounded deferred tool, without creating items',async()=>{
  const f=await fixture();try{
    assert.equal(f.spec.name,'dsh_calendar_in_app');assert.equal(f.spec.layout,'per-record');assert.deepEqual(f.routes.get(IN_APP_ROUTE).methods,['GET','POST']);assert.equal(f.items.data.size,0);
    const tool=f.tools.get('dsh_calendar_in_app_reminders');assert.equal(tool.deferLoading,true);assert.deepEqual(tool.parameters.properties.op.enum,['list','read']);assert.equal(tool.parameters.properties.ids.maxItems,100);assert.equal((await tool.execute({op:'list'})).unreadCount,0);
    const result=await f.call();assert.equal(result.headers.get('cache-control'),'no-store');assert.equal(result.value.channel,'in-app');
  }finally{await f.close();}assert.equal(f.closed,true);assert.equal(f.routes.size,0);assert.equal(f.tools.size,0);
});
test('real Notebook create to due HTTP claim to explicit read works without WeChat and without completing the original task',async()=>{
  const f=await fixture();try{
    const todo=await f.notebook.mutate({op:'create',kind:'todo',title:'十点待办',dueAt:'2026-11-11T10:01'}),event=await f.notebook.mutate({op:'create',kind:'event',title:'十点日程',dueAt:'2026-11-11T10:01'});
    assert.equal(todo.reminder,null);assert.equal((await f.call({op:'claim'})).value.unreadCount,0);f.advance(60000);
    const claim=await f.call({op:'claim'});assert.equal(claim.status,200);assert.equal(claim.value.alerts.length,2);assert.equal(claim.value.unreadCount,2);assert.equal((await f.call({op:'claim'})).value.alerts.length,0);
    const read=await f.call({op:'read',ids:claim.value.unread.map(x=>x.id)});assert.equal(read.value.unreadCount,0);assert.equal(f.items.get(todo.id).done,false);assert.equal(f.items.get(todo.id).revision,1);assert.equal(f.items.get(event.id).reminder,null);
  }finally{await f.close();}
});
test('tool and UI share unread state; original item completion/deletion/reschedule cancels exactly the corresponding notification',async()=>{
  const f=await fixture();try{
    const todo=await f.notebook.mutate({op:'create',kind:'todo',title:'完成后取消',dueAt:'2026-11-11T10:00'}),event=await f.notebook.mutate({op:'create',kind:'event',title:'改期后重建',dueAt:'2026-11-11T10:00'});
    const tool=f.tools.get('dsh_calendar_in_app_reminders'),first=await tool.execute({op:'list'});assert.equal(first.unreadCount,2);await f.notebook.mutate({op:'complete',id:todo.id,revision:1});
    await f.notebook.mutate({op:'update',id:event.id,revision:1,dueAt:'2026-11-11T10:02'});assert.equal((await f.call()).value.unreadCount,0);f.advance(120000);
    const next=(await f.call({op:'claim'})).value;assert.equal(next.alerts.length,1);assert.equal(next.alerts[0].itemId,event.id);
    await tool.execute({op:'read',ids:[next.alerts[0].id]});assert.equal((await f.call()).value.unreadCount,0);assert.equal(f.items.get(event.id).done,false);
    await assert.rejects(tool.execute({op:'claim'}),/仅支持/);
  }finally{await f.close();}
});
test('strict shared endpoint rejects malformed or oversized requests and unsupported readAll',async()=>{
  const f=await fixture();try{
    for(const body of ['{',JSON.stringify({op:'readAll'}),JSON.stringify({op:'read',ids:[]}),JSON.stringify({op:'claim',complete:true})]){
      const response=await f.routes.get(IN_APP_ROUTE).fetch(new Request('http://localhost'+IN_APP_ROUTE,{method:'POST',body}));assert.equal(response.status,400);assert.equal(typeof (await response.json()).error,'string');
    }
    const tooLarge=await f.routes.get(IN_APP_ROUTE).fetch(new Request('http://localhost'+IN_APP_ROUTE,{method:'POST',body:'x'.repeat(16001)}));assert.equal(tooLarge.status,413);assert.equal(f.items.data.size,0);
  }finally{await f.close();}
});
test('slow or blocked WeChat mutation queue cannot block local due reminder discovery',async()=>{
  const f=await fixture();try{
    await f.notebook.mutate({op:'create',kind:'todo',title:'不被微信阻塞',dueAt:'2026-11-11T10:00'});const previous=f.notebook.chain;
    f.notebook.chain=new Promise(()=>{});try{const result=await f.call({op:'claim'});assert.equal(result.value.alerts.length,1);}finally{f.notebook.chain=previous;}
  }finally{await f.close();}
});
test('domain still closes and the route is removed after an in-flight ledger write fails',async()=>{
  const f=await fixture();await f.notebook.mutate({op:'create',kind:'todo',title:'故障夹具',dueAt:'2026-11-11T10:00'});const put=f.notifications.put;
  f.notifications.put=async()=>{throw Error('read-only disk');};const failure=await f.call({op:'claim'});assert.equal(failure.status,400);assert.match(failure.value.error,/read-only disk/);
  f.notifications.put=put;await f.close();assert.equal(f.closed,true);assert.equal(f.routes.size,0);
});
