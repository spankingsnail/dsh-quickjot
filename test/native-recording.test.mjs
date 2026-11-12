// Native tests are strictly offline: no real --mode invocation, devices or permission APIs.
import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync, readdirSync, realpathSync, rmSync, symlinkSync } from 'node:fs';
import { dirname, join, resolve, basename, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const plugin = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const native = join(plugin, 'native');
const binary = join(native, 'recorder');
const available = process.platform === 'darwin' && existsSync(binary);
const reason = available ? false : 'Build macOS helper with sh native/build-helper.sh first (no capture is started)';
let root;
let fixture;
function temporary(name) {
  if (!root) {
    mkdirSync(join(native, '.build'), { recursive: true });
    root = mkdtempSync(join(native, '.build', 'native-recording-'));
  }
  const path = join(root, name);
  mkdirSync(path);
  return path;
}
function invoke(args) {
  return spawnSync(binary, args, { cwd: plugin, encoding: 'utf8', timeout: 15_000, maxBuffer: 1024 * 1024 });
}
function events(result) {
  return result.stdout.trim().split('\n').filter(Boolean).map(line => JSON.parse(line));
}
function offline() {
  if (!fixture) {
    const directory = temporary('synthetic');
    const result = invoke(['--self-test', '--output', directory]);
    assert.ifError(result.error);
    assert.equal(result.status, 0, result.stdout + result.stderr);
    fixture = { directory, result, events: events(result) };
  }
  return fixture;
}
after(() => {
  if (!root) return;
  // Verify the actual absolute deletion target before removing only this test's files.
  const actual = realpathSync(root);
  const expectedParent = realpathSync(join(native, '.build'));
  assert.equal(dirname(actual), expectedParent);
  assert.ok(basename(actual).startsWith('native-recording-'));
  assert.ok(actual.startsWith(expectedParent + sep));
  rmSync(actual, { recursive: true, force: false });
});

test('native offline self-test emits keyed track evidence and successful stopped', { skip: reason }, () => {
  const data = offline();
  assert.deepEqual(data.events.map(event => event.event), ['ready', 'paused', 'resumed', 'stats', 'stopped']);
  for (const event of data.events) {
    assert.deepEqual(Object.keys(event.tracks).sort(), ['microphone', 'system']);
    for (const track of Object.values(event.tracks)) {
      for (const field of ['frames', 'bytes', 'sourceFrames', 'sampleBuffers', 'peak', 'nonSilentFrames']) {
        assert.equal(typeof track[field], 'number', field);
        assert.ok(Number.isFinite(track[field]) && track[field] >= 0);
      }
      assert.equal(track.sampleRate, 16_000);
      assert.equal(track.channels, 1);
      assert.equal(typeof track.noSamples, 'boolean');
      assert.equal(typeof track.silent, 'boolean');
      assert.equal(track.bytes, track.frames * 2, 'JSON bytes excludes 44-byte header');
    }
  }
  const stopped = data.events.at(-1);
  assert.equal(stopped.ok, true);
  assert.equal(stopped.selfTestPassed, true);
  assert.equal(stopped.durationMs, 1000);
  assert.equal(stopped.tracks.microphone.sourceFrames, 44_100);
  assert.equal(stopped.tracks.system.sourceFrames, 46_560); // delayed first 30ms, pause excluded
  assert.equal(stopped.tracks.microphone.noSamples, false);
  assert.equal(stopped.tracks.system.noSamples, false);
  assert.deepEqual(stopped.frequencies, { microphone: 440, system: 880 });
});

test('offline tracks are independently readable PCM16 mono 16k WAV with common timeline', { skip: reason }, () => {
  const data = offline();
  assert.deepEqual(readdirSync(data.directory).sort(), ['microphone.wav', 'system.wav']);
  const buffers = {};
  for (const name of ['microphone', 'system']) {
    const wav = readFileSync(join(data.directory, `${name}.wav`));
    buffers[name] = wav;
    assert.equal(wav.length, 32_044);
    assert.equal(wav.toString('ascii', 0, 4), 'RIFF');
    assert.equal(wav.readUInt32LE(4), wav.length - 8);
    assert.equal(wav.toString('ascii', 8, 16), 'WAVEfmt ');
    assert.equal(wav.readUInt32LE(16), 16);
    assert.equal(wav.readUInt16LE(20), 1);
    assert.equal(wav.readUInt16LE(22), 1);
    assert.equal(wav.readUInt32LE(24), 16_000);
    assert.equal(wav.readUInt32LE(28), 32_000);
    assert.equal(wav.readUInt16LE(32), 2);
    assert.equal(wav.readUInt16LE(34), 16);
    assert.equal(wav.toString('ascii', 36, 40), 'data');
    assert.equal(wav.readUInt32LE(40), 32_000);
    const samples = Array.from({ length: 16_000 }, (_, index) => wav.readInt16LE(44 + index * 2));
    const peak = Math.max(...samples.map(Math.abs));
    assert.ok(peak > 8000 && peak < 30_000);
    let crossings = 0;
    for (let frame = 801; frame < 5600; frame++) if (samples[frame - 1] <= 0 && samples[frame] > 0) crossings++;
    assert.ok(Math.abs(crossings * 16_000 / 4800 - (name === 'system' ? 880 : 440)) < 8);
    if (name === 'system') assert.ok(samples.slice(0, 480).every(sample => sample === 0), 'delayed source is padded, not rebased');
  }
  assert.notDeepEqual(buffers.microphone.subarray(44), buffers.system.subarray(44));
});

test('offline pause excludes source samples and adds no paused payload', { skip: reason }, () => {
  const { events } = offline();
  const paused = events.find(event => event.event === 'paused');
  const resumed = events.find(event => event.event === 'resumed');
  assert.equal(paused.durationMs, 400);
  assert.equal(resumed.durationMs, 400);
  for (const name of ['microphone', 'system']) {
    assert.equal(paused.tracks[name].frames, 6400, 'pause freezes both tracks at exactly the shared boundary');
    assert.equal(paused.tracks[name].bytes, resumed.tracks[name].bytes);
    assert.equal(paused.tracks[name].sourceFrames, resumed.tracks[name].sourceFrames);
    assert.ok(paused.tracks[name].peak > 0);
  }
});

test('offline helper refuses nonempty output without overwriting', { skip: reason }, () => {
  const directory = temporary('nonempty');
  writeFileSync(join(directory, 'sentinel'), 'keep');
  const result = invoke(['--self-test', '--output', directory]);
  assert.equal(result.status, 1);
  assert.equal(events(result)[0].event, 'error');
  assert.match(events(result)[0].message, /empty/);
  assert.equal(readFileSync(join(directory, 'sentinel'), 'utf8'), 'keep');
  assert.deepEqual(readdirSync(directory), ['sentinel']);
});

test('offline helper refuses symlink directory including trailing slash', { skip: reason }, () => {
  const directory = temporary('symlink-target');
  const link = join(root, 'symlink-output');
  symlinkSync(directory, link, 'dir');
  for (const candidate of [link, link + '/']) {
    const result = invoke(['--self-test', '--output', candidate]);
    assert.equal(result.status, 1, result.stdout);
    assert.equal(events(result)[0].event, 'error');
    assert.deepEqual(readdirSync(directory), []);
  }
});

test('argument failures never enter capture path', { skip: reason }, () => {
  for (const args of [[], ['--self-test'], ['--self-test', '--output', 'relative-path'], ['--mode', 'invalid'], ['--self-test', '--self-test']]) {
    const result = invoke(args);
    assert.ifError(result.error);
    assert.equal(result.status, 1);
    assert.deepEqual(events(result).map(event => event.event), ['error']);
  }
});
