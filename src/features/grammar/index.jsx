// 문법 퀴즈 메뉴: 저장(store '문법' 묶음)·복습 주기(srs)·공부 시간(studylog)을 퀴즈 화면에 이어 줌
import { save, useData } from '../../lib/store';
import { EXAM_DATE, grade, queue } from '../../lib/srs';
import { todayStr } from '../../lib/dates';
import Quiz from './Quiz';
import './grammar.css';

// 공부 시간 기록은 studylog.js 가 생기면 씀 (없어도 화면은 그대로)
const studylog = Object.values(import.meta.glob('../../lib/studylog.js', { eager: true }))[0];

export default function Grammar() {
  const cards = useData('grammar');
  return (
    <Quiz
      cards={cards}
      setCard={(id, next) => save('grammar', id, next)}
      grade={grade}
      queue={queue}
      today={todayStr()}
      exam={EXAM_DATE}
      onLog={(x) => studylog?.logStudy?.(x)}
    />
  );
}
