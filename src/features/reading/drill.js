// 독해·청해 — 교재에서 푼 문제의 점수·틀린 문제를 적고, 틀린 문제를 날짜 맞춰 다시 풀기
// 저장 묶음 'drill' = { id: 기록 }. 기록 { id, date, section, mondai, chapter, page, label, total, correct, min, wrong: [오답] }
//   오답 { id, q: 문제 번호, mine: 내 답, answer: 정답, reason: 틀린 이유, note: 메모, rv: { step, due, done, hist: [{ d, ok }] } }
// 여기 함수는 저장을 모름: 목록(toList) 을 읽고, 기록 하나를 새로 만들어 돌려줌 → 화면이 save('drill', id, 기록)
import { addDays, parse, ymd } from '../../lib/dates';

export const SECTIONS = [
  { key: 'reading', label: '독해', ja: '読解' },
  { key: 'listening', label: '청해', ja: '聴解' },
];
export const secLabel = (k) => SECTIONS.find((s) => s.key === k)?.label || '';

// N1 문제 유형 (no = 시험지의 問題 번호, choices = 보기 개수)
export const MONDAI = [
  { key: 'r8', section: 'reading', no: 8, label: '내용 이해 (단문)', ja: '内容理解（短文）', choices: 4 },
  { key: 'r9', section: 'reading', no: 9, label: '내용 이해 (중문)', ja: '内容理解（中文）', choices: 4 },
  { key: 'r10', section: 'reading', no: 10, label: '내용 이해 (장문)', ja: '内容理解（長文）', choices: 4 },
  { key: 'r11', section: 'reading', no: 11, label: '통합 이해', ja: '統合理解', choices: 4 },
  { key: 'r12', section: 'reading', no: 12, label: '주장 이해 (장문)', ja: '主張理解（長文）', choices: 4 },
  { key: 'r13', section: 'reading', no: 13, label: '정보 검색', ja: '情報検索', choices: 4 },
  { key: 'l1', section: 'listening', no: 1, label: '과제 이해', ja: '課題理解', choices: 4 },
  { key: 'l2', section: 'listening', no: 2, label: '포인트 이해', ja: 'ポイント理解', choices: 4 },
  { key: 'l3', section: 'listening', no: 3, label: '개요 이해', ja: '概要理解', choices: 4 },
  { key: 'l4', section: 'listening', no: 4, label: '즉시 응답', ja: '即時応答', choices: 3 },
  { key: 'l5', section: 'listening', no: 5, label: '통합 이해', ja: '統合理解', choices: 4 },
];
export const mondaiOf = (k) => MONDAI.find((m) => m.key === k);

// 틀린 이유 (하나만)
export const REASONS = {
  reading: [['vocab', '단어를 몰라서'], ['grammar', '문법·표현'], ['misread', '잘못 읽음'], ['time', '시간 부족'], ['tricky', '보기 둘이 헷갈림']],
  listening: [['vocab', '단어를 몰라서'], ['missed', '못 알아들음'], ['memo', '메모를 놓침'], ['tricky', '보기 둘이 헷갈림'], ['speed', '말이 빨라서']],
};
export const reasonLabel = (sec, k) => (REASONS[sec] || []).find((r) => r[0] === k)?.[1] || '';

// 교재(다락원 한권으로 끝내기 N1) 독해·청해 장의 어림 시작 쪽. 장 이름만, 책 내용은 넣지 않음
export const CHAPTERS = [
  { key: 'r-short', t: '내용 이해 (단문·중문)', p: 370, mondai: 'r8' },
  { key: 'r-int', t: '통합 이해', p: 432, mondai: 'r11' },
  { key: 'r-arg', t: '주장 이해 (장문)', p: 456, mondai: 'r12' },
  { key: 'r-info', t: '정보 검색', p: 484, mondai: 'r13' },
  { key: 'l-task', t: '과제 이해', p: 512, mondai: 'l1' },
  { key: 'l-point', t: '포인트 이해', p: 548, mondai: 'l2' },
  { key: 'l-sum', t: '개요 이해', p: 584, mondai: 'l3' },
  { key: 'l-quick', t: '즉시 응답', p: 610, mondai: 'l4' },
  { key: 'l-int', t: '통합 이해', p: 636, mondai: 'l5' },
  { key: 'mock', t: '실전 모의고사', p: 664, mondai: null },
];
// 쪽 → 그 쪽이 들어 있는 장 (어림)
export function chapterAt(page) {
  if (!page || page < CHAPTERS[0].p) return null;
  let hit = null;
  for (const c of CHAPTERS) if (page >= c.p) hit = c;
  return hit;
}

// 다시 풀기 간격: 맞힐 때마다 1 → 3 → 7일 뒤, 세 번 맞히면 '알았음'. 틀리면 내일부터 다시
export const STEPS = [1, 3, 7];
const plus = (ds, n) => ymd(addDays(parse(ds), n));
const newId = () => (globalThis.crypto?.randomUUID ? crypto.randomUUID() : Date.now().toString(36) + Math.random().toString(36).slice(2, 9));

