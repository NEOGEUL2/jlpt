// 시험까지 날마다 할 일 (화면 없이 테스트할 수 있게)
//  · 1단계 ~D-15 익히기: 새 단어 많이 + 복습 + 문법 + 교재 문제 + 미니 모의(10문제)
//  · 2단계 D-14~D-8 시험 모양: 새 단어 마무리 + 언어지식 모의 40문제 매일 + 오답 다시 풀기
//  · 3단계 D-7~D-1 마무리: 새 단어 없이 복습만 + 언어지식 모의 40문제 + 오답 노트 + 독해 시간 재고 풀기
//  (새 단어는 D-7 까지 다 한 번씩 보도록 words/learn.js paceNeed 와 같은 기준)
import { addDays, diffDays, parse, ymd } from '../../lib/dates';

export const PHASES = [
  { k: 'learn', from: 15, name: '익히기', tip: '새 단어를 많이 보고, 시험 모양 문제는 10문제씩 가볍게' },
  { k: 'shape', from: 8, name: '시험 모양', tip: '매일 언어지식 40문제 모의로 시험 순서·시간에 익숙해지기. 새 단어는 마무리' },
  { k: 'final', from: 1, name: '마무리', tip: '새 단어 없이 복습과 틀린 것만. 모의는 시간 재고' },
];
export function phaseOf(today, exam) {
  const dd = diffDays(today, exam);
  if (dd <= 0) return { k: dd === 0 ? 'day' : 'after', dd };
  const p = dd >= 15 ? PHASES[0] : dd >= 8 ? PHASES[1] : PHASES[2];
  return { ...p, dd };
}
// 단계마다 날짜 [{ k, name, start, end }]
export function phaseDates(exam) {
  const e = parse(exam);
  const at = (n) => ymd(addDays(e, -n));
  return [
    { ...PHASES[0], end: at(15) },
    { ...PHASES[1], start: at(14), end: at(8) },
    { ...PHASES[2], start: at(7), end: at(1) },
  ];
}

/* 오늘 할 일: s = 오늘 상태
   { due 남은 복습, newDone 오늘 새로 본 단어, newGoal 하루 새 단어, fresh 아직 안 본 단어,
     grammarN 오늘 문법 문제 수, drillToday 오늘 적은 교재 문제 수, wrongDue 다시 풀 오답, mockToday { lang, full, gram, mini },
     skipLeft 점검 안 한 '알아요' 단어, checkedToday 오늘 점검한 수 }
   → [{ k, t 할 일, sub 설명, done, go 메뉴, open 단어 화면 }] */
export function todayTasks(phase, s) {
  if (!phase || phase.k === 'after') return [];
  if (phase.k === 'day') return [{ k: 'rest', t: '오늘 시험! 어제까지 한 걸로 충분해요', sub: '아침에 틀린 단어만 가볍게 훑어보기', done: false, go: 'words' }];
  const final = phase.k === 'final';
  const out = [];
  out.push({ k: 'rev', t: s.due ? `단어 복습 ${s.due}장` : '단어 복습', sub: '오늘 날짜가 된 복습 다 하기', done: s.due === 0, go: 'words', open: 'cards' });
  if (!final && s.fresh > 0) out.push({ k: 'new', t: `새 단어 ${s.newGoal}개`, sub: `오늘 ${s.newDone}개 봄`, done: s.newDone >= s.newGoal, go: 'words', open: 'cards' });
  out.push({ k: 'grammar', t: final ? '문법 복습 한 판' : '문법 퀴즈 20문제', sub: `오늘 ${s.grammarN}문제`, done: s.grammarN >= (final ? 10 : 20), go: 'grammar' });
  // '알아요'로 넘긴 단어 점검 (마무리 전까지, 남은 게 있을 때만)
  if (!final && s.skipLeft > 0) out.push({ k: 'check', t: `넘긴 단어 점검 20개`, sub: `'알아요'로 넘긴 단어 ${s.skipLeft}개 남음 · 틀리면 새 단어로`, done: (s.checkedToday || 0) >= 20, go: 'words', open: 'check' });
  if (phase.k === 'learn') out.push({ k: 'mock', t: '문자·어휘 미니 모의 10문제', sub: '시험 순서 그대로 · 問題1~4', done: s.mockToday.mini || s.mockToday.full, mock: 'mini' });
  else {
    const m = s.mockToday;
    out.push({ k: 'mock', t: '언어지식 모의 40문제 (시간 재기)', sub: '목표 25분 · 問題1~6 실제 시험 순서', done: !!(m.lang || (m.full && m.gram)), mock: 'lang' });
  }
  out.push({ k: 'drill', t: final ? '독해 한 회 시간 재고 풀기' : '교재 독해·청해 한 묶음', sub: '푼 뒤 독해·청해에 점수 적기', done: s.drillToday > 0, go: 'reading' });
  if (phase.k !== 'learn' || s.wrongDue > 0) out.push({ k: 'wrong', t: s.wrongDue ? `오답 다시 풀기 ${s.wrongDue}개` : '오답 다시 풀기', sub: '독해·청해 틀린 문제', done: s.wrongDue === 0, go: 'reading' });
  return out;
}
