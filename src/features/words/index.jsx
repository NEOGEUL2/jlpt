// 단어: 오늘 단어(복습 → 새 단어 5개씩 배우기, Learn.jsx) · N1 모양 문제(N1Quiz.jsx) · 읽기 퀴즈(한자 읽기) · 교재 단어 넣기 · 단어장
import { useEffect, useMemo, useRef, useState } from 'react';
import { remove, save, saveMany, useData } from '../../lib/store';
import { EXAM_DATE, maturity, queue } from '../../lib/srs';
import { diffDays, todayStr } from '../../lib/dates';
import { startTimer } from '../../lib/studylog';
import { BASE, LEVELS, ORDERS, allWords, hasKanji, idsInOrder, unsorted, newToday, parsePaste, quizPick, splitExample } from './words';
import { trapText, yomiChoices, yomiOk } from './yomi';
import { Study } from './Learn';
import { askReading, meaningOnly, paceNeed } from './learn';
import { N1Quiz } from './N1Quiz';
import { LeechStudy, ReviewPlan, capOf } from './Leech';
import { KanjiStudy } from './Kanji';
import { PairDrill } from './Pairs';
import { noGuess } from './groups';
import './words.css';

const NEW_OPTS = [20, 30, 50, 100, 150, 200];

function usePrefs() {
  const p = useData('prefs').main || {};
  const levels = LEVELS.filter((l) => (p.levels || LEVELS).includes(l));
  const base = p.newPerDay || 50;
  // 오늘만 더 배우기 ('10개 더'): prefs.more = { d: 날짜, n: 더한 수 }
  const more = p.more?.d === todayStr() ? p.more.n || 0 : 0;
  return { ...p, newPerDay: base, more, newToday: base + more, levels: levels.length ? levels : LEVELS, order: p.order || 'easy', readMode: p.readMode || 'smart' };
}
const addMore = (prefs, n) => save('prefs', 'main', { more: { d: todayStr(), n: prefs.more + n } });
function useWords(all) {
  const own = useData('own');
  const { levels, order } = usePrefs();
  const key = all ? LEVELS.join() : levels.join();
  return useMemo(() => allWords(own, key.split(','), order), [own, key, order]);
}
const setPrefs = (patch) => save('prefs', 'main', patch);

export default function Words() {
  const [mode, setMode] = useState(null); // null 첫 화면 · 'cards' 오늘 단어 · 'n1' N1 모양 문제 · 'quiz' · 'add' · 'list'
  const [round, setRound] = useState(0);
  // 다른 메뉴(시험)에서 바로 열기: sessionStorage 'jlpt:open' · 이벤트 'jlpt-open' (detail = mode)
  useEffect(() => {
    const MODES = ['cards', 'n1', 'quiz', 'sort', 'pairs', 'wago', 'kanji', 'onkun'];
    const open = (m) => MODES.includes(m) && setMode(m);
    try {
      const m = sessionStorage.getItem('jlpt:open');
      sessionStorage.removeItem('jlpt:open');
      open(m);
    } catch {
      /* 없어도 됨 */
    }
    const on = (e) => open(e.detail);
    window.addEventListener('jlpt-open', on);
    return () => window.removeEventListener('jlpt-open', on);
  }, []);
  const done = (next = null) => {
    setMode(next);
    setRound((r) => r + 1);
  };
  if (mode === 'cards') return <StudyRoute onDone={() => done()} />;
  if (mode === 'n1') return <N1Route onDone={() => done()} />;
  if (mode === 'leech') return <LeechRoute onDone={() => done()} />;
  if (mode === 'pairs') return <PairsRoute onDone={() => done()} />;
  if (mode === 'wago') return <WagoRoute onDone={() => done()} />;
  if (mode === 'kanji' || mode === 'onkun') return <KanjiRoute start={mode === 'onkun' ? 'onkun' : 'rad'} onDone={() => done()} />;
  if (mode === 'sort') return <Sort key={round} onDone={done} />;
  if (mode === 'quiz') return <Quiz onDone={done} />;
  if (mode === 'add') return <AddWords onDone={done} />;
  if (mode === 'list') return <WordList onDone={done} />;
  return <Home go={setMode} />;
}

