// 후리가나: 화면 글을 furi-data.js 에서 찾아 한자 위에 읽기(ruby)를 얹음. 사전에 없는 글은 그대로
//  읽기는 tools/furi-build.mjs 가 문장째 읽어 만든 것 (조각도 원래 문장 속 읽기)
//  끄고 켜기는 이 기기만 (jlpt:furi, 기본 켬)
import { createContext, useContext } from 'react';
import { FURI } from './furi-data.js';

export const FuriOn = createContext(true);
export const furiKey = 'jlpt:furi';
export const loadFuri = () => {
  try { return localStorage.getItem(furiKey) !== '0'; } catch { return true; }
};

// '{東京|とうきょう}に{行|い}く' → ['', ['東京','とうきょう'], 'に', ['行','い'], 'く']
export function furiParts(t) {
  const a = t == null ? '' : FURI[t];
  if (!a) return [t ?? ''];
  const out = [];
  let at = 0;
  for (const m of a.matchAll(/\{([^|}]+)\|([^}]+)\}/g)) {
    if (m.index > at) out.push(a.slice(at, m.index));
    out.push([m[1], m[2]]);
    at = m.index + m[0].length;
  }
  if (at < a.length) out.push(a.slice(at));
  return out;
}

export default function Furi({ t }) {
  const on = useContext(FuriOn);
  if (!on || t == null || !FURI[t]) return t ?? null;
  return furiParts(t).map((p, i) =>
    typeof p === 'string' ? p : (
      <ruby key={i}>{p[0]}<rt>{p[1]}</rt></ruby>
    ),
  );
}
