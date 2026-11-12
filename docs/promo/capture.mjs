import { spawn } from 'node:child_process';
import { mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { setTimeout as sleep } from 'node:timers/promises';

const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const PORT = 9344;
const OUT = new URL('./frames/', import.meta.url).pathname;
const W = 1600, H = 900, DSF = 2;

const times = process.argv.slice(2).map(Number);
const list = times.length ? times : [1.5, 4.5, 7.6, 11.5, 16.5, 20.5, 26.5, 30.5, 35.5, 43];

mkdirSync(OUT, { recursive: true });
rmSync('/tmp/chrome-promo-frame', { recursive: true, force: true });

const chrome = spawn(CHROME, [
  '--headless=new', `--remote-debugging-port=${PORT}`,
  '--force-device-scale-factor=1', `--window-size=${W},${H}`,
  '--user-data-dir=/tmp/chrome-promo-frame',
  '--hide-scrollbars', '--disable-lcd-text', '--font-render-hinting=none',
  '--no-first-run', '--no-default-browser-check',
], { stdio: 'ignore' });

let ws;
async function targets() {
  for (let i = 0; i < 80; i++) {
    try {
      const r = await fetch(`http://127.0.0.1:${PORT}/json/list`);
      const j = await r.json();
      const pg = j.find(t => t.type === 'page');
      if (pg) return pg;
    } catch {}
    await sleep(150);
  }
  throw new Error('chrome not ready');
}

let id = 0;
const pending = new Map();
function send(method, params = {}) {
  const mid = ++id;
  return new Promise((res, rej) => {
    pending.set(mid, { res, rej });
    ws.send(JSON.stringify({ id: mid, method, params }));
  });
}

const page = await targets();
ws = new WebSocket(page.webSocketDebuggerUrl);
await new Promise(r => ws.addEventListener('open', r, { once: true }));
ws.addEventListener('message', ev => {
  const m = JSON.parse(ev.data);
  if (m.id && pending.has(m.id)) {
    const { res, rej } = pending.get(m.id);
    pending.delete(m.id);
    m.error ? rej(new Error(JSON.stringify(m.error))) : res(m.result);
  }
});

await send('Page.enable');
await send('Emulation.setDeviceMetricsOverride', {
  width: W, height: H, deviceScaleFactor: DSF, mobile: false,
});
const file = new URL('./demo.html', import.meta.url).href;
await send('Page.navigate', { url: file });
await sleep(1400);

for (const t of list) {
  await send('Runtime.evaluate', { expression: `window.renderAt(${t})`, awaitPromise: false });
  await sleep(220);
  const { data } = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false });
  const name = `f_${t.toFixed(2).padStart(5, '0')}.png`;
  writeFileSync(OUT + name, Buffer.from(data, 'base64'));
  console.log('wrote', name);
}

ws.close();
chrome.kill('SIGKILL');
process.exit(0);
