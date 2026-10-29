// 시험: 시험까지 날마다 할 일(plan.js, 다른 메뉴 기록으로 저절로 체크) · 문자·어휘 모의 25문제 / 미니 10문제(Mock.jsx) · 모의 기록
import { useMemo, useState } from 'react';
import { useData } from '../../lib/store';
import { EXAM_DATE } from '../../lib/srs';
import { todayStr } from '../../lib/dates';
import { studyDay, useStudyLog } from '../../lib/studylog';
import { LEVELS, allWords, newToday, unsorted } from '../words/words';
import { REV_CAP, reviewIds } from '../words/learn';
import { dueWrong, toList } from '../reading/drill';
import { Mock } from './Mock';
import { SECTIONS, mockList, sectionStats, weakSection } from './mock';
import { phaseDates, phaseOf, todayTasks } from './plan';
import './exam.css';

const md = (ds) => `${+ds.slice(5, 7)}/${+ds.slice(8)}`;
const mmss = (sec) => `${Math.floor(sec / 60)}:${String(Math.floor(sec % 60)).padStart(2, '0')}`;

// 다른 메뉴로 (단어는 그 안의 화면까지)
const goTo = (key, open) => {
  if (open) {
    try {
      sessionStorage.setItem('jlpt:open', open);
    } catch {
      /* 없어도 됨 */
    }
    window.dispatchEvent(new CustomEvent('jlpt-open', { detail: open }));
  }
  window.dispatchEvent(new CustomEvent('jlpt-go', { detail: key }));
};
// 약한 문제 종류 → 연습할 곳
const PRACTICE = { yomi: ['quiz', '한자 읽기 퀴즈'], ctx: ['n1', 'N1 모양 문제'], para: ['pairs', '비슷한 말 구별'], use: ['n1', 'N1 모양 문제'] };

export default function Exam() {
  const [mock, setMock] = useState(null); // null · 'full' · 'mini'
  const [round, setRound] = useState(0);
  const own = useData('own');
  const pool = useMemo(() => allWords(own, LEVELS), [own]);
  if (mock) return <Mock key={round} pool={pool} kind={mock} onDone={() => { setMock(null); setRound((r) => r + 1); }} />;
  return <Home pool={pool} start={setMock} />;
}

