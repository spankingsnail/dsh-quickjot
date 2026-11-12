import test from 'node:test';
import assert from 'node:assert/strict';
import {Notebook} from '../src/core.mjs';
import {createQuickjotService,EXPLICIT_USER_REQUEST,QUICKJOT_SERVICE,QUICKJOT_SERVICE_CONTRACT_VERSION} from '../src/service.mjs';

function table() {const map=new Map();return {get:key=>map.get(key),entries:()=>map.entries(),put:async(key,value)=>map.set(key,structuredClone(value)),delete:async key=>map.delete(key)};}
function setup(items=table()) {const preferences=table();const notebook=new Notebook({items,preferences,getIm:()=>undefined,now:()=>Date.parse('2030-01-01T00:00:00.000Z')});return {items,notebook,service:createQuickjotService(notebook)};}
const authorization=EXPLICIT_USER_REQUEST;

test('same-host service exposes only versioned list and create with core validation',async()=>{
  const {items,service}=setup();
  assert.equal(QUICKJOT_SERVICE,'dshQuickjot');
  assert.equal(QUICKJOT_SERVICE_CONTRACT_VERSION,1);
  assert.equal(Object.isFrozen(service),true);
  assert.deepEqual(Object.keys(service).sort(),['contractVersion','create','list']);
  assert.equal(service.contractVersion,1);

  const note=await service.create({authorization,kind:'note',title:' 资料 ',body:'正文',tags:['参考','参考']});
  const todo=await service.create({authorization,kind:'todo',title:'行动',dueAt:'2030-01-02T09:00'});
  const missingTime=await service.create({authorization,kind:'event',title:'含糊日程'});
  const event=await service.create({authorization,kind:'event',title:'会议',dueAt:'2030-01-03T10:30'});
  assert.equal(note.ok,true);assert.equal(note.value.title,'资料');assert.deepEqual(note.value.tags,['参考']);
  assert.equal(todo.ok,true);assert.equal(todo.value.dueAt,'2030-01-02T01:00:00.000Z');
  assert.deepEqual(missingTime,{ok:false,error:{code:'create-failed',message:'日程必须指定明确时间；请先询问用户。'}});
  assert.equal(event.ok,true);assert.equal(items.get(event.value.id).reminder,null);

  note.value.title='篡改';note.value.tags.push('污染');
  const listed=service.list();
  assert.equal(listed.ok,true);assert.deepEqual(Object.keys(listed.value).sort(),['items','now','timeZone']);
  assert.equal(listed.value.timeZone,'Asia/Shanghai');assert.equal(listed.value.items.length,3);
  assert.equal(listed.value.items.find(item=>item.id===note.value.id).title,'资料');
  listed.value.items[0].title='再次篡改';
  assert.notEqual(service.list().value.items[0].title,'再次篡改');
});

test('same-host create requires explicit authorization and rejects expanded semantics',async()=>{
  const {service}=setup();
  assert.deepEqual(await service.create({kind:'todo',title:'未授权'}),{ok:false,error:{code:'authorization-required',message:'仅接受用户本人明确要求创建的事项'}});
  assert.equal((await service.create(null)).error.code,'invalid-request');
  for(const extra of [{op:'create'},{done:true},{remindAt:'2030-01-02T09:00'},{target:{botId:'x',targetId:'y'}},{revision:1}]) {
    const result=await service.create({authorization,kind:'todo',title:'越权',...extra});
    assert.equal(result.ok,false);assert.equal(result.error.code,'invalid-request');
  }
  assert.equal(service.list().value.items.length,0);
  assert.equal('update' in service,false);assert.equal('complete' in service,false);assert.equal('delete' in service,false);assert.equal('retry' in service,false);
});

test('same-host create preserves deterministic idempotency across concurrency and restart',async()=>{
  const items=table();const first=setup(items).service;
  const request={authorization,kind:'todo',title:'只创建一次',idempotencyKey:'bridge-call-1'};
  const [a,b]=await Promise.all([first.create(request),first.create(request)]);
  assert.equal(a.ok,true);assert.equal(b.ok,true);assert.equal(a.value.id,b.value.id);assert.equal([...items.entries()].length,1);
  const restarted=setup(items).service;const c=await restarted.create(request);
  assert.equal(c.ok,true);assert.equal(c.value.id,a.value.id);assert.equal([...items.entries()].length,1);
  for(const idempotencyKey of ['', '   ', 42, 'x'.repeat(513)]) {
    const result=await restarted.create({authorization,kind:'todo',title:'无效键',idempotencyKey});
    assert.equal(result.ok,false);assert.equal(result.error.code,'invalid-idempotency-key');
  }
});
