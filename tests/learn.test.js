import { describe, expect, it } from 'vitest';
import { BASE, allWords } from '../src/features/words/words';
import { addConfused, answer, finishKana, forecast, isFast, isLeech, meaningOnly, needRead, paceNeed, learned, meaningChoices, newIds, reviewIds, reviewedToday, sameReading, toKana, waitingInfo } from '../src/features/words/learn';
import { isLong, kanjiIndex, kanjiInfo, kanjiOf, longAt, longNote, onHint, readingParts, siblings, soundsOf } from '../src/features/words/hanja';
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

describe('복습 강화', () => {
  const today = '2026-10-29';
  const now = 1_800_000_000_000;
  const due = (i, d = today, extra = {}) => ({ t: '2026-10-20', f: '2026-10-01', d, i, e: 250, n: 2, l: 0, ...extra });
  it('하루 상한: 배우는 중은 다, 나머지는 간격 짧은 것부터 남은 만큼', () => {
    const cards = { a: due(10), b: due(1), c: due(3), d: due(0, today, { ls: 1, la: now - 1 }), e: { t: today, f: '2026-10-01', d: '2026-11-01', i: 3 } };
    expect(reviewIds(Object.keys(cards), cards, today, now)).toEqual(['d', 'b', 'c', 'a']);
    expect(reviewedToday(cards, today)).toBe(1);
    expect(reviewIds(Object.keys(cards), cards, today, now, 3)).toEqual(['d', 'b', 'c']);
    expect(reviewIds(Object.keys(cards), cards, today, now, 1)).toEqual(['d']);
  });
  it('앞으로 7일 복습량 (밀린 것은 오늘)', () => {
    const cards = { a: due(1, '2026-10-20'), b: due(1, '2026-10-30'), c: due(1, '2026-11-04'), d: due(1, '2026-11-20'), s: { skip: 1, t: today, d: '9999-12-31' } };
    const fc = forecast(cards, today, 7);
    expect(fc.map((x) => x.n)).toEqual([1, 1, 0, 0, 0, 0, 1]);
    expect(fc[6].d).toBe('2026-11-04');
  });
  it('틀려도 처음부터가 아니라 원래 간격의 절반', () => {
    const c = due(12);
    const ng = answer(c, false, today, now, '2026-12-06');
    expect(ng.pi).toBe(12);
    const ok = answer(ng, true, today, now + 601e3, '2026-12-06');
    expect(ok).toMatchObject({ i: 6, d: '2026-11-04' });
    expect(ok.pi).toBeUndefined();
    expect(ok.ls).toBeUndefined();
  });
  it('안 외워지는 단어 · 헷갈리는 짝 · 기억 이야기는 복습해도 남음', () => {
    expect(isLeech(due(5, today, { l: 4 }))).toBe(true);
    expect(isLeech(due(25, today, { l: 6 }))).toBe(false);
    expect(isLeech(due(5, today, { l: 3 }))).toBe(false);
    let c = addConfused(due(5, today, { mn: '흙에 북돋아' }), 'x');
    c = addConfused(c, 'y');
    c = addConfused(c, 'x');
    expect(c.cf).toEqual(['x', 'y']);
    const next = answer(c, true, today, now, '2026-12-06');
    expect(next).toMatchObject({ mn: '흙에 북돋아', cf: ['x', 'y'] });
  });
});

describe('장음 · 한자마다 읽는 소리', () => {
  it('단어 읽기를 한자마다 나눔', () => {
    const r = (w, rd) => readingParts(w, rd).map((p) => (p.k ? `${p.k}=${p.r}` : p.kana)).join(' ');
    expect(r('道路', 'どうろ')).toBe('道=どう 路=ろ');
    expect(r('経営', 'けいえい')).toBe('経=けい 営=えい');
    expect(r('急増', 'きゅうぞう')).toBe('急=きゅう 増=ぞう');
    expect(r('取り扱う', 'とりあつかう')).toBe('取=と り 扱=あつか う');
    expect(soundsOf('道')[0].r).toBe('どう');
  });
  it('장음 자리와 한국 음 받침 규칙', () => {
    expect(longAt('どう')).toEqual([1]);
    expect(longAt('きゅう')).toEqual([2]);
    expect(longAt('せい')).toEqual([1]);
    expect(isLong('さい')).toBe(false);
    expect(isLong('ろ')).toBe(false);
    expect(longAt('おお')).toEqual([1]); // 大
    expect(longAt('とお')).toEqual([1]); // 遠·十
    expect(longAt('おかあさん')).toEqual([2]);
    expect(longAt('おにいさん')).toEqual([2]);
    expect(longAt('おねえさん')).toEqual([2]);
    expect(longAt('ちい')).toEqual([1]); // 小さい
    expect(longAt('コーヒー')).toEqual([1, 3]);
    expect(isLong('かい')).toBe(false);
    expect(isLong('あい')).toBe(false);
    expect(longNote('소', 'ちい')).toBe(''); // 小さい 훈독
    expect(longNote('형', 'にい')).toBe('');
    expect(longNote('경', 'けい')).toMatch('규칙대로');
    expect(longNote('회', 'かい')).toMatch('짧게');
    expect(longNote('도', 'どう')).toBe('받침 없는데 길게 · 외워 두기');
    expect(longNote('로', 'ろ')).toBe('받침 없음 → 짧게');
    expect(longNote('영', 'えい')).toBe('받침 ㅇ → 길게 (규칙대로)');
    expect(longNote('급', 'きゅう')).toBe('받침 ㅂ → 길게 (규칙대로)');
  });
});

