import { createHash, randomUUID } from 'node:crypto';
import { z } from 'zod';
import { itemSchema, parseShanghai } from './core.mjs';

export const MEETING_ROUTE = '/api/suishouji-67369b06/meetings';
export const DEFAULT_TAGS = Object.freeze(['会议记录', '沟通记录', '今日总结', '复盘改进', '学习笔记', '灵感想法']);
// Object-key candidates must not collide with JavaScript prototype properties.
const safeId = z.string().regex(/^[a-zA-Z0-9_-]{1,64}$/).refine(value => !['__proto__', 'prototype', 'constructor'].includes(value), '保留 ID 不可用');
const title = z.string().trim().min(1).max(200);
const tags = z.array(z.string().trim().min(1).max(30)).max(12);
const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(value => {
  try { parseShanghai(`${value}T00:00`); return true; } catch { return false; }
}, '无效会议日期').nullable();
const speakerSchema = z.object({
  id: safeId, name: z.string().trim().min(1).max(100),
  role: z.string().max(100).default(''), isSelf: z.boolean().default(false),
}).strict();
const speakers = z.array(speakerSchema).max(30).refine(values => new Set(values.map(v => v.id)).size === values.length, '发言人 ID 不可重复');
const segmentSchema = z.object({ id: safeId, text: z.string().min(1).max(60000) }).strict();
const evidenceSchema = z.object({ segmentId: safeId, quote: z.string().min(1).max(60000) }).strict();
const evidence = z.array(evidenceSchema).min(1).max(30);
const finding = z.object({ text: z.string().trim().min(1).max(2000), evidence }).strict();
export const reportSchema = z.object({
  summary: z.string().max(8000),
  decisions: z.array(finding).max(30),
  actions: z.array(z.object({
    id: safeId, title, ownerSpeakerId: safeId.nullable(), ownerText: z.string().max(200),
    dueText: z.string().max(200), evidence,
  }).strict()).max(30).refine(values => new Set(values.map(v => v.id)).size === values.length, '候选 ID 不可重复'),
  review: z.array(finding).max(30),
  questions: z.array(z.string().min(1).max(2000)).max(30),
}).strict();

function splitTranscript(transcript) {
  return transcript.split(/\r\n|\n|\r/).filter(line => line.trim()).map((text, index) => ({ id: `s${index + 1}`, text }));
}

function evidenceError(report, segments, providedSpeakers) {
  const source = new Map(segments.map(segment => [segment.id, segment.text]));
  const identities = new Set(providedSpeakers.map(speaker => speaker.id));
  if(report.review.length&&!providedSpeakers.some(speaker=>speaker.isSelf))return '个人复盘需要用户先明确本人说话人映射，不能推断身份';
  for (const candidate of [...report.decisions, ...report.actions, ...report.review]) {
    for (const reference of candidate.evidence) {
      if (!reference.quote.trim() || !source.get(reference.segmentId)?.includes(reference.quote)) return '证据须为对应原文片段中的非空精确引文';
    }
  }
  for (const candidate of report.actions) {
    if (candidate.ownerSpeakerId !== null && !identities.has(candidate.ownerSpeakerId)) return '负责人必须来自用户提供的发言人，不能推测身份';
    if (candidate.dueText && !candidate.evidence.some(reference => source.get(reference.segmentId)?.includes(candidate.dueText))) return '期限文本只能原样引用对应证据片段，不得推断具体日期';
  }
  return null;
}

export const meetingSchema = z.object({
  id: safeId, revision: z.number().int().positive(), title,
  transcript: z.string().max(60000), segments: z.array(segmentSchema).max(30000),
  tags, meetingDate: date, speakers, report: reportSchema.nullable(),
  conversions: z.record(safeId, z.string().regex(/^[a-f0-9]{32}$/)),
  createdAt: z.string().datetime(), updatedAt: z.string().datetime(),
}).strict().superRefine((meeting, ctx) => {
  if (JSON.stringify(meeting.segments) !== JSON.stringify(splitTranscript(meeting.transcript))) {
    ctx.addIssue({ code: 'custom', message: '原文片段与转录不一致', path: ['segments'] });
  }
  if (meeting.report) {
    const error = evidenceError(meeting.report, meeting.segments, meeting.speakers);
    if (error) ctx.addIssue({ code: 'custom', message: error, path: ['report'] });
  }
  for (const candidateId of Object.keys(meeting.conversions)) {
    if (!meeting.report?.actions.some(action => action.id === candidateId)) ctx.addIssue({ code: 'custom', message: '转换须关联有效报告候选', path: ['conversions', candidateId] });
    if (meeting.conversions[candidateId] !== itemIdFor(tokenFor(meeting, candidateId))) ctx.addIssue({ code: 'custom', message: '转换事项 ID 与确定性令牌不一致', path: ['conversions', candidateId] });
  }
});

