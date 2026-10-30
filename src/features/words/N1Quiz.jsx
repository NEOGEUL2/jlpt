// N1 모양 문제 10개 (문맥 · 言い換え · 用法). 틀린 단어는 10분 뒤 복습으로 (본 적 없으면 새 단어 맨 앞)
import { useEffect, useMemo, useRef, useState } from 'react';
import { save, useData } from '../../lib/store';
import { EXAM_DATE } from '../../lib/srs';
import { todayStr } from '../../lib/dates';
import { startTimer } from '../../lib/studylog';
import { answer, clean } from './learn';
import { makeQuiz } from './n1quiz';
import { KanjiParts } from './Learn';
import './learn.css';

const PROMPT = {
  ctx: ['（　　）に入れるのに最もよいもの', '빈칸에 들어갈 말 · 보기는 기본형'],
  para: ['＿＿の言葉に意味が最も近いもの', '밑줄 친 말과 뜻이 가장 가까운 말'],
  use: ['次の言葉の使い方として最もよいもの', '이 말을 바르게 쓴 문장'],
};

export function N1Quiz({ pool, onDone }) {
  const cards = useData('words');
  const cardsRef = useRef(cards);
  cardsRef.current = cards;
  const today = todayStr();
  const [list] = useState(() => makeQuiz(pool, cards, 10));
  const [pos, setPos] = useState(0);
  const [mine, setMine] = useState(null);
  const [wrong, setWrong] = useState([]);
  const timer = useRef(null);
  useEffect(() => {
    timer.current = startTimer('vocab', 'N1 어휘 문제');
    return () => timer.current?.stop();
  }, []);
  const q = list[pos];

  const choose = (i) => {
    if (mine !== null || !q) return;
    setMine(i);
    const ok = i === q.answer;
    timer.current?.add({ n: 1, ok: ok ? 1 : 0 });
    if (!ok) {
      setWrong((x) => [...x, q.word]);
      const c = cardsRef.current[q.word.id];
      if (c?.t && !c.skip) save('words', q.word.id, () => clean(answer(c, false, today, Date.now(), EXAM_DATE)));
      else save('words', q.word.id, () => ({ pri: 1 })); // 아직 안 배운(또는 알아요로 넘긴) 단어 → 새 단어 맨 앞
    }
  };
  const next = () => {
    setMine(null);
    setPos((p) => p + 1);
  };
  const keyRef = useRef();
  keyRef.current = (e) => {
    if (e.key === 'Escape') return onDone();
    if (!q) return;
    if (mine === null && /^[1-4]$/.test(e.key)) choose(+e.key - 1);
    else if (mine !== null && (e.key === 'Enter' || e.key === ' ')) {
      e.preventDefault();
      next();
    }
  };
  useEffect(() => {
    const k = (e) => keyRef.current(e);
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  }, []);

  const typeCount = useMemo(() => list.reduce((a, x) => ({ ...a, [x.type]: (a[x.type] || 0) + 1 }), {}), [list]);

  if (!list.length) {
    return <div className="page wd"><section className="card"><p className="sub">문제를 낼 예문 있는 단어가 아직 없어요.</p><button type="button" className="btn" onClick={onDone}>돌아가기</button></section></div>;
  }
  if (!q) {
    const ok = list.length - wrong.length;
    return (
      <div className="page wd">
        <section className="card wd-end">
          <b className="wd-end__t">{ok} / {list.length}</b>
          <p className="sub">문맥 {typeCount.ctx || 0} · 言い換え {typeCount.para || 0} · 用法 {typeCount.use || 0}</p>
          {wrong.length > 0 ? (
            <>
              <p className="sub">틀린 단어는 복습에 다시 넣었어요.</p>
              <ul className="wd-wrong">{wrong.map((w) => <li key={w.id}><b lang="ja">{w.w}</b><span lang="ja">{w.r}</span><small>{w.m}</small></li>)}</ul>
            </>
          ) : <p className="sub">전부 맞혔어요!</p>}
          <div className="row"><button type="button" className="btn btn--pri" onClick={onDone}>처음으로</button></div>
        </section>
      </div>
    );
  }

  const done = mine !== null;
  const [ja, ko] = PROMPT[q.type];
  return (
    <div className="page wd wd-sess ln">
      <header className="wd-sess__top">
        <button type="button" className="btn" onClick={onDone} aria-label="그만하기">✕</button>
        <div className="bar wd-sess__bar"><i style={{ width: `${(pos / list.length) * 100}%`, background: 'var(--blu)' }} /></div>
        <span className="num sub">{pos + 1}/{list.length}</span>
      </header>
      <div className="card ln-q ln-n1">
        <div className="ln-n1__p"><span lang="ja">{ja}</span><small className="sub">{ko}</small></div>
        {q.type === 'use' ? (
          <div className="ln-q__w" lang="ja">{q.word.w}</div>
        ) : (
          <p className="wd-q" lang="ja">
            {q.sent[0]}
            {q.type === 'ctx' ? <span className="ln-blank">{done ? q.sent[1] : '（　　）'}</span> : <u>{q.sent[1]}</u>}
            {q.sent[2]}
          </p>
        )}
        <div className={`wd-choices ${q.type === 'use' ? 'ln-sents' : ''}`}>
          {q.options.map((o, i) => (
            <button key={o.id} type="button" lang="ja" className={`wd-ch ${done ? (i === q.answer ? 'is-right' : i === mine ? 'is-wrong' : '') : ''}`} onClick={() => choose(i)} disabled={done && i !== mine && i !== q.answer}>
              <span className="num">{i + 1}</span>
              {q.type === 'use' ? (
                <span className="ln-sent">{o.sent[0]}<b>{o.sent[1]}</b>{o.sent[2]}</span>
              ) : (
                <span className="ln-opt">{o.text}{done && <small lang="ko"> {o.sub !== o.text ? `${o.sub} · ` : ''}{o.m}</small>}</span>
              )}
            </button>
          ))}
        </div>
        {done && (
          <div className="ln-fb">
            <b className={mine === q.answer ? 'wd-ok' : 'wd-ng'}>{mine === q.answer ? '맞았어요' : '아쉬워요'}</b>
            <span><b lang="ja">{q.word.w}</b> <span lang="ja">（{q.word.r}）</span> {q.word.m}{q.syn && <> ≒ <b lang="ja">{q.syn.w}</b> {q.syn.m}</>}</span>
            {q.word.k && <span className="sub">{q.word.k}</span>}
            <KanjiParts w={q.word.w} r={q.word.r} />
          </div>
        )}
      </div>
      {done && <div className="wd-grades wd-grades--front"><button type="button" className="btn btn--pri btn--big" onClick={next}>다음 <kbd>Enter</kbd></button></div>}
    </div>
  );
}