function Home({ pool, start }) {
  const cards = useData('words');
  const prefs = useData('prefs').main || {};
  const drill = useData('drill');
  const mocks = mockList(useData('mock'));
  const log = useStudyLog();
  const today = todayStr();
  const phase = phaseOf(today, EXAM_DATE);
  const st = useMemo(() => {
    const day = studyDay(log, today);
    const more = prefs.more?.d === today ? prefs.more.n || 0 : 0;
    const drills = toList(drill);
    return {
      due: reviewIds(Object.keys(cards), cards, today, Date.now(), prefs.revCap ?? REV_CAP).length,
      newDone: newToday(cards, today),
      newGoal: (prefs.newPerDay || 50) + more,
      fresh: unsorted(pool, cards).length,
      grammarN: day.sessions.filter((s) => s.part === 'grammar').reduce((a, s) => a + (s.n || 0), 0),
      drillToday: drills.filter((r) => r.date === today).length,
      wrongDue: dueWrong(drills, today).length,
      mockToday: { full: mocks.some((r) => r.day === today && r.kind === 'full'), mini: mocks.some((r) => r.day === today && r.kind === 'mini') },
    };
  }, [cards, prefs, drill, mocks.length, log, today, pool]); // eslint-disable-line react-hooks/exhaustive-deps
  const tasks = todayTasks(phase, st);
  const nDone = tasks.filter((t) => t.done).length;
  const stats = sectionStats(mocks);
  const weak = weakSection(mocks);
  const dates = phaseDates(EXAM_DATE);
  return (
    <div className="page ex">
      <header className="wd-top">
        <h1 className="h1">시험</h1>
        <span className="wd-dd num">{phase.dd > 0 ? `D-${phase.dd}` : phase.dd === 0 ? '오늘 시험!' : '시험 끝'}</span>
      </header>

      <section className="card">
        <div className="wd-hd"><b>오늘 할 일{phase.name ? ` · ${phase.name}` : ''}</b><small className="num">{nDone}/{tasks.length}</small></div>
        {phase.tip && <p className="sub">{phase.tip}</p>}
        <ul className="ex-tasks">
          {tasks.map((t) => (
            <li key={t.k} className={t.done ? 'is-done' : ''}>
              <span className="ex-chk" aria-hidden="true">{t.done ? '✓' : ''}</span>
              <span className="ex-task"><b>{t.t}</b><small className="sub">{t.sub}</small></span>
              {!t.done && (t.mock ? (
                <button type="button" className="btn btn--pri" onClick={() => start(t.mock)}>시작</button>
              ) : t.go && (
                <button type="button" className="btn" onClick={() => goTo(t.go, t.open)}>가기</button>
              ))}
            </li>
          ))}
        </ul>
        {phase.dd > 0 && (
          <ol className="ex-phases">
            {dates.map((p) => (
              <li key={p.k} className={p.k === phase.k ? 'is-on' : ''}>
                <b>{p.name}</b>
                <small className="num">{p.start ? md(p.start) : '지금'}~{md(p.end)}</small>
              </li>
            ))}
          </ol>
        )}
      </section>

      <section className="card">
        <div className="wd-hd"><b>문자·어휘 모의</b><small>실제 시험 問題1~4 순서</small></div>
        <p className="sub">漢字読み 6 · 文脈規定 7 · 言い換え類義 6 · 用法 6. 답은 끝나고 한꺼번에 맞춰 봐요. 한 문제 30초가 목표예요 (어휘를 빨리 끝내야 독해에 시간이 남아요).</p>
        <div className="row">
          <button type="button" className="btn btn--pri" onClick={() => start('full')}>모의 25문제</button>
          <button type="button" className="btn" onClick={() => start('mini')}>미니 10문제</button>
        </div>
        {mocks.length > 0 && (
          <>
            <div className="ex-parts">
              {SECTIONS.map((s) => {
                const x = stats.find((y) => y.k === s.k);
                return (
                  <div key={s.k} className="ex-part">
                    <span><b lang="ja">問題{s.no}</b> <span lang="ja">{s.name}</span></span>
                    <span className="bar"><i style={{ width: `${x.pct || 0}%`, background: (x.pct || 0) >= 70 ? 'var(--grn)' : 'var(--org)' }} /></span>
                    <b className="num">{x.pct === null ? '–' : `${x.pct}%`}</b>
                  </div>
                );
              })}
            </div>
            <p className="sub">최근 5번 정답률이에요.</p>
            {weak && weak.pct < 80 && PRACTICE[weak.k] && (
              <div className="row">
                <span className="sub">가장 약한 곳: <b lang="ja">{SECTIONS.find((s) => s.k === weak.k).name}</b> {weak.pct}%</span>
                <button type="button" className="btn" onClick={() => goTo('words', PRACTICE[weak.k][0])}>{PRACTICE[weak.k][1]}로 연습</button>
              </div>
            )}
            <ul className="ex-hist">
              {mocks.slice(0, 8).map((r) => {
                const ok = Object.values(r.parts).reduce((a, p) => a + p[0], 0);
                const n = Object.values(r.parts).reduce((a, p) => a + p[1], 0);
                return (
                  <li key={r.id}>
                    <span className="num">{md(r.day)}</span>
                    <span>{r.kind === 'full' ? '모의 25' : '미니 10'}</span>
                    <b className="num">{ok}/{n}</b>
                    <span className="num sub">{mmss(r.sec)}</span>
                  </li>
                );
              })}
            </ul>
          </>
        )}
      </section>
    </div>
  );
}
