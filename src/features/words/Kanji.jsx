// 한자 공부: 부수(많이 틀린 단어의 한자부터 부수로 묶어 보기 + 부수 퀴즈) · 음독·훈독(알아보는 법 + 맞히기 퀴즈)
import { useEffect, useMemo, useRef, useState } from 'react';
import { useData } from '../../lib/store';
import { startTimer } from '../../lib/studylog';
import { kanjiIndex, kanjiInfo, kanjiOf } from './hanja';
import { KIND_KO, PARTS, TYPE_KO, kindTip, partName, radicalOf, wordKinds } from './kanji';
import { hasKanji, isKatakana } from './words';
import './learn.css';

const shuffle = (a) => {
  const b = [...a];
  for (let i = b.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [b[i], b[j]] = [b[j], b[i]];
  }
  return b;
};

// 내가 틀린 단어 (많이 틀린 것부터) → 없으면 본 단어 (최근 것부터)
export function myWords(pool, cards, n = 60) {
  const ok = (w) => hasKanji(w.w) && !isKatakana(w.w) && cards[w.id]?.t && !cards[w.id].skip;
  const missed = pool.filter((w) => ok(w) && (cards[w.id].l || 0) > 0).sort((a, b) => (cards[b.id].l || 0) - (cards[a.id].l || 0));
  const seen = pool.filter((w) => ok(w) && !(cards[w.id].l > 0)).sort((a, b) => String(cards[b.id].t).localeCompare(String(cards[a.id].t)));
  return { missed: missed.slice(0, n), list: [...missed, ...seen].slice(0, n) };
}

// 부수별로 묶기: [{ rad, kanji: [字…], miss 틀린 횟수 합 }]
export function radicalGroups(words, cards) {
  const g = new Map();
  for (const w of words) {
    for (const ch of kanjiOf(w.w)) {
      const r = radicalOf(ch);
      if (!r) continue;
      const key = `${r.n}|${r.form}`;
      if (!g.has(key)) g.set(key, { rad: r, kanji: [], miss: 0 });
      const x = g.get(key);
      if (!x.kanji.includes(ch)) x.kanji.push(ch);
      x.miss += cards[w.id]?.l || 0;
    }
  }
  return [...g.values()].sort((a, b) => b.kanji.length - a.kanji.length || b.miss - a.miss);
}

function useTimer(what) {
  const timer = useRef(null);
  useEffect(() => {
    timer.current = startTimer('vocab', what);
    return () => timer.current?.finish();
  }, [what]);
  return timer;
}

/* ───────── 화면 틀 ───────── */
export function KanjiStudy({ pool, start = 'rad', onDone }) {
  const [tab, setTab] = useState(start);
  const [quiz, setQuiz] = useState(null); // 'rad' · 'onkun'
  const cards = useData('words');
  const mine = useMemo(() => myWords(pool, cards), [pool, cards]);
  const idx = useMemo(() => kanjiIndex(pool), [pool]);
  if (quiz === 'rad') return <RadicalQuiz words={mine.list} idx={idx} onDone={() => setQuiz(null)} />;
  if (quiz === 'onkun') return <OnKunQuiz words={mine.list} pool={pool} onDone={() => setQuiz(null)} />;
  return (
    <div className="page wd kj">
      <header className="wd-top">
        <button type="button" className="btn" onClick={onDone} aria-label="돌아가기">‹</button>
        <h1 className="h1">한자 공부</h1>
        <span className="seg">
          <button type="button" aria-pressed={tab === 'rad'} onClick={() => setTab('rad')}>부수</button>
          <button type="button" aria-pressed={tab === 'onkun'} onClick={() => setTab('onkun')}>음독·훈독</button>
        </span>
      </header>
      {tab === 'rad' ? (
        <RadicalView mine={mine} cards={cards} idx={idx} onQuiz={() => setQuiz('rad')} />
      ) : (
        <OnKunView mine={mine} onQuiz={() => setQuiz('onkun')} />
      )}
    </div>
  );
}

