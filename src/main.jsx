import { createRoot } from 'react-dom/client';
import App from './App';
import './ui.css';

createRoot(document.getElementById('root')).render(<App />);

// 오프라인에서도 열리게 (홈 화면에 추가한 아이폰 · 설치한 PC/맥 앱)
if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => navigator.serviceWorker.register('./sw.js').catch(() => {}));
}