const editable = { title, transcript: z.string().max(60000), tags, meetingDate: date, speakers };
const identity = { id: safeId, revision: z.number().int().positive() };
const selectionSchema = z.object({
  candidateId: safeId, title, kind: z.enum(['todo', 'event']),
  dueAt: z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/).nullable(),
  body: z.string().max(10000).optional(), ownerConfirmed: z.literal(true),
}).strict();
const actionSchema = z.discriminatedUnion('op', [
  z.object({ op: z.literal('create'), ...Object.fromEntries(Object.entries(editable).map(([key, schema]) => [key, schema.optional()])) }).strict(),
  z.object({ op: z.literal('update'), ...identity, ...Object.fromEntries(Object.entries(editable).map(([key, schema]) => [key, schema.optional()])) }).strict(),
  z.object({ op: z.literal('delete'), ...identity }).strict(),
  z.object({ op: z.literal('report'), ...identity, report: reportSchema }).strict(),
  z.object({ op: z.literal('confirm'), ...identity, selections: z.array(selectionSchema).min(1).max(30).refine(values => new Set(values.map(v => v.candidateId)).size === values.length, '不能重复选择候选') }).strict(),
]);
const clone = value => structuredClone(value);
const owns = (object, key) => Object.hasOwn(object, key);
const tokenFor = (meeting, candidateId) => `meeting:${meeting.id}:${candidateId}`;
const itemIdFor = token => createHash('sha256').update(token).digest('hex').slice(0, 32);

/** A local-only domain. The caller owns the meetings table and Notebook lifetimes. */
export class MeetingBook {
  constructor({ meetings, notebook, now = Date.now }) {
    Object.assign(this, { meetings, notebook, now });
    this.chain = Promise.resolve();
    this.stopped = false;
  }

  serial(operation) {
    if (this.stopped) return Promise.reject(new Error('会议记录已关闭'));
    const work = this.chain.then(operation);
    this.chain = work.catch(() => {});
    return work;
  }

  async close() { this.stopped = true; await this.chain; }

