// 독해·청해: 교재에서 푼 문제 점수·틀린 문제 적기 → 유형별 정답률 · 틀린 문제 날짜 맞춰 다시 풀기 · 오답 노트
// 화면 넷: 홈(요약) · 적기(답안지처럼 번호를 눌러 틀린 것 표시) · 다시 풀기(한 장씩) · 오답 노트
import { useEffect, useMemo, useState } from 'react';
import { useData, save, remove } from '../../lib/store';
import { todayStr } from '../../lib/dates';
import { logStudy, useStudyTimer } from '../../lib/studylog';
import {
  MONDAI, REASONS, SECTIONS, chapterAt, dueWrong, allWrong, makeRecord, markWrong, minutesOn, mondaiOf,
  pct, reasonCounts, reasonLabel, secLabel, setWrongDone, statsByMondai, statsBySection, streak, toList, weakest,
} from './drill';
import './reading.css';

const MARK = ['①', '②', '③', '④'];
const mark = (n) => (n ? MARK[n - 1] : '–');
const tone = (p) => (p == null ? '' : p < 60 ? 'is-bad' : p < 80 ? 'is-mid' : 'is-good');
const fmtDay = (ds) => {
  const [, m, d] = ds.split('-').map(Number);
  return `${m}월 ${d}일`;
};
const where = (w) => [w.page ? `p.${w.page}` : '', w.label, `${w.q}번`].filter(Boolean).join(' · ');

export default function Reading() {
  const map = useData('drill');
  const list = useMemo(() => toList(map), [map]);
  const [view, setView] = useState({ v: 'home' });
  const today = todayStr();
  const go = (v) => {
    setView(v);
    document.querySelector('.main')?.scrollTo?.(0, 0);
  };
  const top = () => go({ v: 'home' });
  if (view.v === 'add') return <Entry key={view.id || 'new'} rec={view.id ? map[view.id] : null} list={list} onDone={top} />;
  if (view.v === 'review') return <Review list={list} map={map} today={today} onDone={top} />;
  if (view.v === 'notes') return <Notes list={list} map={map} today={today} onBack={top} />;
  return <Home list={list} today={today} go={go} />;
}

