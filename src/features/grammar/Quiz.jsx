// 문법 퀴즈 화면 (듀오링고·Anki 식). 저장은 밖에서 받음:
//  cards { id: 카드상태 } · setCard(id, next) · grade/queue (srs.js) · today·exam 'YYYY-MM-DD'
//  onStep(id, ok) 한 문제 풀 때마다 (처음 푼 것만) · onLog({part,sec,n,ok,what}) 한 판 끝
import { useEffect, useMemo, useRef, useState } from 'react';
import { GRAMMAR } from './data.js';
import { KINDS, byId, gradeOf, makeRound, shuffle, todayIds, weakList } from './quiz.js';

const NEW_PER_DAY = 10;
const kindKey = 'jlpt:gq-kinds'; // 이 기기에서 고른 문제 종류
const loadKinds = () => {
  try {
    const v = JSON.parse(localStorage.getItem(kindKey));
    if (Array.isArray(v) && v.length) return v;
  } catch {}
  return ['fill', 'mean'];
};

export default function GrammarQuiz({ cards = {}, setCard, grade, queue, today, exam, onStep, onLog }) {
  const [round, setRound] = useState(null); // { qs, title }
  const [view, setView] = useState('home'); // home | list
  const [kinds, setKinds] = useState(loadKinds);
  useEffect(() => {
    try { localStorage.setItem(kindKey, JSON.stringify(kinds)); } catch {}
  }, [kinds]);

  const newToday = GRAMMAR.filter((g) => cards[g.id]?.t === today && (cards[g.id].n || 0) + (cards[g.id].l || 0) <= 1).length;
  const ids = useMemo(() => todayIds(cards, today, Math.max(0, NEW_PER_DAY - newToday), queue), [cards, today]);
  const weak = useMemo(() => weakList(cards), [cards]);
  const seen = GRAMMAR.filter((g) => cards[g.id]?.t).length;
  const known = GRAMMAR.filter((g) => cards[g.id]?.i >= 7).length;

  const start = (list, title) => list.length && setRound({ qs: makeRound(list, kinds), title });

  if (round)
    return (
      <Play
        round={round}
        onAnswer={(id, ok, ms) => {
          setCard?.(id, grade(cards[id], gradeOf(ok, ms), today, exam));
          onStep?.(id, ok);
        }}
        onEnd={(r) => {
          onLog?.({ part: 'grammar', sec: Math.round(r.ms / 1000), n: r.n, ok: r.ok, what: round.title });
          setRound(null);
        }}
      />
    );

  if (view === 'list') return <List cards={cards} onBack={() => setView('home')} onPick={(id) => start([id], '문법 하나')} />;

  const toggle = (k) => setKinds((v) => (v.includes(k) ? (v.length > 1 ? v.filter((x) => x !== k) : v) : [...v, k]));
  return (
    <div className="gq">
      <div className="gq-hero">
        <div className="gq-num">
          <b>{ids.length}</b>
          <span>오늘 풀 문제</span>
        </div>
        <div className="gq-bar"><i style={{ width: `${(known / GRAMMAR.length) * 100}%` }} /><i className="gq-bar-seen" style={{ width: `${((seen - known) / GRAMMAR.length) * 100}%` }} /></div>
        <div className="gq-meta">
          익힘 {known} · 배우는 중 {seen - known} · 아직 {GRAMMAR.length - seen}
          {exam ? ` · 시험까지 ${Math.max(0, Math.round((new Date(exam) - new Date(today)) / 864e5))}일` : ''}
        </div>
        <button className="gq-go" disabled={!ids.length} onClick={() => start(ids, '오늘 문법')}>
          {ids.length ? '시작하기' : '오늘 몫 끝! 🎉'}
        </button>
      </div>

      <div className="gq-sec">문제 종류</div>
      <div className="gq-chips">
        {KINDS.map((x) => (
          <button key={x.k} className={kinds.includes(x.k) ? 'on' : ''} onClick={() => toggle(x.k)}>{x.label}</button>
        ))}
      </div>

      <div className="gq-sec">더 풀기</div>
      <div className="gq-more">
        <button onClick={() => start(weak, '틀린 문법')} disabled={!weak.length}>
          <b>틀린 문법 다시</b>
          <span>{weak.length ? `${weak.length}개` : '아직 없어요'}</span>
        </button>
        <button onClick={() => start(shuffle(GRAMMAR.map((g) => g.id)).slice(0, 10), '아무거나 10문제')}>
          <b>아무거나 10문제</b>
          <span>복습 날짜와 상관없이</span>
        </button>
        <button onClick={() => setView('list')}>
          <b>문법 목록</b>
          <span>{GRAMMAR.length}개 · 뜻·예문 보기</span>
        </button>
      </div>
    </div>
  );
}

