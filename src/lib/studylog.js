// 공부 시간 기록 → 서버 표 study_log (한 번 공부 = 한 줄) → 기록(Girok) 앱이 읽어서 공부 화면·일지에 보여 줌
//  · 한 줄 { id, day 'YYYY-MM-DD', at 시작 ms, sec, part, n 푼 개수, ok 맞힌 개수, learned 새로 익힌 단어, what 짧은 이름 }
//  · part: vocab 단어 · grammar 문법 · reading 독해 · listening 청해 · other 기타
//  · 화면에서:
//      const t = useStudyTimer('vocab', '단어 카드')  → t.sec · t.paused · t.add({ n, ok, learned }) · t.finish()
//      (React 밖) const t = startTimer('grammar', '문법 퀴즈'); t.add({ n: 1, ok: 1 }); t.finish(); t.stop()
//      끝난 걸 바로: logStudy({ part: 'reading', sec: 1200, n: 10, ok: 8, what: '책 독해' })
//  · 이 기기 localStorage 'jlpt:study'(최근 기록) · 'jlpt:study-q'(아직 안 올린 id). 인터넷·로그인 되면 올림. 서버가 없어도 이 기기엔 남음
//  · 표 만드는 SQL = STUDY_SQL (Girok sync.js STUDY_SQL 과 똑같이 유지)
import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { currentSession, supabase, onCloudChange } from './supabase';
import { addDays, ymd } from './dates';

export const STUDY_SQL = `-- 기록: JLPT 공부 앱 공부 기록 (한 번 공부 = 한 줄, 나만 읽고 쓸 수 있게, 여러 번 실행해도 괜찮음)
create table if not exists public.study_log (
  id text primary key,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  day date not null,
  at bigint not null,
  sec integer not null default 0,
  part text not null default 'other',
  n integer not null default 0,
  ok integer not null default 0,
  learned integer not null default 0,
  what text,
  updated_at timestamptz not null default now()
);
create index if not exists study_log_user_day on public.study_log (user_id, day);

alter table public.study_log enable row level security;
drop policy if exists "own study select" on public.study_log;
drop policy if exists "own study insert" on public.study_log;
drop policy if exists "own study update" on public.study_log;
drop policy if exists "own study delete" on public.study_log;
create policy "own study select" on public.study_log for select to authenticated using (auth.uid() = user_id);
create policy "own study insert" on public.study_log for insert to authenticated with check (auth.uid() = user_id);
create policy "own study update" on public.study_log for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own study delete" on public.study_log for delete to authenticated using (auth.uid() = user_id);
grant select, insert, update, delete on public.study_log to authenticated;
`;

export const STUDY_PARTS = [
  ['vocab', '단어'],
  ['grammar', '문법'],
  ['reading', '독해'],
  ['listening', '청해'],
  ['other', '기타'],
];
export const partName = (p) => (STUDY_PARTS.find(([k]) => k === p) || STUDY_PARTS[4])[1];
const PART_KEYS = STUDY_PARTS.map(([k]) => k);

const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
const dayOf = (ms) => ymd(new Date(ms));
const num = (v) => Math.max(0, Math.round(Number(v) || 0));

// 저장할 한 줄로 다듬기 (빈 칸은 뺌, 이상한 값은 고침)
export function cleanRow(s, now = Date.now()) {
  const at = Number(s.at) || now;
  const out = { id: String(s.id || uid()), day: String(s.day || dayOf(at)).slice(0, 10), at, sec: num(s.sec), part: PART_KEYS.includes(s.part) ? s.part : 'other' };
  for (const k of ['n', 'ok', 'learned']) if (num(s[k])) out[k] = num(s[k]);
  if (s.what) out.what = String(s.what).slice(0, 60);
  return out;
}
// 서버로 보낼 모양 (빈 칸은 0)
export const toServer = (r) => ({ id: r.id, day: r.day, at: r.at, sec: r.sec, part: r.part, n: r.n || 0, ok: r.ok || 0, learned: r.learned || 0, what: r.what || null, updated_at: new Date().toISOString() });

