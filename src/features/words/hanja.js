// 한자 → 한국 음·훈 (lists/hanja.txt, tools/hanja-build.py 로 만듦) + 같은 한자를 쓰는 단어 찾기
//  · 한국 한자음을 알면 일본 음독이 대개 규칙대로 나옴 (학 → がく, 발 → はつ). 받침 규칙은 ON_RULES
import raw from './lists/hanja.txt?raw';
import { hasKanji, isKatakana } from './words';

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
