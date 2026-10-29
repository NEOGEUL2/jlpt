// 시험 '漢字読み' 보기 (問題1): 실제 시험처럼 함정 두 군데를 섞은 4개
//  · 예: 出版 → しゅっぱん · しゅうぱん · しゅっばん · しゅうばん (촉음/장음 × 반탁음/탁음)
//  · 함정 종류: long 장음 · soku 촉음 · daku 탁음 · han 반탁음 · yoon 작은 ゃゅょ · other 그 한자의 다른 소리
//  · 두 군데를 못 찾으면 한 군데 함정 + 다른 함정 · 비슷한 길이의 다른 단어 읽기로 채움
import { wordKinds } from './kanji';
import { PARTS } from './kanjidic';
import { hasKanji, isKatakana } from './words';

export const TRAP_KO = { long: '장음', soku: '촉음', daku: '탁음', han: '반탁음', yoon: '작은 ゃゅょ', other: '다른 소리', word: '다른 단어' };

const DAKU = { か: 'が', き: 'ぎ', く: 'ぐ', け: 'げ', こ: 'ご', さ: 'ざ', し: 'じ', す: 'ず', せ: 'ぜ', そ: 'ぞ', た: 'だ', ち: 'ぢ', つ: 'づ', て: 'で', と: 'ど', は: 'ば', ひ: 'び', ふ: 'ぶ', へ: 'べ', ほ: 'ぼ' };
const UNDAKU = Object.fromEntries(Object.entries(DAKU).map(([a, b]) => [b, a]));
const HAN = { は: 'ぱ', ひ: 'ぴ', ふ: 'ぷ', へ: 'ぺ', ほ: 'ぽ' };
const UNHAN = Object.fromEntries(Object.entries(HAN).map(([a, b]) => [b, a]));
const SMALL = { ゃ: 'や', ゅ: 'ゆ', ょ: 'よ' };
const O_ROW = 'おこごそぞとどのほぼぽもよろ';
const U_ROW = 'くぐすずつづぬふぶぷむゆるゅょ';
const E_ROW = 'えけげせぜてでねへべぺめれ';
const SOKU_NEXT = 'かきくけこさしすせそたちつてとぱぴぷぺぽ';

// 글자마다 어느 한자 칸인지: [{ s, e, k 한자, kind on·kun }] (오쿠리가나는 칸 아님) · 못 나누면 null
function spans(w, r) {
  const k = wordKinds(w, r);
  if (!k) return null;
  const out = [];
  let pos = 0;
  for (const p of k.parts) {
    const len = [...(p.k ? p.r : p.kana)].length;
    if (p.k) out.push({ s: pos, e: pos + len, k: p.k, kind: p.kind });
    pos += len;
  }
  return out;
}

// 한 군데 바꾸기 = 원래 읽기의 [s, e) 를 t 로 (겹치지 않으면 둘을 같이 쓸 수 있음)
//  · 시험 함정은 한자 소리 안에서만: 오쿠리가나(赴く의 く)는 안 건드림
//  · 장음은 음독 칸 끝에서 넣고 빼기 (こ ↔ こう, せ ↔ せい), 촉음은 칸 끝 つ·く·ち·き ↔ っ
export function trapEdits(r, w = '') {
  const ch = [...r];
  const sp = (w && spans(w, r)) || [{ s: 0, e: ch.length, kind: 'on' }];
  const out = [];
  for (const { s, e, kind } of sp) {
    for (let i = s; i < e; i++) {
      const c = ch[i];
      if (DAKU[c] && c !== 'ち' && c !== 'つ') out.push({ s: i, e: i + 1, t: DAKU[c], k: 'daku' });
      if (UNDAKU[c] && c !== 'ぢ' && c !== 'づ') out.push({ s: i, e: i + 1, t: UNDAKU[c], k: 'daku' });
      if (HAN[c] && i > 0) out.push({ s: i, e: i + 1, t: HAN[c], k: 'han' });
      if (UNHAN[c]) out.push({ s: i, e: i + 1, t: UNHAN[c], k: 'han' }, { s: i, e: i + 1, t: DAKU[UNHAN[c]], k: 'daku' });
      if (SMALL[c]) out.push({ s: i, e: i + 1, t: SMALL[c], k: 'yoon' });
      if (c === 'っ') out.push({ s: i, e: i + 1, t: '', k: 'soku' }, { s: i, e: i + 1, t: 'つ', k: 'soku' });
    }
    if (kind !== 'on' || e - s < 1) continue;
    const last = ch[e - 1];
    const prev = ch[e - 2];
    // 장음 빼기 · 넣기
    if (e - s >= 2 && ((last === 'う' && (O_ROW + U_ROW).includes(prev)) || (last === 'い' && E_ROW.includes(prev)))) out.push({ s: e - 1, e, t: '', k: 'long' });
    else if (O_ROW.includes(last) || last === 'ゅ' || last === 'ょ') out.push({ s: e, e, t: 'う', k: 'long' });
    else if (E_ROW.includes(last)) out.push({ s: e, e, t: 'い', k: 'long' });
    // 촉음: 다음 칸이 か·さ·た·ぱ 줄로 시작하면 끝 つ·く·ち·き → っ
    const nx = ch[e];
    if (e < ch.length && e - s >= 2 && 'つくちき'.includes(last) && nx && SOKU_NEXT.includes(nx) && sp.some((x) => x.s === e)) out.push({ s: e - 1, e, t: 'っ', k: 'soku' });
    if (e < ch.length && last === 'っ') out.push({ s: e - 1, e, t: 'く', k: 'soku' });
  }
  return out;
}