/* ───────── 첫 화면 ───────── */
function Home({ go }) {
  const words = useWords();
  const cards = useData('words');
  const prefs = usePrefs();
  const today = todayStr();
  const nNew = newToday(cards, today);
  const q = queue(idsInOrder(words, cards), cards, today, Math.max(0, prefs.newToday - nNew));
  const m = maturity(words.map((w) => w.id), cards);
  const total = words.length;
  const dd = diffDays(today, EXAM_DATE);
  const left = q.due.length + q.fresh.length;
  const ownN = words.filter((w) => w.set === '교재').length;
  // 이 속도면 언제 다 보나 · 시험 7일 전까지 다 한 번씩 보려면 하루 몇 개 (마지막 일주일은 복습만)
  const daysNeed = Math.ceil(m.fresh / prefs.newPerDay);
  const pace = paceNeed(m.fresh, dd);
  const nWago = useMemo(() => words.filter((w) => noGuess(w) && !cards[w.id]?.skip).length, [words]); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <div className="page wd">
      <header className="wd-top">
        <h1 className="h1">단어</h1>
        <span className="wd-dd num">{dd > 0 ? `시험까지 D-${dd}` : dd === 0 ? '오늘 시험!' : '시험 끝'}</span>
      </header>

      <section className="card wd-today">
        <div className="wd-today__nums">
          <div><b className="num wd-c-due">{q.due.length}</b><small>복습</small></div>
          <div><b className="num wd-c-new">{q.fresh.length}</b><small>새 단어</small></div>
          <div><b className="num">{nNew}</b><small>오늘 새로 본 것</small></div>
        </div>
        {left > 0 ? (
          <button type="button" className="btn btn--pri btn--big wd-start" onClick={() => go('cards')}>오늘 단어 시작 · {left}장</button>
        ) : (
          <div className="wd-clear">
            <b>오늘 몫 끝! 🎉</b>
            <p className="sub">더 하고 싶으면 10개씩 더 배울 수 있어요 (몇 번이든).{prefs.more ? ` 오늘 ${prefs.more}개 더 함.` : ''}</p>
            <button type="button" className="btn btn--pri btn--big wd-start" onClick={() => { addMore(prefs, 10); go('cards'); }}>새 단어 10개 더 배우기</button>
          </div>
        )}
        <div className="row">
          <button type="button" className="btn" onClick={() => go('sort')}>아는 단어 빠르게 거르기</button>
          <button type="button" className="btn" onClick={() => go('quiz')}>한자 읽기 퀴즈 10문제</button>
          <button type="button" className="btn" onClick={() => go('n1')}>N1 모양 문제 10개</button>
        </div>
        <div className="row">
          <button type="button" className="btn" onClick={() => go('kanji')}>부수로 한자 보기</button>
          <button type="button" className="btn" onClick={() => go('onkun')}>음독·훈독 연습</button>
        </div>
        <div className="row">
          <button type="button" className="btn" onClick={() => go('wago')} title="훈독 말·히라가나 말·가타카나 말만 (N2·N1)">한자로 못 맞히는 말 · {nWago}개</button>
          <button type="button" className="btn" onClick={() => go('pairs')} title="배운 단어 가운데 뜻이 겹치거나 헷갈렸던 짝">비슷한 말 구별</button>
        </div>
        {prefs.order !== 'kanji' && (
          <p className="sub wd-note">팁: 새 단어 순서를 '아는 한자부터'로 바꾸면 N3에서 본 한자로 된 N2·N1 단어가 먼저 나와요. 한국 한자음으로 소리를 짐작할 수 있어 덜 낯설어요.</p>
        )}
      </section>

      <ReviewPlan cards={cards} prefs={prefs} onCap={(n) => setPrefs({ revCap: n })} go={go} />

      <Levels prefs={prefs} cards={cards} />

      <section className="card">
        <div className="wd-hd"><b>익힌 정도</b><small className="num">{total}개 중 {m.known}개 익힘</small></div>
        <div className="bar wd-bar" aria-label={`익힘 ${m.known}, 배우는 중 ${m.learn}, 아직 안 본 것 ${m.fresh}`}>
          <i style={{ width: `${(m.known / total) * 100}%`, background: 'var(--grn)' }} />
          <i style={{ width: `${(m.learn / total) * 100}%`, background: 'var(--org)' }} />
        </div>
        <div className="wd-leg">
          <span><i style={{ background: 'var(--grn)' }} />익힘 {m.known}</span>
          <span><i style={{ background: 'var(--org)' }} />배우는 중 {m.learn}</span>
          <span><i style={{ background: 'var(--cell)' }} />안 본 것 {m.fresh}</span>
        </div>
        {m.fresh > 0 && dd > 0 && (
          <div className={`wd-pace ${pace > prefs.newPerDay ? 'is-short' : ''}`}>
            <p className="sub">
              하루 {prefs.newPerDay}개씩이면 {daysNeed}일 뒤에 모두 한 번씩 봐요.
              {pace > prefs.newPerDay
                ? <> 시험 1주 전까지 남은 <b className="num">{m.fresh}</b>개를 다 보려면 <b className="num">하루 {pace}개</b>가 필요해요. 아는 단어는 '빠르게 거르기'로 넘기면 줄어요.</>
                : ' 시험 1주 전까지 다 볼 수 있는 속도예요.'}
            </p>
            {pace > prefs.newPerDay && <button type="button" className="btn btn--pri" onClick={() => setPrefs({ newPerDay: pace })}>하루 {pace}개로 맞추기</button>}
          </div>
        )}
        <div className="row">
          <span className="sub">하루 새 단어</span>
          <span className="seg">
            {NEW_OPTS.map((n) => <button key={n} type="button" aria-pressed={prefs.newPerDay === n} onClick={() => setPrefs({ newPerDay: n })}>{n}</button>)}
            {!NEW_OPTS.includes(prefs.newPerDay) && <button type="button" aria-pressed>{prefs.newPerDay}</button>}
          </span>
        </div>
        <div className="row">
          <span className="sub">새 단어 순서</span>
          <span className="seg">
            {ORDERS.map((o) => <button key={o.k} type="button" aria-pressed={prefs.order === o.k} onClick={() => setPrefs({ order: o.k })}>{o.label}</button>)}
          </span>
        </div>
        <div className="row">
          <span className="sub">복습 때 읽기 치기</span>
          <span className="seg">
            <button type="button" aria-pressed={prefs.readMode !== 'all'} onClick={() => setPrefs({ readMode: 'smart' })}>필요할 때만</button>
            <button type="button" aria-pressed={prefs.readMode === 'all'} onClick={() => setPrefs({ readMode: 'all' })}>매번</button>
          </span>
        </div>
        <p className="sub wd-note">맞히면 바로 다음 장으로 넘어가고, 빨리 맞힌 단어는 다음 복습이 더 늦게 와요. '필요할 때만'은 배우는 중·읽기를 틀린 적 있는 단어와 세 번에 한 번만 읽기를 쳐요.</p>
      </section>

      <section className="card">
        <div className="wd-hd"><b>교재 단어</b><small>{ownN ? `${ownN}개 넣음 · 먼저 나와요` : '아직 없음'}</small></div>
        <p className="sub">교재 단어 목록을 붙여 넣으면 카드로 만들어져요. 교재 사진을 대화창에 보내 주면 붙여 넣을 글로 바꿔 드려요.</p>
        <div className="row">
          <button type="button" className="btn" onClick={() => go('add')}>교재 단어 넣기</button>
          <button type="button" className="btn" onClick={() => go('list')}>단어장 보기</button>
        </div>
      </section>
    </div>
  );
}