// 서버 것과 이 기기 것 합치기: 아직 안 올린(queue) 줄은 이 기기 것, 나머지는 서버 것. 받은 기간(since~) 밖은 그대로
export function mergeRows(local, server, queue, since) {
  const mine = new Map((local || []).map((r) => [r.id, r]));
  const q = new Set(queue || []);
  const out = new Map();
  for (const r of local || []) if (r.day < since || q.has(r.id)) out.set(r.id, r);
  for (const r of server || []) {
    const c = cleanRow(r);
    if (!q.has(c.id)) out.set(c.id, c);
    else if (!mine.has(c.id)) out.set(c.id, c);
  }
  return [...out.values()].sort((a, b) => a.at - b.at);
}

/* ───────── 이 기기 저장 ───────── */
const LS = 'jlpt:study';
const LQ = 'jlpt:study-q';
const KEEP_DAYS = 400;
const readJSON = (k, d) => {
  try {
    return JSON.parse(localStorage.getItem(k)) ?? d;
  } catch {
    return d;
  }
};
const writeJSON = (k, v) => {
  try {
    localStorage.setItem(k, JSON.stringify(v));
  } catch {
    /* 가득 차도 이번엔 화면에 씀 */
  }
};
let rows = readJSON(LS, []);
let queue = readJSON(LQ, []);
const subs = new Set();
function setRows(next) {
  const cut = ymd(addDays(new Date(), -KEEP_DAYS));
  rows = next.filter((r) => r.day >= cut);
  writeJSON(LS, rows);
  subs.forEach((f) => f());
}
function enqueue(id) {
  if (!queue.includes(id)) {
    queue = [...queue, id];
    writeJSON(LQ, queue);
  }
  schedulePush();
}

export const getStudyLog = () => rows;
export function useStudyLog() {
  return useSyncExternalStore((f) => (subs.add(f), () => subs.delete(f)), () => rows);
}

// 한 줄 적기 (같은 id 면 고침). 돌려줌: id (적을 게 없으면 null)
export function logStudy(s) {
  const row = cleanRow(s);
  if (!row.sec && !row.n && !row.learned) return null;
  const i = rows.findIndex((r) => r.id === row.id);
  const next = rows.slice();
  if (i < 0) next.push(row);
  else next[i] = row;
  setRows(next);
  enqueue(row.id);
  return row.id;
}
// 지우기 (이 기기 + 서버)
export async function removeStudy(id) {
  setRows(rows.filter((r) => r.id !== id));
  queue = queue.filter((x) => x !== id);
  writeJSON(LQ, queue);
  const sb = supabase();
  if (sb) await sb.from('study_log').delete().eq('id', id).then(() => {}, () => {});
}

/* ───────── 서버 ───────── */
let status = { state: 'local', error: null, noTable: false };
const statusSubs = new Set();
const setStatus = (p) => {
  status = { ...status, ...p };
  statusSubs.forEach((f) => f());
};
export function useStudySync() {
  return useSyncExternalStore((f) => (statusSubs.add(f), () => statusSubs.delete(f)), () => status);
}
const isNoTable = (e) => /does not exist|could not find the table|schema cache/i.test(e?.message || '');

async function ready() {
  const sb = supabase();
  if (!sb) return null;
  return (await currentSession(sb)) ? sb : null;
}

