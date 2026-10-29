// 단어: 오늘 복습 → 카드(뜻 맞히기) · 읽기 퀴즈(한자 읽기) · 교재 단어 넣기 · 단어장
import { useEffect, useMemo, useRef, useState } from 'react';
import { remove, save, saveMany, useData } from '../../lib/store';
import { EXAM_DATE, GRADES, grade, maturity, preview, queue } from '../../lib/srs';
import { diffDays, todayStr } from '../../lib/dates';
import { hasJa, speak } from '../../lib/speak';
import { startTimer } from '../../lib/studylog';
import { BASE, LEVELS, allWords, hasKanji, isKatakana, newToday, parsePaste, quizPick, readingChoices, splitExample } from './words';
import './words.css';

const NEW_OPTS = [10, 20, 30, 50, 80];

function usePrefs() {
  const p = useData('prefs').main || {};
  const levels = LEVELS.filter((l) => (p.levels || LEVELS).includes(l));
  return { newPerDay: p.newPerDay || 20, ...p, levels: levels.length ? levels : LEVELS };
}
function useWords(all) {
  const own = useData('own');
  const { levels } = usePrefs();
  const key = all ? LEVELS.join() : levels.join();
  return useMemo(() => allWords(own, key.split(',')), [own, key]);
}
const setPrefs = (patch) => save('prefs', 'main', patch);

export default function Words() {
  const [mode, setMode] = useState(null); // null 첫 화면 · 'cards' · 'quiz' · 'add' · 'list'
  const done = () => setMode(null);
  if (mode === 'cards') return <Session onDone={done} />;
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
  const q = queue(words.map((w) => w.id), cards, today, Math.max(0, prefs.newPerDay - nNew));
  const m = maturity(words.map((w) => w.id), cards);
  const total = words.length;
  const dd = diffDays(today, EXAM_DATE);
  const left = q.due.length + q.fresh.length;
  const ownN = words.filter((w) => w.set === '교재').length;
  // 이 속도면 언제 다 보나
  const daysNeed = Math.ceil(m.fresh / prefs.newPerDay);
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
            <p className="sub">더 하고 싶으면 하루 새 단어 수를 늘리거나 읽기 퀴즈를 풀어 보세요.</p>
          </div>
        )}
        <div className="row">
          <button type="button" className="btn" onClick={() => go('quiz')}>한자 읽기 퀴즈 10문제</button>
        </div>
      </section>

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
          <p className={`sub ${daysNeed > dd - 5 ? 'wd-warn' : ''}`}>
            하루 {prefs.newPerDay}개씩이면 {daysNeed}일 뒤에 모두 한 번씩 봐요.{daysNeed > dd - 5 ? ' 시험 전 복습 시간을 두려면 하루 새 단어를 늘려 보세요.' : ''}
          </p>
        )}
        <div className="row">
          <span className="sub">하루 새 단어</span>
          <span className="seg">
            {NEW_OPTS.map((n) => <button key={n} type="button" aria-pressed={prefs.newPerDay === n} onClick={() => setPrefs({ newPerDay: n })}>{n}</button>)}
          </span>
        </div>
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
      <div className="wd-hd"><b>공부할 급수</b><small>고른 급수만 새 단어로 나와요 · 쉬운 급수부터</small></div>
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

/* ───────── 카드 ───────── */
function Ex({ ex, w }) {
  const [a, b, c] = splitExample(ex, w);
  return <>{a}{b && <mark>{b}</mark>}{c}</>;
}

