// 오늘 단어: 복습(읽기 입력 + 뜻 고르기 → 몰랐음/알았음) → 새 단어 5개씩 배우기 → 바로 퀴즈 → 10분 뒤 한 번 더
import { useEffect, useMemo, useRef, useState } from 'react';
import { save, useData } from '../../lib/store';
import { EXAM_DATE } from '../../lib/srs';
import { todayStr } from '../../lib/dates';
import { hasJa, speak } from '../../lib/speak';
import { startTimer } from '../../lib/studylog';
import { isKatakana, newToday, splitExample } from './words';
import { BATCH, answer, askReading, clean, finishKana, learned, meaningChoices, newIds, reviewIds, sameReading, toKana, waitingInfo } from './learn';
import { kanjiIndex, kanjiInfo, kanjiOf, onHint, siblings } from './hanja';
import './learn.css';

const shuffle = (a) => {
  const x = [...a];
  for (let i = x.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [x[i], x[j]] = [x[j], x[i]];
  }
  return x;
};

/* ───────── 단어 정보 조각 ───────── */
export function Ex({ ex, w }) {
  const [a, b, c] = splitExample(ex, w);
  return <>{a}{b && <mark>{b}</mark>}{c}</>;
}

// 한자 하나씩: 字 · 한국 음 · 훈 (옛 글자) · 받침 규칙
export function KanjiParts({ w, hints }) {
  const ks = kanjiOf(w);
  if (!ks.length || isKatakana(w)) return null;
  return (
    <div className="ln-kj">
      {ks.map((ch) => {
        const k = kanjiInfo(ch);
        return (
          <div key={ch} className="ln-kj__c">
            <b lang="ja">{ch}</b>
            {k.kokuji ? (
              <small>일본에서 만든 한자</small>
            ) : (
              <>
                <span className="ln-kj__ko">{k.ko}</span>
                <small>{k.hun}{k.old && <> · <span lang="ja">{k.old}</span></>}</small>
                {hints && onHint(k.ko) && <em>{onHint(k.ko)}</em>}
              </>
            )}
          </div>
        );
      })}
    </div>
  );
}

// 같은 한자를 쓰는 다른 단어 (본 단어는 ✓)
export function Siblings({ word, idx, cards }) {
  const sib = useMemo(() => siblings(word, idx, cards, 3), [word, idx, cards]);
  if (!sib.length) return null;
  return (
    <div className="ln-sib">
      <small className="sub">같은 한자 단어</small>
      <ul>
        {sib.flatMap((g) =>
          g.words.map((x) => (
            <li key={`${g.ch}${x.id}`} className={x.known ? 'is-known' : ''}>
              <b lang="ja">{x.w}</b>
              <span lang="ja" className="sub">{x.r}</span>
              <span className="ln-sib__m">{x.m}</span>
              {x.known && <i aria-label="본 단어">✓</i>}
            </li>
          )),
        )}
      </ul>
    </div>
  );
}

function Say({ w }) {
  if (!hasJa()) return null;
  return (
    <div className="row ln-say">
      <button type="button" className="btn" onClick={() => speak(w.r)}>🔊 단어</button>
      {w.ex && <button type="button" className="btn" onClick={() => speak(w.ex)}>🔊 예문</button>}
      {w.ex && <button type="button" className="btn" onClick={() => speak(w.ex, 0.7)}>천천히</button>}
    </div>
  );
}

// 단어 전체 (배우기 화면 · 답 확인)
export function WordInfo({ w, idx, cards, big }) {
  return (
    <div className={`ln-info ${big ? 'is-big' : ''}`}>
      <div className="ln-info__w" lang="ja">{w.w}</div>
      {!isKatakana(w.w) && w.r !== w.w && <div className="ln-info__r" lang="ja">{w.r}</div>}
      <div className="ln-info__m">{w.m}{w.en && <span className="wd-pill wd-en" title="한국어 뜻을 아직 못 넣은 단어예요">영어 뜻</span>}</div>
      <KanjiParts w={w.w} hints={big} />
      {w.ex && (
        <div className="ln-info__ex">
          <p lang="ja"><Ex ex={w.ex} w={w.w} /></p>
          {w.k && <p className="sub">{w.k}</p>}
        </div>
      )}
      <Say w={w} />
      <Siblings word={w} idx={idx} cards={cards} />
    </div>
  );
}

/* ───────── 확인: 읽기 입력 → 뜻 고르기 ───────── */
function useKeys(fn) {
  const ref = useRef(fn);
  ref.current = fn;
  useEffect(() => {
    const k = (e) => ref.current(e);
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  }, []);
}