/* ───────── 급수 고르기 ───────── */
function Levels({ prefs, cards }) {
  const toggle = (lv) => {
    const on = prefs.levels.includes(lv);
    if (on && prefs.levels.length === 1) return;
    setPrefs({ levels: LEVELS.filter((l) => (l === lv ? !on : prefs.levels.includes(l))) });
  };
  return (
    <section className="card">
      <div className="wd-hd"><b>공부할 급수</b><small>고른 급수만 새 단어로 나와요</small></div>
      <div className="wd-lvs">
        {LEVELS.map((lv) => {
          const ids = BASE.filter((x) => x.lv === lv).map((x) => x.id);
          const m = maturity(ids, cards);
          const on = prefs.levels.includes(lv);
          return (
            <button key={lv} type="button" className={`wd-lv ${on ? 'is-on' : ''}`} aria-pressed={on} onClick={() => toggle(lv)}>
              <span className="wd-lv__t"><b>{lv}</b><span className="wd-lv__chk" aria-hidden="true">{on ? '✓' : ''}</span></span>
              <small className="num">{ids.length}개 · 익힘 {m.known}</small>
              <span className="bar"><i style={{ width: `${(m.known / Math.max(1, ids.length)) * 100}%`, background: 'var(--grn)' }} /><i style={{ width: `${(m.learn / Math.max(1, ids.length)) * 100}%`, background: 'var(--org)' }} /></span>
            </button>
          );
        })}
      </div>
    </section>
  );
}

