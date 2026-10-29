import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// base './' → GitHub Pages(…/jlpt/)에서도, 파일로 열어도 경로가 맞음
export default defineConfig({
  base: './',
  plugins: [react()],
  test: { environment: 'jsdom' },
});
