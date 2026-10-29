import { describe, expect, it } from 'vitest';
import { BASE, parsePaste, readingChoices, readingTwists, splitExample } from '../src/features/words/words';
import { grade, queue } from '../src/lib/srs';

describe('단어 데이터', () => {
  it('500개 넘게, 칸이 다 차 있음', () => {
    expect(BASE.length).toBeGreaterThan(500);
    for (const w of BASE) {
      expect(w.r).toMatch(/^[぀-ゟー]+$/);
      expect(w.m.length).toBeGreaterThan(0);
      expect(w.ex.length).toBeGreaterThan(0);
      expect(w.k.length).toBeGreaterThan(0);
    }
  });
  it('예문 속 단어 자리 (활용형)', () => {
    const miss = BASE.filter((w) => !splitExample(w.ex, w.w)[1]);
    expect(miss.length / BASE.length).toBeLessThan(0.05);
    expect(splitExample('長年、開発に携わってきた。', '携わる')[1]).toBe('携わ');
  });
});

describe('붙여넣기', () => {
  it('여러 모양', () => {
    const { ok, bad } = parsePaste('赴く\tおもむく\t향하다\n培う（つちかう）기르다\n1. 営む いとなむ 경영하다\n아무 말\n携わる | たずさわる | 종사하다 | 開発に携わる。 | 개발에 종사하다.');
    expect(ok.map((x) => x.w)).toEqual(['赴く', '培う', '営む', '携わる']);
    expect(ok[3].ex).toBe('開発に携わる。');
    expect(bad).toEqual(['아무 말']);
  });
});

describe('읽기 보기', () => {
  it('헷갈리는 읽기', () => {
    expect(readingTwists('こうけん')).toContain('こけん');
    expect(readingTwists('かくさ')).toContain('がくさ');
    const c = readingChoices(BASE[0], BASE);
    expect(c).toHaveLength(4);
    expect(new Set(c).size).toBe(4);
    expect(c).toContain(BASE[0].r);
  });
});

describe('복습 주기', () => {
  it('새 카드 → 알맞음 1일 → 2일 → 늘어남, 시험 전으로 줄임', () => {
    let c = grade(null, 3, '2026-10-29');
    expect(c.i).toBe(1);
    c = grade(c, 3, '2026-10-30');
    expect(c.i).toBe(3);
    c = grade(c, 3, '2026-11-02');
    expect(c.i).toBe(8);
    const far = grade({ ...c, i: 40 }, 4, '2026-11-20', '2026-12-06');
    expect(far.d <= '2026-12-05').toBe(true);
    const again = grade(c, 1, '2026-11-10');
    expect(again.l).toBe(1);
    expect(again.d).toBe('2026-11-11');
  });
  it('오늘 볼 카드', () => {
    const cards = { a: { t: '2026-10-01', d: '2026-10-28' }, b: { t: '2026-10-01', d: '2026-11-05' }, c: { skip: 1, t: 'x', d: '9999' } };
    const q = queue(['a', 'b', 'c', 'd', 'e', 'f'], cards, '2026-10-29', 2);
    expect(q.due).toEqual(['a']);
    expect(q.fresh).toEqual(['d', 'e']);
  });
});
