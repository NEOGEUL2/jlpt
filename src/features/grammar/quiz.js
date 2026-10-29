// 문법 퀴즈 규칙 (화면·저장과 상관없음)
//  문제 종류 fill 빈칸 고르기(시험 '문법형식 판단') · star ★ 문장 만들기(시험 '문장 조립') · mean 문법 → 뜻 · form 뜻 → 문법
//  보기는 늘 4개, 뜻 문제의 틀린 보기는 같은 묶음(g)에서 먼저 골라 헷갈리게
//  빈칸 문제는 문법마다 문장이 3개(data.js q + more.js x) — 볼 때마다 돌아가며 (같은 문장만 외우지 않게)
import { GRAMMAR } from './data.js';
import { MORE } from './more.js';
import { glossOf } from './gloss.js';

export const KINDS = [
  { k: 'fill', label: '빈칸 채우기' },
  { k: 'star', label: '★ 문장 만들기' },
  { k: 'mean', label: '뜻 고르기' },
  { k: 'form', label: '문법 고르기' },
];

export const byId = Object.fromEntries(GRAMMAR.map((g) => [g.id, g]));
export const GROUPS = [...new Set(GRAMMAR.map((g) => g.g))];

// 시드 있는 섞기 (테스트에서 같은 결과)
export function rng(seed = Date.now()) {
  let s = seed >>> 0 || 1;
  return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 2 ** 32);
}
export function shuffle(arr, rand = Math.random) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// 뜻 조각: '~하자마자 (주로 남의 행동)' → ['~하자마자'] — 조각이 겹치면 정답이 둘이 되니 보기에서 뺌
const pieces = (m) => m.replace(/\([^)]*\)/g, '').split(/[,/]/).map((x) => x.trim()).filter(Boolean);
export const sameMeaning = (a, b) => pieces(a.m).some((x) => pieces(b.m).includes(x));

// 다른 문법에서 틀린 보기 n개: 같은 묶음 먼저, 모자라면 아무거나 (뜻이 겹치는 건 빼고)
function others(item, n, pick, rand) {
  const ok = (x) => x.id !== item.id && !sameMeaning(x, item);
  const same = shuffle(GRAMMAR.filter((x) => ok(x) && x.g === item.g), rand);
  const rest = shuffle(GRAMMAR.filter((x) => ok(x) && x.g !== item.g), rand);
  const out = [];
  for (const x of [...same, ...rest]) {
    const v = pick(x);
    if (v !== pick(item) && !out.includes(v)) out.push(v);
    if (out.length === n) break;
  }
  return out;
}

export const moreOf = (id) => MORE[id] || {};

// more.js 문장 '…【답】…' → { s '…（　）…', a 답 } (【】 둘이면 'A / B')
export function cloze(j) {
  const a = [...j.matchAll(/【([^】]+)】/g)].map((m) => m[1]);
  return { s: j.replace(/【[^】]+】/g, '（　）'), a: a.join(' / '), full: j.replace(/[【】]/g, '') };
}

// 빈칸 문제 문장들: [{ s, a, w, k 한국어, full 답 넣은 문장 }]
export function sentences(item) {
  const m = moreOf(item.id);
  const base = { ...item.q, k: m.qk || '', full: fillIn(item.q.s, item.q.a) };
  return [base, ...(m.x || []).map(([j, k, w]) => ({ ...cloze(j), w, k }))];
}
const fillIn = (s, a) => {
  const parts = a.split(' / ');
  let i = 0;
  return s.replace(/（　）/g, () => parts[i++] ?? parts[0]);
};

// 보기 뜻 { 보기: { f, m } } — 답이 나온 뒤 '다른 보기는 무슨 뜻이었나'
function notesFor(item, kind, choices) {
  const out = {};
  for (const c of choices) {
    if (kind === 'mean') {
      const g = GRAMMAR.find((x) => x.m === c);
      if (g) out[c] = { f: g.f, m: g.m };
    } else if (kind === 'form') {
      const g = GRAMMAR.find((x) => x.f === c);
      if (g) out[c] = { f: g.f, m: g.m };
    } else {
      out[c] = glossOf(c) || { f: c, m: '' };
    }
  }
  return out;
}

