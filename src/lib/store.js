// 저장: 기능마다 '묶음'(key) 하나 = { id: 기록 } 맵. 기록마다 u(고친 시각 ms)가 붙고, 기기 사이에서는 u 가 나중인 쪽이 이김
//  · 묶음 이름: 'words' 단어 복습 · 'own' 교재 단어 · 'grammar' 문법 · 'drill' 독해·청해 · 'prefs' 설정 (새 기능은 새 이름)
//  · 이 기기: localStorage 'jlpt:d:<묶음>' / 서버: Supabase 표 jlpt_data (한 기록 = 한 줄, SQL 은 CLOUD_SQL)
//  · 화면에서: const words = useData('words'); save('words', id, { ...바뀐 칸 }); remove('words', id)
import { useSyncExternalStore } from 'react';
import { currentSession, supabase } from './supabase';

const LS = (k) => `jlpt:d:${k}`;
const DIRTY = 'jlpt:dirty';
const PULLED = 'jlpt:pulled';

const readJSON = (k, d) => {
  try {
    const v = JSON.parse(localStorage.getItem(k));
    return v ?? d;
  } catch {
    return d;
  }
};
const writeJSON = (k, v) => {
  try {
    localStorage.setItem(k, JSON.stringify(v));
  } catch {
    /* 가득 차도 화면은 그대로 */
  }
};

const data = {}; // 묶음 → { id: 기록 } (지운 것 del:1 도 남김 → 다른 기기로 지움이 전해짐)
const views = {}; // 묶음 → 지운 것을 뺀 맵 (화면용, 바뀔 때만 새로)
const subs = new Set();
let dirty = readJSON(DIRTY, {}); // { 묶음: [id…] } 서버에 아직 안 올린 것

function bucket(k) {
  if (!data[k]) data[k] = readJSON(LS(k), {});
  return data[k];
}
function view(k) {
  if (!views[k]) {
    const b = bucket(k);
    const out = {};
    for (const id in b) if (!b[id]?.del) out[id] = b[id];
    views[k] = out;
  }
  return views[k];
}
function changed(k) {
  delete views[k];
  writeJSON(LS(k), data[k]);
  subs.forEach((f) => f());
}
function markDirty(k, id) {
  const list = new Set(dirty[k] || []);
  list.add(id);
  dirty = { ...dirty, [k]: [...list] };
  writeJSON(DIRTY, dirty);
  schedulePush();
}

export const getData = (k) => view(k);
export function useData(k) {
  return useSyncExternalStore((f) => (subs.add(f), () => subs.delete(f)), () => view(k));
}

// 기록 하나 고치기 (patch 가 함수면 지금 기록을 받아 새 기록을 돌려줌)
export function save(k, id, patch) {
  const b = bucket(k);
  const cur = b[id]?.del ? undefined : b[id];
  const next = typeof patch === 'function' ? patch(cur) : { ...(cur || {}), ...patch };
  b[id] = { ...next, u: Date.now() };
  delete b[id].del;
  changed(k);
  markDirty(k, id);
}
// 여러 개 한 번에
export function saveMany(k, map) {
  const b = bucket(k);
  const now = Date.now();
  for (const id in map) {
    b[id] = { ...map[id], u: now };
    markDirtyQuiet(k, id);
  }
  changed(k);
  writeJSON(DIRTY, dirty);
  schedulePush();
}
function markDirtyQuiet(k, id) {
  const list = new Set(dirty[k] || []);
  list.add(id);
  dirty = { ...dirty, [k]: [...list] };
}
export function remove(k, id) {
  const b = bucket(k);
  if (!b[id]) return;
  b[id] = { del: 1, u: Date.now() };
  changed(k);
  markDirty(k, id);
}

/* ───────── 서버 동기화 ───────── */
export const CLOUD_SQL = `-- N1 공부 앱 기록 (Supabase → SQL Editor 에서 한 번 실행)
create table if not exists public.jlpt_data (
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  key text not null,
  id text not null,
  value jsonb not null,
  u bigint not null,
  primary key (user_id, key, id)
);
create index if not exists jlpt_data_u on public.jlpt_data (user_id, u);
alter table public.jlpt_data enable row level security;
drop policy if exists "own rows" on public.jlpt_data;
create policy "own rows" on public.jlpt_data for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
grant select, insert, update, delete on public.jlpt_data to authenticated;`;

let status = { state: 'local', at: 0, error: '' }; // local · syncing · ok · error
const statusSubs = new Set();
const setStatus = (s) => {
  status = { ...status, ...s };
  statusSubs.forEach((f) => f());
};
export function useSyncStatus() {
  return useSyncExternalStore((f) => (statusSubs.add(f), () => statusSubs.delete(f)), () => status);
}

let timer = null;
function schedulePush() {
  clearTimeout(timer);
  timer = setTimeout(() => sync(), 2500);
}

let running = null;
export function sync() {
  if (!running) running = doSync().finally(() => (running = null));
  return running;
}

async function doSync() {
  const sb = supabase();
  if (!sb) return setStatus({ state: 'local' });
  if (!(await currentSession(sb))) return setStatus({ state: 'local' });
  setStatus({ state: 'syncing' });
  try {
    // 1) 올리기
    const rows = [];
    const sent = dirty;
    for (const k in sent) for (const id of sent[k]) if (bucket(k)[id]) rows.push({ key: k, id, value: bucket(k)[id], u: bucket(k)[id].u });
    for (let i = 0; i < rows.length; i += 500) {
      const { error } = await sb.from('jlpt_data').upsert(rows.slice(i, i + 500), { onConflict: 'user_id,key,id' });
      if (error) throw error;
    }
    // 올리는 동안 또 바뀐 건 남겨 둠
    const sentU = new Map(rows.map((r) => [`${r.key}\n${r.id}`, r.u]));
    const left = {};
    for (const k in dirty) {
      const rest = dirty[k].filter((id) => bucket(k)[id] && bucket(k)[id].u !== sentU.get(`${k}\n${id}`));
      if (rest.length) left[k] = rest;
    }
    dirty = left;
    writeJSON(DIRTY, dirty);
    // 2) 받기 (지난번 뒤로 바뀐 줄만)
    const since = readJSON(PULLED, 0);
    let max = since;
    const touched = new Set();
    for (let from = 0; ; from += 1000) {
      const { data: got, error } = await sb.from('jlpt_data').select('key,id,value,u').gt('u', since).order('u').range(from, from + 999);
      if (error) throw error;
      for (const r of got) {
        const b = bucket(r.key);
        if (!b[r.id] || (b[r.id].u || 0) < r.u) {
          b[r.id] = r.value;
          touched.add(r.key);
        }
        if (r.u > max) max = r.u;
      }
      if (got.length < 1000) break;
    }
    writeJSON(PULLED, max);
    touched.forEach((k) => changed(k));
    setStatus({ state: 'ok', at: Date.now(), error: '' });
  } catch (e) {
    const msg = String(e?.message || e);
    setStatus({ state: 'error', error: /jlpt_data|42P01|PGRST205/.test(msg) ? '서버에 jlpt_data 표가 없어요. 설정의 SQL을 실행해 주세요.' : msg });
  }
}

// 켤 때 · 다시 앞으로 올 때 · 1분마다
if (typeof window !== 'undefined') {
  window.addEventListener('online', () => sync());
  document.addEventListener('visibilitychange', () => document.visibilityState === 'visible' && sync());
  setInterval(() => document.visibilityState === 'visible' && sync(), 60000);
}

// 테스트용
export function _reset() {
  for (const k in data) delete data[k];
  for (const k in views) delete views[k];
  dirty = {};
}
