import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';

const source = await readFile(new URL('../src/recording-client.mjs', import.meta.url), 'utf8');
const route = '/api/suishouji-67369b06/recordings';
const walk = node => !node || typeof node !== 'object' ? [] : [node, ...(node.children || []).flat(Infinity).flatMap(walk)];
const text = node => !node ? '' : typeof node === 'object' ? (node.children || []).flat(Infinity).map(text).join(' ').trim() : String(node);
const flush = () => new Promise(resolve => setImmediate(resolve));
const deferred = () => { let resolve, reject; const promise = new Promise((yes, no) => { resolve = yes; reject = no; }); return {promise, resolve, reject}; };
const record = (patch = {}) => ({id:'rec1', revision:1, title:'讨论', purpose:'meeting', mode:'both', status:'saved', createdAt:1000, endedAt:2000, error:null, warning:null, tracks:{}, ...patch});
const response = (value, ok = true) => ({ok, json:async () => structuredClone(value)});

async function fixture({purpose = 'meeting', initial = {}, intercept, confirm = true, cryptoAvailable = true} = {}) {
  let cursor = 0, props = {t:value => value, purpose, visible:true}, uuid = 0, mounted = true;
  const hooks = [], effects = [], timers = new Map(), calls = [], events = [], listeners = new Map();
  let pendingEffects = [], tree;
  const server = {recordings:[], active:null, owned:false, capability:{available:true, reason:''}, api:{configured:false}, ...initial};
  const useState = initialValue => {
    const index = cursor++;
    if (!(index in hooks)) hooks[index] = typeof initialValue === 'function' ? initialValue() : initialValue;
    return [hooks[index], next => { assert.ok(mounted, 'no state update after unmount'); hooks[index] = typeof next === 'function' ? next(hooks[index]) : next; }];
  };
  const useRef = value => { const index = cursor++; return hooks[index] ||= {current:value}; };
  const useEffect = (fn, deps) => {
    const index = cursor++, previous = effects[index];
    if (!previous || deps.some((value, i) => value !== previous.deps[i])) pendingEffects.push({index, fn, deps});
  };
  const h = (type, attributes, ...children) => ({type, props:attributes || {}, children});
  async function fetch(url, options = {}) {
    const action = options.body ? JSON.parse(options.body) : null;
    calls.push({url, options, action});
    const overridden = await intercept?.({url, options, action, server, calls});
    if (overridden !== undefined) return overridden;
    if (!action) return response(server);
    if (action.op === 'heartbeat') return response({value:server.active});
    if (action.op === 'start') {
      server.active = record({status:'starting', purpose:action.purpose, mode:action.mode, title:action.title});
      server.owned = true;
      server.recordings = [server.active, ...server.recordings];
      return response({value:server.active});
    }
    if (['pause', 'resume', 'stop'].includes(action.op)) {
      const value = record({...server.active, revision:(server.active?.revision || 1) + 1, status:({pause:'paused', resume:'recording', stop:'saved'})[action.op]});
      server.active = action.op === 'stop' ? null : value;
      if (!server.active) server.owned = false;
      server.recordings = [value, ...server.recordings.filter(row => row.id !== value.id)];
      return response({value});
    }
    if (action.op === 'delete') {
      const value = server.recordings.find(row => row.id === action.id);
      server.recordings = server.recordings.filter(row => row.id !== action.id);
      return response({value});
    }
    throw Error('unexpected action ' + action.op);
  }
  const context = {
    h, useState, useRef, useEffect, fetch,
    crypto:cryptoAvailable ? {randomUUID:() => 'uuid-' + ++uuid} : undefined,
    window:{
      confirm:message => { events.push(message); return confirm; },
      addEventListener:(name, handler) => { assert.ok(['pagehide', 'pageshow'].includes(name), 'never listen for app visibility'); listeners.set(name, handler); },
      removeEventListener:(name, handler) => { if (listeners.get(name) === handler) listeners.delete(name); }
    },
    document:{addEventListener:() => { throw Error('no document visibility listener'); }},
    setInterval:(fn, delay) => { assert.equal(delay, 3000); const id = timers.size + 1; timers.set(id, fn); return id; },
    clearInterval:id => timers.delete(id)
  };
  vm.runInNewContext(source + '\nglobalThis.Panel = RecordingPanel; globalThis.css = recordingCss; globalThis.texts = recordingTexts;', context);
  function render(next = {}) {
    props = {...props, ...next}; cursor = 0; pendingEffects = [];
    tree = context.Panel(props);
    for (const {index, fn, deps} of pendingEffects) {
      effects[index]?.cleanup?.(); effects[index] = {deps, cleanup:fn()};
    }
    return {tree, nodes:walk(tree), text:text(tree)};
  }
  function button(label) { return walk(tree).find(node => node.type === 'button' && (text(node) === label || node.props['aria-label'] === label)); }
  async function click(label) { const found = button(label); assert.ok(found, label + ' exists'); assert.equal(!!found.props.disabled, false, label + ' enabled'); const result = found.props.onClick(); await result; await flush(); return render(); }
  async function tick() { for (const fn of [...timers.values()]) fn(); await flush(); return render(); }
  function unmount() { for (const effect of effects) effect?.cleanup?.(); mounted = false; }
  render(); await flush(); render();
  return {render, click, button, tick, unmount, server, calls, events, timers, context, dispatch:name => listeners.get(name)?.()};
}

