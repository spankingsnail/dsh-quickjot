// Refresh the Chinese UI resource dictionary after editing literal translation calls.
import {readFile,writeFile} from 'node:fs/promises';
const file=new URL('./src/client.mjs',import.meta.url);let source=await readFile(file,'utf8');
const messages={};
for(const match of source.matchAll(/\bt\(("(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*')\)/g)){
  const text=match[1].startsWith('"')?JSON.parse(match[1]):match[1].slice(1,-1);
  messages[text]=text;
}
source=source.replace(/  const messages=.*;\n/,`  const messages=${JSON.stringify(messages)};\n`);
await writeFile(file,source);