/* ───────── 홈 ───────── */
function Home({ list, today, go }) {
  const due = dueWrong(list, today);
  const sec = statsBySection(list);
  const by = statsByMondai(list);
  const weak = weakest(list);
  const st = streak(list, today);
  const mins = minutesOn(list, today);
  const wrongLeft = allWrong(list).filter((w) => !w.rv.done).length;
  const [secPick, setSecPick] = useState('reading');
  const reasons = reasonCounts(list, secPick).slice(0, 4);

  return (
    <div className="page rd">
      <header className="rd-top">
        <div>
          <h1 className="h1">독해·청해</h1>
          <p className="sub">교재에서 푼 문제의 점수와 틀린 문제를 적어 두면, 틀린 문제를 날짜 맞춰 다시 풀게 해 줘요.</p>
        </div>
        <button type="button" className="btn btn--pri btn--big" onClick={() => go({ v: 'add' })}>+ 푼 문제 적기</button>
      </header>

      <section className={`card rd-hero ${due.length ? '' : 'is-clear'}`}>
        <div className="rd-hero__txt">
          <small>오늘 다시 풀 문제</small>
          <b className="num">{due.length}<span>문제</span></b>
          <p className="sub">
            {due.length ? '교재를 펴고 한 문제씩 다시 풀어 봐요. 세 번 맞히면 다 안 걸로 넘어가요.' : list.length ? '오늘 다시 풀 문제는 다 끝냈어요.' : '아직 기록이 없어요. 문제를 풀고 점수를 적어 보세요.'}
          </p>
        </div>
        <div className="rd-hero__side">
          <div className="rd-chip num"><b>{st}</b>일 이어서</div>
          <div className="rd-chip num"><b>{mins.reading + mins.listening}</b>분 오늘</div>
          {due.length > 0 && <button type="button" className="btn btn--pri btn--big" onClick={() => go({ v: 'review' })}>다시 풀기 시작</button>}
        </div>
      </section>

      <div className="rd-two">
        {SECTIONS.map((s) => (
          <section key={s.key} className="card rd-sec">
            <Ring p={sec[s.key].count ? sec[s.key].pct : null} />
            <div>
              <b>{s.label} <span lang="ja" className="rd-ja">{s.ja}</span></b>
              <p className="sub num">{sec[s.key].count ? `${sec[s.key].count}번 · ${sec[s.key].correct}/${sec[s.key].total}문제 · ${sec[s.key].min}분` : '아직 기록 없음'}</p>
            </div>
          </section>
        ))}
      </div>

      {weak.length > 0 && (
        <section className="card rd-weak">
          <b>요즘 약한 유형</b>
          <div className="row">
            {weak.map((o) => (
              <span key={o.key} className="rd-pill is-bad">{secLabel(mondaiOf(o.key).section)} · {mondaiOf(o.key).label} <b className="num">{o.recent}%</b></span>
            ))}
          </div>
          <p className="sub">최근 다섯 번 평균이에요. 이 유형 문제를 조금 더 풀어 보세요.</p>
        </section>
      )}

      <section className="card">
        <div className="rd-hd">
          <b>유형별 정답률</b>
          <small>최근 다섯 번 평균</small>
        </div>
        {SECTIONS.map((s) => (
          <div key={s.key} className="rd-types">
            <h3>{s.label}</h3>
            {MONDAI.filter((m) => m.section === s.key).map((m) => {
              const o = by[m.key];
              return (
                <div key={m.key} className={`rd-type ${o.count ? '' : 'is-none'}`}>
                  <span className="rd-type__n"><span lang="ja">問題{m.no}</span> {m.label}</span>
                  <span className="bar"><i className={tone(o.recent)} style={{ width: `${o.recent ?? 0}%` }} /></span>
                  <span className="rd-type__p num">{o.count ? `${o.recent}%` : '–'}</span>
                  <Spark t={o.trend} />
                </div>
              );
            })}
          </div>
        ))}
      </section>

      <div className="rd-two">
        <section className="card">
          <div className="rd-hd">
            <b>자주 틀리는 이유</b>
            <span className="seg">
              {SECTIONS.map((s) => <button key={s.key} type="button" aria-pressed={secPick === s.key} onClick={() => setSecPick(s.key)}>{s.label}</button>)}
            </span>
          </div>
          {reasons.length ? (
            <ol className="rd-why">
              {reasons.map(([k, n]) => (
                <li key={k}><span>{reasonLabel(secPick, k)}</span><b className="num">{n}</b></li>
              ))}
            </ol>
          ) : <p className="sub">틀린 문제에 이유를 골라 두면 여기 모여요.</p>}
        </section>
        <section className="card">
          <div className="rd-hd">
            <b>오답 노트</b>
            <small className="num">남은 {wrongLeft}문제</small>
          </div>
          <p className="sub">틀린 문제를 모두 모아 봐요. 다 안 문제는 바로 넘기거나 다시 볼 수 있어요.</p>
          <button type="button" className="btn" onClick={() => go({ v: 'notes' })}>오답 노트 열기</button>
        </section>
      </div>

      <section className="card">
        <div className="rd-hd"><b>지난 기록</b><small>눌러서 고치기</small></div>
        {list.length ? (
          <ul className="rd-hist">
            {list.slice(0, 30).map((r) => {
              const m = mondaiOf(r.mondai);
              const p = pct(r.correct, r.total);
              return (
                <li key={r.id}>
                  <button type="button" onClick={() => go({ v: 'add', id: r.id })}>
                    <span className={`rd-score num ${tone(p)}`}>{r.correct}/{r.total}</span>
                    <span className="rd-hist__t">
                      <b>{secLabel(r.section)} · {m?.label}</b>
                      <small className="num">{fmtDay(r.date)}{r.page ? ` · p.${r.page}` : ''}{r.label ? ` · ${r.label}` : ''}{r.min ? ` · ${r.min}분` : ''}</small>
                    </span>
                    <span className="rd-hist__p num">{p}%</span>
                  </button>
                </li>
              );
            })}
          </ul>
        ) : <p className="sub">아직 없어요.</p>}
      </section>
    </div>
  );
}

