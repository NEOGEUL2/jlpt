// N1 문자·어휘 모양 문제 (예문 있는 단어로 만듦)
//  · ctx 문맥규정: 예문 빈칸에 맞는 말 고르기 (보기는 기본형)
//  · para 言い換え: 밑줄 친 말과 뜻이 가까운 말 고르기 (한국어 뜻 조각이 겹치는 단어끼리)
//  · use 用法: 그 말을 바르게 쓴 문장 고르기 (다른 단어 예문에 이 말을 넣은 것이 틀린 보기, 명사·형용사·부사만)
import { splitExample } from './words';
import { meaningBits } from './learn';

const shuffle = (a, rnd = Math.random) => {
  const x = [...a];
  for (let i = x.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [x[i], x[j]] = [x[j], x[i]];
  }
  return x;
};
const overlap = (a, b) => {
  const B = new Set(meaningBits(b));
  return meaningBits(a).some((x) => B.has(x));
};

// 예문 속 단어 자리 (활용 꼬리까지) → [앞, 자리, 뒤] · 못 찾으면 null
// 활용 꼬리: 바뀐 끝 글자 + て·た·ない… + いる·きた… (凌|いでいる, 培|った, 携わ|ってきた)
const TAIL = /^[ぁ-ゖ]?(?:って|んで|いて|いで|して|った|んだ|いた|いだ|した|なかった|ました|ません|ます|ない|られる|させる|れる|せる|かった|て|で|た|だ|ず|ば)?(?:いました|います|いる|いた|しまった|しまう|おく|きた|くる)?/;
export function slotOf(ex, w) {
  if (!ex) return null;
  const [a, b, c] = splitExample(ex, w);
  if (!b) return null;
  if (b === w) return [a, b, c];
  const t = c.match(TAIL)?.[0] || '';
  return [a, b + t, c.slice(t.length)];
}
const exact = (x) => {
  const s = slotOf(x.ex, x.w);
  return s && s[1] === x.w ? s : null;
};

// 겉모양: 동사는 끝 글자, い형용사, 가타카나 말, 나머지는 묶음
const KATA = /^[ァ-ヿー・]+$/;
const shape = (x) => (x.set === '동사' ? `v${x.w.slice(-1)}` : KATA.test(x.w) ? 'kata' : x.set === '형용사·부사' && x.w.endsWith('い') ? 'adj' : x.set);
// 틀린 보기 단어: 같은 묶음(동사·명사…) 먼저, 동사는 끝 글자 같은 것, 뜻 안 겹치게
function distract(t, pool, n, rnd, avoid = []) {
  const ok = (x) => x.id !== t.id && x.w !== t.w && x.r !== t.r && !overlap(x.m, t.m) && !avoid.some((a) => a.w === x.w || overlap(a.m, x.m));
  const near = pool.filter((x) => ok(x) && shape(x) === shape(t));
  const same = pool.filter((x) => ok(x) && (x.set === t.set || t.set === '교재'));
  const out = [];
  for (const x of [...shuffle(near, rnd), ...shuffle(same, rnd), ...shuffle(pool.filter(ok), rnd)]) {
    if (out.length >= n) break;
    if (!out.some((o) => o.w === x.w || overlap(o.m, x.m))) out.push(x);
  }
  return out;
}

function ctxQ(t, pool, rnd) {
  const s = slotOf(t.ex, t.w);
  if (!s) return null;
  const opts = distract(t, pool, 3, rnd);
  if (opts.length < 3) return null;
  const options = shuffle([t, ...opts], rnd).map((x) => ({ id: x.id, text: x.w, sub: x.r, m: x.m }));
  return { type: 'ctx', word: t, sent: s, options, answer: options.findIndex((o) => o.id === t.id) };
}

function paraQ(t, pool, rnd) {
  if (t.en) return null;
  const s = slotOf(t.ex, t.w);
  if (!s) return null;
  const syn = shuffle(pool.filter((x) => !x.en && x.id !== t.id && x.w !== t.w && x.r !== t.r && overlap(x.m, t.m)), rnd)[0];
  if (!syn) return null;
  const opts = distract(t, pool.filter((x) => !x.en), 3, rnd, [syn]);
  if (opts.length < 3) return null;
  const options = shuffle([syn, ...opts], rnd).map((x) => ({ id: x.id, text: x.w, sub: x.r, m: x.m }));
  return { type: 'para', word: t, syn, sent: s, options, answer: options.findIndex((o) => o.id === syn.id) };
}

function useQ(t, pool, rnd) {
  if (t.set === '동사' || t.set === '교재') return null;
  const s = exact(t);
  if (!s) return null;
  const others = shuffle(pool.filter((x) => x.id !== t.id && x.set === t.set && x.w !== t.w && !overlap(x.m, t.m) && exact(x)), rnd).slice(0, 3);
  if (others.length < 3) return null;
  const wrong = others.map((x) => {
    const [a, , c] = exact(x);
    return { id: x.id, sent: [a, t.w, c], from: x };
  });
  const options = shuffle([{ id: t.id, sent: s }, ...wrong], rnd);
  return { type: 'use', word: t, options, answer: options.findIndex((o) => o.id === t.id) };
}

const MAKERS = { ctx: ctxQ, para: paraQ, use: useQ };
export const TYPES = [
  ['ctx', '문맥 (빈칸)'],
  ['para', '言い換え (비슷한 말)'],
  ['use', '用法 (쓰임)'],
];

// n 문제: 본 적 있는 단어(약한 것 먼저) → 모자라면 안 본 단어. 종류는 돌아가며
export function makeQuiz(words, cards, n = 10, rnd = Math.random, kinds = ['ctx', 'para', 'use']) {
  const withEx = words.filter((w) => w.ex);
  const seen = shuffle(withEx.filter((w) => cards[w.id]?.t && !cards[w.id]?.skip), rnd).sort((a, b) => (cards[b.id].l || 0) - (cards[a.id].l || 0));
  const rest = shuffle(withEx.filter((w) => !(cards[w.id]?.t && !cards[w.id]?.skip)), rnd);
  const out = [];
  const used = new Set();
  let k = 0;
  for (const t of [...seen, ...rest]) {
    if (out.length >= n) break;
    if (used.has(t.id)) continue;
    // 이번 차례 종류부터 해 보고, 안 되면 다른 종류
    for (let j = 0; j < kinds.length; j++) {
      const kind = kinds[(k + j) % kinds.length];
      const q = MAKERS[kind](t, words, rnd);
      if (q) {
        out.push(q);
        used.add(t.id);
        k += 1;
        break;
      }
    }
  }
  return out;
}
