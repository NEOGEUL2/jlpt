// 공부 기록 화면: 오늘(목표 고리) · 연속 · 익힌 단어 · 시험까지 / 2주 막대(영역별) / 12주 잔디 / 오늘 한 것 / 책으로 공부한 시간 적기
//  · 기록은 lib/studylog.js (서버 표 study_log → 기록(Girok) 앱에도 보임)
import { useMemo, useState } from 'react';
import { save, useData } from '../../lib/store';
import { diffDays, todayStr } from '../../lib/dates';
import { EXAM_DATE } from '../../lib/srs';
import { STUDY_PARTS, STUDY_SQL, fmtStudy, logStudy, partName, removeStudy, studyDay, studyDays, studyStreak, studyTotal, syncStudy, useStudyLog, useStudySync } from '../../lib/studylog';
import './stats.css';

export const PART_C = { vocab: 'var(--blu)', grammar: 'var(--org)', reading: 'var(--grn)', listening: 'var(--pur)', other: 'var(--sub)' };
const md = (ds) => `${+ds.slice(5, 7)}/${+ds.slice(8)}`;
const hm = (ms) => {
  const d = new Date(ms);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
};
// 익힌 단어: 복습 간격 7일 이상이거나 '이미 앎'으로 뺀 것
export const learnedOf = (words) => Object.values(words || {}).filter((c) => c && (c.skip || (c.i || 0) >= 7)).length;

function Ring({ value, goal }) {
  const r = 52;
  const len = 2 * Math.PI * r;
  const p = Math.min(1, value / Math.max(1, goal));
  return (
    <svg className="stx-ring" viewBox="0 0 128 128" role="img" aria-label={`오늘 ${value}분 / 목표 ${goal}분`}>
      <circle cx="64" cy="64" r={r} className="stx-ring__bg" />
      <circle cx="64" cy="64" r={r} className="stx-ring__fg" strokeDasharray={`${len * p} ${len}`} transform="rotate(-90 64 64)" />
      <text x="64" y="66" className="stx-ring__n">{value}</text>
      <text x="64" y="88" className="stx-ring__u">/ {goal}분</text>
    </svg>
  );
}

function Bars({ days, goalSec }) {
  const W = 340;
  const H = 120;
  const bw = W / days.length;
  const max = Math.max(goalSec * 1.3, ...days.map((d) => d.sec), 60);
  const y = (sec) => H - 18 - (sec / max) * (H - 26);
  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" className="stx-bars" role="img" aria-label="최근 2주 공부 시간">
      <line x1="0" x2={W} y1={y(goalSec)} y2={y(goalSec)} className="stx-goal" />
      {days.map((d, i) => {
        let top = H - 18;
        return (
          <g key={d.ds}>
            <title>{`${md(d.ds)} ${fmtStudy(d.sec)}`}</title>
            {!d.sec && <rect x={i * bw + 3} width={bw - 6} y={H - 20} height="2" rx="1" className="stx-none" />}
            {STUDY_PARTS.filter(([k]) => d.parts[k]).map(([k]) => {
              const h = Math.max(1.5, (d.parts[k] / max) * (H - 26));
              top -= h;
              return <rect key={k} x={i * bw + 3} width={bw - 6} y={top} height={h} style={{ fill: PART_C[k] }} />;
            })}
            {(i % 7 === 0 || i === days.length - 1) && <text x={i * bw + bw / 2} y={H - 4} textAnchor="middle">{i === days.length - 1 ? '오늘' : md(d.ds)}</text>}
          </g>
        );
      })}
    </svg>
  );
}

// 12주 잔디 (위→아래 월~일, 왼쪽→오른쪽 주, 진할수록 오래)
function Heat({ log, today, goalSec }) {
  const n = 7 * 11 + ((new Date().getDay() + 6) % 7) + 1;
  const days = studyDays(log, today, n);
  const lv = (sec) => (!sec ? 0 : sec < goalSec * 0.34 ? 1 : sec < goalSec * 0.67 ? 2 : sec < goalSec ? 3 : 4);
  return (
    <div className="stx-heat" role="img" aria-label="최근 12주 공부한 날">
      {days.map((d) => <i key={d.ds} className={`lv${lv(d.sec)}`} title={`${md(d.ds)} ${fmtStudy(d.sec)}`} />)}
    </div>
  );
}

