import { describe, expect, it } from 'vitest';
import { BASE, allWords } from '../src/features/words/words';
import { gramQuestion, makeMock, starOk, scoreMock, sectionStats } from '../src/features/exam/mock';
import { GRAMMAR } from '../src/features/grammar/data';
import { phaseOf, todayTasks } from '../src/features/exam/plan';
import { checkNo, checkOk, checkPick, checkedToday, unchecked } from '../src/features/words/check';
import { confusablePairs, noGuess, pairBits, pairQuiz } from '../src/features/words/groups';

describe('모의 시험', () => {
  it('25문제, 실제 순서 6·7·6·6, 같은 단어 없음, 정답 자리 맞음', () => {
    const qs = makeMock(BASE, {}, 'full');
    expect(qs.map((q) => q.sec).join(',')).toBe([...Array(6).fill('yomi'), ...Array(7).fill('ctx'), ...Array(6).fill('para'), ...Array(6).fill('use')].join(','));
    expect(new Set(qs.map((q) => q.word.id)).size).toBe(25);
    for (const q of qs) expect(q.answer).toBeGreaterThanOrEqual(0);
    const yomi = qs.filter((q) => q.sec === 'yomi');
    for (const q of yomi) expect(q.options[q.answer].r).toBe(q.word.r);
  });
  it('미니 10문제 · 채점', () => {
    const qs = makeMock(BASE, {}, 'mini');
    expect(qs).toHaveLength(10);
    const sc = scoreMock(qs, qs.map((q, i) => (i < 3 ? q.answer : null)));
    expect(sc.parts.yomi).toEqual([3, 3]);
    expect(sc.ok).toBe(3);
    expect(sc.wrong).toHaveLength(7);
    expect(sectionStats([{ parts: sc.parts }])[0].pct).toBe(100);
  });
});

describe('문법 모의 (問題5·6)', () => {
  it('문법 15 = 빈칸 10 + ★ 5, 같은 문법 없음, 정답 자리 맞음', () => {
    const qs = makeMock(BASE, {}, 'gram');
    expect(qs.map((q) => q.sec).join(',')).toBe([...Array(10).fill('gf'), ...Array(5).fill('st')].join(','));
    expect(new Set(qs.map((q) => q.gid)).size).toBe(15);
    for (const q of qs) {
      expect(q.options).toHaveLength(4);
      expect(new Set(q.options.map((o) => o.text)).size).toBe(4);
    }
    for (const q of qs.filter((x) => x.sec === 'st')) expect(q.options[q.answer].text).toBe(q.order[q.star]);
    for (const q of qs.filter((x) => x.sec === 'gf')) expect(q.full).toContain(q.options[q.answer].text.split(' / ')[0]);
  });
  it('★ 문제는 조각이 서로 다른 문법만 (보기 4개가 구별됨)', () => {
    for (const g of GRAMMAR.filter(starOk)) {
      const q = gramQuestion(g, 'st');
      expect(new Set(q.options.map((o) => o.text)).size, g.id).toBe(4);
    }
    expect(GRAMMAR.filter(starOk).length).toBeGreaterThan(100);
  });
  it('언어지식 40 = 問題1~6 순서', () => {
    const qs = makeMock(BASE, {}, 'lang');
    expect(qs).toHaveLength(40);
    expect([...new Set(qs.map((q) => q.sec))].join(',')).toBe('yomi,ctx,para,use,gf,st');
  });
  it('틀린 문법 먼저 나옴 · 채점은 단어/문법 따로', () => {
    const g = { kawakiri: { t: '2026-11-01', i: 1, l: 3, d: '2026-11-02' } };
    const qs = makeMock(BASE, {}, 'gram', Math.random, g);
    expect(qs.some((q) => q.gid === 'kawakiri')).toBe(true);
    const sc = scoreMock(qs, qs.map(() => null));
    expect(sc.wrongG).toHaveLength(15);
    expect(sc.wrong).toHaveLength(0);
    expect(sc.grammar).toEqual([0, 15]);
    expect(sc.vocab).toEqual([0, 0]);
  });
});

describe('날마다 할 일', () => {
  const s = { due: 3, newDone: 10, newGoal: 50, fresh: 100, grammarN: 0, drillToday: 0, wrongDue: 0, mockToday: { full: false, mini: false } };
  it('단계', () => {
    expect(phaseOf('2026-10-29', '2026-12-06').k).toBe('learn');
    expect(phaseOf('2026-11-22', '2026-12-06').k).toBe('shape');
    expect(phaseOf('2026-11-29', '2026-12-06').k).toBe('final');
    expect(phaseOf('2026-12-06', '2026-12-06').k).toBe('day');
  });
  it('익히기 = 미니 모의, 마무리 = 새 단어 없음·언어지식 모의 40', () => {
    const a = todayTasks(phaseOf('2026-10-29', '2026-12-06'), s);
    expect(a.find((t) => t.k === 'mock').mock).toBe('mini');
    expect(a.some((t) => t.k === 'new')).toBe(true);
    const c = todayTasks(phaseOf('2026-12-01', '2026-12-06'), { ...s, mockToday: { lang: true } });
    expect(c.some((t) => t.k === 'new')).toBe(false);
    expect(c.find((t) => t.k === 'mock').mock).toBe('lang');
    expect(c.find((t) => t.k === 'mock').done).toBe(true);
    // 문자·어휘 25 만 했으면 아직, 문법 15까지 하면 끝
    expect(todayTasks(phaseOf('2026-12-01', '2026-12-06'), { ...s, mockToday: { full: true } }).find((t) => t.k === 'mock').done).toBe(false);
    expect(todayTasks(phaseOf('2026-12-01', '2026-12-06'), { ...s, mockToday: { full: true, gram: true } }).find((t) => t.k === 'mock').done).toBe(true);
  });
});

