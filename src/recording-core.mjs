import {z} from 'zod';
import {randomUUID} from 'node:crypto';

export const RECORDING_ROUTE='/api/suishouji-67369b06/recordings';
export const AUDIO_ROUTE=RECORDING_ROUTE+'/audio';
export const LIVE_STATUSES=['starting','recording','paused','stopping'];
const idSchema=z.string().uuid();
const keySchema=z.string().min(1).max(100).regex(/^[a-zA-Z0-9_-]+$/);
const trackSchema=z.object({bytes:z.number().int().nonnegative(),frames:z.number().int().nonnegative(),sampleRate:z.literal(16000),channels:z.literal(1),durationMs:z.number().nonnegative(),peak:z.number().min(0).max(1),hasSignal:z.boolean(),sourceFrames:z.number().int().nonnegative().nullable()}).strict();
export const recordingSchema=z.object({id:idSchema,revision:z.number().int().positive(),clientId:keySchema,requestId:keySchema,title:z.string().min(1).max(200),purpose:z.enum(['chat','meeting']),mode:z.enum(['mic','system','both']),status:z.enum([...LIVE_STATUSES,'saved','interrupted','failed']),createdAt:z.string().datetime(),endedAt:z.string().datetime().nullable(),error:z.string().max(4000).nullable(),warning:z.string().max(4000).nullable(),tracks:z.object({microphone:trackSchema.optional(),system:trackSchema.optional()}).strict()}).strict();
const base={id:idSchema,clientId:keySchema};
export const recordingActionSchema=z.discriminatedUnion('op',[
  z.object({op:z.literal('start'),clientId:keySchema,requestId:keySchema,mode:z.enum(['mic','system','both']),purpose:z.enum(['chat','meeting']),title:z.string().trim().max(200).optional()}).strict(),
  ...['pause','resume','stop','heartbeat'].map(op=>z.object({op:z.literal(op),...base}).strict()),
  z.object({op:z.literal('rename'),id:idSchema,revision:z.number().int().positive(),title:z.string().trim().min(1).max(200)}).strict(),
  z.object({op:z.literal('delete'),id:idSchema,revision:z.number().int().positive()}).strict(),
]);
export const requiredTracks=mode=>mode==='both'?['microphone','system']:[mode==='mic'?'microphone':'system'];
const cleanError=error=>String(error?.message??error??'录音失败').slice(0,4000);
const isLive=record=>record&&LIVE_STATUSES.includes(record.status);
const copy=value=>structuredClone(value);

