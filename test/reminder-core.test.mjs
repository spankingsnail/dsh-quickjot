import test from 'node:test';
import assert from 'node:assert/strict';
import {InAppReminders,inAppKey,inAppEntrySchema} from '../src/reminder-core.mjs';
function fixture(){
  let now=Date.parse('2026-11-11T02:00:00Z');const items=[],data=new Map();
  const records={get:id=>data.has(id)?structuredClone(data.get(id)):undefined,entries:()=>[...data].map(([k,v])=>[k,structuredClone(v)]).values(),put:async(id,value)=>{data.set(id,structuredClone(inAppEntrySchema.parse(value)));}};
  const make=()=>new InAppReminders({records,getItems:()=>items,now:()=>now});
  return {items,data,records,make,book:make(),advance:ms=>{now+=ms;},add:overrides=>{const item={id:'item-'+items.length,revision:1,kind:'todo',title:'测试事项',body:'原始内容',done:false,dueAt:new Date(now).toISOString(),reminder:null,...overrides};items.push(item);return item;}};
}
test('future todo and schedule fire only when due; no extra reminderAt is needed',async()=>{
  const f=fixture();f.add({dueAt:'2026-11-11T02:00:05Z'});f.add({kind:'event',dueAt:'2026-11-11T02:00:05Z'});
  assert.equal((await f.book.list()).unreadCount,0);f.advance(5000);
  const result=await f.book.operate({op:'claim'});assert.equal(result.alerts.length,2);assert(result.alerts.every(x=>!x.missed));assert.equal(result.timeZone,'Asia/Shanghai');assert.equal(result.channel,'in-app');
});
test('notes, completed items, no due time, invalid due time and future items are excluded',async()=>{
  const f=fixture();f.add({kind:'note'});f.add({done:true});f.add({dueAt:null});f.add({dueAt:'unknown'});f.add({dueAt:'2027-01-01T00:00:00Z'});
  assert.equal((await f.book.operate({op:'claim'})).unreadCount,0);assert.equal(f.data.size,0);
});
test('application due time is independent of WeChat send time and channel result',async()=>{
  const f=fixture();f.add({reminder:{at:'2027-01-01T00:00:00Z',status:'failed'}});f.add({dueAt:'2027-01-01T00:00:00Z',reminder:{at:'2026-11-11T01:00:00Z',status:'sent'}});
  const result=await f.book.operate({op:'claim'});assert.equal(result.alerts.length,1);assert.equal(result.alerts[0].itemId,f.items[0].id);
});
test('repeated tick and edited title/body/revision do not announce a due time twice',async()=>{
  const f=fixture(),item=f.add();const first=(await f.book.operate({op:'claim'})).alerts[0];item.title='更正后的标题';item.body='更新内容';item.revision++;
  assert.equal((await f.book.operate({op:'claim'})).alerts.length,0);assert.equal((await f.book.list()).unread[0].title,item.title);assert.equal(f.data.size,1);assert.equal(inAppKey(item),first.id);
});
test('presentation is atomically claimed across concurrent windows and survives restart',async()=>{
  const f=fixture();f.add();const [one,two]=await Promise.all([f.book.operate({op:'claim'}),f.book.operate({op:'claim'})]);assert.equal(one.alerts.length+two.alerts.length,1);
  await f.book.close();const restart=f.make(),result=await restart.operate({op:'claim'});assert.equal(result.alerts.length,0);assert.equal(result.unreadCount,1);assert(result.unread[0].announcedAt);
});
test('lost presentation reply remains unread; reading is explicit, idempotent and never completes the item',async()=>{
  const f=fixture(),item=f.add();const result=await f.book.operate({op:'claim'}),id=result.alerts[0].id;
  assert.equal((await f.book.list()).unreadCount,1);assert.equal((await f.book.operate({op:'read',ids:[id,id]})).unreadCount,0);const stamp=f.data.get(id).readAt;f.advance(2000);
  await f.book.operate({op:'read',ids:[id]});assert.equal(f.data.get(id).readAt,stamp);assert.equal(item.done,false);assert.equal(item.revision,1);assert.equal((await f.book.operate({op:'claim'})).alerts.length,0);
});
test('completion and deletion cancel unread/pending alerts and erase cached content',async()=>{
  const f=fixture(),done=f.add(),deleted=f.add();await f.book.list();done.done=true;f.items.splice(f.items.indexOf(deleted),1);
  const result=await f.book.operate({op:'claim'});assert.equal(result.unreadCount,0);assert.equal(result.alerts.length,0);for(const row of f.data.values()){assert(row.cancelled);assert.equal(row.title,'');assert.equal(row.body,'');}
  done.done=false;assert.equal((await f.book.operate({op:'claim'})).alerts.length,0);
});
test('moving a due time cancels the old reminder and creates exactly one new due instance',async()=>{
  const f=fixture(),item=f.add();const old=(await f.book.operate({op:'claim'})).alerts[0].id;item.dueAt='2026-11-11T02:10:00Z';item.revision++;
  assert.equal((await f.book.list()).unreadCount,0);assert(f.data.get(old).cancelled);f.advance(600000);const next=await f.book.operate({op:'claim'});assert.equal(next.alerts.length,1);assert.notEqual(next.alerts[0].id,old);assert.equal((await f.book.operate({op:'claim'})).alerts.length,0);
});
test('clearing time or converting to a note cancels the reminder without changing the source',async()=>{
  const f=fixture(),noTime=f.add(),note=f.add();await f.book.list();noTime.dueAt=null;note.kind='note';assert.equal((await f.book.operate({op:'claim'})).unreadCount,0);assert.equal(noTime.dueAt,null);assert.equal(note.kind,'note');
});
test('restart/long sleep backfills overdue reminders as missed, without reannouncing old claims',async()=>{
  const f=fixture();f.add({dueAt:'2026-11-11T01:59:58Z'});assert.equal((await f.book.operate({op:'claim'})).alerts[0].missed,true);
  f.add({dueAt:'2026-11-11T02:01:00Z'});await f.book.list();f.advance(62000);const late=await f.book.operate({op:'claim'});assert.equal(late.alerts.length,1);assert.equal(late.alerts[0].missed,true);
});
test('a due entry recorded while no GUI is open is labeled missed when first presented much later',async()=>{
  const f=fixture();f.add();assert.equal((await f.book.list()).unread[0].missed,false);f.advance(61000);assert.equal((await f.book.operate({op:'claim'})).alerts[0].missed,true);
});
test('ordinary one-second scan delay is not mislabeled missed',async()=>{
  const f=fixture();await f.book.list();f.add({dueAt:'2026-11-11T02:00:01Z'});f.advance(2000);assert.equal((await f.book.operate({op:'claim'})).alerts[0].missed,false);
});
test('clock rollback does not cancel an already delivered unread instance',async()=>{
  const f=fixture();f.add();await f.book.operate({op:'claim'});f.advance(-3600000);assert.equal((await f.book.list()).unreadCount,1);assert.equal((await f.book.operate({op:'claim'})).alerts.length,0);
});
test('bounded inbox and alert batches preserve full unread count and full source text',async()=>{
  const f=fixture();for(let i=0;i<105;i++)f.add({body:'字'.repeat(2000)});const result=await f.book.operate({op:'claim'});
  assert.equal(result.unread.length,100);assert.equal(result.unreadCount,105);assert.equal(result.truncated,true);assert.equal(result.alerts.length,20);assert.equal(result.unread[0].body.length,1200);assert.equal(f.items[0].body.length,2000);
  await f.book.operate({op:'read',ids:result.unread.map(x=>x.id)});assert.equal((await f.book.list()).unreadCount,5);
});
test('strict actions reject global readAll, malformed IDs and unexpected mutation properties',async()=>{
  const f=fixture();for(const action of [{op:'readAll'},{op:'read',ids:[]},{op:'read',ids:['item-0']},{op:'claim',read:true},{op:'read',ids:['a'.repeat(64)],complete:true}])await assert.rejects(f.book.operate(action));assert.equal(f.items.length,0);
});
test('storage failures do not fabricate a presentation receipt and recover on the next explicit read',async()=>{
  const f=fixture();f.add();await f.book.list();const put=f.records.put;f.records.put=async()=>{throw Error('disk offline');};await assert.rejects(f.book.operate({op:'claim'}),/disk offline/);assert.equal([...f.data.values()][0].announcedAt,null);
  f.records.put=put;assert.equal((await f.book.operate({op:'claim'})).alerts.length,1);
});
test('announcement batches reach every due entry even beyond the bounded inbox window',async()=>{
  const f=fixture();for(let i=0;i<105;i++)f.add();const sizes=[];for(let i=0;i<7;i++)sizes.push((await f.book.operate({op:'claim'})).alerts.length);
  assert.deepEqual(sizes,[20,20,20,20,20,5,0]);assert.equal([...f.data.values()].filter(row=>row.announcedAt).length,105);assert.equal((await f.book.list()).unreadCount,105);
});
test('completion, deletion or reschedule during an awaited presentation write cannot return stale alerts',async()=>{
  for(const change of ['complete','delete','reschedule']){
    const f=fixture(),item=f.add();await f.book.list();const put=f.records.put;let changed=false;
    f.records.put=async(id,value)=>{await put(id,value);if(value.announcedAt&&!changed){changed=true;if(change==='complete')item.done=true;else if(change==='delete')f.items.length=0;else item.dueAt='2027-01-01T00:00:00Z';}};
    const result=await f.book.operate({op:'claim'});assert.equal(result.alerts.length,0,change);assert.equal(result.unreadCount,0,change);assert([...f.data.values()][0].cancelled,change);
  }
});
test('closing stops new work while leaving deduplication data intact',async()=>{
  const f=fixture();f.add();await f.book.list();await f.book.close();await assert.rejects(f.book.list(),/已停止/);assert.equal(f.data.size,1);
});
