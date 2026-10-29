// 한자 → 한국 음·훈 (lists/hanja.txt, tools/hanja-build.py 로 만듦) + 같은 한자를 쓰는 단어 찾기
//  · 한국 한자음을 알면 일본 음독이 대개 규칙대로 나옴 (학 → がく, 발 → はつ). 받침 규칙은 ON_RULES
import raw from './lists/hanja.txt?raw';
import { BASE, hasKanji, isKatakana } from './words';

export const HANJA = (() => {
  const m = new Map();
  for (const line of raw.split(/\r?\n/)) {
    if (!line || line.startsWith('#')) continue;
    const [ch, ko, hun, old = ''] = line.split('|');
    if (ch && ko) m.set(ch, { ch, ko, hun: hun || '', old });
  }
  return m;
})();

const KANJI = /[一-鿿々]/;
// 단어 속 한자 (같은 글자는 한 번, 々 빼고)
export const kanjiOf = (w) => [...new Set([...(w || '')].filter((c) => KANJI.test(c) && c !== '々'))];

// 한자 하나 정보 { ch, ko 음('락·악'), hun 훈('즐거울 락'), old 옛 글자 } · 한국 사전에 없는 일본 한자(込·働…)는 { ch, kokuji: true }
export const kanjiInfo = (ch) => HANJA.get(ch) || { ch, ko: '', hun: '', old: '', kokuji: true };

// 받침 → 일본 음독 끝 (예외도 있음)
const JONG = { 1: 'ㄱ', 4: 'ㄴ', 8: 'ㄹ', 16: 'ㅁ', 17: 'ㅂ', 21: 'ㅇ' };
const ON_RULES = { ㄱ: 'く·き', ㄴ: 'ん', ㅁ: 'ん', ㄹ: 'つ·ち', ㅂ: 'う(옛 ふ)', ㅇ: 'う·い (길게)', '': 'ん·っ·く 없이 끝남' };
export function onHint(ko) {
  const s = (ko || '').split('·')[0];
  if (!s) return '';
  const code = s.charCodeAt(0) - 0xac00;
  if (code < 0 || code > 11171) return '';
  const j = JONG[code % 28] ?? (code % 28 === 0 ? '' : null);
  if (j === null) return '';
  return `${j ? `받침 ${j}` : '받침 없음'} → ${ON_RULES[j]}`;
}

// 한자 → 그 한자를 쓰는 단어들 (words 배열 순서 그대로)
export function kanjiIndex(words) {
  const idx = new Map();
  for (const w of words) {
    if (!hasKanji(w.w) || isKatakana(w.w)) continue;
    for (const ch of kanjiOf(w.w)) {
      if (!idx.has(ch)) idx.set(ch, []);
      idx.get(ch).push(w);
    }
  }
  return idx;
}

// 같은 한자를 쓰는 다른 단어 (한자마다 n개, 이미 본 단어 먼저 → 아는 단어에 고리 걸기)
export function siblings(word, idx, cards = {}, n = 3) {
  const out = [];
  for (const ch of kanjiOf(word.w)) {
    const list = (idx.get(ch) || []).filter((x) => x.id !== word.id && x.w !== word.w);
    const seen = list.filter((x) => cards[x.id]?.t);
    const rest = list.filter((x) => !cards[x.id]?.t);
    const pick = [...seen, ...rest].slice(0, n);
    if (pick.length) out.push({ ch, words: pick.map((x) => ({ ...x, known: !!cards[x.id]?.t })) });
  }
  return out;
}

/* ───────── 한자마다 이 단어에서 읽는 소리 (道路 → 道 どう · 路 ろ) + 장음 ─────────
 단어 목록 전체에서 한자별로 자주 나오는 소리를 세고(앞·뒤 글자에서 후보 → 맞춰 보기 → 다시 세기),
 그걸로 단어 읽기를 한자마다 나눔. 장음(どう·せい·きゅう)은 '길게' 로 표시 */
const KANA = /^[ぁ-ゖー]+$/;
const tokens = (w) => {
  const out = [];
  for (const ch of w) {
    if (KANJI.test(ch) && ch !== '々') out.push({ k: ch });
    else if (ch === '々' && out.length && out.at(-1).k) out.push({ k: out.at(-1).k });
    else if (KANA.test(ch)) {
      if (out.length && out.at(-1).kana !== undefined) out.at(-1).kana += ch;
      else out.push({ kana: ch });
    } else return null; // 가타카나·기호 섞인 말은 안 나눔
  }
  return out;
};

// tokens 와 읽기 r 을 맞춤: 한자 하나에 1~4글자, 가나는 그대로. score(k, part) 합이 큰 것
function alignBy(toks, r, score) {
  const n = toks.length;
  const memo = new Map();
  const go = (t, i) => {
    if (t === n) return i === r.length ? { s: 0, parts: [] } : null;
    const key = `${t}:${i}`;
    if (memo.has(key)) return memo.get(key);
    let best = null;
    const tk = toks[t];
    if (tk.kana !== undefined) {
      if (r.startsWith(tk.kana, i)) {
        const rest = go(t + 1, i + tk.kana.length);
        if (rest) best = { s: rest.s, parts: [{ kana: tk.kana }, ...rest.parts] };
      }
    } else {
      for (let len = 1; len <= 4 && i + len <= r.length; len++) {
        const part = r.slice(i, i + len);
        if (/^[ゃゅょっーん]/.test(part)) continue; // 작은 글자·ん 으로 시작하는 소리는 없음
        const rest = go(t + 1, i + len);
        if (!rest) continue;
        const s = rest.s + score(tk.k, part);
        if (!best || s > best.s) best = { s, parts: [{ k: tk.k, r: part }, ...rest.parts] };
      }
    }
    memo.set(key, best);
    return best;
  };
  return go(0, 0)?.parts || null;
}