export default function Screen() {
  const log = useStudyLog();
  const sync = useStudySync();
  const words = useData('words');
  const prefs = useData('prefs').main || {};
  const goal = prefs.goalMin || 60;
  const goalSec = goal * 60;
  const today = todayStr();
  const [part, setPart] = useState('reading');
  const [msg, setMsg] = useState('');
  const days = useMemo(() => studyDays(log, today, 14), [log, today]);
  const day = studyDay(log, today);
  const week = studyTotal(log, days[7].ds, today);
  const all = studyTotal(log);
  const streak = studyStreak(log, today);
  const learned = learnedOf(words);
  const dd = diffDays(today, EXAM_DATE);
  const flash = (t) => {
    setMsg(t);
    setTimeout(() => setMsg(''), 2500);
  };
  const addBook = (min) => {
    logStudy({ part, sec: min * 60, what: `책으로 ${partName(part)}` });
    flash(`${partName(part)} ${min}분 적었어요`);
  };

  return (
    <div className="page stx">
      <h1 className="h1">공부 기록</h1>
      <div className="stx-top">
        <div className="card stx-today">
          <Ring value={Math.round(day.sec / 60)} goal={goal} />
          <div className="stx-today__r">
            <b>오늘</b>
            {STUDY_PARTS.slice(0, 4).map(([k, n]) => (
              <span key={k} className="stx-kv"><i style={{ background: PART_C[k] }} />{n}<em className="num">{day.parts[k] ? fmtStudy(day.parts[k]) : '–'}</em></span>
            ))}
            {day.n > 0 && <p className="sub">{day.n}개 풀고 {day.ok}개 맞힘 ({Math.round((day.ok / day.n) * 100)}%)</p>}
          </div>
        </div>
        <div className="card stx-stat"><small>연속</small><b className="num">{streak}<em>일</em></b><p className="sub">하루 5분 넘게 공부한 날</p></div>
        <div className="card stx-stat"><small>익힌 단어</small><b className="num">{learned}<em>개</em></b><p className="sub">{day.learned ? `오늘 +${day.learned}` : '복습 간격 7일 넘은 단어'}</p></div>
        <div className="card stx-stat"><small>시험까지</small><b className="num">{dd > 0 ? `D-${dd}` : dd === 0 ? 'D-DAY' : '끝'}</b><p className="sub">이번 주 {fmtStudy(week.sec)}</p></div>
      </div>

      <div className="stx-mid">
        <div className="card">
          <div className="stx-hd"><b>최근 2주</b><small>점선 = 하루 목표 {goal}분</small></div>
          <Bars days={days} goalSec={goalSec} />
          <div className="stx-leg">{STUDY_PARTS.slice(0, 4).map(([k, n]) => <span key={k}><i style={{ background: PART_C[k] }} />{n}</span>)}</div>
        </div>
        <div className="card">
          <div className="stx-hd"><b>12주</b><small>모두 {fmtStudy(all.sec)}</small></div>
          <Heat log={log} today={today} goalSec={goalSec} />
          <div className="stx-heatleg"><small>적게</small>{[0, 1, 2, 3, 4].map((l) => <i key={l} className={`lv${l}`} />)}<small>목표 넘게</small></div>
        </div>
      </div>

      <div className="stx-mid">
        <div className="card">
          <div className="stx-hd"><b>책으로 공부한 시간</b><small>교재로 푼 건 여기서 적어요</small></div>
          <div className="seg">{STUDY_PARTS.slice(0, 4).map(([k, n]) => <button key={k} type="button" aria-pressed={part === k} onClick={() => setPart(k)}>{n}</button>)}</div>
          <div className="row">{[10, 20, 30, 60].map((m) => <button key={m} type="button" className="btn" onClick={() => addBook(m)}>+{m}분</button>)}</div>
          {msg && <p className="sub stx-msg" role="status">{msg}</p>}
          <label className="field stx-goalin">하루 목표 (분)
            <input type="number" min="10" max="600" step="10" defaultValue={goal} onBlur={(e) => save('prefs', 'main', { goalMin: Math.max(10, +e.target.value || 60) })} />
          </label>
        </div>
        <div className="card">
          <div className="stx-hd"><b>오늘 한 것</b><small>{day.sessions.length ? `${day.sessions.length}번` : ''}</small></div>
          {day.sessions.length ? (
            <ul className="stx-list">
              {day.sessions.slice().reverse().map((s) => (
                <li key={s.id}>
                  <i style={{ background: PART_C[s.part] }} />
                  <span className="num">{hm(s.at)}</span>
                  <span className="stx-list__t">{s.what || partName(s.part)}{s.n ? ` · ${s.ok || 0}/${s.n}` : ''}{s.learned ? ` · 익힘 ${s.learned}` : ''}</span>
                  <b className="num">{fmtStudy(s.sec)}</b>
                  <button type="button" aria-label="이 기록 지우기" onClick={() => { if (confirm('이 기록을 지울까요?')) removeStudy(s.id); }}>×</button>
                </li>
              ))}
            </ul>
          ) : <p className="sub">아직 없어요. 단어·문법 화면을 열어 두면 공부한 시간이 저절로 적혀요.</p>}
        </div>
      </div>

      <div className="card stx-sync">
        <div className="stx-hd">
          <b>기록 앱으로 보내기</b>
          <small>{sync.state === 'ok' ? '보냈어요' : sync.state === 'local' ? '이 기기에만 저장 중 · 설정에서 서버 연결·로그인' : '못 보냈어요 · 잠시 뒤 다시 해요'}</small>
        </div>
        <p className="sub">공부한 시간·푼 문제·익힌 단어가 기록(Girok) 앱의 공부 화면과 일지에도 나와요.</p>
        {sync.noTable && (
          <>
            <p className="sub stx-warn">서버에 공부 기록 표가 아직 없어요. SQL을 복사해서 Supabase → SQL Editor 에 붙여 넣고 Run 을 한 번 눌러 주세요.</p>
            <button type="button" className="btn" onClick={() => navigator.clipboard?.writeText(STUDY_SQL).then(() => flash('SQL을 복사했어요'))}>SQL 복사</button>
          </>
        )}
        {sync.state !== 'local' && <button type="button" className="btn" onClick={() => syncStudy()}>지금 보내기</button>}
      </div>
    </div>
  );
}
