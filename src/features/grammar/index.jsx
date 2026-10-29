// 문법 퀴즈 메뉴: 저장(store '문법' 묶음)·복습 주기(srs)·공부 시간(studylog)을 퀴즈 화면에 이어 줌
import { save, useData } from '../../lib/store';
import { EXAM_DATE, grade, queue } from '../../lib/srs';
import { todayStr } from '../../lib/dates';
import { useStudyTimer } from '../../lib/studylog';
import Quiz from './Quiz';
import './grammar.css';

const KNOWN = 7; // 간격 7일 이상 = 익힘 (srs maturity 와 같은 기준)

export default function Grammar() {
  const cards = useData('grammar');
  const timer = useStudyTimer('grammar', '문법 퀴즈');
  return (
    <Quiz
      cards={cards}
      setCard={(id, next) => {
        // 익힘으로 막 넘어간 문법 → 기록 앱 일지에 '새로 익힘'
        if (next.i >= KNOWN && !((cards[id]?.i || 0) >= KNOWN)) timer.add({ learned: 1 });
        save('grammar', id, next);
      }}
      grade={grade}
      queue={queue}
      today={todayStr()}
      exam={EXAM_DATE}
      onStep={(id, ok) => timer.add({ n: 1, ok: ok ? 1 : 0 })}
      onLog={() => timer.finish()}
    />
  );
}
