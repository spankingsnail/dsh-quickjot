import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
const walk=node=>!node||typeof node!=='object'?[]:[node,...(node.children??[]).flat(Infinity).flatMap(walk)];
async function fixture(){
 let plugin,cursor=0,values=[],effects=[],refs=[];
 const log={scrollTop:0,scrollHeight:900},dialog={open:false,showModal(){this.open=true;},close(){this.open=false;}},input={focus:options=>assert.equal(options.preventScroll,true)};
 const React={createElement:(type,props,...children)=>{if(props?.ref){if(type==='dialog')props.ref.current=dialog;else if(type==='textarea')props.ref.current=input;else if(props.className==='ssj-chat-log')props.ref.current=log;}return {type,props:props??{},children};},useState:init=>{const index=cursor++;if(!(index in values))values[index]=typeof init==='function'?init():init;return [values[index],next=>{values[index]=typeof next==='function'?next(values[index]):next;}];},useRef:value=>{const index=cursor++;return refs[index]??=({current:value});},useEffect:(fn,deps)=>effects.push({fn,deps})};
 vm.runInNewContext(await readFile(new URL('../lib/client.js',import.meta.url),'utf8'),{window:{__ModuleLoader__:{load:entry=>{plugin=entry.factory(()=>React);}}},Intl,AbortController});
 const entries=[],ctx={effect:fn=>fn(),locale:{register:()=>()=>{},bind:()=>s=>s},layout:{},slots:{inject:(_key,fn)=>fn(),register:(options,component)=>entries.push({options,component})}};
 plugin.apply(ctx);const page=entries.find(e=>e.options.name==='main').component();const rendered=page.type(page.props);const chat=walk(rendered).find(n=>typeof n.type==='function'&&n.type.name==='Chat');
 values=[];refs=[];
 const messages=Array.from({length:25},(_,i)=>[{id:'user-'+i,role:'user',text:'输入'+i},{id:'answer-'+i,role:'assistant',text:i===24?'真实的最终处理结果':'答复'+i}]).flat();
 values[0]={messages,running:false,sending:false,connecting:false,error:'',sessionId:'saved',delivery:'answered'};values[1]='保留草稿';values[2]=false;
 function render(open){cursor=0;effects=[];const tree=chat.type({...chat.props,open});return {tree,nodes:walk(tree),effects:[...effects]};}
 return {render,values,log,dialog,messages,refs};
}
test('latest 20 personal inputs retain their inline assistant answers in chronological order',async()=>{
 const f=await fixture(),{nodes}=f.render(false);const rows=nodes.filter(n=>n.props.className==='ssj-chat-message');
 assert.equal(rows.length,40);assert.ok(rows[0].children.includes('输入5'));assert.ok(rows[1].children.includes('答复5'));assert.ok(rows.at(-1).children.includes('真实的最终处理结果'));
 assert.deepEqual(rows.map(n=>n.props['data-role']),Array.from({length:20},()=>['user','assistant']).flat());
 assert.equal(nodes.some(n=>n.type==='details'),false,'answers must not require expanding anything');
 nodes.find(n=>n.type==='button'&&n.children.includes('查看较早对话')).props.onClick();assert.equal(f.render(false).nodes.filter(n=>n.props.className==='ssj-chat-message').length,50);
 assert.equal(f.messages.length,50,'history is not deleted');assert.equal(f.values[1],'保留草稿');
});
test('every popup reopen scrolls to latest even if no new messages; opening resets expanded history',async()=>{
 const f=await fixture();let view=f.render(true);view.effects[0].fn();view.effects[2].fn();assert.equal(f.dialog.open,true);assert.equal(f.log.scrollTop,900);assert.equal(view.effects[2].deps[0],true);
 f.values[2]=true;f.log.scrollTop=10;view=f.render(false);view.effects[0].fn();view.effects[2].fn();assert.equal(f.dialog.open,false);assert.equal(f.log.scrollTop,10,'hidden modal should not fight user scrolling');
 view=f.render(true);view.effects[0].fn();view.effects[2].fn();assert.equal(f.log.scrollTop,900);assert.equal(f.values[2],false);assert.equal(f.values[1],'保留草稿');
});
test('receipt and processing are visible without hiding earlier final answers or claiming storage success',async()=>{
 const f=await fixture();
 for(const delivery of ['sending','accepted','processing','waiting','no-answer','blocked','stopped','uncertain']){
  f.values[0]={...f.values[0],delivery,running:['accepted','processing'].includes(delivery),sending:delivery==='sending'};
  const {nodes}=f.render(true),status=nodes.find(n=>n.props.className==='ssj-chat-status');
  assert.equal(status.props.role,'status');assert.equal(status.props['data-state'],delivery);assert.ok(status.children[0]);assert.doesNotMatch(status.children[0],/已保存|已创建/);
  assert.equal(nodes.filter(n=>n.props['data-role']==='assistant').length,20,'past final answers remain readable during the new turn');
  if(['accepted','processing'].includes(delivery))assert.equal(nodes.find(n=>n.type==='button'&&n.props.type==='submit').props.disabled,true);
 }
});
test('failure reason remains an expanded alert and complete-conversation action stays available',async()=>{
 const f=await fixture();f.values[0]={...f.values[0],delivery:'failed',error:'模型额度不足：请检查账户'};
 const {nodes}=f.render(true),alert=nodes.find(n=>n.props.role==='alert');assert.ok(alert.children.includes('模型额度不足：请检查账户'));
 assert.equal(nodes.some(n=>n.type==='details'),false);assert.ok(nodes.some(n=>n.type==='button'&&n.children.includes('打开完整对话')));
});
test('draft clears only on actual admission and remains intact on failure',async()=>{
 const f=await fixture();let view=f.render(true);const calls=[];
 f.refs[3].current={send:async text=>{calls.push(text);return false;}};
 await view.nodes.find(n=>n.type==='form').props.onSubmit({preventDefault(){}});assert.equal(f.values[1],'保留草稿');
 view=f.render(true);f.refs[3].current={send:async text=>{calls.push(text);return true;}};
 await view.nodes.find(n=>n.type==='form').props.onSubmit({preventDefault(){}});assert.equal(f.values[1],'');assert.deepEqual(calls,['保留草稿','保留草稿']);
});
