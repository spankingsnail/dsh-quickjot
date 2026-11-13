import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
import {Notebook} from '../src/core.mjs';
const walk=node=>!node||typeof node!=='object'?[]:[node,...(node.children??[]).flat(Infinity).flatMap(walk)];
async function fixture(initialTab='note',options={}){
 let plugin,cursor=0,effectCursor=0;const values=[],refs=[],entries=[],posts=[],prompts=[],effects=[],pending=[],intervals=[];
 const store=options.store??new Map(),sessionStorage={getItem:key=>store.get(key)??null,setItem:(key,value)=>store.set(key,value)};
 let clock='2030-01-02T00:00:00Z';class Clock extends Date{constructor(...args){super(...(args.length?args:[clock]));}static now(){return Date.parse(clock);}}
 const existing=['note','todo','event'].map((kind,i)=>({id:'old-'+kind,revision:4,kind,title:'旧'+kind,body:'旧正文',tags:['旧标签'],dueAt:'2030-01-02T01:00:00.000Z',done:false,reminder:null}));
 const data={items:existing,now:'2030-01-02 08:00:00',preference:{target:null},delivery:{targets:options.targets??[]}};
 let approve=true,postHandler=async()=>({ok:true,json:async()=>({ok:true})});
 const React={createElement:(type,props,...children)=>({type,props:props??{},children}),useState:init=>{const i=cursor++;if(!(i in values))values[i]=typeof init==='function'?init():init;return [values[i],value=>{values[i]=typeof value==='function'?value(values[i]):value;}];},useRef:init=>{const i=cursor++;return refs[i]??=({current:init});},useEffect:(fn,deps)=>{if(!options.effects)return;const i=effectCursor++,previous=effects[i];if(previous&&deps?.length===previous.deps?.length&&deps.every((value,j)=>Object.is(value,previous.deps[j])))return;effects[i]={deps,cleanup:previous?.cleanup};pending.push(()=>{previous?.cleanup?.();effects[i].cleanup=fn();});}};
 vm.runInNewContext(await readFile(new URL('../lib/client.js',import.meta.url),'utf8'),{Date:Clock,setInterval:fn=>{intervals.push(fn);return intervals.length;},clearInterval:()=>{},window:{sessionStorage,confirm:text=>{prompts.push(text);return approve;},__ModuleLoader__:{load:entry=>{plugin=entry.factory(()=>React);}}},Intl,AbortController,fetch:async(_url,options)=>{if(options?.method==='POST'){posts.push(JSON.parse(options.body));return postHandler();}return {ok:true,json:async()=>data};}});
 const ctx={effect:fn=>fn(),locale:{register:()=>()=>{},bind:()=>s=>s},layout:{},slots:{inject:(_key,fn)=>fn(),register:(options,component)=>entries.push({options,component})}};
 plugin.apply(ctx);const page=entries.find(e=>e.options.name==='main').component();
 function render(){cursor=0;effectCursor=0;const tree=page.type(page.props);const nodes=walk(tree);if(options.root)nodes.find(n=>n.props.className==='ssj').props.ref.current=options.root;return {tree,nodes};}
 function commit(){for(let i=0;i<10;i++){render();if(!pending.length)break;for(const fn of pending.splice(0))fn();}return render();}
 render();values[0]=data;
 function button(text){return render().nodes.find(n=>n.type==='button'&&n.children.includes(text));}
 function tab(kind){return button(({note:'便签',todo:'待办',event:'日程'})[kind]+' 1');}
 function form(){return render().nodes.find(n=>n.type==='form'&&n.props.className==='ssj-editor');}
 function field(label){const node=walk(form()).find(n=>n.type==='label'&&n.children.includes(label));return walk(node).find(n=>['input','textarea','select'].includes(n.type));}
 function fill(){field('标题').props.onChange({target:{value:'未保存标题'}});field('内容').props.onChange({target:{value:'未保存内容'}});const picker=walk(form()).find(n=>typeof n.type==='function'&&n.type.name==='TagPicker');picker.props.onChange(['历史草稿标签']);}
 function assertBlank(kind){const f=form();assert.ok(f);assert.equal(f.props.autoComplete,'off');assert.equal(field('标题').props.value,'');assert.equal(field('内容').props.value,'');assert.equal(field('类型').props.value,kind);assert.ok(walk(f).filter(n=>n.type==='input'&&n.props.type==='datetime-local').every(n=>n.props.value===''));assert.equal(walk(f).find(n=>typeof n.type==='function'&&n.type.name==='TagPicker').props.value.length,0);}
 if(initialTab)tab(initialTab).props.onClick();
  return {render,commit,button,tab,form,field,fill,assertBlank,existing,posts,prompts,store,unmount:()=>effects.forEach(e=>e.cleanup?.()),remount:()=>{effects.forEach(e=>e.cleanup?.());values.length=0;refs.length=0;effects.length=0;pending.length=0;render();},poll:async()=>{await intervals.at(-1)?.();},setClock:now=>{clock=now;},setNow:now=>{data.now=now;},setItems:items=>{data.items=items;},setApprove:value=>{approve=value;},setPostHandler:fn=>{postHandler=fn;}};
}
test('first page defaults to event, orders event/todo/note and creates an event without touching saved records',async()=>{
 const f=await fixture(null);const tabs=f.render().nodes.filter(n=>n.type==='button'&&'aria-pressed' in n.props);
 assert.deepEqual(tabs.slice(0,3).map(n=>n.children[0]),['日程 1','待办 1','便签 1']);assert.equal(tabs[0].props['aria-pressed'],true);assert.ok(tabs.slice(1,3).every(n=>!n.props['aria-pressed']));
 f.button('+ 新建日程').props.onClick();f.assertBlank('event');assert.equal(f.posts.length,0);
});
test('expanded month calendar removes both width caps, enlarges desktop dates and keeps a narrow-screen fallback',async()=>{
 const source=await readFile(new URL('../lib/client.js',import.meta.url),'utf8');
 assert.match(source,/\.ssj:has\(\.ssj-calendar-panel\[open\]\) \.ssj-wrap\{max-width:none\}/);
 assert.match(source,/\.ssj-calendar-panel>div\{padding:16px;width:100%;max-width:none\}/);
 assert.match(source,/grid-template-columns:repeat\(7,minmax\(0,1fr\)\)/);
 assert.match(source,/min-height:clamp\(64px,9vh,100px\)!important/);
 assert.match(source,/@media\(max-width:600px\)\{[^\n]*\.ssj-calendar-panel \.ssj-day\{min-height:52px!important/);
 assert.doesNotMatch(source,/\.ssj-calendar-panel>div\{[^}]*max-width:500px/);
});
test('month grid is closed initially while native date filters and reset still update the agenda',async()=>{
 const f=await fixture(null);let nodes=f.render().nodes;const calendar=nodes.find(n=>n.type==='details'&&n.props.className==='ssj-calendar-panel');assert.ok(calendar);assert.notEqual(calendar.props.open,true);assert.equal(walk(calendar).find(n=>n.type==='summary').children[0],'展开月历 · 按日期筛选');
 const group=nodes.find(n=>n.props.className==='ssj-agenda-group');assert.equal(group.props['aria-label'],'2030-01-02');
 nodes.find(n=>n.type==='button'&&n.props['aria-label']==='2030-01-03 0项日程').props.onClick();assert.equal(f.render().nodes.some(n=>n.type==='article'),false);assert.equal(f.render().nodes.find(n=>n.type==='button'&&n.props['aria-label']==='2030-01-03 0项日程').props['aria-pressed'],true);f.button('查看整月').props.onClick();assert.equal(f.render().nodes.filter(n=>n.type==='article').length,1);
 f.render().nodes.find(n=>n.type==='input'&&n.props.type==='month').props.onChange({target:{value:'2030-02'}});assert.equal(f.render().nodes.some(n=>n.type==='article'),false);f.button('今天').props.onClick();assert.equal(f.render().nodes.filter(n=>n.type==='article').length,1);assert.equal(f.posts.length,0);
});
test('agenda is grouped chronologically by Shanghai day with time gutters and collapsed item actions',async()=>{
 const f=await fixture(null);const original=f.existing.find(x=>x.kind==='event');f.setItems([...f.existing,{...original,id:'later',title:'明天事项',dueAt:'2030-01-03T01:00:00Z'},{...original,id:'earlier',title:'跨 UTC 日界',dueAt:'2030-01-01T16:05:00Z'}]);
 const groups=f.render().nodes.filter(n=>n.props.className==='ssj-agenda-group');assert.deepEqual(groups.map(n=>n.props['aria-label']),['2030-01-02','2030-01-03']);assert.equal(walk(groups[0]).find(n=>n.type==='h3').children[0],'今天');assert.equal(walk(groups[1]).find(n=>n.type==='h3').children[0],'明天');
 assert.deepEqual(walk(groups[0]).filter(n=>n.type==='time').map(n=>n.children[0]),['00:05','09:00']);const first=walk(groups[0]).find(n=>n.type==='article');assert.equal(first.props['data-kind'],'event');const more=walk(first).find(n=>n.type==='details'&&n.props.className==='ssj-more');assert.notEqual(more.props.open,true);assert.ok(walk(more).some(n=>n.type==='button'&&n.children.includes('编辑')));const preview=walk(first).find(n=>n.type==='details'&&n.props.className==='ssj-preview');assert.ok(preview,'text preview is natively expandable, not hover-only or edit-only');assert.equal(walk(preview).find(n=>n.props.className==='ssj-full-body').children[0],original.body);assert.equal(f.posts.length,0);
});
test('switching note/todo/event clears previous editor; every new editor has blank correct-kind fields and fresh subtree',async()=>{
 for(const from of ['note','todo','event'])for(const to of ['note','todo','event'].filter(k=>k!==from)){
  const f=await fixture();f.tab(from).props.onClick();f.button('+ 新建'+({note:'便签',todo:'待办',event:'日程'})[from]).props.onClick();const oldKey=f.form().props.key;f.fill();f.tab(to).props.onClick();assert.equal(f.form(),undefined);assert.equal(f.prompts.length,1);f.button('+ 新建'+({note:'便签',todo:'待办',event:'日程'})[to]).props.onClick();f.assertBlank(to);assert.notEqual(f.form().props.key,oldKey);assert.equal(f.posts.length,0);assert.equal(f.existing[0].title,'旧note');
 }
});
test('new after editing a saved record never carries its id, revision, content, dates or tags into create',async()=>{
 const f=await fixture();f.button('编辑').props.onClick();const oldKey=f.form().props.key;assert.equal(f.field('标题').props.value,'旧note');f.button('+ 新建便签').props.onClick();f.assertBlank('note');assert.notEqual(f.form().props.key,oldKey);assert.equal(f.prompts.length,0,'unchanged saved item needs no discard warning');f.field('标题').props.onChange({target:{value:'新的便签'}});await f.form().props.onSubmit({preventDefault(){}});assert.equal(f.posts.length,1);assert.equal(f.posts[0].op,'create');assert.equal(f.posts[0].kind,'note');assert.equal(f.posts[0].id,undefined);assert.equal(f.posts[0].revision,undefined);assert.equal(f.posts[0].body,'');assert.deepEqual(f.posts[0].tags,[]);assert.equal(f.posts[0].dueAt,null);assert.equal(f.posts[0].remindAt,undefined);assert.equal(f.posts[0].formKey,undefined);assert.equal(f.posts[0].dirty,undefined);
});
test('discard cancellation preserves unsaved input; confirmed new resets even in the same category',async()=>{
 const f=await fixture();f.button('+ 新建便签').props.onClick();f.fill();const key=f.form().props.key;f.setApprove(false);f.tab('todo').props.onClick();assert.equal(f.field('标题').props.value,'未保存标题');assert.equal(f.form().props.key,key);f.button('+ 新建便签').props.onClick();assert.equal(f.form().props.key,key);f.setApprove(true);f.button('+ 新建便签').props.onClick();f.assertBlank('note');assert.notEqual(f.form().props.key,key);assert.equal(f.posts.length,0);
});
test('meeting mode is gone: no meeting tab, no meeting entry in the shared bar',async()=>{
 const f=await fixture(null),labels=f.render().nodes.filter(n=>n.type==='button').map(n=>n.children?.[0]).filter(x=>typeof x==='string');
 assert.ok(labels.some(x=>x.startsWith('日程 ')));assert.equal(f.button('会议笔记'),undefined);assert.ok(labels.every(x=>!x.includes('会议')),'meeting UI must not leak into the calendar page');
});
test('writing CSS fills the available page and uses container-aware wide-editor and stacked narrow layouts',async()=>{
 const f=await fixture(),styles=f.render().nodes.find(n=>n.type==='style').children.join('');
 assert.match(styles,/\.ssj-wrap\{width:100%;max-width:none;min-width:0;[^}]*container-type:inline-size/);
 assert.doesNotMatch(styles,/\.ssj-wrap\{[^}]*max-width:(?:1000|1120)px/);
 assert.doesNotMatch(styles,/grid-template-columns:minmax\(0,1fr\) 320px/);
 assert.match(styles,/\.ssj-layout\.writing\{grid-template-columns:minmax\(240px,\.55fr\) minmax\(0,1\.45fr\)\}/);
 assert.match(styles,/@container \(max-width:980px\)\{\.ssj-layout:not\(\.single\)\{grid-template-columns:minmax\(0,1fr\)\}/);
 assert.match(styles,/@media\(max-width:980px\)\{\.ssj-layout:not\(\.single\)\{grid-template-columns:minmax\(0,1fr\)\}/);
 assert.match(styles,/\.ssj-layout:not\(\.single\)>\.ssj-editor\{grid-row:1\}/);
 assert.match(styles,/\.ssj-editor\[data-kind=note\] \.ssj-editor-body\{min-height:clamp\(360px,52dvh,800px\)\}/);
 assert.match(styles,/\.ssj-editor \.ssj-editor-body\{[^}]*font-size:16px;[^}]*resize:vertical/);
 assert.equal(f.posts.length,0);
});
test('new notes get a large writing pane and changing kind preserves input without widening the chat composer',async()=>{
 const f=await fixture();f.button('+ 新建便签').props.onClick();
 assert.equal(f.form().props['data-kind'],'note');assert.equal(walk(f.form()).find(n=>n.type==='h2').children[0],'新建便签');
 assert.ok(f.render().nodes.some(n=>n.props.className==='ssj-layout writing'));
 assert.equal(f.field('内容').props.className,'ssj-editor-body');assert.equal(f.field('内容').props.rows,18);assert.equal(f.field('内容').props.maxLength,12000);
 assert.equal(f.field('标题').props.autoFocus,true);const key=f.form().props.key;f.field('内容').props.onChange({target:{value:'切换类型仍保留的正文'}});
 f.field('类型').props.onChange({target:{value:'event'}});assert.equal(f.form().props['data-kind'],'event');assert.equal(f.form().props.key,key);assert.equal(f.field('内容').props.rows,8);assert.equal(f.field('内容').props.value,'切换类型仍保留的正文');assert.equal(f.field('日程 / 截止时间 · 上海').props.required,true);
 assert.equal(f.render().nodes.some(n=>n.props.className==='ssj-layout writing'),false);assert.equal(f.posts.length,0);
});
test('editing an existing note uses the same large pane without altering its saved content or tags',async()=>{
 const f=await fixture();f.button('编辑').props.onClick();assert.equal(walk(f.form()).find(n=>n.type==='h2').children[0],'编辑便签');assert.equal(f.form().props['data-kind'],'note');assert.equal(f.field('内容').props.rows,18);assert.equal(f.field('内容').props.value,'旧正文');
 const picker=walk(f.form()).find(n=>typeof n.type==='function'&&n.type.name==='TagPicker');assert.deepEqual(Array.from(picker.props.value),['旧标签']);assert.equal(f.posts.length,0);f.button('取消').props.onClick();assert.equal(f.form(),undefined);assert.equal(f.existing[0].body,'旧正文');
});
function pickerNodes(f){const picker=walk(f.form()).find(n=>typeof n.type==='function'&&n.type.name==='TagPicker');return walk(picker.type(picker.props));}
test('long multiline notes and the optional work-summary preset save exactly once without automatic reminders',async()=>{
 const f=await fixture();f.button('+ 新建便签').props.onClick();const body='进展、问题与下一步。\n'.repeat(900)+'保留末行与表情🙂';assert.ok(body.length>9000&&body.length<=12000);
 f.field('标题').props.onChange({target:{value:'合成工作总结'}});f.field('内容').props.onChange({target:{value:body}});
 let button=pickerNodes(f).find(n=>n.type==='button'&&n.children.includes('工作总结'));assert.ok(button);assert.equal(button.props.type,'button');assert.equal(button.props['aria-pressed'],false);button.props.onClick();
 button=pickerNodes(f).find(n=>n.type==='button'&&n.children.includes('工作总结'));assert.equal(button.props['aria-pressed'],true);
 assert.equal(f.field('内容').props.value,body);assert.equal(walk(f.form()).find(n=>n.props.className==='ssj-editor-count').children[0],body.length.toLocaleString('en-US')+' / 12,000');assert.equal(f.posts.length,0);
 await f.form().props.onSubmit({preventDefault(){}});assert.equal(f.posts.length,1);assert.equal(f.posts[0].body,body);assert.deepEqual(f.posts[0].tags,['工作总结']);assert.equal(f.posts[0].dueAt,null);assert.equal(f.posts[0].remindAt,undefined);
});
test('work-summary toggles preserve existing/custom tags and still enforce the twelve-tag limit',async()=>{
 const f=await fixture();f.button('编辑').props.onClick();const select=()=>pickerNodes(f).find(n=>n.type==='button'&&n.children.includes('工作总结'));
 select().props.onClick();let picker=walk(f.form()).find(n=>typeof n.type==='function'&&n.type.name==='TagPicker');assert.deepEqual(Array.from(picker.props.value),['旧标签','工作总结']);select().props.onClick();picker=walk(f.form()).find(n=>typeof n.type==='function'&&n.type.name==='TagPicker');assert.deepEqual(Array.from(picker.props.value),['旧标签']);
 const tags=Array.from({length:12},(_,i)=>'自定义'+i);picker.props.onChange(tags);select().props.onClick();picker=walk(f.form()).find(n=>typeof n.type==='function'&&n.type.name==='TagPicker');assert.deepEqual(Array.from(picker.props.value),tags);assert.equal(f.posts.length,0);
});
test('pending save prevents tab/new races and cannot post a second editor submission',async()=>{
 const f=await fixture();let release;f.setPostHandler(()=>new Promise(resolve=>{release=()=>resolve({ok:true,json:async()=>({ok:true})});}));f.button('+ 新建便签').props.onClick();f.field('标题').props.onChange({target:{value:'保存中'}});const pending=f.form().props.onSubmit({preventDefault(){}});assert.equal(f.posts.length,1);assert.equal(f.tab('todo').props.disabled,true);assert.equal(f.button('+ 新建便签').props.disabled,true);f.tab('todo').props.onClick();f.button('+ 新建便签').props.onClick();await f.form().props.onSubmit({preventDefault(){}});assert.equal(f.field('标题').props.value,'保存中');assert.equal(f.posts.length,1);release();await pending;assert.equal(f.form(),undefined);
});
for(const rename of [false,true])test(`actual editor payload cancels an existing reminder with a selected target${rename?' while renaming the item':''}`,async t=>{
  const target={botId:'editor-test-bot',targetId:'editor-test-target',name:'Synthetic recipient'};
  const f=await fixture('event',{targets:[target]}),original=f.existing.find(item=>item.kind==='event');
  original.createdAt=original.updatedAt='2030-01-01T00:00:00.000Z';
  original.reminder={at:'2030-01-03T02:00:00.000Z',state:'pending',target:{botId:target.botId,targetId:target.targetId},missed:false,attemptedAt:null,sentAt:null,error:null};
  const records=new Map([[original.id,structuredClone(original)]]),items={get:id=>structuredClone(records.get(id)),entries:()=>records.entries(),put:async(id,value)=>records.set(id,structuredClone(value))};
  const notebook=new Notebook({items,preferences:{get:()=>undefined},getIm:()=>{throw Error('cancellation must not discover or send to IM');},now:()=>Date.parse('2030-01-02T00:00:00Z')});t.after(()=>notebook.close());
  f.setPostHandler(async()=>{try{const value=await notebook.mutate(f.posts.at(-1));return {ok:true,json:async()=>({ok:true,value})};}catch(error){return {ok:false,json:async()=>({error:error.message})};}});
  f.button('编辑').props.onClick();assert.equal(f.field('已保存的微信目标').props.value,JSON.stringify([target.botId,target.targetId]));
  f.field('微信提醒时间 · 上海（可留空）').props.onChange({target:{value:''}});if(rename)f.field('标题').props.onChange({target:{value:'取消提醒并改名'}});
  await f.form().props.onSubmit({preventDefault(){}});assert.equal(f.posts.length,1);assert.equal(f.posts[0].remindAt,null);assert.equal('target' in f.posts[0],false);assert.equal(f.form(),undefined,'actual core accepted the editor action');
  const saved=records.get(original.id);assert.equal(saved.reminder,null);assert.equal(saved.dueAt,original.dueAt);assert.equal(saved.title,rename?'取消提醒并改名':original.title);assert.equal(saved.body,original.body);assert.deepEqual(saved.tags,original.tags);assert.equal(saved.revision,original.revision+1);
});
// These are effect/scroll-adapter unit tests, not rendered-browser verification.
function scrollRoot(top=0){
 const root={scrollTop:top,offsetTop:0,getBoundingClientRect:()=>({top:0}),querySelector:selector=>selector==='.ssj-nav'?{offsetTop:200,getBoundingClientRect:()=>({bottom:120})}:null};
 root.querySelectorAll=()=>[{getAttribute:()=> 'old-event',getBoundingClientRect:()=>({top:1800-root.scrollTop,bottom:1860-root.scrollTop})}];return root;
}
function agendaCheck(f){return f.render().nodes.find(n=>n.type==='input'&&n.props.type==='checkbox'&&'checked' in n.props&&!n.props['aria-label']);}
function dateInput(f){return f.render().nodes.find(n=>n.type==='input'&&n.props.type==='date');}
test('agenda defaults to upcoming across months; old unfinished and completed work have explicit non-destructive controls',async()=>{
 const f=await fixture(null),event=f.existing.find(x=>x.kind==='event');f.setItems([...f.existing,{...event,id:'old',dueAt:'2030-01-01T00:00:00Z'},{...event,id:'done',done:true},{...event,id:'future',dueAt:'2030-02-01T00:00:00Z'}]);
 let nodes=f.render().nodes;assert.equal(f.button('接下来').props['aria-pressed'],true);assert.ok(nodes.some(n=>n.props.className==='ssj-overdue'&&n.props.open===false));
 assert.equal(nodes.filter(n=>n.type==='article'&&n.props['data-kind']==='event').length,3,'two current/future plus one collapsed old item, no completed item');
 agendaCheck(f).props.onChange({target:{checked:true}});assert.equal(f.render().nodes.filter(n=>n.type==='article'&&n.props['data-kind']==='event').length,4);assert.equal(f.posts.length,0);
 f.button('今天').props.onClick();assert.equal(dateInput(f).props.value,'2030-01-02');assert.equal(f.render().nodes.filter(n=>n.type==='article').length,2);
 f.button('近七天').props.onClick();assert.equal(f.button('近七天').props['aria-pressed'],true);assert.equal(f.posts.length,0);
});
test('date controls cross months, clear safely and calendar counts use the same search/completion filter',async()=>{
 const f=await fixture(null),event=f.existing.find(x=>x.kind==='event');f.setItems([...f.existing,{...event,id:'done',done:true},{...event,id:'future',dueAt:'2030-02-01T00:00:00Z'}]);
 assert.ok(f.render().nodes.some(n=>n.props['aria-label']==='2030-01-02 1项日程'));
 dateInput(f).props.onChange({target:{value:'2030-02-01'}});assert.equal(f.render().nodes.filter(n=>n.type==='article').length,1);assert.equal(f.render().nodes.find(n=>n.props['aria-label']==='日历月份').props.value,'2030-02');
 dateInput(f).props.onChange({target:{value:''}});assert.equal(f.button('接下来').props['aria-pressed'],true);
 f.render().nodes.find(n=>n.props['aria-label']==='日历月份').props.onChange({target:{value:''}});assert.equal(f.render().nodes.find(n=>n.props['aria-label']==='日历月份').props.value,'2030-01');
 f.render().nodes.find(n=>n.props['aria-label']==='查找事项').props.onChange({target:{value:'不存在'}});assert.ok(f.render().nodes.some(n=>n.props['aria-label']==='2030-01-02 0项日程'));assert.ok(f.button('清除搜索'));f.button('清除搜索').props.onClick();assert.equal(f.posts.length,0);
});
test('page effects restore a same-day view and anchor after unmount instead of restarting at the top',async()=>{
 const root=scrollRoot(),f=await fixture(null,{effects:true,root});f.commit();f.button('今天').props.onClick();f.commit();root.scrollTop=940;f.render().tree.props.onScroll();f.unmount();
 const root2=scrollRoot(),again=await fixture(null,{effects:true,root:root2,store:f.store});again.commit();assert.equal(dateInput(again).props.value,'2030-01-02');assert.equal(root2.scrollTop,940);assert.equal(again.posts.length,0);again.unmount();
});
test('polling refreshes never restore an old position over manual scrolling',async()=>{
 const root=scrollRoot(),f=await fixture(null,{effects:true,root});f.commit();root.scrollTop=700;f.render().tree.props.onScroll();await f.poll();f.commit();assert.equal(root.scrollTop,700);root.scrollTop=1030;await f.poll();f.commit();assert.equal(root.scrollTop,1030);f.unmount();
});
test('cancel and save restore the pre-editor anchor without replaying mutations',async()=>{
 const root=scrollRoot(),f=await fixture(null,{effects:true,root});f.commit();root.scrollTop=800;f.button('编辑').props.onClick();f.commit();root.scrollTop=50;f.button('取消').props.onClick();f.commit();assert.equal(root.scrollTop,800);assert.equal(f.posts.length,0);
 root.scrollTop=1100;f.button('编辑').props.onClick();f.commit();root.scrollTop=0;await f.form().props.onSubmit({preventDefault(){}});f.commit();assert.equal(root.scrollTop,1100);assert.equal(f.posts.length,1);f.unmount();
});
test('Shanghai midnight resets date-sensitive browsing once, but does not discard an editor draft',async()=>{
 const root=scrollRoot(),f=await fixture(null,{effects:true,root});f.commit();f.button('今天').props.onClick();f.commit();f.button('+ 新建日程').props.onClick();f.field('标题').props.onChange({target:{value:'跨日未保存'}});f.commit();f.setNow('2030-01-03 00:01:00');f.commit();assert.equal(f.button('接下来').props['aria-pressed'],true);assert.equal(f.field('标题').props.value,'跨日未保存');assert.equal(f.posts.length,0);f.unmount();
});
test('changing months in a day filter does not lose the upcoming anchor',async()=>{
 const root=scrollRoot(),f=await fixture(null,{effects:true,root});f.commit();root.scrollTop=930;f.render().tree.props.onScroll();dateInput(f).props.onChange({target:{value:'2030-02-02'}});f.commit();assert.equal(root.scrollTop,200);f.button('接下来').props.onClick();f.commit();assert.equal(root.scrollTop,930);f.unmount();
});
test('past-work expansion persists even without scrolling before a host-side unmount',async()=>{
 const root=scrollRoot(),f=await fixture(null,{effects:true,root}),event=f.existing.find(x=>x.kind==='event');f.setItems([...f.existing,{...event,id:'old',dueAt:'2030-01-01T00:00:00Z'}]);f.commit();f.render().nodes.find(n=>n.props.className==='ssj-overdue').props.onToggle({currentTarget:{open:true}});f.commit();f.unmount();
 const again=await fixture(null,{effects:true,root:scrollRoot(),store:f.store});again.setItems([...again.existing,{...event,id:'old',dueAt:'2030-01-01T00:00:00Z'}]);again.commit();assert.equal(again.render().nodes.find(n=>n.props.className==='ssj-overdue').props.open,true);again.unmount();
});
test('default upcoming midnight resets actual scroll even without another filter change',async()=>{
 const root=scrollRoot(),f=await fixture(null,{effects:true,root});f.commit();root.scrollTop=1200;f.render().tree.props.onScroll();f.setClock('2030-01-03T00:01:00+08:00');f.setNow('2030-01-03 00:01:00');f.commit();assert.equal(root.scrollTop,200);assert.equal(f.button('接下来').props['aria-pressed'],true);f.unmount();
});
test('same-bundle remount after Shanghai midnight does not restore yesterday\'s anchor',async()=>{
 const root=scrollRoot(),f=await fixture(null,{effects:true,root});f.commit();root.scrollTop=1200;f.render().tree.props.onScroll();f.setClock('2030-01-03T00:01:00+08:00');f.setNow('2030-01-03 00:01:00');f.remount();f.commit();await f.poll();f.commit();assert.equal(root.scrollTop,200);assert.equal(f.button('接下来').props['aria-pressed'],true);f.unmount();
});
test('an editor crossing midnight retains its draft but cannot restore yesterday on cancel',async()=>{
 const root=scrollRoot(),f=await fixture(null,{effects:true,root});f.commit();root.scrollTop=1200;f.button('编辑').props.onClick();f.commit();root.scrollTop=50;f.field('标题').props.onChange({target:{value:'跨午夜草稿'}});f.setNow('2030-01-03 00:01:00');f.commit();assert.equal(root.scrollTop,50);assert.equal(f.field('标题').props.value,'跨午夜草稿');f.button('取消').props.onClick();f.commit();assert.notEqual(root.scrollTop,1200);assert.equal(f.posts.length,0);f.unmount();
});
test('sticky navigation stays within the page and uses theme tokens with wrapping narrow controls',async()=>{
 const f=await fixture(null),css=f.render().nodes.find(n=>n.type==='style').children.join('');assert.match(css,/\.ssj-nav\{position:sticky;top:var\(--dsh-frame-top-clearance,0px\)/);assert.match(css,/\.ssj-agenda-nav\{[^}]*flex-wrap:wrap/);assert.match(css,/\.ssj-nav-tools\{[^}]*flex-wrap:wrap/);assert.equal(f.render().nodes.find(n=>n.type==='nav').props['aria-label'],'事项导航');assert.ok(f.render().tree.props.ref);assert.equal(f.posts.length,0);
});
