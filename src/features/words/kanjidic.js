// 한자 하나 정보 (lists/parts.txt, tools/parts-build.py): 부수 번호·부품·닮은 한자·음독·훈독 (KANJIDIC2 등)
import raw from './lists/parts.txt?raw';

export const PARTS = (() => {
  const m = new Map();
  for (const line of raw.split(/\r?\n/)) {
    if (!line || line.startsWith('#')) continue;
    const [ch, rad, parts, look, on, kun] = line.split('|');
    m.set(ch, {
      ch,
      rad: +rad || 0,
      parts: parts ? parts.split(' ') : [],
      look: look ? [...look] : [],
      on: on ? on.split(',') : [],
      kun: kun ? kun.split(',') : [],
    });
  }
  return m;
})();

/* ───────── 음독 · 훈독 ───────── */
const VOICE = { か: 'が', き: 'ぎ', く: 'ぐ', け: 'げ', こ: 'ご', さ: 'ざ', し: 'じ', す: 'ず', せ: 'ぜ', そ: 'ぞ', た: 'だ', ち: 'ぢ', つ: 'づ', て: 'で', と: 'ど', は: 'ば', ひ: 'び', ふ: 'ぶ', へ: 'べ', ほ: 'ぼ' };
const HALF = { は: 'ぱ', ひ: 'ぴ', ふ: 'ぷ', へ: 'ぺ', ほ: 'ぽ' };
// 단어 속에서 바뀐 소리도 같게: 흐려짐(か→が·は→ぱ), 끝 っ(がく→がっ), じ↔ぢ·ず↔づ
function forms(r) {
  const out = new Set([r]);
  const f = r[0];
  for (const x of [VOICE[f], HALF[f]]) if (x) out.add(x + r.slice(1));
  if (r.length > 1 && 'つちくきう'.includes(r.at(-1))) for (const y of [...out]) out.add(y.slice(0, -1) + 'っ');
  for (const y of [...out]) out.add(y.replace(/ぢ/g, 'じ').replace(/づ/g, 'ず'));
  return out;
}
const U2I = { う: 'い', く: 'き', ぐ: 'ぎ', す: 'し', つ: 'ち', ぬ: 'に', ぶ: 'び', む: 'み', る: 'り' };
// 훈독 줄기: た.つ → た·たつ·たち(명사꼴) · か.える → か·かえ · かた.る → かた·かたり
function stems(x) {
  const [a, b = ''] = x.split('.');
  const out = [a];
  if (b) {
    out.push(a + b);
    const last = b.at(-1);
    if (last === 'る' && b.length > 1) out.push(a + b.slice(0, -1));
    if (U2I[last]) out.push(a + b.slice(0, -1) + U2I[last]);
  }
  return out;
}
const norm = (s) => s.replace(/ぢ/g, 'じ').replace(/づ/g, 'ず');

// 이 한자를 이 소리로 읽으면 음독인가 훈독인가: 'on' | 'kun' | ''
export function readingKind(ch, part) {
  const info = PARTS.get(ch);
  if (!info || !part) return '';
  const p = norm(part);
  const hit = (list) => list.some((x) => [...x].length && stems(x).some((y) => forms(y).has(p)));
  const on = info.on.some((x) => forms(x).has(p));
  const kun = hit(info.kun);
  if (on && !kun) return 'on';
  if (kun && !on) return 'kun';
  if (on && kun) return info.on.some((x) => x === p) ? 'on' : 'kun';
  return '';
}