/* ───────── 오늘 단어 · N1 모양 문제 (Learn.jsx · N1Quiz.jsx) ───────── */
function StudyRoute({ onDone }) {
  const words = useWords();
  const pool = useWords(true);
  const prefs = usePrefs();
  return <Study words={words} pool={pool} newPerDay={prefs.newToday} revCap={capOf(prefs)} autoSpeak={prefs.autoSpeak} readMode={prefs.readMode} onDone={onDone} onMore={(n) => addMore(prefs, n)} />;
}
function N1Route({ onDone }) {
  const pool = useWords(true);
  return <N1Quiz pool={pool} onDone={onDone} />;
}
function KanjiRoute({ start, onDone }) {
  const pool = useWords(true);
  return <KanjiStudy pool={pool} start={start} onDone={onDone} />;
}
function PairsRoute({ onDone }) {
  const pool = useWords(true);
  return <PairDrill pool={pool} onDone={onDone} />;
}
// 한자로 못 맞히는 말만 '오늘 단어' 처럼 (복습도 이 말들만). 이번에 새 단어 20개까지 더
function WagoRoute({ onDone }) {
  const words = useWords();
  const all = useWords(true);
  const prefs = usePrefs();
  const cards = useData('words');
  const list = useMemo(() => words.filter(noGuess), [words]);
  const pool = useMemo(() => all.filter(noGuess), [all]);
  const [limit, setLimit] = useState(() => newToday(cards, todayStr()) + 20);
  return <Study words={list} pool={pool} newPerDay={limit} revCap={capOf(prefs)} autoSpeak={prefs.autoSpeak} readMode={prefs.readMode} onDone={onDone} onMore={(n) => setLimit((x) => x + n)} />;
}
function LeechRoute({ onDone }) {
  const pool = useWords(true);
  return <LeechStudy pool={pool} onDone={onDone} />;
}

/* ───────── 아는 단어 빠르게 거르기 ─────────
 아직 안 본 단어를 한 장씩: 알아요 → 다시 안 나옴(skip) · 몰라요 → 새 단어 줄 맨 앞(pri). 뜻은 누른 뒤 아래에 잠깐 */
