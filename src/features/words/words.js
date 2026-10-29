// 단어 데이터 + 로직 (화면 없이 테스트할 수 있게)
//  · 기본 단어: words1~3.txt (한 줄 = 단어|읽기|뜻|예문|예문 뜻)
//  · 교재 단어: useData('own') = { id: { w, r, m, ex, k, src, at } } — 붙여넣기로 넣음 (parsePaste)
//  · 복습 상태: useData('words') = { id: srs 카드 } (src/lib/srs.js), 이미 아는 단어는 { skip: 1, t }
import w1 from './words1.txt?raw';
import w2 from './words2.txt?raw';
import w3 from './words3.txt?raw';
import n3 from './lists/n3.tsv?raw';
import n2 from './lists/n2.tsv?raw';
import n1 from './lists/n1.tsv?raw';
import ko from './lists/ko.txt?raw';

export const wordId = (w, r) => `${w}|${r}`;

export function parseList(text, set) {
  const out = [];
  for (const line of text.split(/\r?\n/)) {
    if (!line.trim() || line.startsWith('#')) continue;
    const [w, r, m, ex = '', k = ''] = line.split('|').map((x) => x.trim());
    if (!w || !r || !m) continue;
    out.push({ id: wordId(w, r), w, r, m, ex, k, set });
  }
  return out;
}

// 급수 (쉬운 것부터)
export const LEVELS = ['N3', 'N2', 'N1'];

// 급수 목록 lists/n?.tsv (단어\t읽기\t영어 뜻, 출처 lists/NOTICE.md) + 한국어 뜻 lists/ko.txt (단어|읽기|뜻)
export function parseKo(text) {
  const out = new Map();
  for (const line of text.split(/\r?\n/)) {
    if (!line.trim() || line.startsWith('#')) continue;
    const [w, r, m] = line.split('|').map((x) => x.trim());
    if (w && r && m) out.set(wordId(w, r), m);
  }
  return out;
}
export function parseTsv(text, lv, koMap) {
  const out = [];
  for (const line of text.split(/\r?\n/)) {
    if (!line.trim() || line.startsWith('#')) continue;
    const [w, r, en = ''] = line.split('\t').map((x) => x.trim());
    if (!w || !r) continue;
    const id = wordId(w, r);
    const m = koMap.get(id);
    out.push({ id, w, r, m: m || en, en: !m, ex: '', k: '', set: lv, lv });
  }
  return out;
}

// 기본 단어 (같은 id 는 처음 것만): 예문 있는 N1 단어(words1~3) → 급수 목록. 급수가 겹치면 쉬운 급수
export const BASE = (() => {
  const seen = new Set();
  const koMap = parseKo(ko);
  const lists = { N3: parseTsv(n3, 'N3', koMap), N2: parseTsv(n2, 'N2', koMap), N1: parseTsv(n1, 'N1', koMap) };
  const lvOf = new Map();
  for (const lv of LEVELS) for (const x of lists[lv]) if (!lvOf.has(x.id)) lvOf.set(x.id, lv);
  const mine = [...parseList(w1, '동사'), ...parseList(w2, '명사'), ...parseList(w3, '형용사·부사')].map((x) => ({ ...x, lv: lvOf.get(x.id) || 'N1' }));
  const all = [...mine, ...lists.N3, ...lists.N2, ...lists.N1];
  return all.filter((x) => !seen.has(x.id) && seen.add(x.id));
})();

// 급수 안에서는 섞인 순서 (목록 원래 순서는 가나 순이라). id 로 정해서 기기·날마다 같은 순서
const mix = (id) => {
  let h = 2166136261;
  for (let i = 0; i < id.length; i++) h = Math.imul(h ^ id.charCodeAt(i), 16777619);
  return h >>> 0;
};
const MIXED = [...BASE].sort((a, b) => mix(a.id) - mix(b.id));

