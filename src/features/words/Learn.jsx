// 오늘 단어: 복습(읽기 입력 + 뜻 고르기 → 몰랐음/알았음) → 새 단어 5개씩 배우기 → 바로 퀴즈 → 10분 뒤 한 번 더
import { useEffect, useMemo, useRef, useState } from 'react';
import { save, useData } from '../../lib/store';
import { EXAM_DATE } from '../../lib/srs';
import { todayStr } from '../../lib/dates';
import { hasJa, speak } from '../../lib/speak';
import { startTimer } from '../../lib/studylog';
import { isKatakana, newToday, splitExample } from './words';
import { BATCH, addConfused, answer, askReading, clean, finishKana, isFast, isLeech, learned, meaningChoices, needRead, newIds, reviewIds, sameReading, toKana, waitingInfo } from './learn';
import { KIND_KO, radicalOf, readingKind } from './kanji';
import { isLong, kanjiIndex, kanjiInfo, kanjiOf, longAt, longNote, onHint, readingParts, siblings, soundsOf } from './hanja';
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
// 읽기에서 장음(どう·せい·きゅう) 글자를 표시
export function LongKana({ text }) {
  const at = new Set(longAt(text));
  return <>{[...text].map((c, i) => (at.has(i) ? <mark key={i} className="ln-long">{c}</mark> : c))}</>;
}
// 단어 읽기를 한자마다 나눠서 (どう·ろ), 장음 표시
export function ReadingSplit({ w, r }) {
  const parts = readingParts(w, r);
  if (!parts) return <LongKana text={r} />;
  return (
    <>
      {parts.map((p, i) => (
        <span key={i} className={p.k ? 'ln-rp' : 'ln-rp ln-rp--kana'}>
          {i > 0 && p.k && parts[i - 1].k && <i className="ln-rp__dot">·</i>}
          <LongKana text={p.k ? p.r : p.kana} />
        </span>
      ))}
    </>
  );
}

