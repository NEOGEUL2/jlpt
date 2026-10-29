import { describe, it, expect } from 'vitest';
import { GRAMMAR } from './data.js';
import { makeQuestion, makeRound, gradeOf, weakList, rng, byId } from './quiz.js';

describe('문법 데이터', () => {
  it('id 겹침 없음 · 문제마다 빈칸 하나 이상 · 보기 4개 서로 다름', () => {
    const ids = GRAMMAR.map((g) => g.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(GRAMMAR.length).toBeGreaterThanOrEqual(100);
    for (const g of GRAMMAR) {
      expect(g.q.s, g.id).toContain('（　）');
      expect(new Set([g.q.a, ...g.q.w]).size, g.id).toBe(4);
      expect(g.f && g.m && g.c && g.g && g.ex.j && g.ex.k, g.id).toBeTruthy();
    }
  });
});

describe('문제 만들기', () => {
  const r = rng(7);
  for (const kind of ['fill', 'mean', 'form']) {
    it(`${kind}: 보기 4개 · 정답 하나`, () => {
      for (const g of GRAMMAR) {
        const q = makeQuestion(g, kind, r);
        expect(q.choices.length, g.id).toBe(4);
        expect(new Set(q.choices).size, g.id).toBe(4);
        expect(q.choices.filter((c) => c === q.answer).length).toBe(1);
      }
    });
  }
  it('뜻 문제는 같은 묶음에서 틀린 보기를 먼저 고름', () => {
    const g = byId.iza; // ~하자마자 묶음
    const q = makeQuestion(g, 'mean', rng(1));
    const groupMeans = GRAMMAR.filter((x) => x.g === g.g).map((x) => x.m);
    expect(q.choices.filter((c) => groupMeans.includes(c)).length).toBeGreaterThanOrEqual(2);
  });
  it('뜻이 같은 문법은 서로 보기로 안 나옴 (が早いか ↔ や否や)', () => {
    for (let k = 0; k < 30; k++) {
      expect(makeQuestion(byId.iza, 'form', rng(k)).choices).not.toContain(byId.yainaya.f);
      expect(makeQuestion(byId.iza, 'mean', rng(k)).choices.filter((c) => c.startsWith('~하자마자')).length).toBe(1);
    }
  });
  it('한 판: 없는 id는 뺌', () => {
    expect(makeRound(['iza', 'nope', 'nari'], ['fill', 'mean'], rng(3)).map((q) => q.id)).toEqual(['iza', 'nari']);
  });
});

describe('등급 · 약한 문법', () => {
  it('gradeOf', () => {
    expect(gradeOf(false, 1000)).toBe(1);
    expect(gradeOf(true, 15000)).toBe(2);
    expect(gradeOf(true, 7000)).toBe(3);
    expect(gradeOf(true, 2000)).toBe(4);
  });
  it('weakList: 틀린 횟수 많은 순', () => {
    expect(weakList({ iza: { l: 1, t: '2026-10-01' }, nari: { l: 3 }, beku: { l: 0 }, zz: { l: 9 } })).toEqual(['nari', 'iza']);
  });
});
