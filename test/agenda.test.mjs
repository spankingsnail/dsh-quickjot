import test from 'node:test';
import assert from 'node:assert/strict';
import {
  agendaDate, shiftAgendaDay, selectAgenda, agendaViewKey,
  readAgendaView, writeAgendaView, captureAgendaPosition, restoreAgendaPosition,
} from '../src/agenda.mjs';

const TODAY = '2030-01-30';
const STORE_KEY = 'synthetic-agenda-view';
const ids = items => items.map(item => item.id);
const event = (id, dueAt, extra = {}) => ({
  id, kind: 'event', title: `Synthetic ${id}`, body: '', tags: [], done: false, dueAt, ...extra,
});

// Entirely synthetic: 20 previous days, today, and 79 following days, across months.
function hundredEvents() {
  return Array.from({length: 100}, (_, index) => {
    const date = new Date(Date.UTC(2030, 0, 10 + index)).toISOString().slice(0, 10);
    return event(`event-${String(index).padStart(3, '0')}`, `${date}T09:00:00+08:00`, {done: index % 9 === 0});
  });
}

function memoryStorage(value) {
  const values = new Map(value === undefined ? [] : [[STORE_KEY, value]]);
  return {
    getItem: key => values.get(key) ?? null,
    setItem: (key, text) => { values.set(key, text); },
  };
}

function defaultView(today = TODAY) {
  return {date: today, tab: 'event', mode: 'upcoming', day: '', month: today.slice(0, 7), showCompleted: false, search: '', positions: {}};
}

// Coordinates move with scrollTop, like a real scroll container, without a DOM/browser.
function fakeScrollRoot({top = 100, scrollTop = 0, navHeight = 40, items = []} = {}) {
  const root = {
    scrollTop,
    getBoundingClientRect: () => ({top, bottom: top + 300}),
    querySelector: selector => {
      assert.equal(selector, '.ssj-nav');
      return navHeight === null ? null : {getBoundingClientRect: () => ({top, bottom: top + navHeight})};
    },
    querySelectorAll: selector => {
      assert.equal(selector, '[data-agenda-item]');
      return items.map(item => ({
        getAttribute: name => { assert.equal(name, 'data-agenda-item'); return item.id; },
        getBoundingClientRect: () => ({top: top + item.y - root.scrollTop, bottom: top + item.y + item.height - root.scrollTop}),
      }));
    },
  };
  return root;
}

test('agendaDate uses Shanghai dates at UTC, month, and year boundaries', () => {
  for (const [instant, expected] of [
    ['2030-01-30T15:59:59.999Z', '2030-01-30'],
    ['2030-01-30T16:00:00.000Z', '2030-01-31'],
    ['2030-01-31T16:00:00.000Z', '2030-02-01'],
    ['2029-12-31T16:00:00.000Z', '2030-01-01'],
    ['2030-01-30T23:59:00-08:00', '2030-01-31'],
  ]) assert.equal(agendaDate(instant), expected);
  assert.equal(agendaDate(Date.parse('2030-01-30T16:00:00Z')), '2030-01-31');
  assert.equal(agendaDate(new Date('2030-01-30T16:00:00Z')), '2030-01-31');
  assert.equal(agendaDate('not-a-date'), '');
});

test('shiftAgendaDay handles positive, negative, leap-year and year offsets', () => {
  for (const [day, delta, expected] of [
    [TODAY, 0, TODAY], [TODAY, 7, '2030-02-06'],
    ['2030-03-01', -1, '2030-02-28'], ['2032-02-28', 1, '2032-02-29'],
    ['2032-02-29', 1, '2032-03-01'], ['2030-01-01', -1, '2029-12-31'],
  ]) assert.equal(shiftAgendaDay(day, delta), expected);
});