// 음독 모양(か·かい·こう·かく·かつ·かん·きゅう·がっ …)이면 덤 점수
const ON_SHAPE = /^[^ぁぃぅぇぉゃゅょっんー][ゃゅょ]?(?:[いうくきつちん]|っ)?$/;
const score = (m, k, part) => Math.log(1 + (m.get(k)?.get(part) || 0)) + (ON_SHAPE.test(part) ? 0.5 : 0) - 0.05 * part.length;

let ON = null; // Map 한자 → Map 소리 → 단어 수
function onTable() {
  if (ON) return ON;
  const list = BASE.map((w) => ({ toks: tokens(w.w), r: w.r })).filter((x) => x.toks && x.toks.some((t) => t.k) && KANA.test(x.r));
  const add = (m, k, part) => {
    if (!m.has(k)) m.set(k, new Map());
    m.get(k).set(part, (m.get(k).get(part) || 0) + 1);
  };
  // 1) 첫·끝 한자의 앞·뒤 글자 후보
  const cand = new Map();
  for (const { toks, r } of list) {
    if (toks.length < 2) continue;
    const a = toks[0];
    const b = toks.at(-1);
    for (let len = 1; len <= 4 && len < r.length; len++) {
      if (a.k) add(cand, a.k, r.slice(0, len));
      if (b.k) add(cand, b.k, r.slice(r.length - len));
    }
  }
  const sc = (m) => (k, part) => score(m, k, part);
  // 2) 후보로 나눠 보고 → 3) 나눈 결과로 다시 세기 (두 번)
  let table = cand;
  for (let round = 0; round < 2; round++) {
    const next = new Map();
    for (const { toks, r } of list) {
      const parts = alignBy(toks, r, sc(table));
      if (parts) for (const p of parts) if (p.k) add(next, p.k, p.r);
    }
    table = next;
  }
  ON = table;
  return ON;
}

// 이 단어 읽기를 한자마다: [{ k, r }, { kana }] · 못 나누면 null
const partsMemo = new Map();
export function readingParts(w, r) {
  const key = `${w}|${r}`;
  if (partsMemo.has(key)) return partsMemo.get(key);
  const toks = tokens(w);
  const tbl = onTable();
  const res = toks && KANA.test(r) && toks.some((t) => t.k) ? alignBy(toks, r, (k, part) => score(tbl, k, part)) : null;
  partsMemo.set(key, res);
  return res;
}

// 이 한자를 다른 단어에선 어떻게 읽나 (많은 순) [{ r, n }]
export function soundsOf(ch, n = 3) {
  const m = onTable().get(ch);
  if (!m) return [];
  return [...m.entries()].sort((a, b) => b[1] - a[1]).slice(0, n).map(([r, c]) => ({ r, n: c }));
}

// 장음: 오단+う(どう·こう·ろう), 우단·요음+う(くう·きゅう·しょう), 에단+い(せい·けい), ー
const A_ROW = 'あかがさざただなはばぱまやらわゃ';
const I_ROW = 'いきぎしじちぢにひびぴみり';
const O_ROW = 'おこごそぞとどのほぼぽもよろょ';
const U_ROW = 'うくぐすずつづぬふぶぷむゆるゅ';
const E_ROW = 'えけげせぜてでねへべぺめれ';
// 앞 글자 단 → 길게 읽히는 다음 글자: ああ · いい · うう/おう · えい/ええ · おお (+ ー)
const LONG_AFTER = [[A_ROW, 'あ'], [I_ROW, 'い'], [U_ROW, 'う'], [O_ROW, 'うお'], [E_ROW, 'いえ']];
export function longAt(part) {
  const out = [];
  [...part].forEach((c, i, a) => {
    const p = a[i - 1];
    if (c === 'ー' || (p && LONG_AFTER.some(([row, v]) => row.includes(p) && v.includes(c)))) out.push(i);
  });
  return out;
}
export const isLong = (part) => longAt(part).length > 0;

// 한국 음과 장음 맞춰 보기: ㅇ·ㅂ 받침이면 길게가 규칙, 받침 없는데 길면 주의 (음독 모양일 때만)
export function longNote(ko, part) {
  // ちい(小)·にい(兄)·おお(大) 같은 ああ·いい·ええ·おお 장음은 훈독 → 한국 음과 상관없음
  const onLong = (c, i) => (c === 'う' && (O_ROW + U_ROW).includes(part[i - 1])) || (c === 'い' && E_ROW.includes(part[i - 1]));
  if (!ON_SHAPE.test(part) || longAt(part).some((i) => !onLong(part[i], i))) return '';
  const s = (ko || '').split('·')[0];
  const code = s ? s.charCodeAt(0) - 0xac00 : -1;
  if (code < 0 || code > 11171) return '';
  const jong = code % 28;
  const long = isLong(part);
  if (long && (jong === 21 || jong === 17)) return `받침 ${jong === 21 ? 'ㅇ' : 'ㅂ'} → 길게 (규칙대로)`;
  if (long && jong === 0) return '받침 없는데 길게 · 외워 두기';
  if (!long && jong === 0) return '받침 없음 → 짧게';
  if (!long && jong === 21) return '받침 ㅇ인데 짧게 · 외워 두기';
  return '';
}
