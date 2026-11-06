// '알아요'로 넘긴 단어 점검: 한 장에 뜻 4개 + 모르겠어요. 맞히면 저절로 다음, 틀리면 읽기·뜻을 보고 다음 (check.js)
import { useEffect, useRef, useState } from 'react';
import { save, useData } from '../../lib/store';
import { todayStr } from '../../lib/dates';
import { startTimer } from '../../lib/studylog';
import { meaningChoices } from './learn';
import { CHECK_N, checkNo, checkOk, checkPick } from './check';
import { KanjiParts } from './Learn';

const AUTO_MS = 650;

export function SkipCheck({ words, pool, onDone }) {
  const cards = useData('words');
  const today = todayStr();
  const [list] = useState(() => checkPick(words, cards, CHECK_N).map((w) => ({ w, choices: meaningChoices(w, pool) })));
  const [pos, setPos] = useState(0);
  const [mine, setMine] = useState(null); // 고른 뜻 · '?' 모르겠어요
  const [wrong, setWrong] = useState([]);
  const timer = useRef(null);
  useEffect(() => {
    timer.current = startTimer('vocab', '넘긴 단어 점검');
    return () => timer.current?.stop();
  }, []);
  const it = list[pos];
  const ok = mine && mine === it?.w.m;

  const choose = (m) => {
    if (mine || !it) return;
    setMine(m);
    const good = m === it.w.m;
    timer.current?.add({ n: 1, ok: good ? 1 : 0 });
    if (good) save('words', it.w.id, (c) => checkOk(c, today));
    else {
      save('words', it.w.id, () => checkNo(today));
      setWrong((x) => [...x, it.w]);
    }
  };
  const next = () => {
    setMine(null);
    setPos((p) => p + 1);
  };
  const nextRef = useRef(next);
  nextRef.current = next;
  useEffect(() => {
    if (!ok) return;
    const t = setTimeout(() => nextRef.current(), AUTO_MS);
    return () => clearTimeout(t);
  }, [ok, pos]);
  useEffect(() => {
    const key = (e) => {
      if (!it) return;
      if (!mine && /^[1-4]$/.test(e.key)) choose(it.choices[+e.key - 1]);
      else if (!mine && (e.key === '5' || e.key === '0')) choose('?');
      else if (mine && (e.key === 'Enter' || e.key === ' ')) {
        e.preventDefault();
        next();
      }
    };
    window.addEventListener('keydown', key);
    return () => window.removeEventListener('keydown', key);
  });

  if (!list.length) {
    return <div className="page wd"><section className="card"><p className="sub">점검할 단어가 없어요. '알아요'로 넘긴 단어는 모두 확인했어요.</p><button type="button" className="btn" onClick={onDone}>돌아가기</button></section></div>;
  }
  if (!it) {
    return (
      <div className="page wd">
        <section className="card wd-end">
          <b className="wd-end__t">{list.length - wrong.length} / {list.length}</b>
          {wrong.length > 0 ? (
            <>
              <p className="sub">헷갈린 {wrong.length}개는 새 단어 맨 앞에 넣었어요. '오늘 단어'에서 다시 배워요.</p>
              <ul className="wd-wrong">{wrong.map((w) => <li key={w.id}><b lang="ja">{w.w}</b><span lang="ja">{w.r}</span><small>{w.m}</small></li>)}</ul>
            </>
          ) : <p className="sub">전부 정말 아는 단어였어요!</p>}
          <div className="row"><button type="button" className="btn btn--pri" onClick={onDone}>처음으로</button></div>
        </section>
      </div>
    );
  }
  const cls = (c) => (mine ? (c === it.w.m ? 'is-right' : c === mine ? 'is-wrong' : '') : '');
  return (
    <div className="page wd wd-sess">
      <header className="wd-sess__top">
        <button type="button" className="btn" onClick={onDone} aria-label="그만하기">✕</button>
        <div className="bar wd-sess__bar"><i style={{ width: `${(pos / list.length) * 100}%`, background: 'var(--blu)' }} /></div>
        <span className="num sub">{pos + 1}/{list.length}</span>
      </header>
      <div className="card wd-card is-open">
        <div className="ln-n1__p"><span>'알아요'로 넘긴 단어 · 뜻은?</span><small className="sub">{it.w.lv} · 헷갈리면 '모르겠어요'</small></div>
        <div className="wd-card__w" lang="ja">{it.w.w}</div>
        {mine && <div className="wd-card__r" lang="ja">{it.w.r}</div>}
        <div className="wd-choices">
          {it.choices.map((c, i) => (
            <button key={c} type="button" className={`wd-ch ${cls(c)}`} onClick={() => choose(c)} disabled={!!mine && c !== mine && c !== it.w.m}>
              <span className="num">{i + 1}</span>{c}
            </button>
          ))}
          <button type="button" className={`wd-ch ${mine === '?' ? 'is-wrong' : ''}`} onClick={() => choose('?')} disabled={!!mine && mine !== '?'}>
            <span className="num">5</span>모르겠어요
          </button>
        </div>
        {mine && !ok && (
          <div className="wd-fb">
            <b className="wd-ng">새 단어로 다시 배워요</b>
            <span><b lang="ja">{it.w.w}</b> <span lang="ja">（{it.w.r}）</span> {it.w.m}</span>
            <KanjiParts w={it.w.w} r={it.w.r} />
          </div>
        )}
      </div>
      {mine && !ok && <div className="wd-grades wd-grades--front"><button type="button" className="btn btn--pri btn--big" onClick={next}>다음</button></div>}
    </div>
  );
}
