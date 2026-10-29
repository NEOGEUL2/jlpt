// 보기 뜻 찾기: 빈칸 보기('をもって', 'のを機に', '極まりなかった' …) → 어느 문법인지 · 뜻
//  1) EXTRA 에 그대로 있으면 그것 (N1 목록에 없는 말·헷갈리기 쉬운 말)
//  2) 목록(GRAMMAR)의 문법 모양과 맞춰 봄 — 존댓말·과거·앞뒤 붙은 글자를 조금씩 떼어 가며
import { GRAMMAR } from './data.js';

// 목록에 없는 보기의 뜻 (보기로 나오는 것만)
export const EXTRA = {
  なりとも: '~라도 (조금이라도)',
  とたんに: '~한 순간 (우연히 바로)',
  あまりに: '너무 ~한 나머지',
  あまり: '너무 ~한 나머지',
  ところを: '~하는 중에 (실례지만)',
  までに: '~까지 (기한)',
  ようものなら: '~했다가는 (큰일)',
  るなり: '~하자마자',
  ないが: '~하지 않지만',
  ないと: '~하지 않으면',
  ずとも: '~하지 않아도',
  ずに: '~하지 않고',
  もので: '~라서 (변명)',
  ものだから: '~라서 (변명)',
  つつある: '~하고 있다 (진행 중)',
  次第: '~하는 대로 곧 / ~에 달림',
  しだい: '~하는 대로 곧 / ~에 달림',
  ばかりか: '~뿐만 아니라',
  ばかりで: '~하기만 하고',
  ことなく: '~하지 않고',
  ことか: '얼마나 ~했던가 (감탄)',
  ことだから: '~이니까 (그 사람 성격상)',
  にも: '~에도',
  では: '~에서는',
  から: '~니까',
  とも: '~해도 / ~든',
  'とも / とも': '~해도 ~해도',
  とて: '~라도, ~라 해도',
  とか: '~라든가',
  ても: '~해도',
  ながら: '~하면서 / ~이지만',
  がらみ: '~남짓, ~에 얽힌',
  ぶり: '~만에 / ~하는 모양',
  ぶる: '~인 척하다',
  じみて: '~같아 보여 (나쁜 느낌)',
  じみた: '~같아 보이는 (나쁜 느낌)',
  じみ: '~같아 보임 (나쁜 느낌)',
  めいた: '~다운, ~한 느낌의',
  めいて: '~다워져, ~한 느낌이 나',
  まみれて: '~투성이가 되어',
  まみれで: '~투성이로',
  ずくめで: '온통 ~로',
  ずくめて: '(쓰지 않는 꼴) ずくめ = 온통 ~',
  ありうべき: '있을 법한',
  あるべく: '있기 위해',
  あらんばかりの: '있는 대로 다한 (온 힘을)',
  に足りない: '~할 가치가 없다',
  に足りなかった: '~할 가치가 없었다',
  に足りません: '~할 가치가 없습니다',
  にかまける: '~에 정신이 팔리다',
  に即する: '~에 입각하다',
  ないものか: '~할 수 없을까 (바람)',
  まいが: '~하지 않든',
  まいと: '~하지 않으려고',
  'と来ないと': '(쓰지 않는 꼴)',
  'にも来ないにも': '(쓰지 않는 꼴)',
  'か来ないか': '올지 안 올지',
  ないまでに: '(쓰지 않는 꼴) ないまでも = ~까지는 아니더라도',
  だの: '~라든가 (불만 섞인 나열)',
  'だの / なり': '(쓰지 않는 짝)',
  'だの / だの': '~라든가 ~라든가 (불만 섞인 나열)',
  なりの: '~나름의',
  にかかわらず: '~에 관계없이',
  であって: '~이고, ~이며',
  をかわきりに: '~을 시작으로 (を皮切りに)',
  ないまでの: '(쓰지 않는 꼴) ないまでも = ~까지는 아니더라도',
  てまでもない: '(쓰지 않는 꼴) までもない = ~할 필요도 없다',
};

// 문법 모양 → 항목 ('～（よ）うと / ～（よ）うが' → うと, うが · '～つつ（も）' → つつ, つつも)
const INDEX = new Map();
const put = (k, g) => k && !INDEX.has(k) && INDEX.set(k, g);
for (const g of GRAMMAR) {
  for (const v of g.f.split(' / ')) {
    for (const seg of v.split('～').filter(Boolean)) {
      const s = seg.replace(/（よ）/g, '').replace(/\s/g, '');
      put(s.replace(/（[^）]*）/g, ''), g); // 괄호 뺀 것
      put(s.replace(/[（）]/g, ''), g); // 괄호 안까지
      const bare = s.replace(/（[^）]*）/g, '');
      if (/^[たて]/.test(bare) && bare.length > 2) put(bare.slice(1), g); // たところで → ところで
    }
  }
}

// 꼬리 바꾸기: 존댓말·과거 → 기본형
const TAILS = [
  [/ありません$/, 'ない'],
  [/ません$/, 'ない'],
  [/なかった$/, 'ない'],
  [/でした$/, 'だ'],
  [/です$/, 'だ'],
  [/だった$/, 'だ'],
  [/あった$/, 'ある'],
  [/された$/, 'される'],
  [/た$/, 'て'],
];

function candidates(c) {
  const out = [c];
  for (const [re, to] of TAILS) if (re.test(c)) out.push(c.replace(re, to));
  const more = [];
  for (const x of out) {
    more.push(x, x.replace(/だ$/, ''), x + 'だ');
    if (/^[のるた]/.test(x) && x.length > 2) more.push(x.slice(1));
    more.push(x + 'に', x.replace(/だ$/, '') + 'に', 'の' + x, 'の' + x.replace(/だ$/, ''));
    for (const cut of [1, 2]) if (x.length - cut >= 2) more.push(x.slice(0, -cut), x.slice(0, -cut) + 'だ');
  }
  return more;
}

// 보기 → { f 문법, m 뜻, id? } 못 찾으면 null
export function glossOf(choice) {
  const c = String(choice || '').replace(/\s/g, '');
  const raw = String(choice || '').trim();
  if (EXTRA[raw]) return { f: raw, m: EXTRA[raw] };
  if (EXTRA[c]) return { f: raw, m: EXTRA[c] };
  // 짝 보기 'なり / なり' → '～なり～なり' 같은 짝 문법
  const head = c.split('/')[0];
  if (c.includes('/')) {
    const g = GRAMMAR.find((x) => x.f.split('～').filter(Boolean)[0]?.replace(/\s/g, '') === head && x.f.split('～').filter(Boolean).length > 1);
    if (g) return { f: g.f, m: g.m, id: g.id };
  }
  if (EXTRA[head]) return { f: raw, m: EXTRA[head] };
  for (const k of candidates(head)) {
    const g = INDEX.get(k);
    if (g) return { f: g.f, m: g.m, id: g.id };
    if (EXTRA[k]) return { f: raw, m: EXTRA[k] };
  }
  return null;
}