// 교재 단어가 먼저 (지금 공부하는 단원), 그다음 고른 급수의 기본 단어 (levels 순서대로, 급수 안은 섞어서)
export function allWords(own = {}, levels = LEVELS) {
  const mine = Object.entries(own)
    .map(([id, x]) => ({ id, w: x.w, r: x.r, m: x.m, ex: x.ex || '', k: x.k || '', set: '교재', lv: '교재', src: x.src || '', at: x.at || 0 }))
    .sort((a, b) => a.at - b.at);
  const ids = new Set(mine.map((x) => x.id));
  const rest = MIXED.filter((x) => !ids.has(x.id));
  return [...mine, ...levels.flatMap((lv) => rest.filter((x) => x.lv === lv))];
}

const KANJI = /[一-鿿々]/;
export const hasKanji = (w) => KANJI.test(w);
const KATA = /^[゠-ヿー・]+$/;
export const isKatakana = (w) => KATA.test(w);

// 예문 속 단어 자리 찾기 → [앞, 단어, 뒤] (활용형도 어간으로 찾음)
export function splitExample(ex, w) {
  if (!ex) return [ex, '', ''];
  const tryFind = (s) => {
    const i = s ? ex.indexOf(s) : -1;
    return i >= 0 ? [ex.slice(0, i), s, ex.slice(i + s.length)] : null;
  };
  let hit = tryFind(w);
  for (let cut = 1; !hit && cut < w.length; cut++) {
    const stem = w.slice(0, w.length - cut);
    if (stem.length < 1 || (stem.length === 1 && !hasKanji(stem))) break;
    hit = tryFind(stem);
  }
  return hit || [ex, '', ''];
}

/* ───────── 교재 단어 붙여넣기 ─────────
 한 줄에 단어 하나. 구분은 탭 · | · / · 쉼표 · 공백 두 칸 중 아무거나
   赴く	おもむく	향하다
   赴く（おもむく）향하다
   赴く おもむく 향하다 · 예문 · 예문 뜻 은 있어도 없어도 됨 */
const KANA = /^[぀-ゟー]+$/;
export function parsePaste(text) {
  const ok = [];
  const bad = [];
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim().replace(/^\d+[.)]\s*/, '');
    if (!line) continue;
    let parts = null;
    const paren = line.match(/^(\S+?)\s*[（(]\s*([぀-ゟー]+)\s*[）)]\s*[:：\-–]?\s*(.+)$/);
    if (paren) parts = [paren[1], paren[2], ...paren[3].split(/\s*[\t|/]\s*/)];
    else {
      for (const sep of [/\t+/, /\s*\|\s*/, /\s+\/\s+/, /\s*,\s*/, /\s{2,}/, /\s+/]) {
        const p = line.split(sep).filter(Boolean);
        if (p.length >= 3 && KANA.test(p[1])) {
          parts = sep.source === '\\s+' ? [p[0], p[1], p.slice(2).join(' ')] : p;
          break;
        }
      }
    }
    if (!parts || !KANA.test(parts[1] || '') || !parts[2]) {
      bad.push(raw);
      continue;
    }
    const [w, r, m, ex = '', k = ''] = parts.map((x) => x.trim());
    ok.push({ id: wordId(w, r), w, r, m, ex, k });
  }
  return { ok, bad };
}

/* ───────── 읽기 퀴즈 (문자·어휘 '한자 읽기' 형식) ─────────
 틀린 보기는 N1 처럼 헷갈리는 읽기로: 탁음·장음·촉음을 바꾼 것 + 다른 단어 읽기 */
const DAKU = { か: 'が', き: 'ぎ', く: 'ぐ', け: 'げ', こ: 'ご', さ: 'ざ', し: 'じ', す: 'ず', せ: 'ぜ', そ: 'ぞ', た: 'だ', ち: 'ぢ', つ: 'づ', て: 'で', と: 'ど', は: 'ば', ひ: 'び', ふ: 'ぶ', へ: 'べ', ほ: 'ぼ' };
const UNDAKU = Object.fromEntries(Object.entries(DAKU).map(([a, b]) => [b, a]));
const HAN = { は: 'ぱ', ひ: 'ぴ', ふ: 'ぷ', へ: 'ぺ', ほ: 'ぽ', ば: 'ぱ', び: 'ぴ', ぶ: 'ぷ', べ: 'ぺ', ぼ: 'ぽ' };
const O_ROW = 'おこごそぞとどのほぼぽもよろょ';
const U_ROW = 'うくぐすずつづぬふぶぷむゆるゅ';

