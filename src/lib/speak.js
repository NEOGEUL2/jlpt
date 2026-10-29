// 일본어 소리 (기기 음성 합성). 아이폰·맥은 일본어 목소리가 기본으로 있음, Windows는 '일본어 음성'을 깔아야 할 수도
let voice = null;
function pick() {
  if (typeof speechSynthesis === 'undefined') return null;
  const vs = speechSynthesis.getVoices().filter((v) => /^ja(-|_|$)/i.test(v.lang));
  voice = vs.find((v) => /Kyoko|O-ren|Otoya|Nanami|Google/i.test(v.name)) || vs[0] || null;
  return voice;
}
if (typeof speechSynthesis !== 'undefined') speechSynthesis.addEventListener?.('voiceschanged', pick);

export const hasJa = () => !!(voice || pick());

export function speak(text, rate = 1) {
  if (typeof speechSynthesis === 'undefined' || !text) return;
  speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text);
  u.lang = 'ja-JP';
  if (voice || pick()) u.voice = voice;
  u.rate = rate;
  speechSynthesis.speak(u);
}
