// 단어 묶음 (화면 없이 테스트할 수 있게)
//  · noGuess: 한자(한국 음)로 뜻·소리를 짐작할 수 없는 말 — 훈독 말·히라가나 말·가타카나 말 (N2·N1·교재)
//    한국 사람은 음독 한자어는 한국 한자음 덕을 보지만, 이런 말은 기댈 곳이 없어 따로 예문과 함께 돌려야 함
//  · confusablePairs: 이미 배운 단어 가운데 헷갈리는 짝 (뜻 고르기에서 잘못 고른 짝 cf + 한국어 뜻 조각이 겹치는 짝)
//    처음 배울 때 비슷한 말을 같이 배우면 서로 방해하므로, 둘 다 배운 뒤에만 섞어서 구별 연습
import { hasKanji, isKatakana } from './words';
import { wordKinds } from './kanji';
import { meaningBits } from './learn';

const memo = new Map();
export function guessKind(w) {
  if (memo.has(w.id)) return memo.get(w.id);
  let k = '';
  if (isKatakana(w.w)) k = 'kata';
  else if (!hasKanji(w.w)) k = 'kana';
  else {
    const t = wordKinds(w.w, w.r)?.type;
    if (t === 'kun' || t === 'yuto' || t === 'special') k = 'kun';
  }
  memo.set(w.id, k);
  return k;
}
export const GUESS_KO = { kun: '훈독 말', kana: '히라가나 말', kata: '가타카나 말' };
export const noGuess = (w) => w.lv !== 'N3' && !!guessKind(w);

const usable = (c) => c?.t && !c.skip;

// → [[a, b], …] 많아야 n 짝. 틀린 적 많은 것 먼저, 같은 단어는 한 짝에만
export function confusablePairs(pool, cards, n = 10) {
  const byId = new Map(pool.map((w) => [w.id, w]));
  const seen = pool.filter((w) => usable(cards[w.id]));
  const out = [];
  const used = new Set();
  const key = (a, b) => [a.id, b.id].sort().join('~');
  const keys = new Set();
  const add = (a, b, why) => {
    if (!a || !b || a.id === b.id || a.w === b.w || a.m === b.m || used.has(a.id) || used.has(b.id) || keys.has(key(a, b))) return;
    // 뜻만 보고 가를 수 있어야 함: 적어도 한쪽은 저만 가진 뜻 조각이 있게
    if (!pairBits(a, b).own.length && !pairBits(b, a).own.length) return;
    keys.add(key(a, b));
    used.add(a.id);
    used.add(b.id);
    out.push({ a, b, why });
  };
  const weak = [...seen].sort((x, y) => (cards[y.id].l || 0) - (cards[x.id].l || 0));
  // 1) 실제로 헷갈렸던 짝
  for (const w of weak) for (const o of cards[w.id].cf || []) if (usable(cards[o])) add(w, byId.get(o), 'cf');
  // 2) 한국어 뜻 조각이 겹치는 짝 (같은 뜻 조각을 가진 배운 단어)
  const bit = new Map();
  for (const w of seen) {
    if (w.en) continue;
    for (const b of meaningBits(w.m)) {
      if (!bit.has(b)) bit.set(b, []);
      bit.get(b).push(w);
    }
  }
  for (const w of weak) {
    if (w.en) continue;
    for (const b of meaningBits(w.m)) for (const o of bit.get(b) || []) if (o.id !== w.id && o.set === w.set) add(w, o, 'mean');
    for (const b of meaningBits(w.m)) for (const o of bit.get(b) || []) if (o.id !== w.id) add(w, o, 'mean');
  }
  return out.slice(0, n);
}

// 같은 뜻 조각 · 이 단어만 가진 뜻 조각
export function pairBits(a, b) {
  const A = meaningBits(a.m);
  const B = new Set(meaningBits(b.m));
  return { same: A.filter((x) => B.has(x)), own: A.filter((x) => !B.has(x)) };
}

const shuffle = (a, rnd = Math.random) => {
  const x = [...a];
  for (let i = x.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [x[i], x[j]] = [x[j], x[i]];
  }
  return x;
};
// 짝마다 두 문제 (a 뜻 → a, b 뜻 → b). 앞 절반에 짝마다 하나, 뒤 절반에 나머지 → 같은 짝은 떨어져 나옴(섞어 풀기)
//  보기: 짝 두 단어 + 다른 배운 단어 2개
export function pairQuiz(pairs, pool, cards, rnd = Math.random) {
  const others = pool.filter((w) => usable(cards[w.id]));
  const ask = (t, o) => {
    const ids = new Set([t.id, o.id]);
    const fill = shuffle(others.filter((x) => !ids.has(x.id) && x.m !== t.m && !meaningBits(x.m).some((b) => meaningBits(t.m).includes(b))), rnd).slice(0, 2);
    return { word: t, mate: o, options: shuffle([t, o, ...fill], rnd) };
  };
  // 저만 가진 뜻 조각이 없는 쪽은 묻지 않음 (多少 '다소' ↔ やや '약간, 다소' 이면 やや 만 물음)
  const can = (t, o) => pairBits(t, o).own.length > 0;
  const first = shuffle(pairs.map((p) => (can(p.a, p.b) ? ask(p.a, p.b) : ask(p.b, p.a))), rnd);
  const second = shuffle(pairs.filter((p) => can(p.a, p.b) && can(p.b, p.a)).map((p) => ask(p.b, p.a)), rnd);
  return [...first, ...second];
}