test('100 events: upcoming is the default, crosses months, and isolates old incomplete items', () => {
  const source = hundredEvents();
  const result = selectAgenda([...source].reverse(), {today: TODAY});
  const upcoming = source.filter((item, index) => index >= 20 && !item.done);
  const overdue = source.filter((item, index) => index < 20 && !item.done);
  assert.equal(source.length, 100);
  assert.deepEqual(ids(result.items), ids(upcoming));
  assert.deepEqual(ids(result.overdue), ids(overdue));
  assert.equal(result.items.length, 71);
  assert.equal(result.overdue.length, 17);
  assert.ok(result.items.some(item => item.dueAt.startsWith('2030-02')));
  assert.ok(result.items.some(item => item.dueAt.startsWith('2030-04')));
  assert.deepEqual(result.groups.flatMap(group => group.items), result.items);
  assert.deepEqual(result.groups.map(group => group.date), upcoming.map(item => item.dueAt.slice(0, 10)));
  assert.ok(result.overdue.every(item => !result.items.includes(item)));
});

test('overdue is based on the past Shanghai date, not an earlier clock time today', () => {
  const previous = event('previous', '2030-01-29T15:59:59Z');
  const midnight = event('midnight', '2030-01-29T16:00:00Z');
  const early = event('early', '2030-01-30T00:01:00+08:00');
  const late = event('late', '2030-01-30T23:59:00+08:00');
  const result = selectAgenda([late, early, previous, midnight], {today: TODAY});
  assert.deepEqual(ids(result.items), ['midnight', 'early', 'late']);
  assert.deepEqual(ids(result.overdue), ['previous']);
  assert.deepEqual(result.groups.map(group => group.date), [TODAY]);
});

test('completed items require explicit showCompleted; old completed items never enter overdue', () => {
  const source = hundredEvents();
  const hidden = selectAgenda(source, {today: TODAY});
  const shown = selectAgenda(source, {today: TODAY, showCompleted: true});
  assert.ok(hidden.items.every(item => !item.done));
  assert.deepEqual(ids(shown.items), ids(source.slice(20)));
  assert.equal(shown.items.length, 80);
  assert.deepEqual(shown.overdue, hidden.overdue);
  assert.ok(shown.overdue.every(item => !item.done));
  const oldDay = selectAgenda(source, {today: TODAY, mode: 'day', day: '2030-01-10', showCompleted: true});
  assert.deepEqual(ids(oldDay.items), ['event-000']);
});

test('week includes today and the next six Shanghai dates, including the month boundary', () => {
  const source = hundredEvents();
  const result = selectAgenda(source, {today: TODAY, mode: 'week', showCompleted: true});
  assert.deepEqual(ids(result.items), ids(source.slice(20, 27)));
  assert.equal(result.groups.length, 7);
  assert.equal(result.groups[0].date, TODAY);
  assert.equal(result.groups.at(-1).date, '2030-02-05');
  assert.deepEqual(result.overdue, []);
  assert.deepEqual(ids(selectAgenda(source, {today: TODAY, mode: 'week'}).items), ids(source.slice(20, 27).filter(item => !item.done)));
});

test('day and month modes select their explicit ranges, including dates before today', () => {
  const source = hundredEvents();
  const day = selectAgenda(source, {today: TODAY, mode: 'day', day: '2030-01-15', showCompleted: true});
  assert.deepEqual(ids(day.items), ['event-005']);
  assert.deepEqual(day.overdue, []);
  const month = selectAgenda(source, {today: TODAY, mode: 'month', month: '2030-02', showCompleted: true});
  assert.equal(month.items.length, 28);
  assert.equal(month.groups[0].date, '2030-02-01');
  assert.equal(month.groups.at(-1).date, '2030-02-28');
  assert.deepEqual(month.overdue, []);
  const january = selectAgenda(source, {today: TODAY, mode: 'month', month: '2030-01', showCompleted: true});
  assert.equal(january.items.length, 22);
  assert.deepEqual(selectAgenda(source, {today: TODAY, mode: 'day', day: '2040-01-01'}), {items: [], overdue: [], groups: []});
});

