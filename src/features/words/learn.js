// 외우기 로직 (화면 없이 테스트할 수 있게)
//  · 배우기: 새 단어 5개씩 먼저 보여 주고 → 바로 그 5개로 퀴즈 → 다 맞히면 10분 뒤 한 번 더 (WaniKani·Anki 배우는 단계)
//  · 확인: 한자 단어는 읽기를 직접 입력(로마자도 됨) + 뜻 4개 중 고르기 → 몰랐음/알았음 두 버튼
//  · 카드 상태는 srs.js 와 같은 words 묶음. 배우는 중이면 ls(단계)·la(다시 볼 시각 ms) 가 더 붙음
import { grade } from '../../lib/srs';
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
export const sameReading = (input, r) => toHira(finishKana(input)).replace(/\s/g, '') === toHira(r).replace(/\s/g, '');

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

// 복습할 것: 날짜가 된 카드(배우는 중이면 시각도 된 것). 배우는 중 먼저, 그다음 오래된 날짜 순
export function reviewIds(ids, cards, today, now) {
  const out = [];
  for (const id of ids) {
    const c = cards[id];
    if (!c?.t || c.skip || c.d > today || waiting(c, now)) continue;
    out.push(id);
  }
  return out.sort((a, b) => (cards[b].ls ? 1 : 0) - (cards[a].ls ? 1 : 0) || cards[a].d.localeCompare(cards[b].d));
}
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

// 복습 결과 (ok: 알았음/몰랐음). 배우는 중 카드는 맞히면 졸업(내일), 틀리면 10분 뒤 또
export function answer(card, ok, today, now, exam) {
  const c = card || {};
  if (c.ls) {
    if (!ok) return { ...c, l: (c.l || 0) + 1, la: now + RELEARN_MIN * 60e3, t: today };
    const g = grade({ e: c.e }, 3, today, exam); // 처음 배운 것처럼: 1일 뒤
    return { ...g, f: c.f, l: c.l || 0, n: (c.n || 0) + 1 };
  }
  const g = grade(c, ok ? 3 : 1, today, exam);
  const next = { ...g, f: c.f };
  // 틀리면 오늘 안에 10분 뒤 한 번 더 (배우는 중으로 돌아감)
  if (!ok) Object.assign(next, { d: today, ls: 1, la: now + RELEARN_MIN * 60e3 });
  return next;
}

// 저장할 때 undefined 칸 빼기
export const clean = (o) => Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined));