/* ───────── 한자 하나 자세히 ───────── */
function Readings({ ch, used }) {
  const info = PARTS.get(ch);
  if (!info) return null;
  const mark = (x) => (used && x.split('.')[0] === used ? 'is-used' : '');
  return (
    <div className="kj-rd">
      {info.on.length > 0 && (
        <p><span className="kj-tag is-on">음독</span> <span lang="ja">{info.on.slice(0, 4).map((x) => <span key={x} className={mark(x)}>{x}</span>)}</span></p>
      )}
      {info.kun.length > 0 && (
        <p><span className="kj-tag is-kun">훈독</span> <span lang="ja">{info.kun.slice(0, 4).map((x) => <span key={x} className={mark(x)}>{x.replace('.', '·')}</span>)}</span></p>
      )}
    </div>
  );
}

export function PartsLine({ ch }) {
  const info = PARTS.get(ch);
  if (!info?.parts.length) return null;
  return (
    <p className="kj-parts">
      <b lang="ja">{ch}</b> =
      {info.parts.map((p, i) => (
        <span key={i}>{i > 0 && ' +'} <b lang="ja">{p}</b>{partName(p) && <small> {partName(p)}</small>}</span>
      ))}
    </p>
  );
}

function KanjiDetail({ ch, idx, cards }) {
  const k = kanjiInfo(ch);
  const info = PARTS.get(ch);
  const words = (idx.get(ch) || []).slice().sort((a, b) => (cards[b.id]?.t ? 1 : 0) - (cards[a.id]?.t ? 1 : 0)).slice(0, 4);
  return (
    <div className="kj-det">
      <PartsLine ch={ch} />
      {!k.kokuji && <p className="sub">한국 음 <b>{k.ko}</b> · {k.hun}</p>}
      <Readings ch={ch} />
      {info?.look.length > 0 && (
        <p className="kj-look">
          <small className="sub">닮은 한자</small>
          {info.look.map((x) => <span key={x}><b lang="ja">{x}</b><small>{kanjiInfo(x).hun || ''}</small></span>)}
        </p>
      )}
      {words.length > 0 && (
        <ul className="kj-words">
          {words.map((w) => <li key={w.id} className={cards[w.id]?.l ? 'is-miss' : ''}><b lang="ja">{w.w}</b><span lang="ja">{w.r}</span><small>{w.m}</small></li>)}
        </ul>
      )}
    </div>
  );
}

/* ───────── 부수 ───────── */
function RadicalView({ mine, cards, idx, onQuiz }) {
  const groups = useMemo(() => radicalGroups(mine.list, cards), [mine, cards]);
  const [more, setMore] = useState(false);
  const [open, setOpen] = useState(null);
  const missN = mine.missed.length;
  if (!mine.list.length) {
    return <section className="card"><p className="sub">아직 본 단어가 없어요. '오늘 단어'를 조금 하고 오면 그 단어의 한자부터 부수로 묶어 보여 줘요.</p></section>;
  }
  return (
    <>
      <section className="card kj-intro">
        <p className="sub">
          {missN ? `틀린 단어 ${missN}개` : '최근에 본 단어'}의 한자를 <b>부수</b>(한자의 뜻을 알려 주는 조각)로 묶었어요.
          같은 부수끼리 보면 뜻이 이어지고, 닮은 한자를 구별하기 쉬워요. 한자를 누르면 조각·소리·같은 한자 단어가 나와요.
        </p>
        <div className="row"><button type="button" className="btn btn--pri" onClick={onQuiz}>부수 퀴즈 10문제</button></div>
      </section>
      {(more ? groups : groups.slice(0, 10)).map(({ rad, kanji }) => (
        <section key={`${rad.n}|${rad.form}`} className="card kj-g">
          <div className="kj-g__hd">
            <b className="kj-g__glyph" lang="ja">{rad.form}</b>
            <div>
              <b>{rad.formName || rad.name}</b>
              <small className="sub">{rad.formName ? `부수 ${rad.ch} (${rad.name})` : `부수 ${rad.n}번`} · 내 한자 {kanji.length}개</small>
            </div>
          </div>
          <div className="kj-chips">
            {kanji.map((ch) => (
              <button key={ch} type="button" className={`kj-chip ${open === ch ? 'is-open' : ''}`} onClick={() => setOpen(open === ch ? null : ch)} aria-expanded={open === ch}>
                <b lang="ja">{ch}</b>
                <small>{kanjiInfo(ch).hun || kanjiInfo(ch).ko || '일본 한자'}</small>
              </button>
            ))}
          </div>
          {open && kanji.includes(open) && <KanjiDetail ch={open} idx={idx} cards={cards} />}
        </section>
      ))}
      {!more && groups.length > 10 && <button type="button" className="btn" onClick={() => setMore(true)}>부수 {groups.length - 10}개 더 보기</button>}
    </>
  );
}

