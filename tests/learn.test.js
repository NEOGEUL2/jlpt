import { describe, expect, it } from 'vitest';
import { BASE } from '../src/features/words/words';
import { answer, finishKana, learned, meaningChoices, newIds, reviewIds, sameReading, toKana, waitingInfo } from '../src/features/words/learn';
import { kanjiIndex, kanjiInfo, kanjiOf, onHint, siblings } from '../src/features/words/hanja';
import { makeQuiz, slotOf } from '../src/features/words/n1quiz';

const seq = (seed = 1) => () => ((seed = (seed * 16807) % 2147483647) / 2147483647);

describe('로마자 → 히라가나', () => {
  it('보통 단어', () => {
    expect(toKana('tsuchikau')).toBe('つちかう');
    expect(toKana('tazusawaru')).toBe('たずさわる');
    expect(toKana('omomuku')).toBe('おもむく');
    expect(toKana('gakkou')).toBe('がっこう');
    expect(toKana('shinpai')).toBe('しんぱい');
    expect(toKana('kon\'yaku')).toBe('こんやく');
    expect(toKana('kyouryoku')).toBe('きょうりょく');
    expect(toKana('chotto')).toBe('ちょっと');
    expect(finishKana('hon')).toBe('ほん');
  });
  it('치는 중이면 덜 친 것 그대로, 가나·가타카나도', () => {
    expect(toKana('ts')).toBe('ts');
    expect(toKana('かn')).toBe('かn');
    expect(toKana('カタ')).toBe('かた');
    expect(sameReading('ツチカウ', 'つちかう')).toBe(true);
    expect(sameReading('tsuchikau', 'つちかう')).toBe(true);
    expect(sameReading('tsuchigau', 'つちかう')).toBe(false);
    // 전각 글자·보이지 않는 글자·띄어쓰기
    expect(sameReading('ちく\u200b', 'ちく')).toBe(true);
    expect(sameReading(' ちく ', 'ちく')).toBe(true);
    expect(sameReading('ｃｈｉｋｕ', 'ちく')).toBe(true);
    expect(sameReading('ﾁｸ', 'ちく')).toBe(true);
  });
});

describe('한자 한국 음', () => {
  it('신자체도 옛 글자로 찾음', () => {
    expect(kanjiInfo('培')).toMatchObject({ ko: '배·부', hun: '북돋을 배' });
    expect(kanjiInfo('営')).toMatchObject({ ko: '영', old: '營' });
    expect(kanjiInfo('楽').ko).toBe('락·악');
    expect(kanjiInfo('込').kokuji).toBe(true);
    expect(kanjiOf('人々の培養')).toEqual(['人', '培', '養']);
  });
  it('N1 단어 한자는 거의 다 있음', () => {
    const ch = new Set(BASE.flatMap((w) => kanjiOf(w.w)));
    const miss = [...ch].filter((c) => kanjiInfo(c).kokuji);
    expect(miss.length).toBeLessThan(30);
  });
  it('받침 규칙', () => {
    expect(onHint('학')).toBe('받침 ㄱ → く·き');
    expect(onHint('발')).toMatch('つ·ち');
    expect(onHint('가')).toBe('받침 없음 → ん·っ·く 없이 끝남');
  });
  it('같은 한자 단어, 본 것 먼저', () => {
    const idx = kanjiIndex(BASE);
    const w = BASE.find((x) => x.w === '培う');
    const sib = siblings(w, idx, {}, 3);
    expect(sib[0].ch).toBe('培');
    expect(sib[0].words.length).toBeGreaterThan(0);
    const seen = sib[0].words.at(-1);
    const again = siblings(w, idx, { [seen.id]: { t: '2026-10-01' } }, 3);
    expect(again[0].words[0].id).toBe(seen.id);
    expect(again[0].words[0].known).toBe(true);
  });
});

describe('뜻 고르기', () => {
  it('보기 4개, 정답 하나, 뜻 겹치지 않음', () => {
    const rnd = seq(3);
    for (const w of BASE.slice(0, 200)) {
      const ch = meaningChoices(w, BASE, rnd);
      expect(ch.length).toBe(4);
      expect(ch.filter((c) => c === w.m).length).toBe(1);
      expect(new Set(ch).size).toBe(4);
    }
  });
});

describe('배우기 · 복습 단계', () => {
  const today = '2026-10-29';
  const now = 1_800_000_000_000;
  it('배우면 10분 뒤 다시, 맞히면 내일', () => {
    const c = learned({ pri: 1 }, today, now);
    expect(c).toMatchObject({ t: today, f: today, d: today, ls: 1 });
    expect(c.la).toBe(now + 600e3);
    expect(reviewIds(['a'], { a: c }, today, now)).toEqual([]);
    expect(waitingInfo(['a'], { a: c }, now)).toEqual({ n: 1, next: now + 600e3 });
    expect(reviewIds(['a'], { a: c }, today, now + 601e3)).toEqual(['a']);
    const ok = answer(c, true, today, now + 601e3, '2026-12-06');
    expect(ok.ls).toBeUndefined();
    expect(ok.d).toBe('2026-10-30');
    expect(ok.f).toBe(today);
    const ng = answer(c, false, today, now + 601e3, '2026-12-06');
    expect(ng.ls).toBe(1);
    expect(ng.la).toBe(now + 1201e3);
  });
  it('복습에서 틀리면 오늘 10분 뒤 다시', () => {
    const c = { t: '2026-10-20', f: '2026-10-10', d: today, i: 4, e: 250, n: 3, l: 0 };
    const ng = answer(c, false, today, now, '2026-12-06');
    expect(ng).toMatchObject({ d: today, ls: 1, l: 1, i: 0 });
    const ok = answer(c, true, today, now, '2026-12-06');
    expect(ok.i).toBe(10);
    expect(ok.ls).toBeUndefined();
  });
  it('새 단어: 몰라요(pri) 먼저, 본 것·아는 것 빼고', () => {
    const words = BASE.slice(0, 10);
    const cards = { [words[0].id]: { t: today }, [words[1].id]: { skip: 1 }, [words[5].id]: { pri: 1 } };
    expect(newIds(words, cards, 3)).toEqual([words[5].id, words[2].id, words[3].id]);
  });
});

describe('N1 모양 문제', () => {
  it('예문 속 자리 (활용 꼬리까지)', () => {
    expect(slotOf('父は単身で海外の支社に赴いた。', '赴く')).toEqual(['父は単身で海外の支社に', '赴いた', '。']);
    expect(slotOf('留学で培った語学力を仕事に生かしたい。', '培う')[1]).toBe('培った');
    expect(slotOf('', '培う')).toBeNull();
  });
  it('10문제, 세 종류 다 나옴, 정답 자리 맞음', () => {
    const qs = makeQuiz(BASE, {}, 30, seq(7));
    expect(qs.length).toBe(30);
    expect(new Set(qs.map((q) => q.type))).toEqual(new Set(['ctx', 'para', 'use']));
    for (const q of qs) {
      expect(q.options.length).toBe(4);
      expect(q.answer).toBeGreaterThanOrEqual(0);
      if (q.type === 'ctx') expect(q.options[q.answer].text).toBe(q.word.w);
      if (q.type === 'para') expect(q.options[q.answer].text).toBe(q.syn.w);
      if (q.type === 'use') expect(q.options[q.answer].sent.join('')).toBe(q.word.ex);
    }
  });
});
