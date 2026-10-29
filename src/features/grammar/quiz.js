// 문법 퀴즈 규칙 (화면·저장과 상관없음)
//  문제 종류 fill 빈칸 고르기(시험 '문법형식 판단') · mean 문법 → 뜻 · form 뜻 → 문법
//  보기는 늘 4개, 뜻 문제의 틀린 보기는 같은 묶음(g)에서 먼저 골라 헷갈리게
import { GRAMMAR } from './data.js';

export const KINDS = [
  { k: 'fill', label: '빈칸 채우기' },
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

// 한 문제 만들기 → { id, kind, ask, sub, choices, answer }
export function makeQuestion(item, kind = 'fill', rand = Math.random) {
  if (kind === 'mean') {
    const answer = item.m;
    return { id: item.id, kind, ask: item.f, sub: '뜻이 맞는 것은?', answer, choices: shuffle([answer, ...others(item, 3, (x) => x.m, rand)], rand) };
  }
  if (kind === 'form') {
    const answer = item.f;
    return { id: item.id, kind, ask: item.m, sub: '이 뜻의 문법은?', answer, choices: shuffle([answer, ...others(item, 3, (x) => x.f, rand)], rand) };
  }
  const { s, a, w } = item.q;
  return { id: item.id, kind: 'fill', ask: s, sub: '（　）에 들어갈 가장 알맞은 것은?', answer: a, choices: shuffle([a, ...w], rand) };
}

// 한 판 만들기: ids 순서대로, 종류는 kinds 중 돌아가며(mix) 또는 하나
export function makeRound(ids, kinds = ['fill'], rand = Math.random) {
  return ids.filter((id) => byId[id]).map((id, i) => makeQuestion(byId[id], kinds[kinds.length > 1 ? Math.floor(rand() * kinds.length) : 0], rand));
}

// 퀴즈 결과 → 복습 주기 등급 (srs.js GRADES 1 다시 · 2 어려움 · 3 알맞음 · 4 쉬움)
//  틀림 → 1, 맞았지만 오래 걸림(12초+) → 2, 보통 → 3, 빨리(4초 안) → 4
export function gradeOf(ok, ms = 8000) {
  if (!ok) return 1;
  if (ms >= 12000) return 2;
  if (ms < 4000) return 4;
  return 3;
}

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
