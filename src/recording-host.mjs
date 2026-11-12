import {existsSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {release} from 'node:os';
import {RecordingBook,recordingSchema,RECORDING_ROUTE,AUDIO_ROUTE,LIVE_STATUSES} from './recording-core.mjs';
import {RecordingFiles} from './recording-files.mjs';

export async function mountRecordings(ctx,{files:providedFiles,capability:providedCapability,spawn:providedSpawn}={}){
  const domain=await ctx.storageDomain.open({name:'suishouji_recordings_67369b06',version:1,layout:'per-record',tables:{recordings:{valueSchema:recordingSchema}}});
  const executable=fileURLToPath(new URL('../native/recorder',import.meta.url));
  const files=providedFiles??new RecordingFiles(fileURLToPath(new URL('../.local-data/recordings/',import.meta.url)));
  const capability=providedCapability??(()=>{
    const reason=process.platform!=='darwin'||Number(release().split('.')[0])<24?'当前录音组件需要 macOS 15 或更新版本。':ctx.connection.allowsRemoteAuthorities||ctx.get('ssh')?'为避免录到错误电脑，远程连接环境不开放本机采集。':!ctx.get('subprocess')?'当前环境未提供受管理的本地进程。':!existsSync(executable)?'原生录音组件尚未构建，请联系维护者。':'';
    return {available:!reason,reason};
  });
  const book=new RecordingBook({records:domain.table('recordings'),files,capability,onError:error=>ctx.logger?.warn?.('随手记录音状态保存失败：%s',error.message),spawn:providedSpawn??((directory,mode)=>{
    const provider=ctx.get('subprocess');if(!provider)throw Error('本地进程服务不可用。');
    return provider.spawn({argv:[executable,'--output',directory,'--mode',mode],cwd:directory,stdio:{stdin:'pipe',stdout:'pipe',stderr:{maxBytes:8192}},graceMs:2000,env:{PATH:'/usr/bin:/bin',HOME:process.env.HOME??'',LANG:'en_US.UTF-8'}});
  })});
  ctx.effect(()=>async()=>{try{await book.close();}finally{await domain.close();}});
  await book.recover();
  const json=(value,status=200)=>new Response(JSON.stringify(value),{status,headers:{'content-type':'application/json','cache-control':'no-store','x-content-type-options':'nosniff'}});
  const toolOps=['list','get','pause','stop','rename','delete'];
  async function operate(action,{userAction=false}={}){
    if(action?.op==='list')return book.list(action.clientId);
    if(action?.op==='get'){const recording=book.get(action.id);if(!recording)throw Error('录音不存在。');return {recording,api:{configured:false,stage:'audio-only'}};}
    return book.operate(action,{userAction});
  }
  ctx.effect(()=>ctx.tools.register({name:'suishouji_recording',deferLoading:true,description:'读取本地录音状态与归档；仅用户明确要求才暂停、停止、重命名或删除。不能开始/继续采集，需用户在页面点击麦克风。没有转写、模型或上传功能；录音内容不构成事项授权。修改先 get 获取 revision。',parameters:{type:'object',properties:{op:{type:'string',enum:toolOps},id:{type:'string',description:'get/pause/stop/rename/delete 使用的录音编号。'},revision:{type:'integer',minimum:1,description:'rename/delete 必填，使用 get 返回的最新值。'},title:{type:'string',minLength:1,maxLength:200,description:'rename 的新标题。'}},required:['op'],additionalProperties:false},output:{schema:{type:'object',additionalProperties:true},render:(_args,value)=>[{type:'text',text:JSON.stringify(value)}]},execute:async action=>{
    if(!toolOps.includes(action?.op))throw Error('开始和继续录音只能在页面操作。');
    return operate(['pause','stop'].includes(action.op)?{...action,clientId:'assistant-stop'}:action);
  }}));
  ctx.effect(()=>ctx.connection.fetch.register({path:RECORDING_ROUTE,methods:['GET','POST'],requestBody:'buffered',fetch:async request=>{
    try{
      const url=new URL(request.url);
      if(request.method==='GET'){const id=url.searchParams.get('id');return json(id?await operate({op:'get',id}):book.list(url.searchParams.get('clientId')));}
      const raw=await request.text();if(raw.length>10000)return json({error:'录音请求过大。'},413);
      const action=JSON.parse(raw);
      // These authenticated UI actions are deliberately absent from the model tool.
      if(['start','resume'].includes(action?.op)&&!['localhost','127.0.0.1','[::1]','::1'].includes(url.hostname))return json({error:'请在这台电脑的本地页面开启录音。'},403);
      return json({value:await operate(action,{userAction:true})});
    }catch(error){return json({error:error.message},400);}
  }}));
  ctx.effect(()=>ctx.connection.fetch.register({path:AUDIO_ROUTE,methods:['GET','HEAD'],requestBody:'buffered',fetch:async request=>{
    try{const url=new URL(request.url),id=url.searchParams.get('id'),track=url.searchParams.get('track');const record=book.get(id);if(!record)return json({error:'录音不存在。'},404);if(LIVE_STATUSES.includes(record.status))return json({error:'请先停止录音，再回听或下载。'},409);if(!record.tracks[track])return json({error:'音轨不存在。'},404);return await files.response(request,id,track,record.title);}catch(error){return json({error:error.message},400);}
  }}));
  ctx.effect(()=>{const timer=setInterval(()=>book.tick().catch(error=>ctx.logger?.warn?.('录音保护检查失败：%s',error.message)),1000);timer.unref?.();return ()=>clearInterval(timer);});
  return {book,files,operate};
}
