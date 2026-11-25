// 문법 퀴즈 후리가나 만들기 → src/features/grammar/furi-data.js
//  npm i --no-save kuromoji@0.1.2 && node tools/furi-build.mjs
//  화면에 나오는 일본어(문법·접속·예문·빈칸 문장·보기·★ 조각·설명)를 문장째 kuromoji 로 읽고
//  '{漢字|かんじ}' 모양으로 저장. 조각(빈칸 앞뒤·★ 조각)은 문장 전체에서 읽은 것을 잘라 씀(문맥 그대로)
//  kuromoji 가 틀린 건 tools/furi-fix.mjs 에 (문장 속 낱말 → 읽기)
import kuromoji from 'kuromoji';
import { createRequire } from 'module';
import { writeFileSync } from 'fs';
import { GRAMMAR } from '../src/features/grammar/data.js';
import { MORE } from '../src/features/grammar/more.js';
import { EXTRA } from '../src/features/grammar/gloss.js';
import { cloze } from '../src/features/grammar/quiz.js';
import { FIX } from './furi-fix.mjs';

const require = createRequire(import.meta.url);
const dicPath = require.resolve('kuromoji').replace(/(src|build)[\\/]kuromoji\.js$/, '') + 'dict';
const tk = await new Promise((ok, no) => kuromoji.builder({ dicPath }).build((e, t) => (e ? no(e) : ok(t))));

const KANJI = /[㐀-鿿々〆ヶ]/;
const hira = (s) => s.replace(/[ァ-ヶ]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0x60));
const fillIn = (s, a) => { const p = a.split(' / '); let i = 0; return s.replace(/（　）/g, () => p[i++] ?? p[0]); };

// 문장 → 한자 낱말 [{ s 시작, e 끝, w 낱말, r 읽기 }]
const pairs = new Map(); // '낱말\t읽기' → 처음 나온 문장 (확인용)
function words(t) {
  const out = [];
  let at = 0;
  const toks = tk.tokenize(t);
  for (let i = 0; i < toks.length; i++) {
    const x = toks[i];
    const w = x.surface_form;
    const s = t.indexOf(w, at);
    at = s + w.length;
    if (!KANJI.test(w)) continue;
    let r = x.reading && x.reading !== '*' ? hira(x.reading) : '';
    if (!r) console.log(`읽기 없음: ${w} — ${t}`);
    out.push({ s, e: at, w, r });
    const key = `${w}\t${r}`;
    if (!pairs.has(key)) pairs.set(key, t);
  }
  return fixed(t, out);
}
const covered = (t, ctx, s, e) => { for (let i = t.indexOf(ctx); i >= 0; i = t.indexOf(ctx, i + 1)) if (i <= s && e <= i + ctx.length) return true; return false; };
// FIX: 그 낱말 자리에 걸친 kuromoji 낱말을 지우고 한 덩어리로. 숫자 뒤 月 은 がつ
function fixed(t, out) {
  for (const x of out) if (x.w === '月' && /[0-9０-９]$/.test(t.slice(0, x.s))) x.r = 'がつ';
  for (const [w, r, ctx] of FIX) {
    let from = 0;
    for (;;) {
      const s = t.indexOf(w, from);
      if (s < 0) break;
      from = s + w.length;
      if (ctx && !covered(t, ctx, s, s + w.length)) continue;
      const e = s + w.length;
      if (out.some((x) => x.w !== w && x.s < e && x.e > s && (x.s < s || x.e > e) && !(x.s >= s && x.e <= e))) continue; // 더 긴 낱말 속이면 그대로 (日本 ⊂ 日本人)
      out = out.filter((x) => x.e <= s || x.s >= e);
      out.push({ s, e, w, r });
    }
  }
  return out.sort((a, b) => a.s - b.s);
}

// 낱말 + 읽기 → '{東京|とうきょう}', 오쿠리가나는 밖으로 '{飛|と}び{出|だ}す'
function ruby(w, r) {
  const parts = w.split(/([぀-ヿ]+)/).filter(Boolean);
  const re = new RegExp('^' + parts.map((p) => (KANJI.test(p) ? '(.+?)' : `(${hira(p)})`)).join('') + '$');
  const m = hira(r).match(re);
  if (!m) return `{${w}|${r}}`;
  return parts.map((p, i) => (KANJI.test(p) ? `{${p}|${m[i + 1]}}` : p)).join('');
}
function annotate(t, ws, from = 0, to = t.length) {
  let out = '';
  let at = from;
  for (const x of ws) {
    if (x.s < from || x.e > to) continue;
    out += t.slice(at, x.s) + ruby(x.w, x.r);
    at = x.e;
  }
  return out + t.slice(at, to);
}

const ANN = {};
const put = (k, v) => {
  if (!KANJI.test(k) || !v.includes('{')) return;
  if (ANN[k] && ANN[k] !== v) console.log(`다르게 읽힘: ${k}  ${ANN[k]}  /  ${v}`);
  else ANN[k] = v;
};
const whole = (t) => { const ws = words(t); put(t, annotate(t, ws)); return ws; };
// 문장 full 안의 조각들 (순서대로 찾음). 낱말이 조각 경계에 걸치면 조각만 따로 읽음
function piecesIn(full, list) {
  const ws = whole(full);
  let at = 0;
  for (const p of list) {
    if (!p) continue;
    const s = full.indexOf(p, at);
    if (s < 0) { whole(p); continue; }
    at = s + p.length;
    const cut = ws.some((x) => x.s < s + p.length && x.e > s && (x.s < s || x.e > s + p.length));
    if (cut) { console.log(`조각 경계: ${p} — ${full}`); whole(p); } else put(p, annotate(full, ws, s, s + p.length));
  }
}

for (const g of GRAMMAR) {
  whole(g.f); whole(g.c); whole(g.ex.j);
  const parts = g.q.s.split('（　）');
  piecesIn(fillIn(g.q.s, g.q.a), parts.flatMap((p, i) => (i < parts.length - 1 ? [p, g.q.a.split(' / ')[i] ?? g.q.a] : [p])));
  [g.q.a, ...g.q.w].forEach(whole);
}
for (const m of Object.values(MORE)) {
  if (m.n) whole(m.n);
  for (const [j, , w] of m.x || []) {
    const c = cloze(j);
    const parts = c.s.split('（　）');
    const ans = c.a.split(' / ');
    piecesIn(c.full, parts.flatMap((p, i) => (i < parts.length - 1 ? [p, ans[i] ?? c.a] : [p])));
    [c.a, ...w].forEach(whole);
  }
  if (m.st) { const [pre, order, post] = m.st; piecesIn(pre + order.join('') + post, [pre, ...order, post]); }
}
Object.keys(EXTRA).forEach(whole);

const keys = Object.keys(ANN).sort();
writeFileSync(new URL('../src/features/grammar/furi-data.js', import.meta.url),
  '// tools/furi-build.mjs 가 만든 파일 — 직접 고치지 말고 tools/furi-fix.mjs 를 고친 뒤 다시 만들기\n// 화면 글 → 같은 글에 읽기를 붙인 것 ({漢字|かんじ})\nexport const FURI = {\n' +
  keys.map((k) => `  ${JSON.stringify(k)}: ${JSON.stringify(ANN[k])},`).join('\n') + '\n};\n');
if (process.env.FURI_DUMP) writeFileSync(process.env.FURI_DUMP, [...pairs].map(([k, t]) => `${k}\t${t}`).sort().join('\n'));
console.log(`글 ${keys.length}개 · 낱말 ${pairs.size}가지`);