// 한자의 다른 음독으로 바꾸기 (施 し/せ, 遂 すい/つい 처럼 같은 한자의 다른 소리)
export function otherEdits(w, r) {
  const out = [];
  for (const p of spans(w, r) || []) {
    if (p.kind !== 'on') continue;
    const cur = [...r].slice(p.s, p.e).join('');
    for (const o of PARTS.get(p.k)?.on || []) if (o !== cur && !o.includes('.')) out.push({ s: p.s, e: p.e, t: o, k: 'other' });
  }
  return out;
}

const applyEdits = (r, list) => {
  const ch = [...r];
  for (const x of [...list].sort((a, b) => b.s - a.s)) ch.splice(x.s, x.e - x.s, ...[...x.t]);
  return ch.join('');
};
const apart = (a, b) => a.e < b.s || b.e < a.s || (a.s === a.e && b.s === b.e ? a.s !== b.s : false);

const shuffle = (a, rnd = Math.random) => {
  const x = [...a];
  for (let i = x.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [x[i], x[j]] = [x[j], x[i]];
  }
  return x;
};
const OK = /^[ぁ-ゖー]+$/;
// 말이 안 되는 모양 빼기 (っ 로 끝남·っっ·맨 앞 っ·うう 가 셋)
const sane = (s) => OK.test(s) && !/^っ|っ$|っっ|ーー|^ん/.test(s);

// → [{ r, traps: ['long', …] }] 4개 (정답은 traps 빈 배열). 같은 단어·같은 운이면 같은 보기
export function yomiChoices(word, pool = [], rnd = Math.random) {
  const r = word.r;
  const real = new Set(pool.filter((x) => x.w === word.w).map((x) => x.r));
  const edits = shuffle([...trapEdits(r, word.w), ...otherEdits(word.w, r)], rnd);
  const out = [{ r, traps: [] }];
  const has = (s) => out.some((o) => o.r === s) || (s !== r && real.has(s));
  const push = (s, traps) => {
    if (out.length < 4 && s !== r && sane(s) && !has(s)) out.push({ r: s, traps });
  };
  // 1) 2×2: 서로 다른 종류(되도록)의 두 군데
  const pairs = [];
  for (let a = 0; a < edits.length; a++) for (let b = a + 1; b < edits.length; b++) if (apart(edits[a], edits[b])) pairs.push([edits[a], edits[b]]);
  pairs.sort((x, y) => (y[0].k !== y[1].k) - (x[0].k !== x[1].k) || (x[0].k === 'other' || x[1].k === 'other') - (y[0].k === 'other' || y[1].k === 'other'));
  for (const [a, b] of pairs) {
    const trio = [[applyEdits(r, [a]), [a.k]], [applyEdits(r, [b]), [b.k]], [applyEdits(r, [a, b]), [a.k, b.k]]];
    if (trio.every(([s]) => s !== r && sane(s) && !real.has(s)) && new Set(trio.map((t) => t[0])).size === 3) {
      for (const [s, t] of trio) push(s, t);
      break;
    }
  }
  // 2) 한 군데 함정
  for (const e of edits) push(applyEdits(r, [e]), [e.k]);
  // 3) 길이 비슷한 다른 단어 읽기
  //    (같은 끝 글자 먼저: 赴く → そむく·あざむく 처럼 모양이 닮은 것)
  const like = pool.filter((x) => x.r !== r && OK.test(x.r) && Math.abs(x.r.length - r.length) <= 1);
  const tail = r.at(-1);
  for (const x of [...shuffle(like.filter((x) => x.r.at(-1) === tail), rnd).slice(0, 10), ...shuffle(like, rnd).slice(0, 20)]) push(x.r, ['word']);
  return shuffle(out, rnd);
}

// 漢字読み에 낼 만한 단어: 한자가 있고(가타카나 말 X), 읽기가 히라가나
export const yomiOk = (w) => hasKanji(w.w) && !isKatakana(w.w) && OK.test(w.r) && w.r !== w.w;

// 틀린 보기가 어디가 틀렸나 (정답과 견줘 한 줄): '장음 · 탁음'
export const trapText = (o) => o.traps.map((k) => TRAP_KO[k]).join(' · ');