test('search trims and folds case across title, body, and tags, including overdue', () => {
  const source = [
    event('title', '2030-02-01T00:00:00Z', {title: 'RoadMAP review'}),
    event('body', '2030-02-02T00:00:00Z', {body: 'Discuss RoadMap risks'}),
    event('tags', '2030-02-03T00:00:00Z', {tags: ['团队', 'ROADmap']}),
    event('old', '2030-01-01T00:00:00Z', {tags: ['roadmap']}),
    event('done', '2030-02-04T00:00:00Z', {title: 'roadmap', done: true}),
    event('other', '2030-02-05T00:00:00Z'),
    {...event('todo', '2030-02-01T00:00:00Z', {title: 'roadmap'}), kind: 'todo'},
    {...event('note', '2030-02-01T00:00:00Z', {title: 'roadmap'}), kind: 'note'},
  ];
  const result = selectAgenda(source, {today: TODAY, search: '  rOaDmAp  '});
  assert.deepEqual(ids(result.items), ['title', 'body', 'tags']);
  assert.deepEqual(ids(result.overdue), ['old']);
  assert.deepEqual(ids(selectAgenda(source, {today: TODAY, search: '团队'}).items), ['tags']);
  assert.deepEqual(ids(selectAgenda(source, {today: TODAY, search: 'roadmap', showCompleted: true}).items), ['title', 'body', 'tags', 'done']);
  assert.deepEqual(selectAgenda(source, {today: TODAY, search: 'missing'}), {items: [], overdue: [], groups: []});
  assert.deepEqual(ids(selectAgenda(source, {today: TODAY, search: '   '}).items), ['title', 'body', 'tags', 'other']);
});

test('sorting is deterministic by timestamp then id and never mutates the input or its records', () => {
  const a = event('a', '2030-01-30T09:00:00+08:00');
  const z = event('z', '2030-01-30T01:00:00Z');
  const early = event('early', '2030-01-30T00:00:00Z');
  const source = [z, a, early];
  const before = structuredClone(source);
  for (const item of source) { Object.freeze(item.tags); Object.freeze(item); }
  Object.freeze(source);
  const result = selectAgenda(source, {today: TODAY});
  assert.deepEqual(ids(result.items), ['early', 'a', 'z']);
  assert.deepEqual(source, before);
  assert.strictEqual(result.items[0], early);
  assert.strictEqual(result.items[1], a);
  assert.deepEqual(ids(selectAgenda([a, early, z], {today: TODAY}).items), ids(result.items));
  const identical = [event('same', a.dueAt, {title: 'first'}), event('same', a.dueAt, {title: 'second'})];
  assert.deepEqual(selectAgenda(identical, {today: TODAY}).items.map(item => item.title), ['first', 'second']);
});

test('invalid or missing dueAt is excluded from both visible events and overdue', () => {
  const invalid = [null, undefined, '', 'not-a-date', '2030-13-01T00:00:00Z'];
  const valid = event('valid', '2030-01-30T01:00:00Z');
  const result = selectAgenda([valid, ...invalid.map((dueAt, index) => event(`invalid-${index}`, dueAt))], {today: TODAY, showCompleted: true});
  assert.deepEqual(ids(result.items), ['valid']);
  assert.deepEqual(result.overdue, []);
});

test('agendaViewKey separates tabs, modes, ranges, completion and search without delimiter collisions', () => {
  const base = {tab: 'event', mode: 'upcoming', day: '', month: '2030-01', showCompleted: false, search: ''};
  const variants = [base, {...base, tab: 'todo'}, {...base, tab: 'note'}, {...base, mode: 'week'}, {...base, mode:'day',day: TODAY}, {...base, mode:'month',month: '2030-02'}, {...base, showCompleted: true}, {...base, search: 'review'}];
  assert.equal(new Set(variants.map(agendaViewKey)).size, variants.length);
  assert.equal(agendaViewKey({...base, showCompleted: undefined}), agendaViewKey(base));
  assert.notEqual(agendaViewKey({...base, mode:'day',day: 'a|b', search: 'c'}), agendaViewKey({...base, mode:'day',day: 'a', search: 'b|c'}));
  assert.equal(agendaViewKey(base),agendaViewKey({...base,day:'2030-02-02',month:'2030-02'}),'irrelevant date filters must not split upcoming anchors');
  assert.equal(agendaViewKey({...base,tab:'todo'}),agendaViewKey({...base,tab:'todo',mode:'month',month:'2030-02',showCompleted:true}));
});

