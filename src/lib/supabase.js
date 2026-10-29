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
  if (!client) {
    client = createClient(cfg.url, cfg.key, {
      // 로그인은 localStorage 에 남김 (Safari 를 꺼도 유지). 1시간마다 알아서 새 토큰
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false, storageKey: 'jlpt:auth', storage: window.localStorage },
    });
    keepStorage();
  }
  return client;
}

// Safari 가 오래 안 쓴 사이트 저장소를 지우지 않게 '계속 보관' 요청 (홈 화면 앱이면 원래 안 지움)
let asked = false;
function keepStorage() {
  if (asked) return;
  asked = true;
  try {
    navigator.storage?.persist?.().catch(() => {});
  } catch {
    /* 없으면 그만 */
  }
}

// 지금 로그인 상태. Safari 를 다시 열면 토큰을 새로 받는데, 그때 인터넷이 잠깐 안 되면 supabase 가
// '로그인 없음'을 돌려줌 (저장된 로그인은 그대로) → 저장된 로그인이 있으면 몇 번 더 물어봄
const hasSaved = () => {
  try {
    return !!localStorage.getItem('jlpt:auth');
  } catch {
    return false;
  }
};
export async function currentSession(sb = supabase()) {
  if (!sb) return null;
  for (const wait of [0, 1000, 3000, 6000]) {
    if (wait) await new Promise((r) => setTimeout(r, wait));
    const { data } = await sb.auth.getSession().catch(() => ({ data: {} }));
    if (data?.session) return data.session;
    if (!hasSaved()) return null; // 진짜 로그아웃
  }
  return null;
}

export function onCloudChange(f) {
  subs.add(f);
  return () => subs.delete(f);
}
