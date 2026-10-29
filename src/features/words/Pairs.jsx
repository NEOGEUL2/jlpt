// 비슷한 말 구별: 이미 배운 헷갈리는 짝을 섞어서 (뜻 → 어느 말?). 답한 뒤 두 말을 나란히 견줘 봄
//  · 틀리면 그 단어는 복습으로(answer), 고른 말은 헷갈리는 짝(cf)에 더함
import { useEffect, useRef, useState } from 'react';
import { save, useData } from '../../lib/store';
import { EXAM_DATE } from '../../lib/srs';
import { todayStr } from '../../lib/dates';
import { startTimer } from '../../lib/studylog';
import { addConfused, answer, clean } from './learn';
import { confusablePairs, pairBits, pairQuiz } from './groups';
import { Ex } from './Learn';
import './learn.css';

function Side({ w, other }) {
  const { same, own } = pairBits(w, other);
  return (
    <div className="pr-side">
      <b lang="ja">{w.w}</b> <span lang="ja" className="sub">{w.r}</span>
      <p>
        {own.map((x) => <mark key={x}>{x}</mark>).reduce((a, x) => [...a, a.length ? ', ' : '', x], [])}
        {same.length > 0 && <span className="sub">{own.length ? ' · ' : ''}같은 뜻: {same.join(', ')}</span>}
      </p>
      {w.ex && <p className="pr-ex" lang="ja"><Ex ex={w.ex} w={w.w} /></p>}
      {w.k && <p className="sub">{w.k}</p>}
    </div>
  );
}

export function PairDrill({ pool, onDone }) {
  const cards = useData('words');
  const cardsRef = useRef(cards);
  cardsRef.current = cards;
  const today = todayStr();
  const [list] = useState(() => pairQuiz(confusablePairs(pool, cards, 10), pool, cards));
  const [pos, setPos] = useState(0);
  const [mine, setMine] = useState(null);
  const [nOk, setOk] = useState(0);
  const timer = useRef(null);
  useEffect(() => {
    timer.current = startTimer('vocab', '비슷한 말 구별');
    return () => timer.current?.finish();
  }, []);
  const q = list[pos];
  const choose = (o) => {
    if (mine || !q) return;
    setMine(o);
    const ok = o.id === q.word.id;
    timer.current?.add({ n: 1, ok: ok ? 1 : 0 });
    if (ok) return setOk((n) => n + 1);
    const c = cardsRef.current[q.word.id];
    if (c?.t && !c.skip) save('words', q.word.id, () => clean(addConfused(answer(c, false, today, Date.now(), EXAM_DATE), o.id)));
  };
  const next = () => {
    setMine(null);
    setPos((p) => p + 1);
  };
  const keyRef = useRef();
  keyRef.current = (e) => {
    if (e.key === 'Escape') return onDone();
    if (!q) return;
    if (!mine && /^[1-4]$/.test(e.key)) q.options[+e.key - 1] && choose(q.options[+e.key - 1]);
    else if (mine && (e.key === 'Enter' || e.key === ' ')) {
      e.preventDefault();
      next();
    }
  };
  useEffect(() => {
    const k = (e) => keyRef.current(e);
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  }, []);

  if (!list.length) {
    return (
      <div className="page wd"><section className="card">
        <b>아직 짝이 없어요</b>
        <p className="sub">배운 단어 가운데 뜻이 겹치거나 헷갈려서 잘못 고른 짝이 생기면 여기 나와요. 단어를 조금 더 배운 뒤에 다시 와 주세요.</p>
        <button type="button" className="btn" onClick={onDone}>돌아가기</button>
      </section></div>
    );
  }
  if (!q) {
    return (
      <div className="page wd">
        <section className="card wd-end">
          <b className="wd-end__t">{nOk} / {list.length}</b>
          <p className="sub">틀린 단어는 복습에 다시 넣었어요. 짝은 배운 단어가 늘수록 바뀌어요.</p>
          <div className="row"><button type="button" className="btn btn--pri" onClick={onDone}>처음으로</button></div>
        </section>
      </div>
    );
  }
  const ok = mine && mine.id === q.word.id;
  return (
    <div className="page wd wd-sess ln">
      <header className="wd-sess__top">
        <button type="button" className="btn" onClick={onDone} aria-label="그만하기">✕</button>
        <div className="bar wd-sess__bar"><i style={{ width: `${(pos / list.length) * 100}%`, background: 'var(--blu)' }} /></div>
        <span className="num sub">{pos + 1}/{list.length}</span>
      </header>
      <div className="card ln-q ln-n1">
        <div className="ln-n1__p"><span>이 뜻에 딱 맞는 말은?</span><small className="sub">비슷한 말 짝이 같이 나와요 · 言い換え·用法 대비</small></div>
        <p className="pr-m">{q.word.m}</p>
        <div className="wd-choices">
          {q.options.map((o, i) => (
            <button key={o.id} type="button" lang="ja" className={`wd-ch ${mine ? (o.id === q.word.id ? 'is-right' : o.id === mine.id ? 'is-wrong' : '') : ''}`} onClick={() => choose(o)} disabled={!!mine && o.id !== mine.id && o.id !== q.word.id}>
              <span className="num">{i + 1}</span>{o.w}
              {mine && <small className="wd-trap" lang="ko" style={{ color: 'var(--sub)' }}>{o.r}</small>}
            </button>
          ))}
        </div>
        {mine && (
          <div className="ln-fb">
            <b className={ok ? 'wd-ok' : 'wd-ng'}>{ok ? '맞았어요' : '아쉬워요'}</b>
            <div className="pr-cmp">
              <Side w={q.word} other={q.mate} />
              <Side w={q.mate} other={q.word} />
            </div>
          </div>
        )}
      </div>
      {mine && <div className="wd-grades wd-grades--front"><button type="button" className="btn btn--pri btn--big" onClick={next}>다음 <kbd>Enter</kbd></button></div>}
    </div>
  );
}