describe('학습량 늘리기', () => {
  const today = '2026-10-29';
  const now = 1_800_000_000_000;
  const exam = '2026-12-06';
  const w = { id: '道路|どうろ', w: '道路', r: 'どうろ', m: '도로' };
  it('빨리 맞힌 복습은 쉬움 → 간격 더 길게, 배우는 중 졸업은 그대로', () => {
    const c = { t: '2026-10-25', f: '2026-10-20', d: today, i: 4, e: 250, n: 2, l: 0 };
    const slow = answer(c, true, today, now, exam);
    const fast = answer(c, true, today, now, exam, { fast: true });
    expect(fast.i).toBeGreaterThan(slow.i);
    expect(fast.e).toBe(265);
    const ls = learned({}, today, now);
    expect(answer(ls, true, today, now + 601e3, exam, { fast: true }).i).toBe(1);
  });
  it('빨리 = 뜻 3초 안, 읽기는 길이만큼', () => {
    expect(isFast(w, { mean: 2000 })).toBe(true);
    expect(isFast(w, { mean: 4000 })).toBe(false);
    expect(isFast(w, { mean: 2000, read: 5000 })).toBe(true);
    expect(isFast(w, { mean: 2000, read: 9000 })).toBe(false);
    expect(isFast(w, {})).toBe(false);
  });
  it('읽기는 필요할 때만: 배우는 중·7일 미만·읽기 틀린 뒤·세 번에 한 번', () => {
    const mature = { t: '2026-10-20', i: 9, n: 4, l: 0 };
    expect(needRead(w, mature)).toBe(false);
    expect(needRead(w, mature, 'all')).toBe(true);
    expect(needRead(w, { ...mature, n: 3 })).toBe(true);
    expect(needRead(w, { ...mature, i: 3 })).toBe(true);
    expect(needRead(w, { ...mature, ls: 1 })).toBe(true);
    expect(needRead({ w: 'テスト', r: 'てすと' }, { t: today, i: 0 })).toBe(false);
    // 읽기를 틀리면 rx 2 → 두 번 맞혀야 빠짐
    const ng = answer(mature, true, today, now, exam, { read: false });
    expect(ng.rx).toBe(2);
    expect(needRead(w, { ...ng, i: 9, n: 4 })).toBe(true);
    const ok1 = answer({ ...ng, i: 9, n: 4 }, true, today, now, exam, { read: true });
    expect(ok1.rx).toBe(1);
    expect(answer(ok1, true, today, now, exam, { read: true }).rx).toBeUndefined();
    // 배우는 중으로 틀려도 rx 는 남음
    expect(answer({ ...ng, ls: 1 }, false, today, now, exam, { read: false }).rx).toBe(2);
  });
  it("거르기 '뜻만 알아요' → 내일 복습, 읽기 꼭 침, 오늘 새 단어 수엔 안 셈", () => {
    const c = meaningOnly(today);
    expect(c).toMatchObject({ t: today, d: '2026-10-30', rx: 2 });
    expect(c.f).toBeUndefined();
    expect(needRead(w, { ...c, i: 9 })).toBe(true);
    expect(reviewIds(['a'], { a: c }, '2026-10-30', now)).toEqual(['a']);
  });
  it('시험 1주 전까지 다 보려면 하루 몇 개', () => {
    expect(paceNeed(6000, 38)).toBe(200);
    expect(paceNeed(0, 38)).toBe(0);
    expect(paceNeed(100, 3)).toBe(100);
  });
  it('새 단어 순서: N1 먼저 · 섞어서', () => {
    const exam1 = allWords({}, ['N3', 'N2', 'N1'], 'exam');
    expect(exam1[0].lv).toBe('N1');
    expect(exam1.at(-1).lv).toBe('N3');
    const mix = allWords({}, ['N3', 'N2', 'N1'], 'mix');
    expect(mix.length).toBe(exam1.length);
    const first = mix.slice(0, 60).map((x) => x.lv);
    for (const lv of ['N3', 'N2', 'N1']) expect(first).toContain(lv);
    expect(allWords({}, ['N3', 'N1'])[0].lv).toBe('N3');
  });
});
