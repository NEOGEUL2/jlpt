// '알아요'로 넘긴 단어 점검 (시험 전에 한 번)
//  거르기(Sort)에서 '알아요'를 누른 단어는 다시 안 나와서, 정말 아는지 한 번도 확인하지 않은 채 시험을 봄
//  → 뜻 4개 중 고르기로 한 번씩 확인. 맞히면 ck(점검한 날)만 붙이고 그대로, 틀리거나 '모르겠어요'면 새 단어 맨 앞(pri)
import { shuffle } from './words';

export const CHECK_N = 20;
// 시험에 나오는 급수부터 (N1 → N2 → 교재 → N3)
const RANK = { N1: 0, N2: 1, 교재: 2, N3: 3 };

// 아직 점검 안 한 '알아요' 단어
export const unchecked = (words, cards) => words.filter((w) => cards[w.id]?.skip && !cards[w.id].ck);

export function checkPick(words, cards, n = CHECK_N, rnd = Math.random) {
  return shuffle(unchecked(words, cards), rnd)
    .sort((a, b) => (RANK[a.lv] ?? 2) - (RANK[b.lv] ?? 2))
    .slice(0, n);
}

// 오늘 점검한 수 (맞힌 것 ck, 틀려서 새 단어로 돌린 것도 ck 를 남김)
export const checkedToday = (cards, today) => Object.values(cards || {}).filter((c) => c?.ck === today).length;

// 저장할 모양
export const checkOk = (c, today) => ({ ...c, ck: today });
export const checkNo = (today) => ({ pri: 1, ck: today });