// 부수 퀴즈: 이 한자의 부수는? (보기 4개, 변 모양 그대로)
function makeRadQuiz(words, n = 10) {
  const all = [];
  for (const w of words) for (const ch of kanjiOf(w.w)) if (radicalOf(ch) && !all.some((x) => x.ch === ch)) all.push({ ch, w });
  const forms = [...new Map(all.map((x) => [radicalOf(x.ch).form, radicalOf(x.ch)])).values()];
  const COMMON = '亻氵扌木口言糸艹⻌日月土心忄金女貝阝宀刂火灬目石禾竹門頁雨'.split('').map((c) => ({ form: c }));
  return shuffle(all).slice(0, n).map(({ ch, w }) => {
    const r = radicalOf(ch);
    const parts = PARTS.get(ch)?.parts || [];
    const others = shuffle([...parts.filter((p) => p !== r.form).map((p) => ({ form: p })), ...shuffle(forms), ...shuffle(COMMON)]).filter((x) => x.form !== r.form);
    const opts = [];
    for (const o of [...parts.filter((p) => p !== r.form).map((p) => ({ form: p })), ...others]) if (opts.length < 3 && !opts.some((x) => x.form === o.form)) opts.push(o);
    return { ch, w, r, options: shuffle([{ form: r.form, right: true }, ...opts]) };
  });
}

function RadicalQuiz({ words, idx, onDone }) {
  const cards = useData('words');
  const [list] = useState(() => makeRadQuiz(words));
  const [pos, setPos] = useState(0);
  const [mine, setMine] = useState(null);
  const [score, setScore] = useState(0);
  const timer = useTimer('부수 퀴즈');
  const q = list[pos];
  const choose = (i) => {
    if (mine !== null) return;
    setMine(i);
    const ok = q.options[i].right;
    timer.current?.add({ n: 1, ok: ok ? 1 : 0 });
    if (ok) setScore((s) => s + 1);
  };
  useQuizKeys({ done: mine !== null, choose, next: () => { setMine(null); setPos((p) => p + 1); }, onDone, n: q?.options.length });
  if (!q) return <End score={score} total={list.length} onDone={onDone} empty="부수를 낼 한자가 아직 없어요." />;
  const done = mine !== null;
  return (
    <QuizFrame pos={pos} total={list.length} onDone={onDone} label="부수 퀴즈">
      <div className="card ln-q">
        <small className="sub">이 한자의 부수는?</small>
        <div className="ln-q__w" lang="ja">{q.ch}</div>
        <small className="sub" lang="ja">{q.w.w}</small>
        <div className="wd-choices">
          {q.options.map((o, i) => (
            <button key={o.form} type="button" lang="ja" className={`wd-ch ${done ? (o.right ? 'is-right' : i === mine ? 'is-wrong' : '') : ''}`} onClick={() => choose(i)}>
              <span className="num">{i + 1}</span>
              <span className="ln-opt">{o.form}{done && <small lang="ko"> {partName(o.form)}</small>}</span>
            </button>
          ))}
        </div>
        {done && (
          <div className="ln-fb">
            <b className={q.options[mine].right ? 'wd-ok' : 'wd-ng'}>{q.options[mine].right ? '맞았어요' : `부수는 ${q.r.form} (${q.r.formName || q.r.name})`}</b>
            <KanjiDetail ch={q.ch} idx={idx} cards={cards} />
          </div>
        )}
      </div>
      {done && <Next onClick={() => { setMine(null); setPos((p) => p + 1); }} />}
    </QuizFrame>
  );
}

/* ───────── 음독 · 훈독 ───────── */
export function KindSplit({ w, r }) {
  const k = wordKinds(w, r);
  if (!k) return null;
  return (
    <div className="kj-split" lang="ja">
      {k.parts.map((p, i) =>
        p.k ? (
          <span key={i} className={`kj-seg is-${p.kind || 'x'}`}>
            <b>{p.k}</b>
            <span>{p.r}</span>
            <small lang="ko">{KIND_KO[p.kind] || '특별'}</small>
          </span>
        ) : (
          <span key={i} className="kj-seg is-kana"><b>{p.kana}</b><span>&nbsp;</span><small>&nbsp;</small></span>
        ),
      )}
    </div>
  );
}

