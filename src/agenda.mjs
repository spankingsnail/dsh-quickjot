// View-only agenda helpers. No item writes, reminder changes or host settings.
export const AGENDA_DAY_MS=86400000;
export function agendaDate(value=Date.now()){
  if(value===null||value==='')return '';
  const date=new Date(value);return Number.isFinite(date.getTime())?new Intl.DateTimeFormat('sv-SE',{timeZone:'Asia/Shanghai',year:'numeric',month:'2-digit',day:'2-digit'}).format(date):'';
}
export function shiftAgendaDay(day,delta){return new Date(Date.parse(day+'T00:00:00Z')+delta*AGENDA_DAY_MS).toISOString().slice(0,10);}
export function selectAgenda(items,{today,mode='upcoming',day='',month='',showCompleted=false,search=''}={}){
  const query=search.trim().toLocaleLowerCase();
  const matches=items.filter(x=>x.kind==='event'&&(showCompleted||!x.done)&&(!query||`${x.title} ${x.body??''} ${(x.tags??[]).join(' ')}`.toLocaleLowerCase().includes(query)))
    .map(item=>({item,date:item.dueAt?agendaDate(item.dueAt):''})).filter(x=>x.date)
    .sort((a,b)=>Date.parse(a.item.dueAt)-Date.parse(b.item.dueAt)||String(a.item.id).localeCompare(String(b.item.id)));
  const inRange=date=>mode==='day'?date===day:mode==='month'?date.startsWith(month):mode==='week'?date>=today&&date<shiftAgendaDay(today,7):date>=today;
  // Old incomplete work is visible by count, but never pushes today's list down.
  const overdue=mode==='upcoming'?matches.filter(x=>x.date<today&&!x.item.done).map(x=>x.item):[];
  const visible=matches.filter(x=>inRange(x.date)).map(x=>x.item);
  const groups=[];for(const item of visible){const date=agendaDate(item.dueAt);let group=groups.at(-1);if(group?.date!==date){group={date,items:[]};groups.push(group);}group.items.push(item);}
  return {items:visible,overdue,groups};
}
export function agendaViewKey({date,tab,mode,day,month,showCompleted,search}){return JSON.stringify([date??'',tab,tab==='event'?mode:'',tab==='event'&&mode==='day'?day:'',tab==='event'&&mode==='month'?month:'',tab==='event'&&Boolean(showCompleted),search]);}
export function readAgendaView(storage,key,today){
  const empty={date:today,tab:'event',mode:'upcoming',day:'',month:today.slice(0,7),showCompleted:false,search:'',positions:{}};
  try{
    const raw=JSON.parse(storage?.getItem(key)??'null');if(!raw||raw.version!==1)return empty;
    const view={...empty,tab:['event','todo','note'].includes(raw.tab)?raw.tab:'event',showCompleted:raw.showCompleted===true};
    // A new Shanghai day starts with current work, not yesterday's date filter.
    if(raw.date!==today)return view;
    view.mode=['upcoming','week','month','day'].includes(raw.mode)?raw.mode:'upcoming';
    const validDay=typeof raw.day==='string'&&/^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/.test(raw.day)&&new Date(raw.day+'T00:00:00Z').toISOString().slice(0,10)===raw.day;
    view.day=validDay?raw.day:'';
    view.month=typeof raw.month==='string'&&/^\d{4}-(0[1-9]|1[0-2])$/.test(raw.month)?raw.month:empty.month;
    if(view.mode==='day'&&!view.day)view.mode='upcoming';
    view.search=typeof raw.search==='string'?raw.search.slice(0,500):'';
    if(raw.positions&&typeof raw.positions==='object'&&!Array.isArray(raw.positions)){
      for(const [name,pos] of Object.entries(raw.positions).slice(-40))if(pos&&Number.isFinite(pos.top)&&pos.top>=0)view.positions[name]={top:pos.top,anchor:typeof pos.anchor==='string'?pos.anchor:'',offset:Number.isFinite(pos.offset)?pos.offset:0,overdueOpen:pos.overdueOpen===true};
    }
    return view;
  }catch{return empty;}
}
export function writeAgendaView(storage,key,view){try{storage?.setItem(key,JSON.stringify({...view,version:1,positions:Object.fromEntries(Object.entries(view.positions??{}).slice(-40))}));}catch{/* Storage can be disabled; browsing must still work. */}}
export function captureAgendaPosition(root,overdueOpen=false){
  if(!root)return null;
  const boundary=root.querySelector('.ssj-nav')?.getBoundingClientRect().bottom??root.getBoundingClientRect().top;
  const anchor=[...root.querySelectorAll('[data-agenda-item]')].find(el=>el.getBoundingClientRect().bottom>boundary);
  return {top:root.scrollTop,anchor:anchor?.getAttribute('data-agenda-item')??'',offset:anchor?anchor.getBoundingClientRect().top-root.getBoundingClientRect().top:0,overdueOpen};
}
export function restoreAgendaPosition(root,position){
  if(!root||!position)return;
  root.scrollTop=position.top;
  const anchor=[...root.querySelectorAll('[data-agenda-item]')].find(el=>el.getAttribute('data-agenda-item')===position.anchor);
  if(anchor)root.scrollTop+=anchor.getBoundingClientRect().top-root.getBoundingClientRect().top-position.offset;
}