function Ring({ p }) {
  const r = 26;
  const c = 2 * Math.PI * r;
  return (
    <svg className={`rd-ring ${tone(p)}`} viewBox="0 0 64 64" width="64" height="64" role="img" aria-label={p == null ? '기록 없음' : `정답률 ${p}%`}>
      <circle cx="32" cy="32" r={r} className="rd-ring__bg" />
      <circle cx="32" cy="32" r={r} className="rd-ring__fg" strokeDasharray={`${((p || 0) / 100) * c} ${c}`} transform="rotate(-90 32 32)" />
      <text x="32" y="37" textAnchor="middle" className="num">{p == null ? '–' : p}</text>
    </svg>
  );
}

// 최근 8번 정답률 흐름
function Spark({ t }) {
  const s = t.slice(-8);
  if (s.length < 2) return <span className="rd-spark" />;
  const pts = s.map((v, i) => `${(i / (s.length - 1)) * 56 + 2},${22 - (v / 100) * 20}`).join(' ');
  return (
    <svg className="rd-spark" viewBox="0 0 60 24" width="60" height="24" aria-hidden="true">
      <polyline points={pts} fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}

/* ───────── 적기 (답안지) ───────── */
function Entry({ rec, list, onDone }) {
  const last = list[0];
  const [date, setDate] = useState(rec?.date || todayStr());
  const [section, setSection] = useState(rec?.section || last?.section || 'reading');
  const [mondai, setMondai] = useState(rec?.mondai || last?.mondai || '');
  const [page, setPage] = useState(rec?.page ? String(rec.page) : '');
  const [label, setLabel] = useState(rec?.label || '');
  const [total, setTotal] = useState(rec?.total || 4);
  const [first, setFirst] = useState(() => {
    const n = (rec?.wrong || []).map((w) => +w.q).filter(Boolean);
    return n.length ? Math.min(...n) : 1;
  });
  const [wrong, setWrong] = useState(() => Object.fromEntries((rec?.wrong || []).map((w) => [w.q, w])));
  const [min, setMin] = useState(rec?.min ? String(rec.min) : '');
  const [run, setRun] = useState(null); // 시간 재기 시작한 때
  const [, tick] = useState(0);
  const [err, setErr] = useState('');
  const [ask, setAsk] = useState(false);

  useEffect(() => {
    if (!run) return undefined;
    const t = setInterval(() => tick((x) => x + 1), 1000);
    return () => clearInterval(t);
  }, [run]);

  const m = mondaiOf(mondai);
  const choices = m?.choices || 4;
  const nums = Array.from({ length: total }, (_, i) => String(first + i));
  const wrongList = nums.filter((q) => wrong[q]).map((q) => wrong[q]);
  const correct = total - wrongList.length;
  const runSec = run ? Math.floor((Date.now() - run) / 1000) : 0;
  const ch = chapterAt(+page);

  const pickSection = (s) => {
    setSection(s);
    if (mondaiOf(mondai)?.section !== s) setMondai('');
  };
  const onPage = (v) => {
    setPage(v);
    const c = chapterAt(+v);
    if (c?.mondai && !rec) {
      setMondai(c.mondai);
      setSection(mondaiOf(c.mondai).section);
    }
  };
  const toggle = (q) => setWrong((w) => {
    const n = { ...w };
    if (n[q]) delete n[q];
    else n[q] = { q, mine: null, answer: null, reason: '', note: '' };
    return n;
  });
  const edit = (q, patch) => setWrong((w) => ({ ...w, [q]: { ...w[q], ...patch } }));
  const runMin = () => (run ? Math.max(1, Math.round((Date.now() - run) / 60000)) : 0);
  const stopRun = () => {
    setMin(String((+min || 0) + runMin()));
    setRun(null);
  };

  const submit = () => {
    if (!m || m.section !== section) return setErr('문제 유형을 골라 주세요.');
    const mins = (+min || 0) + runMin();
    const r = makeRecord({ id: rec?.id, date, mondai, page, label, total, min: mins, chapter: ch?.key || '', wrong: wrongList });
    save('drill', r.id, { ...r, at: rec?.at || Date.now() });
    // 공부 시간: 기록 하나 = 공부 기록 한 줄 (고치면 같은 줄을 고침)
    logStudy({ id: `drill-${r.id}`, day: r.date, at: rec?.at || Date.now(), sec: mins * 60, part: r.section, n: r.total, ok: r.correct, what: `${secLabel(r.section)} ${m.label}` });
    onDone();
  };

  return (
    <div className="page rd">
      <header className="rd-top">
        <div>
          <button type="button" className="rd-back" onClick={onDone}>‹ 독해·청해</button>
          <h1 className="h1">{rec ? '기록 고치기' : '푼 문제 적기'}</h1>
        </div>
        <div className={`rd-live num ${tone(pct(correct, total))}`}><b>{correct}</b>/{total}<small>{pct(correct, total)}%</small></div>
      </header>

      <section className="card rd-form">
        <div className="rd-grid2">
          <label className="field">날짜<input type="date" value={date} max={todayStr()} onChange={(e) => e.target.value && setDate(e.target.value)} /></label>
          <label className="field">교재 쪽 (몰라도 돼요)<input inputMode="numeric" placeholder="예: 380" value={page} onChange={(e) => onPage(e.target.value.replace(/\D/g, '').slice(0, 4))} /></label>
        </div>
        {ch && <p className="sub">교재 '{ch.t}' 쯤이에요.</p>}
        <span className="seg">
          {SECTIONS.map((s) => <button key={s.key} type="button" aria-pressed={section === s.key} onClick={() => pickSection(s.key)}>{s.label}</button>)}
        </span>
        <div className="rd-types-pick" role="group" aria-label="문제 유형">
          {MONDAI.filter((x) => x.section === section).map((x) => (
            <button key={x.key} type="button" aria-pressed={mondai === x.key} onClick={() => { setMondai(x.key); setErr(''); }}>
              <small lang="ja">問題{x.no}</small>{x.label}
            </button>
          ))}
        </div>
        <label className="field">메모 (예: 모의고사 1회, 두 번째 풀이)<input value={label} maxLength={40} onChange={(e) => setLabel(e.target.value)} /></label>
      </section>

      <section className="card">
        <div className="rd-hd">
          <b>틀린 문제 번호를 눌러요</b>
          <small>✕ = 틀림</small>
        </div>
        <div className="row rd-count">
          <span className="sub">문제 수</span>
          <Stepper v={total} set={setTotal} lo={1} hi={60} name="문제 수" />
          <span className="sub">첫 번호</span>
          <Stepper v={first} set={setFirst} lo={1} hi={200} name="첫 번호" />
        </div>
        <div className="rd-sheet">
          {nums.map((q) => (
            <button key={q} type="button" className={`num ${wrong[q] ? 'is-wrong' : ''}`} aria-pressed={!!wrong[q]} aria-label={`${q}번 ${wrong[q] ? '틀림' : '맞음'}`} onClick={() => toggle(q)}>
              {wrong[q] ? <><span aria-hidden="true">✕</span><small>{q}</small></> : q}
            </button>
          ))}
        </div>
        {!wrongList.length && <p className="sub">다 맞혔으면 그대로 저장하면 돼요.</p>}
      </section>

      {wrongList.map((w) => (
        <section key={w.q} className="card rd-wcard">
          <div className="rd-hd">
            <b className="num">{w.q}번</b>
            <button type="button" className="rd-x" onClick={() => toggle(w.q)}>맞은 걸로</button>
          </div>
          <div className="rd-ans">
            <span className="sub">내 답</span>
            <Choices n={choices} v={w.mine} onPick={(v) => edit(w.q, { mine: v })} kind="mine" />
            <span className="sub">정답</span>
            <Choices n={choices} v={w.answer} onPick={(v) => edit(w.q, { answer: v })} kind="ans" />
          </div>
          <div className="rd-reasons" role="group" aria-label="틀린 이유">
            {REASONS[section].map(([k, t]) => (
              <button key={k} type="button" aria-pressed={w.reason === k} onClick={() => edit(w.q, { reason: w.reason === k ? '' : k })}>{t}</button>
            ))}
          </div>
          <label className="field">메모 (몰랐던 단어, 헷갈린 점)<input value={w.note} maxLength={200} onChange={(e) => edit(w.q, { note: e.target.value })} /></label>
        </section>
      ))}

      <section className="card">
        <div className="rd-grid2">
          <label className="field">걸린 시간 (분)<input inputMode="numeric" placeholder="예: 25" value={min} onChange={(e) => setMin(e.target.value.replace(/\D/g, '').slice(0, 3))} /></label>
          <div className="rd-timer">
            {run ? (
              <button type="button" className="btn" onClick={stopRun}>멈추기 <span className="num">{Math.floor(runSec / 60)}:{String(runSec % 60).padStart(2, '0')}</span></button>
            ) : (
              <button type="button" className="btn" onClick={() => setRun(Date.now())}>시간 재기</button>
            )}
          </div>
        </div>
        <div className="row">
          {[10, 20, 30, 40].map((n) => <button key={n} type="button" className="btn" onClick={() => setMin(String(n))}>{n}분</button>)}
        </div>
      </section>

      {err && <p className="rd-err" role="alert">{err}</p>}
      <div className="row rd-foot">
        <button type="button" className="btn btn--pri btn--big" onClick={submit}>저장</button>
        <button type="button" className="btn btn--big" onClick={onDone}>취소</button>
        {rec && (ask ? (
          <span className="row">
            <span className="sub">정말 지울까요?</span>
            <button type="button" className="btn rd-del" onClick={() => { remove('drill', rec.id); onDone(); }}>지우기</button>
            <button type="button" className="btn" onClick={() => setAsk(false)}>아니요</button>
          </span>
        ) : <button type="button" className="btn rd-del" onClick={() => setAsk(true)}>이 기록 지우기</button>)}
      </div>
    </div>
  );
}

function Stepper({ v, set, lo, hi, name }) {
  return (
    <span className="rd-step">
      <button type="button" aria-label={`${name} 줄이기`} onClick={() => set(Math.max(lo, v - 1))}>−</button>
      <b className="num">{v}</b>
      <button type="button" aria-label={`${name} 늘리기`} onClick={() => set(Math.min(hi, v + 1))}>+</button>
    </span>
  );
}

function Choices({ n, v, onPick, kind }) {
  return (
    <span className={`rd-choices rd-choices--${kind}`}>
      {Array.from({ length: n }, (_, i) => i + 1).map((c) => (
        <button key={c} type="button" aria-pressed={v === c} aria-label={`${c}번`} onClick={() => onPick(v === c ? null : c)}>{c}</button>
      ))}
    </span>
  );
}

/* ───────── 다시 풀기 (한 장씩) ───────── */
function Review({ list, map, today, onDone }) {
  // 시작할 때 고른 문제로 고정 (풀면서 목록이 바뀌어도 순서 그대로)
  const [queue] = useState(() => dueWrong(list, today).map((w) => [w.rec, w.id]));
  const [i, setI] = useState(0);
  const [pick, setPick] = useState(null); // 고른 답 번호 · 'ok' · 'no'
  const [tally, setTally] = useState({ ok: 0, no: 0 });
  const timer = useStudyTimer(map[queue[0]?.[0]]?.section || 'reading', '틀린 문제 다시 풀기');
  const done = i >= queue.length;
  const rec = done ? null : map[queue[i][0]];
  const w = rec?.wrong.find((x) => x.id === queue[i][1]);
  const gone = !done && !w; // 다른 기기에서 지운 문제

  useEffect(() => {
    if (gone) setI((x) => x + 1);
  }, [gone]);

  if (done) {
    return (
      <div className="page rd">
        <section className="card rd-end">
          <b className="rd-end__big">{queue.length ? '다 풀었어요' : '오늘 다시 풀 문제가 없어요'}</b>
          {tally.ok + tally.no > 0 && <p className="num rd-end__n"><span className="is-ok">맞힘 {tally.ok}</span> · <span className="is-no">다시 {tally.no}</span></p>}
          <p className="sub">맞힌 문제는 며칠 뒤에 한 번 더, 틀린 문제는 내일 다시 나와요.</p>
          <button type="button" className="btn btn--pri btn--big" onClick={onDone}>돌아가기</button>
        </section>
      </div>
    );
  }
  if (gone) return null;

  const m = mondaiOf(rec.mondai);
  const answered = pick != null;
  const ok = pick === 'ok' || (typeof pick === 'number' && pick === w.answer);
  const choose = (v) => {
    if (answered) return;
    const res = typeof v === 'number' ? v === w.answer : v === 'ok';
    setPick(v);
    save('drill', rec.id, markWrong(rec, w.id, res, today));
    setTally((t) => ({ ...t, [res ? 'ok' : 'no']: t[res ? 'ok' : 'no'] + 1 }));
    timer.add({ n: 1, ok: res ? 1 : 0 });
  };
  const next = () => {
    setPick(null);
    setI((x) => x + 1);
  };

  return (
    <div className="page rd rd-rv">
      <div className="rd-rv__top">
        <button type="button" className="rd-close" aria-label="그만하기" onClick={onDone}>✕</button>
        <span className="bar rd-rv__bar"><i style={{ width: `${((i + (answered ? 1 : 0)) / queue.length) * 100}%` }} /></span>
        <span className="num sub">{i + 1}/{queue.length}</span>
      </div>

      <section className="card rd-q">
        <div className="row">
          <span className="rd-pill">{secLabel(rec.section)}</span>
          <span className="rd-pill"><span lang="ja">問題{m.no}</span> {m.label}</span>
          {w.rv.step > 0 && <span className="rd-pill is-good">{w.rv.step}번 맞힘</span>}
        </div>
        <b className="rd-q__where num">{where({ ...w, page: rec.page, label: rec.label })}</b>
        <p className="sub">{fmtDay(rec.date)}에 틀린 문제예요. 교재에서 이 문제를 다시 풀고{w.answer ? ' 답을 골라 보세요.' : ' 맞혔는지 알려 주세요.'}</p>

        {w.answer ? (
          <div className="rd-bigchoices">
            {Array.from({ length: m.choices }, (_, k) => k + 1).map((c) => {
              const cls = !answered ? '' : c === w.answer ? 'is-right' : c === pick ? 'is-wrong' : 'is-dim';
              return <button key={c} type="button" className={cls} disabled={answered} aria-label={`${c}번`} onClick={() => choose(c)}>{c}</button>;
            })}
          </div>
        ) : (
          <div className="row rd-selfgrade">
            <button type="button" className="btn btn--big rd-ok" disabled={answered} onClick={() => choose('ok')}>맞혔어요</button>
            <button type="button" className="btn btn--big rd-no" disabled={answered} onClick={() => choose('no')}>또 틀렸어요</button>
          </div>
        )}
      </section>

      {answered && (
        <section className={`card rd-fb ${ok ? 'is-ok' : 'is-no'}`} aria-live="polite">
          <b>{ok ? (w.rv.step >= 2 ? '이제 알았어요!' : '맞혔어요') : '다시 틀렸어요'}</b>
          <dl>
            {w.answer && <><dt>정답</dt><dd>{mark(w.answer)}</dd></>}
            {w.mine && <><dt>처음 고른 답</dt><dd>{mark(w.mine)}</dd></>}
            {w.reason && <><dt>그때 틀린 이유</dt><dd>{reasonLabel(rec.section, w.reason)}</dd></>}
            {w.note && <><dt>메모</dt><dd>{w.note}</dd></>}
          </dl>
          <p className="sub">{ok ? (w.rv.step >= 2 ? '세 번 맞혀서 다 안 문제로 넘어가요.' : '며칠 뒤에 한 번 더 나와요.') : '내일 다시 나와요.'}</p>
          <button type="button" className="btn btn--pri btn--big" onClick={next}>{i + 1 < queue.length ? '다음' : '끝'}</button>
        </section>
      )}
    </div>
  );
}

/* ───────── 오답 노트 ───────── */
function Notes({ list, map, today, onBack }) {
  const [sec, setSec] = useState('all');
  const [state, setState] = useState('left');
  const [type, setType] = useState('');
  const rows = allWrong(list)
    .filter((w) => (sec === 'all' || w.section === sec) && (state === 'left' ? !w.rv.done : w.rv.done) && (!type || w.mondai === type))
    .sort((a, b) => (state === 'left' ? (a.rv.due < b.rv.due ? -1 : a.rv.due > b.rv.due ? 1 : 0) : a.date < b.date ? 1 : -1));
  const toggle = (w, done) => save('drill', w.rec, setWrongDone(map[w.rec], w.id, done, today));
  const types = MONDAI.filter((m) => sec === 'all' || m.section === sec);

  return (
    <div className="page rd">
      <header className="rd-top">
        <div>
          <button type="button" className="rd-back" onClick={onBack}>‹ 독해·청해</button>
          <h1 className="h1">오답 노트</h1>
        </div>
      </header>
      <div className="row">
        <span className="seg">
          {[['all', '전체'], ...SECTIONS.map((s) => [s.key, s.label])].map(([k, t]) => (
            <button key={k} type="button" aria-pressed={sec === k} onClick={() => { setSec(k); setType(''); }}>{t}</button>
          ))}
        </span>
        <span className="seg">
          <button type="button" aria-pressed={state === 'left'} onClick={() => setState('left')}>다시 볼 것</button>
          <button type="button" aria-pressed={state === 'done'} onClick={() => setState('done')}>다 앎</button>
        </span>
        <label className="field rd-typesel">
          <select value={type} onChange={(e) => setType(e.target.value)} aria-label="문제 유형">
            <option value="">모든 유형</option>
            {types.map((m) => <option key={m.key} value={m.key}>{secLabel(m.section)} · {m.label}</option>)}
          </select>
        </label>
      </div>
      {rows.length ? (
        <ul className="rd-notes">
          {rows.map((w) => {
            const m = mondaiOf(w.mondai);
            const late = !w.rv.done && w.rv.due <= today;
            return (
              <li key={w.id} className="card">
                <div className="rd-hd">
                  <b className="num">{where(w)}</b>
                  <small className={late ? 'rd-due' : ''}>{w.rv.done ? '다 앎' : late ? '오늘 다시' : `${fmtDay(w.rv.due)} 다시`}</small>
                </div>
                <p className="sub">{secLabel(w.section)} · {m?.label} · {fmtDay(w.date)}에 틀림</p>
                <div className="row">
                  {w.mine && <span className="rd-pill is-bad">내 답 {mark(w.mine)}</span>}
                  {w.answer && <span className="rd-pill is-good">정답 {mark(w.answer)}</span>}
                  {w.reason && <span className="rd-pill">{reasonLabel(w.section, w.reason)}</span>}
                  {w.rv.hist?.length > 0 && <span className="rd-dots" aria-label="다시 푼 결과">{w.rv.hist.slice(-6).map((h, k) => <i key={k} className={h.ok ? 'is-ok' : 'is-no'} />)}</span>}
                </div>
                {w.note && <p className="rd-note">{w.note}</p>}
                <div className="row">
                  {w.rv.done
                    ? <button type="button" className="btn" onClick={() => toggle(w, false)}>다시 보기로</button>
                    : <button type="button" className="btn" onClick={() => toggle(w, true)}>이제 알아요</button>}
                </div>
              </li>
            );
          })}
        </ul>
      ) : <section className="card"><p className="sub">{state === 'left' ? '다시 볼 문제가 없어요.' : '아직 다 안 문제가 없어요.'}</p></section>}
    </div>
  );
}