function OnKunView({ mine, onQuiz }) {
  const counts = useMemo(() => {
    const c = {};
    for (const w of mine.missed.length ? mine.missed : mine.list) {
      const t = wordKinds(w.w, w.r)?.type;
      if (t) c[t] = (c[t] || 0) + 1;
    }
    return c;
  }, [mine]);
  const ex = [
    ['学校', 'がっこう'],
    ['山', 'やま'],
    ['手紙', 'てがみ'],
    ['取り扱う', 'とりあつかう'],
    ['本棚', 'ほんだな'],
    ['場所', 'ばしょ'],
  ];
  return (
    <>
      <section className="card kj-guide">
        <b>알아보는 법</b>
        <ul>
          <li><span className="kj-tag is-on">음독</span> 옛 중국 소리. <b>한국 한자음과 닮았어요</b> (学 학 → がく, 国 국 → こく, 安 안 → あん). 짧고(1~2박) 끝이 ん·う·い·く·き·つ·ち.</li>
          <li><span className="kj-tag is-kun">훈독</span> 그 한자 뜻의 일본 고유어 (山 やま, 食べる たべる). 한국 음과 안 닮았어요.</li>
          <li><b>한자 2개 이상 + 뒤에 히라가나 없음</b> → 대개 음독 (経営 けいえい)</li>
          <li><b>한자 + 히라가나 꼬리(오쿠리가나)</b> → 대개 훈독 (扱う あつかう, 細かい こまかい)</li>
          <li><b>한자 하나만</b> → 훈독일 때가 많음 (角 かど, 瀬 せ)</li>
          <li>예외: 음+훈 <span lang="ja">重箱 じゅう·ばこ</span>, 훈+음 <span lang="ja">湯桶 ゆ·とう</span>, 통째로 읽는 말 <span lang="ja">土産 みやげ</span></li>
        </ul>
        <div className="kj-exs">
          {ex.map(([w, r]) => <KindSplit key={w} w={w} r={r} />)}
        </div>
      </section>
      <section className="card">
        <div className="wd-hd"><b>{mine.missed.length ? '내가 틀린 단어' : '최근 본 단어'}</b><small className="sub">{mine.missed.length || mine.list.length}개</small></div>
        <p className="sub">{Object.entries(counts).map(([t, n]) => `${TYPE_KO[t]} ${n}`).join(' · ') || '아직 본 단어가 없어요'}</p>
        <div className="row"><button type="button" className="btn btn--pri" onClick={onQuiz}>음독·훈독 맞히기 10문제</button></div>
        <p className="sub">단어를 보고 음독인지 훈독인지 먼저 고른 뒤, 한자마다 어떤 소리로 읽었는지 확인해요. 틀린 단어부터 나와요.</p>
      </section>
    </>
  );
}

const CHOICES = [
  ['on', '음독', '学校 がっこう'],
  ['kun', '훈독', '手紙 てがみ'],
  ['jubako', '음 + 훈', '本棚 ほん·だな'],
  ['yuto', '훈 + 음', '場所 ば·しょ'],
];

// 문제 고르기: 내 단어 먼저, 음독·훈독 고르게 (음+훈·훈+음은 조금)
export function makeOnKun(words, pool, n = 10) {
  const typed = (list) => list.map((w) => ({ w, t: wordKinds(w.w, w.r)?.type })).filter((x) => ['on', 'kun', 'jubako', 'yuto'].includes(x.t));
  const mineT = typed(words);
  const rest = typed(shuffle(pool.filter((w) => hasKanji(w.w) && !isKatakana(w.w))).slice(0, 400));
  const want = { on: 4, kun: 4, jubako: 1, yuto: 1 };
  const out = [];
  for (const src of [shuffle(mineT), rest]) {
    for (const x of src) {
      if (out.length >= n) break;
      if (want[x.t] > 0 && !out.some((y) => y.w.id === x.w.id)) {
        out.push(x);
        want[x.t]--;
      }
    }
  }
  for (const x of rest) if (out.length < n && !out.some((y) => y.w.id === x.w.id)) out.push(x);
  return shuffle(out);
}

