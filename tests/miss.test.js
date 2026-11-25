import { describe, expect, it } from 'vitest';
import { addMiss, missText, missesOn } from '../src/features/words/miss';

const w = { id: 'n1-1', w: '密', r: 'みつ', m: '빽빽함', lv: 'N1' };
const o = { id: 'n2-9', w: '内緒', r: 'ないしょ', m: '비밀' };

describe('틀린 단어 모음', () => {
  it('같은 날 같은 단어는 한 기록에 쌓임', () => {
    let x = addMiss(null, w, 'sort-know', {}, '2026-11-25', 1);
    x = addMiss(x, w, 'read', { said: 'ないしょ', other: o }, '2026-11-25', 2);
    expect(x).toMatchObject({ n: 2, at: 1, last: 2, how: ['sort-know', 'read'], said: ['ないしょ'] });
    expect(x.other).toEqual([{ w: '内緒', r: 'ないしょ', m: '비밀' }]);
  });
  it('붙여 넣을 글', () => {
    const x = { ...addMiss(null, w, 'read', { said: 'ないしょ', other: o }, '2026-11-25', 1), note: '秘密 생각남' };
    const list = missesOn({ a: x, b: { ...x, day: '2026-11-20' } }, '2026-11-25');
    expect(list).toHaveLength(1);
    expect(missText(list, '2026-11-25')).toBe('[JLPT 틀린 단어 2026-11-25 · 1개]\n- 密（みつ） 빽빽함 | 내가 쓴 읽기: ないしょ | 헷갈린 말: 内緒（ないしょ） 비밀 | 복습 읽기 틀림 | 메모: 秘密 생각남');
  });
});
