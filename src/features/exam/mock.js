// 언어지식 모의 시험 (실제 N1 언어지식과 같은 순서·모양)
//  문자·어휘: 問題1 漢字読み 6 · 問題2 文脈規定 7 · 問題3 言い換え類義 6 · 問題4 用法 6
//  문법: 問題5 文法形式判断 10 · 問題6 文の組み立て(★) 5
//  kind: full 문자·어휘 25 · mini 미니 10(3·3·2·2) · gram 문법 15 · lang 언어지식 40(問題1~6 한 번에)
//  · 漢字読み 는 words/yomi.js (장음·촉음·탁음 함정 2×2), 2~4 는 words/n1quiz.js, 5·6 은 grammar/quiz.js
//  · 기록: 묶음 'mock' { id, day, at, kind, sec, parts: { yomi: [맞힘, 문제 수], … }, wrong: [단어 id], wrongG: [문법 id] }
import { makeQuiz } from '../words/n1quiz';
import { quizPick } from '../words/words';
import { yomiChoices, yomiOk } from '../words/yomi';
import { wordKinds } from '../words/kanji';
import { GRAMMAR } from '../grammar/data';
import { makeQuestion, moreOf, shuffle } from '../grammar/quiz';
import { glossOf } from '../grammar/gloss';

export const SECTIONS = [
  { k: 'yomi', no: 1, full: 6, mini: 3, gram: 0, lang: 6, name: '漢字読み', ko: '한자 읽기', ja: '＿＿＿の言葉の読み方として最もよいものを、１・２・３・４から一つ選びなさい。' },
  { k: 'ctx', no: 2, full: 7, mini: 3, gram: 0, lang: 7, name: '文脈規定', ko: '문맥 (빈칸)', ja: '（　　）に入れるのに最もよいものを、１・２・３・４から一つ選びなさい。' },
  { k: 'para', no: 3, full: 6, mini: 2, gram: 0, lang: 6, name: '言い換え類義', ko: '비슷한 말', ja: '＿＿＿の言葉に意味が最も近いものを、１・２・３・４から一つ選びなさい。' },
  { k: 'use', no: 4, full: 6, mini: 2, gram: 0, lang: 6, name: '用法', ko: '쓰임', ja: '次の言葉の使い方として最もよいものを、１・２・３・４から一つ選びなさい。' },
  { k: 'gf', no: 5, full: 0, mini: 0, gram: 10, lang: 10, g: 1, name: '文法形式判断', ko: '문법 (빈칸)', ja: '次の文の（　　）に入れるのに最もよいものを、１・２・３・４から一つ選びなさい。' },
  { k: 'st', no: 6, full: 0, mini: 0, gram: 5, lang: 5, g: 1, name: '文の組み立て', ko: '★ 문장 만들기', ja: '次の文の ★ に入る最もよいものを、１・２・３・４から一つ選びなさい。' },
];
export const secOf = (k) => SECTIONS.find((s) => s.k === k);
// 모의 종류 (화면 이름·목표 시간 계산용)
export const KINDS = {
  lang: { name: '언어지식 모의 40', n: 40 },
  full: { name: '문자·어휘 모의 25', n: 25 },
  gram: { name: '문법 모의 15', n: 15 },
  mini: { name: '미니 모의 10', n: 10 },
};
export const kindName = (k) => KINDS[k]?.name || k;

// 문법 문제에 낼 것: 틀린 적 있거나 간격 짧은 본 문법 먼저(절반쯤), 나머지는 아무거나 (실제 시험처럼 안 본 것도 나옴)
export function gramPick(cards, n, rnd = Math.random, avoid = new Set(), only = () => true) {
  const ok = GRAMMAR.filter((g) => !avoid.has(g.id) && only(g));
  const seen = shuffle(ok.filter((g) => cards[g.id]?.t), rnd).sort((a, b) => (cards[b.id].l || 0) - (cards[a.id].l || 0) || (cards[a.id].i || 0) - (cards[b.id].i || 0));
  const pick = seen.slice(0, Math.ceil(n / 2));
  pick.push(...shuffle(ok.filter((g) => !pick.includes(g)), rnd).slice(0, n - pick.length));
  return shuffle(pick, rnd);
}

// ★ 문제로 낼 수 있는 것: 조각 4개가 모두 달라야 보기가 구별됨 (やら…やら 처럼 같은 조각이 둘이면 퀴즈에서만)
export const starOk = (g) => {
  const st = moreOf(g.id).st;
  return !!st && new Set(st[1]).size === st[1].length;
};

// 문법 한 문제 → 모의 모양 { type 'gf'|'st', gid, ask…, options: [{ text, m }], answer 번호 }
export function gramQuestion(item, type, rnd = Math.random, v = 0) {
  if (type === 'st') {
    const [pre, order, post, star] = moreOf(item.id).st;
    const opts = shuffle(order.map((t, i) => ({ text: t, i })), rnd);
    return { type, gid: item.id, item, pre, post, order, star, options: opts, answer: opts.findIndex((o) => o.i === star) };
  }
  const q = makeQuestion(item, 'fill', rnd, v);
  const options = q.choices.map((c) => ({ text: c, m: (q.notes[c] || glossOf(c))?.m || '' }));
  return { type: 'gf', gid: item.id, item, ask: q.ask, k: q.k, full: q.full, options, answer: q.choices.indexOf(q.answer) };
}
// 목표 시간: 문자·어휘 한 문제 30초, 문법 빈칸 45초, ★ 60초
//  (실제 시험은 언어지식·독해 110분이라 언어지식 40문제를 25분 안에 끝내고 독해에 시간을 남겨야 함)
export const SEC_PER_Q = 30;
const SEC_OF = { gf: 45, st: 60 };
export const goalOf = (qs) => qs.reduce((a, q) => a + (SEC_OF[q.sec] || SEC_PER_Q), 0);