// 한 문제 만들기 → { id, kind, ask, sub, choices, answer, notes, k?, full? }
//  v: 빈칸 문제의 몇 번째 문장 (볼 때마다 하나씩 넘김)
export function makeQuestion(item, kind = 'fill', rand = Math.random, v = 0) {
  if (kind === 'star' && !moreOf(item.id).st) kind = 'fill';
  if (kind === 'mean') {
    const answer = item.m;
    const choices = shuffle([answer, ...others(item, 3, (x) => x.m, rand)], rand);
    return { id: item.id, kind, ask: item.f, sub: '뜻이 맞는 것은?', answer, choices, notes: notesFor(item, kind, choices) };
  }
  if (kind === 'form') {
    const answer = item.f;
    const choices = shuffle([answer, ...others(item, 3, (x) => x.f, rand)], rand);
    return { id: item.id, kind, ask: item.m, sub: '이 뜻의 문법은?', answer, choices, notes: notesFor(item, kind, choices) };
  }
  if (kind === 'star') {
    const [pre, order, post, star] = moreOf(item.id).st;
    // 조각마다 번호(같은 글자 조각이 있어도 구별)
    const pieces = shuffle(order.map((t, i) => ({ t, i })), rand);
    return { id: item.id, kind, sub: '순서대로 눌러 문장을 만들고, ★ 자리를 맞혀요', pre, post, order, star, pieces, answer: order[star], full: pre + order.join('') + post };
  }
  const list = sentences(item);
  const n = ((v % list.length) + list.length) % list.length;
  const { s, a, w, k, full } = list[n];
  const choices = shuffle([a, ...w], rand);
  return { id: item.id, kind: 'fill', v: n, ask: s, sub: '（　）에 들어갈 가장 알맞은 것은?', answer: a, choices, k, full, notes: notesFor(item, 'fill', choices) };
}

// 한 판 만들기: ids 순서대로, 종류는 kinds 중 아무거나(mix) 또는 하나
//  seenOf(id) → 지금까지 본 횟수 (빈칸 문장 돌리기), isNew(id) → 처음 보는 문법이면 소개 카드 먼저
export function makeRound(ids, kinds = ['fill'], rand = Math.random, { seenOf = () => 0, isNew = () => false } = {}) {
  return ids
    .filter((id) => byId[id])
    .map((id) => {
      const fresh = isNew(id);
      // 처음 보는 문법은 쉬운 형식(빈칸·뜻)으로 — ★는 익숙해진 뒤에
      const pool = fresh ? kinds.filter((k) => k !== 'star') : kinds;
      const ks = pool.length ? pool : ['fill'];
      const q = makeQuestion(byId[id], ks[ks.length > 1 ? Math.floor(rand() * ks.length) : 0], rand, seenOf(id));
      return fresh ? { ...q, intro: true } : q;
    });
}

// 같은 판에서 틀린 문제 다시: 빈칸이면 다른 문장으로, 나머지는 보기만 섞어서
export function againOf(q, rand = Math.random) {
  if (q.kind === 'fill') return { ...makeQuestion(byId[q.id], 'fill', rand, (q.v || 0) + 1), again: true };
  if (q.kind === 'star') return { ...q, again: true, pieces: shuffle(q.pieces, rand) };
  return { ...q, again: true, choices: shuffle(q.choices, rand) };
}

// 퀴즈 결과 → 복습 주기 등급 (srs.js GRADES 1 다시 · 2 어려움 · 3 알맞음 · 4 쉬움)
//  틀림 → 1, 맞았지만 오래 걸림(12초+) → 2, 보통 → 3, 빨리(4초 안) → 4
//  ★ 문장 만들기는 조각 네 개를 누르니 시간을 넉넉히 (30초+ 어려움, 10초 안 쉬움)
export function gradeOf(ok, ms = 8000, kind = 'fill') {
  if (!ok) return 1;
  const [slow, fast] = kind === 'star' ? [30000, 10000] : [12000, 4000];
  if (ms >= slow) return 2;
  if (ms < fast) return 4;
  return 3;
}

// 같은 묶음 문법 (소개 카드 '비슷한 문법')
export const siblings = (item) => GRAMMAR.filter((x) => x.g === item.g && x.id !== item.id);

// 틀린 문법 모음: 카드 상태 { l: 틀린 횟수 } 많은 순
export function weakList(cards, n = 20) {
  return Object.entries(cards || {})
    .filter(([id, c]) => byId[id] && c?.l > 0)
    .sort((a, b) => b[1].l - a[1].l || (a[1].t || '').localeCompare(b[1].t || ''))
    .slice(0, n)
    .map(([id]) => id);
}

// 오늘 할 문법: 복습(날짜 지남) + 새 문법(newLeft개), 데이터 순서
export function todayIds(cards, today, newLeft, queue) {
  const { due, fresh } = queue(GRAMMAR.map((g) => g.id), cards || {}, today, newLeft);
  return [...due, ...fresh];
}
