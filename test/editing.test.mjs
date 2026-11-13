import test from 'node:test';
import assert from 'node:assert/strict';
import { Notebook, itemSchema } from '../src/core.mjs';

// Contract tests only: no filesystem/profile/session data, model, microphone,
// transcription service or real IM target is used by this fixture.
const target = { botId: 'editing-test-bot', targetId: 'editing-test-target' };

function table() {
  const records = new Map();
  let writes = 0;
  return {
    get: key => structuredClone(records.get(key)),
    entries: () => [...records].map(([key, value]) => [key, structuredClone(value)]),
    put: async (key, value) => { writes++; records.set(key, structuredClone(value)); },
    delete: async key => { writes++; return records.delete(key); },
    get writes() { return writes; },
  };
}

function fixture(t) {
  let time = Date.parse('2030-01-01T00:00:00Z');
  let discoveries = 0;
  const items = table();
  const preferences = table();
  const sent = [];
  const im = {
    listBots: async () => [{ botId: target.botId, channel: 'weixin' }],
    listTargets: async () => [{ targetId: target.targetId, name: 'Memory fixture only' }],
    send: async (...args) => { sent.push(args); return { sent: true }; },
  };
  const n = new Notebook({
    items, preferences,
    getIm: () => { discoveries++; return im; },
    now: () => time,
  });
  t.after(() => n.close());
  return {
    n, items, preferences, sent,
    advance: ms => { time += ms; },
    get discoveries() { return discoveries; },
  };
}

function create(f, fields = {}) {
  return f.n.mutate({ op: 'create', kind: 'todo', title: '编辑契约测试', ...fields });
}

function update(f, item, fields) {
  return f.n.mutate({ op: 'update', id: item.id, revision: item.revision, ...fields });
}

async function rejectsWithoutWrite(f, action, message) {
  const before = f.items.entries();
  const preferences = f.preferences.entries();
  const writes = f.items.writes;
  const preferenceWrites = f.preferences.writes;
  const sent = structuredClone(f.sent);
  await assert.rejects(f.n.mutate(action), message);
  assert.deepEqual(f.items.entries(), before, 'rejected mutation must preserve every item');
  assert.equal(f.items.writes, writes, 'validation must precede persistence');
  assert.deepEqual(f.preferences.entries(), preferences);
  assert.equal(f.preferences.writes, preferenceWrites);
  assert.deepEqual(f.sent, sent);
}

test('tag deltas preserve existing tags and untouched local fields without IM discovery', async t => {
  const f = fixture(t);
  const original = await create(f, {
    title: '原始标题', body: '原始正文', tags: ['工作', '待确认'], dueAt: '2030-01-02T09:30',
  });
  const edited = await update(f, original, { addTags: ['紧急'] });
  assert.deepEqual(edited.tags, ['工作', '待确认', '紧急']);
  for (const key of ['id', 'kind', 'title', 'body', 'done', 'dueAt', 'reminder', 'createdAt']) {
    assert.deepEqual(edited[key], original[key], key);
  }
  assert.equal(edited.revision, original.revision + 1);
  assert.equal(f.discoveries, 0);
  assert.deepEqual(f.items.get(original.id), edited);
  itemSchema.parse(edited);
});

test('remove is exact rather than substring; delta entries trim and added tags deduplicate in order', async t => {
  const f = fixture(t);
  const original = await create(f, { tags: ['工作', '工作安排', '家务', 'Work'] });
  const edited = await update(f, original, {
    removeTags: [' 工作 ', '不存在', ' 工作 '],
    addTags: [' 家务 ', '新分类', ' 新分类 ', '工作安排', 'work'],
  });
  assert.deepEqual(edited.tags, ['工作安排', '家务', 'Work', '新分类', 'work']);
  const removed = await update(f, edited, { removeTags: ['新分类'] });
  assert.deepEqual(removed.tags, ['工作安排', '家务', 'Work', 'work']);
  const noChange = await update(f, removed, { addTags: [], removeTags: ['不存在'] });
  assert.deepEqual(noChange.tags, removed.tags);
});

test('tags replacement remains supported, including clearing, independently of delta updates', async t => {
  const f = fixture(t);
  const original = await create(f, { tags: ['保留前'] });
  const replaced = await update(f, original, { tags: [' 新标签 ', '新标签', '第二项'] });
  assert.deepEqual(replaced.tags, ['新标签', '第二项']);
  const cleared = await update(f, replaced, { tags: [] });
  assert.deepEqual(cleared.tags, []);
});