const SORT_N = 50;
function Sort({ onDone }) {
  const words = useWords();
  const cards = useData('words');
  const today = todayStr();
  // 거르기는 순서 설정과 상관없이 쉬운 급수부터 (아는 단어가 많을수록 빨리 줄어듦)
  const [list] = useState(() => LEVELS.flatMap((lv) => unsorted(words, cards).filter((w) => w.lv === lv || (lv === 'N3' && w.lv === '교재'))).slice(0, SORT_N));
  const [pos, setPos] = useState(0);
  const [hist, setHist] = useState([]); // [{ w, known }]
  const timer = useRef(null);
  useEffect(() => {
    timer.current = startTimer('vocab', '아는 단어 거르기');
    return () => timer.current?.finish();
  }, []);
  const w = list[pos];
  // k: know 알아요(다시 안 나옴) · mean 뜻만 알아요(내일부터 읽기 복습) · no 몰라요(새 단어 줄 맨 앞)
  const canMean = w && askReading(w);
  const pick = (k) => {
    if (!w || (k === 'mean' && !canMean)) return;
    if (k === 'know') save('words', w.id, () => ({ skip: 1, t: today, d: '9999-12-31', i: 999, f: today }));
    else if (k === 'mean') save('words', w.id, () => meaningOnly(today));
    else save('words', w.id, { pri: 1 });
    timer.current?.add({ n: 1, ok: k === 'no' ? 0 : 1, learned: k === 'know' ? 1 : 0 });
    setHist((h) => [...h, { w, k }]);
    setPos((p) => p + 1);
  };
  const undo = () => {
    const last = hist.at(-1);
    if (!last) return;
    remove('words', last.w.id);
    setHist((h) => h.slice(0, -1));
    setPos((p) => p - 1);
  };
  useEffect(() => {
    const key = (e) => {
      if (e.key === 'ArrowLeft' || e.key === '1') pick('know');
      else if (e.key === 'ArrowDown' || e.key === '2') pick('mean');
      else if (e.key === 'ArrowRight' || e.key === '3') pick('no');
      else if (e.key === 'Backspace' || (e.key === 'z' && (e.metaKey || e.ctrlKey))) undo();
      else if (e.key === 'Escape') onDone();
    };
    window.addEventListener('keydown', key);
    return () => window.removeEventListener('keydown', key);
  });
  const cnt = (k) => hist.filter((h) => h.k === k).length;
  const SORT_LABEL = { know: '알아요', mean: '뜻만 알아요', no: '몰라요' };
  const last = hist.at(-1);
  if (!w) {
    return (
      <div className="page wd">
        <section className="card wd-end">
          <b className="wd-end__t">{hist.length}개 걸렀어요</b>
          <div className="wd-today__nums">
            <div><b className="num wd-c-due">{cnt('know')}</b><small>알아요 · 다시 안 나옴</small></div>
            <div><b className="num">{cnt('mean')}</b><small>뜻만 알아요 · 내일부터 읽기 복습</small></div>
            <div><b className="num wd-c-new">{cnt('no')}</b><small>몰라요 · 새 단어로 먼저</small></div>
          </div>
          <div className="row">
            {unsorted(words, cards).length > 0 && <button type="button" className="btn btn--pri" onClick={() => onDone('sort')}>{SORT_N}개 더</button>}
            <button type="button" className="btn" onClick={() => onDone()}>처음으로</button>
          </div>
        </section>
      </div>
    );
  }
  return (
    <div className="page wd wd-sess">
      <header className="wd-sess__top">
        <button type="button" className="btn" onClick={() => onDone()} aria-label="그만하기">✕</button>
        <div className="bar wd-sess__bar"><i style={{ width: `${(pos / list.length) * 100}%`, background: 'var(--blu)' }} /></div>
        <span className="num sub">{pos + 1}/{list.length}</span>
      </header>
      <div className="card wd-card wd-sort">
        <div className="wd-card__tag"><span className="wd-pill">{w.lv}</span></div>
        <div className="wd-card__w" lang="ja">{w.w}</div>
        <p className="sub">뜻과 읽기를 바로 떠올릴 수 있으면 '알아요', 뜻은 아는데 읽는 법이 헷갈리면 '뜻만 알아요'</p>
      </div>
      <div className="wd-sort__last" aria-live="polite">
        {last ? (
          <>
            <span className={last.k === 'know' ? 'wd-ok' : last.k === 'mean' ? 'wd-mid' : 'wd-ng'}>{SORT_LABEL[last.k]}</span>
            <b lang="ja">{last.w.w}</b><span lang="ja" className="sub">{last.w.r}</span><span className="wd-sort__m">{last.w.m}</span>
            <button type="button" className="wd-x" onClick={undo}>되돌리기</button>
          </>
        ) : <span className="sub">누른 단어의 뜻이 여기 나와요. 틀렸으면 되돌리기</span>}
      </div>
      <div className="wd-grades wd-sort__btns">
        <button type="button" className="wd-g wd-g--3" onClick={() => pick('know')}><b>알아요</b><kbd>1</kbd></button>
        <button type="button" className="wd-g wd-g--2" onClick={() => pick('mean')} disabled={!canMean} title={canMean ? '' : '한자 없는 단어라 읽기 복습이 없어요'}><b>뜻만 알아요</b><small>읽는 법 모름</small><kbd>2</kbd></button>
        <button type="button" className="wd-g wd-g--1" onClick={() => pick('no')}><b>몰라요</b><kbd>3</kbd></button>
      </div>
    </div>
  );
}

