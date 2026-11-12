import {mkdir,readFile,writeFile} from 'node:fs/promises';
await mkdir(new URL('./lib/',import.meta.url),{recursive:true});
for(const name of ['index','core','meeting-core','meeting-analysis','meeting-host','recording-core','recording-files','recording-host','reminder-core','reminder-host','client']){
  let source=await readFile(new URL(`./src/${name}.mjs`,import.meta.url),'utf8');
  if(name==='client'){
    source=source.replace('/* CHAT_CONTROLLER */',(await readFile(new URL('./src/chat-controller.mjs',import.meta.url),'utf8')).replace(/^export /gm,''));
    source=source.replace('/* RECORDING_CLIENT */',await readFile(new URL('./src/recording-client.mjs',import.meta.url),'utf8'));
    source=source.replace('/* MEETING_CLIENT */',await readFile(new URL('./src/meeting-client.mjs',import.meta.url),'utf8'));
    source=source.replace('/* REMINDER_CLIENT */',await readFile(new URL('./src/reminder-client.mjs',import.meta.url),'utf8'));
  }
  await writeFile(new URL(`./lib/${name}.js`,import.meta.url),source.replace(/(['"]\.\/[^'"]+)\.mjs(['"])/g,'$1.js$2'));
}
console.log('Built host, core and native client entry points.');
