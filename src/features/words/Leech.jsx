// 복습 관리: 앞으로 7일 복습량 + 하루 상한 (ReviewPlan, 단어 첫 화면) · 안 외워지는 단어 집중 (LeechStudy)
import { useEffect, useMemo, useRef, useState } from 'react';
import { save, useData } from '../../lib/store';
import { todayStr } from '../../lib/dates';
import { startTimer } from '../../lib/studylog';
import { LEECH_L, REV_CAP, REV_CAPS, forecast, isLeech, reviewedToday } from './learn';
import { kanjiIndex } from './hanja';
import { Check, WordInfo } from './Learn';
import './learn.css';

const DOW = ['일', '월', '화', '수', '목', '금', '토'];
const dayLabel = (d, k) => (k === 0 ? '오늘' : k === 1 ? '내일' : DOW[new Date(`${d}T00:00`).getDay()]);
export const capOf = (prefs) => (prefs.revCap ?? REV_CAP);

/* ───────── 앞으로 7일 복습 · 하루 상한 · 안 외워지는 단어 ───────── */
export function ReviewPlan({ cards, prefs, onCap, go }) {
  const today = todayStr();
  const fc = useMemo(() => forecast(cards, today, 7), [cards, today]);
  const cap = capOf(prefs);
  const done = reviewedToday(cards, today);
  const leeches = useMemo(() => Object.values(cards).filter(isLeech).length, [cards]);
  // 상한선은 복습이 상한 가까이(60%) 갈 때만 그림. 막대 높이는 px (가장 큰 날 = 80px)
  const maxN = Math.max(...fc.map((x) => x.n), 1);
  const showCap = cap > 0 && maxN >= cap * 0.6;
  const top = showCap ? Math.max(maxN, cap) : maxN;
  const H = 80;
  const over = cap ? Math.max(0, fc[0].n - Math.max(0, cap - done)) : 0;
  const busy = cap && fc.slice(1).some((x) => x.n > cap);
  return (
    <section className="card">
      <div className="wd-hd"><b>앞으로 7일 복습</b><small className="num">오늘 한 복습 {done}{cap ? ` · 상한 ${cap}` : ''}</small></div>
      <div className="rp-chart" role="img" aria-label={fc.map((x, k) => `${dayLabel(x.d, k)} ${x.n}개`).join(', ')}>
        <div className="rp-plot" style={{ height: H + 18 }}>
          {showCap && <div className="rp-cap" style={{ bottom: (cap / top) * H }}><span>상한 {cap}</span></div>}
          {fc.map((x) => (
            <div key={x.d} className="rp-col" title={`${x.d} · ${x.n}개`}>
              <span className="rp-n num">{x.n || ''}</span>
              <i className={`rp-bar ${cap && x.n > cap ? 'is-over' : ''}`} style={{ height: x.n ? Math.max(3, Math.round((x.n / top) * H)) : 0 }} />
            </div>
          ))}
        </div>
        <div className="rp-days">
          {fc.map((x, k) => <small key={x.d} className={k === 0 ? 'is-today' : ''}>{dayLabel(x.d, k)}</small>)}
        </div>
      </div>
      {over > 0 && <p className="sub">오늘 상한을 넘는 {over}개는 내일로 넘어가요. 간격이 짧은(잊기 쉬운) 단어부터 먼저 나와요.</p>}
      {busy && !over && <p className="sub">상한보다 많은 날이 있어요. 새 단어를 많이 넣는 날엔 복습부터 끝내 두면 덜 밀려요.</p>}
      <div className="row">
        <span className="sub">하루 복습 상한</span>
        <span className="seg">
          {REV_CAPS.map((n) => <button key={n} type="button" aria-pressed={cap === n} onClick={() => onCap(n)}>{n || '없음'}</button>)}
        </span>
      </div>
      <div className="rp-leech">
        <div>
          <b>안 외워지는 단어 <span className="num">{leeches}</span></b>
          <small className="sub">{LEECH_L}번 넘게 틀린 단어 · 3주 넘게 기억하면 빠져요</small>
        </div>
        <button type="button" className="btn" disabled={!leeches} onClick={() => go('leech')}>집중해서 보기</button>
      </div>
    </section>
  );
}

