import { describe, expect, it } from 'vitest';
import { PARTS, partName, radicalOf, readingKind, wordKinds } from '../src/features/words/kanji';
import { makeOnKun, radicalGroups } from '../src/features/words/Kanji';

describe('부수·부품', () => {
  it('부수와 변 모양', () => {
    expect(radicalOf('湯')).toMatchObject({ n: 85, form: '氵', formName: '삼수변' });
    expect(radicalOf('休')).toMatchObject({ n: 9, form: '亻' });
    expect(radicalOf('道')).toMatchObject({ n: 162, form: '⻌' });
    expect(radicalOf('話')).toMatchObject({ n: 149, form: '言', name: '말씀 언' });
    expect(PARTS.get('話').parts).toEqual(['言', '舌']);
    expect(partName('扌')).toBe('재방변');
    expect(partName('舌')).toMatch('혀');
  });
  it('닮은 한자', () => {
    expect(PARTS.get('治').look).toContain('沿');
  });
  it('부수로 묶기', () => {
    const g = radicalGroups([{ id: 'a', w: '治療' }, { id: 'b', w: '沿う' }], {});
    expect(g[0].rad.form).toBe('氵');
    expect(g[0].kanji).toEqual(['治', '沿']);
  });
});

describe('음독·훈독', () => {
  it('한자 하나', () => {
    expect(readingKind('学', 'がっ')).toBe('on');
    expect(readingKind('紙', 'がみ')).toBe('kun');
    expect(readingKind('立', 'たち')).toBe('kun');
    expect(readingKind('替', 'がえ')).toBe('kun');
  });
  it('단어 모양', () => {
    expect(wordKinds('道路', 'どうろ').type).toBe('on');
    expect(wordKinds('手紙', 'てがみ').type).toBe('kun');
    expect(wordKinds('取り扱う', 'とりあつかう').type).toBe('kun');
    expect(wordKinds('本棚', 'ほんだな').type).toBe('jubako');
    expect(wordKinds('場所', 'ばしょ').type).toBe('yuto');
    expect(wordKinds('土産', 'みやげ').type).toBe('special');
  });
  it('문제 10개, 음독·훈독 다 섞임', () => {
    const pool = [['道路', 'どうろ'], ['経営', 'けいえい'], ['学校', 'がっこう'], ['手紙', 'てがみ'], ['扱う', 'あつかう'], ['本棚', 'ほんだな'], ['場所', 'ばしょ'], ['山', 'やま'], ['治療', 'ちりょう'], ['細かい', 'こまかい'], ['話題', 'わだい'], ['立場', 'たちば']].map(([w, r]) => ({ id: w, w, r, m: '' }));
    const q = makeOnKun(pool.slice(0, 3), pool);
    expect(q.length).toBe(10);
    const t = new Set(q.map((x) => x.t));
    expect(t.has('on') && t.has('kun')).toBe(true);
  });
});
