import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
import {apply,inject} from '../lib/index.js';
import {NS,ROUTE} from '../lib/core.js';
function table(){const map=new Map();return {get:k=>map.get(k),entries:()=>map.entries(),put:async(k,v)=>{map.set(k,structuredClone(v));},delete:async k=>map.delete(k)};}
test('host registers shared tools and route, both mutate the same durable item records',async()=>{
 const effects=[],tools=new Map(),sections=[],tables={items:table(),preferences:table(),meetings:table(),recordings:table(),notifications:table()},specs=[];let endpoint,closed=false;
 const ctx={effect:fn=>{const off=fn();if(typeof off==='function')effects.push(off);},storageDomain:{open:async s=>{specs.push(s);return {table:n=>tables[n],close:async()=>{closed=true;}};}},tools:{register:def=>{tools.set(def.name,def);return()=>tools.delete(def.name);}},systemPrompt:{section:def=>{sections.push(def);return()=>{};}},connection:{fetch:{register:def=>{endpoint=def;return()=>{endpoint=null;};}}},get:()=>undefined};
 await apply(ctx);try{
 const spec=specs[0];assert.equal(specs[1].name,'suishouji_meetings_67369b06');assert.deepEqual(inject,['storageDomain','connection','tools','systemPrompt']);assert.equal(spec.layout,'per-record');assert.equal(spec.name,'suishouji_67369b06');assert.match(spec.name,/^[a-z][a-z0-9_]*$/);assert.equal(endpoint.path,ROUTE);assert.match(sections[0].text,/引用、讨论/);
 const write=tools.get('suishouji_write'),list=tools.get('suishouji_list');
 const result=await write.execute({actions:[{op:'create',kind:'todo',title:'跨对话待办'},{op:'create',kind:'event',title:'含糊日程'}]},{callId:'one',agent:{id:'conversation-a'}});
 assert.equal(result.results[0].ok,true);assert.equal(result.results[1].ok,false);
 const snapshot=await list.execute({},{agent:{id:'conversation-b'}});assert.equal(snapshot.items.length,1);assert.equal(snapshot.delivery.available,false);
 assert.match(sections[0].text,/不能以配置微信为保存前置条件/);assert.match(write.description,/本地事项无需微信/);assert.match(write.parameters.properties.actions.items.properties.remindAt.description,/无目标先保存本地事项/);
  const local=await write.execute({actions:[{op:'create',kind:'event',title:'不依赖微信的日程',dueAt:'2030-01-02T09:00'},{op:'create',kind:'todo',title:'不依赖微信的行动'}]},{callId:'local',agent:{id:'conversation-b'}});
  assert.ok(local.results.every(r=>r.ok&&r.value.reminder===null));assert.equal(local.results[0].value.dueAt,'2030-01-02T01:00:00.000Z');
  const viaUi=await endpoint.fetch(new Request('http://localhost'+ROUTE));const uiSnapshot=await viaUi.json();assert.equal(uiSnapshot.items.length,3);assert.ok(uiSnapshot.items.some(x=>x.id===local.results[0].value.id),'tool-created event must appear in the same endpoint consumed by calendar UI');
  const item=snapshot.items[0];const response=await endpoint.fetch(new Request('http://localhost'+ROUTE,{method:'POST',body:JSON.stringify({op:'complete',id:item.id,revision:item.revision,done:true})}));assert.equal(response.status,200);
 const persisted=await list.execute({});assert.equal(persisted.items.find(x=>x.id===item.id).done,true);
 const bad=await endpoint.fetch(new Request('http://localhost'+ROUTE,{method:'POST',body:JSON.stringify({op:'delete',id:item.id,revision:1})}));assert.equal(bad.status,400);assert.equal(tables.items.get(item.id).done,true);
 }finally{for(const off of effects.reverse())await off();}assert.equal(closed,true);assert.equal(tools.size,0);assert.equal(endpoint,null);
});
test('client has paired native slots and scoped teardown preserves unrelated panels',async()=>{
 let module;const updates=[];const React={createElement:(type,props,...children)=>({type,props:props??{},children}),useState:init=>[typeof init==='function'?init():init,value=>updates.push(value)],useRef:value=>({current:value}),useEffect:()=>{}};
 vm.runInNewContext(await readFile(new URL('../lib/client.js',import.meta.url),'utf8'),{window:{__ModuleLoader__:{load:entry=>{assert.equal(entry.id,NS);module=entry.factory(name=>{assert.equal(name,'react');return React;});}}},Intl,AbortController});
 const entries=[],effects=[],registrations=new Map();let active='other-page';
 const ctx={effect:fn=>{const off=fn();if(typeof off==='function')effects.push(off);},locale:{register:(ns,dict)=>{registrations.set(ns,dict);return()=>registrations.delete(ns);},bind:ns=>key=>{const result=registrations.get(ns)?.zh[key];assert.equal(typeof result,'string',`missing locale key: ${key}`);return result;}},layout:{panelInfo:{getSnapshot:()=>({activePanelId:active})},selectPanel:id=>{active=id;}},slots:{inject:(key,fn)=>{assert.ok(['main','sidebar.panellist','shell.overlay'].includes(key),'must wait for a declared slot, not the page ID');const result=fn();const off=()=>{if(typeof result==='function')result();else if(result)for(const dispose of [...result].reverse())dispose?.();entries.length=0;};effects.unshift(off);return off;},register:(options,component)=>{entries.push({options,component});}}};
 module.apply(ctx);const panel=entries.find(e=>e.options.name==='main'),nav=entries.find(e=>e.options.name==='sidebar.panellist');assert.equal(nav.options.id,panel.options.key);assert.equal(nav.options.label(),'随手记');const pageElement=panel.component();const rendered=pageElement.type(pageElement.props);assert.equal(rendered.type,'section');assert.equal(rendered.props['aria-label'],'随手记');
 assert.ok(module.inject.includes('sessions'));assert.ok(module.inject.includes('remote'));assert.ok(module.inject.includes('remote.session'),'gateway namespaces are independently traced child Services');
 const walk=node=>!node||typeof node!=='object'?[]:[node,...(node.children??[]).flat(Infinity).flatMap(walk)];
 const overlay=entries.find(e=>e.options.name==='shell.overlay');assert.ok(overlay,'reminders mount globally rather than inside the selected page');assert.equal(overlay.options.id,panel.options.key+':in-app-reminders');assert.equal(overlay.options.label(),'随手记提醒');const overlayElement=overlay.component(),overlayTree=overlayElement.type(overlayElement.props);assert.equal(overlayTree.type,'aside');assert.ok(walk(overlayTree).some(node=>node.type==='style'&&node.children.join('').includes('.ssn{position:fixed')),'the independent overlay must actually mount its own CSS');assert.ok(walk(overlayTree).some(node=>node.type==='button'&&node.props.className==='ssn-toggle'));
 const chat=walk(rendered).find(node=>typeof node.type==='function'&&node.type.name==='Chat');assert.ok(chat,'chat is embedded in the original main page');
 assert.equal(chat.props.open,false,'chat is closed and consumes no main-page area initially');
 const trigger=walk(rendered).find(node=>node.type==='button'&&node.props['aria-haspopup']==='dialog');assert.ok(trigger);trigger.props.onClick();assert.equal(updates.at(-1),true);
 const chatRoot=chat.type(chat.props),chatTree=walk(chatRoot);assert.equal(chatRoot.type,'dialog','native modal supplies top layer, focus containment and inert background');assert.equal(chatRoot.props['aria-labelledby'],'ssj-chat-title');
 let prevented=false;chatRoot.props.onCancel({preventDefault:()=>{prevented=true;}});assert.equal(prevented,true);assert.equal(updates.at(-1),false);
 assert.equal(chatTree.find(node=>node.type==='textarea').props.maxLength,12000);assert.equal(chatTree.find(node=>node.type==='button'&&node.props.type==='submit').props.disabled,true);assert.equal(chatTree.some(node=>node.type==='iframe'),false);
 // Mimic native sidebar's selection of the paired main key.
 ctx.layout.selectPanel(nav.options.id);assert.equal(active,panel.options.key);
 // Unloading while a different page is selected must not close it.
 active='other-page';for(const off of [...effects].reverse())off();assert.equal(active,'other-page');assert.equal(entries.length,0);assert.equal(registrations.size,0);
 effects.length=0;module.apply(ctx);active=entries.find(e=>e.options.name==='main').options.key;for(const off of [...effects].reverse())off();assert.equal(active,null);assert.equal(entries.length,0);
});
test('patch and exported resources are package-contained and build exists',async()=>{
 const manifest=JSON.parse(await readFile(new URL('../package.json',import.meta.url),'utf8'));const patch=JSON.parse(await readFile(new URL('../cordis.patch.yml',import.meta.url),'utf8'));
 assert.equal(manifest.name,NS);assert.equal(manifest.dsh.bundle.patch,'./cordis.patch.yml');for(const op of patch){assert.deepEqual(Object.keys(op),['insert']);for(const item of op.insert){assert.ok(item.id.startsWith(NS+':'));assert.equal(item.name,NS);}}
 for(const file of ['lib/index.js','lib/core.js','lib/client.js','icon.svg','locale/en.json','locale/zh.json'])assert.ok((await readFile(new URL('../'+file,import.meta.url))).length>0);
});