test('purpose defaults, secure per-instance identity, localized labels and local-only disclosure', async () => {
  for (const [purpose, mode] of [['chat', 'mic'], ['meeting', 'both']]) {
    const f = await fixture({purpose}), view = f.render();
    assert.equal(view.nodes.find(node => node.type === 'select').props.value, mode);
    assert.match(view.text, /系统权限请求与录音标记不能跳过/);
    assert.match(view.text, /不上传、不转写、不调用 AI/);
    assert.match(view.text, /15 秒保护停止/);
    assert.ok(f.calls[0].url.endsWith('?clientId=uuid-1'));
    assert.equal(f.events.length, 0, 'no custom permission confirmation');
    await f.click('开始录音');
    const action = f.calls.find(call => call.action?.op === 'start').action;
    assert.equal(action.mode, mode); assert.equal(action.purpose, purpose);
    assert.equal(action.clientId, 'uuid-1'); assert.equal(action.requestId, 'uuid-2');
    assert.equal(f.render().nodes.find(node => node.props.role === 'status').props['data-state'], 'starting');
    assert.ok(f.calls.every(call => call.url.startsWith(route)), 'no upload/model/chat endpoint');
    f.unmount(); await flush();
  }
});

test('initial loading and confirmed idle have distinct truthful status labels', async () => {
  const initialRead = deferred();
  const f = await fixture({intercept:async ({action}) => !action ? initialRead.promise : undefined});
  const status = () => f.render().nodes.find(node => node.props.role === 'status');
  assert.equal(text(status()), '录音状态尚未读取');
  assert.equal(f.button('开始录音').props.disabled, true);
  initialRead.resolve(response(f.server)); await flush(); f.render();
  assert.equal(text(status()), '未在录音');
  assert.equal(f.button('开始录音').props.disabled, false);
  await f.click('刷新录音状态');
  assert.equal(text(status()), '未在录音');
  assert.equal(f.calls.some(call => call.action?.op === 'start'), false);
  f.unmount();
});

test('manual controls, title/mode and ref-based double-click guard', async () => {
  const delayed = deferred();
  const f = await fixture({intercept:async ({action}) => action?.op === 'start' ? delayed.promise : undefined});
  let view = f.render();
  view.nodes.find(node => node.type === 'input').props.onChange({target:{value:' 周会 '}});
  view.nodes.find(node => node.type === 'select').props.onChange({target:{value:'system'}});
  f.render();
  const start = f.button('开始录音'), first = start.props.onClick();
  await start.props.onClick(); await flush();
  assert.equal(f.calls.filter(call => call.action?.op === 'start').length, 1);
  assert.equal(f.calls.find(call => call.action?.op === 'start').action.title, '周会');
  f.server.active = record({status:'recording', mode:'system'}); f.server.owned = true;
  delayed.resolve(response({value:f.server.active})); await first; f.render();
  await f.click('暂停录音'); assert.equal(f.server.active.status, 'paused');
  await f.click('继续录音'); assert.equal(f.server.active.status, 'recording');
  await f.click('停止并保存'); assert.equal(f.server.active, null);
  assert.ok(f.button('开始录音'));
  f.unmount();
});

test('lost start acknowledgement recovers owned state with GET, never repeats start, keeps error through polls', async () => {
  const f = await fixture({intercept:async ({action, server}) => {
    if (action?.op === 'start') { server.active = record({status:'recording'}); server.owned = true; throw Error('response disconnected'); }
  }});
  await f.click('开始录音');
  assert.match(f.render().text, /response disconnected/);
  assert.ok(f.button('暂停录音'));
  await f.tick(); await f.tick();
  assert.equal(f.calls.filter(call => call.action?.op === 'start').length, 1);
  assert.equal(f.calls.filter(call => call.action?.op === 'heartbeat').length, 2);
  assert.match(f.render().text, /response disconnected/, 'poll must not erase explicit action error');
  await f.click('刷新录音状态'); assert.doesNotMatch(f.render().text, /response disconnected/);
  f.unmount(); await flush();
});

