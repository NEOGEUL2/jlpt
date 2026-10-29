import { describe, it, expect } from 'vitest';
import { GRAMMAR } from './data.js';
import { makeQuestion, makeRound, gradeOf, weakList, rng, byId, sentences, againOf, cloze } from './quiz.js';
import { MORE } from './more.js';
import { glossOf } from './gloss.js';

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

describe('더 붙인 문장 (more.js)', () => {
  it('모든 문법에 차이 메모·번역·빈칸 문장 2개·★ 문제', () => {
    expect(Object.keys(MORE).sort()).toEqual(GRAMMAR.map((g) => g.id).sort());
    for (const g of GRAMMAR) {
      const m = MORE[g.id];
      expect(m.n && m.qk, g.id).toBeTruthy();
      expect(m.x.length, g.id).toBeGreaterThanOrEqual(2);
      for (const [j, k, w] of m.x) {
        const c = cloze(j);
        expect(c.a, `${g.id} ${j}`).toBeTruthy();
        expect((c.s.match(/（　）/g) || []).length, j).toBe(c.a.split(' / ').length);
        expect(k, j).toBeTruthy();
        expect(new Set([c.a, ...w]).size, `${g.id} 보기 겹침 ${j}`).toBe(4);
      }
      const [pre, order, post, star] = m.st;
      expect(typeof pre === 'string' && typeof post === 'string', g.id).toBe(true);
      expect(order.length, g.id).toBe(4);
      expect(star >= 0 && star < 4, g.id).toBe(true);
    }
  });
  it('문장끼리 겹치지 않음 (같은 문장만 외우지 않게)', () => {
    for (const g of GRAMMAR) {
      const all = sentences(g).map((x) => x.full);
      expect(new Set([...all, g.ex.j]).size, g.id).toBe(all.length + 1);
    }
  });
  it('보기마다 뜻을 찾을 수 있음 (답 화면 "보기 뜻")', () => {
    for (const g of GRAMMAR)
      for (const s of sentences(g))
        for (const w of s.w) expect(glossOf(w), `${g.id}: ${w}`).toBeTruthy();
  });
  it('보기 뜻: 모양이 조금 달라도 같은 문법으로', () => {
    expect(glossOf('のを機に').id).toBe('okirini');
    expect(glossOf('極まりなかった').id).toBe('kiwamari');
    expect(glossOf('にかたくありません').id).toBe('kataku');
    expect(glossOf('なり / なり').id).toBe('nari2');
    expect(glossOf('なり').id).toBe('nari');
    expect(glossOf('なりとも').m).toContain('라도');
  });
});

describe('문제 만들기', () => {
  it('빈칸 문장은 볼 때마다 돌아감 · 다시 풀기는 다른 문장', () => {
    const g = byId.kawakiri;
    const asks = [0, 1, 2, 3].map((v) => makeQuestion(g, 'fill', rng(1), v).ask);
    expect(new Set(asks.slice(0, 3)).size).toBe(3);
    expect(asks[3]).toBe(asks[0]);
    const q = makeQuestion(g, 'fill', rng(1), 0);
    expect(againOf(q, rng(2)).ask).not.toBe(q.ask);
    expect(q.notes['をもって'].m).toContain('끝으로');
    expect(q.k).toBeTruthy();
  });
  it('★ 문제: 조각 4개 · ★ 자리 답', () => {
    for (const g of GRAMMAR) {
      const q = makeQuestion(g, 'star', rng(5));
      expect(q.pieces.length, g.id).toBe(4);
      expect(q.answer).toBe(q.order[q.star]);
      expect(q.full).toBe(q.pre + q.order.join('') + q.post);
    }
  });
  it('처음 보는 문법: 소개 카드 표시 · ★ 대신 쉬운 형식', () => {
    const qs = makeRound(['iza', 'nari'], ['star'], rng(3), { isNew: (id) => id === 'iza' });
    expect(qs[0].intro).toBe(true);
    expect(qs[0].kind).toBe('fill');
    expect(qs[1].kind).toBe('star');
    expect(qs[1].intro).toBeUndefined();
  });

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
    expect(gradeOf(true, 20000, 'star')).toBe(3);
    expect(gradeOf(true, 8000, 'star')).toBe(4);
  });
  it('weakList: 틀린 횟수 많은 순', () => {
    expect(weakList({ iza: { l: 1, t: '2026-10-01' }, nari: { l: 3 }, beku: { l: 0 }, zz: { l: 9 } })).toEqual(['nari', 'iza']);
  });
});