describe('단어 묶음', () => {
  it('아는 한자부터: N2·N1 중 N3 한자로만 된 단어가 앞', () => {
    const a = allWords({}, ['N3', 'N2', 'N1'], 'kanji');
    expect(a[0].lv).not.toBe('N3');
    expect(a.at(-1).lv).toBe('N3');
    expect(a.length).toBe(BASE.length);
  });
  it('한자로 못 맞히는 말', () => {
    const w = (x, r, lv = 'N1') => ({ id: x, w: x, r, lv });
    expect(noGuess(w('赴く', 'おもむく'))).toBe(true);
    expect(noGuess(w('ことごとく', 'ことごとく'))).toBe(true);
    expect(noGuess(w('貢献', 'こうけん'))).toBe(false);
    expect(noGuess(w('赴く', 'おもむく', 'N3'))).toBe(false);
  });
  it('비슷한 말 짝: 배운 단어만, 짝은 떨어져 나옴', () => {
    const ko = BASE.filter((x) => !x.en).slice(0, 1500);
    const cards = Object.fromEntries(ko.map((x) => [x.id, { t: '2026-10-28', i: 3 }]));
    const pairs = confusablePairs(ko, cards, 10);
    expect(pairs.length).toBe(10);
    const q = pairQuiz(pairs, ko, cards);
    expect(q.length).toBeGreaterThanOrEqual(10);
    expect(q.length).toBeLessThanOrEqual(20);
    // 묻는 뜻은 짝에 없는 조각이 있음 (뜻만으로 가를 수 있게)
    for (const x of q) expect(pairBits(x.word, x.mate).own.length).toBeGreaterThan(0);
    const pk = (x) => [x.word.id, x.mate.id].sort().join('~');
    expect(new Set(q.slice(0, 10).map(pk)).size).toBe(10);
    for (const x of q) expect(x.options.some((o) => o.id === x.word.id) && x.options.some((o) => o.id === x.mate.id)).toBe(true);
    expect(confusablePairs(ko, {}, 10)).toEqual([]);
  });
});

describe('넘긴 단어 점검', () => {
  const w = (id, lv) => ({ id, w: id, r: id, m: id, lv });
  const words = [w('a', 'N3'), w('b', 'N1'), w('c', 'N2'), w('d', 'N1')];
  const cards = { a: { skip: 1, t: '2026-11-01' }, b: { skip: 1, t: '2026-11-01' }, c: { skip: 1, t: '2026-11-01', ck: '2026-11-05' }, d: { t: '2026-11-01', i: 3 } };
  it('점검 안 한 알아요 단어만, N1 먼저', () => {
    expect(unchecked(words, cards).map((x) => x.id).sort()).toEqual(['a', 'b']);
    expect(checkPick(words, cards).map((x) => x.id)).toEqual(['b', 'a']);
  });
  it('맞히면 그대로 + ck, 틀리면 새 단어 맨 앞 + ck', () => {
    expect(checkOk(cards.a, '2026-11-06')).toMatchObject({ skip: 1, ck: '2026-11-06' });
    expect(checkNo('2026-11-06')).toEqual({ pri: 1, ck: '2026-11-06' });
    expect(checkedToday({ x: { ck: '2026-11-06' }, y: { pri: 1, ck: '2026-11-06' }, z: {} }, '2026-11-06')).toBe(2);
  });
  it('날마다 할 일에 점검 (남았을 때만, 마무리 단계엔 없음)', () => {
    const s = { due: 0, newDone: 0, newGoal: 50, fresh: 0, grammarN: 0, drillToday: 0, wrongDue: 0, mockToday: {}, skipLeft: 30, checkedToday: 0 };
    expect(todayTasks(phaseOf('2026-11-06', '2026-12-06'), s).find((t) => t.k === 'check').open).toBe('check');
    expect(todayTasks(phaseOf('2026-11-06', '2026-12-06'), { ...s, skipLeft: 0 }).some((t) => t.k === 'check')).toBe(false);
    expect(todayTasks(phaseOf('2026-12-01', '2026-12-06'), s).some((t) => t.k === 'check')).toBe(false);
  });
});
