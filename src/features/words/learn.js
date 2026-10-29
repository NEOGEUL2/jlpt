// 외우기 로직 (화면 없이 테스트할 수 있게)
//  · 배우기: 새 단어 5개씩 먼저 보여 주고 → 바로 그 5개로 퀴즈 → 다 맞히면 10분 뒤 한 번 더 (WaniKani·Anki 배우는 단계)
//  · 확인: 한자 단어는 읽기를 직접 입력(로마자도 됨) + 뜻 4개 중 고르기 → 몰랐음/알았음 두 버튼
//  · 카드 상태는 srs.js 와 같은 words 묶음. 배우는 중이면 ls(단계)·la(다시 볼 시각 ms) 가 더 붙음
import { grade } from '../../lib/srs';
import { addDays, diffDays, parse, ymd } from '../../lib/dates';
import { hasKanji, idsInOrder, isKatakana } from './words';

export const BATCH = 5;
export const RELEARN_MIN = 10; // 배운 뒤 몇 분 뒤에 한 번 더

/* ───────── 로마자 → 히라가나 (PC 에서 일본어 자판 없이도 읽기 입력) ───────── */
const ROMA = {
  a: 'あ', i: 'い', u: 'う', e: 'え', o: 'お',
  ka: 'か', ki: 'き', ku: 'く', ke: 'け', ko: 'こ', ga: 'が', gi: 'ぎ', gu: 'ぐ', ge: 'げ', go: 'ご',
  sa: 'さ', si: 'し', shi: 'し', su: 'す', se: 'せ', so: 'そ', za: 'ざ', zi: 'じ', ji: 'じ', zu: 'ず', ze: 'ぜ', zo: 'ぞ',
  ta: 'た', ti: 'ち', chi: 'ち', tu: 'つ', tsu: 'つ', te: 'て', to: 'と', da: 'だ', di: 'ぢ', du: 'づ', de: 'で', do: 'ど',
  na: 'な', ni: 'に', nu: 'ぬ', ne: 'ね', no: 'の', ha: 'は', hi: 'ひ', fu: 'ふ', hu: 'ふ', he: 'へ', ho: 'ほ',
  ba: 'ば', bi: 'び', bu: 'ぶ', be: 'べ', bo: 'ぼ', pa: 'ぱ', pi: 'ぴ', pu: 'ぷ', pe: 'ぺ', po: 'ぽ',
  ma: 'ま', mi: 'み', mu: 'む', me: 'め', mo: 'も', ya: 'や', yu: 'ゆ', yo: 'よ',
  ra: 'ら', ri: 'り', ru: 'る', re: 'れ', ro: 'ろ', wa: 'わ', wo: 'を', nn: 'ん', "n'": 'ん',
  xa: 'ぁ', xi: 'ぃ', xu: 'ぅ', xe: 'ぇ', xo: 'ぉ', la: 'ぁ', li: 'ぃ', lu: 'ぅ', le: 'ぇ', lo: 'ぉ',
  xya: 'ゃ', xyu: 'ゅ', xyo: 'ょ', lya: 'ゃ', lyu: 'ゅ', lyo: 'ょ', xtu: 'っ', xtsu: 'っ', ltu: 'っ',
  sha: 'しゃ', shu: 'しゅ', she: 'しぇ', sho: 'しょ', cha: 'ちゃ', chu: 'ちゅ', che: 'ちぇ', cho: 'ちょ',
  ja: 'じゃ', ju: 'じゅ', je: 'じぇ', jo: 'じょ', jya: 'じゃ', jyu: 'じゅ', jyo: 'じょ',
  tsa: 'つぁ', fa: 'ふぁ', fi: 'ふぃ', fe: 'ふぇ', fo: 'ふぉ', thi: 'てぃ', dhi: 'でぃ', '-': 'ー',
};
for (const [c, k] of Object.entries({ k: 'き', g: 'ぎ', s: 'し', z: 'じ', t: 'ち', c: 'ち', d: 'ぢ', n: 'に', h: 'ひ', b: 'び', p: 'ぴ', m: 'み', r: 'り' })) {
  ROMA[`${c}ya`] = `${k}ゃ`;
  ROMA[`${c}yu`] = `${k}ゅ`;
  ROMA[`${c}yo`] = `${k}ょ`;
}
const CONS = 'bcdfghjklmpqrstvwxyz';

