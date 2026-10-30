// 문자·어휘 모의: 실제 시험처럼 問題1~4 순서, 답은 끝나고 한꺼번에 (앞 문제로 돌아가 고칠 수 있음), 시간 재기
//  · 끝나면 종류별 점수 + 틀린 문제 풀이 (漢字読み 는 보기마다 어디가 함정이었는지)
//  · 틀린 단어: 배운 단어는 복습으로(10분 뒤), 안 배운 단어는 새 단어 맨 앞
import { useEffect, useMemo, useRef, useState } from 'react';
import { save, useData } from '../../lib/store';
import { EXAM_DATE } from '../../lib/srs';
import { todayStr } from '../../lib/dates';
import { startTimer } from '../../lib/studylog';
import { answer, clean } from '../words/learn';
import { trapText } from '../words/yomi';
import { splitExample } from '../words/words';
import { KanjiParts } from '../words/Learn';
import { SECTIONS, SEC_PER_Q, makeMock, pctOf, scoreMock, secOf } from './mock';
import '../words/words.css';
import '../words/learn.css';

const mmss = (sec) => `${Math.floor(sec / 60)}:${String(Math.floor(sec % 60)).padStart(2, '0')}`;

function Question({ q, pick, onPick, reveal }) {
  const s = secOf(q.sec);
  const cls = (i) => (reveal ? (i === q.answer ? 'is-right' : i === pick ? 'is-wrong' : '') : i === pick ? 'is-pick' : '');
  return (
    <>
      <div className="ln-n1__p"><span lang="ja">問題{s.no} {s.ja}</span><small className="sub">{s.name} · {s.ko}</small></div>
      {q.type === 'use' ? (
        <div className="ln-q__w" lang="ja">{q.word.w}</div>
      ) : q.type === 'yomi' ? (
        (() => {
          const [a, b, c] = splitExample(q.word.ex, q.word.w);
          return b ? <p className="wd-q" lang="ja">{a}<u>{b}</u>{c}</p> : <div className="wd-card__w" lang="ja"><u>{q.word.w}</u></div>;
        })()
      ) : (
        <p className="wd-q" lang="ja">
          {q.sent[0]}
          {q.type === 'ctx' ? <span className="ln-blank">{reveal ? q.sent[1] : '（　　）'}</span> : <u>{q.sent[1]}</u>}
          {q.sent[2]}
        </p>
      )}
      <div className={`wd-choices ex-choices ${q.type === 'use' ? 'ln-sents' : q.type === 'yomi' ? 'ex-grid' : ''}`}>
        {q.options.map((o, i) => (
          <button key={i} type="button" lang="ja" className={`wd-ch ${cls(i)}`} onClick={() => onPick?.(i)} disabled={reveal}>
            <span className="num">{i + 1}</span>
            {q.type === 'use' ? (
              <span className="ln-sent">{o.sent[0]}<b>{o.sent[1]}</b>{o.sent[2]}</span>
            ) : q.type === 'yomi' ? (
              <>{o.r}{reveal && o.traps.length > 0 && <small className="wd-trap" lang="ko">{trapText(o)}</small>}</>
            ) : (
              <span className="ln-opt">{o.text}{reveal && <small lang="ko"> {o.sub !== o.text ? `${o.sub} · ` : ''}{o.m}</small>}</span>
            )}
          </button>
        ))}
      </div>
      {reveal && (
        <div className="ln-fb">
          <span><b lang="ja">{q.word.w}</b> <span lang="ja">（{q.word.r}）</span> {q.word.m}{q.syn && <> ≒ <b lang="ja">{q.syn.w}</b> {q.syn.m}</>}</span>
          {q.word.k && <span className="sub">{q.word.k}</span>}
          <KanjiParts w={q.word.w} r={q.word.r} />
        </div>
      )}
    </>
  );
}

