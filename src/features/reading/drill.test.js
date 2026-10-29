// 독해·청해: 교재 문제 기록 · 유형별 정답률 · 틀린 문제 다시 풀기
import { describe, expect, it } from 'vitest';
import {
  makeRecord, toList, statsByMondai, statsBySection, weakest, reasonCounts, streak,
  dueWrong, markWrong, nextRv, setWrongDone, minutesOn, chapterAt,
} from './drill';

const R = (o = {}) => makeRecord({ date: '2026-10-29', mondai: 'r9', total: 9, page: 380, ...o });
const map = (...rs) => Object.fromEntries(rs.map((r, i) => [r.id, { ...r, u: i + 1 }]));

describe('기록 만들기', () => {
  it('맞힌 수 = 전체 - 틀린 수, 오답은 내일부터 다시', () => {
    const r = R({ wrong: [{ q: '3', mine: 2, answer: 4, reason: 'vocab' }] });
    expect(r).toMatchObject({ correct: 8, section: 'reading', page: 380 });
    expect(r.wrong[0].rv).toMatchObject({ step: 0, due: '2026-10-30', done: false });
    expect(r.id).toBeTruthy();
  });
  it('없는 유형은 거절', () => {
    expect(() => makeRecord({ date: '2026-10-29', mondai: 'x', total: 3 })).toThrow();
  });
  it('고쳐도 오답의 다시 풀기 상태는 그대로', () => {
    const a = R({ id: 'a', wrong: [{ id: 'w', q: '1' }] });
    const w = { ...a.wrong[0], rv: { step: 2, due: '2026-11-05', done: false, hist: [] } };
    const b = R({ id: 'a', total: 10, wrong: [w] });
    expect(b).toMatchObject({ id: 'a', total: 10, correct: 9 });
    expect(b.wrong[0].rv.step).toBe(2);
  });
  it('지운 것(del)은 목록에서 빠짐', () => {
    expect(toList({ a: R({ id: 'a' }), b: { del: 1, u: 3 } }).map((r) => r.id)).toEqual(['a']);
  });
});

describe('통계', () => {
  const list = toList(map(
    R({ id: 'a', date: '2026-10-27', min: 20, wrong: [{ q: '1', reason: 'vocab' }, { q: '2', reason: 'vocab' }, { q: '3' }, { q: '4' }, { q: '5' }] }),
    R({ id: 'b', date: '2026-10-28', mondai: 'l4', total: 12, min: 15, wrong: [{ q: '5', reason: 'speed' }, { q: '6' }] }),
    R({ id: 'c', date: '2026-10-29', min: 25, wrong: [{ q: '7' }, { q: '8' }] }),
  ));
  it('새것이 위', () => expect(list.map((r) => r.id)).toEqual(['c', 'b', 'a']));
  it('유형별·과목별 정답률', () => {
    expect(statsByMondai(list).r9).toMatchObject({ total: 18, correct: 11, count: 2, pct: 61, trend: [44, 78], recent: 61 });
    expect(statsBySection(list).listening).toMatchObject({ pct: 83, min: 15, count: 1 });
  });
  it('약한 유형·틀린 이유', () => {
    expect(weakest(list).map((o) => o.key)).toEqual(['r9']);
    expect(reasonCounts(list, 'reading')).toEqual([['vocab', 2]]);
  });
  it('이어서 푼 날', () => {
    expect(streak(list, '2026-10-29')).toBe(3);
    expect(streak(list, '2026-10-30')).toBe(3);
    expect(streak(list, '2026-10-31')).toBe(0);
  });
  it('그 날 분', () => expect(minutesOn(list, '2026-10-28')).toEqual({ reading: 0, listening: 15 }));
});

describe('틀린 문제 다시 풀기', () => {
  it('맞히면 1→3→7일, 세 번 맞히면 알았음, 틀리면 처음부터', () => {
    let rv = { step: 0, due: '2026-10-30', done: false, hist: [] };
    rv = nextRv(rv, true, '2026-10-30');
    expect(rv).toMatchObject({ step: 1, due: '2026-11-02' });
    rv = nextRv(rv, false, '2026-11-02');
    expect(rv).toMatchObject({ step: 0, due: '2026-11-03' });
    rv = nextRv(nextRv(nextRv(rv, true, '2026-11-03'), true, '2026-11-06'), true, '2026-11-13');
    expect(rv.done).toBe(true);
    expect(rv.hist).toHaveLength(5);
  });
  it('날짜가 된 것만, 오래 기다린 것부터, 알았음은 빠짐', () => {
    let a = R({ id: 'a', date: '2026-10-25', wrong: [{ id: 'w1', q: '1' }] });
    let b = R({ id: 'b', date: '2026-10-29', wrong: [{ id: 'w2', q: '2' }] });
    const due = (d) => dueWrong(toList(map(a, b)), d).map((w) => w.id);
    expect(due('2026-10-29')).toEqual(['w1']);
    a = markWrong(a, 'w1', true, '2026-10-29');
    expect(due('2026-10-30')).toEqual(['w2']);
    b = setWrongDone(b, 'w2', true, '2026-10-30');
    expect(due('2026-12-01')).toEqual(['w1']);
    b = setWrongDone(b, 'w2', false, '2026-12-01');
    expect(due('2026-12-01')).toEqual(['w1', 'w2']);
  });
});

describe('교재 장', () => {
  it('쪽으로 장 찾기', () => {
    expect(chapterAt(440)?.t).toBe('통합 이해');
    expect(chapterAt(615)?.mondai).toBe('l4');
    expect(chapterAt(100)).toBe(null);
  });
});