let pushTimer = null;
let pushing = null;
function schedulePush(ms = 3000) {
  clearTimeout(pushTimer);
  pushTimer = setTimeout(pushStudy, ms);
}
export async function pushStudy() {
  if (pushing) return pushing;
  pushing = (async () => {
    try {
      const sb = await ready();
      if (!sb) return setStatus({ state: 'local' });
      const ids = queue.slice();
      if (!ids.length) return setStatus({ state: 'ok', error: null });
      const sent = new Map(rows.filter((r) => ids.includes(r.id)).map((r) => [r.id, r]));
      if (sent.size) {
        const { error } = await sb.from('study_log').upsert([...sent.values()].map(toServer), { onConflict: 'id' });
        if (error) throw error;
      }
      // 올리는 사이 타이머가 같은 줄을 또 고쳤으면 다음에 또 올림
      queue = queue.filter((x) => !ids.includes(x) || (sent.has(x) && rows.find((r) => r.id === x) !== sent.get(x)));
      writeJSON(LQ, queue);
      setStatus({ state: 'ok', error: null, noTable: false });
    } catch (e) {
      setStatus({ state: 'error', error: e.message, noTable: isNoTable(e) });
      schedulePush(60000);
    } finally {
      pushing = null;
    }
  })();
  return pushing;
}
// 다른 기기에서 공부한 것까지 받아 오기 (최근 120일)
export async function pullStudy() {
  try {
    const sb = await ready();
    if (!sb) return;
    const since = ymd(addDays(new Date(), -120));
    const { data, error } = await sb.from('study_log').select('id,day,at,sec,part,n,ok,learned,what').gte('day', since).order('at').limit(5000);
    if (error) throw error;
    setRows(mergeRows(rows, data, queue, since));
    setStatus({ state: 'ok', error: null, noTable: false });
  } catch (e) {
    setStatus({ state: 'error', error: e.message, noTable: isNoTable(e) });
  }
}
// 켤 때 · 앞으로 올 때 · 인터넷 다시 될 때 · 서버 설정 바뀔 때
export function syncStudy() {
  return pushStudy().then(pullStudy);
}
if (typeof window !== 'undefined') {
  setTimeout(syncStudy, 1500);
  window.addEventListener('online', () => syncStudy());
  document.addEventListener('visibilitychange', () => (document.visibilityState === 'visible' ? syncStudy() : pushStudy()));
  onCloudChange(() => setTimeout(syncStudy, 500));
}

/* ───────── 시간 재기 ───────── */
const IDLE_MS = 90 * 1000;
const FLUSH_MS = 60 * 1000;
const INPUTS = ['pointerdown', 'keydown', 'touchstart', 'wheel'];

// 보이고 만지는 동안만 잼 (손 안 대고 idleMs 지나면 멈춤, 화면 숨기면 멈춤). 1분마다 · 숨길 때 · finish/stop 때 같은 줄을 고쳐 씀
//  opts.idleMs: 0 이면 손을 안 대도 계속 (듣기 연습처럼) — 화면을 숨기면 그땐 멈춤
export function startTimer(part, what = '', opts = {}) {
  const idleMs = opts.idleMs ?? IDLE_MS;
  const fresh = () => ({ id: uid(), at: Date.now(), ms: 0, n: 0, ok: 0, learned: 0, saved: '' });
  let c = fresh();
  let input = Date.now();
  let tick = Date.now();
  let paused = false;
  const listeners = new Set();
  const onInput = () => { input = Date.now(); };
  const step = () => {
    const now = Date.now();
    const active = document.visibilityState !== 'hidden' && (!idleMs || now - input < idleMs);
    if (active) c.ms += Math.min(now - tick, 5000);
    tick = now;
    if (dayOf(now) !== c.day0) {
      // 자정을 넘기면 새 줄로 (그 날 기록이 엉뚱한 날에 붙지 않게)
      if (c.day0) { flush(); c = fresh(); }
      c.day0 = dayOf(now);
    }
    paused = !active;
    listeners.forEach((f) => f());
  };
  const flush = () => {
    const sec = Math.round(c.ms / 1000);
    if (sec < 10 && !c.n && !c.learned) return; // 잠깐 열어 본 건 안 적음
    const row = cleanRow({ id: c.id, at: c.at, sec, part, n: c.n, ok: c.ok, learned: c.learned, what });
    const key = JSON.stringify(row);
    if (key === c.saved) return;
    c.saved = key;
    logStudy(row);
  };
  const onVis = () => { step(); if (document.visibilityState === 'hidden') { flush(); pushStudy(); } };
  INPUTS.forEach((e) => window.addEventListener(e, onInput, { passive: true }));
  document.addEventListener('visibilitychange', onVis);
  window.addEventListener('pagehide', flush);
  const iv = setInterval(step, 1000);
  const fl = setInterval(flush, FLUSH_MS);
  step();
  let stopped = false;
  return {
    get sec() { return Math.round(c.ms / 1000); },
    get paused() { return paused; },
    add(x = {}) {
      input = Date.now();
      for (const k of ['n', 'ok', 'learned']) c[k] += Number(x[k]) || 0;
    },
    // 한 판(퀴즈 한 세트 등) 끝 → 저장하고 다음은 새 줄로
    finish(x) {
      if (x) this.add(x);
      step();
      flush();
      const d = c.day0;
      c = fresh();
      c.day0 = d;
    },
    stop() {
      if (stopped) return;
      stopped = true;
      step();
      flush();
      clearInterval(iv);
      clearInterval(fl);
      INPUTS.forEach((e) => window.removeEventListener(e, onInput));
      document.removeEventListener('visibilitychange', onVis);
      window.removeEventListener('pagehide', flush);
    },
    onTick(f) {
      listeners.add(f);
      return () => listeners.delete(f);
    },
  };
}