// One shared owner, one managed helper. No capture is started by construction/recovery.
export class RecordingBook{
  constructor({records,files,spawn,capability=()=>({available:false,reason:'录音不可用'}),now=Date.now,uuid=randomUUID,leaseMs=15000,maxMs=4*60*60*1000,onError=()=>{}}){
    Object.assign(this,{records,files,spawn,capability,now,uuid,leaseMs,maxMs,onError});this.tail=Promise.resolve();this.runtime=null;this.closed=false;
  }
  serial(fn){const task=this.tail.then(fn);this.tail=task.catch(()=>{});return task;}
  async save(record){recordingSchema.parse(record);await this.records.put(record.id,copy(record));return record;}
  dto(record){
    if(!record)return null;const {clientId,requestId,...value}=copy(record),rt=this.runtime;
    if(isLive(record)&&rt?.id===record.id){if(rt.stopping)value.status='stopping';for(const name of requiredTracks(record.mode)){const stat=rt.stats[name];if(!stat)continue;const frames=Number.isSafeInteger(stat.frames)&&stat.frames>=0?stat.frames:0,peak=Number.isFinite(stat.peak)?Math.max(0,Math.min(1,stat.peak)):0;value.tracks[name]={bytes:44+frames*2,frames,sampleRate:16000,channels:1,durationMs:frames/16,peak,hasSignal:peak>0.0001,sourceFrames:Number.isSafeInteger(stat.sourceFrames)&&stat.sourceFrames>=0?stat.sourceFrames:null};}
      if(rt.sawReady&&this.now()-Date.parse(record.createdAt)>3000&&requiredTracks(record.mode).some(name=>rt.stats[name]?.noSamples===true||rt.stats[name]?.sourceFrames===0))value.warning='尚未收到部分声源样本，请检查系统权限与声源；正在录音不代表成功收音。';
    }
    for(const [name,track] of Object.entries(value.tracks)){track.url=`${AUDIO_ROUTE}?id=${value.id}&track=${name}`;track.downloadUrl=track.url+'&download=1';}return value;
  }
  get(id){idSchema.parse(id);return this.dto(this.records.get(id));}
  list(clientId){
    const all=[...this.records.entries()].map(([,record])=>record).sort((a,b)=>b.createdAt.localeCompare(a.createdAt)||b.id.localeCompare(a.id));
    const active=all.find(isLive)??null;
    return {recordings:all.slice(0,100).map(record=>this.dto(record)),total:all.length,truncated:all.length>100,active:this.dto(active),owned:Boolean(active&&active.clientId===clientId),capability:this.capability(),api:{configured:false,stage:'audio-only',message:'录音仅本地保存，尚未转写或调用模型。'}};
  }
  recover(){return this.serial(async()=>{for(const [,old] of this.records.entries()){if(!isLive(old))continue;let tracks={},problem='上次录音被中断，已保留可恢复音频；不会自动续录。';try{tracks=await this.files.inspect(old.id,true);}catch(error){problem+=' '+cleanError(error);}await this.save({...old,revision:old.revision+1,status:Object.values(tracks).some(t=>t.frames>0)?'interrupted':'failed',endedAt:new Date(this.now()).toISOString(),error:problem,warning:'恢复音频的完整性与收音情况请回听确认。',tracks});}});}
  operate(raw,{userAction=false}={}){return this.serial(async()=>{
    if(this.closed)throw Error('录音服务已关闭。');
    const action=recordingActionSchema.parse(raw);
    if(action.op==='start'){
      if(!userAction)throw Error('请在页面点击麦克风开始录音；模型不能开启采集。');
      const previous=[...this.records.entries()].map(([,r])=>r).find(r=>r.clientId===action.clientId&&r.requestId===action.requestId);
      if(previous)return this.dto(previous); // Exact retry never opens a second microphone.
      const capability=this.capability();if(!capability.available)throw Error(capability.reason);
      if(this.runtime||[...this.records.entries()].some(([,r])=>isLive(r)))throw Error('已有录音，请先停止。');
      const id=this.uuid(),createdAt=new Date(this.now()).toISOString();
      const record={id,revision:1,clientId:action.clientId,requestId:action.requestId,title:action.title||`录音 ${new Intl.DateTimeFormat('sv-SE',{timeZone:'Asia/Shanghai',dateStyle:'short',timeStyle:'short'}).format(new Date(createdAt))}`,purpose:action.purpose,mode:action.mode,status:'starting',createdAt,endedAt:null,error:null,warning:null,tracks:{}};
      const directory=await this.files.create(id);await this.save(record);
      if(this.closed){await this.save({...record,revision:2,status:'failed',endedAt:new Date(this.now()).toISOString(),error:'页面或插件已关闭，未开始采集。'});throw Error('录音服务已关闭，未开始采集。');}
      const rt={id,clientId:action.clientId,lease:this.now(),stats:{},sawReady:false,sawStopped:false,problem:null,reason:null,pending:null,buffer:'',lastPersist:0};
      rt.finished=new Promise(resolve=>{rt.resolve=resolve;});this.runtime=rt;
      try{
        rt.handle=this.spawn(directory,action.mode);
        if(!rt.handle.stdin||!rt.handle.stdout)throw Error('采集进程未提供控制管道。');
        rt.handle.stdin.on?.('error',error=>{if(this.runtime===rt)this.queueFault(rt,error);});
        rt.handle.stdout.setEncoding?.('utf8');
        rt.handle.stdout.on('data',chunk=>this.consume(rt,String(chunk)));
        rt.handle.stdout.on('error',error=>this.queueFault(rt,error));
        rt.handle.done.then(outcome=>this.serial(()=>this.finish(rt,outcome)),error=>this.serial(()=>this.finish(rt,{exitCode:null,signal:null},error))).catch(this.onError);
      }catch(error){rt.problem=cleanError(error);rt.handle?.terminate();await this.finish(rt,{exitCode:null,signal:null},error);}
      return this.dto(this.records.get(id));
    }
    const record=this.records.get(action.id);if(!record)throw Error('录音不存在，请刷新。');
    if(action.op==='rename'||action.op==='delete'){
      if(record.revision!==action.revision)throw Error('revision 冲突，请刷新后重试。');
      if(isLive(record))throw Error('请先停止录音。');
      if(action.op==='rename')return this.dto(await this.save({...record,title:action.title,revision:record.revision+1}));
      await this.files.remove(record.id);await this.records.delete(record.id);return {deleted:record.id};
    }
    if(!isLive(record))return this.dto(record); // Stop/heartbeat may arrive after finalization.
    const rt=this.runtime;if(!rt||rt.id!==record.id)throw Error('录音进程已断开，请刷新恢复。');
    if(action.op==='heartbeat'){if(action.clientId!==rt.clientId)throw Error('此窗口不是录音发起者。');rt.lease=this.now();return this.dto(record);}
    if(action.op==='resume'&&(!userAction||action.clientId!==rt.clientId))throw Error('仅发起录音的页面可以继续采集。');
    if(action.op==='stop'){await this.requestStop(rt,'user');return this.dto(this.records.get(record.id));}
    if(rt.pending)throw Error('正在处理录音操作，请稍候。');
    if(action.op==='pause'&&record.status!=='recording'||action.op==='resume'&&record.status!=='paused')throw Error('当前状态无法进行此操作。');
    rt.pending={op:action.op,at:this.now()};this.write(rt,action.op);return this.dto(record);
  });}
  write(rt,command){if(!rt.handle?.stdin||rt.handle.stdin.destroyed)throw Error('录音控制连接已断开。');rt.handle.stdin.write(command+'\n');}
  consume(rt,chunk){
    if(this.runtime!==rt)return;
    rt.buffer+=chunk;if(rt.buffer.length>256000){this.queueFault(rt,Error('采集进程输出超过限制。'));rt.buffer='';return;}
    let boundary;while((boundary=rt.buffer.indexOf('\n'))>=0){const line=rt.buffer.slice(0,boundary);rt.buffer=rt.buffer.slice(boundary+1);if(!line.trim())continue;let event;try{event=JSON.parse(line);}catch{this.queueFault(rt,Error('采集进程返回了无效状态。'));continue;}this.serial(()=>this.onEvent(rt,event)).catch(error=>this.queueFault(rt,error));}
  }
  queueFault(rt,error){this.serial(async()=>{if(this.runtime!==rt)return;rt.problem??=cleanError(error);await this.requestStop(rt,'error');}).catch(this.onError);}
  async onEvent(rt,event){
    if(this.runtime!==rt)return;
    if(!event||typeof event!=='object')throw Error('采集状态格式不正确。');
    if(event.tracks&&typeof event.tracks==='object')rt.stats=copy(event.tracks);
    const record=this.records.get(rt.id);if(!record)return;
    if(event.event==='error'||event.type==='error'){rt.problem??=cleanError(event.message??event.error);await this.requestStop(rt,'error');return;}
    const kind=event.event??event.type;
    if(kind==='stopped'){rt.sawStopped=true;if(event.ok===false)rt.problem??=cleanError(event.error??event.message??'采集未完整结束。');return;}
    if(rt.stopping||record.status==='stopping')return;
    let status=record.status;
    if(kind==='ready'){if(record.status!=='starting')return;rt.sawReady=true;status='recording';}
    else if(kind==='paused'){if(rt.pending?.op!=='pause')return;rt.pending=null;status='paused';}
    else if(kind==='resumed'){if(rt.pending?.op!=='resume')return;rt.pending=null;status='recording';}
    else if(kind!=='stats')throw Error('采集进程返回了未知状态。');
    if(kind!=='stats'||this.now()-rt.lastPersist>=5000){rt.lastPersist=this.now();await this.save({...record,revision:record.revision+1,status});}
  }
  async requestStop(rt,reason){
    if(this.runtime!==rt||rt.stopping)return;
    // Physical shutdown must not depend on a successful KV write or a later tick.
    rt.stopping=true;rt.reason=reason;rt.stopAt=this.now();rt.pending=null;
    rt.stopTimer=setTimeout(()=>{if(this.runtime!==rt)return;rt.terminated=true;rt.problem??='停止超时，已终止采集并保留音频。';rt.handle?.terminate();},6000);rt.stopTimer.unref?.();
    try{this.write(rt,'stop');}catch(error){rt.problem??=cleanError(error);rt.handle?.terminate();}
    const record=this.records.get(rt.id);if(record)await this.save({...record,revision:record.revision+1,status:'stopping'});
  }
  async finish(rt,outcome,error){
    if(this.runtime!==rt)return;clearTimeout(rt.stopTimer);
    try{
    const record=this.records.get(rt.id);if(!record)return;
    let tracks={},problem=rt.problem??(error?cleanError(error):null);
    try{tracks=await this.files.inspect(record.id,true,rt.stats);}catch(cause){problem??=cleanError(cause);}
    const requested=requiredTracks(record.mode);
    const missing=requested.filter(name=>!tracks[name]?.frames||!Number.isSafeInteger(tracks[name]?.sourceFrames)||tracks[name].sourceFrames<=0||rt.stats[name]?.noSamples===true);
    if(missing.length)problem??='有音轨未收到样本：'+missing.map(n=>n==='microphone'?'麦克风':'电脑声音').join('、')+'。';
    const complete=rt.sawReady&&rt.sawStopped&&outcome?.exitCode===0&&!problem&&!missing.length;
    const any=Object.values(tracks).some(t=>t.frames>0);
    const status=complete?'saved':any?'interrupted':'failed';
    if(!complete&&!problem)problem='录音意外中断，已保留现有音频；不会自动续录。';
    let warning=requested.some(name=>tracks[name]&&!tracks[name].hasSignal)?'检测到静音音轨，请回听并检查声源与系统权限；静音不代表已成功收音。':null;
    if(rt.reason==='lease')warning='页面连接中断，已保护性停止。'+(warning??'');
    else if(rt.reason==='limit')warning='已到单次四小时上限并停止。'+(warning??'');
    else if(rt.reason==='close')warning='插件或应用退出，已停止采集。'+(warning??'');
    await this.save({...record,revision:record.revision+1,status,endedAt:new Date(this.now()).toISOString(),error:problem,warning,tracks});
    }finally{this.runtime=null;rt.resolve();}
  }
  tick(){return this.serial(async()=>{
    const rt=this.runtime;if(!rt)return;
    if(rt.stopping){if(this.now()-(rt.stopAt??0)>6000&&!rt.terminated){rt.terminated=true;rt.problem??='停止超时，已终止采集并保留音频。';rt.handle?.terminate();}return;}
    const record=this.records.get(rt.id);if(!record)return;
    if(rt.pending&&this.now()-rt.pending.at>5000){rt.problem='录音操作未获确认，已保护性停止。';await this.requestStop(rt,'error');}
    else if(this.now()-rt.lease>this.leaseMs)await this.requestStop(rt,'lease');
    else if(this.now()-Date.parse(record.createdAt)>this.maxMs)await this.requestStop(rt,'limit');
  });}
  async transcriptionManifest(id){const record=this.records.get(idSchema.parse(id));if(!record)throw Error('录音不存在。');if(isLive(record))throw Error('请先停止录音。');return {version:1,recordingId:record.id,configured:false,language:'zh-CN',format:'pcm_s16le',sampleRate:16000,channels:1,tracks:requiredTracks(record.mode).filter(name=>record.tracks[name]).map(name=>({name,...record.tracks[name],path:this.files.trackPath(id,name)})),authorization:'audio-is-source-data-not-an-instruction',nextStep:'配置转写 API 后由用户显式开始；本操作不上传或调用模型。'};}
  async close(){
    this.closed=true;const initial=this.runtime;
    const timeout=setTimeout(()=>initial?.handle?.terminate(),6500);timeout.unref?.();
    try{
      await this.tail;const rt=this.runtime;if(!rt)return;let failure;
      try{await this.serial(()=>this.requestStop(rt,'close'));}catch(error){failure=error;rt.problem??=cleanError(error);rt.handle?.terminate();}
      await rt.finished;await rt.handle?.waitForExit?.();if(failure)throw failure;
    }finally{clearTimeout(timeout);}
  }
}