export function Mock({ pool, kind, onDone }) {
  const cards = useData('words');
  const cardsRef = useRef(cards);
  cardsRef.current = cards;
  const [qs] = useState(() => makeMock(pool, cards, kind));
  const [picks, setPicks] = useState(() => qs.map(() => null));
  const [pos, setPos] = useState(0);
  const [res, setRes] = useState(null);
  const [t0] = useState(() => Date.now());
  const [now, setNow] = useState(Date.now());
  const timer = useRef(null);
  useEffect(() => {
    timer.current = startTimer('vocab', kind === 'full' ? '문자·어휘 모의 25문제' : '문자·어휘 미니 모의');
    const iv = setInterval(() => setNow(Date.now()), 1000);
    return () => {
      clearInterval(iv);
      timer.current?.stop();
    };
  }, [kind]);
  const sec = res ? res.sec : (now - t0) / 1000;
  const goal = qs.length * SEC_PER_Q;
  const q = qs[pos];
  const left = picks.filter((p) => p === null).length;

  const finish = () => {
    const sc = scoreMock(qs, picks);
    const today = todayStr();
    const at = Date.now();
    const s = Math.round((at - t0) / 1000);
    const id = `${kind}-${at}`;
    save('mock', id, { id, day: today, at, kind, sec: s, parts: sc.parts, wrong: sc.wrong });
    for (const wid of sc.wrong) {
      const c = cardsRef.current[wid];
      if (c?.t && !c.skip) save('words', wid, () => clean(answer(c, false, today, at, EXAM_DATE)));
      else save('words', wid, () => ({ pri: 1 }));
    }
    timer.current?.add({ n: sc.n, ok: sc.ok });
    timer.current?.stop();
    timer.current = null;
    setRes({ ...sc, sec: s });
    setPos(0);
  };
  const pick = (i) => {
    setPicks((p) => p.map((x, k) => (k === pos ? i : x)));
    // 고르면 다음 문제로 (마지막 문제면 그대로)
    if (pos < qs.length - 1) setTimeout(() => setPos((p) => Math.min(qs.length - 1, p + 1)), 180);
  };
  const keyRef = useRef();
  keyRef.current = (e) => {
    if (e.key === 'Escape') return onDone();
    if (res) return;
    if (/^[1-4]$/.test(e.key)) pick(+e.key - 1);
    else if (e.key === 'ArrowRight') setPos((p) => Math.min(qs.length - 1, p + 1));
    else if (e.key === 'ArrowLeft') setPos((p) => Math.max(0, p - 1));
  };
  useEffect(() => {
    const k = (e) => keyRef.current(e);
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  }, []);
  const wrongQs = useMemo(() => (res ? qs.map((x, i) => ({ q: x, i })).filter(({ q: x, i }) => picks[i] !== x.answer) : []), [res]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!qs.length) {
    return <div className="page wd"><section className="card"><p className="sub">문제를 만들 단어가 모자라요.</p><button type="button" className="btn" onClick={onDone}>돌아가기</button></section></div>;
  }

  if (res) {
    return (
      <div className="page wd ex">
        <section className="card wd-end">
          <b className="wd-end__t">{res.ok} / {res.n}</b>
          <p className="sub num">걸린 시간 {mmss(res.sec)} · 목표 {mmss(goal)} {res.sec <= goal ? '· 시간 안에 끝냄 👍' : '· 더 빨리 풀기 연습'}</p>
          <div className="ex-parts">
            {SECTIONS.filter((s) => res.parts[s.k]).map((s) => {
              const p = res.parts[s.k];
              return (
                <div key={s.k} className="ex-part">
                  <span><b lang="ja">問題{s.no}</b> <span lang="ja">{s.name}</span></span>
                  <span className="bar"><i style={{ width: `${pctOf(p)}%`, background: pctOf(p) >= 70 ? 'var(--grn)' : 'var(--org)' }} /></span>
                  <b className="num">{p[0]}/{p[1]}</b>
                </div>
              );
            })}
          </div>
          {wrongQs.length > 0 ? <p className="sub">틀린 단어는 복습(안 배운 단어는 새 단어 맨 앞)에 넣었어요. 아래에서 풀이를 볼 수 있어요.</p> : <p className="sub">전부 맞혔어요!</p>}
          <div className="row"><button type="button" className="btn btn--pri" onClick={onDone}>처음으로</button></div>
        </section>
        {wrongQs.map(({ q: x, i }) => (
          <section key={i} className="card ln-q ln-n1 ln">
            <Question q={x} pick={picks[i]} reveal />
          </section>
        ))}
      </div>
    );
  }

  return (
    <div className="page wd wd-sess ln ex">
      <header className="wd-sess__top">
        <button type="button" className="btn" onClick={onDone} aria-label="그만하기">✕</button>
        <div className="bar wd-sess__bar"><i style={{ width: `${(Math.min(sec, goal) / goal) * 100}%`, background: sec > goal ? 'var(--red)' : 'var(--blu)' }} /></div>
        <span className={`num sub ${sec > goal ? 'ex-over' : ''}`}>{mmss(sec)} / {mmss(goal)}</span>
      </header>
      <nav className="ex-dots" aria-label="문제 번호">
        {qs.map((x, i) => (
          <button key={i} type="button" className={`ex-dot ${i === pos ? 'is-on' : ''} ${picks[i] !== null ? 'is-done' : ''} ${i > 0 && qs[i - 1].sec !== x.sec ? 'is-sec' : ''}`} onClick={() => setPos(i)} aria-label={`${i + 1}번`}>{i + 1}</button>
        ))}
      </nav>
      <div className="card ln-q ln-n1">
        <Question q={q} pick={picks[pos]} onPick={pick} />
      </div>
      <div className="row ex-nav">
        <button type="button" className="btn" disabled={pos === 0} onClick={() => setPos(pos - 1)}>‹ 앞 문제</button>
        <button type="button" className="btn" disabled={pos === qs.length - 1} onClick={() => setPos(pos + 1)}>다음 문제 ›</button>
        <button type="button" className={`btn ${left ? '' : 'btn--pri'}`} onClick={() => (!left || window.confirm(`${left}문제를 안 풀었어요. 끝낼까요?`)) && finish()}>{left ? `끝내기 (${left}문제 남음)` : '채점하기'}</button>
      </div>
    </div>
  );
}
