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
