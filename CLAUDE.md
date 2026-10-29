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
- 단어 급수 목록 `words/lists/n3·n2·n1.tsv`(open-anki-jlpt-decks, MIT, NOTICE.md) + 한국어 뜻 `lists/ko.txt`(단어|읽기|뜻, 없으면 영어 뜻) · 고른 급수 `prefs.main.levels`
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

## 단어 외우기 (`src/features/words/` Learn.jsx · learn.js · hanja.js · N1Quiz.jsx · n1quiz.js)
- '오늘 단어' = `Study`: 복습(한자 단어는 읽기 직접 입력 → 뜻 4개 중 고르기 → 몰랐음/알았음) → 새 단어 5개씩 `BATCH` 먼저 보기('이미 알아요' 가능) → 바로 그 5개 퀴즈(틀리면 줄 끝에 다시) → 배우는 중
- 배우는 중 = 카드에 `ls`(단계)·`la`(다시 볼 시각 ms). 배운 뒤·틀린 뒤 10분(`RELEARN_MIN`) 지나면 다시, 맞히면 srs grade 로 졸업. 저장은 `save('words', id, () => 새 상태)` 통째로
- 로마자 → 히라가나 `toKana`(치는 중) · `finishKana` · `sameReading`(가타카나도 같게)
- 한자 한국 음·훈 `lists/hanja.txt`(字|음|훈|옛 글자) ← `python3 tools/hanja-build.py <libhangul hanja.txt> <cjkvi jp-old-style.txt>` (출처 NOTICE.md). 받침 → 음독 규칙 `onHint`, 같은 한자 단어 `siblings`(본 단어 먼저)
- N1 모양 문제 `makeQuiz`: ctx 문맥(빈칸, 활용 꼬리 `slotOf`) · para 言い換え(한국어 뜻 조각 겹치는 단어) · use 用法(명사·형용사·부사만, 다른 예문에 넣은 것이 틀린 보기). 틀린 단어는 10분 뒤 복습 / 안 배운 건 `pri`
- 복습 관리(Leech.jsx): 첫 화면 `ReviewPlan` 앞으로 7일 복습 `forecast` · 하루 상한 `prefs.main.revCap`(기본 200, 0 = 없음, `reviewIds(…, cap)` 배우는 중은 다·나머지는 간격 짧은 것부터, 넘친 건 날짜 안 바꾸고 다음 날) · 틀린 복습은 원래 간격을 `pi`에 기억 → 다시 맞히면 절반 뒤
- 안 외워지는 단어 `isLeech`(틀림 `l` ≥ 4, 간격 3주 미만) → `LeechStudy`(헷갈린 짝 `cf` = 뜻 고르기에서 대신 고른 단어 최근 3개, 나만의 기억 이야기 `mn` → 틀리면 힌트로). 이 화면은 복습 날짜를 안 바꿈
- 장음: `hanja.js readingParts(단어, 읽기)` = 단어 목록 전체로 한자별 소리를 세서(onTable) 읽기를 한자마다 나눔(道=どう·路=ろ), `longAt`·`isLong`(같은 소리 이어짐 ああ·いい·うう·ええ·おお + 오단+う·에단+い + ー), `longNote`는 음독 장음(오·우단+う, 에단+い)일 때만 — ちい·にい·おお 같은 훈독 장음엔 한국 음 안내 안 함, `longNote`(한국 음 받침 ㅇ·ㅂ → 길게가 규칙, 받침 없는데 길면 '외워 두기'), `soundsOf` 다른 말에서 읽는 소리
- 학습량 늘리기: 맞히면 0.65초 뒤 저절로 다음(Check `AUTO_MS`, 틀렸을 때만 멈춤·review 는 그때만 몰랐음/알았음) · 빨리 맞힌 복습 `isFast`(뜻 3초·읽기 4초+글자당 0.6초) → `answer(…, { fast })` 쉬움(4) · 복습 읽기 치기 `needRead`(`prefs.main.readMode` 'smart' 기본: 배우는 중·간격 7일 미만·읽기 틀린 뒤 `rx`(틀리면 2, 맞히면 -1)·n%3==0 / 'all') · 하루 필요 수 `paceNeed`(시험 1주 전까지) · 새 단어 순서 `prefs.main.order` easy N3부터(기본)·exam N1 먼저·mix 고르게 섞기(`allWords(own, levels, order)`) · '빠르게 거르기'는 순서와 상관없이 N3부터
- 한자 공부(`Kanji.jsx`, 단어 첫 화면 '부수로 한자 보기'·'음독·훈독 연습' → mode 'kanji'·'onkun'): 틀린 단어(`l` 많은 순, 없으면 최근 본 단어 `myWords`)의 한자를 부수로 묶기 `radicalGroups`(한자 누르면 부품·음독·훈독·닮은 한자·같은 한자 단어) + 부수 퀴즈 · 음독/훈독 알아보는 법 + 맞히기 퀴즈 `makeOnKun`(음독·훈독·음+훈·훈+음)
- 한자 자료 `lists/parts.txt`(字|부수 번호|부품|닮은 한자|음독|훈독) ← `python3 tools/parts-build.py <npm kanji 패키지 dist/data>` (KanjiVG·KANJIDIC2·kanjium, CC BY-SA, NOTICE.md). `kanjidic.js` PARTS·`readingKind(字, 소리)`(흐려짐·っ·훈독 명사꼴 たち 도 같게) → hanja.js 한자마다 나누기 점수에도 씀 · `kanji.js` 부수 214 한국 이름 `RAD_LIST`·변 모양 `VARIANT`, `radicalOf`·`partName`·`wordKinds`(type on·kun·jubako·yuto·mix·special)·`kindTip`. 한자 카드(KanjiParts)에 음독/훈독 표·부수
- 테스트 `tests/learn.test.js` · `tests/kanji.test.js`
