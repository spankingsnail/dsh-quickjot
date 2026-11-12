import {mkdir,lstat,realpath,open,unlink,rmdir,chmod} from 'node:fs/promises';
import {constants} from 'node:fs';
import {resolve,join,dirname} from 'node:path';
import {Readable} from 'node:stream';

const names=['microphone','system'];
const idPattern=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const missing=error=>error?.code==='ENOENT';
export class RecordingFiles{
  constructor(root){this.root=resolve(root);}
  directory(id){if(!idPattern.test(id))throw Error('无效的录音编号。');const directory=resolve(this.root,id);if(dirname(directory)!==this.root)throw Error('录音路径越界。');return directory;}
  trackPath(id,name){if(!names.includes(name))throw Error('未知音轨。');return join(this.directory(id),name+'.wav');}
  async checkRoot(create=false){
    if(create)await mkdir(this.root,{recursive:true,mode:0o700});
    const info=await lstat(this.root);if(!info.isDirectory()||info.isSymbolicLink()||await realpath(this.root)!==this.root)throw Error('录音目录必须是本地真实目录，不能为符号链接。');
    if(create)await chmod(this.root,0o700);
  }
  async checkDirectory(id){await this.checkRoot();const directory=this.directory(id),info=await lstat(directory);if(!info.isDirectory()||info.isSymbolicLink()||await realpath(directory)!==directory)throw Error('录音目录已改变，已拒绝访问。');return directory;}
  async create(id){await this.checkRoot(true);const directory=this.directory(id);await mkdir(directory,{mode:0o700});return directory;}
  async openTrack(id,name,flags=constants.O_RDONLY){
    await this.checkDirectory(id);const path=this.trackPath(id,name);
    const handle=await open(path,flags|constants.O_NOFOLLOW);
    try{const stat=await handle.stat();if(!stat.isFile())throw Error('音轨不是普通文件。');return {handle,stat,path};}catch(error){await handle.close();throw error;}
  }
  async inspect(id,repair=false,stats={}){
    await this.checkDirectory(id);const tracks={};
    for(const name of names){
      let opened;try{opened=await this.openTrack(id,name,repair?constants.O_RDWR:constants.O_RDONLY);}catch(error){if(missing(error))continue;throw error;}
      const {handle,stat}=opened;
      try{
        await chmod(opened.path,0o600);
        if(stat.size<44)continue;
        const header=Buffer.alloc(44);await handle.read(header,0,44,0);
        if(header.toString('ascii',0,4)!=='RIFF'||header.toString('ascii',8,12)!=='WAVE'||header.toString('ascii',12,16)!=='fmt '||header.readUInt32LE(16)!==16||header.readUInt16LE(20)!==1||header.readUInt16LE(22)!==1||header.readUInt32LE(24)!==16000||header.readUInt32LE(28)!==32000||header.readUInt16LE(32)!==2||header.readUInt16LE(34)!==16||header.toString('ascii',36,40)!=='data')throw Error('音轨不是支持的 PCM16 单声道 16kHz WAV。');
        const bytes=Math.floor((stat.size-44)/2)*2;if(bytes>0xffffffff-36)throw Error('音轨超过 WAV 大小限制。');
        if(repair){if(stat.size!==44+bytes)await handle.truncate(44+bytes);header.writeUInt32LE(36+bytes,4);header.writeUInt32LE(bytes,40);await handle.write(header,0,44,0);await handle.sync();}
        let peak=0;const buffer=Buffer.alloc(128*1024);for(let position=44;position<44+bytes;){const size=Math.min(buffer.length,44+bytes-position),{bytesRead}=await handle.read(buffer,0,size,position);if(!bytesRead)throw Error('音轨读取不完整。');for(let n=0;n+1<bytesRead;n+=2)peak=Math.max(peak,Math.abs(buffer.readInt16LE(n))/32768);position+=bytesRead;}
        const frames=bytes/2,source=stats[name]?.sourceFrames;
        tracks[name]={bytes:44+bytes,frames,sampleRate:16000,channels:1,durationMs:frames/16,peak,hasSignal:peak>0.0001,sourceFrames:Number.isSafeInteger(source)&&source>=0?source:null};
      }finally{await handle.close();}
    }
    return tracks;
  }
  async remove(id){
    let directory;try{directory=await this.checkDirectory(id);}catch(error){if(missing(error))return;throw error;}
    // The resolved target is the exact UUID directory just verified above. Never recurse.
    if(directory!==this.directory(id)||dirname(directory)!==this.root)throw Error('拒绝删除非录音目录。');
    for(const name of names){const target=this.trackPath(id,name);try{const stat=await lstat(target);if(!stat.isFile()||stat.isSymbolicLink())throw Error('音轨路径已改变，未删除。');await unlink(target);}catch(error){if(!missing(error))throw error;}}
    await rmdir(directory); // Unexpected files keep the directory and produce an explicit error.
  }
  async response(request,id,name,title){
    const {handle,stat}=await this.openTrack(id,name);let handedOff=false;
    try{
      const size=stat.size;if(size<44)throw Error('音轨尚未完成，无法播放。');
      const headers={'content-type':'audio/wav','cache-control':'no-store','accept-ranges':'bytes','x-content-type-options':'nosniff'};
      if(new URL(request.url).searchParams.get('download')==='1'){const safe=String(title||'recording').replace(/[\r\n"\\/]/g,'_').slice(0,120)+'-'+name+'.wav';headers['content-disposition']=`attachment; filename="recording-${name}.wav"; filename*=UTF-8''${encodeURIComponent(safe)}`;}
      let start=0,end=size-1,status=200;const range=request.headers.get('range');
      if(range){const match=/^bytes=(\d*)-(\d*)$/.exec(range);let valid=Boolean(match&&(match[1]||match[2]));if(valid){if(!match[1]){const suffix=Number(match[2]);valid=Number.isSafeInteger(suffix)&&suffix>0;start=Math.max(0,size-suffix);}else{start=Number(match[1]);end=match[2]?Math.min(size-1,Number(match[2])):size-1;valid=Number.isSafeInteger(start)&&Number.isSafeInteger(end)&&start<=end&&start<size;}}if(!valid)return new Response(null,{status:416,headers:{...headers,'content-range':`bytes */${size}`}});status=206;headers['content-range']=`bytes ${start}-${end}/${size}`;}
      headers['content-length']=String(end-start+1);
      if(request.method==='HEAD')return new Response(null,{status,headers});
      const stream=handle.createReadStream({start,end,autoClose:true});handedOff=true;
      const abort=()=>stream.destroy();request.signal?.addEventListener('abort',abort,{once:true});stream.once('close',()=>request.signal?.removeEventListener('abort',abort));
      return new Response(Readable.toWeb(stream),{status,headers});
    }finally{if(!handedOff)await handle.close();}
  }
}