test('same-day view roundtrip restores filters and each view-specific position and collapse state', () => {
  const storage = memoryStorage();
  const view = {...defaultView(), tab: 'note', mode: 'day', day: '2030-02-02', month: '2030-02', showCompleted: true, search: '同步', positions: {upcoming: {top: 120, anchor: 'a', offset: -6, overdueOpen: true}, week: {top: 33, anchor: 'b', offset: 10, overdueOpen: false}}};
  const before = structuredClone(view);
  writeAgendaView(storage, STORE_KEY, view);
  assert.equal(JSON.parse(storage.getItem(STORE_KEY)).version, 1);
  assert.deepEqual(readAgendaView(storage, STORE_KEY, TODAY), view);
  assert.deepEqual(view, before);
});

test('new Shanghai day resets date-sensitive filters, search and positions while retaining tab and completion choice', () => {
  const raw = {...defaultView(), version: 1, tab: 'todo', mode: 'day', day: TODAY, search: 'yesterday', showCompleted: true, positions: {old: {top: 99, anchor: 'gone', offset: 2, overdueOpen: true}}};
  const restored = readAgendaView(memoryStorage(JSON.stringify(raw)), STORE_KEY, '2030-02-01');
  assert.deepEqual(restored, {...defaultView('2030-02-01'), tab: 'todo', showCompleted: true});
});

test('absent, malformed, unsupported, and throwing storage degrade to fresh defaults; writes never throw', () => {
  const broken = {getItem() { throw new Error('denied'); }, setItem() { throw new Error('quota'); }};
  for (const storage of [null, undefined, memoryStorage(), memoryStorage('{'), memoryStorage('null'), memoryStorage('{"version":2}'), broken]) {
    assert.deepEqual(readAgendaView(storage, STORE_KEY, TODAY), defaultView());
    assert.doesNotThrow(() => writeAgendaView(storage, STORE_KEY, defaultView()));
  }
  const cyclic = defaultView();
  cyclic.self = cyclic;
  assert.doesNotThrow(() => writeAgendaView(memoryStorage(), STORE_KEY, cyclic));
});

test('stored views sanitize invalid fields and positions, and bound search and position retention', () => {
  const positions = Object.fromEntries(Array.from({length: 45}, (_, index) => [`position-${index}`, {top: index, anchor: `anchor-${index}`, offset: index - 20, overdueOpen: index % 2 === 0}]));
  const raw = {...defaultView(), version: 1, tab: 'unknown', mode: 'unknown', day: 'bad', month: 'bad', showCompleted: 'true', search: 'x'.repeat(700), positions};
  const restored = readAgendaView(memoryStorage(JSON.stringify(raw)), STORE_KEY, TODAY);
  assert.equal(restored.tab, 'event');
  assert.equal(restored.mode, 'upcoming');
  assert.equal(restored.day, '');
  assert.equal(restored.month, '2030-01');
  assert.equal(restored.showCompleted, false);
  assert.equal(restored.search.length, 500);
  assert.deepEqual(Object.keys(restored.positions), Object.keys(positions).slice(-40));
  const storage = memoryStorage();
  writeAgendaView(storage, STORE_KEY, {...defaultView(), positions});
  assert.deepEqual(Object.keys(JSON.parse(storage.getItem(STORE_KEY)).positions), Object.keys(positions).slice(-40));
  const invalid = {...defaultView(), version: 1, mode: 'day', positions: {negative: {top: -1}, missing: {}, null: null, normalized: {top: 12, anchor: 4, offset: 'bad', overdueOpen: 1}}};
  const clean = readAgendaView(memoryStorage(JSON.stringify(invalid)), STORE_KEY, TODAY);
  assert.equal(clean.mode, 'upcoming');
  assert.deepEqual(clean.positions, {normalized: {top: 12, anchor: '', offset: 0, overdueOpen: false}});
  assert.deepEqual(readAgendaView(memoryStorage(JSON.stringify({...invalid, positions: []})), STORE_KEY, TODAY).positions, {});
});

