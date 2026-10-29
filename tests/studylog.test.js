// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { cleanRow, mergeRows, studyDays, studyStreak, studyTotal, fmtStudy, toServer, startTimer, getStudyLog, logStudy } from '../src/lib/studylog';

const at = (ds, hm) => new Date(`${ds}T${hm}:00`).getTime();
const log = [
  { id: 'a', day: '2026-10-27', at: at('2026-10-27', '21:00'), sec: 1200, part: 'vocab', n: 60, ok: 45, learned: 5 },
  { id: 'b', day: '2026-10-28', at: at('2026-10-28', '20:00'), sec: 600, part: 'grammar', n: 10, ok: 7 },
  { id: 'c', day: '2026-10-29', at: at('2026-10-29', '08:10'), sec: 900, part: 'vocab', learned: 3 },
];

describe('공부 기록 줄', () => {
  it('다듬기 · 서버 모양', () => {
    const r = cleanRow({ id: 'x', at: at('2026-10-29', '09:00'), sec: 61.6, part: '??', n: 0, what: 'a'.repeat(80) });
    expect(r).toEqual({ id: 'x', day: '2026-10-29', at: at('2026-10-29', '09:00'), sec: 62, part: 'other', what: 'a'.repeat(60) });
    expect(toServer(r)).toMatchObject({ id: 'x', n: 0, ok: 0, learned: 0, what: 'a'.repeat(60) });
  });
  it('합치기: 안 올린 줄은 이 기기 것, 나머지는 서버 것, 받은 기간 밖은 그대로', () => {
    const local = [{ id: 'old', day: '2026-01-01', at: 1, sec: 60, part: 'vocab' }, { id: 'q', day: '2026-10-29', at: 5, sec: 300, part: 'vocab' }, { id: 'gone', day: '2026-10-20', at: 2, sec: 60, part: 'vocab' }];
    const server = [{ id: 'q', day: '2026-10-29', at: 5, sec: 100, part: 'vocab' }, { id: 'other', day: '2026-10-28', at: 4, sec: 50, part: 'reading' }];
    const out = mergeRows(local, server, ['q'], '2026-07-01');
    expect(out.map((r) => [r.id, r.sec])).toEqual([['old', 60], ['other', 50], ['q', 300]]);
  });
  it('하루씩 · 연속 · 합계', () => {
    expect(studyDays(log, '2026-10-29', 4).map((d) => d.sec)).toEqual([0, 1200, 600, 900]);
    expect(studyStreak(log, '2026-10-29')).toBe(3);
    expect(studyStreak(log, '2026-10-30')).toBe(3);
    expect(studyTotal(log).learned).toBe(8);
    expect(fmtStudy(3660)).toBe('1시간 1분');
  });
});

describe('시간 재기', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-10-29T10:00:00'));
  });
  it('만지는 동안만 재고, 90초 손 안 대면 멈추고, 끝내면 한 줄', () => {
    const t = startTimer('vocab', '단어 카드');
    for (let i = 0; i < 60; i++) {
      window.dispatchEvent(new Event('pointerdown'));
      vi.advanceTimersByTime(1000);
    }
    expect(t.sec).toBeGreaterThanOrEqual(59);
    vi.advanceTimersByTime(300 * 1000); // 손 안 댐
    expect(t.sec).toBeLessThanOrEqual(150);
    expect(t.paused).toBe(true);
    t.add({ n: 20, ok: 15, learned: 2 });
    t.finish();
    const row = getStudyLog().find((r) => r.what === '단어 카드');
    expect(row).toMatchObject({ part: 'vocab', day: '2026-10-29', n: 20, ok: 15, learned: 2 });
    expect(row.sec).toBeGreaterThanOrEqual(59);
    expect(row.sec).toBeLessThanOrEqual(150);
    t.stop();
    vi.useRealTimers();
  });
  it('바로 적기 · 같은 id 면 고침 · 빈 건 안 적음', () => {
    const id = logStudy({ part: 'reading', sec: 600, what: '책' });
    logStudy({ id, part: 'reading', sec: 900, what: '책' });
    expect(getStudyLog().filter((r) => r.id === id).map((r) => r.sec)).toEqual([900]);
    expect(logStudy({ part: 'reading', sec: 0 })).toBe(null);
    vi.useRealTimers();
  });
});
