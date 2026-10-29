// 메뉴 = 기능 하나에 한 줄. 화면은 src/features/<폴더>/index.jsx (default export, props 없음)
import { lazy } from 'react';

export const FEATURES = [
  { key: 'exam', label: '시험', icon: '試', C: lazy(() => import('./exam')) },
  { key: 'words', label: '단어', icon: '語', C: lazy(() => import('./words')) },
  { key: 'grammar', label: '문법', icon: '文', C: lazy(() => import('./grammar')) },
  { key: 'reading', label: '독해·청해', icon: '読', C: lazy(() => import('./reading')) },
  { key: 'stats', label: '기록', icon: '録', C: lazy(() => import('./stats')) },
  { key: 'settings', label: '설정', icon: '設', C: lazy(() => import('./settings')) },
];
