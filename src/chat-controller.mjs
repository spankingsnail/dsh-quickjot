// Session contracts verified with Client Service.sessions and Host Event.session/event.
// The only text sent to the model is the text the user explicitly submits here.
export function chatMessages(entries) {
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
export function createChatController({sessions,remote,workspaces,storage,onChange=()=>{},onSettled=()=>{}}) {
  let state={sessionId:null,messages:[],running:false,sending:false,connecting:false,error:'',delivery:'idle',requestId:null,modelCatalog:null,modelSelection:null,modelLoading:false,modelSelecting:false,modelError:'',archiveReady:false,archived:false,archiveError:'',restoring:false,restored:false,recoveryError:''};
  let disposed=false,reference=null,binding=null,opening=null,offs=[],settlePending=null;
  let attempt=null,localError='',seenEndSeq=null,catalogLoading=null,modelProjection=null,recoveredBlockedSeq=null;
  const readModel=()=>{
    const projected=modelProjection?.getSnapshot();
    return projected===undefined?state.modelSelection??state.modelCatalog?.default??null:projected.next??state.modelCatalog?.default??null;
  };
  const busy=snapshot=>!!(snapshot.running||snapshot.awaitingFirstTurn||snapshot.pendingSubmissions?.length);
  const snapshotError=s=>s.lastAgentError||s.promptError?.error?.message||s.openError?.message||'';
  const emit=patch=>{if(disposed)return;state={...state,...patch};onChange(state);};
  const readArchive=()=>{
    const snapshot=workspaces?.list?.getSnapshot();
    const archiveReady=snapshot?.phase==='ready'&&snapshot.state!=='loading'&&snapshot.state!=='error';
    return {archiveReady,archived:!!snapshot?.archivedSessionIds?.includes(state.sessionId),archiveError:!snapshot?'无法读取会话归档状态，请刷新 DSH 后重试。':snapshot.state==='error'?(snapshot.error?.message||'无法核对会话状态，请刷新 DSH 后重试。'):''};
  };
  const assertWritable=()=>{
    const archive=readArchive();emit(archive);
    if(!archive.archiveReady)throw Error(archive.archiveError||'正在核对会话归档状态，请稍后再发送。');
    if(archive.archived)throw Error('此随口记对话已归档。请先恢复对话，再手动发送；旧消息不会自动重发。');
  };
  const sync=()=>{
    if(disposed||!binding)return;
    const snapshot=binding.session.getSnapshot(),entries=binding.eventSource.getSnapshot().entries;
    const messages=chatMessages(entries),activity=chatActivity(entries);
    // An old completed turn must not settle a newly accepted submission.
    const end=activity.end&&(!attempt||activity.end.seq>attempt.baseSeq)?activity.end:null;
    if(end&&attempt){attempt.terminal=true;attempt.problem='';}
    let feedback={delivery:'idle',error:localError};
    const nativeError=snapshotError(snapshot),currentError=attempt&&nativeError===attempt.baselineError?'':nativeError;
    const archive=readArchive();
    if(archive.archived)feedback={delivery:'archived',error:''};
    else if(localError)feedback={delivery:'failed',error:localError};
    else if(currentError&&(!attempt?.terminal||attempt?.retired))feedback={delivery:'failed',error:currentError};
    else if(snapshot.openState==='error')feedback={delivery:'failed',error:nativeError||'对话连接已断开，请打开完整对话检查。'};
    else if(end)feedback=end.seq===recoveredBlockedSeq&&end.data.reason.kind==='blocked'?{delivery:'idle',error:''}:endedFeedback(end,entries,messages);
    else if(attempt?.problem)feedback={delivery:attempt.uncertain?'uncertain':'failed',error:attempt.problem};
    else if(state.sending&&!attempt?.accepted)feedback.delivery='sending';
    else if(snapshot.running)feedback.delivery='processing';
    else if(attempt?.accepted||activity.user>Math.max(activity.start,activity.latestEnd?.seq??-1))feedback.delivery='accepted';
    else if(snapshot.awaitingFirstTurn||snapshot.pendingSubmissions?.length)feedback.delivery='waiting';
    // Keep acceptance visible (and prevent duplicate submission) during the
    // gap before native running/pending snapshots catch up. Receipt != saved.
    const waitingForReply=!!(attempt?.accepted&&!attempt.terminal);
    emit({messages,running:busy(snapshot)||waitingForReply,...feedback,...archive,requestId:attempt?.requestId??null,modelSelection:readModel()});
    const endSeq=activity.latestEnd?.seq??-1;
    if(seenEndSeq===null)seenEndSeq=endSeq;
    else if(endSeq>seenEndSeq){seenEndSeq=endSeq;onSettled();}
  };
  const offWorkspace=workspaces?.list?.subscribe(()=>{emit(readArchive());sync();});
  emit(readArchive());
  async function open(create){
    if(disposed)throw Error('页面已关闭');
    if(binding)return binding;
    if(opening){
      const ready=await opening;
      // A non-creating mount read may finish empty while an explicit send waits.
      // Upgrade that read into creation instead of silently dropping the send.
      return ready||!create?ready:open(true);
    }
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
        modelProjection=binding.session.projections?.faceOf('modelSelection');
        if(modelProjection)offs.push(modelProjection.subscribe(sync));
        sync();return binding;
      }catch(error){
        reference?.release();reference=null;localError=error.message||String(error);
        emit({error:localError,delivery:'failed'});throw error;
      }finally{emit({connecting:false});opening=null;}
    });
    return opening;
  }
  async function loadModels(){
    if(disposed)return null;
    if(catalogLoading)return catalogLoading;
    emit({modelLoading:true,modelError:''});
    catalogLoading=Promise.resolve().then(async()=>{
      const result=await remote.session.modelCatalog();
      if(!result.ok)throw result.error;
      if(!disposed){emit({modelCatalog:result.value});emit({modelSelection:readModel()});}
      return result.value;
    }).catch(error=>{emit({modelError:error.message||String(error)});return null;})
      .finally(()=>{catalogLoading=null;emit({modelLoading:false});});
    return catalogLoading;
  }
  return {
    getSnapshot:()=>state,
    connect:()=>open(false),
    loadModels,
    // Only this explicit UI command can undo this exact session's archive.
    // It never prompts, replays a consumed inbox item, or changes permissions.
    async restoreArchived(){
      if(disposed||state.restoring||state.sending||state.running||state.modelSelecting||!state.sessionId)return false;
      emit({restoring:true,restored:false,recoveryError:''});
      try{
        const archive=readArchive();
        if(!archive.archiveReady)throw Error(archive.archiveError||'正在核对会话状态，请稍后重试。');
        const previousEnd=binding?chatActivity(binding.eventSource.getSnapshot().entries).end:null;
        const blockedSeq=previousEnd?.data.reason.kind==='blocked'?previousEnd.seq:null;
        if(archive.archived)await workspaces.unarchiveSession(state.sessionId);
        if(disposed)return false;
        const confirmed=readArchive();emit(confirmed);
        if(!confirmed.archiveReady)throw Error(confirmed.archiveError||'归档状态尚未重新核对完成，请稍后再确认。');
        if(confirmed.archived)throw Error('对话仍处于归档状态，请刷新后核对。');
        recoveredBlockedSeq=blockedSeq;localError='';emit({restored:true});sync();return true;
      }catch(error){emit({recoveryError:error.message||String(error)});return false;}
      finally{emit({restoring:false});}
    },
    async selectModel(selection){
      if(disposed||state.sending||state.running||state.modelSelecting||state.restoring)return false;
      emit({modelSelecting:true,modelError:''});
      try{
        const catalog=state.modelCatalog??await loadModels();
        const model=catalog?.groups.find(group=>group.id===selection.provider)?.models.find(model=>model.id===selection.model);
        if(!model)throw Error('该模型当前不可用，请刷新模型列表后重选。');
        if(selection.reasoningEffort!==undefined&&!model.reasoning?.efforts.some(effort=>effort.id===selection.reasoningEffort))throw Error('该模型不支持所选推理强度。');
        assertWritable();
        const b=await open(true);if(!b||disposed)return false;
        assertWritable();
        if(busy(b.session.getSnapshot()))throw Error('上一条消息仍在处理，请稍后切换模型');
        const result=await remote.session.selectModel({sessionId:state.sessionId,provider:selection.provider,model:selection.model,...selection.reasoningEffort===undefined?{}:{reasoningEffort:selection.reasoningEffort}});
        if(!result.ok)throw result.error;
        emit({modelSelection:result.value.selected});return !disposed;
      }catch(error){emit({modelError:error.message||String(error)});return false;}
      finally{emit({modelSelecting:false});}
    },
    async send(text){
      if(disposed||state.sending||state.running||state.modelSelecting||state.restoring||!text.trim())return false;
      // Native receipt/outcome callbacks belong to one exact attempt. A late
      // callback must not overwrite feedback for a later explicit submission.
      let own=null;localError='';attempt=null;
      emit({sending:true,error:'',delivery:'sending',requestId:null,restored:false,recoveryError:''});
      try{
        assertWritable();
        const b=await open(true);if(!b||disposed)return false;
        assertWritable();
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
          const fail=(error,definitive=false,retired=false)=>{
            if(!current()||(own.terminal&&!own.retired)||(own.failed&&!own.accepted&&!own.retired))return;
            own.problem=error.message||String(error);own.failed=true;
            if(retired){own.retired=true;own.terminal=true;}
            own.uncertain=!own.retired&&(own.accepted||!definitive);
            // An accepted message may already be executing. Never abandon it
            // because a later transport result failed, and never resend it.
            if(!own.accepted&&handle&&!abandoned){abandoned=true;handle.abandon();}
            sync();reject(error);
          };
          handle=b.session.beginSubmission({mode:'queue',text,attachments:[],onAccept:accept,
            onRetire:retired=>retired.reason==='observed'?accept():fail(Error(own.accepted?'消息已退出队列；请打开完整对话检查后再发送':'消息未被接受；请打开完整对话检查后再发送'),true,true)});
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
    dispose(){if(disposed)return;disposed=true;settlePending?.();settlePending=null;for(const off of offs)off();offs=[];offWorkspace?.();reference?.release();reference=null;binding=null;}
  };
}
