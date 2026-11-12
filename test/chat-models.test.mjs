import test from 'node:test';
import assert from 'node:assert/strict';
import {createChatController} from '../src/chat-controller.mjs';
const tick=()=>new Promise(resolve=>setImmediate(resolve));
function source(initial){let value=initial;const listeners=new Set();return {getSnapshot:()=>value,subscribe:fn=>{listeners.add(fn);return()=>listeners.delete(fn);},set:next=>{value=next;for(const fn of listeners)fn();},listeners};}
const catalog={default:{provider:'p1',model:'m1'},groups:[{id:'p1',name:'Provider One',models:[{id:'m1',name:'Model One'},{id:'m2',name:'Model Two',reasoning:{efforts:[{id:'high',name:'High'},{id:'low',name:'Low'}],defaultEffort:'low'}}]}],failures:[]};
function fixture({saved=null,catalogResult={ok:true,value:catalog},selectResult,projected={next:null}}={}){
 const calls=[],session=source({running:false,pendingSubmissions:[]}),eventSource=source({entries:[]}),projection=source(projected);
 session.projections={faceOf:name=>{assert.equal(name,'modelSelection');return projection;}};
 session.beginSubmission=()=>({requestId:'req-1',abandon(){}});
 session.prompt=async(...args)=>{calls.push(['prompt',...args]);return {ok:true,value:{}};};
 const binding={session,eventSource},workspaceList=source({phase:'ready',state:'idle',archivedSessionIds:[]});
 const remote={session:{
  modelCatalog:async()=>{calls.push(['catalog']);if(catalogResult instanceof Error)throw catalogResult;return catalogResult;},
  create:async options=>{calls.push(['create',options]);return {ok:true,value:{sessionId:'quickjot-only'}};},
  selectModel:async input=>{calls.push(['select',input]);if(typeof selectResult==='function')return selectResult(input);const result=selectResult??{ok:true,value:{selected:{provider:input.provider,model:input.model,...input.reasoningEffort===undefined?{}:{reasoningEffort:input.reasoningEffort}}}};if(result.ok)projection.set({next:result.value.selected});return result;}
 }};
 const c=createChatController({remote,workspaces:{list:workspaceList},sessions:{retain:()=>({ready:Promise.resolve(binding),release:()=>calls.push(['release'])})},storage:{get:()=>saved,set:id=>{saved=id;}}});
 return {c,calls,projection,session,workspaceList,get saved(){return saved;}};
}
test('catalog loading coalesces and does not create sessions, send prompts or change global defaults',async()=>{
 const f=fixture();const [a,b]=await Promise.all([f.c.loadModels(),f.c.loadModels()]);
 assert.equal(a,b);assert.equal(f.calls.length,1);assert.equal(f.calls[0][0],'catalog');assert.equal(f.saved,null);
 assert.deepEqual(f.c.getSnapshot().modelSelection,catalog.default);assert.equal(f.c.getSnapshot().modelLoading,false);f.c.dispose();
});
test('manual model and effort selection is scoped to the retained quickjot session, with no prompt',async()=>{
 const f=fixture();await f.c.loadModels();
 assert.equal(await f.c.selectModel({provider:'p1',model:'m2',reasoningEffort:'high'}),true);
 assert.equal(f.saved,'quickjot-only');assert.deepEqual(f.calls.filter(call=>call[0]==='select'),[['select',{sessionId:'quickjot-only',provider:'p1',model:'m2',reasoningEffort:'high'}]]);
 assert.deepEqual(f.c.getSnapshot().modelSelection,{provider:'p1',model:'m2',reasoningEffort:'high'});assert.equal(f.calls.some(call=>call[0]==='prompt'),false);f.c.dispose();
});
test('restored and externally changed session model projections are displayed and unsubscribed on dispose',async()=>{
 const f=fixture({saved:'stored',projected:{next:{provider:'p1',model:'m2',reasoningEffort:'high'}}});await f.c.connect();await f.c.loadModels();
 assert.equal(f.c.getSnapshot().modelSelection.reasoningEffort,'high');f.projection.set({next:{provider:'p1',model:'m1'}});assert.equal(f.c.getSnapshot().modelSelection.model,'m1');
 f.projection.set({next:null});assert.deepEqual(f.c.getSnapshot().modelSelection,catalog.default);f.c.dispose();assert.equal(f.projection.listeners.size,0);
});
test('unknown models and unsupported efforts never silently downgrade or reach select/create',async()=>{
 const f=fixture();await f.c.loadModels();
 for(const selection of [{provider:'other',model:'m1'},{provider:'p1',model:'m2',reasoningEffort:'max'},{provider:'p1',model:'m1',reasoningEffort:'high'}])assert.equal(await f.c.selectModel(selection),false);
 assert.match(f.c.getSnapshot().modelError,/推理强度/);assert.equal(f.calls.length,1);assert.deepEqual(f.c.getSnapshot().modelSelection,catalog.default);f.c.dispose();
});
test('catalog errors are visible and do not prevent sending with the existing session configuration',async()=>{
 const f=fixture({saved:'stored',catalogResult:{ok:false,error:{message:'CATALOG_OFFLINE'}}});assert.equal(await f.c.loadModels(),null);
 assert.match(f.c.getSnapshot().modelError,/CATALOG_OFFLINE/);assert.equal(f.c.getSnapshot().modelLoading,false);
 assert.equal(await f.c.send('用户明确发来的消息'),true);assert.equal(f.calls.filter(call=>call[0]==='prompt').length,1);f.c.dispose();
});
test('model selection failure preserves the prior selection and never sends a prompt',async()=>{
 const f=fixture({selectResult:{ok:false,error:{message:'MODEL_UNAVAILABLE'}}});await f.c.loadModels();assert.equal(await f.c.selectModel({provider:'p1',model:'m2'}),false);
 assert.match(f.c.getSnapshot().modelError,/MODEL_UNAVAILABLE/);assert.deepEqual(f.c.getSnapshot().modelSelection,catalog.default);assert.equal(f.c.getSnapshot().modelSelecting,false);assert.equal(f.calls.some(call=>call[0]==='prompt'),false);f.c.dispose();
});
test('send and another selection are blocked until model selection is confirmed, then use the same session',async()=>{
 let confirm;const f=fixture({selectResult:()=>new Promise(resolve=>{confirm=resolve;})});await f.c.loadModels();const changing=f.c.selectModel({provider:'p1',model:'m2'});await tick();
 assert.equal(f.c.getSnapshot().modelSelecting,true);assert.equal(await f.c.send('不能越过切换'),false);assert.equal(await f.c.selectModel({provider:'p1',model:'m1'}),false);
 confirm({ok:true,value:{selected:{provider:'p1',model:'m2'}}});assert.equal(await changing,true);assert.equal(await f.c.send('切换完成再发送'),true);assert.equal(f.calls.filter(call=>call[0]==='create').length,1);assert.equal(f.calls.filter(call=>call[0]==='prompt').length,1);f.c.dispose();
});
test('changing a busy session never reaches the native selection API',async()=>{
 const f=fixture({saved:'stored'});await f.c.connect();await f.c.loadModels();f.session.set({running:true,pendingSubmissions:[]});assert.equal(await f.c.selectModel({provider:'p1',model:'m2'}),false);assert.equal(f.calls.some(call=>call[0]==='select'),false);f.c.dispose();
});
test('model choice cannot bypass an archived or unready workspace',async()=>{
 for(const archived of [false,true]){
  const f=fixture({saved:'stored'});f.workspaceList.set({phase:'ready',state:archived?'idle':'loading',archivedSessionIds:archived?['stored']:[]});await f.c.loadModels();
  assert.equal(await f.c.selectModel({provider:'p1',model:'m2'}),false);assert.equal(f.calls.some(call=>call[0]==='select'||call[0]==='prompt'),false);assert.match(f.c.getSnapshot().modelError,archived?/归档/:/核对/);f.c.dispose();
 }
});