test('damaged date storage cannot inject arrays, objects or impossible calendar dates into the UI',()=>{
  for(const value of [[],['2030-01'],{},42,true,'2030-00','2030-13']){
    const view=readAgendaView(memoryStorage(JSON.stringify({...defaultView(),version:1,month:value})),STORE_KEY,TODAY);
    assert.equal(view.month,'2030-01');assert.equal(typeof view.month,'string');
  }
  for(const value of [[],['2030-01-30'],{},'2030-02-30','2030-13-01','2030-01-00']){
    const view=readAgendaView(memoryStorage(JSON.stringify({...defaultView(),version:1,mode:'day',day:value})),STORE_KEY,TODAY);
    assert.equal(view.day,'');assert.equal(view.mode,'upcoming');
  }
  assert.notEqual(agendaViewKey({...defaultView(),date:TODAY}),agendaViewKey({...defaultView(),date:'2030-02-01'}),'midnight creates a fresh anchor key even in upcoming mode');
});

test('capture uses the first anchor below the sticky nav and records exact root-relative offset', () => {
  const root = fakeScrollRoot({scrollTop: 100, items: [{id: 'hidden', y: 0, height: 50}, {id: 'edge', y: 100, height: 40}, {id: 'anchor', y: 130, height: 50}, {id: 'next', y: 210, height: 50}]});
  assert.deepEqual(captureAgendaPosition(root, true), {top: 100, anchor: 'anchor', offset: 30, overdueOpen: true});
  assert.equal(root.scrollTop, 100);
  assert.equal(captureAgendaPosition(root).overdueOpen, false);
});

test('partly visible anchors preserve negative offsets when content above them shrinks', () => {
  const original = fakeScrollRoot({scrollTop: 150, items: [{id: 'partial', y: 130, height: 80}]});
  const saved = captureAgendaPosition(original);
  assert.deepEqual(saved, {top: 150, anchor: 'partial', offset: -20, overdueOpen: false});
  const changed = fakeScrollRoot({items: [{id: 'partial', y: 80, height: 80}]});
  restoreAgendaPosition(changed, saved);
  assert.equal(changed.scrollTop, 100);
  assert.equal(changed.querySelectorAll('[data-agenda-item]')[0].getBoundingClientRect().top - changed.getBoundingClientRect().top, -20);
});

test('anchor restoration preserves the exact visual position despite inserted content', () => {
  const original = fakeScrollRoot({scrollTop: 100, items: [{id: 'anchor', y: 130, height: 50}]});
  const saved = captureAgendaPosition(original, true);
  const changed = fakeScrollRoot({top: 250, scrollTop: 7, items: [{id: 'new', y: 20, height: 40}, {id: 'anchor', y: 230, height: 50}]});
  restoreAgendaPosition(changed, saved);
  assert.equal(changed.scrollTop, 200);
  const element = changed.querySelectorAll('[data-agenda-item]')[1];
  assert.equal(element.getBoundingClientRect().top - changed.getBoundingClientRect().top, saved.offset);
  restoreAgendaPosition(changed, saved);
  assert.equal(changed.scrollTop, 200, 'restoring the same anchor is idempotent');
});

test('missing anchors fall back to scrollTop; missing nav, empty roots and absent arguments are safe', () => {
  const root = fakeScrollRoot({scrollTop: 5, items: [{id: 'different', y: 200, height: 50}]});
  restoreAgendaPosition(root, {top: 120, anchor: 'deleted', offset: 10, overdueOpen: true});
  assert.equal(root.scrollTop, 120);
  const noNav = fakeScrollRoot({scrollTop: 40, navHeight: null, items: [{id: 'hidden', y: 0, height: 40}, {id: 'visible', y: 45, height: 30}]});
  assert.deepEqual(captureAgendaPosition(noNav), {top: 40, anchor: 'visible', offset: 5, overdueOpen: false});
  const empty = fakeScrollRoot({scrollTop: 80});
  assert.deepEqual(captureAgendaPosition(empty), {top: 80, anchor: '', offset: 0, overdueOpen: false});
  restoreAgendaPosition(empty, {top: 25, anchor: '', offset: 0});
  assert.equal(empty.scrollTop, 25);
  assert.equal(captureAgendaPosition(null), null);
  assert.doesNotThrow(() => restoreAgendaPosition(null, {top: 10}));
  assert.doesNotThrow(() => restoreAgendaPosition(root, null));
  assert.equal(root.scrollTop, 120);
});
