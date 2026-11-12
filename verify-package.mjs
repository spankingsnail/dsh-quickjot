import {readFile,stat,lstat,readdir,realpath,mkdir,cp} from 'node:fs/promises';
import {resolve,dirname,relative,join,isAbsolute} from 'node:path';
import {execFileSync} from 'node:child_process';
import {pathToFileURL} from 'node:url';
const root=process.cwd(),manifest=JSON.parse(await readFile('package.json','utf8'));
async function checkLinks(dir){for(const name of await readdir(dir)){const file=join(dir,name),s=await lstat(file);if(s.isSymbolicLink()){const resolved=await realpath(file);const r=relative(root,resolved);if(r.startsWith('..')||isAbsolute(r))throw Error('External symlink: '+file);}else if(s.isDirectory())await checkLinks(file);}}
await checkLinks(root);
const artifact=join(root,'.artifacts',manifest.name.replace('@','').replaceAll('/','-')+'-'+manifest.version+'.tgz');
await stat(artifact);
const listing=execFileSync('tar',['-tzf',artifact],{encoding:'utf8'}).trim().split('\n');
for(const required of ['package/package.json','package/cordis.patch.yml','package/lib/core.js','package/lib/index.js','package/lib/client.js','package/locale/zh.json','package/locale/en.json','package/icon.svg','package/LICENSE','package/THIRD_PARTY_NOTICES.md','package/VERIFICATION.md'])if(!listing.includes(required))throw Error('Missing packed file: '+required);
if(listing.some(s=>s.includes('/src/')||s.includes('/test/')))throw Error('Source/test leaked into pack');
const out=join(root,'.artifacts','portable');await mkdir(out,{recursive:true});execFileSync('tar',['-xzf',artifact,'-C',out]);
// Materialize the declared runtime dependency as an installer would. Never link back to the source package.
const dependency=await realpath(join(root,'node_modules/zod'));await mkdir(join(out,'package/node_modules'),{recursive:true});await cp(dependency,join(out,'package/node_modules/zod'),{recursive:true,dereference:true});
const loaded=await import(pathToFileURL(join(out,'package/lib/index.js')).href);if(typeof loaded.apply!=='function')throw Error('Packed host entry is not loadable');
const core=await import(pathToFileURL(join(out,'package/lib/core.js')).href);if(core.parseShanghai('2030-01-01T08:30')!=='2030-01-01T00:30:00.000Z')throw Error('Packed core failed');
execFileSync(process.execPath,['--check',join(out,'package/lib/client.js')]);
await checkLinks(out);console.log('Packed files:',listing.join(', '));console.log('PASS: all symlinks stay inside package; exported packed host/core import and client syntax work in a source-free copy with materialized declared dependency.');