// 시험 급수(N2·N1)와 교재 단어에서 냄. 본 적 있는 약한 단어가 먼저, 모자라면 안 본 단어 (실제 시험처럼 처음 보는 말도 나옴)
export function makeMock(pool, cards, kind = 'full', rnd = Math.random, gcards = {}) {
  const exam = pool.filter((w) => w.lv !== 'N3');
  const used = new Set();
  const out = [];
  const usedG = new Set();
  for (const s of SECTIONS) {
    const n = s[kind] || 0;
    if (!n) continue;
    if (s.g) {
      const list = gramPick(gcards, n, rnd, usedG, s.k === 'st' ? starOk : undefined);
      for (const g of list.slice(0, n)) {
        usedG.add(g.id);
        // 빈칸 문장은 본 횟수로 돌려서 (퀴즈에서 본 문장과 다르게)
        out.push({ ...gramQuestion(g, s.k, rnd, (gcards[g.id]?.n || 0) + (gcards[g.id]?.l || 0) + 1), sec: s.k });
      }
      continue;
    }
    const left = exam.filter((w) => !used.has(w.id));
    let qs = [];
    if (s.k === 'yomi') {
      // 실제 시험처럼 대부분 한자 두 글자 이상 음독 말, 한 문제쯤은 오쿠리가나 붙은 훈독 말(携わる 같은)
      const ok = left.filter(yomiOk);
      const on = ok.filter((w) => wordKinds(w.w, w.r)?.type === 'on' && w.w.length >= 2);
      const kun = ok.filter((w) => { const k = wordKinds(w.w, w.r); return k?.type === 'kun' && k.tail; });
      const nKun = Math.min(kun.length, Math.max(1, Math.round(n / 6)));
      const pickW = [...quizPick(on, cards, n - nKun, rnd), ...quizPick(kun, cards, nKun, rnd)];
      if (pickW.length < n) pickW.push(...quizPick(ok.filter((w) => !pickW.includes(w)), cards, n - pickW.length, rnd));
      qs = pickW.map((w) => ({ type: 'yomi', word: w, options: yomiChoices(w, pool, rnd) }))
        .map((q) => ({ ...q, answer: q.options.findIndex((o) => o.r === q.word.r) }));
    } else {
      qs = makeQuiz(left, cards, n, rnd, [s.k]).filter((q) => q.type === s.k);
      // 예문 있는 시험 급수 단어가 모자라면 전체에서
      if (qs.length < n) qs = [...qs, ...makeQuiz(pool.filter((w) => !used.has(w.id) && !qs.some((q) => q.word.id === w.id)), cards, n - qs.length, rnd, [s.k]).filter((q) => q.type === s.k)];
    }
    for (const q of qs.slice(0, n)) {
      used.add(q.word.id);
      out.push({ ...q, sec: s.k });
    }
  }
  return out;
}

// 채점: picks = 문제마다 고른 번호 (안 고르면 null)
export function scoreMock(qs, picks) {
  const parts = {};
  const wrong = [];
  const wrongG = [];
  qs.forEach((q, i) => {
    const p = (parts[q.sec] ||= [0, 0]);
    p[1] += 1;
    if (picks[i] === q.answer) p[0] += 1;
    else if (q.gid) wrongG.push(q.gid);
    else wrong.push(q.word.id);
  });
  const ok = Object.values(parts).reduce((a, p) => a + p[0], 0);
  // 문자·어휘 / 문법 따로 (공부 기록 영역 나눔)
  const sum = (g) => qs.reduce((a, q, i) => (!!q.gid === g ? [a[0] + (picks[i] === q.answer ? 1 : 0), a[1] + 1] : a), [0, 0]);
  return { parts, wrong, wrongG, ok, n: qs.length, vocab: sum(false), grammar: sum(true) };
}

export const pctOf = (p) => (p && p[1] ? Math.round((p[0] / p[1]) * 100) : null);

// 최근 기록 (새것 먼저)
export const mockList = (map) => Object.values(map || {}).filter((r) => r && r.parts).sort((a, b) => b.at - a.at);

// 문제 종류마다 최근 n번 정답률 → 약한 것 먼저 [{ k, pct, n }]
export function sectionStats(list, recent = 5) {
  return SECTIONS.map((s) => {
    const rs = list.filter((r) => r.parts[s.k]).slice(0, recent);
    const ok = rs.reduce((a, r) => a + r.parts[s.k][0], 0);
    const n = rs.reduce((a, r) => a + r.parts[s.k][1], 0);
    return { k: s.k, pct: n ? Math.round((ok / n) * 100) : null, n };
  });
}
export const weakSection = (list) =>
  sectionStats(list)
    .filter((x) => x.pct !== null)
    .sort((a, b) => a.pct - b.pct)[0] || null;