// onDone(ok) — ok: 읽기·뜻 둘 다 맞힘. review 면 마지막에 몰랐음/알았음 버튼
function Check({ w, pool, idx, cards, review, onDone, onExit }) {
  const steps = useMemo(() => [...(askReading(w) ? ['read'] : []), 'mean'], [w]);
  const [si, setSi] = useState(0);
  const [typed, setTyped] = useState('');
  const [res, setRes] = useState({}); // { read: true/false, mean: true/false }
  const [picked, setPicked] = useState(null);
  const choices = useMemo(() => meaningChoices(w, pool), [w, pool]);
  const step = steps[si] || 'done';
  const judged = res[step] !== undefined;
  const ok = steps.every((s) => res[s]);
  const autoSaid = useRef(false);

  const judgeRead = (giveUp) => {
    if (judged || (!giveUp && !typed.trim())) return; // 빈 칸 Enter 는 무시
    const r = !giveUp && sameReading(typed, w.r);
    if (!giveUp) setTyped(finishKana(typed));
    setRes((x) => ({ ...x, read: r }));
    if (hasJa()) speak(w.r);
    autoSaid.current = true;
  };
  const pick = (m) => {
    if (judged) return;
    setPicked(m);
    setRes((x) => ({ ...x, mean: m === w.m }));
    if (!autoSaid.current && hasJa()) speak(w.r);
  };
  const next = () => {
    if (!judged) return;
    if (si + 1 < steps.length) setSi(si + 1);
    else if (review) setSi(steps.length);
    else onDone(ok);
  };

  useKeys((e) => {
    if (e.key === 'Escape') return onExit();
    const inInput = e.target.closest?.('input');
    if (step === 'done') {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        onDone(ok);
      } else if (e.key === '1') onDone(false);
      else if (e.key === '2') onDone(true);
      return;
    }
    if (step === 'mean' && !judged && /^[1-4]$/.test(e.key)) return pick(choices[+e.key - 1]);
    if (e.key === 'Enter' && !(inInput && !judged)) {
      e.preventDefault();
      next();
    }
  });

  return (
    <>
      <div className="card ln-q">
        {step === 'read' && (
          <>
            <small className="sub">읽는 법을 히라가나로 (로마자로 쳐도 바뀌어요)</small>
            <div className="ln-q__w" lang="ja">{w.w}</div>
            <form className="ln-read" onSubmit={(e) => { e.preventDefault(); judgeRead(false); }}>
              <input
                id="ln-read"
                lang="ja"
                autoFocus
                autoComplete="off"
                autoCapitalize="off"
                autoCorrect="off"
                spellCheck={false}
                enterKeyHint="done"
                value={typed}
                readOnly={judged}
                onChange={(e) => setTyped(toKana(e.target.value))}
                className={judged ? (res.read ? 'is-right' : 'is-wrong') : ''}
                placeholder="よみかた"
                aria-label="읽는 법"
              />
              {!judged && <button type="button" className="btn" onClick={() => judgeRead(true)}>모르겠어요</button>}
            </form>
            {judged && (
              <div className="ln-fb">
                <b className={res.read ? 'wd-ok' : 'wd-ng'}>{res.read ? '맞았어요' : <>정답 <span lang="ja">{w.r}</span></>}</b>
                {!res.read && <KanjiParts w={w.w} hints />}
              </div>
            )}
          </>
        )}
        {step === 'mean' && (
          <>
            <small className="sub">뜻으로 알맞은 것은?</small>
            <div className="ln-q__w" lang="ja">{w.w}</div>
            {res.read !== undefined && <div className="ln-q__r" lang="ja">{w.r}</div>}
            <div className="wd-choices">
              {choices.map((c, i) => (
                <button key={c} type="button" className={`wd-ch ${judged ? (c === w.m ? 'is-right' : c === picked ? 'is-wrong' : '') : ''}`} onClick={() => pick(c)} disabled={judged && c !== picked && c !== w.m}>
                  <span className="num">{i + 1}</span>{c}
                </button>
              ))}
            </div>
            {!judged && <button type="button" className="btn ln-idk" onClick={() => pick(null)}>모르겠어요</button>}
          </>
        )}
        {step === 'done' && <WordInfo w={w} idx={idx} cards={cards} />}
      </div>
      {step === 'done' ? (
        <div className="ln-two">
          <button type="button" className={`ln-g ln-g--ng ${!ok ? 'is-auto' : ''}`} onClick={() => onDone(false)}>
            <b>몰랐음</b><small>10분 뒤 다시</small><kbd>1</kbd>
          </button>
          <button type="button" className={`ln-g ln-g--ok ${ok ? 'is-auto' : ''}`} onClick={() => onDone(true)}>
            <b>알았음</b><small>{ok ? '둘 다 맞힘' : '실수였어요'}</small><kbd>2</kbd>
          </button>
        </div>
      ) : (
        judged && (
          <div className="wd-grades wd-grades--front">
            <button type="button" className="btn btn--pri btn--big" onClick={next}>다음 <kbd>Enter</kbd></button>
          </div>
        )
      )}
    </>
  );
}

