import {mkdir,readFile,writeFile} from 'node:fs/promises';
await mkdir(new URL('./lib/',import.meta.url),{recursive:true});
for(const name of ['index','core','reminder-core','reminder-host','client']){
  let source=await readFile(new URL(`./src/${name}.mjs`,import.meta.url),'utf8');
  if(name==='client'){
    source=source.replace('/* CHAT_CONTROLLER */',(await readFile(new URL('./src/chat-controller.mjs',import.meta.url),'utf8')).replace(/^export /gm,''));
    source=source.replace('/* REMINDER_CLIENT */',await readFile(new URL('./src/reminder-client.mjs',import.meta.url),'utf8'));
  }
  await writeFile(new URL(`./lib/${name}.js`,import.meta.url),source.replace(/(['"]\.\/[^'"]+)\.mjs(['"])/g,'$1.js$2'));
}
console.log('Built host, core and native client entry points.');
