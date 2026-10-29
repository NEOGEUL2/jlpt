# N1 공부 (JLPT N1 혼자 공부 앱)

시험(2026-12-06)까지 쓰는 가벼운 앱. 기록(Girok, NEOGEUL2/planner) 앱과 **따로**, 같은 Supabase 계정만 함께 씀.
사용자는 개발자가 아니다. **답변은 한국어**로, 쉬운 말로, 할 일은 순서대로.

## 스택
- Vite 5 + React 18, 라우터·상태 라이브러리 없음, CSS 파일만 (`src/ui.css` 공통 토큰·부품)
- PWA: `public/manifest.webmanifest`, `public/sw.js`. GitHub Pages(`.github/workflows/pages.yml`)로 배포 → 아이폰 Safari '홈 화면에 추가', 맥·PC Chrome/Edge '앱 설치'
- `npm test` (vitest), `npm run build`

## 구조 (기능마다 폴더 하나)
- 메뉴 등록: `src/features/index.js` 한 줄 `{ key, label, icon(한자 한 글자), C: lazy(() => import('./폴더')) }`
- 화면: `src/features/<폴더>/index.jsx` (default export, props 없음) · 로직·데이터·CSS도 그 폴더 안
  - `words/` 단어 카드 · `grammar/` 문법 퀴즈 · `reading/` 독해·청해 · `stats/` 공부 기록 · `settings/` 설정(서버 연결·로그인)
- 공통 `src/lib/`: `store.js` 저장 · `supabase.js` 서버 연결 · `srs.js` 복습 주기(단어·문법 같이) · `dates.js` · `studylog.js` 공부 시간
- 다른 메뉴로 보내기: `window.dispatchEvent(new CustomEvent('jlpt-go', { detail: 'words' }))`

## 저장 규칙
- `useData(묶음)` → `{ id: 기록 }`, `save(묶음, id, patch)`, `remove(묶음, id)` (src/lib/store.js). localStorage 직접 쓰지 말 것 (기기별 화면 기억만 `jlpt:` 접두어)
- 묶음: `words` 단어 복습 상태 · `own` 교재에서 넣은 단어 · `grammar` 문법 · `drill` 독해·청해 · `prefs` 설정(id 'main')
- 기록마다 `u`(고친 시각)가 자동으로 붙고 기기 사이에선 u가 나중인 쪽이 이김. 서버 표 `jlpt_data`(SQL은 store.js `CLOUD_SQL`)
- 공부 시간: `studylog.js` `logStudy({ part, sec, n, ok, learned, what })` · `startTimer(part, what, { idleMs })` → `{ add, finish, stop }` · React는 `useStudyTimer(part, what)` → `{ sec, paused, add, finish }`. 이 기기 `jlpt:study`·안 올린 것 `jlpt:study-q` → 서버 표 `study_log`(SQL `STUDY_SQL`, Girok sync.js 와 같게) → 기록 앱이 읽어서 보여 줌. 화면 `features/stats`(목표 `prefs.main.goalMin`)
- **교재(다락원 한권으로 끝내기 N1) 내용은 저장소에 넣지 말 것** (공개 저장소). 교재에서 옮긴 단어·문제는 사용자 기록(`own` 등)으로만

## 문법 퀴즈 (`src/features/grammar/`)
- `data.js` N1 문법(직접 만든 것, 교재 내용 아님) `{ id, f 문법, m 뜻, c 접속, g 묶음, ex {j,k}, q {s '（　）' 자리, a 정답, w 틀린 보기 3} }` — 새 문법은 여기 더하고 `grammar.test.js` 통과 확인. id는 기록 열쇠라 바꾸지 말 것
- `quiz.js` 문제 종류 fill 빈칸·star ★ 문장 만들기·mean 뜻·form 문법, 틀린 보기는 같은 묶음 먼저(뜻 조각 겹치면 뺌 `sameMeaning`), 결과 → 등급 `gradeOf`(틀림 1 · 12초+ 2 · 보통 3 · 4초 안 4)
- `more.js` 문법마다 더 붙는 것(같은 id): `n` 비슷한 문법과 차이 · `qk` q 번역 · `x` 빈칸 문장 2개 `['…【답】…', 한국어, 틀린 보기 3]` · `st` ★ 문장 만들기 `[앞, 조각 4개(맞는 순서), 뒤, ★ 자리]`. 빈칸 문장은 볼 때마다 돌아감(`sentences`, 본 횟수 n+l), 다시 풀기는 다른 문장(`againOf`)
- `gloss.js` `glossOf(보기)` → 답 화면 '보기 뜻'. 목록에 없는 보기는 `EXTRA`에 — 새 보기를 넣으면 테스트가 뜻 없는 보기를 알려 줌
- 처음 보는 문법(`!cards[id].t`)은 소개 카드(Intro) 먼저, ★ 문제는 익숙해진 뒤에만. ★는 시험처럼 ★ 자리로 채점, 시간 기준 30초/10초
- `Quiz.jsx` 화면(저장 함수는 props로), `index.jsx`가 store '문법' 묶음·srs·studylog 이어 줌. 하루 새 문법 10개, 틀린 건 판 끝에 한 번 더(기록은 처음 푼 것만), 홈에 '헷갈리는 묶음끼리 풀기'. 기기별 기억 `jlpt:gq-kinds`(+`jlpt:gq-star` ★를 예전 선택에 한 번 더해 줌)

## 독해·청해 (`src/features/reading/`)
- 교재에서 푼 문제를 적는 곳(문제 본문은 안 넣음). 로직 `drill.js`(+`drill.test.js`), 화면 `index.jsx`(홈·적기·다시 풀기·오답 노트), CSS `reading.css`
- 묶음 `drill` 기록 `{ id, date, section, mondai(r8~r13·l1~l5), page, label, total, correct, min, wrong: [{ id, q, mine, answer, reason, note, rv }] }`
- 틀린 문제 다시 풀기 `rv { step, due, done, hist }`: 맞히면 1→3→7일 뒤, 세 번이면 다 앎, 틀리면 내일부터 다시 (`STEPS`)
- 공부 시간: 기록 하나 = `logStudy` 한 줄(id `drill-<기록 id>`, 고치면 같은 줄) · 다시 풀기는 `useStudyTimer`
