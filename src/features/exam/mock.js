// 문자·어휘 모의 시험 (실제 N1 언어지식 앞부분과 같은 순서·모양)
//  問題1 漢字読み 6 · 問題2 文脈規定 7 · 問題3 言い換え類義 6 · 問題4 用法 6 = 25문제 (mini 는 3·3·2·2 = 10문제)
//  · 漢字読み 는 words/yomi.js (장음·촉음·탁음 함정 2×2), 나머지는 words/n1quiz.js
//  · 기록: 묶음 'mock' { id, day, at, kind 'full'|'mini', sec, parts: { yomi: [맞힘, 문제 수], … }, wrong: [단어 id] }
import { makeQuiz } from '../words/n1quiz';
import { quizPick } from '../words/words';
import { yomiChoices, yomiOk } from '../words/yomi';
import { wordKinds } from '../words/kanji';

export const SECTIONS = [
  { k: 'yomi', no: 1, full: 6, mini: 3, name: '漢字読み', ko: '한자 읽기', ja: '＿＿＿の言葉の読み方として最もよいものを、１・２・３・４から一つ選びなさい。' },
  { k: 'ctx', no: 2, full: 7, mini: 3, name: '文脈規定', ko: '문맥 (빈칸)', ja: '（　　）に入れるのに最もよいものを、１・２・３・４から一つ選びなさい。' },
  { k: 'para', no: 3, full: 6, mini: 2, name: '言い換え類義', ko: '비슷한 말', ja: '＿＿＿の言葉に意味が最も近いものを、１・２・３・４から一つ選びなさい。' },
  { k: 'use', no: 4, full: 6, mini: 2, name: '用法', ko: '쓰임', ja: '次の言葉の使い方として最もよいものを、１・２・３・４から一つ選びなさい。' },
];
export const secOf = (k) => SECTIONS.find((s) => s.k === k);
// 목표 시간: 한 문제 30초 (실제 시험은 언어지식·독해 110분이라 어휘는 빨리 끝내고 독해에 시간을 남겨야 함)
export const SEC_PER_Q = 30;

// 시험 급수(N2·N1)와 교재 단어에서 냄. 본 적 있는 약한 단어가 먼저, 모자라면 안 본 단어 (실제 시험처럼 처음 보는 말도 나옴)
export function makeMock(pool, cards, kind = 'full', rnd = Math.random) {
  const exam = pool.filter((w) => w.lv !== 'N3');
  const used = new Set();
  const out = [];
  for (const s of SECTIONS) {
    const n = s[kind];
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
  qs.forEach((q, i) => {
    const p = (parts[q.sec] ||= [0, 0]);
    p[1] += 1;
    if (picks[i] === q.answer) p[0] += 1;
    else wrong.push(q.word.id);
  });
  const ok = Object.values(parts).reduce((a, p) => a + p[0], 0);
  return { parts, wrong, ok, n: qs.length };
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