// React 화면용: 화면이 떠 있는 동안 재고, 닫히면 저장. part·what 이 바뀌면 새로
export function useStudyTimer(part, what = '', opts) {
  const ref = useRef(null);
  const [, render] = useState(0);
  const idleMs = opts?.idleMs;
  useEffect(() => {
    const t = startTimer(part, what, { idleMs });
    ref.current = t;
    const off = t.onTick(() => render((x) => (x + 1) % 1e6));
    return () => {
      off();
      t.stop();
      ref.current = null;
    };
  }, [part, what, idleMs]);
  const t = ref.current;
  return {
    sec: t?.sec || 0,
    paused: !!t?.paused,
    add: (x) => ref.current?.add(x),
    finish: (x) => ref.current?.finish(x),
  };
}

/* ───────── 묶어서 보기 (기록 화면 · Girok lib/studylog.js 와 같은 계산) ───────── */
const empty = () => ({ sec: 0, n: 0, ok: 0, learned: 0, parts: {}, sessions: [] });
function add(acc, s) {
  acc.sec += s.sec || 0;
  acc.n += s.n || 0;
  acc.ok += s.ok || 0;
  acc.learned += s.learned || 0;
  acc.parts[s.part] = (acc.parts[s.part] || 0) + (s.sec || 0);
  acc.sessions.push(s);
  return acc;
}
const shift = (ds, n) => {
  const [y, m, d] = ds.split('-').map(Number);
  return ymd(new Date(y, m - 1, d + n));
};
export function studyDay(log, ds) {
  const acc = empty();
  for (const s of log || []) if (s.day === ds) add(acc, s);
  acc.sessions.sort((a, b) => a.at - b.at);
  return acc;
}
// 최근 n일 (오래된 날 → 오늘)
export function studyDays(log, today, n = 7) {
  const by = {};
  for (const s of log || []) (by[s.day] ||= []).push(s);
  return Array.from({ length: n }, (_, i) => {
    const ds = shift(today, i - n + 1);
    return { ds, ...(by[ds] || []).reduce(add, empty()) };
  });
}
// 연속 공부한 날 (하루 minSec 이상). 오늘 아직 안 했으면 어제까지로 셈
export function studyStreak(log, today, minSec = 300) {
  const sec = {};
  for (const s of log || []) sec[s.day] = (sec[s.day] || 0) + (s.sec || 0);
  let ds = (sec[today] || 0) >= minSec ? today : shift(today, -1);
  let n = 0;
  while ((sec[ds] || 0) >= minSec && n < 1000) {
    n++;
    ds = shift(ds, -1);
  }
  return n;
}
export function studyTotal(log, from = '0000', to = '9999') {
  const acc = empty();
  for (const s of log || []) if (s.day >= from && s.day <= to) add(acc, s);
  return acc;
}
export const fmtStudy = (sec) => {
  const m = Math.round((sec || 0) / 60);
  if (m < 60) return `${m}분`;
  return `${Math.floor(m / 60)}시간${m % 60 ? ` ${m % 60}분` : ''}`;
};
