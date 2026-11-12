import { readFileSync, writeFileSync } from 'node:fs';
const read = p => readFileSync(new URL(p, import.meta.url), 'utf8');
const src = read('../../src/client.mjs');
const rem = read('../../src/reminder-client.mjs');
const all = src + '\n' + rem;
const want = ['css','agendaCss','writingCss','chatCss','tagsCss','reminderCss'];
let out = '/* CSS lifted verbatim from dsh-quickjot v3.0.0 src/client.mjs + src/reminder-client.mjs */\n';
for (const name of want) {
  const re = new RegExp('const ' + name + '\\s*=\\s*`([\\s\\S]*?)`;');
  const m = re.exec(all);
  if (!m) { console.error('MISS', name); continue; }
  out += `\n/* ---- ${name} ---- */\n` + m[1] + '\n';
}
writeFileSync('plugin.css', out);
console.log('plugin.css', out.length, 'chars');
