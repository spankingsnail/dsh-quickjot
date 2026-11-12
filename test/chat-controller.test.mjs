import test from 'node:test';
import assert from 'node:assert/strict';
import {chatMessages,createChatController} from '../src/chat-controller.mjs';
function source(initial){let value=initial;const listeners=new Set();return {getSnapshot:()=>value,subscribe:fn=>{listeners.add(fn);return()=>listeners.delete(fn);},set:v=>{value=v;for(const fn of listeners)fn();},listeners};}
function fixture({saved=null,createResult={ok:true,value:{sessionId:'chat-1'}},deferredReady=false,promptResult}={}){
 const snapshot={running:false,pendingSubmissions:[],awaitingFirstTurn:false},session=source(snapshot),events=source({entries:[]});
 const calls=[],submissions=[],prompts=[],states=[];let releases=0,refreshes=0,ready;
 session.beginSubmission=input=>{submissions.push(input);return {requestId:'native-'+submissions.length,abandon:()=>calls.push('abandon')};};
 session.prompt=async(...args)=>{assert.equal(submissions.length,prompts.length+1,'register local echo BEFORE each actual prompt');prompts.push(args);if(promptResult instanceof Error)throw promptResult;if(typeof promptResult==='function')return promptResult(...args);return promptResult??new Promise(()=>{});};
 const binding={session,eventSource:events,sessionId:'chat-1'};
 const readyPromise=deferredReady?new Promise(resolve=>{ready=resolve;}):Promise.resolve(binding);
 const c=createChatController({sessions:{retain:(id,options)=>{calls.push(['retain',id,options]);return {ready:readyPromise,release:()=>{releases++;}};}},remote:{session:{create:async options=>{calls.push(['create',options]);return createResult;}}},storage:{get:()=>saved,set:id=>{saved=id;}},onChange:s=>states.push(s),onSettled:()=>{refreshes++;}});
 return {c,calls,submissions,prompts,states,session,events,binding,get saved(){return saved;},get releases(){return releases;},get refreshes(){return refreshes;},resolve:()=>ready(binding)};
}
const tick=()=>new Promise(resolve=>setImmediate(resolve));
test('initial page read creates no conversation and sends no model prompt',async()=>{
 const f=fixture();await f.c.connect();assert.deepEqual(f.calls,[]);assert.equal(f.submissions.length,0);f.c.dispose();
});
test('first explicit submit creates one session and uses native admission, not success fiction',async()=>{
 const f=fixture();await f.c.connect();const pending=f.c.send('记下一个灵感');await tick();assert.equal(f.saved,'chat-1');assert.equal(f.submissions[0].text,'记下一个灵感');assert.deepEqual(f.submissions[0].attachments,[]);assert.equal(f.c.getSnapshot().sending,true);
 assert.deepEqual(f.prompts,[[[{type:'text',text:'记下一个灵感'}],'queue',undefined,'native-1']]);
 assert.equal(await f.c.send('重复点击'),false);f.submissions[0].onAccept();assert.equal(await pending,true);assert.equal(f.c.getSnapshot().messages.length,0);
 assert.equal(f.calls.filter(c=>c[0]==='create').length,1);f.c.dispose();assert.equal(f.releases,1);
});
test('reload reuses exact session and follows real user/assistant events, not reasoning or tool text',async()=>{
 const f=fixture({saved:'existing'});await f.c.connect();assert.equal(f.calls[0][1],'existing');
 f.events.set({entries:[{type:'event',event:{seq:1,type:'user/message',data:{role:'user',source:{kind:'user'},content:[{type:'text',text:'明天下午三点'}]}}},{type:'event',event:{seq:2,type:'assistant/message',data:{turn:1,message:{role:'assistant',content:[{type:'reasoning',text:'private'},{type:'text',text:'请确认日期'}]}}}},{type:'event',event:{seq:3,type:'turn/end',data:{turn:1,reason:{kind:'completed'}}}},{type:'transient',event:{type:'assistant/live-chunk'}}]});
 assert.deepEqual(f.c.getSnapshot().messages.map(m=>m.text),['明天下午三点','请确认日期']);assert.equal(f.calls.filter(c=>c[0]==='create').length,0);f.c.dispose();
});
test('settlement refreshes shared list and replaced event window does not accumulate old messages',async()=>{
 const f=fixture({saved:'existing'});await f.c.connect();f.session.set({running:true});assert.equal(await f.c.send('blocked'),false);f.session.set({running:false});assert.equal(f.refreshes,0,'idle alone is not completion');f.events.set({entries:[turnEnd(1,1)]});assert.equal(f.refreshes,1);
 f.events.set({entries:[]});assert.deepEqual(f.c.getSnapshot().messages,[]);f.c.dispose();
});
test('native rejection preserves failure and no UI automatic retry or replacement session',async()=>{
 const f=fixture({saved:'existing'});const p=f.c.send('保留这条草稿');await tick();f.submissions[0].onRetire({reason:'failed'});assert.equal(await p,false);assert.match(f.c.getSnapshot().error,/未被接受/);assert.equal(f.submissions.length,1);f.c.dispose();
});
test('remote create failure is visible, no fake message, retry remains explicit',async()=>{
 const f=fixture({createResult:{ok:false,error:new Error('模型会话创建失败')}});assert.equal(await f.c.send('hello'),false);assert.match(f.c.getSnapshot().error,/创建失败/);assert.equal(f.saved,null);assert.equal(f.submissions.length,0);f.c.dispose();
});
test('unload releases subscriptions once, and late ready never sends',async()=>{
 const f=fixture({saved:'existing',deferredReady:true});const p=f.c.send('not sent');await tick();f.c.dispose();f.c.dispose();f.resolve();assert.equal(await p,false);assert.equal(f.releases,1);assert.equal(f.submissions.length,0);assert.equal(f.session.listeners.size,0);assert.equal(f.events.listeners.size,0);
});
test('unload while admission waits releases only this UI, not the native submission',async()=>{
 const f=fixture({saved:'existing'});const p=f.c.send('记下明天的想法');await tick();f.c.dispose();assert.equal(await p,false);assert.equal(f.releases,1);assert.equal(f.calls.includes('abandon'),false);f.submissions[0].onAccept();
});
test('native pending submission blocks another send before running event arrives',async()=>{
 const f=fixture({saved:'existing'});await f.c.connect();f.session.set({running:false,pendingSubmissions:[{requestId:'pending'}]});assert.equal(await f.c.send('duplicate'),false);assert.equal(f.submissions.length,0);f.c.dispose();
});
test('actual SessionFace prompt receipt accepts without fabricated callback or message',async()=>{
 const f=fixture({saved:'existing',promptResult:{ok:true,value:{accepted:true}}});assert.equal(await f.c.send('只查询'),true);assert.equal(f.prompts.length,1);assert.equal(f.c.getSnapshot().messages.length,0);f.c.dispose();
});
test('actual prompt error retires echo without retry or replacing session',async()=>{
 const f=fixture({saved:'existing',promptResult:{ok:false,error:new Error('无权提交消息')}});assert.equal(await f.c.send('保留草稿'),false);assert.match(f.c.getSnapshot().error,/无权/);assert.deepEqual(f.calls.filter(c=>c==='abandon'),['abandon']);assert.equal(f.prompts.length,1);assert.equal(f.saved,'existing');f.c.dispose();
});
test('prompt transport rejection is surfaced without automatic resend',async()=>{
 const f=fixture({saved:'existing',promptResult:new Error('网络断开')});assert.equal(await f.c.send('保留草稿'),false);assert.match(f.c.getSnapshot().error,/网络断开/);assert.equal(f.prompts.length,1);assert.equal(f.calls.includes('abandon'),true);f.c.dispose();
});
test('ready binding with openState error is not treated as an open session',async()=>{
 const f=fixture({saved:'existing'});f.session.set({openState:'error',openError:{message:'会话不存在'}});assert.equal(await f.c.send('不能发送'),false);assert.match(f.c.getSnapshot().error,/会话不存在/);assert.equal(f.submissions.length,0);assert.equal(f.prompts.length,0);assert.equal(f.saved,'existing');assert.equal(f.releases,1);f.c.dispose();assert.equal(f.releases,1);
});
const assistantEvent=(seq,turn,content,extra={})=>({type:'event',event:{seq,type:'assistant/message',data:{turn,message:{role:'assistant',content},...extra}}});
const turnEnd=(seq,turn,kind='completed')=>({type:'event',event:{seq,type:'turn/end',data:{turn,reason:{kind}}}});
test('answer-only view hides commentary, reasoning, tools and exposes only final answer',()=>{
 const entries=[assistantEvent(1,1,[{type:'text',text:'我先检查一下'},{type:'tool-call',name:'dsh_calendar_list',arguments:'secret'}]),{type:'event',event:{seq:2,type:'tool/result',data:{text:'private result'}}},assistantEvent(3,1,[{type:'text',text:'接下来我会核对'}]),assistantEvent(4,1,[{type:'reasoning',text:'private thought'},{type:'text',text:'现有事项共 0 条。'}]),turnEnd(5,1)];
 assert.deepEqual(chatMessages(entries).map(m=>m.text),['现有事项共 0 条。']);
});
test('in-progress assistant text is hidden until completed turn event',()=>{
 const entries=[{type:'event',event:{seq:1,type:'user/message',data:{role:'user',source:{kind:'user'},content:[{type:'text',text:'查询事项'}]}}},assistantEvent(2,1,[{type:'text',text:'查询中'}])];assert.deepEqual(chatMessages(entries).map(m=>m.text),['查询事项']);
 assert.deepEqual(chatMessages([...entries,turnEnd(3,1)]).map(m=>m.text),['查询事项','查询中']);
});
test('aborted, blocked, interrupted and failed turns never present commentary as success',()=>{
 for(const kind of ['aborted','blocked','error','interrupted','max-tokens'])assert.deepEqual(chatMessages([assistantEvent(1,1,[{type:'text',text:'还在检查'}]),turnEnd(2,1,kind)]),[],kind);
});
test('last assistant must be non-interrupted and not call a tool; no fallback to earlier commentary',()=>{
 const earlier=assistantEvent(1,1,[{type:'text',text:'准备执行'}]);for(const last of [assistantEvent(2,1,[{type:'text',text:'调用中'},{type:'tool-call',name:'test'}]),assistantEvent(2,1,[{type:'text',text:'半截结果'}],{interrupted:true}),assistantEvent(2,1,[{type:'reasoning',text:'hidden'}])])assert.deepEqual(chatMessages([earlier,last,turnEnd(3,1)]),[]);
});
test('completed history stays visible while new turn hides intermediate text',()=>{
 const entries=[assistantEvent(1,1,[{type:'text',text:'上一条最终答复'}]),turnEnd(2,1),assistantEvent(3,2,[{type:'text',text:'正在查询第二条'}])];assert.deepEqual(chatMessages(entries).map(m=>m.text),['上一条最终答复']);
 assert.deepEqual(chatMessages([...entries,assistantEvent(4,2,[{type:'text',text:'第二条最终答复'}]),turnEnd(5,2)]).map(m=>m.text),['上一条最终答复','第二条最终答复']);
});
test('user/message provenance excludes runtime contexts even with a user role, not based on text',()=>{
 const user=(seq,source,text)=>({type:'event',event:{seq,type:'user/message',data:{role:'user',source,content:[{type:'text',text}]}}});
 const entries=[user(1,{kind:'user'},'明天上午九点登录系统'),user(2,{kind:'system-prompt'},'Current runtime context. This snapshot supersedes earlier runtime-context snapshots.'),user(3,{kind:'system-prompt'},'Time sampled while preparing turn'),user(4,undefined,'unidentified injected prompt'),user(5,{kind:'tool'},'tool message'),user(6,{kind:'user'},'请记下原文：Current runtime context.（这是我的文字）')];
 assert.deepEqual(chatMessages(entries).map(m=>m.id),['1','6']);assert.equal(entries.length,6,'view filter must not delete original events');
});
test('text extraction ignores tools, live chunks and non-text content',()=>{
 assert.deepEqual(chatMessages([{type:'event',event:{type:'tool/result',data:{text:'secret'}}},{type:'event',event:{type:'assistant/message',seq:5,data:{message:{role:'assistant',content:[{type:'reasoning',text:'hidden'}]}}}}]),[]);
});
const human=(seq,text='查询事项')=>({type:'event',event:{seq,type:'user/message',data:{role:'user',source:{kind:'user'},content:[{type:'text',text}]}}});
test('receipt remains visible and blocks duplicates before native busy snapshots arrive',async()=>{
 const f=fixture({saved:'existing',promptResult:{ok:true,value:{accepted:true}}});await f.c.send('查询事项');
 assert.equal(f.c.getSnapshot().delivery,'accepted');assert.equal(f.c.getSnapshot().requestId,'native-1');assert.equal(f.c.getSnapshot().running,true);assert.deepEqual(f.c.getSnapshot().messages,[]);
 assert.equal(await f.c.send('查询事项'),false);f.session.set({running:true});assert.equal(f.c.getSnapshot().delivery,'processing');f.c.dispose();
});
test('explicit admission failure survives unrelated session and runtime-context synchronization',async()=>{
 const f=fixture({saved:'existing',promptResult:{ok:false,error:new Error('没有提交权限')}});assert.equal(await f.c.send('保留草稿'),false);
 f.session.set({running:false});f.events.set({entries:[{type:'event',event:{seq:1,type:'user/message',data:{role:'user',source:{kind:'system-prompt'},content:[{type:'text',text:'runtime'}]}}}]});
 assert.equal(f.c.getSnapshot().delivery,'failed');assert.match(f.c.getSnapshot().error,/没有提交权限/);assert.equal(f.prompts.length,1);f.c.dispose();
});
test('late transport failure after native acceptance is uncertain, not abandoned or silently lost',async()=>{
 let rejectPrompt;const f=fixture({saved:'existing',promptResult:()=>new Promise((_resolve,reject)=>{rejectPrompt=reject;})});
 const p=f.c.send('查询');await tick();f.submissions[0].onAccept();assert.equal(await p,true);rejectPrompt(Error('接收之后连接断开'));await tick();
 assert.equal(f.c.getSnapshot().delivery,'uncertain');assert.match(f.c.getSnapshot().error,/连接断开/);assert.equal(f.calls.includes('abandon'),false);assert.equal(f.prompts.length,1);
 f.session.set({running:false});assert.equal(f.c.getSnapshot().delivery,'uncertain');f.c.dispose();
});
test('late business rejection after native acceptance remains visible and never abandons accepted work',async()=>{
 let reply;const f=fixture({saved:'existing',promptResult:()=>new Promise(resolve=>{reply=resolve;})});
 const p=f.c.send('查询');await tick();f.submissions[0].onAccept();assert.equal(await p,true);reply({ok:false,error:Error('后到的失败回执')});await tick();
 assert.equal(f.c.getSnapshot().delivery,'uncertain');assert.match(f.c.getSnapshot().error,/失败回执/);assert.equal(f.calls.includes('abandon'),false);f.c.dispose();
});
test('old completed history cannot settle a new receipt; fast committed completion refreshes without a running edge',async()=>{
 const f=fixture({saved:'existing',promptResult:{ok:true,value:{accepted:true}}});await f.c.connect();
 f.events.set({entries:[human(1),assistantEvent(2,1,[{type:'text',text:'旧答复'}]),turnEnd(3,1)]});assert.equal(f.refreshes,1);
 await f.c.send('查询下一条');assert.equal(f.c.getSnapshot().delivery,'accepted');assert.equal(f.c.getSnapshot().running,true);
 f.events.set({entries:[human(1),assistantEvent(2,1,[{type:'text',text:'旧答复'}]),turnEnd(3,1),human(4,'查询下一条'),assistantEvent(5,2,[{type:'text',text:'还需要你确认时间。'}]),turnEnd(6,2)]});
 assert.equal(f.c.getSnapshot().delivery,'answered');assert.equal(f.c.getSnapshot().running,false);assert.equal(f.refreshes,2);
 assert.equal(f.c.getSnapshot().messages.at(-1).text,'还需要你确认时间。');f.session.set({running:false});assert.equal(f.refreshes,2);f.c.dispose();
});
test('failed, blocked and stopped turns have distinct feedback and never expose intermediate text as an answer',async()=>{
 for(const [kind,delivery] of [['error','failed'],['max-tokens','failed'],['blocked','blocked'],['aborted','stopped'],['interrupted','stopped'],['forked','stopped']]){
  const f=fixture({saved:'existing'});await f.c.connect();const end=turnEnd(3,1,kind);if(kind==='error')end.event.data.reason.error={message:'模型额度已用完'};
  f.events.set({entries:[human(1),assistantEvent(2,1,[{type:'text',text:'中间执行过程'}]),end]});assert.equal(f.c.getSnapshot().delivery,delivery,kind);
  assert.deepEqual(f.c.getSnapshot().messages.map(m=>m.text),['查询事项']);if(kind==='error')assert.match(f.c.getSnapshot().error,/额度已用完/);f.c.dispose();
 }
});
test('completed turn without final text has explicit no-answer status instead of borrowing commentary',async()=>{
 const f=fixture({saved:'existing'});await f.c.connect();f.events.set({entries:[human(1),assistantEvent(2,1,[{type:'text',text:'先查询'}]),assistantEvent(3,1,[{type:'tool-call',name:'dsh_calendar_list'}]),turnEnd(4,1)]});
 assert.equal(f.c.getSnapshot().delivery,'no-answer');assert.deepEqual(f.c.getSnapshot().messages.map(m=>m.text),['查询事项']);f.c.dispose();
});
test('callbacks from an older failed request cannot overwrite a later accepted request',async()=>{
 let index=0;const f=fixture({saved:'existing',promptResult:()=>++index===1?{ok:false,error:Error('第一条失败')}:new Promise(()=>{})});
 assert.equal(await f.c.send('第一条'),false);const p=f.c.send('第二条');await tick();f.submissions[1].onAccept();assert.equal(await p,true);
 f.submissions[0].onAccept();f.submissions[0].onRetire({reason:'failed'});assert.equal(f.c.getSnapshot().requestId,'native-2');assert.equal(f.c.getSnapshot().delivery,'accepted');assert.equal(f.c.getSnapshot().error,'');assert.equal(f.prompts.length,2);f.c.dispose();
});
test('late acceptance after a failure is visibly ambiguous and never triggers a second prompt',async()=>{
 const f=fixture({saved:'existing',promptResult:{ok:false,error:Error('先到的失败回执')}});assert.equal(await f.c.send('查询'),false);f.submissions[0].onAccept();
 assert.equal(f.c.getSnapshot().delivery,'uncertain');assert.match(f.c.getSnapshot().error,/已收到接收回执/);assert.equal(f.prompts.length,1);f.c.dispose();
});
test('durable completed answer outranks a later failed transport receipt',async()=>{
 let reply;const f=fixture({saved:'existing',promptResult:()=>new Promise(resolve=>{reply=resolve;})});const p=f.c.send('查询');await tick();f.submissions[0].onAccept();assert.equal(await p,true);
 f.events.set({entries:[human(1),assistantEvent(2,1,[{type:'text',text:'需要确认，不代表保存成功。'}]),turnEnd(3,1)]});reply({ok:false,error:Error('迟到的网络故障')});await tick();
 assert.equal(f.c.getSnapshot().delivery,'answered');assert.equal(f.c.getSnapshot().error,'');assert.equal(f.calls.includes('abandon'),false);f.c.dispose();
});
test('native observed retirement is receipt evidence even if its prompt response is still pending',async()=>{
 const f=fixture({saved:'existing'}),p=f.c.send('查询');await tick();f.submissions[0].onRetire({reason:'observed',attachments:[]});assert.equal(await p,true);assert.equal(f.c.getSnapshot().delivery,'accepted');f.c.dispose();
});