test('another view cannot start, heartbeat or resume; explicit stop remains safe', async () => {
  const f = await fixture({initial:{active:record({status:'paused'}), owned:false}});
  assert.equal(f.button('开始录音'), undefined);
  assert.equal(f.button('继续录音').props.disabled, true);
  await f.button('继续录音').props.onClick(); await f.tick();
  assert.equal(f.calls.some(call => ['heartbeat', 'resume', 'start'].includes(call.action?.op)), false);
  assert.match(f.render().text, /不能接管继续/);
  await f.click('停止并保存');
  assert.equal(f.calls.filter(call => call.action?.op === 'stop').length, 1);
  f.unmount();
});

test('owned paused recording retains heartbeat; hiding stops with keepalive, reopening never resumes', async () => {
  const f = await fixture({initial:{active:record({status:'paused'}), owned:true}});
  await f.tick(); assert.equal(f.calls.filter(call => call.action?.op === 'heartbeat').length, 1);
  assert.equal(f.render({visible:false}).tree, null); await flush();
  const stop = f.calls.find(call => call.action?.op === 'stop');
  assert.equal(stop.options.keepalive, true); assert.equal(stop.action.clientId, 'uuid-1');
  assert.equal(f.timers.size, 0);
  f.render({visible:true}); await flush(); f.render();
  assert.equal(f.calls.some(call => ['start', 'resume'].includes(call.action?.op)), false);
  f.unmount();
});

test('late start success after unmount stops owned capture without updating unmounted state', async () => {
  const delayed = deferred();
  const f = await fixture({intercept:async ({action}) => action?.op === 'start' ? delayed.promise : undefined});
  const pending = f.button('开始录音').props.onClick(); await flush(); f.unmount();
  delayed.resolve(response({value:record({status:'starting'})})); await pending; await flush();
  const stops = f.calls.filter(call => call.action?.op === 'stop');
  assert.equal(stops.length, 1); assert.equal(stops[0].options.keepalive, true);
});

test('late lost start acknowledgement after hiding uses GET then keepalive stop', async () => {
  const delayed = deferred();
  const f = await fixture({intercept:async ({action}) => action?.op === 'start' ? delayed.promise : undefined});
  const pending = f.button('开始录音').props.onClick(); await flush();
  f.render({visible:false});
  f.server.active = record({status:'recording'}); f.server.owned = true;
  delayed.reject(Error('lost acknowledgement')); await pending; await flush();
  assert.equal(f.calls.filter(call => call.action?.op === 'start').length, 1);
  assert.equal(f.calls.filter(call => call.action?.op === 'stop').length, 1);
  f.render({visible:true}); await flush(); f.render();
  assert.equal(f.button('开始录音').props.disabled, false, 'old busy must clear on reopen');
  f.unmount();
});

test('late GET cannot replace a more recent mutation response', async () => {
  const delayed = deferred(); let deferNext = false;
  const f = await fixture({intercept:async ({action}) => !action && deferNext ? (deferNext = false, delayed.promise) : undefined});
  deferNext = true; const pendingPoll = f.tick(); await flush();
  await f.click('开始录音');
  delayed.resolve(response({recordings:[], active:null, owned:false, capability:{available:true}})); await pendingPoll; await flush();
  assert.equal(f.render().nodes.find(node => node.props.role === 'status').props['data-state'], 'starting');
  assert.equal(f.button('开始录音'), undefined);
  f.unmount(); await flush();
});

test('history shows separate manual audio, download and missing/silent warnings; purpose filter keeps global active', async () => {
  const track = {bytes:100, frames:50, sampleRate:16000, channels:1, durationMs:1800, peak:0, hasSignal:false, url:route + '/audio?id=rec1&track=microphone', downloadUrl:route + '/audio?id=rec1&track=microphone&download=1'};
  const f = await fixture({initial:{recordings:[record({tracks:{microphone:track}}), record({id:'chat1', purpose:'chat', title:'聊天录音'})], active:record({id:'other', purpose:'chat', status:'recording'}), owned:false}});
  const view = f.render(), audio = view.nodes.filter(node => node.type === 'audio');
  assert.equal(audio.length, 1); assert.equal(audio[0].props.controls, true); assert.equal(audio[0].props.preload, 'none');
  assert.equal(Object.hasOwn(audio[0].props, 'autoPlay'), false);
  assert.equal(view.nodes.find(node => node.type === 'a').props.download, true);
  assert.match(view.text, /未检测到有效声音/); assert.match(view.text, /该轨道缺失/);
  assert.doesNotMatch(view.text, /聊天录音/); assert.match(view.text, /不能接管继续/);
  await f.click('删除录音'); assert.equal(f.events.length, 1);
  assert.deepEqual(f.calls.find(call => call.action?.op === 'delete').action, {op:'delete', id:'rec1', revision:1});
  f.unmount();
});