function Session({ onDone }) {
  const words = useWords();
  const cards = useData('words');
  const prefs = usePrefs();
  const today = todayStr();
  const byId = useMemo(() => Object.fromEntries(words.map((w) => [w.id, w])), [words]);
  // 시작할 때 한 번 줄 세움 (복습 먼저, 새 단어는 사이사이)
  const [line, setLine] = useState(() => {
    const q = queue(words.map((w) => w.id), cards, today, Math.max(0, prefs.newPerDay - newToday(cards, today)));
    const out = [];
    let f = 0;
    q.due.forEach((id, i) => {
      out.push(id);
      if (i % 4 === 3 && f < q.fresh.length) out.push(q.fresh[f++]);
    });
    while (f < q.fresh.length) out.push(q.fresh[f++]);
    return out;
  });
  const [pos, setPos] = useState(0);
  const [open, setOpen] = useState(false);
  const [stat, setStat] = useState({ n: 0, ok: 0, again: 0, learned: 0 });
  const total = useRef(line.length);
  const timer = useRef(null);
  useEffect(() => {
    timer.current = startTimer('vocab', '단어 카드');
    return () => timer.current?.finish();
  }, []);

  const id = line[pos];
  const w = byId[id];
  const card = cards[id];
  const isNew = !card?.t;
  const ja = hasJa();

  const answer = (g) => {
    if (!w) return;
    const next = grade(card, g, today, EXAM_DATE);
    if (isNew) next.f = today;
    save('words', id, next);
    const learned = g > 1 && next.i >= 7 && (card?.i || 0) < 7 ? 1 : 0;
    setStat((s) => ({ n: s.n + 1, ok: s.ok + (g > 1 ? 1 : 0), again: s.again + (g === 1 ? 1 : 0), learned: s.learned + learned }));
    timer.current?.add({ n: 1, ok: g > 1 ? 1 : 0, learned });
    if (g === 1) setLine((l) => [...l.slice(0, pos + 1), ...l.slice(pos + 1, pos + 4), id, ...l.slice(pos + 4)]); // 세 장 뒤에 또
    setOpen(false);
    setPos((p) => p + 1);
  };
  const knowIt = () => {
    save('words', id, { skip: 1, t: today, d: '9999-12-31', i: 999, f: today });
    timer.current?.add({ n: 1, ok: 1, learned: 1 });
    setOpen(false);
    setPos((p) => p + 1);
  };

  useEffect(() => {
    const key = (e) => {
      if (e.target.closest('input, textarea')) return;
      if (e.key === ' ' || e.key === 'Enter') {
        e.preventDefault();
        if (!open) setOpen(true);
        else answer(3);
      } else if (open && /^[1-4]$/.test(e.key)) answer(+e.key);
      else if (e.key === 'Escape') onDone();
    };
    window.addEventListener('keydown', key);
    return () => window.removeEventListener('keydown', key);
  });
  useEffect(() => {
    if (open && w && prefs.autoSpeak && ja) speak(w.r);
  }, [open, w, prefs.autoSpeak, ja]);

  if (!w) {
    return (
      <div className="page wd">
        <section className="card wd-end">
          <b className="wd-end__t">오늘 단어 끝!</b>
          <div className="wd-today__nums">
            <div><b className="num">{stat.n}</b><small>본 카드</small></div>
            <div><b className="num">{stat.n ? Math.round((stat.ok / stat.n) * 100) : 0}%</b><small>바로 기억</small></div>
            <div><b className="num">{stat.learned}</b><small>새로 익힘</small></div>
          </div>
          <div className="row">
            <button type="button" className="btn btn--pri" onClick={onDone}>처음으로</button>
          </div>
        </section>
      </div>
    );
  }

  const shown = Math.min(pos, total.current);
  return (
    <div className="page wd wd-sess">
      <header className="wd-sess__top">
        <button type="button" className="btn" onClick={onDone} aria-label="그만하기">✕</button>
        <div className="bar wd-sess__bar"><i style={{ width: `${(shown / Math.max(1, line.length)) * 100}%`, background: 'var(--grn)' }} /></div>
        <span className="num sub">{line.length - pos}</span>
      </header>

      <div className={`card wd-card ${open ? 'is-open' : ''}`} onClick={() => !open && setOpen(true)} role="button" tabIndex={0} aria-label={open ? undefined : '눌러서 뜻 보기'}>
        <div className="wd-card__tag">{isNew ? <span className="wd-pill wd-pill--new">새 단어</span> : <span className="wd-pill">복습</span>}{w.set === '교재' ? <span className="wd-pill">교재{w.src ? ` · ${w.src}` : ''}</span> : <span className="wd-pill">{w.lv}</span>}</div>
        <div className="wd-card__w" lang="ja">{w.w}</div>
        {open ? (
          <div className="wd-card__back">
            {!isKatakana(w.w) && w.r !== w.w && <div className="wd-card__r" lang="ja">{w.r}</div>}
            <div className="wd-card__m">{w.m}{w.en && <span className="wd-pill wd-en" title="한국어 뜻을 아직 못 넣은 단어예요">영어 뜻</span>}</div>
            {w.ex && (
              <div className="wd-card__ex">
                <p lang="ja"><Ex ex={w.ex} w={w.w} /></p>
                {w.k && <p className="sub">{w.k}</p>}
              </div>
            )}
            {ja && (
              <div className="row wd-card__say" onClick={(e) => e.stopPropagation()}>
                <button type="button" className="btn" onClick={() => speak(w.r)}>🔊 단어</button>
                {w.ex && <button type="button" className="btn" onClick={() => speak(w.ex)}>🔊 예문</button>}
                {w.ex && <button type="button" className="btn" onClick={() => speak(w.ex, 0.7)}>천천히</button>}
              </div>
            )}
          </div>
        ) : (
          <p className="sub wd-card__hint">뜻을 떠올린 다음 눌러 보세요 <kbd>Space</kbd></p>
        )}
      </div>

      {open ? (
        <div className="wd-grades">
          {GRADES.map((g) => (
            <button key={g.g} type="button" className={`wd-g wd-g--${g.g}`} onClick={() => answer(g.g)}>
              <b>{g.label}</b>
              <small className="num">{preview(card, g.g, today, EXAM_DATE)}</small>
              <kbd>{g.key}</kbd>
            </button>
          ))}
        </div>
      ) : (
        <div className="wd-grades wd-grades--front">
          <button type="button" className="btn btn--pri btn--big" onClick={() => setOpen(true)}>뜻 보기</button>
          {isNew && <button type="button" className="btn btn--big" onClick={knowIt}>이미 알아요</button>}
        </div>
      )}
    </div>
  );
}

/* ───────── 한자 읽기 퀴즈 ───────── */
function Quiz({ onDone }) {
  const words = useWords();
  const cards = useData('words');
  const today = todayStr();
  const [list] = useState(() => {
    const pick = quizPick(words, cards, 10);
    return pick.map((w) => ({ w, choices: readingChoices(w, words) }));
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
      if (!mine && /^[1-4]$/.test(e.key)) choose(it.choices[+e.key - 1]);
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
        <p className="sub">밑줄 친 말의 읽는 법으로 알맞은 것은?</p>
        {it.w.ex && splitExample(it.w.ex, it.w.w)[1] ? (
          <p className="wd-q" lang="ja">{splitExample(it.w.ex, it.w.w)[0]}<u>{splitExample(it.w.ex, it.w.w)[1]}</u>{splitExample(it.w.ex, it.w.w)[2]}</p>
        ) : <div className="wd-card__w" lang="ja"><u>{it.w.w}</u></div>}
        <div className="wd-choices">
          {it.choices.map((c, i) => (
            <button key={c} type="button" lang="ja" className={`wd-ch ${mine ? (c === it.w.r ? 'is-right' : c === mine ? 'is-wrong' : '') : ''}`} onClick={() => choose(c)} disabled={!!mine && c !== mine && c !== it.w.r}>
              <span className="num">{i + 1}</span>{c}
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