test('tags replacement and either delta field conflict even when their arrays are empty', async t => {
  const f = fixture(t);
  const original = await create(f, { tags: ['已有'] });
  for (const fields of [
    { tags: ['替换'], addTags: ['追加'] },
    { tags: ['替换'], removeTags: ['已有'] },
    { tags: [], addTags: [] },
    { tags: [], removeTags: [] },
    { tags: ['替换'], addTags: [], removeTags: [] },
  ]) {
    await rejectsWithoutWrite(f, {
      op: 'update', id: original.id, revision: original.revision, title: '不可部分改标题', ...fields,
    });
  }
});

test('add/remove intersection is rejected after trimming, including an absent current tag', async t => {
  const f = fixture(t);
  const original = await create(f, { tags: ['已有'] });
  for (const [addTags, removeTags] of [
    [['已有'], ['已有']],
    [[' 新标签 '], ['新标签']],
    [['A', ' B '], ['B', 'C']],
  ]) {
    await rejectsWithoutWrite(f, {
      op: 'update', id: original.id, revision: original.revision, addTags, removeTags,
    });
  }
});

test('each delta uses existing tags limits; invalid input never partially writes other fields', async t => {
  const f = fixture(t);
  const original = await create(f, { tags: ['已有'], body: '不可丢失' });
  const invalid = [
    null, '标签', {}, [1], [''], ['   '], ['x'.repeat(31)],
    Array.from({ length: 13 }, (_, i) => `标签${i}`),
    Array(13).fill('重复也先受输入数量限制'),
  ];
  for (const field of ['addTags', 'removeTags']) {
    for (const value of invalid) {
      await rejectsWithoutWrite(f, {
        op: 'update', id: original.id, revision: original.revision,
        title: '不应写入', body: '不应覆盖', dueAt: '2030-01-03T11:00', [field]: value,
      });
    }
  }
  const boundary = await update(f, original, { addTags: ['x'.repeat(30)] });
  assert.deepEqual(boundary.tags, ['已有', 'x'.repeat(30)]);
});

test('final tag capacity is enforced atomically after removal and ordered deduplication', async t => {
  const f = fixture(t);
  const tags = Array.from({ length: 12 }, (_, i) => `标签${i}`);
  const original = await create(f, { tags });
  await rejectsWithoutWrite(f, {
    op: 'update', id: original.id, revision: original.revision,
    addTags: ['第十三项'], title: '不能部分保存',
  });
  const same = await update(f, original, { addTags: ['标签0', ' 标签11 ', '标签0'] });
  assert.deepEqual(same.tags, tags);
  const replaced = await update(f, same, { removeTags: ['标签0'], addTags: ['新项', '新项'] });
  assert.deepEqual(replaced.tags, [...tags.slice(1), '新项']);
  assert.equal(replaced.tags.length, 12);
  const allRemoved = await update(f, replaced, { removeTags: replaced.tags, addTags: ['仅此项'] });
  assert.deepEqual(allRemoved.tags, ['仅此项']);
});

test('delta fields are update-only, including empty arrays, and cannot alter complete/delete/retry/create', async t => {
  const f = fixture(t);
  const original = await create(f, { tags: ['已有'] });
  for (const op of ['create', 'complete', 'delete', 'retry']) {
    for (const field of ['addTags', 'removeTags']) {
      for (const value of [[], ['已有']]) {
        const action = op === 'create'
          ? { op, kind: 'todo', title: '不得创建', [field]: value }
          : { op, id: original.id, revision: original.revision, [field]: value };
        await rejectsWithoutWrite(f, action);
      }
    }
  }
  for (const field of ['addTags', 'removeTags']) {
    await rejectsWithoutWrite(f, { op: 'preference', target: null, [field]: [] });
  }
});

test('concurrent stale edits conflict; refreshing revision and retrying preserves append order', async t => {
  const f = fixture(t);
  const original = await create(f, { tags: ['初始'] });
  const [first, second] = await Promise.allSettled([
    update(f, original, { addTags: ['第一项'] }),
    update(f, original, { addTags: ['第二项'] }),
  ]);
  assert.equal(first.status, 'fulfilled');
  assert.equal(second.status, 'rejected');
  assert.match(second.reason.message, /其他对话|revision|冲突/i);
  const afterFirst = f.items.get(original.id);
  assert.deepEqual(afterFirst.tags, ['初始', '第一项']);
  assert.equal(afterFirst.revision, original.revision + 1);
  const retried = await update(f, afterFirst, { addTags: ['第二项', '第一项'] });
  assert.deepEqual(retried.tags, ['初始', '第一项', '第二项']);
  assert.equal(retried.revision, original.revision + 2);
  await rejectsWithoutWrite(f, {
    op: 'update', id: original.id, revision: original.revision, removeTags: ['初始'],
  });
});

