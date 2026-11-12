import { spawn } from 'node:child_process';
import { writeFileSync, rmSync } from 'node:fs';
import { setTimeout as sleep } from 'node:timers/promises';

const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const PORT = 9361, W = 1600, H = 900, DSF = 2;
rmSync('/tmp/chrome-promo-poster', { recursive: true, force: true });
const chrome = spawn(CHROME, ['--headless=new', `--remote-debugging-port=${PORT}`,
  '--force-device-scale-factor=1', `--window-size=${W},${H}`,
  '--user-data-dir=/tmp/chrome-promo-poster', '--hide-scrollbars',
  '--disable-lcd-text', '--font-render-hinting=none', '--no-first-run'], { stdio: 'ignore' });

let page;
for (let i = 0; i < 120; i++) {
  try {
    const j = await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json();
    page = j.find(t => t.type === 'page'); if (page) break;
  } catch {}
  await sleep(150);
}
const ws = new WebSocket(page.webSocketDebuggerUrl);
await new Promise(r => ws.addEventListener('open', r, { once: true }));
let id = 0; const pending = new Map();
ws.addEventListener('message', e => {
  const m = JSON.parse(e.data);
  if (m.id && pending.has(m.id)) { const p = pending.get(m.id); pending.delete(m.id); m.error ? p.rej(new Error(JSON.stringify(m.error))) : p.res(m.result); }
});
const send = (method, params = {}) => new Promise((res, rej) => { const mid = ++id; pending.set(mid, { res, rej }); ws.send(JSON.stringify({ id: mid, method, params })); });

await send('Page.enable');
await send('Emulation.setDeviceMetricsOverride', { width: W, height: H, deviceScaleFactor: DSF, mobile: false });
await send('Page.navigate', { url: 'file:///Users/snail/.dsh/im/promo/demo.html' });
await sleep(1500);
await send('Runtime.evaluate', { expression: `document.getElementById('cap').style.display='none'; window.renderAt(${process.argv[2] || 18.4})` });
await sleep(300);
const { data } = await send('Page.captureScreenshot', { format: 'png' });
writeFileSync(process.argv[3] || 'poster.png', Buffer.from(data, 'base64'));
ws.close(); chrome.kill('SIGKILL'); process.exit(0);