/* ───────── 오늘 단어 ───────── */
export function Study({ words, pool, newPerDay, autoSpeak, onDone, onMore }) {
  const cards = useData('words');
  const cardsRef = useRef(cards);
  cardsRef.current = cards;
  const today = todayStr();
  const ids = useMemo(() => pool.map((w) => w.id), [pool]); // 복습은 고른 급수 밖의 단어도
  const byId = useMemo(() => Object.fromEntries(pool.map((w) => [w.id, w])), [pool]);
  const idx = useMemo(() => kanjiIndex(pool), [pool]);

  // phase: review 복습 · intro 새 단어 보기 · quiz 새 단어 퀴즈 · end
  const [st, setSt] = useState(() => ({ phase: 'review', list: reviewIds(ids, cards, today, Date.now()), pos: 0, batch: [], key: 0 }));
  const [stat, setStat] = useState({ rev: 0, ok: 0, fresh: 0, known: 0 });
  const timer = useRef(null);
  useEffect(() => {
    timer.current = startTimer('vocab', '단어 공부');
    return () => timer.current?.finish();
  }, []);

  // 다음 할 것: 시각이 된 배우는 중 카드 → 새 단어 5개 → 끝
  //  · just = 방금 저장한 카드 { id: 상태 } (화면의 cards 는 다음 그리기 때 바뀌므로)
  const advance = (just = {}) => {
    const c = { ...cardsRef.current, ...just };
    const now = Date.now();
    const rev = reviewIds(ids, c, today, now);
    if (rev.length) return setSt((s) => ({ phase: 'review', list: rev, pos: 0, batch: [], key: s.key + 1 }));
    const left = Math.max(0, newPerDay - newToday(c, today));
    const batch = newIds(words, c, Math.min(BATCH, left));
    if (batch.length) return setSt((s) => ({ phase: 'intro', list: batch, pos: 0, batch, key: s.key + 1 }));
    setSt((s) => ({ ...s, phase: 'end', key: s.key + 1 }));
  };
  useEffect(() => {
    if (st.phase === 'review' && !st.list.length) advance();
  }, [st]); // eslint-disable-line react-hooks/exhaustive-deps
  // '10개 더' 로 오늘 새 단어 수가 늘면 끝 화면에서 이어서
  useEffect(() => {
    if (st.phase === 'end') advance();
  }, [newPerDay]); // eslint-disable-line react-hooks/exhaustive-deps

  const id = st.list[st.pos];
  const w = byId[id];

  /* 복습 하나 끝 */
  const reviewed = (ok) => {
    const c = cardsRef.current[id];
    const next = clean(answer(c, ok, today, Date.now(), EXAM_DATE));
    save('words', id, () => next);
    const learnedNow = ok && next.i >= 7 && (c?.i || 0) < 7 ? 1 : 0;
    timer.current?.add({ n: 1, ok: ok ? 1 : 0, learned: learnedNow });
    setStat((s) => ({ ...s, rev: s.rev + 1, ok: s.ok + (ok ? 1 : 0) }));
    if (st.pos + 1 < st.list.length) setSt((s) => ({ ...s, pos: s.pos + 1 }));
    else advance({ [id]: next });
  };

  /* 새 단어 보기 */
  const introNext = () => {
    if (st.pos + 1 < st.list.length) setSt((s) => ({ ...s, pos: s.pos + 1 }));
    else setSt((s) => ({ ...s, phase: 'quiz', list: shuffle(s.batch), pos: 0, key: s.key + 1 }));
  };
  const knowIt = () => {
    const known = { skip: 1, t: today, d: '9999-12-31', i: 999, f: today };
    save('words', id, () => known);
    timer.current?.add({ n: 1, ok: 1, learned: 1 });
    setStat((s) => ({ ...s, known: s.known + 1 }));
    const batch = st.batch.filter((x) => x !== id);
    const list = st.list.filter((x) => x !== id);
    if (!list.length) return advance({ [id]: known });
    if (st.pos >= list.length) return setSt((s) => ({ ...s, phase: 'quiz', list: shuffle(batch), batch, pos: 0, key: s.key + 1 }));
    setSt((s) => ({ ...s, list, batch }));
  };
  useEffect(() => {
    if (st.phase === 'intro' && w && autoSpeak && hasJa()) speak(w.r);
  }, [st.phase, st.pos, w, autoSpeak]);
  useKeys((e) => {
    if (st.phase !== 'intro') return;
    if (e.key === 'Escape') onDone();
    else if (e.key === 'Enter' || e.key === ' ' || e.key === 'ArrowRight') {
      e.preventDefault();
      introNext();
    } else if (e.key === 'ArrowLeft' && st.pos > 0) setSt((s) => ({ ...s, pos: s.pos - 1 }));
  });

  /* 새 단어 퀴즈 하나 끝: 틀리면 줄 끝에 다시, 맞히면 배우는 중으로 저장 */
  const quizzed = (ok) => {
    timer.current?.add({ n: 1, ok: ok ? 1 : 0 });
    const just = {};
    if (ok) {
      just[id] = clean(learned(cardsRef.current[id], today, Date.now()));
      save('words', id, () => just[id]);
      setStat((s) => ({ ...s, fresh: s.fresh + 1 }));
    }
    const list = ok ? st.list : [...st.list, id];
    if (st.pos + 1 < list.length) setSt((s) => ({ ...s, list, pos: s.pos + 1 }));
    else advance(just);
  };

  const wait = waitingInfo(ids, cards, Date.now());
  const left = st.phase === 'review' ? st.list.length - st.pos : st.list.length - st.pos;

  if (st.phase === 'end' || !w) {
    if (st.phase !== 'end') return null;
    const mins = wait.n ? Math.max(1, Math.ceil((wait.next - Date.now()) / 60e3)) : 0;
    return (
      <div className="page wd">
        <section className="card wd-end">
          <b className="wd-end__t">오늘 몫 끝!</b>
          <div className="wd-today__nums">
            <div><b className="num wd-c-due">{stat.rev}</b><small>복습 · 알았음 {stat.ok}</small></div>
            <div><b className="num wd-c-new">{stat.fresh}</b><small>새로 배움</small></div>
            <div><b className="num">{stat.known}</b><small>이미 알아요</small></div>
          </div>
          {wait.n > 0 && <p className="sub">방금 배우거나 틀린 단어 {wait.n}개는 <b>{mins}분 뒤</b>에 한 번 더 나와요. 그때 다시 '오늘 단어'를 눌러 주세요.</p>}
          <div className="row">
            {onMore && <button type="button" className="btn btn--pri" onClick={() => onMore(10)}>새 단어 10개 더</button>}
            <button type="button" className={`btn ${onMore ? '' : 'btn--pri'}`} onClick={onDone}>처음으로</button>
          </div>
        </section>
      </div>
    );
  }

  const label = st.phase === 'review' ? (cards[id]?.ls ? '다시 확인' : '복습') : st.phase === 'intro' ? `새 단어 ${st.pos + 1}/${st.list.length}` : '방금 배운 것 확인';
  return (
    <div className="page wd wd-sess ln">
      <header className="wd-sess__top">
        <button type="button" className="btn" onClick={onDone} aria-label="그만하기">✕</button>
        <span className={`wd-pill ln-ph ln-ph--${st.phase}`}>{label}</span>
        <div className="bar wd-sess__bar"><i style={{ width: `${(st.pos / Math.max(1, st.list.length)) * 100}%`, background: st.phase === 'review' ? 'var(--grn)' : 'var(--blu)' }} /></div>
        <span className="num sub">{left}</span>
      </header>

      {st.phase === 'intro' ? (
        <>
          <div className="card ln-q">
            <div className="wd-card__tag"><span className="wd-pill wd-pill--new">새 단어</span><span className="wd-pill">{w.set === '교재' ? `교재${w.src ? ` · ${w.src}` : ''}` : w.lv}</span></div>
            <WordInfo w={w} idx={idx} cards={cards} big />
          </div>
          <div className="wd-grades wd-grades--front">
            <button type="button" className="btn btn--pri btn--big" onClick={introNext}>{st.pos + 1 < st.list.length ? '다음' : '퀴즈 풀기'} <kbd>Enter</kbd></button>
            <button type="button" className="btn btn--big" onClick={knowIt}>이미 알아요</button>
          </div>
        </>
      ) : (
        <Check key={`${st.key}-${st.pos}-${id}`} w={w} pool={pool} idx={idx} cards={cards} review={st.phase === 'review'} onDone={st.phase === 'review' ? reviewed : quizzed} onExit={onDone} />
      )}
    </div>
  );
}
