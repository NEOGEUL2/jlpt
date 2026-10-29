// 설정: 서버 연결(기록 앱과 같은 Supabase) · 로그인 · 표 만들기 SQL · 소리 · 설치 방법
import { useEffect, useState } from 'react';
import { cloudConfig, onCloudChange, setCloudConfig, supabase } from '../../lib/supabase';
import { CLOUD_SQL, save, sync, useData, useSyncStatus } from '../../lib/store';
import { STUDY_SQL, syncStudy } from '../../lib/studylog';
import { hasJa, speak } from '../../lib/speak';
import './settings.css';

function useSession() {
  const [s, setS] = useState(null);
  const [ver, setVer] = useState(0);
  useEffect(() => onCloudChange(() => setVer((v) => v + 1)), []);
  useEffect(() => {
    const sb = supabase();
    if (!sb) return setS(null);
    sb.auth.getSession().then(({ data }) => setS(data.session));
    const { data } = sb.auth.onAuthStateChange((_e, sess) => setS(sess));
    return () => data.subscription.unsubscribe();
  }, [ver]);
  return s;
}

const syncAll = () => {
  sync();
  syncStudy?.();
};

function Account() {
  const cfg = cloudConfig();
  const [url, setUrl] = useState(cfg.url || '');
  const [key, setKey] = useState(cfg.key || '');
  const [email, setEmail] = useState('');
  const [pw, setPw] = useState('');
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);
  const session = useSession();
  const st = useSyncStatus();
  const linked = !!(cfg.url && cfg.key);

  const saveCfg = () => {
    if (!/^https:\/\/.+/.test(url.trim())) return setMsg('주소는 https:// 로 시작해요.');
    if (/service_role|sb_secret_/.test(key)) return setMsg('secret / service_role 키는 넣으면 안 돼요. publishable(anon) 키를 넣어 주세요.');
    setCloudConfig({ url, key });
    setMsg('저장했어요. 이제 로그인해 주세요.');
  };
  const login = async () => {
    setBusy(true);
    setMsg('');
    const { error } = await supabase().auth.signInWithPassword({ email: email.trim(), password: pw });
    setBusy(false);
    if (error) setMsg(/Invalid login/i.test(error.message) ? '이메일이나 비밀번호가 맞지 않아요. 기록 앱에서 쓰는 계정이에요.' : error.message);
    else {
      setPw('');
      syncAll();
    }
  };
  const logout = async () => {
    await supabase()?.auth.signOut();
    setMsg('로그아웃했어요. 이 기기의 기록은 그대로 남아 있어요.');
  };

  return (
    <section className="card">
      <div className="st-hd"><b>계정 · 기기 연동</b>{session && <span className={`st-dot st-dot--${st.state}`}>{st.state === 'ok' ? '연동됨' : st.state === 'syncing' ? '맞추는 중' : st.state === 'error' ? '문제 있음' : '이 기기만'}</span>}</div>
      {session ? (
        <>
          <p className="sub">{session.user.email} 으로 로그인됨. 아이폰 · 맥 · PC에서 같은 계정으로 로그인하면 기록이 같이 보여요.</p>
          {st.state === 'error' && <p className="st-err">{st.error}</p>}
          <div className="row">
            <button type="button" className="btn" onClick={syncAll}>지금 맞추기</button>
            <button type="button" className="btn" onClick={logout}>로그아웃</button>
          </div>
        </>
      ) : (
        <>
          <p className="sub">기록(Girok) 앱과 <b>같은 서버 · 같은 계정</b>을 써요. 로그인 안 해도 이 기기에서는 다 쓸 수 있어요.</p>
          {!linked || !session ? (
            <details className="st-det" open={!linked}>
              <summary>1. 서버 주소 · 키 {linked && '(넣음)'}</summary>
              <p className="sub">기록 앱 → 설정 → 계정 연동에 넣은 것과 똑같이 넣어 주세요. (Supabase → Project Settings → API)</p>
              <label className="field">Project URL<input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://abcd.supabase.co" autoCapitalize="off" autoCorrect="off" spellCheck={false} /></label>
              <label className="field">publishable (anon) 키<input value={key} onChange={(e) => setKey(e.target.value)} placeholder="sb_publishable_… 또는 eyJ…" autoCapitalize="off" autoCorrect="off" spellCheck={false} /></label>
              <button type="button" className="btn" onClick={saveCfg} disabled={!url || !key}>저장</button>
            </details>
          ) : null}
          {linked && (
            <div className="st-login">
              <b>2. 로그인</b>
              <label className="field">이메일<input type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="username" /></label>
              <label className="field">비밀번호<input type="password" value={pw} onChange={(e) => setPw(e.target.value)} autoComplete="current-password" onKeyDown={(e) => e.key === 'Enter' && login()} /></label>
              <button type="button" className="btn btn--pri" onClick={login} disabled={busy || !email || !pw}>{busy ? '확인 중…' : '로그인'}</button>
            </div>
          )}
        </>
      )}
      {msg && <p className="sub st-msg">{msg}</p>}
      <SqlBox />
    </section>
  );
}

