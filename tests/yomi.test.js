import { describe, expect, it } from 'vitest';
import { BASE } from '../src/features/words/words';
import { trapEdits, yomiChoices, yomiOk } from '../src/features/words/yomi';
import { wordKinds } from '../src/features/words/kanji';

describe('漢字読み 보기', () => {
  it('함정 종류', () => {
    const ks = (r, w) => trapEdits(r, w).map((e) => e.k);
    expect(ks('しゅっぱん')).toEqual(expect.arrayContaining(['soku', 'han', 'yoon']));
    expect(ks('こうけん', '貢献')).toContain('long');
    // 오쿠리가나는 안 건드림
    expect(trapEdits('おもむく', '赴く').every((e) => e.e <= 3)).toBe(true);
  });
  it('出版: 2×2 함정', () => {
    const c = yomiChoices({ id: 'x', w: '出版', r: 'しゅっぱん' }, BASE, () => 0.3);
    expect(c).toHaveLength(4);
    expect(c.filter((o) => !o.traps.length).map((o) => o.r)).toEqual(['しゅっぱん']);
    expect(c.some((o) => o.traps.length === 2)).toBe(true);
  });
  it('N1·N2 한자 단어 거의 다 4개, 정답 하나, 겹침 없음', () => {
    const ws = BASE.filter((w) => w.lv !== 'N3' && yomiOk(w)).slice(0, 800);
    let grid = 0;
    let on = 0;
    for (const w of ws) {
      const c = yomiChoices(w, BASE);
      expect(c).toHaveLength(4);
      expect(new Set(c.map((o) => o.r)).size).toBe(4);
      expect(c.filter((o) => o.r === w.r)).toHaveLength(1);
      if (wordKinds(w.w, w.r)?.type === 'on') {
        on++;
        if (c.some((o) => o.traps.length === 2)) grid++;
      }
    }
    // 음독 단어는 대부분 실제 시험 같은 2×2
    expect(grid / on).toBeGreaterThan(0.65);
  });
});
