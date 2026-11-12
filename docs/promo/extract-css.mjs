import { readFileSync, writeFileSync } from 'node:fs';
const src = readFileSync('../dsh-calendar/src/client.mjs','utf8');
const rem = readFileSync('../dsh-calendar/src/reminder-client.mjs','utf8');
const all = src + '\n' + rem;
const want = ['css','agendaCss','writingCss','chatCss','tagsCss','reminderCss'];
let out = '/* CSS lifted verbatim from dsh-calendar v2.1.0 src/client.mjs + src/reminder-client.mjs */\n';
for (const name of want) {
  const re = new RegExp('const ' + name + '\\s*=\\s*`([\\s\\S]*?)`;');
  const m = re.exec(all);
  if (!m) { console.error('MISS', name); continue; }
  out += `\n/* ---- ${name} ---- */\n` + m[1] + '\n';
}
writeFileSync('plugin.css', out);
console.log('plugin.css', out.length, 'chars');