function Play({ round, onAnswer, onEnd }) {
  const [qs, setQs] = useState(round.qs);
  const [i, setI] = useState(0);
  const [pick, setPick] = useState(null);
  const [stat, setStat] = useState({ n: 0, ok: 0 });
  const t0 = useRef(Date.now());
  const tq = useRef(Date.now());
  const firstTry = useRef(new Set());
  const q = qs[i];
  const done = i >= qs.length;

  const choose = (c) => {
    if (pick != null || !q) return;
    setPick(c);
    const ok = c === q.answer;
    // 같은 판에서 다시 나온 문제는 기록 안 함 (처음 푼 것만)
    if (!firstTry.current.has(q.id)) {
      firstTry.current.add(q.id);
      onAnswer(q.id, ok, Date.now() - tq.current);
      setStat((s) => ({ n: s.n + 1, ok: s.ok + (ok ? 1 : 0) }));
    }
    if (!ok && !q.again) setQs((v) => [...v, { ...q, again: true, choices: shuffle(q.choices) }]); // 틀린 건 판 끝에 한 번 더
  };
  const next = () => {
    setPick(null);
    tq.current = Date.now();
    setI((x) => x + 1);
  };

  useEffect(() => {
    const onKey = (e) => {
      if (done) return;
      if (pick == null && /^[1-4]$/.test(e.key)) choose(q.choices[+e.key - 1]);
      else if (pick != null && (e.key === 'Enter' || e.key === ' ')) {
        e.preventDefault();
        next();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  if (done) {
    const ms = Date.now() - t0.current;
    const pct = stat.n ? Math.round((stat.ok / stat.n) * 100) : 0;
    return (
      <div className="gq gq-end">
        <div className="gq-end-big">{pct >= 80 ? '🎉' : pct >= 50 ? '👍' : '💪'}</div>
        <h2>{round.title} 끝!</h2>
        <div className="gq-end-row">
          <div><b>{stat.ok}/{stat.n}</b><span>처음에 맞힘</span></div>
          <div><b>{pct}%</b><span>정답률</span></div>
          <div><b>{Math.max(1, Math.round(ms / 60000))}분</b><span>걸린 시간</span></div>
        </div>
        <button className="gq-go" onClick={() => onEnd({ ms, ...stat })}>돌아가기</button>
      </div>
    );
  }

  const item = byId[q.id];
  const ok = pick === q.answer;
  return (
    <div className="gq gq-play">
      <div className="gq-top">
        <button className="gq-x" onClick={() => onEnd({ ms: Date.now() - t0.current, ...stat })} aria-label="그만하기">✕</button>
        <div className="gq-prog"><i style={{ width: `${(i / qs.length) * 100}%` }} /></div>
        <span className="gq-cnt">{i + 1}/{qs.length}</span>
      </div>
      <div className="gq-q">
        <div className="gq-sub">{q.again ? '🔁 한 번 더 · ' : ''}{q.sub}</div>
        <div className={`gq-ask ${q.kind === 'fill' ? 'jp' : q.kind === 'mean' ? 'jp big' : 'ko'}`} lang={q.kind === 'form' ? 'ko' : 'ja'}>
          {q.kind === 'fill' ? <FillText s={q.ask} fill={pick != null ? q.answer : null} /> : q.ask}
        </div>
      </div>
      <div className="gq-choices">
        {q.choices.map((c, k) => (
          <button
            key={c}
            className={pick == null ? '' : c === q.answer ? 'right' : c === pick ? 'wrong' : 'dim'}
            onClick={() => choose(c)}
          >
            <span className="gq-k">{k + 1}</span>
            <span className={q.kind === 'mean' ? 'ko' : 'jp'} lang={q.kind === 'mean' ? 'ko' : 'ja'}>{c}</span>
          </button>
        ))}
      </div>
      {pick != null && (
        <div className={`gq-sheet ${ok ? 'ok' : 'no'}`}>
          <div className="gq-sheet-h">{ok ? '정답이에요!' : `정답: ${q.answer}`}</div>
          <div className="gq-note">
            <b className="jp" lang="ja">{item.f}</b> {item.m}
            <div className="gq-conn">접속 · {item.c}</div>
            <div className="gq-ex jp" lang="ja">{item.ex.j}</div>
            <div className="gq-exk">{item.ex.k}</div>
          </div>
          <button className="gq-go" onClick={next} autoFocus>계속</button>
        </div>
      )}
    </div>
  );
}

function FillText({ s, fill }) {
  const parts = s.split('（　）');
  return parts.map((p, k) => (
    <span key={k}>
      {p}
      {k < parts.length - 1 && <span className={`gq-blank ${fill ? 'filled' : ''}`}>{fill ? fill.split(' / ')[k] ?? fill : '　　'}</span>}
    </span>
  ));
}

function List({ cards, onBack, onPick }) {
  const [q, setQ] = useState('');
  const [open, setOpen] = useState(null);
  const groups = useMemo(() => {
    const t = q.trim();
    const hit = GRAMMAR.filter((g) => !t || g.f.includes(t) || g.m.includes(t) || g.ex.j.includes(t));
    const m = new Map();
    for (const g of hit) m.set(g.g, [...(m.get(g.g) || []), g]);
    return [...m];
  }, [q]);
  return (
    <div className="gq gq-list">
      <div className="gq-top">
        <button className="gq-x" onClick={onBack} aria-label="뒤로">‹</button>
        <input className="gq-search" placeholder="문법·뜻 찾기" value={q} onChange={(e) => setQ(e.target.value)} />
      </div>
      {groups.map(([g, list]) => (
        <div key={g}>
          <div className="gq-sec">{g}</div>
          {list.map((x) => {
            const c = cards[x.id];
            const dot = !c?.t ? '' : c.i >= 7 ? 'known' : 'learn';
            return (
              <div key={x.id} className={`gq-row ${open === x.id ? 'open' : ''}`}>
                <button className="gq-row-h" onClick={() => setOpen(open === x.id ? null : x.id)}>
                  <i className={`gq-dot ${dot}`} />
                  <b className="jp" lang="ja">{x.f}</b>
                  <span>{x.m}</span>
                </button>
                {open === x.id && (
                  <div className="gq-note">
                    <div className="gq-conn">접속 · {x.c}</div>
                    <div className="gq-ex jp" lang="ja">{x.ex.j}</div>
                    <div className="gq-exk">{x.ex.k}</div>
                    {c?.l > 0 && <div className="gq-conn">틀린 횟수 {c.l}</div>}
                    <button className="gq-mini" onClick={() => onPick(x.id)}>이 문법 풀어 보기</button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}
