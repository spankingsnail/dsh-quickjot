import { spawn } from 'node:child_process';
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { setTimeout as sleep } from 'node:timers/promises';

const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const PORT = 9351;
const W = 1600, H = 900, DSF = 2;
const FPS = 30;
const TOTAL = 45.5;
const OUTDIR = '/tmp/promo-frames';

rmSync(OUTDIR, { recursive: true, force: true });
mkdirSync(OUTDIR, { recursive: true });
rmSync('/tmp/chrome-promo-render', { recursive: true, force: true });

const chrome = spawn(CHROME, [
  '--headless=new', `--remote-debugging-port=${PORT}`,
  '--force-device-scale-factor=1', `--window-size=${W},${H}`,
  '--user-data-dir=/tmp/chrome-promo-render',
  '--hide-scrollbars', '--disable-lcd-text', '--font-render-hinting=none',
  '--no-first-run', '--no-default-browser-check',
  '--disable-background-timer-throttling', '--disable-renderer-backgrounding',
  '--force-color-profile=srgb',
], { stdio: 'ignore' });

async function findTarget() {
  for (let i = 0; i < 120; i++) {
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

const page = await findTarget();
const ws = new WebSocket(page.webSocketDebuggerUrl);
await new Promise(r => ws.addEventListener('open', r, { once: true }));

let id = 0;
const pending = new Map();
ws.addEventListener('message', ev => {
  const m = JSON.parse(ev.data);
  if (m.id && pending.has(m.id)) {
    const { res, rej } = pending.get(m.id);
    pending.delete(m.id);
    m.error ? rej(new Error(JSON.stringify(m.error))) : res(m.result);
  }
});
function send(method, params = {}) {
  const mid = ++id;
  return new Promise((res, rej) => {
    pending.set(mid, { res, rej });
    ws.send(JSON.stringify({ id: mid, method, params }));
  });
}

await send('Page.enable');
await send('Emulation.setDeviceMetricsOverride', {
  width: W, height: H, deviceScaleFactor: DSF, mobile: false,
});
await send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'no-preference' }] });

const file = new URL('./demo.html', import.meta.url).href;
await send('Page.navigate', { url: file });
await sleep(1600);

const ff = spawn('/opt/homebrew/bin/ffmpeg', [
  '-y', '-f', 'image2pipe', '-framerate', String(FPS), '-c:v', 'png', '-i', '-',
  '-vf', 'scale=1920:1080:flags=lanczos,format=yuv420p',
  '-c:v', 'libx264', '-preset', 'slow', '-crf', '18',
  '-profile:v', 'high', '-level', '4.2', '-tune', 'animation',
  '-movflags', '+faststart', '-an',
  new URL('./dsh-calendar-promo.mp4', import.meta.url).pathname,
], { stdio: ['pipe', 'inherit', 'inherit'] });

const total = Math.round(TOTAL * FPS);
const t0 = Date.now();
for (let i = 0; i < total; i++) {
  const t = i / FPS;
  await send('Runtime.evaluate', { expression: `window.renderAt(${t})` });
  const { data } = await send('Page.captureScreenshot', { format: 'png', optimizeForSpeed: true });
  const buf = Buffer.from(data, 'base64');
  if (!ff.stdin.write(buf)) await new Promise(r => ff.stdin.once('drain', r));
  if (i % 90 === 0) {
    const el = (Date.now() - t0) / 1000;
    process.stdout.write(`\rframe ${i}/${total}  ${el.toFixed(0)}s elapsed  eta ${(el / (i + 1) * (total - i - 1)).toFixed(0)}s   `);
  }
}
ff.stdin.end();
await new Promise((res, rej) => ff.on('close', c => c === 0 ? res() : rej(new Error('ffmpeg exit ' + c))));
ws.close();
chrome.kill('SIGKILL');
console.log('\ndone in', ((Date.now() - t0) / 1000).toFixed(1), 's');
process.exit(0);