// 입력 중인 글을 바꿈. 끝에 덜 친 로마자(예: 'ts')는 그대로 둠. 가타카나는 히라가나로
export function toKana(input) {
  const s = toHira(String(input || '')).toLowerCase();
  let out = '';
  let i = 0;
  while (i < s.length) {
    const c = s[i];
    if (!/[a-z'-]/.test(c)) {
      out += c;
      i += 1;
      continue;
    }
    // 같은 자음 두 번 → っ (nn 은 ん)
    if (CONS.includes(c) && c !== 'n' && s[i + 1] === c) {
      out += 'っ';
      i += 1;
      continue;
    }
    let hit = '';
    for (let len = 4; len >= 1; len--) {
      const part = s.slice(i, i + len);
      if (ROMA[part]) {
        hit = part;
        break;
      }
    }
    // n 다음에 모음·y 가 아니면 ん
    if (!hit && c === 'n' && i + 1 < s.length && !/[aiueoy]/.test(s[i + 1])) {
      out += 'ん';
      i += 1;
      continue;
    }
    if (hit === 'n' || (!hit && c === 'n')) {
      out += s.slice(i);
      break;
    }
    if (!hit) {
      out += s.slice(i);
      break;
    }
    out += ROMA[hit];
    i += hit.length;
  }
  return out;
}
// 다 친 뒤: 끝에 남은 n 은 ん
export const finishKana = (input) => toKana(input).replace(/n$/, 'ん');

export const toHira = (s) => String(s || '').replace(/[ァ-ヶ]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0x60));
// 비교 전에 다듬기: 전각 글자·보이지 않는 글자·띄어쓰기 빼고, 가타카나는 히라가나로
const tidy = (s) => toHira(String(s || '').normalize('NFKC')).replace(/[\s\u200b-\u200f\u2060\ufeff]/g, '');
export const sameReading = (input, r) => tidy(finishKana(tidy(input))) === tidy(r);

// 읽기를 입력해서 물을 단어인지 (한자가 있고 가타카나 말이 아닌 것)
export const askReading = (w) => hasKanji(w.w) && !isKatakana(w.w) && w.r !== w.w;

/* ───────── 뜻 4개 중 고르기 ───────── */
const shuffle = (a, rnd = Math.random) => {
  const x = [...a];
  for (let i = x.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [x[i], x[j]] = [x[j], x[i]];
  }
  return x;
};
// 뜻 조각 ('(어떤 곳으로) 향하다, 부임하다' → ['향하다', '부임하다'])
export const meaningBits = (m) =>
  String(m || '')
    .replace(/[(（][^)）]*[)）]/g, '')
    .split(/[,，、;；/·]/)
    .map((x) => x.trim().replace(/^to /, ''))
    .filter((x) => x.length >= 2);
const overlap = (a, b) => {
  const B = new Set(meaningBits(b));
  return meaningBits(a).some((x) => B.has(x));
};

export function meaningChoices(word, pool, rnd = Math.random) {
  const ok = (x) => x.id !== word.id && x.m && x.m !== word.m && !overlap(x.m, word.m);
  // 같은 말(한국어/영어), 같은 급수·묶음 먼저 → 헷갈리게
  const same = pool.filter((x) => ok(x) && !!x.en === !!word.en && (x.set === word.set || x.lv === word.lv));
  const any = pool.filter((x) => ok(x) && !!x.en === !!word.en);
  const picks = [];
  for (const x of [...shuffle(same, rnd).slice(0, 40), ...shuffle(any, rnd).slice(0, 40)]) {
    if (picks.length >= 3) break;
    if (!picks.some((p) => p === x.m || overlap(p, x.m))) picks.push(x.m);
  }
  return shuffle([word.m, ...picks], rnd);
}

/* ───────── 오늘 할 것 ───────── */
// 배우는 중(ls)인데 아직 다시 볼 시각(la)이 안 된 카드
export const waiting = (c, now) => !!c?.ls && (c.la || 0) > now;

// 하루 복습 상한 고르기 (0 = 제한 없음). 넘친 건 날짜를 바꾸지 않고 그대로 두면 다음 날 먼저 나옴
export const REV_CAPS = [100, 150, 200, 300, 0];
export const REV_CAP = 200;
// 오늘 이미 복습한 수 (오늘 처음 배운 단어는 빼고)
export const reviewedToday = (cards, today) => Object.values(cards).filter((c) => c?.t === today && c.f !== today && !c.skip).length;

// 복습할 것: 날짜가 된 카드(배우는 중이면 시각도 된 것)
//  · 순서: 배우는 중 → 간격 짧은 것(잊기 쉬운 것) → 오래 밀린 것
//  · cap(하루 상한)이 있으면 배우는 중이 아닌 복습은 (상한 - 오늘 한 수) 개까지만
export function reviewIds(ids, cards, today, now, cap = 0) {
  const out = [];
  for (const id of ids) {
    const c = cards[id];
    if (!c?.t || c.skip || c.d > today || waiting(c, now)) continue;
    out.push(id);
  }
  out.sort((a, b) => (cards[b].ls ? 1 : 0) - (cards[a].ls ? 1 : 0) || (cards[a].i || 0) - (cards[b].i || 0) || cards[a].d.localeCompare(cards[b].d));
  if (!cap) return out;
  const room = Math.max(0, cap - reviewedToday(cards, today));
  const ls = out.filter((id) => cards[id].ls);
  return [...ls, ...out.filter((id) => !cards[id].ls).slice(0, room)];
}