function SqlBox() {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const sql = `${CLOUD_SQL}\n\n${STUDY_SQL || ''}`.trim();
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(sql);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setOpen(true);
    }
  };
  return (
    <details className="st-det" open={open} onToggle={(e) => setOpen(e.currentTarget.open)}>
      <summary>처음 한 번: 서버에 표 만들기</summary>
      <ol className="st-steps">
        <li>아래 <b>SQL 복사</b>를 누르기</li>
        <li><a href="https://supabase.com/dashboard" target="_blank" rel="noreferrer">Supabase 대시보드</a> → 기록 앱 프로젝트 → 왼쪽 <b>SQL Editor</b></li>
        <li>붙여 넣고 <b>Run</b>. 'Success'가 나오면 끝 (여러 번 해도 괜찮아요)</li>
      </ol>
      <button type="button" className="btn" onClick={copy}>{copied ? '복사했어요' : 'SQL 복사'}</button>
      <pre className="st-sql">{sql}</pre>
    </details>
  );
}

function Sound() {
  const p = useData('prefs').main || {};
  const ja = hasJa();
  return (
    <section className="card">
      <div className="st-hd"><b>소리</b></div>
      {ja ? (
        <>
          <label className="st-tog"><input type="checkbox" checked={!!p.autoSpeak} onChange={(e) => save('prefs', 'main', { autoSpeak: e.target.checked })} /> 단어 소리 저절로 내기 (새 단어 볼 때·답할 때)</label>
          <button type="button" className="btn" onClick={() => speak('日本語能力試験に合格したい。')}>🔊 들어 보기</button>
        </>
      ) : (
        <p className="sub">이 기기에 일본어 목소리가 없어요. Windows: 설정 → 시간 및 언어 → 음성 → 음성 추가 → 일본어. 아이폰·맥은 기본으로 있어요.</p>
      )}
    </section>
  );
}

function Install() {
  return (
    <section className="card">
      <div className="st-hd"><b>앱처럼 설치하기</b></div>
      <ul className="st-steps st-steps--ul">
        <li><b>아이폰</b>: Safari로 이 주소 열기 → 아래 공유 버튼 → <b>홈 화면에 추가</b></li>
        <li><b>맥</b>: Safari 메뉴 <b>파일 → Dock에 추가</b> (또는 Chrome 주소창 오른쪽 설치 버튼)</li>
        <li><b>Windows PC</b>: Edge·Chrome 주소창 오른쪽 <b>앱 설치</b> 버튼</li>
      </ul>
      <p className="sub">한 번 열면 인터넷이 없어도 열리고, 공부한 건 다시 연결될 때 서버로 올라가요. 시험 끝나면 아이콘만 지우면 돼요.</p>
    </section>
  );
}

export default function Settings() {
  return (
    <div className="page st">
      <h1 className="h1">설정</h1>
      <Account />
      <Sound />
      <Install />
    </div>
  );
}
