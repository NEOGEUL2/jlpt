import { describe, expect, it } from 'vitest';
import { BASE, allWords } from '../src/features/words/words';
import { makeMock, scoreMock, sectionStats } from '../src/features/exam/mock';
import { phaseOf, todayTasks } from '../src/features/exam/plan';
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

describe('날마다 할 일', () => {
  const s = { due: 3, newDone: 10, newGoal: 50, fresh: 100, grammarN: 0, drillToday: 0, wrongDue: 0, mockToday: { full: false, mini: false } };
  it('단계', () => {
    expect(phaseOf('2026-10-29', '2026-12-06').k).toBe('learn');
    expect(phaseOf('2026-11-22', '2026-12-06').k).toBe('shape');
    expect(phaseOf('2026-11-29', '2026-12-06').k).toBe('final');
    expect(phaseOf('2026-12-06', '2026-12-06').k).toBe('day');
  });
  it('익히기 = 미니 모의, 마무리 = 새 단어 없음·모의 25', () => {
    const a = todayTasks(phaseOf('2026-10-29', '2026-12-06'), s);
    expect(a.find((t) => t.k === 'mock').mock).toBe('mini');
    expect(a.some((t) => t.k === 'new')).toBe(true);
    const c = todayTasks(phaseOf('2026-12-01', '2026-12-06'), { ...s, mockToday: { full: true } });
    expect(c.some((t) => t.k === 'new')).toBe(false);
    expect(c.find((t) => t.k === 'mock').done).toBe(true);
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