// 앞으로 days 일 복습 수 [{ d, n }] — 오늘 칸엔 밀린 것·배우는 중도 들어감
export function forecast(cards, today, days = 7) {
  const out = Array.from({ length: days }, (_, k) => ({ d: ymd(addDays(parse(today), k)), n: 0 }));
  const last = out[days - 1].d;
  for (const c of Object.values(cards)) {
    if (!c?.t || c.skip || !c.d || c.d > last) continue;
    const k = c.d <= today ? 0 : diffDays(today, c.d);
    out[k].n += 1;
  }
  return out;
}

/* ───────── 안 외워지는 단어 ───────── */
// 4번 넘게 틀렸고 아직 간격이 3주가 안 된 것. 3주 넘게 기억하면 저절로 빠짐
export const LEECH_L = 4;
export const isLeech = (c) => !!c?.t && !c.skip && (c.l || 0) >= LEECH_L && (c.i || 0) < 21;
// 뜻 고르기에서 잘못 고른 단어 기억 (헷갈리는 짝, 최근 3개)
export const addConfused = (c, otherId) => ({ ...(c || {}), cf: [otherId, ...((c?.cf || []).filter((x) => x !== otherId))].slice(0, 3) });
// 아직 기다리는 배우는 중 카드 수와 가장 빠른 시각
export function waitingInfo(ids, cards, now) {
  let n = 0;
  let next = Infinity;
  for (const id of ids) {
    const c = cards[id];
    if (c?.t && !c.skip && waiting(c, now)) {
      n += 1;
      next = Math.min(next, c.la);
    }
  }
  return { n, next };
}
// 새로 배울 단어 (몰라요로 고른 것 먼저), 많아야 n 개
export function newIds(words, cards, n) {
  if (n <= 0) return [];
  const out = [];
  for (const id of idsInOrder(words, cards)) {
    const c = cards[id];
    if (c?.t || c?.skip) continue;
    out.push(id);
    if (out.length >= n) break;
  }
  return out;
}

/* ───────── 카드 상태 바꾸기 ───────── */
// 배우기 퀴즈를 다 맞힌 새 단어 → 배우는 중 1단계, 10분 뒤 다시
export function learned(card, today, now) {
  return { ...(card || {}), pri: undefined, t: today, f: card?.f || today, d: today, i: 0, n: 0, l: 0, e: 250, ls: 1, la: now + RELEARN_MIN * 60e3 };
}

// 복습 결과 (ok: 알았음/몰랐음)
//  · 배우는 중 카드: 맞히면 졸업 — 처음 배운 것은 내일, 복습에서 틀렸던 것은 원래 간격(pi)의 절반 뒤 (WaniKani 처럼 처음부터 X)
//  · 틀리면 오늘 안에 10분 뒤 한 번 더 (배우는 중으로 돌아감, 원래 간격은 pi 에 기억)
//  · 기억 이야기(mn)·헷갈리는 짝(cf)은 그대로 둠
export function answer(card, ok, today, now, exam) {
  const c = card || {};
  const keep = { f: c.f, mn: c.mn, cf: c.cf };
  if (c.ls) {
    if (!ok) return { ...c, l: (c.l || 0) + 1, la: now + RELEARN_MIN * 60e3, t: today };
    const g = grade({ e: c.e }, 3, today, exam); // 처음 배운 것처럼: 1일 뒤
    const out = { ...g, ...keep, l: c.l || 0, n: (c.n || 0) + 1 };
    if (c.pi > 1) {
      let i = Math.max(1, Math.floor(c.pi / 2));
      const left = exam ? diffDays(today, exam) - 1 : 0;
      if (left >= 1) i = Math.min(i, Math.max(1, Math.ceil(left / 2)));
      Object.assign(out, { i, d: ymd(addDays(parse(today), i)) });
    }
    return out;
  }
  const g = grade(c, ok ? 3 : 1, today, exam);
  const next = { ...g, ...keep };
  if (!ok) Object.assign(next, { d: today, ls: 1, la: now + RELEARN_MIN * 60e3, pi: c.i || 0 });
  return next;
}

// 저장할 때 undefined 칸 빼기
export const clean = (o) => Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined));