test('partial title/body/time updates preserve omitted event fields and existing tags', async t => {
  const f = fixture(t);
  const original = await create(f, {
    kind: 'event', title: '原日程', body: '保留正文', tags: ['日程'], dueAt: '2030-01-02T09:30',
  });
  const titled = await update(f, original, { title: '改后的日程' });
  assert.equal(titled.title, '改后的日程');
  for (const key of ['kind', 'body', 'tags', 'dueAt', 'done', 'reminder', 'createdAt']) {
    assert.deepEqual(titled[key], original[key], key);
  }
  const body = await update(f, titled, { body: '仅更新正文', addTags: ['待确认'] });
  assert.equal(body.body, '仅更新正文');
  assert.equal(body.title, titled.title);
  assert.equal(body.dueAt, original.dueAt);
  assert.deepEqual(body.tags, ['日程', '待确认']);
  const timed = await update(f, body, { dueAt: '2030-01-03T14:45' });
  assert.equal(timed.dueAt, '2030-01-03T06:45:00.000Z');
  for (const key of ['kind', 'title', 'body', 'tags', 'done', 'reminder', 'createdAt']) {
    assert.deepEqual(timed[key], body[key], key);
  }
  const clearedBody = await update(f, timed, { body: '' });
  assert.equal(clearedBody.body, '');
  assert.equal(clearedBody.title, timed.title);
  assert.equal(clearedBody.dueAt, timed.dueAt);
});

test('omitted dueAt preserves second precision across separate title/body/tag edits', async t => {
  const f = fixture(t);
  const original = await create(f, {
    kind: 'event', title: '秒级日程', body: '秒级正文', tags: ['原标签'],
    dueAt: '2030-01-02T09:30:47',
  });
  assert.equal(original.dueAt, '2030-01-02T01:30:47.000Z');
  let current = original;
  for (const fields of [{ title: '改标题' }, { body: '改正文' }, { addTags: ['补充'] }, { removeTags: ['原标签'] }]) {
    current = await update(f, current, fields);
    assert.deepEqual(current.dueAt, original.dueAt);
  }
});

test('operation-specific invalid fields reject atomically; completion plus labels requires fresh-revision steps', async t => {
  const f = fixture(t);
  const original = await create(f, { tags: ['已有'], dueAt: '2030-01-02T09:30' });
  for (const fields of [{ done: true }, { done: false }, { target }]) {
    await rejectsWithoutWrite(f, {
      op: 'update', id: original.id, revision: original.revision, title: '不能部分写', ...fields,
    });
  }
  for (const fields of [
    { tags: ['不能合并完成'] }, { title: '不能改标题' }, { body: '不能改正文' },
    { dueAt: '2030-01-03T11:00' }, { kind: 'note' }, { remindAt: null }, { target },
  ]) {
    await rejectsWithoutWrite(f, {
      op: 'complete', id: original.id, revision: original.revision, done: true, ...fields,
    });
  }
  const completed = await f.n.mutate({ op: 'complete', id: original.id, revision: original.revision });
  assert.equal(completed.done, true);
  await rejectsWithoutWrite(f, {
    op: 'update', id: original.id, revision: original.revision, addTags: ['整理'],
  });
  const labeled = await update(f, completed, { addTags: ['整理'] });
  assert.equal(labeled.done, true);
  assert.equal(labeled.revision, original.revision + 2);
  assert.deepEqual(labeled.tags, ['已有', '整理']);
});

test('same-title records are edited only by the specified ID; missing ID never selects a namesake', async t => {
  const f = fixture(t);
  const first = await create(f, { title: '同名事项', tags: ['甲'], body: '甲正文' });
  const second = await create(f, { title: '同名事项', tags: ['乙'], body: '乙正文' });
  const edited = await update(f, second, { addTags: ['只改乙'], body: '乙新正文' });
  assert.equal(edited.id, second.id);
  assert.deepEqual(edited.tags, ['乙', '只改乙']);
  assert.deepEqual(f.items.get(first.id), first);
  assert.equal(f.n.snapshot().items.length, 2);
  await rejectsWithoutWrite(f, {
    op: 'update', id: 'nonexistent-memory-item', revision: 1, title: '同名事项', addTags: ['不能猜'],
  });
});