/* ───────── 한자 읽기 퀴즈 ───────── */
function Quiz({ onDone }) {
  const words = useWords();
  const cards = useData('words');
  const today = todayStr();
  const [list] = useState(() => {
    const pick = quizPick(words.filter(yomiOk), cards, 10);
    return pick.map((w) => ({ w, choices: yomiChoices(w, words) }));
  });
  const [pos, setPos] = useState(0);
  const [mine, setMine] = useState(null);
  const [wrong, setWrong] = useState([]);
  const timer = useRef(null);
  useEffect(() => {
    timer.current = startTimer('vocab', '한자 읽기 퀴즈');
    return () => timer.current?.finish();
  }, []);
  const it = list[pos];

  const choose = (c) => {
    if (mine) return;
    setMine(c);
    const ok = c === it.w.r;
    timer.current?.add({ n: 1, ok: ok ? 1 : 0 });
    if (!ok) {
      setWrong((x) => [...x, it.w]);
      // 틀린 단어는 오늘 카드에 다시 (본 적 없으면 새 카드로 둠)
      const c0 = cards[it.w.id];
      if (c0?.t && !c0.skip) save('words', it.w.id, { ...c0, d: today, i: Math.min(c0.i || 0, 1), l: (c0.l || 0) + 1 });
      else if (c0?.skip) remove('words', it.w.id);
    }
  };
  const next = () => {
    setMine(null);
    setPos((p) => p + 1);
  };
  useEffect(() => {
    const key = (e) => {
      if (!it) return;
      if (!mine && /^[1-4]$/.test(e.key)) choose(it.choices[+e.key - 1].r);
      else if (mine && (e.key === 'Enter' || e.key === ' ')) {
        e.preventDefault();
        next();
      }
    };
    window.addEventListener('keydown', key);
    return () => window.removeEventListener('keydown', key);
  });

  if (!list.length) {
    return <div className="page wd"><section className="card"><p className="sub">퀴즈를 낼 한자 단어가 아직 없어요.</p><button type="button" className="btn" onClick={onDone}>돌아가기</button></section></div>;
  }
  if (!it) {
    const ok = list.length - wrong.length;
    return (
      <div className="page wd">
        <section className="card wd-end">
          <b className="wd-end__t">{ok} / {list.length}</b>
          {wrong.length > 0 ? (
            <>
              <p className="sub">틀린 단어는 오늘 카드에 다시 넣었어요.</p>
              <ul className="wd-wrong">{wrong.map((w) => <li key={w.id}><b lang="ja">{w.w}</b><span lang="ja">{w.r}</span><small>{w.m}</small></li>)}</ul>
            </>
          ) : <p className="sub">전부 맞혔어요!</p>}
          <div className="row"><button type="button" className="btn btn--pri" onClick={onDone}>처음으로</button></div>
        </section>
      </div>
    );
  }
  const ok = mine && mine === it.w.r;
  return (
    <div className="page wd wd-sess">
      <header className="wd-sess__top">
        <button type="button" className="btn" onClick={onDone} aria-label="그만하기">✕</button>
        <div className="bar wd-sess__bar"><i style={{ width: `${(pos / list.length) * 100}%`, background: 'var(--blu)' }} /></div>
        <span className="num sub">{pos + 1}/{list.length}</span>
      </header>
      <div className="card wd-card is-open">
        <div className="ln-n1__p"><span lang="ja">＿＿＿の言葉の読み方として最もよいもの</span><small className="sub">시험 問題1 · 장음·촉음·탁음 함정에 주의</small></div>
        {it.w.ex && splitExample(it.w.ex, it.w.w)[1] ? (
          <p className="wd-q" lang="ja">{splitExample(it.w.ex, it.w.w)[0]}<u>{splitExample(it.w.ex, it.w.w)[1]}</u>{splitExample(it.w.ex, it.w.w)[2]}</p>
        ) : <div className="wd-card__w" lang="ja"><u>{it.w.w}</u></div>}
        <div className="wd-choices">
          {it.choices.map(({ r: c, traps }, i) => (
            <button key={c} type="button" lang="ja" className={`wd-ch ${mine ? (c === it.w.r ? 'is-right' : c === mine ? 'is-wrong' : '') : ''}`} onClick={() => choose(c)} disabled={!!mine && c !== mine && c !== it.w.r}>
              <span className="num">{i + 1}</span>{c}
              {mine && traps.length > 0 && <small className="wd-trap" lang="ko">{trapText({ traps })}</small>}
            </button>
          ))}
        </div>
        {mine && (
          <div className="wd-fb">
            <b className={ok ? 'wd-ok' : 'wd-ng'}>{ok ? '맞았어요' : '아쉬워요'}</b>
            <span><b lang="ja">{it.w.w}</b> <span lang="ja">（{it.w.r}）</span> {it.w.m}</span>
          </div>
        )}
      </div>
      {mine && <div className="wd-grades wd-grades--front"><button type="button" className="btn btn--pri btn--big" onClick={next}>다음</button></div>}
    </div>
  );
}

