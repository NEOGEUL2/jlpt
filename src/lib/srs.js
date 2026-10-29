// JLPT 복습 주기 (단어·문법이 같이 씀). 카드 상태 { d: 다음 날짜, i: 간격(일), e: 쉬움 정도(%), n: 맞힌 횟수, l: 틀린 횟수, t: 마지막 본 날 }
//  · 고르기 1 다시 · 2 어려움 · 3 알맞음 · 4 쉬움 (Anki 와 같은 4단계)
//  · 시험 날짜가 있으면 간격이 시험 전날을 넘지 않게 줄임 → 시험 전에 한 번씩은 다시 봄
import { addDays, diffDays, parse, ymd } from './dates';

// 시험 날 (JLPT 2026년 12월)
export const EXAM_DATE = '2026-12-06';

export const GRADES = [
  { g: 1, label: '다시', key: '1' },
  { g: 2, label: '어려움', key: '2' },
  { g: 3, label: '알맞음', key: '3' },
  { g: 4, label: '쉬움', key: '4' },
];

const E0 = 250;
const EMIN = 130;

// 다음 상태 (today 'YYYY-MM-DD', exam 시험 날짜 없으면 null)
export function grade(card, g, today, exam) {
  const c = card || {};
  const isNew = !c.t;
  let e = c.e || E0;
  let i = c.i || 0;
  let n = c.n || 0;
  let l = c.l || 0;
  if (g === 1) {
    l += isNew ? 0 : 1;
    e = Math.max(EMIN, e - 20);
    i = 0; // 오늘 안에 다시 (화면에서 몇 장 뒤에 또 보여 줌), 내일도 다시
  } else if (isNew || i === 0) {
    i = g === 2 ? 1 : g === 3 ? (isNew ? 1 : 2) : 4;
    n += 1;
    if (g === 4) e += 15;
  } else {
    if (g === 2) {
      i = Math.max(i + 1, Math.round(i * 1.2));
      e = Math.max(EMIN, e - 15);
    } else if (g === 3) i = Math.max(i + 1, Math.round((i * e) / 100));
    else {
      i = Math.max(i + 2, Math.round(((i * e) / 100) * 1.3));
      e += 15;
    }
    n += 1;
  }
  if (exam) {
    const left = diffDays(today, exam) - 1;
    if (left >= 1) i = Math.min(i, Math.max(1, Math.ceil(left / 2)));
  }
  const d = ymd(addDays(parse(today), i === 0 ? 1 : i));
  return { d, i, e, n, l, t: today };
}

// 다음 간격 미리 보기 ('10분' 대신 '다시'·'1일'·'3일'…)
export function preview(card, g, today, exam) {
  if (g === 1) return '다시';
  const { i } = grade(card, g, today, exam);
  return i < 30 ? `${i}일` : `${Math.round(i / 30)}달`;
}

export const isDue = (card, today) => !!card?.t && card.d <= today;

// 오늘 볼 카드: 복습(날짜 지난 순) + 새 카드(남은 몫만큼)
//  ids 순서 = 새 카드 나오는 순서, cards = { id: 상태 }, newLeft = 오늘 더 볼 새 카드 수
export function queue(ids, cards, today, newLeft) {
  const due = [];
  const fresh = [];
  for (const id of ids) {
    const c = cards[id];
    if (!c?.t) {
      if (!c?.skip && fresh.length < newLeft) fresh.push(id);
    } else if (c.d <= today && !c.skip) due.push(id);
  }
  due.sort((a, b) => cards[a].d.localeCompare(cards[b].d));
  return { due, fresh };
}

// 익힘 정도: 새 카드 · 배우는 중(간격 7일 미만) · 익힘(7일 이상)
export function maturity(ids, cards) {
  const out = { fresh: 0, learn: 0, known: 0 };
  for (const id of ids) {
    const c = cards[id];
    if (!c?.t) out.fresh += 1;
    else if (c.skip || c.i >= 7) out.known += 1;
    else out.learn += 1;
  }
  return out;
}
