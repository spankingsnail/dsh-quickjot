// Embedded in the shared React factory; the Host owns durable announcement/read state.
const REMINDER_URL = '/api/dsh-calendar/in-app-reminders';
const reminderTexts = [
  '提醒', '随手记提醒', '未读提醒', '打开未读提醒', '关闭未读提醒', '关闭提示', '查看未读提醒',
  '日程', '待办', '错过的提醒', '标为已读', '本页全部标为已读', '查看随手记',
  '暂无未读提醒。', '正在同步…', '重试同步', '提醒同步失败', '提醒请求超时，请重试同步。',
  '标为已读失败；不会自动重试，请核对未读列表后手动重试。',
  '有时间的未完成待办和日程按截止或日程时间提醒；便签和无时间事项不提醒。',
  '退出应用不提醒；休眠恢复后补提示。不需要微信。',
  '关闭提示不会标为已读；已读不会完成实际待办。',
  '未读较多，仅显示最近 100 条；本页全部已读只处理当前列表。',
  '新提醒已集中到未读列表。', '上海时间', '提醒状态尚未读取'
];
const reminderCss = `
.ssn{position:fixed;right:18px;bottom:18px;z-index:70;width:350px;max-width:calc(100vw - 24px);max-height:calc(100dvh - 32px);display:flex;flex-direction:column;gap:8px;pointer-events:none;color:var(--dsw-alias-label-primary);font:inherit;font-size:13px;line-height:1.5}
.ssn button{font:inherit;color:inherit;background:var(--dsw-alias-bg-base);border:1px solid var(--dsw-alias-border-l2);border-radius:8px;padding:6px 10px;cursor:pointer}.ssn button:disabled{opacity:.55;cursor:not-allowed}.ssn :focus-visible{outline:2px solid var(--dsw-alias-brand-primary);outline-offset:3px}.ssn-card,.ssn-toggle{pointer-events:auto;background:var(--dsw-alias-bg-layer-1);border:1px solid var(--dsw-alias-border-l1);border-radius:12px;box-shadow:0 5px 20px color-mix(in srgb,var(--dsw-alias-label-primary) 8%,transparent)}.ssn-card{padding:12px;min-height:0;overflow-wrap:anywhere}.ssn-toast{border-left:3px solid var(--dsw-alias-brand-primary)}.ssn-head,.ssn-actions{display:flex;gap:8px;align-items:center;justify-content:space-between}.ssn-head strong{min-width:0;overflow-wrap:anywhere}.ssn-head button{flex:none}.ssn-meta,.ssn-help{color:var(--dsw-alias-label-secondary);font-size:12px}.ssn-meta{display:flex;gap:7px;flex-wrap:wrap;margin:5px 0;font-variant-numeric:tabular-nums}.ssn-body{white-space:pre-wrap;overflow-wrap:anywhere;max-height:72px;overflow:auto;margin:6px 0}.ssn-toggle{align-self:flex-end;font-variant-numeric:tabular-nums}.ssn-inbox{display:flex;flex-direction:column;gap:8px;max-height:min(62dvh,540px)}.ssn-list{overflow:auto;overscroll-behavior:contain;min-height:0}.ssn-entry{padding:11px 0;border-top:1px solid var(--dsw-alias-border-l1)}.ssn-entry strong{display:block;overflow-wrap:anywhere}.ssn-actions{justify-content:flex-start;flex-wrap:wrap}.ssn-help{margin:5px 0}.ssn-error{pointer-events:auto;white-space:pre-wrap;max-height:120px;overflow:auto}.ssn-toasts{display:flex;flex-direction:column;gap:8px;min-height:0;overflow:auto;max-height:40dvh}.ssn-more{pointer-events:auto;align-self:flex-end}
@media(max-width:520px){.ssn{right:12px;bottom:12px}.ssn-inbox{max-height:58dvh}.ssn-card{padding:10px}}
`;
function ReminderCenter({t, layout}) {
  const [snapshot, setSnapshot] = useState(null);
  const [toasts, setToasts] = useState([]);
  const [expanded, setExpanded] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const alive = useRef(false), epoch = useRef(0), suspended = useRef(false);
  const working = useRef(false), pending = useRef(false), controller = useRef(null);
  const seen = useRef(new Set()), currentToasts = useRef([]);
  const visible = () => document.visibilityState !== 'hidden';
  const valid = token => alive.current && !suspended.current && token === epoch.current;

  async function request(action) {
    const abort = new AbortController(); controller.current = abort;
    let timeout, onAbort, timedOut = false;
    const cancelled = new Promise((_, reject) => {
      onAbort = () => reject(Error(timedOut ? t('提醒请求超时，请重试同步。') : 'aborted'));
      abort.signal.addEventListener('abort', onAbort, {once:true});
      timeout = setTimeout(() => { timedOut = true; abort.abort(); }, 12000);
    });
    try {
      return await Promise.race([cancelled, (async () => {
        const response = await fetch(REMINDER_URL, {
          method:action ? 'POST' : 'GET', credentials:'same-origin', cache:'no-store', signal:abort.signal,
          ...(action ? {headers:{'content-type':'application/json'}, body:JSON.stringify(action)} : {})
        });
        const value = await response.json();
        if (!response.ok) throw Error(value.error || t('提醒同步失败'));
        if (!Array.isArray(value.unread) || !Number.isSafeInteger(value.unreadCount)) throw Error(t('提醒同步失败'));
        return value;
      })()]);
    } finally {
      clearTimeout(timeout); abort.signal.removeEventListener('abort', onAbort);
      if (controller.current === abort) controller.current = null;
    }
  }
  function accept(value, announce) {
    setSnapshot(value);
    const ids = new Set(value.unread.map(entry => entry.id));
    const fresh = announce && visible() ? (value.alerts || []).filter(entry => !seen.current.has(entry.id) && !entry.readAt && !entry.cancelled && (ids.has(entry.id) || value.truncated)) : [];
    for (const entry of value.alerts || []) seen.current.add(entry.id);
    currentToasts.current = [...fresh, ...currentToasts.current.filter(entry => ids.has(entry.id) && !fresh.some(next => next.id === entry.id))]
      .sort((a,b) => b.createdAt.localeCompare(a.createdAt)).slice(0,3);
    setToasts(currentToasts.current);
  }
  async function sync(explicit = false) {
    if (!alive.current || suspended.current) return;
    if (working.current) { pending.current = true; return; }
    working.current = true; setBusy(true);
    if (explicit) setError('');
    const token = epoch.current;
    try {
      const value = await request(visible() ? {op:'claim'} : null);
      if (valid(token)) accept(value, true);
    } catch (failure) {
      if (valid(token)) setError(previous => previous || failure.message || t('提醒同步失败'));
    } finally {
      working.current = false;
      if (alive.current && !suspended.current) {
        setBusy(false);
        if (pending.current) { pending.current = false; void sync(); }
      }
    }
  }
  async function markRead(ids) {
    if (working.current || !ids.length || !alive.current || suspended.current) return;
    working.current = true; setBusy(true); setError('');
    const token = epoch.current;
    try {
      const value = await request({op:'read', ids:[...new Set(ids)].slice(0,100)});
      if (valid(token)) accept(value, false);
    } catch (failure) {
      if (valid(token)) setError(t('标为已读失败；不会自动重试，请核对未读列表后手动重试。') + ' ' + failure.message);
    } finally {
      working.current = false;
      if (alive.current && !suspended.current) {
        setBusy(false);
        if (pending.current) { pending.current = false; void sync(); }
      }
    }
  }
  function dismiss(id) {
    currentToasts.current = currentToasts.current.filter(entry => entry.id !== id);
    setToasts(currentToasts.current);
  }
  useEffect(() => {
    alive.current = true; suspended.current = false; epoch.current++;
    const wake = () => { if (suspended.current) { suspended.current = false; epoch.current++; } void sync(); };
    const visibility = () => { if (visible()) wake(); };
    const hide = () => { suspended.current = true; epoch.current++; pending.current = false; controller.current?.abort(); };
    window.addEventListener('focus', wake); window.addEventListener('pageshow', wake); window.addEventListener('pagehide', hide);
    document.addEventListener('visibilitychange', visibility);
    const timer = setInterval(() => { void sync(); }, 5000);
    void sync();
    return () => {
      alive.current = false; epoch.current++; pending.current = false; controller.current?.abort();
      clearInterval(timer);
      window.removeEventListener('focus', wake); window.removeEventListener('pageshow', wake); window.removeEventListener('pagehide', hide);
      document.removeEventListener('visibilitychange', visibility);
    };
  }, []);
  const entries = (snapshot?.unread || []).slice(0,100), count = snapshot?.unreadCount || 0;
  const time = value => {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? value : new Intl.DateTimeFormat('zh-CN', {timeZone:'Asia/Shanghai', month:'2-digit', day:'2-digit', hour:'2-digit', minute:'2-digit', hour12:false}).format(date);
  };
  const metadata = entry => h('div', {className:'ssn-meta'},
    h('span', null, t(entry.kind === 'event' ? '日程' : '待办')),
    h('time', {dateTime:entry.dueAt, title:t('上海时间')}, time(entry.dueAt)),
    entry.missed && h('span', null, t('错过的提醒')));
  const open = () => setExpanded(true);
  return h('aside', {className:'ssn', 'aria-label':t('提醒'), 'aria-live':'polite', 'aria-relevant':'additions text'},
    h('style', null, reminderCss),
    !expanded && h('div', {className:'ssn-toasts'}, ...toasts.map(entry => h('div', {key:entry.id, className:'ssn-card ssn-toast', role:'status'},
      h('div', {className:'ssn-head'}, h('strong', null, entry.title), h('button', {type:'button', 'aria-label':t('关闭提示') + ': ' + entry.title, onClick:() => dismiss(entry.id)}, '×')),
      metadata(entry), entry.body && h('p', {className:'ssn-body'}, entry.body),
      h('div', {className:'ssn-actions'}, h('button', {type:'button', disabled:busy, onClick:() => markRead([entry.id])}, t('标为已读')), h('button', {type:'button', onClick:open}, t('查看未读提醒')))))),
    !expanded && count > toasts.length && toasts.length > 0 && h('button', {className:'ssn-more', type:'button', onClick:open}, t('新提醒已集中到未读列表。') + ' (' + count + ')'),
    error && h('div', {className:'ssn-card ssn-error', role:'status'}, h('div', null, error), h('button', {type:'button', disabled:busy, onClick:() => sync(true)}, t('重试同步'))),
    expanded && h('section', {className:'ssn-card ssn-inbox', role:'region', 'aria-label':t('未读提醒')},
      h('div', {className:'ssn-head'}, h('strong', null, t('未读提醒') + ' (' + count + ')'), h('button', {type:'button', 'aria-label':t('关闭未读提醒'), onClick:() => setExpanded(false)}, '×')),
      h('div', {className:'ssn-actions'}, h('button', {type:'button', disabled:busy || !entries.length, onClick:() => markRead(entries.map(entry => entry.id))}, t('本页全部标为已读') + ' (' + entries.length + ')'), h('button', {type:'button', onClick:() => layout.selectPanel('dsh-calendar:page')}, t('查看随手记'))),
      h('div', {className:'ssn-list'}, ...entries.map(entry => h('article', {key:entry.id, className:'ssn-entry'}, h('strong', null, entry.title), metadata(entry), entry.body && h('p', {className:'ssn-body'}, entry.body), h('button', {type:'button', disabled:busy, 'aria-label':t('标为已读') + ': ' + entry.title, onClick:() => markRead([entry.id])}, t('标为已读')))),
        !entries.length && h('p', null, snapshot ? t('暂无未读提醒。') : t('提醒状态尚未读取'))),
      snapshot?.truncated && h('p', {className:'ssn-help'}, t('未读较多，仅显示最近 100 条；本页全部已读只处理当前列表。')),
      h('p', {className:'ssn-help'}, t('有时间的未完成待办和日程按截止或日程时间提醒；便签和无时间事项不提醒。')),
      h('p', {className:'ssn-help'}, t('退出应用不提醒；休眠恢复后补提示。不需要微信。')),
      h('p', {className:'ssn-help'}, t('关闭提示不会标为已读；已读不会完成实际待办。'))),
    h('button', {type:'button', className:'ssn-toggle', 'aria-expanded':expanded, 'aria-label':t(expanded ? '关闭未读提醒' : '打开未读提醒'), onClick:() => setExpanded(!expanded), title:busy ? t('正在同步…') : t('未读提醒')}, t('提醒') + ' ' + count));
}