/* ───────── 안 외워지는 단어 집중 ───────── */
// 한 단어씩: 전체 정보(한자 조각·같은 한자 단어) + 헷갈린 단어 나란히 + 나만의 기억 이야기 → 확인 퀴즈
export function LeechStudy({ pool, onDone }) {
  const cards = useData('words');
  const byId = useMemo(() => Object.fromEntries(pool.map((w) => [w.id, w])), [pool]);
  const idx = useMemo(() => kanjiIndex(pool), [pool]);
  const [list] = useState(() =>
    pool
      .filter((w) => isLeech(cards[w.id]))
      .sort((a, b) => (cards[b.id].l || 0) - (cards[a.id].l || 0))
      .map((w) => w.id),
  );
  const [pos, setPos] = useState(0);
  const [phase, setPhase] = useState('look'); // look · check
  const [score, setScore] = useState(0);
  const timer = useRef(null);
  useEffect(() => {
    timer.current = startTimer('vocab', '안 외워지는 단어');
    return () => timer.current?.finish();
  }, []);
  const id = list[pos];
  const w = byId[id];
  const c = cards[id] || {};
  const [memo, setMemo] = useState(c.mn || '');
  useEffect(() => setMemo(cards[id]?.mn || ''), [id]); // eslint-disable-line react-hooks/exhaustive-deps
  const saveMemo = () => {
    const v = memo.trim();
    if (v !== (cards[id]?.mn || '')) save('words', id, { mn: v || undefined });
  };
  const toCheck = () => {
    saveMemo();
    setPhase('check');
  };
  const checked = (ok) => {
    timer.current?.add({ n: 1, ok: ok ? 1 : 0 });
    if (ok) setScore((s) => s + 1);
    setPhase('look');
    setPos((p) => p + 1);
  };
  useEffect(() => {
    const k = (e) => {
      if (phase !== 'look' || e.target.closest?.('textarea, input')) return;
      if (e.key === 'Escape') onDone();
      else if (e.key === 'Enter') {
        e.preventDefault();
        toCheck();
      }
    };
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  });

  if (!w) {
    return (
      <div className="page wd">
        <section className="card wd-end">
          <b className="wd-end__t">{list.length ? `${score} / ${list.length}` : '안 외워지는 단어가 없어요'}</b>
          {list.length > 0 && <p className="sub">이 화면은 복습 날짜를 바꾸지 않아요. 적어 둔 기억 이야기는 다음 복습에서 틀리면 힌트로 나와요.</p>}
          <div className="row"><button type="button" className="btn btn--pri" onClick={onDone}>처음으로</button></div>
        </section>
      </div>
    );
  }
  const confused = (c.cf || []).map((x) => byId[x]).filter(Boolean);
  return (
    <div className="page wd wd-sess ln">
      <header className="wd-sess__top">
        <button type="button" className="btn" onClick={onDone} aria-label="그만하기">✕</button>
        <span className="wd-pill ln-ph ln-ph--leech">안 외워지는 단어 · 틀림 {c.l || 0}</span>
        <div className="bar wd-sess__bar"><i style={{ width: `${(pos / list.length) * 100}%`, background: 'var(--org)' }} /></div>
        <span className="num sub">{pos + 1}/{list.length}</span>
      </header>
      {phase === 'look' ? (
        <>
          <div className="card ln-q">
            <WordInfo w={w} idx={idx} cards={cards} big memo={false} />
            {confused.length > 0 && (
              <div className="lc-pair">
                <small className="sub">헷갈렸던 단어 (뜻 고를 때 대신 고른 것)</small>
                <ul>
                  <li className="is-me"><b lang="ja">{w.w}</b><span lang="ja">{w.r}</span><span>{w.m}</span></li>
                  {confused.map((x) => <li key={x.id}><b lang="ja">{x.w}</b><span lang="ja">{x.r}</span><span>{x.m}</span></li>)}
                </ul>
              </div>
            )}
            <label className="lc-memo" htmlFor="lc-memo">
              <small className="sub">나만의 기억 이야기 · 한자 조각, 비슷한 한국어 소리, 장면 아무거나 (다음에 틀리면 힌트로 나와요)</small>
              <textarea id="lc-memo" rows={2} value={memo} onChange={(e) => setMemo(e.target.value)} onBlur={saveMemo} placeholder="예: 흙(土)에 북돋아(培) 키운다 → つちかう" />
            </label>
          </div>
          <div className="wd-grades wd-grades--front">
            <button type="button" className="btn btn--pri btn--big" onClick={toCheck}>확인해 보기 <kbd>Enter</kbd></button>
          </div>
        </>
      ) : (
        <Check key={`${pos}-${id}`} w={w} pool={pool} idx={idx} cards={cards} review={false} onDone={checked} onExit={onDone} />
      )}
    </div>
  );
}
