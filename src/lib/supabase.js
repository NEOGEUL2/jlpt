// Supabase 연결: 기록(Girok) 앱과 같은 서버·같은 계정. 주소·키는 설정 화면에서 넣고 이 기기에 저장
//  · Girok 설정 → 계정 연동에 넣은 값과 똑같이 넣으면 됨 (publishable / anon 키만, secret 키 금지)
import { createClient } from '@supabase/supabase-js';

const CFG = 'jlpt:cloud';
const read = () => {
  try {
    return JSON.parse(localStorage.getItem(CFG)) || {};
  } catch {
    return {};
  }
};

let cfg = read();
let client = null;
const subs = new Set();

export const cloudConfig = () => cfg;
export function setCloudConfig(next) {
  cfg = { url: (next.url || '').trim().replace(/\/+$/, ''), key: (next.key || '').trim() };
  try {
    localStorage.setItem(CFG, JSON.stringify(cfg));
  } catch {
    /* 저장 못 해도 이번엔 씀 */
  }
  client = null;
  subs.forEach((f) => f());
}

// 주소·키가 없으면 null (그땐 이 기기에만 저장)
export function supabase() {
  if (!cfg.url || !cfg.key) return null;
  if (!client) client = createClient(cfg.url, cfg.key, { auth: { persistSession: true, storageKey: 'jlpt:auth' } });
  return client;
}

export function onCloudChange(f) {
  subs.add(f);
  return () => subs.delete(f);
}