  list() {
    return this.serial(() => {
      const records = [...this.meetings.entries()].map(([, value]) => value);
      records.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt) || a.id.localeCompare(b.id));
      const summaries = records.slice(0, 100).map(value => ({
        id: value.id, revision: value.revision, title: value.title, tags: value.tags,
        meetingDate: value.meetingDate, createdAt: value.createdAt, updatedAt: value.updatedAt,
        segmentCount: value.segments.length, speakerCount: value.speakers.length,
        hasReport: value.report !== null, conversionCount: Object.keys(value.conversions).length,
      }));
      return clone({ meetings: summaries, total: records.length, truncated: records.length > summaries.length });
    });
  }

  get(id) {
    return this.serial(() => { safeId.parse(id); return clone(this.meetings.get(id) ?? null); });
  }

  async save(record) {
    const checked = meetingSchema.parse(record);
    await this.meetings.put(checked.id, checked);
    return clone(checked);
  }

  changed(current, patch) {
    return { ...current, ...patch, revision: current.revision + 1, updatedAt: new Date(this.now()).toISOString() };
  }

  mutate(input) {
    // Snapshot caller-owned input before it waits in the queue.
    let action;
    try { action = actionSchema.parse(input); } catch (error) { return Promise.reject(error); }
    return this.serial(async () => {
      if (action.op === 'create') {
        const stamp = new Date(this.now()).toISOString();
        const transcript = action.transcript ?? '';
        return this.save({
          id: randomUUID(), revision: 1, title: action.title ?? '未命名会议', transcript,
          segments: splitTranscript(transcript), tags: action.tags ?? ['会议记录'],
          meetingDate: action.meetingDate ?? null, speakers: action.speakers ?? [],
          report: null, conversions: {}, createdAt: stamp, updatedAt: stamp,
        });
      }
      const current = this.meetings.get(action.id);
      if (!current) throw new Error('会议记录不存在，请刷新');
      if (current.revision !== action.revision) throw new Error('会议记录已被修改，请刷新后重试（revision 冲突）');
      if (action.op === 'delete') {
        await this.meetings.delete(current.id);
        return { deleted: current.id };
      }
      if (action.op === 'confirm') return this.confirm(current, action.selections);
      const sourceEdit = ['transcript', 'speakers', 'meetingDate'].some(key => owns(action, key));
      if (Object.keys(current.conversions).length && (sourceEdit || action.op === 'report')) {
        throw new Error('已有转换记录，不能替换原文、发言人、会议日期或报告；可修改标题和标签');
      }
      if (action.op === 'report') return this.save(this.changed(current, { report: action.report }));
      const patch = {};
      for (const key of Object.keys(editable)) if (owns(action, key)) patch[key] = action[key];
      if (sourceEdit) patch.report = null;
      if (owns(patch, 'transcript')) patch.segments = splitTranscript(patch.transcript);
      return this.save(this.changed(current, patch));
    });
  }

  /** USER-only adapter operation; never expose confirm to a model-facing tool. */
  async confirm(current, selections) {
    if (!current.report) throw new Error('请先生成并核对会议报告');
    const error = evidenceError(current.report, current.segments, current.speakers);
    if (error) throw new Error(error);
    const candidates = new Map(current.report.actions.map(candidate => [candidate.id, candidate]));
    const plans = selections.map(selection => {
      const candidate = candidates.get(selection.candidateId);
      if (!candidate) throw new Error(`候选不存在：${selection.candidateId}`);
      const body = [
        '#会议记录 #会议来源', `会议：${current.title}`, `会议ID：${current.id}`,
        `候选ID：${candidate.id}`, `原文片段：${candidate.evidence.map(reference => reference.segmentId).join(', ')}`,
        `原始负责人：${candidate.ownerText || '未注明'}`, `原始期限：${candidate.dueText || '未注明'}`,
        selection.body ?? '',
      ].join('\n');
      const create = { op: 'create', kind: selection.kind, title: selection.title, body,
        tags: ['会议记录'], dueAt: selection.dueAt, remindAt: null };
      // Validate every selection, including exact calendar dates, BEFORE any write.
      const fields = this.notebook.fields(create);
      itemSchema.parse({ id: 'validation', revision: 1, ...fields, done: false, reminder: null,
        createdAt: current.createdAt, updatedAt: current.updatedAt });
      const token = tokenFor(current, candidate.id);
      return { candidateId: candidate.id, token, itemId: itemIdFor(token), create };
    });
    const existingIds = new Set(this.notebook.snapshot().items.map(item => item.id));
    const missing = plans.filter(plan => owns(current.conversions, plan.candidateId) && !existingIds.has(current.conversions[plan.candidateId]));
    if (missing.length) {
      const missingIds = new Set(missing.map(plan => plan.candidateId));
      return clone({ meeting: current, partial: true, results: plans.map(plan => ({
        candidateId: plan.candidateId, ok: false,
        ...(owns(current.conversions, plan.candidateId) ? { itemId: current.conversions[plan.candidateId] } : {}),
        error: missingIds.has(plan.candidateId)
          ? '关联事项已删除或上次转换未完成；为防止重复，不会自动重建，请核对本地事项。'
          : '其他选择存在缺失关联，整批未处理；请移除有问题的候选后重试',
      })) });
    }

    const results = [];
    let meeting = current;
    for (const plan of plans) {
      const mapped = owns(meeting.conversions, plan.candidateId) ? meeting.conversions[plan.candidateId] : undefined;
      if (mapped) {
        const existing = this.notebook.snapshot().items.find(item => item.id === mapped);
        results.push(existing
          ? { candidateId: plan.candidateId, ok: true, itemId: mapped, alreadyConverted: true }
          : { candidateId: plan.candidateId, ok: false, itemId: mapped, error: '关联事项已删除或上次转换未完成；为防止重复，不会自动重建，请核对本地事项。' });
        continue;
      }
      try {
        // Write-ahead reservation. Even a later uncertain persistence failure cannot
        // resurrect a deleted item on retry/reload. Missing reservations need review.
        meeting = await this.save(this.changed(meeting, {
          conversions: { ...meeting.conversions, [plan.candidateId]: plan.itemId },
        }));
      } catch (failure) {
        meeting = clone(this.meetings.get(current.id) ?? meeting);
        results.push({ candidateId: plan.candidateId, ok: false, error: `会议保存失败，未创建事项：${failure.message}` });
        for (const pending of plans.slice(results.length)) results.push({ candidateId: pending.candidateId, ok: false, error: '前项保存失败，未处理；可仅重试未解决候选' });
        break;
      }
      try {
        const item = await this.notebook.mutate(plan.create, plan.token);
        if (item.id !== plan.itemId) throw new Error('Notebook 返回了非确定性事项 ID');
        results.push({ candidateId: plan.candidateId, ok: true, itemId: item.id, alreadyConverted: false });
      } catch (failure) {
        results.push({ candidateId: plan.candidateId, ok: false, itemId: plan.itemId,
          error: `事项保存结果需核对，转换保留且不会自动重建：${failure.message}` });
        for (const pending of plans.slice(results.length)) results.push({ candidateId: pending.candidateId, ok: false, error: '前项保存失败，未处理；可仅重试未解决候选' });
        break;
      }
    }
    return clone({ meeting, results, partial: results.some(result => !result.ok) });
  }
}
