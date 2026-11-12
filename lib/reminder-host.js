import {InAppReminders,inAppEntrySchema,IN_APP_ROUTE} from './reminder-core.js';
export async function mountInAppReminders(ctx,notebook){
  const domain=await ctx.storageDomain.open({name:'dsh_calendar_in_app',version:1,layout:'per-record',tables:{notifications:{valueSchema:inAppEntrySchema}}});
  const book=new InAppReminders({records:domain.table('notifications'),getItems:()=>notebook.snapshot().items,now:()=>notebook.now()});
  ctx.effect(()=>async()=>{try{await book.close();}finally{await domain.close();}});
  ctx.effect(()=>ctx.connection.fetch.register({path:IN_APP_ROUTE,methods:['GET','POST'],requestBody:'buffered',fetch:async request=>{
    const json=(value,status=200)=>new Response(JSON.stringify(value),{status,headers:{'content-type':'application/json','cache-control':'no-store'}});
    try{
      if(request.method==='GET')return json(await book.list());
      const raw=await request.text();if(raw.length>16000)return json({error:'请求过大'},413);
      return json(await book.operate(JSON.parse(raw)));
    }catch(error){return json({error:error.message},400);}
  }}));
  ctx.effect(()=>ctx.tools.register({name:'dsh_calendar_in_app_reminders',deferLoading:true,description:'读取随手记应用内未读提醒，或按用户明确要求将指定提醒标为已读。不会完成、删除事项，也不发送微信。',parameters:{type:'object',properties:{op:{type:'string',enum:['list','read']},ids:{type:'array',minItems:1,maxItems:100,items:{type:'string',pattern:'^[a-f0-9]{64}$'},description:'read 必填，使用 list 返回的提醒 id；只标记这些提醒，不完成原事项。'}},required:['op'],additionalProperties:false},output:{schema:{type:'object',additionalProperties:true},render:(_args,value)=>[{type:'text',text:JSON.stringify(value)}]},execute:async args=>{
    if(args.op==='list'&&args.ids===undefined)return book.list();
    if(args.op==='read')return book.operate(args);
    throw Error('仅支持 list 或带 ids 的 read');
  }}));
  ctx.effect(()=>{
    let busy=false;
    const run=()=>{if(busy)return;busy=true;book.list().catch(error=>ctx.logger?.warn?.('随手记应用内提醒检查失败：%s',error.message)).finally(()=>{busy=false;});};
    run();const timer=setInterval(run,5000);timer.unref?.();return()=>clearInterval(timer);
  });
  return book;
}
