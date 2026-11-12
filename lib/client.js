// Native Cordis page with one explicitly created schedule-chat Session; no scanning other conversations.
window.__ModuleLoader__.load({id:'@dsh-local/view-67369b06-cc50-4fed-8e20-f7b5517ee076',factory(require){
  const React=require('react'),h=React.createElement,{useState,useEffect,useRef}=React;
  const ID='@dsh-local/view-67369b06-cc50-4fed-8e20-f7b5517ee076:page',URL='/api/suishouji-67369b06/items';
  const fmt=value=>value?new Intl.DateTimeFormat('sv-SE',{timeZone:'Asia/Shanghai',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).format(new Date(value)):'';
  const wall=value=>fmt(value).replace(' ','T');
  const css=`.ssj{height:100%;overflow:auto;color:var(--dsw-alias-label-primary);background:var(--dsw-alias-bg-base);font-family:inherit;padding:calc(var(--dsh-frame-top-clearance, 0px) + 30px) clamp(18px,2.2vw,36px) 40px;box-sizing:border-box}.ssj *{box-sizing:border-box}.ssj-wrap{width:100%;max-width:none;min-width:0;margin:auto;container-type:inline-size}.ssj-header{display:flex;justify-content:space-between;align-items:flex-start;gap:20px}.ssj h1{font:600 32px/1.2 ui-rounded,system-ui,sans-serif;letter-spacing:.06em;margin:4px 0 10px}.ssj p{margin:8px 0;line-height:1.65}.ssj small,.ssj-muted{color:var(--dsw-alias-label-secondary);font-size:12px}.ssj button,.ssj input,.ssj textarea,.ssj select{font:inherit;color:inherit;background:var(--dsw-alias-bg-base);border:1px solid var(--dsw-alias-border-l2);border-radius:8px;padding:9px 12px}.ssj button{cursor:pointer}.ssj button:hover{background:var(--dsw-alias-bg-layer-2)}.ssj button:disabled{opacity:.5;cursor:wait}.ssj :focus-visible{outline:2px solid var(--dsw-alias-brand-primary);outline-offset:3px}.ssj button.ss-active{border-color:var(--dsw-alias-brand-primary);color:var(--dsw-alias-brand-primary)}.ssj .ss-primary{background:var(--dsw-alias-brand-primary);color:var(--dsw-alias-bg-base);border-color:transparent}.ssj-bar{display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin:26px 0 20px}.ssj-search{flex:1;min-width:140px}.ssj-layout{display:grid;grid-template-columns:minmax(240px,.65fr) minmax(0,1.35fr);gap:24px;align-items:start}.ssj-layout.single{grid-template-columns:1fr}.ssj-list{display:grid;gap:12px}.ssj-card{border:1px solid var(--dsw-alias-border-l2);border-left:3px solid var(--dsw-alias-brand-primary);border-radius:5px 12px 12px 5px;padding:16px 18px;min-width:0}.ssj-card.done{opacity:.65;border-left-color:var(--dsw-alias-border-l2)}.ssj-row{display:flex;gap:10px;align-items:center;flex-wrap:wrap}.ssj-title{font-size:16px;font-weight:600;overflow-wrap:anywhere;flex:1}.ssj-body{white-space:pre-wrap;overflow-wrap:anywhere;font-size:14px}.ssj-actions{margin-top:12px;display:flex;gap:7px;flex-wrap:wrap}.ssj-actions button{padding:5px 9px;font-size:12px}.ssj-tag{font-size:11px;color:var(--dsw-alias-label-secondary)}.ssj-empty{border:1px dashed var(--dsw-alias-border-l2);border-radius:12px;padding:46px 24px;text-align:center}.ssj-empty strong{font-size:20px;font-weight:500}
.ssj-editor{min-width:0;border:1px solid var(--dsw-alias-border-l1);background:var(--dsw-alias-bg-layer-1);border-radius:16px;padding:clamp(18px,2vw,28px);position:static}
.ssj-editor h2{font-size:22px;letter-spacing:-.025em;margin:0 0 20px}.ssj label{display:grid;gap:6px;font-size:12px;margin:12px 0}.ssj textarea{resize:vertical;min-height:100px}
.ssj-editor input,.ssj-editor select,.ssj-editor textarea{width:100%}.ssj-error{border:1px solid var(--dsw-alias-border-l2);border-left:3px solid var(--dsw-alias-brand-primary);padding:12px;margin:12px 0;white-space:pre-wrap}.ssj-settings{border-top:1px solid var(--dsw-alias-border-l2);margin-top:30px;padding-top:16px}.ssj-settings summary{cursor:pointer;font-size:13px}.ssj-settings select{max-width:100%;margin:8px 0}.ssj-calendar{display:grid;grid-template-columns:repeat(7,minmax(0,1fr));border-left:1px solid var(--dsw-alias-border-l2);border-top:1px solid var(--dsw-alias-border-l2);margin:16px 0}.ssj-day{border:0!important;border-right:1px solid var(--dsw-alias-border-l2)!important;border-bottom:1px solid var(--dsw-alias-border-l2)!important;border-radius:0!important;min-height:68px;display:flex;flex-direction:column;align-items:center;gap:6px;padding:9px 3px!important}.ssj-dot{font-size:10px;color:var(--dsw-alias-brand-primary)}.ssj-week{text-align:center;font-size:11px;padding:6px;color:var(--dsw-alias-label-secondary)}@media(max-width:760px){.ssj-layout{grid-template-columns:1fr}
.ssj-editor{position:static;grid-row:1}.ssj-header{flex-wrap:wrap}.ssj h1{font-size:27px}}`;
  // Notes-inspired grouped list: the agenda, not the month grid, owns the first screen.
  const agendaCss=`
.ssj{padding-top:calc(var(--dsh-frame-top-clearance,0px) + 18px);font-family:-apple-system,BlinkMacSystemFont,system-ui,sans-serif}
.ssj h1{font-size:29px;letter-spacing:-.035em;margin:2px 0 4px}.ssj-header p{margin:4px 0}.ssj-bar{margin:18px 0 14px;gap:6px}.ssj-bar>button{border-color:transparent;border-radius:10px;padding:8px 13px}.ssj-bar>button.ss-active{background:var(--dsw-alias-bg-layer-2);border-color:transparent;font-weight:650}.ssj-search{background:var(--dsw-alias-bg-layer-1)!important}
.ssj-agenda-bar{display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap;margin-bottom:16px}.ssj-agenda-bar h2{font-size:17px;margin:0;letter-spacing:-.02em}.ssj-agenda-bar .ssj-row{gap:6px}.ssj-agenda-bar button{padding:7px 10px;font-size:13px}.ssj-calendar-panel{border:1px solid var(--dsw-alias-border-l1);border-radius:12px;background:var(--dsw-alias-bg-layer-1);margin:0 0 16px}.ssj-calendar-panel>summary{cursor:pointer;padding:10px 14px;font-size:13px;color:var(--dsw-alias-label-secondary)}.ssj-calendar-panel[open]>summary{border-bottom:1px solid var(--dsw-alias-border-l1)}.ssj:has(.ssj-calendar-panel[open]) .ssj-wrap{max-width:none}.ssj-calendar-panel>div{padding:16px;width:100%;max-width:none}.ssj-calendar-panel .ssj-calendar{width:100%;grid-template-columns:repeat(7,minmax(0,1fr));margin-bottom:0}.ssj-calendar-panel .ssj-day{min-width:0;min-height:clamp(64px,9vh,100px)!important;padding:10px!important;font-size:16px}.ssj-dot{font-size:11px}
.ssj-list{display:block}.ssj-agenda-group{margin:0 0 22px}.ssj-agenda-group h3{font-size:19px;letter-spacing:-.025em;margin:0 0 9px;font-weight:650}.ssj-agenda-group h3 small{margin-left:10px;font-weight:400;font-size:12px;letter-spacing:0}.ssj-inset-list{border:1px solid var(--dsw-alias-border-l1);border-radius:14px;background:var(--dsw-alias-bg-layer-1);overflow:visible}.ssj .ssj-card{display:grid;grid-template-columns:22px minmax(0,1fr) auto;align-items:start;gap:12px;border:0;border-bottom:1px solid var(--dsw-alias-border-l1);border-radius:0;padding:14px 16px;background:transparent}.ssj .ssj-card:last-child{border-bottom:0}.ssj .ssj-card[data-kind=event]{grid-template-columns:22px 55px minmax(0,1fr) auto}.ssj .ssj-card[data-kind=note]{grid-template-columns:minmax(0,1fr) auto}.ssj .ssj-card.done{opacity:.58}.ssj-card>input[type=checkbox]{appearance:none;width:20px;height:20px;min-width:20px;min-height:20px;padding:0;margin:3px 0 0;border-radius:50%;border:1.5px solid var(--dsw-alias-border-l2)}.ssj-card>input[type=checkbox]:checked{background:var(--dsw-alias-brand-primary);border-color:var(--dsw-alias-brand-primary)}.ssj-card>input[type=checkbox]:checked::after{content:'✓';display:block;text-align:center;font-size:13px;line-height:17px;color:var(--dsw-alias-bg-base)}.ssj-item-main{min-width:0}.ssj-time{font-size:16px;font-weight:600;font-variant-numeric:tabular-nums;letter-spacing:-.03em;margin-top:2px}.ssj .ssj-title{display:block;font-size:16px;line-height:1.5;font-weight:600}.ssj-card .ssj-body{margin:3px 0 4px;color:var(--dsw-alias-label-secondary);font-size:13px;line-height:1.5;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}.ssj-card .ssm-tags:empty{display:none}.ssj-card .ssm-tags{margin-top:5px;gap:4px}.ssj-card .ssj-tag{padding:1px 6px;font-size:11px}.ssj-card .ssj-muted{margin:5px 0 0;font-size:11px}.ssj-more{position:relative}.ssj-more>summary{list-style:none;cursor:pointer;padding:3px 7px;color:var(--dsw-alias-label-secondary);font-size:13px;border-radius:6px}.ssj-more>summary::-webkit-details-marker{display:none}.ssj-more>summary:hover{background:var(--dsw-alias-bg-layer-2)}.ssj-more[open]>.ssj-actions{position:absolute;right:0;top:100%;z-index:2;min-width:120px;display:flex;flex-direction:column;gap:4px;margin:4px 0 0;padding:6px;border:1px solid var(--dsw-alias-border-l2);border-radius:10px;background:var(--dsw-alias-bg-overlay)}.ssj-more .ssj-actions button{text-align:left;border:0;padding:8px 10px;white-space:nowrap}.ssj-more:not([open])>.ssj-actions{display:none}
.ssj-preview{margin-top:3px}.ssj-preview>summary{cursor:pointer;list-style:none;position:relative;padding-right:32px}.ssj-preview>summary::-webkit-details-marker{display:none}.ssj-preview .ssj-body{margin:0}.ssj-preview-open{position:absolute;right:0;top:2px;font-size:11px;color:var(--dsw-alias-label-secondary)}.ssj-preview-close{display:none;font-size:12px;color:var(--dsw-alias-label-secondary)}.ssj-preview[open]>summary .ssj-body,.ssj-preview[open] .ssj-preview-open{display:none}.ssj-preview[open] .ssj-preview-close{display:inline}.ssj-preview .ssj-full-body{display:block;white-space:pre-wrap;overflow-wrap:anywhere;font-size:14px;line-height:1.6;margin:6px 0}
@media(max-width:600px){.ssj{padding-inline:14px}.ssj-calendar-panel>div{padding:10px}.ssj-calendar-panel .ssj-day{min-height:52px!important;padding:6px!important;font-size:14px}.ssj .ssj-card{padding:12px;gap:9px}.ssj .ssj-card[data-kind=event]{grid-template-columns:20px 46px minmax(0,1fr) auto}.ssj-time{font-size:14px}.ssj-more>summary{font-size:12px;padding:4px}.ssj-agenda-group h3{font-size:18px}.ssj-agenda-bar{margin-bottom:12px}.ssj-header-actions{gap:6px}.ssj-header-actions button{font-size:13px;padding:8px 10px}}
`;
  // Give writing the larger pane; queries follow the actual main-panel width, not the whole window.
  const writingCss=`
.ssj-list-column{min-width:0}
.ssj-layout.writing{grid-template-columns:minmax(240px,.55fr) minmax(0,1.45fr)}
.ssj-editor .ssj-editor-title{font-size:20px;line-height:1.5;font-weight:600;padding:12px 14px}
.ssj-editor .ssj-editor-body{min-height:220px;max-width:100%;font-size:16px;line-height:1.8;padding:16px 18px;resize:vertical}
.ssj-editor[data-kind=note] .ssj-editor-body{min-height:clamp(360px,52dvh,800px)}
.ssj-editor .ssj-editor-count{text-align:right;font-variant-numeric:tabular-nums;font-size:11px}
.ssj-editor-meta{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,220px),1fr));gap:0 16px}
.ssj-editor-foot{display:flex;align-items:center;gap:12px;flex-wrap:wrap;border-top:1px solid var(--dsw-alias-border-l1);padding-top:16px;margin-top:20px}
@container (max-width:980px){.ssj-layout:not(.single){grid-template-columns:minmax(0,1fr)}.ssj-layout:not(.single)>.ssj-editor{grid-row:1}.ssj-editor[data-kind=note] .ssj-editor-body{min-height:clamp(280px,45dvh,560px)}}
@media(max-width:980px){.ssj-layout:not(.single){grid-template-columns:minmax(0,1fr)}.ssj-layout:not(.single)>.ssj-editor{grid-row:1}.ssj-editor[data-kind=note] .ssj-editor-body{min-height:clamp(280px,45dvh,560px)}}
`;
  function Icon({size=20}) {return h('svg',{width:size,height:size,viewBox:'0 0 24 24',fill:'none',stroke:'currentColor',strokeWidth:1.6,'aria-hidden':true},h('path',{d:'M6 3h12a2 2 0 0 1 2 2v12l-4 4H6a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2Z'}),h('path',{d:'M8 8h8M8 12h6M15 21v-5h5'}));}
  // Session contracts verified with Client Service.sessions and Host Event.session/event.
// The only text sent to the model is the text the user explicitly submits here.
function chatMessages(entries) {
  // Commentary is text too. Only the final assistant message of a completed
  // turn is an answer; reasoning, tools and runtime contributions stay hidden.
  const last=new Map(),ended=new Map();
  for(const entry of entries){
    if(entry.type!=='event')continue;
    const e=entry.event;
    if(e.type==='assistant/message')last.set(e.data.turn,e);
    if(e.type==='turn/end')ended.set(e.data.turn,e.data.reason.kind);
  }
  return entries.flatMap(entry=>{
    if(entry.type!=='event')return [];
    const e=entry.event;
    if(e.type==='assistant/message'&&(ended.get(e.data.turn)!=='completed'||last.get(e.data.turn)!==e||e.data.interrupted||e.data.message.content.some(b=>b.type==='tool-call')))return [];
    const message=e.type==='user/message'?e.data:e.type==='assistant/message'?e.data.message:null;
    if(!message||!Array.isArray(message.content))return [];
    if(e.type==='user/message'&&message.source?.kind!=='user')return [];
    const text=message.content.filter(b=>b.type==='text').map(b=>b.text).join('\n');
    return text?[{id:String(e.seq),role:message.role,text}]:[];
  });
}
function chatActivity(entries){
  let seq=-1,user=-1,start=-1,end=null;
  for(const entry of entries){
    if(entry.type!=='event')continue;
    const e=entry.event;seq=Math.max(seq,e.seq);
    if(e.type==='user/message'&&e.data.source?.kind==='user')user=Math.max(user,e.seq);
    if(e.type==='turn/start')start=Math.max(start,e.seq);
    if(e.type==='turn/end'&&(!end||e.seq>end.seq))end=e;
  }
  return {seq,user,start,end:end&&end.seq>Math.max(user,start)?end:null,latestEnd:end};
}
function endedFeedback(end,entries,messages){
  const reason=end.data.reason;
  if(reason.kind==='completed'){
    const answers=new Set(messages.filter(m=>m.role==='assistant').map(m=>m.id));
    const hasAnswer=entries.some(e=>e.type==='event'&&e.event.type==='assistant/message'&&e.event.data.turn===end.data.turn&&answers.has(String(e.event.seq)));
    return {delivery:hasAnswer?'answered':'no-answer',error:''};
  }
  if(reason.kind==='error')return {delivery:'failed',error:reason.error?.message||'本轮处理失败，请打开完整对话检查。'};
  if(reason.kind==='max-tokens')return {delivery:'failed',error:'本轮达到输出长度限制，未获得完整答复。请打开完整对话检查。'};
  return {delivery:reason.kind==='blocked'?'blocked':'stopped',error:''};
}
function createChatController({sessions,remote,storage,onChange=()=>{},onSettled=()=>{}}) {
  let state={sessionId:null,messages:[],running:false,sending:false,connecting:false,error:'',delivery:'idle',requestId:null};
  let disposed=false,reference=null,binding=null,opening=null,offs=[],settlePending=null;
  let attempt=null,localError='',seenEndSeq=null;
  const busy=snapshot=>!!(snapshot.running||snapshot.awaitingFirstTurn||snapshot.pendingSubmissions?.length);
  const snapshotError=s=>s.lastAgentError||s.promptError?.error?.message||s.openError?.message||'';
  const emit=patch=>{if(disposed)return;state={...state,...patch};onChange(state);};
  const sync=()=>{
    if(disposed||!binding)return;
    const snapshot=binding.session.getSnapshot(),entries=binding.eventSource.getSnapshot().entries;
    const messages=chatMessages(entries),activity=chatActivity(entries);
    // An old completed turn must not settle a newly accepted submission.
    const end=activity.end&&(!attempt||activity.end.seq>attempt.baseSeq)?activity.end:null;
    if(end&&attempt){attempt.terminal=true;attempt.problem='';}
    let feedback={delivery:'idle',error:localError};
    const nativeError=snapshotError(snapshot),currentError=attempt&&nativeError===attempt.baselineError?'':nativeError;
    if(localError)feedback={delivery:'failed',error:localError};
    else if(end)feedback=endedFeedback(end,entries,messages);
    else if(attempt?.problem)feedback={delivery:attempt.uncertain?'uncertain':'failed',error:attempt.problem};
    else if(localError||currentError)feedback={delivery:'failed',error:localError||currentError};
    else if(state.sending&&!attempt?.accepted)feedback.delivery='sending';
    else if(snapshot.running)feedback.delivery='processing';
    else if(attempt?.accepted||activity.user>Math.max(activity.start,activity.latestEnd?.seq??-1))feedback.delivery='accepted';
    else if(snapshot.awaitingFirstTurn||snapshot.pendingSubmissions?.length)feedback.delivery='waiting';
    // Keep acceptance visible (and prevent duplicate submission) during the
    // gap before native running/pending snapshots catch up. Receipt != saved.
    const waitingForReply=!!(attempt?.accepted&&!attempt.terminal);
    emit({messages,running:busy(snapshot)||waitingForReply,...feedback,requestId:attempt?.requestId??null});
    const endSeq=activity.latestEnd?.seq??-1;
    if(seenEndSeq===null)seenEndSeq=endSeq;
    else if(endSeq>seenEndSeq){seenEndSeq=endSeq;onSettled();}
  };
  async function open(create){
    if(disposed)throw Error('页面已关闭');
    if(binding)return binding;
    if(opening)return opening;
    opening=Promise.resolve().then(async()=>{
      emit({connecting:true,error:''});
      try{
        let id=storage.get();
        if(!id&&!create)return null;
        if(!id){
          const result=await remote.session.create({});
          if(!result.ok)throw result.error;
          id=result.value.sessionId;
          storage.set(id); // Save before any prompt; never create a replacement silently.
        }
        if(disposed)return null;
        emit({sessionId:id});
        reference=sessions.retain(id,{source:'controllerOperation'});
        const ready=await reference.ready;
        if(disposed)return null;
        const snapshot=ready.session.getSnapshot();
        if(snapshot.openState==='error')throw Error(snapshot.openError?.message||'对话打开失败，请在完整对话中检查');
        binding=ready;
        offs=[binding.session.subscribe(sync),binding.eventSource.subscribe(sync)];
        sync();return binding;
      }catch(error){
        reference?.release();reference=null;localError=error.message||String(error);
        emit({error:localError,delivery:'failed'});throw error;
      }finally{emit({connecting:false});opening=null;}
    });
    return opening;
  }
  return {
    getSnapshot:()=>state,
    connect:()=>open(false),
    async send(text){
      if(disposed||state.sending||state.running||!text.trim())return false;
      // Native receipt/outcome callbacks belong to one exact attempt. A late
      // callback must not overwrite feedback for a later explicit submission.
      let own=null;localError='';attempt=null;
      emit({sending:true,error:'',delivery:'sending',requestId:null});
      try{
        const b=await open(true);if(!b||disposed)return false;
        if(busy(b.session.getSnapshot()))throw Error('上一条消息仍在处理，请稍后发送');
        own=attempt={baseSeq:chatActivity(b.eventSource.getSnapshot().entries).seq,baselineError:snapshotError(b.session.getSnapshot()),requestId:null,accepted:false,terminal:false,failed:false,uncertain:false,problem:''};
        await new Promise((resolve,reject)=>{
          settlePending=resolve;
          let handle,abandoned=false;
          const current=()=>!disposed&&attempt===own;
          const accept=()=>{
            if(!current())return;
            if(!own.terminal){
              own.accepted=true;
              if(own.failed){own.uncertain=true;own.problem='已收到接收回执，但此前发送回执异常。请打开完整对话核对，避免重复发送。';}
              sync();
            }
            resolve();
          };
          const fail=(error,definitive=false)=>{
            if(!current()||own.terminal||(own.failed&&!own.accepted))return;
            own.problem=error.message||String(error);own.failed=true;
            own.uncertain=own.accepted||!definitive;
            // An accepted message may already be executing. Never abandon it
            // because a later transport result failed, and never resend it.
            if(!own.accepted&&handle&&!abandoned){abandoned=true;handle.abandon();}
            sync();reject(error);
          };
          handle=b.session.beginSubmission({mode:'queue',text,attachments:[],onAccept:accept,
            onRetire:retired=>retired.reason==='observed'?accept():fail(Error('消息未被接受；请打开完整对话检查后再发送'),true)});
          own.requestId=handle.requestId;
          if(own.failed){if(!abandoned){abandoned=true;handle.abandon();}return;}
          sync();
          // beginSubmission is local echo only. Submit unchanged content with
          // the same native request ID; no automatic retry or second prompt.
          Promise.resolve().then(()=>b.session.prompt([{type:'text',text}],'queue',undefined,handle.requestId))
            .then(result=>result.ok?accept():fail(result.error,true),error=>fail(error));
        });
        return !disposed;
      }catch(error){
        if(!own){localError=error.message||String(error);emit({error:localError,delivery:'failed'});}
        else if(!own.problem&&!own.terminal){own.failed=true;own.problem=error.message||String(error);sync();}
        return false;
      }finally{settlePending=null;emit({sending:false});sync();}
    },
    dispose(){if(disposed)return;disposed=true;settlePending?.();settlePending=null;for(const off of offs)off();offs=[];reference?.release();reference=null;binding=null;}
  };
}

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

  // Embedded by build.mjs inside the original native React page factory.
const MEETING_URL='/api/suishouji-67369b06/meetings';
const DEFAULT_NOTE_TAGS=['会议记录','沟通记录','今日总结','工作总结','复盘改进','学习笔记','灵感想法'];
const meetingTexts=['会议笔记','标签（可多选）','自定义标签','添加标签','文字会议 · 从原文到行动','可先录音并回听；转写 API 尚未接入。文字原文保存后再整理，行动由你确认。','+ 导入文字','读取会议失败','保存会议失败','暂无会议记录。可以粘贴转写或用豆包输入法输入文字。','返回列表','编辑原文 / 说话人','删除会议记录？已转换的待办不会一并删除。','会议标题','会议日期（可留空，不用于猜测行动截止时间）','原始文字 / 转写','粘贴会议文字；每个非空行保留独立原文编号。','说话人映射（仅填写你确定的信息）','新增说话人','标识，如 spk1','原文称呼，如 说话人1','工作角色（可留空）','本人','移除','保存原文','取消编辑','保存后可生成纪要；此处不会创建待办或设置提醒。','正在整理…','AI 整理','使用 DSH 默认模型，可能消耗额度；原文会交给该模型。','重新整理','已转换过行动的会议已锁定原文和结果，避免重复或串改。','会议概要','结论与决定','候选行动 · 尚未创建','个人复盘','待澄清','原文依据','查看完整原文','请选择要转换的行动，并逐条确认责任人、标题和时间。默认不勾选，不自动设置微信提醒。','我确认这是我要跟进的行动','原文责任人：','原文时间：','未说明','转为待办','转为日程','明确时间 · 上海（普通待办可留空）','确认转换所选行动','请选择行动并确认责任人；日程必须填写明确时间。','候选已处理；不会重复创建或恢复已删除事项。','已转换到待办 / 日程；微信提醒未设置。','部分转换失败，请查看逐项结果。','未创建任何事项。','请先保存修改，再整理。','没有本人映射时不生成个人画像；可在“编辑原文 / 说话人”中明确本人。','未提取到可确认的行动。','选择标签筛选','全部标签','清除标签筛选','正在读取会议…','没有匹配的会议记录。','请选择左侧记录，或导入新的文字。','内容已保存。','生成结果已保存；候选行动仍未创建。','会议时间','待办','日程'];
const meetingCss=`.ssm-head{display:flex;justify-content:space-between;gap:20px;align-items:center;margin:28px 0 22px}.ssm-head h2{font:600 24px/1.3 ui-rounded,system-ui;margin:0 0 6px}.ssm-head p{margin:0}.ssm-grid{display:grid;grid-template-columns:240px minmax(0,1fr);gap:22px;align-items:start}.ssm-side{display:grid;gap:8px;max-height:75vh;overflow:auto}.ssm-entry{text-align:left!important;padding:14px!important;display:grid;gap:8px}.ssm-entry[aria-pressed=true]{border-color:var(--dsw-alias-brand-primary);background:var(--dsw-alias-bg-layer-1)}.ssm-detail{min-width:0;border:1px solid var(--dsw-alias-border-l1);border-radius:14px;padding:24px;background:var(--dsw-alias-bg-layer-1)}.ssm-detail h2{margin:0 0 10px;font-size:22px}.ssm-detail h3{font-size:16px;margin:28px 0 12px}.ssm-detail p{white-space:pre-wrap;overflow-wrap:anywhere}.ssm-detail label{display:grid;gap:7px;margin:14px 0;font-size:13px}.ssm-detail textarea,.ssm-detail input:not([type=checkbox]),.ssm-detail select{width:100%;min-width:0;background:var(--dsw-alias-bg-base)}.ssm-detail textarea{resize:vertical;min-height:130px;line-height:1.65}.ssm-detail .ssm-source{min-height:290px}.ssm-tags{display:flex;gap:6px;align-items:center;flex-wrap:wrap;margin:8px 0}.ssm-tags button{padding:5px 9px;font-size:12px}.ssm-tags button[aria-pressed=true]{border-color:var(--dsw-alias-brand-primary);color:var(--dsw-alias-brand-primary)}.ssm-speaker{display:grid;grid-template-columns:1fr 1.4fr 1.4fr auto auto;gap:8px;align-items:center;margin:8px 0}.ssm-speaker label,.ssm-check{display:flex!important;gap:8px!important;align-items:center!important}.ssm-speaker label{margin:0}.ssm-evidence{font-size:12px;color:var(--dsw-alias-label-secondary);margin:8px 0 16px}.ssm-evidence blockquote{margin:8px 0;padding:8px 12px;border-left:2px solid var(--dsw-alias-border-l2);white-space:pre-wrap;overflow-wrap:anywhere}.ssm-action{border:1px solid var(--dsw-alias-border-l2);border-radius:10px;padding:16px;margin:12px 0;background:var(--dsw-alias-bg-base)}.ssm-action>label{display:flex;align-items:center;gap:8px;font-weight:600}.ssm-action-grid{display:grid;grid-template-columns:1fr 1.6fr;gap:12px}.ssm-original{max-height:420px;overflow:auto}.ssm-original p{padding:8px;border-bottom:1px solid var(--dsw-alias-border-l1)}.ssm-original b{color:var(--dsw-alias-label-secondary);margin-right:8px}.ssm-notice{padding:12px 16px;border-left:3px solid var(--dsw-alias-brand-primary);background:var(--dsw-alias-bg-layer-2);white-space:pre-wrap;overflow-wrap:anywhere}.ssm-actions{display:flex;align-items:center;gap:10px;flex-wrap:wrap;margin-top:18px}.ssm-spread{display:flex;justify-content:space-between;gap:10px;align-items:flex-start;flex-wrap:wrap}@media(max-width:850px){.ssm-grid{grid-template-columns:1fr}.ssm-side{max-height:220px}.ssm-detail{padding:16px}.ssm-speaker{grid-template-columns:1fr 1fr}.ssm-speaker label{grid-column:auto}.ssm-action-grid{grid-template-columns:1fr}}`;
function TagPicker({t,value=[],onChange}){
  const [custom,setCustom]=useState('');const all=[...new Set([...DEFAULT_NOTE_TAGS,...value])];
  const toggle=tag=>onChange(value.includes(tag)?value.filter(x=>x!==tag):value.length<12?[...value,tag]:value);
  return h('div',null,h('small',null,t('标签（可多选）')),h('div',{className:'ssm-tags'},...all.map(tag=>h('button',{key:tag,type:'button','aria-pressed':value.includes(tag),onClick:()=>toggle(tag)},tag))),h('div',{className:'ssj-row'},h('input',{value:custom,maxLength:30,'aria-label':t('自定义标签'),placeholder:t('自定义标签'),onChange:e=>setCustom(e.target.value),onKeyDown:e=>{if(e.key==='Enter'){e.preventDefault();const tag=custom.trim();if(tag&&!value.includes(tag)&&value.length<12){onChange([...value,tag]);setCustom('');}}}}),h('button',{type:'button',disabled:!custom.trim()||value.length>=12,onClick:()=>{const tag=custom.trim();if(tag&&!value.includes(tag))onChange([...value,tag]);setCustom('');}},t('添加标签'))));
}
function Evidence({t,evidence=[]}){return h('details',{className:'ssm-evidence'},h('summary',null,t('原文依据')+' · '+evidence.map(e=>e.segmentId).join(', ')),...evidence.map((e,index)=>h('blockquote',{key:index},h('b',null,e.segmentId+' '),e.quote)));}
function Meetings({t,search='',onConverted}){
  const [rows,setRows]=useState(null),[selected,setSelected]=useState(null),[draft,setDraft]=useState(null),[filter,setFilter]=useState(''),[busy,setBusy]=useState(''),[error,setError]=useState(''),[notice,setNotice]=useState(''),[choices,setChoices]=useState({});
  const alive=useRef(false),abort=useRef(null),sequence=useRef(0);
  async function call(action){const response=await fetch(MEETING_URL+(action.op==='list'?'':action.op==='get'?'?id='+encodeURIComponent(action.id):''),action.op==='list'||action.op==='get'?{credentials:'same-origin',signal:abort.current?.signal}:{method:'POST',credentials:'same-origin',headers:{'content-type':'application/json'},body:JSON.stringify(action),signal:abort.current?.signal});const result=await response.json();if(!response.ok)throw Error(result.error||t('保存会议失败'));return result.value??result;}
  async function load(){const value=await call({op:'list'});if(alive.current)setRows(value.meetings);}
  useEffect(()=>{alive.current=true;abort.current=new AbortController();load().catch(e=>{if(alive.current&&e.name!=='AbortError')setError(e.message);});return()=>{alive.current=false;abort.current.abort();};},[]);
  async function choose(id){const seq=++sequence.current;setBusy('get');setError('');setNotice('');try{const value=await call({op:'get',id});if(alive.current&&seq===sequence.current){setSelected(value.meeting);setDraft(null);setChoices({});}}catch(e){if(alive.current&&e.name!=='AbortError')setError(e.message);}finally{if(alive.current&&seq===sequence.current)setBusy('');}}
  function editField(key,value){setDraft(old=>({...old,[key]:value}));}
  async function perform(action,success){setBusy(action.op);setError('');setNotice('');try{const value=await call(action);if(!alive.current)return null;if(value.meeting?.id){setSelected(value.meeting);setDraft(null);setChoices({});}if(action.op==='delete'){setSelected(null);setDraft(null);}setNotice(success);await load();return value;}catch(e){if(alive.current&&e.name!=='AbortError')setError(e.message);return null;}finally{if(alive.current)setBusy('');}}
  async function save(event){event.preventDefault();const action={op:draft.id?'update':'create',...(draft.id?{id:draft.id,revision:draft.revision}:{}),title:draft.title,transcript:draft.transcript,meetingDate:draft.meetingDate||null,tags:draft.tags??[],speakers:draft.speakers??[]};if(draft.id&&selected?.id===draft.id)for(const key of ['transcript','speakers','meetingDate'])if(JSON.stringify(action[key])===JSON.stringify(selected[key]))delete action[key];await perform(action,t('内容已保存。'));}
  const converted=selected?.conversions??{},locked=Object.keys(converted).length>0,report=selected?.report;
  const allTags=[...new Set((rows??[]).flatMap(row=>row.tags??[]))];
  const visible=(rows??[]).filter(row=>(!filter||(row.tags??[]).includes(filter))&&(!search||`${row.title} ${(row.tags??[]).join(' ')}`.toLowerCase().includes(search.toLowerCase())));
  const choice=action=>choices[action.id]??{selected:false,ownerConfirmed:false,kind:'todo',title:action.title,dueAt:''};
  function changeChoice(action,key,value){setChoices(old=>({...old,[action.id]:{...choice(action),[key]:value}}));}
  const selections=(report?.actions??[]).filter(action=>choice(action).selected&&!Object.hasOwn(converted,action.id)).map(action=>({candidateId:action.id,...choice(action)}));
  const valid=selections.length>0&&selections.every(item=>item.ownerConfirmed&&item.title.trim()&&(item.kind!=='event'||item.dueAt));
  async function confirm(){if(!valid)return;const result=await perform({op:'confirm',id:selected.id,revision:selected.revision,selections:selections.map(({candidateId,title,kind,dueAt})=>({candidateId,title:title.trim(),kind,dueAt:dueAt||null,ownerConfirmed:true}))},t('已转换到待办 / 日程；微信提醒未设置。'));if(result){const failures=(result.results??[]).filter(row=>!row.ok);if(failures.length)setNotice(t('部分转换失败，请查看逐项结果。')+'\n'+failures.map(row=>row.candidateId+': '+row.error).join('\n'));onConverted?.();}}
  function candidate(action){const value=choice(action),done=Object.hasOwn(converted,action.id);return h('article',{key:action.id,className:'ssm-action'},h('label',null,h('input',{type:'checkbox',checked:value.selected&&!done,disabled:!!busy||done,onChange:e=>changeChoice(action,'selected',e.target.checked)}),action.title),h('p',{className:'ssj-muted'},t('原文责任人：')+(action.ownerText||t('未说明'))+' · '+t('原文时间：')+(action.dueText||t('未说明'))),h(Evidence,{t,evidence:action.evidence}),done?h('p',{className:'ssj-muted'},t('候选已处理；不会重复创建或恢复已删除事项。')):value.selected&&h('div',null,h('input',{'aria-label':t('会议标题'),value:value.title,maxLength:200,onChange:e=>changeChoice(action,'title',e.target.value)}),h('div',{className:'ssm-action-grid'},h('select',{'aria-label':t('转为待办'),value:value.kind,onChange:e=>changeChoice(action,'kind',e.target.value)},h('option',{value:'todo'},t('转为待办')),h('option',{value:'event'},t('转为日程'))),h('label',null,t('明确时间 · 上海（普通待办可留空）'),h('input',{type:'datetime-local',value:value.dueAt,required:value.kind==='event',onChange:e=>changeChoice(action,'dueAt',e.target.value)}))),h('label',{className:'ssm-check'},h('input',{type:'checkbox',checked:value.ownerConfirmed,onChange:e=>changeChoice(action,'ownerConfirmed',e.target.checked)}),t('我确认这是我要跟进的行动'))));}
  const draftLocked=Object.keys(draft?.conversions??{}).length>0;
  let detail;
  if(draft){detail=h('form',{className:'ssm-detail',onSubmit:save},h('h2',null,t('保存原文')),h('label',null,t('会议标题'),h('input',{required:true,maxLength:200,value:draft.title,onChange:e=>editField('title',e.target.value)})),h('label',null,t('会议日期（可留空，不用于猜测行动截止时间）'),h('input',{type:'date',disabled:draftLocked,value:draft.meetingDate||'',onChange:e=>editField('meetingDate',e.target.value)})),h(TagPicker,{t,value:draft.tags??[],onChange:value=>editField('tags',value)}),h('fieldset',{disabled:draftLocked,style:{border:0,padding:0,margin:0}},h('label',null,t('原始文字 / 转写'),h('textarea',{className:'ssm-source',required:true,maxLength:60000,value:draft.transcript,placeholder:t('粘贴会议文字；每个非空行保留独立原文编号。'),onChange:e=>editField('transcript',e.target.value)})),h('h3',null,t('说话人映射（仅填写你确定的信息）')),...(draft.speakers??[]).map((speaker,index)=>{const update=(key,value)=>editField('speakers',draft.speakers.map((row,i)=>i===index?{...row,[key]:value}:key==='isSelf'&&value?{...row,isSelf:false}:row));return h('div',{key:index,className:'ssm-speaker'},h('input',{required:true,maxLength:64,value:speaker.id,'aria-label':t('标识，如 spk1'),placeholder:t('标识，如 spk1'),onChange:e=>update('id',e.target.value)}),h('input',{required:true,maxLength:80,value:speaker.name,'aria-label':t('原文称呼，如 说话人1'),placeholder:t('原文称呼，如 说话人1'),onChange:e=>update('name',e.target.value)}),h('input',{maxLength:100,value:speaker.role,'aria-label':t('工作角色（可留空）'),placeholder:t('工作角色（可留空）'),onChange:e=>update('role',e.target.value)}),h('label',null,h('input',{type:'checkbox',checked:speaker.isSelf,onChange:e=>update('isSelf',e.target.checked)}),t('本人')),h('button',{type:'button',onClick:()=>editField('speakers',draft.speakers.filter((_,i)=>i!==index))},t('移除')));}),h('button',{type:'button',disabled:(draft.speakers??[]).length>=30,onClick:()=>editField('speakers',[...(draft.speakers??[]),{id:'spk'+((draft.speakers??[]).length+1),name:'',role:'',isSelf:false}])},t('新增说话人'))),draftLocked&&h('p',{className:'ssj-muted'},t('已转换过行动的会议已锁定原文和结果，避免重复或串改。')),h('p',{className:'ssj-muted'},t('保存后可生成纪要；此处不会创建待办或设置提醒。')),h('div',{className:'ssm-actions'},h('button',{type:'submit',className:'ss-primary',disabled:!!busy},busy?t('保存中…'):t('保存原文')),h('button',{type:'button',disabled:!!busy,onClick:()=>setDraft(null)},t('取消编辑'))));}
  else if(selected){detail=h('article',{className:'ssm-detail'},h('div',{className:'ssm-spread'},h('div',null,h('h2',null,selected.title),h('small',null,(selected.meetingDate||'')+' · '+fmt(selected.updatedAt))),h('div',{className:'ssj-row'},h('button',{disabled:!!busy,onClick:()=>{setDraft({...selected,speakers:selected.speakers.map(row=>({...row})),tags:[...selected.tags]});setNotice('');}},t('编辑原文 / 说话人')),h('button',{disabled:!!busy,onClick:()=>{if(window.confirm(t('删除会议记录？已转换的待办不会一并删除。')))perform({op:'delete',id:selected.id,revision:selected.revision},'');}},t('删除')))),h('div',{className:'ssm-tags'},...selected.tags.map(tag=>h('span',{key:tag,className:'ssj-tag'},tag))),h('div',{className:'ssm-tags'},...selected.speakers.map(speaker=>h('small',{key:speaker.id},`${speaker.id} · ${speaker.name} ${speaker.role}${speaker.isSelf?' · '+t('本人'):''}`))),!selected.speakers.some(speaker=>speaker.isSelf)&&h('p',{className:'ssj-muted'},t('没有本人映射时不生成个人画像；可在“编辑原文 / 说话人”中明确本人。')),locked?h('p',{className:'ssj-muted'},t('已转换过行动的会议已锁定原文和结果，避免重复或串改。')):h('div',{className:'ssm-actions'},h('button',{className:'ss-primary',disabled:!!busy,onClick:()=>perform({op:'analyze',id:selected.id,revision:selected.revision},t('生成结果已保存；候选行动仍未创建。'))},busy==='analyze'?t('正在整理…'):report?t('重新整理'):t('AI 整理')),h('small',null,t('使用 DSH 默认模型，可能消耗额度；原文会交给该模型。'))),report&&h('div',null,h('h3',null,t('会议概要')),h('p',null,report.summary),report.decisions.length>0&&h('section',null,h('h3',null,t('结论与决定')),...report.decisions.map((item,index)=>h('div',{key:index},h('p',null,item.text),h(Evidence,{t,evidence:item.evidence})))),h('h3',null,t('候选行动 · 尚未创建')),h('p',{className:'ssj-muted'},t('请选择要转换的行动，并逐条确认责任人、标题和时间。默认不勾选，不自动设置微信提醒。')),report.actions.length?report.actions.map(candidate):h('p',null,t('未提取到可确认的行动。')),report.actions.length>0&&h('div',null,h('button',{className:'ss-primary',disabled:!!busy||!valid,onClick:confirm},t('确认转换所选行动')),selections.length>0&&!valid&&h('p',{className:'ssj-muted'},t('请选择行动并确认责任人；日程必须填写明确时间。'))),report.review.length>0&&h('section',null,h('h3',null,t('个人复盘')),...report.review.map((item,index)=>h('div',{key:index},h('p',null,item.text),h(Evidence,{t,evidence:item.evidence})))),report.questions.length>0&&h('section',null,h('h3',null,t('待澄清')),h('ul',null,...report.questions.map((item,index)=>h('li',{key:index},item))))),h('details',{style:{marginTop:28}},h('summary',null,t('查看完整原文')+' · '+selected.segments.length),h('div',{className:'ssm-original'},...selected.segments.map(segment=>h('p',{key:segment.id},h('b',null,segment.id),segment.text)))));}
  else detail=h('div',{className:'ssm-detail ssj-empty'},h('p',null,t('请选择左侧记录，或导入新的文字。')));
  return h('section',{'aria-label':t('会议笔记')},h(RecordingPanel,{t,purpose:'meeting'}),h('div',{className:'ssm-head'},h('div',null,h('h2',null,t('文字会议 · 从原文到行动')),h('p',{className:'ssj-muted'},t('可先录音并回听；转写 API 尚未接入。文字原文保存后再整理，行动由你确认。'))),h('button',{className:'ss-primary',disabled:!!busy,onClick:()=>{setDraft({title:'',meetingDate:'',transcript:'',tags:['会议记录'],speakers:[]});setSelected(null);setChoices({});setError('');setNotice('');}},t('+ 导入文字'))),error&&h('p',{className:'ssj-error',role:'alert'},error),notice&&h('p',{className:'ssm-notice',role:'status'},notice),busy==='analyze'&&h('p',{role:'status'},t('正在整理…')),h('div',{className:'ssm-grid'},h('aside',{className:'ssm-side'},h('select',{'aria-label':t('选择标签筛选'),value:filter,onChange:e=>setFilter(e.target.value)},h('option',{value:''},t('全部标签')),...allTags.map(tag=>h('option',{key:tag,value:tag},tag))),rows===null?h('p',null,t('正在读取会议…')):visible.length?visible.map(row=>h('button',{key:row.id,className:'ssm-entry',disabled:!!busy,'aria-pressed':row.id===selected?.id,onClick:()=>choose(row.id)},h('strong',null,row.title),h('small',null,(row.meetingDate||fmt(row.createdAt))+' · '+(row.tags??[]).join(' / ')))):h('p',{className:'ssj-muted'},t(rows?.length?'没有匹配的会议记录。':'暂无会议记录。可以粘贴转写或用豆包输入法输入文字。'))),detail));
}

  // Embedded in the shared React factory; the Host owns durable announcement/read state.
const REMINDER_URL = '/api/suishouji-67369b06/in-app-reminders';
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
      h('div', {className:'ssn-actions'}, h('button', {type:'button', disabled:busy || !entries.length, onClick:() => markRead(entries.map(entry => entry.id))}, t('本页全部标为已读') + ' (' + entries.length + ')'), h('button', {type:'button', onClick:() => layout.selectPanel('@dsh-local/view-67369b06-cc50-4fed-8e20-f7b5517ee076:page')}, t('查看随手记'))),
      h('div', {className:'ssn-list'}, ...entries.map(entry => h('article', {key:entry.id, className:'ssn-entry'}, h('strong', null, entry.title), metadata(entry), entry.body && h('p', {className:'ssn-body'}, entry.body), h('button', {type:'button', disabled:busy, 'aria-label':t('标为已读') + ': ' + entry.title, onClick:() => markRead([entry.id])}, t('标为已读')))),
        !entries.length && h('p', null, snapshot ? t('暂无未读提醒。') : t('提醒状态尚未读取'))),
      snapshot?.truncated && h('p', {className:'ssn-help'}, t('未读较多，仅显示最近 100 条；本页全部已读只处理当前列表。')),
      h('p', {className:'ssn-help'}, t('有时间的未完成待办和日程按截止或日程时间提醒；便签和无时间事项不提醒。')),
      h('p', {className:'ssn-help'}, t('退出应用不提醒；休眠恢复后补提示。不需要微信。')),
      h('p', {className:'ssn-help'}, t('关闭提示不会标为已读；已读不会完成实际待办。'))),
    h('button', {type:'button', className:'ssn-toggle', 'aria-expanded':expanded, 'aria-label':t(expanded ? '关闭未读提醒' : '打开未读提醒'), onClick:() => setExpanded(!expanded), title:busy ? t('正在同步…') : t('未读提醒')}, t('提醒') + ' ' + count));
}

  const chatCss=`.ssj-chat{width:min(700px,calc(100vw - 28px));max-width:none;max-height:min(780px,calc(100dvh - 40px));padding:0;margin:auto;color:var(--dsw-alias-label-primary);background:var(--dsw-alias-bg-base);border:1px solid var(--dsw-alias-border-l2);border-radius:14px;overflow:hidden;box-shadow:0 24px 80px #0004}.ssj-chat[open]{display:flex;flex-direction:column}.ssj-chat:not([open]){display:none}.ssj-chat::backdrop{background:#0006}.ssj-header-actions{display:flex;gap:8px;flex-wrap:wrap;flex-shrink:0}.ssj-chat-top{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:16px 20px;border-bottom:1px solid var(--dsw-alias-border-l2);flex-wrap:wrap;flex-shrink:0}.ssj-chat h2{font:600 20px/1.4 ui-rounded,system-ui,sans-serif;margin:0}.ssj-chat-log{flex:1;min-height:80px;max-height:380px;overflow:auto;padding:12px 20px;overscroll-behavior:contain}.ssj-chat-message{white-space:pre-wrap;overflow-wrap:anywhere;margin:12px 0;line-height:1.65;padding:4px 12px;border-left:2px solid var(--dsw-alias-border-l2)}.ssj-chat-message[data-role=user]{border-color:var(--dsw-alias-brand-primary);margin-left:18px}.ssj-chat-message[data-role=assistant]{padding:12px 14px;background:var(--dsw-alias-bg-layer-1);border-radius:0 10px 10px 0}.ssj-chat-status{padding:9px 12px;margin-bottom:10px;border:1px solid var(--dsw-alias-border-l1);border-radius:8px;background:var(--dsw-alias-bg-layer-1);font-size:13px;line-height:1.5}.ssj-chat-message b{display:block;font-size:11px;letter-spacing:.1em;margin-bottom:4px;color:var(--dsw-alias-label-secondary)}.ssj-chat-compose{padding:14px 20px 18px;flex-shrink:0;max-height:55dvh;overflow:auto}.ssj-chat textarea{display:block;resize:vertical;width:100%;min-height:76px;max-height:180px;line-height:1.6;border-radius:9px}.ssj-chat-foot{display:flex;gap:12px;align-items:center;justify-content:space-between;margin-top:10px;flex-wrap:wrap}.ssj-chat-empty{padding:12px 0 18px}.ssj-chat-empty strong{display:block;font:500 18px/1.6 ui-rounded,system-ui,sans-serif;margin-bottom:8px}@media(max-width:600px){.ssj-chat-top,.ssj-chat-compose{padding:12px}.ssj-chat-log{padding:8px 12px}.ssj-chat-foot button{width:100%}.ssj-header{flex-wrap:wrap}.ssj-chat{max-height:calc(100dvh - 20px)}}`;
  function Chat({ctx,t,onSettled,open,onClose}) {
    const [state,setState]=useState({messages:[],sessionId:null,running:false,sending:false,connecting:false,error:''}),[draft,setDraft]=useState(''),[showHistory,setShowHistory]=useState(false);
    // Bound history by personal inputs, retaining their final answers in order.
    const inputIndexes=state.messages.flatMap((message,index)=>message.role==='user'?[index]:[]),historyStart=inputIndexes.length>20?inputIndexes.at(-20):0;
    const visibleMessages=showHistory?state.messages:state.messages.slice(historyStart);
    const delivery=state.connecting?'connecting':state.delivery??(state.sending?'sending':state.running?'processing':'idle');
    const feedback={connecting:t('正在连接对话…'),sending:t('正在发送，尚未确认收到…'),accepted:t('已收到，等待开始处理…'),waiting:t('正在等待对话状态，请勿重复发送…'),processing:t('已收到，正在处理…'),answered:t('已答复，请查看上方回答。'),'no-answer':t('本轮已结束，但没有文字答复。请打开完整对话核对结果。'),blocked:t('需要你确认，请打开完整对话继续。'),stopped:t('本轮已停止。请核对已有事项后再决定是否重发。'),failed:t('本次操作发生错误，请查看下方原因。'),uncertain:t('发送回执异常，请打开完整对话核对，避免重复发送。'),idle:t('发送后会在这里显示接收状态和最终答复。')}[delivery];
    const controller=useRef(null),refresh=useRef(onSettled),log=useRef(null),dialog=useRef(null),input=useRef(null);refresh.current=onSettled;
    useEffect(()=>{const node=dialog.current;if(open&&!node.open){setShowHistory(false);node.showModal();input.current?.focus({preventScroll:true});}else if(!open&&node.open)node.close();},[open]);
    useEffect(()=>{
      const key=()=>{const home=ctx.remote.$host.home;if(!home)throw Error(t('尚未连接到 DSH，请连接后重试。'));return 'suishouji67369b06:'+home+':chat';};
      const c=createChatController({sessions:ctx.sessions,remote:ctx.remote,storage:{get:()=>window.localStorage.getItem(key()),set:id=>window.localStorage.setItem(key(),id)},onChange:setState,onSettled:()=>refresh.current()});
      controller.current=c;c.connect().catch(()=>{});return()=>{c.dispose();controller.current=null;};
    },[ctx]);
    useEffect(()=>{if(open&&log.current)log.current.scrollTop=log.current.scrollHeight;},[open,state.messages,showHistory]);
    async function submit(event){event.preventDefault();const text=draft;if(await controller.current?.send(text))setDraft(value=>value===text?'':value);}
    return h('dialog',{className:'ssj-chat',ref:dialog,'aria-labelledby':'ssj-chat-title',onCancel:e=>{e.preventDefault();onClose();},onClose,onClick:e=>{if(e.target===e.currentTarget){const r=e.currentTarget.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)onClose();}}},h('div',{className:'ssj-chat-top'},h('h2',{id:'ssj-chat-title'},t('随口记 · AI 对话')),h('div',{className:'ssj-row'},state.sessionId&&h('button',{type:'button',onClick:()=>{onClose();ctx.get('uiWorkspace')?.openSession(state.sessionId);}},t('打开完整对话')),h('button',{type:'button',onClick:onClose,'aria-label':t('关闭随口记')},t('关闭')))),h('div',{className:'ssj-chat-log',ref:log,role:'log','aria-label':t('随手记对话记录')},state.messages.length?[historyStart>0&&h('button',{key:'history',type:'button',onClick:()=>setShowHistory(!showHistory)},showHistory?t('收起较早对话'):t('查看较早对话')), ...visibleMessages.map(message=>h('div',{key:message.id,className:'ssj-chat-message','data-role':message.role},h('b',null,message.role==='user'?t('你'):t('助手')),message.text))]:h('div',{className:'ssj-chat-empty'},h('strong',null,t('先说下来，不必先填表。')),h('p',{className:'ssj-muted'},t('试着说：帮我记下一个想法；或者，明天上午十点开会。')),h('small',null,t('便签和普通待办可以没有日期。时间不清楚时，助手会先问你。')))),
      h('form',{className:'ssj-chat-compose',onSubmit:submit},
      h(RecordingPanel,{t,purpose:'chat',visible:open}),
      h('div',{className:'ssj-chat-status',role:'status','aria-live':'polite','aria-atomic':true,'data-state':delivery},feedback),state.error&&h('p',{className:'ssj-error',role:'alert'},state.error),h('textarea',{ref:input,value:draft,'aria-label':t('想记什么，直接说'),placeholder:t('想记什么，直接说……'),maxLength:12000,onChange:e=>setDraft(e.target.value),onKeyDown:e=>{if(e.key==='Enter'&&(e.ctrlKey||e.metaKey)&&!e.nativeEvent?.isComposing){e.preventDefault();e.currentTarget.form?.requestSubmit();}}}),h('div',{className:'ssj-chat-foot'},h('small',null,t('沿用 DSH 模型额度 · Ctrl / ⌘ + Enter 发送')),h('button',{type:'submit',className:'ss-primary',disabled:!draft.trim()||state.sending||state.running||state.connecting},t('发送'))),h('small',null,t('只有明确要求记录才建项。微信提醒需先保存收件目标；如需授权或回答选项，请打开完整对话。'))));
  }
  function Page({layout,t,ctx}) {
  const labels={event:t("日程"),todo:t("待办"),note:t("便签")},states={pending:t("等待提醒"),sending:t("发送中"),sent:t("渠道已接受"),failed:t("未发送"),uncertain:t("结果不确定"),cancelled:t("已取消")};

    const [data,setData]=useState(null),[error,setError]=useState(''),[busy,setBusy]=useState(false),[tab,setTab]=useState('event'),[search,setSearch]=useState(''),[editor,setEditor]=useState(null),[day,setDay]=useState(''),[month,setMonth]=useState(''),[chatOpen,setChatOpen]=useState(false);
    const alive=useRef(true),request=useRef(0),abort=useRef(null),editorSerial=useRef(0),[notice,setNotice]=useState('');
    async function load(){const seq=++request.current;try{const r=await fetch(URL,{credentials:'same-origin',signal:abort.current?.signal});const v=await r.json();if(!r.ok)throw Error(v.error||t("读取失败"));if(alive.current&&seq===request.current){setData(v);setMonth(m=>m||v.now.slice(0,7));}}catch(e){if(alive.current&&e.name!=='AbortError')setError(e.message);}}
    useEffect(()=>{alive.current=true;abort.current=new AbortController();load();const timer=setInterval(load,10000);return()=>{alive.current=false;abort.current.abort();clearInterval(timer);};},[]);
    async function mutate(action){setBusy(true);setError('');try{const r=await fetch(URL,{method:'POST',credentials:'same-origin',headers:{'content-type':'application/json'},body:JSON.stringify(action),signal:abort.current?.signal});const v=await r.json();if(!r.ok)throw Error(v.error||t("保存失败"));if(alive.current){setNotice(t("已保存到当前本机配置"));await load();}return true;}catch(e){if(alive.current&&e.name!=='AbortError')setError(e.message);return false;}finally{if(alive.current)setBusy(false);}}
    const items=data?.items??[],targets=data?.delivery?.targets??[];
    const targetKey=t=>t?JSON.stringify([t.botId,t.targetId]):'';
    function discardEditor(){return !editor?.dirty||window.confirm(t('当前表单有未保存内容，继续会清空这些内容。是否继续？'));}
    function switchTab(key){if(busy||key===tab||!discardEditor())return;editorSerial.current++;setEditor(null);setTab(key);setDay('');setError('');setNotice('');}
    function newEditor(){if(busy||!discardEditor())return;setError('');setNotice('');setEditor({formKey:++editorSerial.current,dirty:false,kind:tab,title:'',body:'',tags:[],dueAt:'',remindAt:'',targetKey:targetKey(data?.preference?.target)});}
    async function save(e){e.preventDefault();if(busy||!editor)return;const formKey=editor.formKey;const selected=targets.find(t=>targetKey(t)===editor.targetKey);if(editor.remindAt&&!selected){setError(t("请选择一个已保存的微信目标"));return;}const action={op:editor.id?'update':'create',id:editor.id,revision:editor.revision,kind:editor.kind,title:editor.title,body:editor.body,tags:editor.tags??[],dueAt:editor.dueAt||null};if(editor.remindAt!==(editor.originalRemindAt??'')||(editor.id&&editor.remindAt&&editor.targetKey!==targetKey(editor.reminder?.target??data?.preference?.target))){action.remindAt=editor.remindAt||null;if(selected)action.target={botId:selected.botId,targetId:selected.targetId};}if(await mutate(action)){if(alive.current&&editorSerial.current===formKey)setEditor(null);}}
    const field=(key,value)=>{if(!busy)setEditor(s=>s?({...s,[key]:value,dirty:true}):s);};
    let visible=items.filter(x=>x.kind===tab&&(!search||`${x.title} ${x.body} ${(x.tags??[]).join(' ')}`.toLowerCase().includes(search.toLowerCase())));
    if(tab==='event')visible=visible.filter(x=>wall(x.dueAt).startsWith(day||month)).sort((a,b)=>a.dueAt.localeCompare(b.dueAt));
    function card(x){
      const r=x.reminder;
      return h('article',{key:x.id,'data-kind':x.kind,className:'ssj-card'+(x.done?' done':'')},
        x.kind!=='note'&&h('input',{type:'checkbox',checked:x.done,disabled:busy,'aria-label':t('完成')+' '+x.title,onChange:e=>mutate({op:'complete',id:x.id,revision:x.revision,done:e.target.checked})}),
        x.kind==='event'&&h('time',{className:'ssj-time',dateTime:x.dueAt},fmt(x.dueAt).slice(11)),
        h('div',{className:'ssj-item-main'},h('span',{className:'ssj-title',style:x.done?{textDecoration:'line-through'}:null},x.title),x.body&&h('details',{className:'ssj-preview'},h('summary',{'aria-label':t('查看正文')+' '+x.title},h('span',{className:'ssj-body'},x.body),h('span',{className:'ssj-preview-open'},t('全文')),h('span',{className:'ssj-preview-close'},t('收起正文'))),h('p',{className:'ssj-full-body'},x.body)),
          h('div',{className:'ssm-tags'},...(x.tags??[]).map(tag=>h('span',{key:tag,className:'ssj-tag'},tag))),
          x.dueAt&&x.kind!=='event'&&h('small',null,t('日程 / 截止：')+fmt(x.dueAt)+t(' · 上海')),
          r&&h('p',{className:'ssj-muted'},`${r.missed?t('错过提醒 · '):''}${states[r.state]} · ${fmt(r.at)}`,r.sentAt&&t('接受于')+' '+fmt(r.sentAt),r.error&&h('span',null,'\n'+r.error))),
        h('details',{className:'ssj-more'},h('summary',{'aria-label':t('更多操作')+' '+x.title},t('更多')),
          h('div',{className:'ssj-actions'},h('button',{disabled:busy,onClick:()=>{if(busy||!discardEditor())return;setError('');setNotice('');setEditor({...x,formKey:++editorSerial.current,dirty:false,dueAt:wall(x.dueAt),remindAt:wall(r?.at),originalRemindAt:wall(r?.at),targetKey:targetKey(r?.target??data?.preference?.target)});}},t('编辑')),
            h('button',{disabled:busy,onClick:()=>{if(window.confirm(t('删除这条事项？未发送的提醒也会取消。')))mutate({op:'delete',id:x.id,revision:x.revision});}},t('删除')),
            r&&['failed','uncertain'].includes(r.state)&&!x.done&&h('button',{disabled:busy,onClick:()=>{if(window.confirm(t('请先核对微信：结果不确定时重试可能重复发送。确认现在重试？')))mutate({op:'retry',id:x.id,revision:x.revision});}},t('核对后重试')))));
    }
    function groupedAgenda(){
      const today=data?.now?.slice(0,10),tomorrow=today?new Date(Date.parse(today+'T00:00:00Z')+86400000).toISOString().slice(0,10):'';
      const groups=new Map();for(const item of visible){const date=wall(item.dueAt).slice(0,10);if(!groups.has(date))groups.set(date,[]);groups.get(date).push(item);}
      return [...groups].map(([date,entries])=>{const weekday=new Intl.DateTimeFormat('zh-CN',{timeZone:'Asia/Shanghai',weekday:'short'}).format(new Date(date+'T00:00:00+08:00'));return h('section',{key:date,className:'ssj-agenda-group','aria-label':date},
        h('h3',null,date===today?t('今天'):date===tomorrow?t('明天'):date.slice(5).replace('-',t('月'))+t('日'),h('small',null,date+' · '+weekday)),h('div',{className:'ssj-inset-list'},...entries.map(card)));});
    }
    let calendar=null;
    if(tab==='event'&&month){const [year,mo]=month.split('-').map(Number),days=new Date(Date.UTC(year,mo,0)).getUTCDate(),offset=(new Date(Date.UTC(year,mo-1,1)).getUTCDay()+6)%7;const cells=[];for(let i=0;i<offset;i++)cells.push(h('span',{key:'blank'+i,className:'ssj-day'}));for(let i=1;i<=days;i++){const d=`${month}-${String(i).padStart(2,'0')}`,count=items.filter(x=>x.kind==='event'&&wall(x.dueAt).startsWith(d)).length;cells.push(h('button',{key:d,className:'ssj-day'+(d===day?' ss-active':''),'aria-label':d+' '+count+t('项日程'),'aria-pressed':d===day,onClick:()=>setDay(day===d?'':d)},i,count>0&&h('span',{className:'ssj-dot'},count+t(" 项"))));}calendar=h('div',null,h('div',{className:'ssj-agenda-bar'},h('h2',null,day||month.replace('-',t('年'))+t('月'),h('small',{className:'ssj-muted'},' · '+visible.length+t('项日程'))),h('div',{className:'ssj-row'},h('button',{onClick:()=>{setMonth(data.now.slice(0,7));setDay(data.now.slice(0,10));}},t('今天')),day&&h('button',{onClick:()=>setDay('')},t('查看整月')))),h('details',{className:'ssj-calendar-panel'},h('summary',null,t('展开月历 · 按日期筛选')),h('div',null,h('div',{className:'ssj-row'},h('input',{type:'month',value:month,'aria-label':t('日历月份'),onChange:e=>{setMonth(e.target.value);setDay('');}})),h('div',{className:'ssj-calendar'},...[t('一'),t('二'),t('三'),t('四'),t('五'),t('六'),t('日')].map(d=>h('span',{key:d,className:'ssj-week'},d)),...cells))));}
    return h('section',{className:'ssj','aria-label':t("随手记")},h('style',null,css+agendaCss+writingCss+chatCss+meetingCss+recordingCss),h('div',{className:'ssj-wrap'},h('header',{className:'ssj-header'},h('div',null,h('small',null,t("本机共享 / ASIA·SHANGHAI")),h('h1',null,t("随手记")),h('p',{className:'ssj-muted'},t('日程、待办与灵感，都在这里。')),h('p',{className:'ssj-muted'},t('有时间的未完成待办和日程会在应用内提醒，无需微信。退出不提醒；休眠恢复后补提示。'))),h('div',{className:'ssj-header-actions'},h('button',{type:'button','aria-haspopup':'dialog','aria-expanded':chatOpen,onClick:()=>setChatOpen(true)},t('随口记')),h('button',{onClick:()=>layout.selectPanel(null)},t("返回对话")))),h(Chat,{ctx,t,onSettled:load,open:chatOpen,onClose:()=>setChatOpen(false)}),error&&h('div',{className:'ssj-error',role:'alert'},error,h('button',{onClick:()=>{setError('');load();},style:{marginLeft:12}},t("刷新"))),h('div',{className:'ssj-bar'},...Object.entries(labels).map(([key,label])=>h('button',{key,className:tab===key?'ss-active':'','aria-pressed':tab===key,disabled:busy,onClick:()=>switchTab(key)},label+' '+items.filter(x=>x.kind===key).length)),h('button',{className:tab==='meeting'?'ss-active':'','aria-pressed':tab==='meeting',disabled:busy,onClick:()=>switchTab('meeting')},t('会议笔记')),h('input',{className:'ssj-search',placeholder:t("查找事项"),'aria-label':t("查找事项"),value:search,onChange:e=>setSearch(e.target.value)}),tab!=='meeting'&&h('button',{className:'ss-primary',disabled:!data||busy,onClick:newEditor},t("+ 新建")+labels[tab])),tab==='meeting'?h(Meetings,{t,search,onConverted:load}):h('div',{className:'ssj-layout'+(!editor?' single':editor.kind==='note'?' writing':'')},h('div',{className:'ssj-list-column'},calendar,h('div',{className:'ssj-list'},!data?h('p',{role:'status'},t("正在读取本机事项…")):visible.length?(tab==='event'?groupedAgenda():h('div',{className:'ssj-inset-list'},...visible.map(card))):h('div',{className:'ssj-empty'},h(Icon,{size:30}),h('p',null,h('strong',null,search?t("没有匹配事项"):t("这里还很轻"))),h('p',{className:'ssj-muted'},search?t("换个词试试。"):t("点击「新建」，或在任何对话中明确说「帮我记下……」。"))))),
      editor&&h('form',{key:editor.formKey,className:'ssj-editor','data-kind':editor.kind,autoComplete:'off',onSubmit:save},h('h2',null,editor.kind==='note'?(editor.id?t('编辑便签'):t('新建便签')):(editor.id?t("编辑事项"):t("记一件事"))),
        h('label',null,t("类型"),h('select',{value:editor.kind,onChange:e=>field('kind',e.target.value)},...Object.entries(labels).map(([key,v])=>h('option',{value:key,key},v)))),
        h('label',null,t("标题"),h('input',{className:'ssj-editor-title',autoFocus:true,required:true,maxLength:200,value:editor.title,onChange:e=>field('title',e.target.value)})),
        h('label',null,t("内容"),h('textarea',{className:'ssj-editor-body',rows:editor.kind==='note'?18:8,maxLength:12000,value:editor.body,onChange:e=>field('body',e.target.value)}),h('small',{className:'ssj-editor-count'},(editor.body??'').length.toLocaleString('en-US')+' / 12,000')),h(TagPicker,{t,value:editor.tags??[],onChange:value=>field('tags',value)}),
        h('div',{className:'ssj-editor-meta'},
          h('label',null,t("日程 / 截止时间 · 上海"),h('input',{type:'datetime-local',required:editor.kind==='event',value:editor.dueAt,onChange:e=>field('dueAt',e.target.value)})),
          h('label',null,t("微信提醒时间 · 上海（可留空）"),h('input',{type:'datetime-local',value:editor.remindAt,onChange:e=>field('remindAt',e.target.value)})),
          h('label',null,t("已保存的微信目标"),h('select',{value:editor.targetKey,onChange:e=>{field('targetKey',e.target.value);if(editor.originalRemindAt)field('originalRemindAt','changed-target');}},h('option',{value:''},t("请选择")),...targets.map(t=>h('option',{key:targetKey(t),value:targetKey(t)},t.name))))),
        h('p',{className:'ssj-muted'},t("仅运行期间发送。退出或睡眠不能准点提醒；恢复运行时标记错过并补发。")),
        h('div',{className:'ssj-editor-foot'},h('button',{type:'submit',className:'ss-primary',disabled:busy},busy?t("保存中…"):t("保存事项")),h('button',{type:'button',disabled:busy,onClick:()=>setEditor(null)},t("取消"))))),h('div',{role:'status',className:'ssj-muted',style:{marginTop:15}},notice),h('details',{className:'ssj-settings'},h('summary',null,t("微信提醒设置与运行边界")),h('p',{className:'ssj-muted'},data?.delivery?.message??t("正在检查微信服务…")),
        h('label',null,t("默认微信目标（对话创建提醒时使用）"),h('select',{value:targetKey(data?.preference?.target),disabled:busy||!data,onChange:e=>{const t=targets.find(t=>targetKey(t)===e.target.value);mutate({op:'preference',target:t?{botId:t.botId,targetId:t.targetId}:null});}},h('option',{value:''},t("不设默认目标")),...targets.map(t=>h('option',{key:targetKey(t),value:targetKey(t)},t.name)))),h('p',{className:'ssj-muted'},t("应用运行时由本机后台检查（约 10 秒），无需打开本页面。退出不发送，真正睡眠无法准点发送；重启或后台检查中断后已过期的提醒，以及延迟超过 1 分钟的提醒，会标记「错过提醒」后补发。发送中断或结果不确定不自动重试，请核对微信后决定。渠道接受不表示已读。卸载停用提醒，已保存数据保留。")))));
  }
  const messages={"便签":"便签","待办":"待办","日程":"日程","等待提醒":"等待提醒","发送中":"发送中","渠道已接受":"渠道已接受","未发送":"未发送","结果不确定":"结果不确定","已取消":"已取消","读取失败":"读取失败","保存失败":"保存失败","已保存到当前本机配置":"已保存到当前本机配置","请选择一个已保存的微信目标":"请选择一个已保存的微信目标","完成":"完成","日程 / 截止：":"日程 / 截止："," · 上海":" · 上海","错过提醒 · ":"错过提醒 · ","接受于":"接受于","编辑":"编辑","删除这条事项？未发送的提醒也会取消。":"删除这条事项？未发送的提醒也会取消。","删除":"删除","请先核对微信：结果不确定时重试可能重复发送。确认现在重试？":"请先核对微信：结果不确定时重试可能重复发送。确认现在重试？","核对后重试":"核对后重试","项日程":"项日程"," 项":" 项","日历月份":"日历月份","查看整月":"查看整月","整月日程":"整月日程","一":"一","二":"二","三":"三","四":"四","五":"五","六":"六","日":"日","随手记":"随手记","本机共享 / ASIA·SHANGHAI":"本机共享 / ASIA·SHANGHAI","先记下来，再一件件完成。跨对话保存，初始没有任何事项。":"先记下来，再一件件完成。跨对话保存，初始没有任何事项。","返回对话":"返回对话","刷新":"刷新","查找事项":"查找事项","+ 新建":"+ 新建","正在读取本机事项…":"正在读取本机事项…","没有匹配事项":"没有匹配事项","这里还很轻":"这里还很轻","换个词试试。":"换个词试试。","点击「新建」，或在任何对话中明确说「帮我记下……」。":"点击「新建」，或在任何对话中明确说「帮我记下……」。","编辑事项":"编辑事项","记一件事":"记一件事","类型":"类型","标题":"标题","内容":"内容","日程 / 截止时间 · 上海":"日程 / 截止时间 · 上海","微信提醒时间 · 上海（可留空）":"微信提醒时间 · 上海（可留空）","已保存的微信目标":"已保存的微信目标","请选择":"请选择","仅运行期间发送。退出或睡眠不能准点提醒；恢复运行时标记错过并补发。":"仅运行期间发送。退出或睡眠不能准点提醒；恢复运行时标记错过并补发。","保存中…":"保存中…","保存事项":"保存事项","取消":"取消","微信提醒设置与运行边界":"微信提醒设置与运行边界","正在检查微信服务…":"正在检查微信服务…","默认微信目标（对话创建提醒时使用）":"默认微信目标（对话创建提醒时使用）","不设默认目标":"不设默认目标","应用运行时由本机后台检查（约 10 秒），无需打开本页面。退出不发送，真正睡眠无法准点发送；重启或后台检查中断后已过期的提醒，以及延迟超过 1 分钟的提醒，会标记「错过提醒」后补发。发送中断或结果不确定不自动重试，请核对微信后决定。渠道接受不表示已读。卸载停用提醒，已保存数据保留。":"应用运行时由本机后台检查（约 10 秒），无需打开本页面。退出不发送，真正睡眠无法准点发送；重启或后台检查中断后已过期的提醒，以及延迟超过 1 分钟的提醒，会标记「错过提醒」后补发。发送中断或结果不确定不自动重试，请核对微信后决定。渠道接受不表示已读。卸载停用提醒，已保存数据保留。"};
  for(const text of ['新建便签','编辑便签','查看正文','全文','收起正文','今天','明天','年','月','日','更多','更多操作','展开月历 · 按日期筛选','日程、待办与灵感，都在这里。','当前表单有未保存内容，继续会清空这些内容。是否继续？','收起较早输入','查看较早输入','查看最近处理结果 / 补充问题','随口记','关闭随口记','关闭','尚未连接到 DSH，请连接后重试。','随口记 · AI 对话','打开完整对话','随手记对话记录','你','随手记助手','先说下来，不必先填表。','试着说：帮我记下一个想法；或者，明天上午十点开会。','便签和普通待办可以没有日期。时间不清楚时，助手会先问你。','想记什么，直接说','想记什么，直接说……','正在连接对话…','正在发送…','正在处理…','沿用 DSH 模型额度 · Ctrl / ⌘ + Enter 发送','发送','只有明确要求记录才建项。微信提醒需先保存收件目标；如需授权或回答选项，请打开完整对话。'])messages[text]=text;
  for(const text of [...meetingTexts,...recordingTexts,...reminderTexts,'有时间的未完成待办和日程会在应用内提醒，无需微信。退出不提醒；休眠恢复后补提示。'])messages[text]=text;
  for(const text of ['助手','查看较早对话','收起较早对话','正在发送，尚未确认收到…','已收到，等待开始处理…','正在等待对话状态，请勿重复发送…','已收到，正在处理…','已答复，请查看上方回答。','本轮已结束，但没有文字答复。请打开完整对话核对结果。','需要你确认，请打开完整对话继续。','本轮已停止。请核对已有事项后再决定是否重发。','本次操作发生错误，请查看下方原因。','发送回执异常，请打开完整对话核对，避免重复发送。','发送后会在这里显示接收状态和最终答复。'])messages[text]=text;
  return {inject:['slots','layout','locale','sessions','remote','remote.session'],apply(ctx){ctx.effect(()=>ctx.locale.register('suishouji67369b06',{zh:messages,en:messages}));const t=ctx.locale.bind('suishouji67369b06');ctx.slots.inject('shell.overlay',()=>ctx.slots.register({name:'shell.overlay',id:ID+':in-app-reminders',order:55,label:()=>t('随手记提醒')},()=>h(ReminderCenter,{t,layout:ctx.layout})));ctx.slots.inject('main',()=>ctx.slots.inject('sidebar.panellist',()=>[ctx.slots.register({name:'main',key:ID},()=>h(Page,{layout:ctx.layout,t,ctx})),ctx.slots.register({name:'sidebar.panellist',id:ID,order:55,label:()=>t('随手记')},Icon),()=>{if(ctx.layout.panelInfo.getSnapshot().activePanelId===ID)ctx.layout.selectPanel(null);} ]));}};
}});
