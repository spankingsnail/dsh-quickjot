export const QUICKJOT_SERVICE = 'dshQuickjot';
export const QUICKJOT_SERVICE_CONTRACT_VERSION = 1;
export const EXPLICIT_USER_REQUEST = 'explicit-user-request';

const allowedKeys=new Set(['authorization','kind','title','body','tags','dueAt','idempotencyKey']);
const creationKeys=['kind','title','body','tags','dueAt'];
const failure=(code,message)=>({ok:false,error:{code,message}});

export function createQuickjotService(notebook) {
  return Object.freeze({
    contractVersion:QUICKJOT_SERVICE_CONTRACT_VERSION,
    list() {
      const {items,now,timeZone}=notebook.snapshot();
      return {ok:true,value:structuredClone({items,now,timeZone})};
    },
    async create(request) {
      if(!request || typeof request!=='object' || Array.isArray(request)) return failure('invalid-request','请求必须是对象');
      const unknown=Object.keys(request).filter(key=>!allowedKeys.has(key));
      if(unknown.length) return failure('invalid-request',`不支持的字段：${unknown.join(', ')}`);
      if(request.authorization!==EXPLICIT_USER_REQUEST) return failure('authorization-required','仅接受用户本人明确要求创建的事项');
      const key=request.idempotencyKey;
      if(key!==undefined && (typeof key!=='string' || !key.trim() || key.length>512)) return failure('invalid-idempotency-key','idempotencyKey 必须是 1–512 字符的非空字符串');
      const action={op:'create'};
      for(const field of creationKeys) if(Object.hasOwn(request,field)) action[field]=request[field];
      const token=key===undefined?undefined:`dshQuickjot:v${QUICKJOT_SERVICE_CONTRACT_VERSION}:${key}`;
      try {return {ok:true,value:structuredClone(await notebook.mutate(action,token))};}
      catch(error) {return failure('create-failed',error instanceof Error?error.message:String(error));}
    },
  });
}