/* ───────── 교재 단어 넣기 ───────── */
function AddWords({ onDone }) {
  const [text, setText] = useState('');
  const [src, setSrc] = useState('');
  const { ok, bad } = useMemo(() => parsePaste(text), [text]);
  const add = () => {
    const now = Date.now();
    const map = {};
    ok.forEach((x, i) => {
      map[x.id] = { w: x.w, r: x.r, m: x.m, ex: x.ex, k: x.k, src: src.trim(), at: now + i };
    });
    saveMany('own', map);
    setText('');
    onDone();
  };
  return (
    <div className="page wd">
      <header className="wd-top"><button type="button" className="btn" onClick={onDone}>‹ 단어</button><h1 className="h1">교재 단어 넣기</h1></header>
      <section className="card">
        <p className="sub">한 줄에 단어 하나씩. <b>단어 · 읽기 · 뜻</b> 순서면 돼요 (예문 · 예문 뜻은 있으면 뒤에). 칸은 탭, |, 쉼표, 띄어쓰기 아무거나.</p>
        <pre className="wd-eg" lang="ja">{'赴く	おもむく	향하다\n培う（つちかう）기르다\n営む | いとなむ | 경영하다 | 旅館を営む。 | 여관을 경영한다.'}</pre>
        <label className="field">어디서 (선택) <input value={src} onChange={(e) => setSrc(e.target.value)} placeholder="예: 1과 · p.23" /></label>
        <label className="field">단어 목록 <textarea value={text} onChange={(e) => setText(e.target.value)} lang="ja" placeholder="여기에 붙여 넣기" /></label>
        {text && <p className="sub">읽은 단어 <b className="num">{ok.length}</b>개{bad.length ? ` · 못 읽은 줄 ${bad.length}개 (읽기는 히라가나로)` : ''}</p>}
        {bad.length > 0 && <ul className="wd-bad">{bad.slice(0, 5).map((b, i) => <li key={i} lang="ja">{b}</li>)}</ul>}
        {ok.length > 0 && (
          <ul className="wd-wrong">{ok.slice(0, 6).map((x) => <li key={x.id}><b lang="ja">{x.w}</b><span lang="ja">{x.r}</span><small>{x.m}</small></li>)}{ok.length > 6 && <li className="sub">그 밖에 {ok.length - 6}개</li>}</ul>
        )}
        <button type="button" className="btn btn--pri" disabled={!ok.length} onClick={add}>{ok.length || ''}개 넣기</button>
      </section>
    </div>
  );
}