export function readingTwists(r) {
  const out = new Set();
  const ch = [...r];
  ch.forEach((c, i) => {
    const sw = DAKU[c] || UNDAKU[c];
    if (sw) out.add([...ch.slice(0, i), sw, ...ch.slice(i + 1)].join(''));
    if (HAN[c]) out.add([...ch.slice(0, i), HAN[c], ...ch.slice(i + 1)].join(''));
    // 장음 넣기·빼기
    if ((O_ROW.includes(c) || U_ROW.includes(c)) && ch[i + 1] === 'う') out.add([...ch.slice(0, i + 1), ...ch.slice(i + 2)].join(''));
    else if ((O_ROW.includes(c) || U_ROW.includes(c)) && i < ch.length - 1 && ch[i + 1] !== 'ょ' && ch[i + 1] !== 'ゅ') out.add([...ch.slice(0, i + 1), 'う', ...ch.slice(i + 1)].join(''));
    // 촉음 넣기·빼기
    if (c === 'っ') out.add([...ch.slice(0, i), 'つ', ...ch.slice(i + 1)].join(''));
    else if (i > 0 && i < ch.length - 1 && 'かきくけこさしすせそたちつてとぱぴぷぺぽ'.includes(ch[i + 1]) && !'っんー'.includes(c)) out.add([...ch.slice(0, i + 1), 'っ', ...ch.slice(i + 1)].join(''));
  });
  out.delete(r);
  return [...out];
}

const shuffle = (a, rnd = Math.random) => {
  const x = [...a];
  for (let i = x.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [x[i], x[j]] = [x[j], x[i]];
  }
  return x;
};

export function readingChoices(word, pool, rnd = Math.random) {
  const tw = shuffle(readingTwists(word.r), rnd);
  const others = shuffle(pool.filter((x) => x.id !== word.id && x.r !== word.r && Math.abs(x.r.length - word.r.length) <= 1), rnd).map((x) => x.r);
  const picks = [];
  for (const c of [...tw.slice(0, 2), ...others, ...tw.slice(2)]) {
    if (picks.length >= 3) break;
    if (c !== word.r && !picks.includes(c)) picks.push(c);
  }
  return shuffle([word.r, ...picks], rnd);
}

// 퀴즈에 낼 단어: 본 적 있는 한자 단어 중 약한 것(틀린 횟수·짧은 간격) 먼저, 모자라면 새 단어
export function quizPick(words, cards, n = 10, rnd = Math.random) {
  const kan = words.filter((x) => hasKanji(x.w) && !isKatakana(x.w));
  const seen = kan.filter((x) => cards[x.id]?.t && !cards[x.id]?.skip);
  const weak = shuffle(seen, rnd).sort((a, b) => (cards[b.id].l || 0) - (cards[a.id].l || 0) || (cards[a.id].i || 0) - (cards[b.id].i || 0));
  const pick = weak.slice(0, n);
  if (pick.length < n) pick.push(...shuffle(kan.filter((x) => !pick.includes(x)), rnd).slice(0, n - pick.length));
  return shuffle(pick, rnd);
}

// 새 단어 줄 순서: '몰라요'로 고른 단어(pri)가 먼저, 그다음 원래 순서
export function idsInOrder(words, cards) {
  const p = [];
  const r = [];
  for (const w of words) (cards[w.id]?.pri && !cards[w.id]?.t ? p : r).push(w.id);
  return [...p, ...r];
}

// 아직 안 거른 새 단어 (본 적 없고 '몰라요'도 안 누른 것)
export const unsorted = (words, cards) => words.filter((w) => !cards[w.id]);

// 오늘 새로 본 단어 수 (카드 상태의 첫 본 날 f)
export const newToday = (cards, today) => Object.values(cards).filter((c) => c.f === today).length;