test('changing dueAt/title/body/tags with remindAt omitted never reschedules a pending WeChat reminder', async t => {
  const f = fixture(t);
  const original = await create(f, {
    kind: 'event', title: '原提醒', body: '原正文', tags: ['已有'],
    dueAt: '2030-01-01T10:00', remindAt: '2030-01-01T08:01', target,
  });
  const lookups = f.discoveries;
  const edited = await update(f, original, {
    dueAt: '2030-01-02T11:00', title: '改后的提醒', body: '改后正文', addTags: ['新标签'],
  });
  assert.deepEqual(edited.reminder, original.reminder);
  assert.equal(edited.dueAt, '2030-01-02T03:00:00.000Z');
  assert.equal(f.discoveries, lookups, 'omitting remindAt must not rediscover/reconfigure target');
  f.advance(60_000);
  await f.n.tick();
  assert.equal(f.sent.length, 1, 'must still fire at original reminder time, not new dueAt');
  assert.match(f.sent[0][2], /改后的提醒/);
  assert.match(f.sent[0][2], /改后正文/);
  assert.equal(f.items.get(original.id).reminder.state, 'sent');
  const sent = f.items.get(original.id);
  const afterSent = await update(f, sent, { dueAt: '2030-01-03T12:00', removeTags: ['已有'] });
  assert.deepEqual(afterSent.reminder, sent.reminder);
  f.advance(3 * 24 * 60 * 60 * 1000);
  await f.n.tick();
  assert.equal(f.sent.length, 1, 'ordinary edits must not re-arm an already-sent reminder');
});

test('kind switch to event without explicit or retained dueAt rejects without partial tag/title writes', async t => {
  const f = fixture(t);
  const original = await create(f, { kind: 'note', tags: ['便签'], body: '保留内容' });
  await rejectsWithoutWrite(f, {
    op: 'update', id: original.id, revision: original.revision,
    kind: 'event', title: '不可保存', addTags: ['日程'],
  }, /明确时间/);
  const timed = await update(f, original, {
    kind: 'event', dueAt: '2030-01-02T09:00', addTags: ['日程'],
  });
  assert.equal(timed.kind, 'event');
  assert.equal(timed.body, original.body);
  assert.deepEqual(timed.tags, ['便签', '日程']);
  await rejectsWithoutWrite(f, {
    op: 'update', id: timed.id, revision: timed.revision, dueAt: null, removeTags: ['便签'],
  }, /明确时间/);
  const todo = await update(f, timed, { kind: 'todo', dueAt: null });
  assert.equal(todo.kind, 'todo');
  assert.equal(todo.dueAt, null);
  assert.deepEqual(todo.tags, timed.tags);
  const dueTodo = await create(f, { dueAt: '2030-01-04T15:00', tags: ['定时待办'] });
  const converted = await update(f, dueTodo, { kind: 'event' });
  assert.equal(converted.dueAt, dueTodo.dueAt);
  assert.deepEqual(converted.tags, dueTodo.tags);
});

test('complete done:false reopens without rearming cancelled reminder; subsequent tag edits preserve done state', async t => {
  const f = fixture(t);
  const original = await create(f, {
    kind: 'event', dueAt: '2030-01-01T09:00', tags: ['待办'],
    remindAt: '2030-01-01T08:01', target,
  });
  const complete = await f.n.mutate({ op: 'complete', id: original.id, revision: original.revision });
  assert.equal(complete.done, true);
  assert.equal(complete.reminder.state, 'cancelled');
  const editedWhileComplete = await update(f, complete, { addTags: ['完成后整理'] });
  assert.equal(editedWhileComplete.done, true);
  assert.deepEqual(editedWhileComplete.reminder, complete.reminder);
  const lookups = f.discoveries;
  const reopened = await f.n.mutate({
    op: 'complete', id: editedWhileComplete.id, revision: editedWhileComplete.revision, done: false,
  });
  assert.equal(reopened.done, false);
  assert.deepEqual(reopened.reminder, complete.reminder);
  assert.equal(reopened.dueAt, original.dueAt);
  assert.deepEqual(reopened.tags, ['待办', '完成后整理']);
  assert.equal(f.discoveries, lookups);
  const edited = await update(f, reopened, { removeTags: ['待办'], dueAt: '2030-01-02T10:00' });
  assert.equal(edited.done, false);
  assert.deepEqual(edited.reminder, complete.reminder);
  f.advance(2 * 24 * 60 * 60 * 1000);
  await f.n.tick();
  assert.equal(f.sent.length, 0);
  assert.equal(f.items.get(original.id).reminder.state, 'cancelled');
});