/* ───────── 단어장 ───────── */
const STATE_LABEL = (c) => (!c?.t ? ['안 봄', ''] : c.skip ? ['알아요', 'known'] : c.i >= 7 ? ['익힘', 'known'] : ['배우는 중', 'learn']);

function WordList({ onDone }) {
  const words = useWords(true);
  const cards = useData('words');
  const [q, setQ] = useState('');
  const [f, setF] = useState('all');
  const list = useMemo(() => {
    const s = q.trim();
    return words.filter((w) => {
      if (s && !(w.w.includes(s) || w.r.includes(s) || w.m.includes(s))) return false;
      const c = cards[w.id];
      if (f === 'hard') return (c?.l || 0) >= 2;
      if (f === 'own') return w.set === '교재';
      if (LEVELS.includes(f)) return w.lv === f;
      if (f === 'learn') return c?.t && !c.skip && c.i < 7;
      return true;
    });
  }, [words, cards, q, f]);
  const [n, setN] = useState(80);
  return (
    <div className="page wd">
      <header className="wd-top"><button type="button" className="btn" onClick={onDone}>‹ 단어</button><h1 className="h1">단어장</h1></header>
      <section className="card">
        <label className="field"><input value={q} onChange={(e) => setQ(e.target.value)} placeholder="찾기 (한자 · 읽기 · 뜻)" /></label>
        <span className="seg">
          {[['all', '전체'], ...LEVELS.map((l) => [l, l]), ['learn', '배우는 중'], ['hard', '자주 틀림'], ['own', '교재']].map(([k, l]) => <button key={k} type="button" aria-pressed={f === k} onClick={() => setF(k)}>{l}</button>)}
        </span>
        <p className="sub num">{list.length}개</p>
        <ul className="wd-list">
          {list.slice(0, n).map((w) => {
            const c = cards[w.id];
            const [lab, cls] = STATE_LABEL(c);
            return (
              <li key={w.id}>
                <b lang="ja">{w.w}</b>
                <span lang="ja" className="sub">{hasKanji(w.w) ? w.r : ''} <em className="wd-lvtag">{w.lv}</em></span>
                <span className="wd-list__m">{w.m}</span>
                <span className={`wd-pill ${cls ? `wd-pill--${cls}` : ''}`}>{lab}{c?.l ? ` · 틀림 ${c.l}` : ''}</span>
                {w.set === '교재' && <button type="button" className="wd-x" aria-label={`${w.w} 지우기`} onClick={() => { remove('own', w.id); remove('words', w.id); }}>지우기</button>}
                {c?.skip && <button type="button" className="wd-x" onClick={() => remove('words', w.id)}>다시 배우기</button>}
              </li>
            );
          })}
        </ul>
        {list.length > n && <button type="button" className="btn" onClick={() => setN(n + 200)}>더 보기</button>}
      </section>
    </div>
  );
}
