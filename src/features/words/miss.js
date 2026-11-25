// 틀린 단어 모음: 안다고 했는데 틀린 단어(거르기 알아요→틀림 · 복습 틀림 · 읽기 퀴즈 틀림)를 날짜마다 모아 둠
//  · 묶음 'miss' (서버 표 jlpt_data 에 key='miss' 로 같이 올라감 — 새 SQL 필요 없음)
//  · 기록 id = '날짜|단어 id' → { day, at, last, wid, w, r, m, lv, how:[…], said:[내가 쓴 읽기…], other:[{w,r,m} 대신 고른 말], n, note }
//  · missText(list) = 대화창에 붙여 넣을 짧은 글
import { getData, remove, save } from '../../lib/store';
import { todayStr } from '../../lib/dates';

export const HOW = {
  'sort-know': '알아요→틀림',
  'sort-read': '알아요→읽기 틀림',
  'sort-mean': '뜻만 알아요→틀림',
  read: '복습 읽기 틀림',
  mean: '복습 뜻 틀림',
  yomi: '읽기 퀴즈 틀림',
};

const uniq = (a) => [...new Set(a)];

// 순수 함수: 지금 기록 + 이번 틀림 → 새 기록
export function addMiss(cur, w, how, { said, other } = {}, day = todayStr(), now = Date.now()) {
  const others = [...(cur?.other || [])];
  if (other && other.w !== w.w && !others.some((o) => o.w === other.w)) others.push({ w: other.w, r: other.r, m: other.m });
  return {
    day,
    at: cur?.at || now,
    last: now,
    wid: w.id,
    w: w.w,
    r: w.r,
    m: w.m,
    lv: w.lv || '',
    how: uniq([...(cur?.how || []), how]),
    said: uniq([...(cur?.said || []), said].filter(Boolean)).slice(-3),
    other: others.slice(-3),
    n: (cur?.n || 0) + 1,
    ...(cur?.note ? { note: cur.note } : {}),
  };
}

// 저장. 되돌리기용으로 그 전 기록(없으면 null)을 돌려줌
export function logMiss(w, how, extra) {
  if (!w) return null;
  const id = `${todayStr()}|${w.id}`;
  const prev = getData('miss')[id] || null;
  save('miss', id, (cur) => addMiss(cur, w, how, extra));
  return { id, prev };
}
export function undoMiss(m) {
  if (!m) return;
  if (m.prev) save('miss', m.id, () => m.prev);
  else remove('miss', m.id);
}

export const missesOn = (map, from, to = from) =>
  Object.entries(map)
    .filter(([, x]) => x.day >= from && x.day <= to)
    .map(([id, x]) => ({ id, ...x }))
    .sort((a, b) => (a.day === b.day ? a.at - b.at : a.day < b.day ? -1 : 1));

export function missLine(x) {
  const parts = [`${x.w}${x.r && x.r !== x.w ? `（${x.r}）` : ''} ${x.m}`];
  if (x.said?.length) parts.push(`내가 쓴 읽기: ${x.said.join(', ')}`);
  if (x.other?.length) parts.push(`헷갈린 말: ${x.other.map((o) => `${o.w}${o.r && o.r !== o.w ? `（${o.r}）` : ''} ${o.m}`).join(' / ')}`);
  parts.push((x.how || []).map((h) => HOW[h] || h).join('·') + (x.n > 1 ? ` ×${x.n}` : ''));
  if (x.note) parts.push(`메모: ${x.note}`);
  return `- ${parts.join(' | ')}`;
}

export function missText(list, label) {
  if (!list.length) return '';
  return [`[JLPT 틀린 단어 ${label} · ${list.length}개]`, ...list.map(missLine)].join('\n');
}
