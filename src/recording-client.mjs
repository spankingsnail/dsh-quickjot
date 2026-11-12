// Embedded inside the existing React factory. No capture, upload or model API runs here.
const RECORDING_URL = '/api/suishouji-67369b06/recordings';
const recordingTexts = [
  '本地录音', '录音标题（可选）', '录音来源', '麦克风', '系统声音', '麦克风 + 系统声音',
  '开始录音', '暂停录音', '继续录音', '停止并保存', '刷新录音状态', '正在处理…',
  '等待系统权限 / 启动中', '正在录音', '已暂停', '正在停止并保存', '已保存', '录音已中断', '录音失败',
  '系统权限请求与录音标记不能跳过；开始前请告知参与者。',
  '仅保存本地音频，不上传、不转写、不调用 AI。麦克风与系统声音分轨回听；后续可另行配置转写 API，当前未接入。',
  '关闭或切离此面板会停止；可切换到会议应用。断网后约 15 秒保护停止，不会自动恢复录音。',
  '两轨分别回听，不混音、不做回声消除。双轨建议戴耳机，避免扬声器声音被麦克风重复收录。',
  '启动中仅表示等待设备就绪，不表示已收到音频样本。',
  '另一个窗口正在录音；这里可以安全停止，但不能接管继续。',
  '录音功能尚不可用', '无法生成安全的录音标识，请更新浏览器。',
  '录音请求失败；正在核对本地状态，不会自动重试开始。', '读取录音状态失败', '操作失败',
  '最近录音', '暂无本类录音。', '下载音频', '删除录音', '删除这条录音及本地音频？',
  '麦克风轨', '系统声音轨', '该轨道缺失或尚未保存，不能保证收音。',
  '未检测到有效声音，不能保证已录到所需内容。', '有声音不等于内容完整，请手动回听核对。',
  '录音状态尚未读取', '未在录音', '标题', '录音', '轨道', '秒'
];
const recordingCss = `
.ssr{border:1px solid var(--dsw-alias-border-l1);border-radius:12px;background:var(--dsw-alias-bg-layer-1);padding:14px;margin:12px 0;color:var(--dsw-alias-label-primary);font:inherit;min-width:0}
.ssr-head,.ssr-controls,.ssr-record-head{display:flex;align-items:center;gap:9px;flex-wrap:wrap}.ssr-head{justify-content:space-between}.ssr-head strong{font-size:14px}.ssr-controls{margin:12px 0}.ssr-controls input{flex:1;min-width:120px}.ssr-controls select{max-width:100%}.ssr button,.ssr input,.ssr select{font:inherit;color:inherit;border:1px solid var(--dsw-alias-border-l2);border-radius:8px;background:var(--dsw-alias-bg-base);padding:7px 10px}.ssr button{cursor:pointer}.ssr button:disabled{opacity:.5;cursor:not-allowed}.ssr :focus-visible{outline:2px solid var(--dsw-alias-brand-primary);outline-offset:3px}.ssr-mic{display:inline-flex;align-items:center;gap:7px}.ssr-mic svg{width:17px;height:17px}.ssr-status{display:flex;gap:7px;align-items:center;font-size:12px;font-variant-numeric:tabular-nums}.ssr-status[data-state=recording]::before{content:'';width:8px;height:8px;border-radius:50%;background:var(--dsw-alias-brand-primary)}.ssr p{font-size:12px;line-height:1.6;margin:7px 0}.ssr-muted{color:var(--dsw-alias-label-secondary)}.ssr-error{border-left:3px solid var(--dsw-alias-brand-primary);padding:7px 10px;white-space:pre-wrap;overflow-wrap:anywhere}.ssr-history{border-top:1px solid var(--dsw-alias-border-l1);padding-top:10px;margin-top:12px}.ssr-history>summary{cursor:pointer;font-size:12px}.ssr-record{padding:12px 0;border-bottom:1px solid var(--dsw-alias-border-l1)}.ssr-record:last-child{border-bottom:0}.ssr-record-head{justify-content:space-between;font-size:13px}.ssr-record-head strong{overflow-wrap:anywhere}.ssr-track{display:grid;grid-template-columns:minmax(85px,auto) minmax(100px,1fr) auto;gap:9px;align-items:center;margin-top:9px}.ssr-track span{font-size:12px}.ssr-track audio{width:100%;min-width:0;height:32px}.ssr-track a{color:var(--dsw-alias-brand-primary);font-size:12px}.ssr-track small{grid-column:1/-1;color:var(--dsw-alias-label-secondary)}
@media(max-width:520px){.ssr-track{grid-template-columns:1fr auto}.ssr-track audio{grid-column:1/-1;grid-row:2}.ssr-controls input{flex-basis:100%}.ssr-controls{align-items:stretch}.ssr{padding:12px}}
`;
function RecordingPanel({t, purpose = 'meeting', visible = true}) {
  const [snapshot, setSnapshot] = useState(null);
  const [mode, setMode] = useState(purpose === 'chat' ? 'mic' : 'both');
  const [title, setTitle] = useState('');
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const client = useRef(null);
  if (!client.current && typeof crypto !== 'undefined' && crypto.randomUUID) client.current = crypto.randomUUID();
  const alive = useRef(false), lifecycle = useRef(0), io = useRef(0), reads = useRef(0);
  const state = useRef(null), working = useRef(false), reading = useRef(false), beating = useRef(false);
  const showing = useRef(visible);
  showing.current = visible;
  const activeStatuses = ['starting', 'recording', 'paused', 'stopping'];
  const isActive = record => record && activeStatuses.includes(record.status);
  const statusText = status => t(({
    starting:'等待系统权限 / 启动中', recording:'正在录音', paused:'已暂停', stopping:'正在停止并保存',
    saved:'已保存', interrupted:'录音已中断', failed:'录音失败', idle:'未在录音'
  })[status] || '录音状态尚未读取');
  const current = epoch => alive.current && showing.current && lifecycle.current === epoch;
  function accept(value) { state.current = value; setSnapshot(value); }
  async function post(action, keepalive = false) {
    const response = await fetch(RECORDING_URL, {
      method:'POST', credentials:'same-origin', headers:{'content-type':'application/json'},
      body:JSON.stringify(action), ...(keepalive ? {keepalive:true} : {})
    });
    const result = await response.json();
    if (!response.ok) throw Error(result.error || t('操作失败'));
    return result.value;
  }
  function stopDetached(record) {
    if (!record?.id || !client.current) return;
    void post({op:'stop', id:record.id, clientId:client.current}, true).catch(() => {});
  }
  async function refresh(epoch = lifecycle.current, recover = false) {
    const version = io.current, sequence = ++reads.current;
    const response = await fetch(RECORDING_URL + '?clientId=' + encodeURIComponent(client.current || ''), {credentials:'same-origin'});
    const value = await response.json();
    if (!response.ok) throw Error(value.error || t('读取录音状态失败'));
    if (!current(epoch)) {
      // A lost start response can arrive after the panel closes: recover ownership, then stop.
      if (recover && value.owned && isActive(value.active)) stopDetached(value.active);
      return value;
    }
    if (sequence === reads.current && version === io.current) accept(value);
    return value;
  }
  function acceptRecord(record, op) {
    if (!record?.id) return;
    const previous = state.current || {recordings:[], active:null, owned:false, capability:null};
    const recordings = op === 'delete' ? previous.recordings.filter(row => row.id !== record.id)
      : [record, ...previous.recordings.filter(row => row.id !== record.id)];
    const active = isActive(record) ? record : previous.active?.id === record.id ? null : previous.active;
    accept({...previous, recordings, active, owned:active ? op === 'start' || previous.owned : false});
  }
  async function act(op, record) {
    if (working.current || !current(lifecycle.current)) return;
    const latest = state.current;
    if (op === 'start' && (!client.current || !latest || latest.active || !latest.capability?.available)) return;
    if (['pause', 'resume'].includes(op) && (!latest?.owned || record?.id !== latest.active?.id)) return;
    if (op === 'delete' && !window.confirm(t('删除这条录音及本地音频？'))) return;
    working.current = true;
    const epoch = lifecycle.current;
    ++io.current;
    setBusy(op); setError('');
    try {
      if (op === 'refresh') { await refresh(epoch); return; }
      const action = op === 'start'
        ? {op, clientId:client.current, requestId:crypto.randomUUID(), mode, purpose, title:title.trim()}
        : op === 'delete' ? {op, id:record.id, revision:record.revision}
        : {op, id:record.id, clientId:client.current};
      const value = await post(action);
      ++io.current;
      if (!current(epoch)) {
        if (op === 'start' && isActive(value)) stopDetached(value);
        return;
      }
      if (op === 'delete') {
        const previous = state.current;
        if (previous) accept({...previous, recordings:previous.recordings.filter(row => row.id !== record.id)});
      } else acceptRecord(value, op);
      await refresh(epoch);
    } catch (failure) {
      if (current(epoch)) setError((op === 'start' ? t('录音请求失败；正在核对本地状态，不会自动重试开始。') + '\n' : '') + failure.message);
      if (op === 'start') {
        // GET is safe to retry; POST start is never automatically repeated.
        try { await refresh(epoch, true); } catch (readError) {
          if (current(epoch)) setError(t('录音请求失败；正在核对本地状态，不会自动重试开始。') + '\n' + failure.message + '\n' + readError.message);
        }
      }
    } finally {
      ++io.current;
      working.current = false;
      if (alive.current && showing.current) setBusy('');
    }
  }
  useEffect(() => {
    alive.current = true;
    let epoch = ++lifecycle.current;
    if (!visible) return () => { alive.current = false; ++lifecycle.current; };
    if (!working.current) setBusy('');
    const poll = async () => {
      if (reading.current || !current(epoch)) return;
      reading.current = true;
      const requestEpoch = epoch;
      try { await refresh(requestEpoch); } catch (failure) { if (current(requestEpoch)) setError(previous => previous || failure.message); }
      finally { reading.current = false; }
    };
    const heartbeat = async () => {
      const value = state.current;
      if (!current(epoch) || beating.current || !value?.owned || !isActive(value.active) || !client.current) return;
      beating.current = true;
      const requestEpoch = epoch;
      try { await post({op:'heartbeat', id:value.active.id, clientId:client.current}); }
      catch (failure) { if (current(requestEpoch)) setError(previous => previous || failure.message); }
      finally { beating.current = false; }
    };
    function leavePage() {
      alive.current = false; ++lifecycle.current;
      if (state.current?.owned && isActive(state.current.active)) stopDetached(state.current.active);
    }
    function returnPage() {
      alive.current = true; epoch = ++lifecycle.current;
      void poll(); // Back/forward cache restore only refreshes state; never resumes capture.
    }
    window.addEventListener('pagehide', leavePage);
    window.addEventListener('pageshow', returnPage);
    void poll();
    const timer = setInterval(() => { void poll(); void heartbeat(); }, 3000);
    return () => {
      clearInterval(timer);
      window.removeEventListener('pagehide', leavePage);
      window.removeEventListener('pageshow', returnPage);
      leavePage();
    };
  }, [visible]);
  if (!visible) return null;
  const active = snapshot?.active;
  const rows = (snapshot?.recordings || []).filter(row => row.purpose === purpose && row.id !== active?.id);
  const blocked = !!busy || !client.current || !snapshot?.capability?.available;
  const safeUrl = value => typeof value === 'string' && value.startsWith(RECORDING_URL + '/audio?id=') ? value : null;
  function track(record, key) {
    const label = t(key === 'microphone' ? '麦克风轨' : '系统声音轨');
    const value = record.tracks?.[key], url = safeUrl(value?.url), download = safeUrl(value?.downloadUrl);
    return h('div', {className:'ssr-track', key},
      h('span', null, label + (value ? ' · ' + Math.round((value.durationMs || 0) / 1000) + t('秒') : '')),
      url ? h('audio', {controls:true, preload:'none', src:url, 'aria-label':label}) : null,
      download ? h('a', {href:download, download:true}, t('下载音频')) : null,
      h('small', null, !value || !url ? t('该轨道缺失或尚未保存，不能保证收音。') : value.hasSignal === false ? t('未检测到有效声音，不能保证已录到所需内容。') : t('有声音不等于内容完整，请手动回听核对。')));
  }
  function tracks(record) {
    return [record.mode !== 'system' && track(record, 'microphone'), record.mode !== 'mic' && track(record, 'system')];
  }
  const micIcon = h('svg', {viewBox:'0 0 24 24', fill:'none', stroke:'currentColor', strokeWidth:1.7, 'aria-hidden':true},
    h('rect', {x:9, y:2, width:6, height:12, rx:3}), h('path', {d:'M5 10v2a7 7 0 0 0 14 0v-2M12 19v3M8 22h8'}));
  return h('section', {className:'ssr', 'aria-label':t('本地录音')},
    h('div', {className:'ssr-head'}, h('strong', null, t('本地录音')),
      h('span', {className:'ssr-status', role:'status', 'data-state':active?.status || 'idle'}, statusText(active?.status || (snapshot ? 'idle' : 'loading'))),
      h('button', {type:'button', disabled:!!busy, onClick:() => act('refresh'), 'aria-label':t('刷新录音状态')}, '↻')),
    h('p', {className:'ssr-muted'}, t('系统权限请求与录音标记不能跳过；开始前请告知参与者。')),
    !active && h('div', {className:'ssr-controls'},
      h('input', {value:title, maxLength:200, 'aria-label':t('录音标题（可选）'), placeholder:t('录音标题（可选）'), disabled:!!busy, onChange:event => setTitle(event.target.value)}),
      h('select', {value:mode, 'aria-label':t('录音来源'), disabled:!!busy, onChange:event => setMode(event.target.value)},
        h('option', {value:'mic'}, t('麦克风')), h('option', {value:'system'}, t('系统声音')), h('option', {value:'both'}, t('麦克风 + 系统声音'))),
      h('button', {type:'button', className:'ssr-mic', disabled:blocked, onClick:() => act('start')}, micIcon, t('开始录音'))),
    active && h('div', null,
      h('p', null, active.title || t('录音')),
      active.status === 'starting' && h('p', {className:'ssr-muted'}, t('启动中仅表示等待设备就绪，不表示已收到音频样本。')),
      !snapshot.owned && h('p', {className:'ssr-muted'}, t('另一个窗口正在录音；这里可以安全停止，但不能接管继续。')),
      h('div', {className:'ssr-controls'},
        active.status === 'recording' && h('button', {type:'button', disabled:!!busy || !snapshot.owned, onClick:() => act('pause', active)}, t('暂停录音')),
        active.status === 'paused' && h('button', {type:'button', disabled:!!busy || !snapshot.owned, onClick:() => act('resume', active)}, t('继续录音')),
        h('button', {type:'button', disabled:!!busy || active.status === 'stopping', onClick:() => act('stop', active)}, t('停止并保存'))),
      active.warning && h('p', {className:'ssr-muted'}, active.warning),
      active.error && h('p', {className:'ssr-error', role:'alert'}, active.error)),
    busy && h('p', {className:'ssr-muted'}, t('正在处理…')),
    !client.current && h('p', {role:'alert'}, t('无法生成安全的录音标识，请更新浏览器。')),
    snapshot?.capability && !snapshot.capability.available && h('p', {className:'ssr-error', role:'alert'}, snapshot.capability.reason || t('录音功能尚不可用')),
    error && h('p', {className:'ssr-error', role:'alert'}, error),
    h('p', {className:'ssr-muted'}, t('仅保存本地音频，不上传、不转写、不调用 AI。麦克风与系统声音分轨回听；后续可另行配置转写 API，当前未接入。')),
    h('p', {className:'ssr-muted'}, t('两轨分别回听，不混音、不做回声消除。双轨建议戴耳机，避免扬声器声音被麦克风重复收录。')),
    h('p', {className:'ssr-muted'}, t('关闭或切离此面板会停止；可切换到会议应用。断网后约 15 秒保护停止，不会自动恢复录音。')),
    h('details', {className:'ssr-history'}, h('summary', null, t('最近录音') + ' · ' + rows.length),
      ...rows.map(record => h('article', {className:'ssr-record', key:record.id},
        h('div', {className:'ssr-record-head'}, h('strong', null, record.title || t('录音')), h('span', null, statusText(record.status)),
          h('button', {type:'button', disabled:!!busy || isActive(record), onClick:() => act('delete', record)}, t('删除录音'))),
        record.warning && h('p', {className:'ssr-muted'}, record.warning),
        record.error && h('p', {className:'ssr-error', role:'alert'}, record.error), ...tracks(record))),
      rows.length === 0 && h('p', {className:'ssr-muted'}, t('暂无本类录音。'))));
}
