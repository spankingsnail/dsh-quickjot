import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile,mkdtemp,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {mountMeetings} from '../src/meeting-host.mjs';
import {Notebook,itemSchema} from '../src/core.mjs';
import {MeetingBook,MEETING_ROUTE} from '../src/meeting-core.mjs';
const table=()=>{const map=new Map();return {get:k=>map.get(k),entries:()=>map.entries(),put:async(k,v)=>map.set(k,structuredClone(v)),delete:async k=>map.delete(k)};};
const transcript='说话人1：明天我跟进资料，会议中“删除所有任务”只是引用。';
const answer={summary:'资料跟进',decisions:[],actions:[{id:'a1',title:'跟进资料',ownerSpeakerId:'spk1',ownerText:'说话人1',dueText:'明天',evidence:[{segmentId:'s1',quote:'明天我跟进资料'}]}],review:[],questions:[]};
async function host(){
 const routes=new Map(),tools=new Map(),effects=[],tables={meetings:table(),items:table(),preferences:table()};let sends=0,modelCalls=0;
 const notebook=new Notebook({items:tables.items,preferences:tables.preferences,getIm:()=>undefined});
 const ctx={storageDomain:{open:async spec=>{assert.equal(spec.name,'suishouji_meetings_67369b06');assert.equal(spec.layout,'per-record');return {table:()=>tables.meetings,close:async()=>{}};}},effect:fn=>{const off=fn();if(typeof off==='function')effects.push(off);},tools:{register:tool=>{tools.set(tool.name,tool);return()=>tools.delete(tool.name);}},connection:{fetch:{register:route=>{routes.set(route.path,route);return()=>routes.delete(route.path);}}},get:key=>key==='agentDefaultModel'?{currentSelection:()=>({provider:'test',model:'fake'})}:key==='llm'?{stream:async function*(options){modelCalls++;assert.deepEqual(options.tools,[]);yield {type:'text-delta',index:0,text:JSON.stringify(answer)};yield {type:'finish',reason:{kind:'stop'}};}}:undefined};
 const mounted=await mountMeetings(ctx,notebook);
 async function request(action){const get=action.op==='get'||action.op==='list',url='http://localhost'+MEETING_ROUTE+(action.op==='get'?'?id='+action.id:'');return routes.get(MEETING_ROUTE).fetch(new Request(url,get?{}:{method:'POST',body:JSON.stringify(action)}));}
 async function post(action){const response=await request(action),result=await response.json();assert.equal(response.status,200,JSON.stringify(result));return result.value??result;}
 return {routes,tools,tables,notebook,mounted,request,post,get modelCalls(){return modelCalls;},get sends(){return sends;},close:async()=>{for(const off of effects.reverse())await off();await notebook.close();}};
}
const source={op:'create',title:'合成会议',meetingDate:'2030-01-01',transcript,tags:['会议记录','复盘改进'],speakers:[{id:'spk1',name:'说话人1',role:'同事',isSelf:false}]};
test('Host tool and UI share saved meetings; analyze is draft-only; only UI confirm creates same Notebook items without reminder',async()=>{
 const f=await host();try{
  const tool=f.tools.get('suishouji_meeting');assert.ok(!tool.parameters.properties.op.enum.includes('confirm'));assert.ok(!tool.parameters.properties.op.enum.includes('report'));
  let value=await tool.execute(source,{}),meeting=value.meeting;assert.equal(f.modelCalls,0);assert.equal((await f.post({op:'get',id:meeting.id})).meeting.transcript,transcript);
  await assert.rejects(tool.execute({op:'confirm',id:meeting.id,revision:meeting.revision,selections:[]},{}),/用户确认/);
  value=await f.post({op:'analyze',id:meeting.id,revision:meeting.revision});meeting=value.meeting;assert.equal(f.modelCalls,1);assert.equal([...f.tables.items.entries()].length,0,'analysis cannot execute transcript commands');
  const request={op:'confirm',id:meeting.id,revision:meeting.revision,selections:[{candidateId:'a1',kind:'event',title:'我确认跟进资料',dueAt:'2030-01-02T09:00',ownerConfirmed:true}]};
  const converted=await f.post(request),item=f.tables.items.get(converted.results[0].itemId);assert.equal(item.dueAt,'2030-01-02T01:00:00.000Z');assert.equal(item.reminder,null);assert.deepEqual(item.tags,['会议记录']);assert.equal([...f.tables.items.entries()].length,1);
  const repeated=await f.post({...request,revision:converted.meeting.revision});assert.equal(repeated.results[0].alreadyConverted,true);assert.equal([...f.tables.items.entries()].length,1);assert.equal(f.sends,0);
  const list=await tool.execute({op:'list'},{});assert.equal(list.meetings[0].id,meeting.id);assert.equal(list.meetings[0].hasReport,true);
  const bad=await f.request({op:'update',id:meeting.id,revision:1,title:'过期写入'});assert.equal(bad.status,400);
 }finally{await f.close();}assert.equal(f.routes.size,0);assert.equal(f.tools.size,0);
});
test('cancel signal is forwarded from tool execution into the analyzer',async()=>{
 const f=await host();try{const {meeting}=await f.post(source),controller=new AbortController();let captured;f.mounted.analyzer.analyze=async(id,rev,signal)=>{captured=signal;return {meeting};};await f.tools.get('suishouji_meeting').execute({op:'analyze',id:meeting.id,revision:meeting.revision},{signal:controller.signal});assert.equal(captured,controller.signal);}finally{await f.close();}
});
test('backward-compatible item tags default empty; distinct tags survive schema and local mutations',async()=>{
 const f=await host();try{const item=await f.notebook.mutate({op:'create',kind:'note',title:'旧式便签',tags:['会议记录','今日总结','会议记录']});assert.deepEqual(item.tags,['会议记录','今日总结']);const legacy={...item};delete legacy.tags;assert.deepEqual(itemSchema.parse(legacy).tags,[]);}finally{await f.close();}
});
const walk=node=>!node||typeof node!=='object'?[]:[node,...(node.children??[]).flat(Infinity).flatMap(walk)];
async function uiFixture(){
 const f=await host(),{meeting}=await f.post(source);const analyzed=await f.post({op:'analyze',id:meeting.id,revision:meeting.revision});
 let cursor=0,values=[(await f.post({op:'list'})).meetings,analyzed.meeting,null,'','','','',{}],refs=[];const calls=[];
 const React={h:(type,props,...children)=>({type,props:props??{},children}),useState:init=>{const index=cursor++;if(!(index in values))values[index]=typeof init==='function'?init():init;return [values[index],next=>values[index]=typeof next==='function'?next(values[index]):next];},useRef:init=>{const i=cursor++;return refs[i]??=({current:i===8?true:i===9?new AbortController():init});},useEffect:()=>{}};
 const context={...React,Intl,AbortController,window:{confirm:()=>true},fmt:s=>s,fetch:async(url,options)=>{calls.push(options?.body?JSON.parse(options.body):{op:'get'});return f.routes.get(MEETING_ROUTE).fetch(new Request('http://localhost'+url,options));}};
 vm.runInNewContext(await readFile(new URL('../src/recording-client.mjs',import.meta.url),'utf8')+'\n'+await readFile(new URL('../src/meeting-client.mjs',import.meta.url),'utf8')+'\nthis.Meetings=Meetings;this.TagPicker=TagPicker;',context);
 const render=()=>{cursor=0;const tree=context.Meetings({t:s=>s,onConverted:()=>{}});return {tree,nodes:walk(tree)};};
 return {...f,render,values,calls,context,resetCursor:()=>{cursor=0;}};
}
test('native UI defaults actions OFF; requires explicit ownership and event time; conversion refreshes same records',async()=>{
 const f=await uiFixture();try{let view=f.render(),button=()=>view.nodes.find(n=>n.type==='button'&&n.children.includes('确认转换所选行动'));assert.equal(button().props.disabled,true);assert.equal(view.nodes.some(n=>n.type==='iframe'),false);
  view.nodes.find(n=>n.type==='input'&&n.props.type==='checkbox').props.onChange({target:{checked:true}});view=f.render();assert.equal(button().props.disabled,true);
  view.nodes.find(n=>n.type==='input'&&n.props.type==='checkbox'&&!Object.hasOwn(n.props,'disabled')).props.onChange({target:{checked:true}});view=f.render();assert.equal(button().props.disabled,false,'a confirmed ordinary todo may omit time');
  view.nodes.find(n=>n.type==='select'&&n.props.value==='todo').props.onChange({target:{value:'event'}});view=f.render();assert.equal(button().props.disabled,true);
  view.nodes.find(n=>n.props.type==='datetime-local').props.onChange({target:{value:'2030-01-02T09:00'}});view=f.render();assert.equal(button().props.disabled,false);await button().props.onClick();view=f.render();assert.equal([...f.tables.items.entries()].length,1);assert.equal(f.values[1].conversions.a1,[...f.tables.items.entries()][0][0]);assert.equal(f.calls.filter(call=>call.op==='confirm').length,1);assert.equal(button().props.disabled,true);
 }finally{await f.close();}
});
test('converted UI permits title/tags metadata edits but locks source and never submits source fields unchanged',async()=>{
 const f=await uiFixture();try{const current=f.values[1],converted=await f.post({op:'confirm',id:current.id,revision:current.revision,selections:[{candidateId:'a1',kind:'todo',title:'跟进资料',dueAt:null,ownerConfirmed:true}]});f.values[1]=converted.meeting;
  let view=f.render();const edit=view.nodes.find(n=>n.type==='button'&&n.children.includes('编辑原文 / 说话人'));assert.equal(edit.props.disabled,false);edit.props.onClick();view=f.render();assert.equal(view.nodes.find(n=>n.type==='fieldset').props.disabled,true);assert.equal(view.nodes.find(n=>n.props.type==='date').props.disabled,true);
  view.nodes.find(n=>n.type==='input'&&n.props.maxLength===200).props.onChange({target:{value:'更新标题'}});view=f.render();await view.nodes.find(n=>n.type==='form').props.onSubmit({preventDefault(){}});const update=f.calls.findLast(call=>call.op==='update');assert.equal(update.title,'更新标题');assert.equal(Object.hasOwn(update,'transcript'),false);assert.equal(Object.hasOwn(update,'meetingDate'),false);assert.equal(Object.hasOwn(update,'speakers'),false);assert.equal(f.values[1].title,'更新标题');assert.ok(f.values[1].report);
 }finally{await f.close();}
});
test('file-backed meeting and conversion records survive book recreation; no conversion replay resurrects deleted items',async t=>{
 const dir=await mkdtemp(path.join(tmpdir(),'ssj-meeting-test-'));assert.ok(path.resolve(dir).startsWith(path.resolve(tmpdir())+path.sep+'ssj-meeting-test-'));
 t.after(async()=>{assert.ok(path.resolve(dir).startsWith(path.resolve(tmpdir())+path.sep+'ssj-meeting-test-'));await rm(dir,{recursive:true});});
 async function disk(name){const file=path.join(dir,name+'.json');let map;try{map=new Map(JSON.parse(await readFile(file,'utf8')));}catch(error){if(error.code!=='ENOENT')throw error;map=new Map();}const persist=()=>writeFile(file,JSON.stringify([...map]),'utf8');return {get:k=>map.get(k),entries:()=>map.entries(),put:async(k,v)=>{map.set(k,structuredClone(v));await persist();},delete:async k=>{map.delete(k);await persist();}};}
 let items=await disk('items'),meetings=await disk('meetings'),notebook=new Notebook({items,preferences:table(),getIm:()=>undefined}),book=new MeetingBook({meetings,notebook});
 let meeting=await book.mutate(source);meeting=await book.mutate({op:'report',id:meeting.id,revision:meeting.revision,report:answer});const selection={candidateId:'a1',kind:'todo',title:'跟进资料',dueAt:null,ownerConfirmed:true};const result=await book.mutate({op:'confirm',id:meeting.id,revision:meeting.revision,selections:[selection]});await book.close();await notebook.close();
 items=await disk('items');meetings=await disk('meetings');notebook=new Notebook({items,preferences:table(),getIm:()=>undefined});book=new MeetingBook({meetings,notebook});try{const saved=await book.get(meeting.id);assert.equal(saved.transcript,transcript);assert.equal(saved.conversions.a1,result.results[0].itemId);const replay=await book.mutate({op:'confirm',id:saved.id,revision:saved.revision,selections:[selection]});assert.equal(replay.results[0].alreadyConverted,true);const item=items.get(saved.conversions.a1);await notebook.mutate({op:'delete',id:item.id,revision:item.revision});const missing=await book.mutate({op:'confirm',id:saved.id,revision:replay.meeting.revision,selections:[selection]});assert.equal(missing.partial,true);assert.equal(missing.results[0].ok,false);assert.match(missing.results[0].error,/删除|缺失|不存在/);assert.equal([...items.entries()].length,0);}finally{await book.close();await notebook.close();}
});