// 한자 하나씩: 字 · 한국 음 · 훈 (옛 글자) · 이 단어에서 읽는 소리(장음 표시) · 한국 음 받침과 장음 규칙
export function KanjiParts({ w, r, hints }) {
  const ks = kanjiOf(w);
  if (!ks.length || isKatakana(w)) return null;
  const parts = r ? readingParts(w, r) : null;
  const here = new Map();
  for (const p of parts || []) if (p.k && !here.has(p.k)) here.set(p.k, p.r);
  return (
    <div className="ln-kj">
      {ks.map((ch) => {
        const k = kanjiInfo(ch);
        const part = here.get(ch);
        const note = part && !k.kokuji ? longNote(k.ko, part) : '';
        const others = hints && part ? soundsOf(ch, 3).filter((x) => x.r !== part).slice(0, 2) : [];
        return (
          <div key={ch} className="ln-kj__c">
            <b lang="ja">{ch}</b>
            {k.kokuji ? (
              <small>일본에서 만든 한자</small>
            ) : (
              <>
                <span className="ln-kj__ko">{k.ko}</span>
                <small>{k.hun}{k.old && <> · <span lang="ja">{k.old}</span></>}</small>
              </>
            )}
            {part && (
              <span className={`ln-kj__here ${isLong(part) ? 'is-long' : ''}`} lang="ja">
                <LongKana text={part} />
                <small lang="ko">{isLong(part) ? ' 길게' : ' 짧게'}</small>
                {readingKind(ch, part) && <i className={`kj-tag is-${readingKind(ch, part)}`} lang="ko">{KIND_KO[readingKind(ch, part)]}</i>}
              </span>
            )}
            {note ? <em className={note.includes('외워') ? 'is-warn' : ''}>{note}</em> : !part && hints && !k.kokuji && onHint(k.ko) && <em>{onHint(k.ko)}</em>}
            {hints && radicalOf(ch) && <small className="ln-kj__rad">부수 <span lang="ja">{radicalOf(ch).form}</span> {radicalOf(ch).formName || radicalOf(ch).name}</small>}
            {others.length > 0 && <small className="ln-kj__oth">다른 말에선 <span lang="ja">{others.map((x) => x.r).join(' · ')}</span></small>}
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
export function WordInfo({ w, idx, cards, big, memo = true }) {
  return (
    <div className={`ln-info ${big ? 'is-big' : ''}`}>
      <div className="ln-info__w" lang="ja">{w.w}</div>
      {!isKatakana(w.w) && w.r !== w.w && <div className="ln-info__r" lang="ja"><ReadingSplit w={w.w} r={w.r} /></div>}
      <div className="ln-info__m">{w.m}{w.en && <span className="wd-pill wd-en" title="한국어 뜻을 아직 못 넣은 단어예요">영어 뜻</span>}</div>
      <KanjiParts w={w.w} r={w.r} hints={big} />
      {memo && <Memo text={cards?.[w.id]?.mn} />}
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

// 나만의 기억 이야기 (안 외워지는 단어 화면에서 적음)
function Memo({ text }) {
  if (!text) return null;
  return <p className="ln-memo"><small>내 기억 이야기</small>{text}</p>;
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

// onDone(ok, info) — ok: 읽기·뜻 둘 다 맞힘, info: { fast 빨리 맞힘, read 읽기 결과(안 물었으면 undefined) }
//  · 맞히면 잠깐 보여 주고 저절로 다음 (Enter·알았음 안 눌러도 됨). 틀렸을 때만 멈춤 → review 면 단어 보기 + 몰랐음/알았음
//  · review 면 읽기는 needRead 일 때만 (readMode 'smart' · 'all')
const AUTO_MS = 650;
export function Check({ w, pool, idx, cards, review, readMode, autoSpeak, onDone, onExit, onConfuse }) {
  const steps = useMemo(() => [...((review ? needRead(w, cards?.[w.id], readMode) : askReading(w)) ? ['read'] : []), 'mean'], [w]); // eslint-disable-line react-hooks/exhaustive-deps
  const [si, setSi] = useState(0);
  const [typed, setTyped] = useState('');
  const [res, setRes] = useState({}); // { read: true/false, mean: true/false }
  const [picked, setPicked] = useState(null);
  const choices = useMemo(() => meaningChoices(w, pool), [w, pool]);
  const step = steps[si] || 'done';
  const judged = res[step] !== undefined;
  const ok = steps.every((s) => res[s]);
  const autoSaid = useRef(false);
  // 생각한 시간 (단계가 보인 때부터 답할 때까지)
  const t0 = useRef(Date.now());
  const ms = useRef({});
  useEffect(() => {
    t0.current = Date.now();
  }, [si]);
  const sent = useRef(false);
  const finish = (good) => {
    if (sent.current) return;
    sent.current = true;
    onDone(good, { fast: good && ok && isFast(w, ms.current), read: steps.includes('read') ? !!res.read : undefined });
  };

  // 일본어 자판(IME)으로 칠 땐 글자가 확정되기 전 상태(typed)가 늦게 따라올 수 있어서, 판정은 입력칸에 실제로 보이는 글로
  const inputRef = useRef(null);
  const composing = useRef(false);
  const judgeRead = (giveUp) => {
    const now = inputRef.current?.value ?? typed;
    if (judged || (!giveUp && !now.trim())) return; // 빈 칸 Enter 는 무시
    const r = !giveUp && sameReading(now, w.r);
    ms.current.read = Date.now() - t0.current;
    if (!giveUp) setTyped(finishKana(now));
    setRes((x) => ({ ...x, read: r }));
    if (autoSpeak && hasJa()) speak(w.r); // 답할 때 소리는 설정에서 켠 경우만
    autoSaid.current = true;
  };
  const pick = (m) => {
    if (judged) return;
    setPicked(m);
    ms.current.mean = Date.now() - t0.current;
    setRes((x) => ({ ...x, mean: m === w.m }));
    // 잘못 고른 뜻의 단어 = 헷갈리는 짝
    if (m && m !== w.m && onConfuse) {
      const other = pool.find((x) => x.m === m && x.id !== w.id);
      if (other) onConfuse(other.id);
    }
    if (autoSpeak && !autoSaid.current && hasJa()) speak(w.r);
  };
  const next = () => {
    if (!judged) return;
    if (si + 1 < steps.length) setSi(si + 1);
    else if (review && !ok) setSi(steps.length);
    else finish(ok);
  };
  // 맞히면 저절로 다음
  const nextRef = useRef(next);
  nextRef.current = next;
  useEffect(() => {
    if (!judged || !res[step]) return undefined;
    const t = setTimeout(() => nextRef.current(), AUTO_MS);
    return () => clearTimeout(t);
  }, [judged, step, res]); // eslint-disable-line react-hooks/exhaustive-deps

  useKeys((e) => {
    if (e.key === 'Escape') return onExit();
    const inInput = e.target.closest?.('input');
    if (step === 'done') {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        finish(ok);
      } else if (e.key === '1') finish(false);
      else if (e.key === '2') finish(true);
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
                ref={inputRef}
                value={typed}
                readOnly={judged}
                // 일본어 자판으로 글자를 고르는 중엔 그대로 두고, 확정되면 로마자만 가나로
                onChange={(e) => setTyped(composing.current ? e.target.value : toKana(e.target.value))}
                onCompositionStart={() => { composing.current = true; }}
                onCompositionEnd={(e) => { composing.current = false; setTyped(toKana(e.currentTarget.value)); }}
                // 글자 확정용 Enter(IME)는 채점하지 않음 — 한 번 더 Enter 로 채점
                onKeyDown={(e) => { if (e.key === 'Enter' && (e.nativeEvent.isComposing || e.keyCode === 229)) e.preventDefault(); }}
                className={judged ? (res.read ? 'is-right' : 'is-wrong') : ''}
                placeholder="よみかた"
                aria-label="읽는 법"
              />
              {!judged && <button type="button" className="btn" onClick={() => judgeRead(true)}>모르겠어요</button>}
            </form>
            {judged && (
              <div className="ln-fb">
                <b className={res.read ? 'wd-ok' : 'wd-ng'}>{res.read ? '맞았어요' : <>정답 <span lang="ja"><ReadingSplit w={w.w} r={w.r} /></span></>}</b>
                {!res.read && <button type="button" className="btn ln-idk" onClick={() => setRes((x) => ({ ...x, read: true }))}>맞게 썼어요 (맞음으로)</button>}
                {!res.read && <Memo text={cards?.[w.id]?.mn} />}
                {!res.read && <KanjiParts w={w.w} r={w.r} hints />}
              </div>
            )}
          </>
        )}
        {step === 'mean' && (
          <>
            <small className="sub">뜻으로 알맞은 것은?</small>
            <div className="ln-q__w" lang="ja">{w.w}</div>
            {(res.read !== undefined || judged) && <div className="ln-q__r" lang="ja">{w.r}</div>}
            <div className="wd-choices">
              {choices.map((c, i) => (
                <button key={c} type="button" className={`wd-ch ${judged ? (c === w.m ? 'is-right' : c === picked ? 'is-wrong' : '') : ''}`} onClick={() => pick(c)} disabled={judged && c !== picked && c !== w.m}>
                  <span className="num">{i + 1}</span>{c}
                </button>
              ))}
            </div>
            {!judged && <button type="button" className="btn ln-idk" onClick={() => pick(null)}>모르겠어요</button>}
            {judged && !res.mean && <Memo text={cards?.[w.id]?.mn} />}
          </>
        )}
        {step === 'done' && <WordInfo w={w} idx={idx} cards={cards} />}
      </div>
      {step === 'done' ? (
        <div className="ln-two">
          <button type="button" className={`ln-g ln-g--ng ${!ok ? 'is-auto' : ''}`} onClick={() => finish(false)}>
            <b>몰랐음</b><small>10분 뒤 다시</small><kbd>1</kbd>
          </button>
          <button type="button" className={`ln-g ln-g--ok ${ok ? 'is-auto' : ''}`} onClick={() => finish(true)}>
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
export function Study({ words, pool, newPerDay, revCap = 0, autoSpeak, readMode, onDone, onMore }) {
  const cards = useData('words');
  const cardsRef = useRef(cards);
  cardsRef.current = cards;
  const today = todayStr();
  const ids = useMemo(() => pool.map((w) => w.id), [pool]); // 복습은 고른 급수 밖의 단어도
  const byId = useMemo(() => Object.fromEntries(pool.map((w) => [w.id, w])), [pool]);
  const idx = useMemo(() => kanjiIndex(pool), [pool]);

  // phase: review 복습 · intro 새 단어 보기 · quiz 새 단어 퀴즈 · end
  const [st, setSt] = useState(() => ({ phase: 'review', list: reviewIds(ids, cards, today, Date.now(), revCap), pos: 0, batch: [], key: 0 }));
  const [stat, setStat] = useState({ rev: 0, ok: 0, fresh: 0, known: 0, fast: 0 });
  const timer = useRef(null);
  useEffect(() => {
    timer.current = startTimer('vocab', '단어 공부');
    return () => timer.current?.stop();
  }, []);

  // 다음 할 것: 시각이 된 배우는 중 카드 → 새 단어 5개 → 끝
  //  · just = 방금 저장한 카드 { id: 상태 } (화면의 cards 는 다음 그리기 때 바뀌므로)
  const advance = (just = {}) => {
    const c = { ...cardsRef.current, ...just };
    const now = Date.now();
    const rev = reviewIds(ids, c, today, now, revCap);
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
  const reviewed = (ok, info = {}) => {
    const c = cardsRef.current[id];
    const next = clean(answer(c, ok, today, Date.now(), EXAM_DATE, info));
    save('words', id, () => next);
    const learnedNow = ok && next.i >= 7 && (c?.i || 0) < 7 ? 1 : 0;
    timer.current?.add({ n: 1, ok: ok ? 1 : 0, learned: learnedNow });
    setStat((s) => ({ ...s, rev: s.rev + 1, ok: s.ok + (ok ? 1 : 0), fast: s.fast + (ok && info.fast && !c?.ls ? 1 : 0) }));
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
    // 상한 때문에 내일로 넘어간 복습
    const left = revCap ? reviewIds(ids, cards, today, Date.now()).filter((x) => !cards[x].ls).length : 0;
    return (
      <div className="page wd">
        <section className="card wd-end">
          <b className="wd-end__t">오늘 몫 끝!</b>
          <div className="wd-today__nums">
            <div><b className="num wd-c-due">{stat.rev}</b><small>복습 · 알았음 {stat.ok}{stat.fast ? ` · 빨리 ${stat.fast}` : ''}</small></div>
            <div><b className="num wd-c-new">{stat.fresh}</b><small>새로 배움</small></div>
            <div><b className="num">{stat.known}</b><small>이미 알아요</small></div>
          </div>
          {left > 0 && <p className="sub">오늘 복습 상한({revCap}개)을 채워서 남은 {left}개는 내일 먼저 나와요.</p>}
          {wait.n > 0 && <p className="sub">방금 배우거나 틀린 단어 {wait.n}개는 <b>{mins}분 뒤</b>에 한 번 더 나와요. 그때 다시 '오늘 단어'를 눌러 주세요.</p>}
          <div className="row">
            {onMore && <button type="button" className="btn btn--pri" onClick={() => onMore(10)}>새 단어 10개 더</button>}
            <button type="button" className={`btn ${onMore ? '' : 'btn--pri'}`} onClick={onDone}>처음으로</button>
          </div>
        </section>
      </div>
    );
  }

  const label = st.phase === 'review' ? (isLeech(cards[id]) ? '안 외워지는 단어' : cards[id]?.ls ? '다시 확인' : '복습') : st.phase === 'intro' ? `새 단어 ${st.pos + 1}/${st.list.length}` : '방금 배운 것 확인';
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
        <Check key={`${st.key}-${st.pos}-${id}`} w={w} pool={pool} idx={idx} cards={cards} review={st.phase === 'review'} readMode={readMode} autoSpeak={autoSpeak} onDone={st.phase === 'review' ? reviewed : quizzed} onExit={onDone} onConfuse={(other) => save('words', id, (c) => addConfused(c, other))} />
      )}
    </div>
  );
}