test('delete cancellation, unsafe href rejection and unavailable capability disable capture', async () => {
  const f = await fixture({confirm:false, initial:{recordings:[record({mode:'mic', tracks:{microphone:{hasSignal:true, url:'https://example.test/a.wav', downloadUrl:'javascript:alert(1)'}}})], capability:{available:false, reason:'Native helper unavailable'}}});
  const view = f.render(); assert.equal(f.button('开始录音').props.disabled, true);
  assert.match(view.text, /Native helper unavailable/);
  assert.equal(view.nodes.filter(node => ['audio', 'a'].includes(node.type)).length, 0);
  await f.click('删除录音'); assert.equal(f.calls.some(call => call.action?.op === 'delete'), false);
  f.unmount();
});

test('no crypto identity disables start without an insecure fallback', async () => {
  const f = await fixture({cryptoAvailable:false});
  assert.equal(f.button('开始录音').props.disabled, true);
  assert.match(f.render().text, /无法生成安全的录音标识/);
  f.unmount();
});

test('page close sends keepalive stop; back/forward restore only polls, never restarts', async () => {
  const f = await fixture({initial:{active:record({status:'recording'}), owned:true}});
  f.dispatch('pagehide'); await flush();
  assert.equal(f.calls.filter(call => call.action?.op === 'stop').length, 1);
  assert.equal(f.calls.find(call => call.action?.op === 'stop').options.keepalive, true);
  await f.tick();
  assert.equal(f.calls.some(call => call.action?.op === 'heartbeat'), false);
  f.dispatch('pageshow'); await flush(); f.render();
  assert.equal(f.calls.some(call => ['start', 'resume'].includes(call.action?.op)), false);
  assert.ok(f.button('开始录音'));
  f.unmount();
});

test('closing a non-owner view never stops another client and an unavailable helper does not disable saved playback', async () => {
  const f = await fixture({initial:{
    active:record({id:'other', status:'recording'}), owned:false,
    capability:{available:false, reason:'offline'},
    recordings:[record({mode:'mic', tracks:{microphone:{url:route + '/audio?id=rec1&track=microphone', downloadUrl:route + '/audio?id=rec1&track=microphone&download=1', hasSignal:true}}})]
  }});
  assert.equal(f.render().nodes.filter(node => node.type === 'audio').length, 1);
  assert.equal(f.render().nodes.find(node => node.type === 'audio').props.controls, true);
  f.dispatch('pagehide'); await flush(); f.unmount(); await flush();
  assert.equal(f.calls.some(call => call.action?.op === 'stop'), false);
});

test('Host errors remain readable after successful polling; only explicit action clears them', async () => {
  const f = await fixture({initial:{active:record({status:'recording'}), owned:true}, intercept:async ({action}) => action?.op === 'pause' ? response({error:'native capture refused pause'}, false) : undefined});
  await f.click('暂停录音'); assert.match(f.render().text, /native capture refused pause/);
  await f.tick(); assert.match(f.render().text, /native capture refused pause/);
  await f.click('刷新录音状态'); assert.doesNotMatch(f.render().text, /native capture refused pause/);
  f.unmount(); await flush();
});

test('stale heartbeat failure from before page restoration cannot overwrite current view', async () => {
  const delayed = deferred();
  const f = await fixture({initial:{active:record({status:'recording'}), owned:true}, intercept:async ({action}) => action?.op === 'heartbeat' ? delayed.promise : undefined});
  await f.tick(); f.dispatch('pagehide'); await flush();
  f.dispatch('pageshow'); await flush();
  delayed.reject(Error('old heartbeat failure')); await flush();
  assert.doesNotMatch(f.render().text, /old heartbeat failure/);
  f.unmount();
});

test('all fixed strings have locale entries; styling stays on existing theme aliases', async () => {
  const f = await fixture(); const seen = [];
  f.render({t:value => { seen.push(value); return value; }});
  for (const value of seen) assert.ok(f.context.texts.includes(value), value + ' is localizable');
  assert.match(f.context.css, /--dsw-alias-/); assert.doesNotMatch(source, /getUserMedia|MediaRecorder|autoplay|visibilitychange|\.play\(/i);
  f.unmount();
});
