// 뼈대: PC·맥(넓은 창) = 왼쪽 메뉴, 폰 = 아래 탭. 고른 메뉴는 이 기기에 기억
import { Component, Suspense, useEffect, useState } from 'react';
import { FEATURES } from './features';
import { sync } from './lib/store';

const TAB = 'jlpt:tab';
const readTab = () => {
  try {
    return localStorage.getItem(TAB) || 'words';
  } catch {
    return 'words';
  }
};

// 화면 하나가 오류 나도 앱 전체는 살아 있게
class Guard extends Component {
  state = { err: null };
  static getDerivedStateFromError(err) {
    return { err };
  }
  render() {
    if (this.state.err) {
      return (
        <div className="page"><div className="card">
          <b>이 화면에 문제가 생겼어요</b>
          <p className="sub">{String(this.state.err?.message || this.state.err)}</p>
          <button type="button" className="btn" onClick={() => this.setState({ err: null })}>다시 열기</button>
        </div></div>
      );
    }
    return this.props.children;
  }
}

export default function App() {
  const [tab, setTab] = useState(readTab);
  const go = (k) => {
    setTab(k);
    try {
      localStorage.setItem(TAB, k);
    } catch {
      /* 기억 못 해도 됨 */
    }
  };
  useEffect(() => {
    sync();
  }, []);
  useEffect(() => {
    const on = (e) => go(e.detail);
    window.addEventListener('jlpt-go', on);
    return () => window.removeEventListener('jlpt-go', on);
  }, []);
  const F = FEATURES.find((f) => f.key === tab) || FEATURES[0];
  return (
    <div className="app">
      <nav className="nav" aria-label="메뉴">
        <span className="nav__logo" aria-hidden="true">N1</span>
        {FEATURES.map((f) => (
          <button key={f.key} type="button" className={`nav__b ${f === F ? 'is-on' : ''}`} aria-current={f === F ? 'page' : undefined} onClick={() => go(f.key)}>
            <span className="nav__i" lang="ja">{f.icon}</span>
            <span className="nav__t">{f.label}</span>
          </button>
        ))}
      </nav>
      <main className="main">
        <Guard key={F.key}>
          <Suspense fallback={<div className="page" />}>
            <F.C />
          </Suspense>
        </Guard>
      </main>
    </div>
  );
}