// 한 번 푼 기록 만들기 (고칠 때도 같은 함수 — 이미 있던 오답의 다시 풀기 상태는 그대로)
export function makeRecord(o) {
  const m = mondaiOf(o.mondai);
  if (!m) throw new Error('문제 유형을 골라 주세요');
  const total = Math.max(1, Math.min(200, Math.round(+o.total || 0)));
  const wrong = (o.wrong || []).slice(0, total).map((w) => ({
    id: w.id || newId(),
    q: String(w.q ?? '').trim(),
    mine: w.mine ?? null,
    answer: w.answer ?? null,
    reason: w.reason || '',
    note: (w.note || '').trim(),
    rv: w.rv || { step: 0, due: plus(o.date, STEPS[0]), done: false, hist: [] },
  }));
  return {
    id: o.id || newId(),
    date: o.date,
    section: m.section,
    mondai: m.key,
    chapter: o.chapter || '',
    page: o.page ? Math.round(+o.page) : null,
    label: (o.label || '').trim(), // 그 밖에 (예: '모의고사 1회')
    total,
    correct: total - wrong.length,
    min: o.min ? Math.max(0, Math.round(+o.min)) : 0, // 걸린 분
    wrong,
  };
}

const newer = (a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : (b.u || 0) - (a.u || 0));
// 맵 → 새것이 위인 목록
export const toList = (map) => Object.values(map || {}).filter((r) => r && r.mondai).sort(newer);

export const pct = (c, t) => (t ? Math.round((c / t) * 100) : 0);

// 유형별 정답률 · 흐름(오래된 것부터 회마다 %) · 최근 n회 평균
export function statsByMondai(list, recent = 5) {
  const out = {};
  for (const m of MONDAI) out[m.key] = { key: m.key, total: 0, correct: 0, count: 0, trend: [], pct: 0, recent: null };
  for (const r of list.slice().sort((a, b) => -newer(a, b))) {
    const o = out[r.mondai];
    if (!o) continue;
    o.total += r.total;
    o.correct += r.correct;
    o.count += 1;
    o.trend.push(pct(r.correct, r.total));
  }
  for (const o of Object.values(out)) {
    o.pct = pct(o.correct, o.total);
    const t = o.trend.slice(-recent);
    o.recent = t.length ? Math.round(t.reduce((a, b) => a + b, 0) / t.length) : null;
  }
  return out;
}

export function statsBySection(list) {
  const out = {};
  for (const s of SECTIONS) out[s.key] = { total: 0, correct: 0, min: 0, count: 0, pct: 0 };
  for (const r of list) {
    const o = out[r.section];
    if (!o) continue;
    o.total += r.total;
    o.correct += r.correct;
    o.min += r.min || 0;
    o.count += 1;
  }
  for (const o of Object.values(out)) o.pct = pct(o.correct, o.total);
  return out;
}

// 약한 유형: 3문제 이상 푼 것 중 최근 정답률이 80% 아래, 낮은 순
export const weakest = (list, n = 2) =>
  Object.values(statsByMondai(list))
    .filter((o) => o.total >= 3 && o.recent < 80)
    .sort((a, b) => a.recent - b.recent)
    .slice(0, n);

// 틀린 이유 순위 [[이유, 개수]]
export function reasonCounts(list, sec) {
  const m = {};
  for (const r of list) {
    if (sec && r.section !== sec) continue;
    for (const w of r.wrong) if (w.reason) m[w.reason] = (m[w.reason] || 0) + 1;
  }
  return Object.entries(m).sort((a, b) => b[1] - a[1]);
}

// 이어서 푼 날 수 (오늘 아직 안 했어도 어제까지 이어지면 셈)
export function streak(list, today) {
  const days = new Set(list.map((r) => r.date));
  let d = days.has(today) ? today : plus(today, -1);
  let n = 0;
  while (days.has(d)) {
    n += 1;
    d = plus(d, -1);
  }
  return n;
}

// 오답 전체 (기록 정보를 붙여서)
export const allWrong = (list) =>
  list.flatMap((r) => r.wrong.map((w) => ({ ...w, rec: r.id, date: r.date, section: r.section, mondai: r.mondai, page: r.page, label: r.label, chapter: r.chapter })));

// 오늘 다시 풀 것: 아직 '알았음' 아니고 날짜가 된 것, 오래 기다린 것부터
export const dueWrong = (list, today) =>
  allWrong(list)
    .filter((w) => !w.rv.done && w.rv.due <= today)
    .sort((a, b) => (a.rv.due < b.rv.due ? -1 : a.rv.due > b.rv.due ? 1 : a.date < b.date ? -1 : a.date > b.date ? 1 : (+a.q || 0) - (+b.q || 0)));

export function nextRv(rv, ok, today) {
  const hist = [...(rv.hist || []), { d: today, ok }];
  if (!ok) return { step: 0, due: plus(today, STEPS[0]), done: false, hist };
  const step = rv.step + 1;
  if (step >= STEPS.length) return { step, due: today, done: true, hist };
  return { step, due: plus(today, STEPS[step]), done: false, hist };
}

const patchWrong = (rec, wid, f) => ({ ...rec, wrong: rec.wrong.map((w) => (w.id === wid ? f(w) : w)) });
// 다시 풀어 본 결과 (ok = 맞힘) → 새 기록
export const markWrong = (rec, wid, ok, today) => patchWrong(rec, wid, (w) => ({ ...w, rv: nextRv(w.rv, ok, today) }));
// 바로 '알았음' / 다시 보기로 되돌리기 → 새 기록
export const setWrongDone = (rec, wid, done, today) =>
  patchWrong(rec, wid, (w) => ({ ...w, rv: done ? { ...w.rv, done: true } : { ...w.rv, done: false, step: 0, due: today } }));

// 그 날 공부한 분 { reading, listening }
export function minutesOn(list, day) {
  const out = { reading: 0, listening: 0 };
  for (const r of list) if (r.date === day && out[r.section] != null) out[r.section] += r.min || 0;
  return out;
}