function OnKunQuiz({ words, pool, onDone }) {
  const [list] = useState(() => makeOnKun(words, pool));
  const [pos, setPos] = useState(0);
  const [mine, setMine] = useState(null);
  const [score, setScore] = useState(0);
  const timer = useTimer('음독·훈독');
  const q = list[pos];
  const choose = (i) => {
    if (mine !== null) return;
    setMine(i);
    const ok = CHOICES[i][0] === q.t;
    timer.current?.add({ n: 1, ok: ok ? 1 : 0 });
    if (ok) setScore((s) => s + 1);
  };
  const next = () => { setMine(null); setPos((p) => p + 1); };
  useQuizKeys({ done: mine !== null, choose, next, onDone, n: 4 });
  if (!q) return <End score={score} total={list.length} onDone={onDone} empty="문제를 낼 단어가 없어요." />;
  const done = mine !== null;
  const right = CHOICES.findIndex((c) => c[0] === q.t);
  return (
    <QuizFrame pos={pos} total={list.length} onDone={onDone} label="음독·훈독">
      <div className="card ln-q">
        <small className="sub">이 단어는 어떻게 읽을까요?</small>
        <div className="ln-q__w" lang="ja">{q.w.w}</div>
        <small>{q.w.m}</small>
        <div className="wd-choices">
          {CHOICES.map(([key, label, eg], i) => (
            <button key={key} type="button" className={`wd-ch ${done ? (i === right ? 'is-right' : i === mine ? 'is-wrong' : '') : ''}`} onClick={() => choose(i)}>
              <span className="num">{i + 1}</span>
              <span className="ln-opt">{label} <small lang="ja">{eg}</small></span>
            </button>
          ))}
        </div>
        {done && (
          <div className="ln-fb">
            <b className={mine === right ? 'wd-ok' : 'wd-ng'}>{mine === right ? '맞았어요' : `${TYPE_KO[q.t]}이에요`}</b>
            <KindSplit w={q.w.w} r={q.w.r} />
            <small className="sub">{kindTip(q.w.w, q.w.r)}</small>
            <div className="kj-each">
              {wordKinds(q.w.w, q.w.r).parts.filter((p) => p.k).map((p, i) => (
                <div key={i}>
                  <b lang="ja">{p.k}</b> <small className="sub">{kanjiInfo(p.k).ko && `한국 음 ${kanjiInfo(p.k).ko}`}</small>
                  <Readings ch={p.k} used={p.r} />
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
      {done && <Next onClick={next} />}
    </QuizFrame>
  );
}

/* ───────── 퀴즈 공통 ───────── */
function useQuizKeys({ done, choose, next, onDone, n = 4 }) {
  const ref = useRef();
  ref.current = (e) => {
    if (e.key === 'Escape') return onDone();
    if (!done && /^[1-9]$/.test(e.key) && +e.key <= n) choose(+e.key - 1);
    else if (done && (e.key === 'Enter' || e.key === ' ')) {
      e.preventDefault();
      next();
    }
  };
  useEffect(() => {
    const k = (e) => ref.current(e);
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  }, []);
}
function QuizFrame({ pos, total, onDone, label, children }) {
  return (
    <div className="page wd wd-sess ln kj">
      <header className="wd-sess__top">
        <button type="button" className="btn" onClick={onDone} aria-label="그만하기">✕</button>
        <span className="wd-pill ln-ph ln-ph--quiz">{label}</span>
        <div className="bar wd-sess__bar"><i style={{ width: `${(pos / total) * 100}%`, background: 'var(--blu)' }} /></div>
        <span className="num sub">{pos + 1}/{total}</span>
      </header>
      {children}
    </div>
  );
}
const Next = ({ onClick }) => (
  <div className="wd-grades wd-grades--front"><button type="button" className="btn btn--pri btn--big" onClick={onClick}>다음 <kbd>Enter</kbd></button></div>
);
function End({ score, total, onDone, empty }) {
  return (
    <div className="page wd">
      <section className="card wd-end">
        <b className="wd-end__t">{total ? `${score} / ${total}` : empty}</b>
        <div className="row"><button type="button" className="btn btn--pri" onClick={onDone}>한자 공부로</button></div>
      </section>
    </div>
  );
}
