// 한자 부수·부품·닮은 한자 + 음독/훈독 가르기 (lists/parts.txt, tools/parts-build.py 로 만듦)
import { HANJA, readingParts } from './hanja';
import { PARTS, readingKind } from './kanjidic';

export { PARTS, readingKind };

// 강희 부수 214개: [글자, 한국 이름(훈 음)]
const RAD_LIST = `一 한 일|丨 뚫을 곤|丶 점 주|丿 삐침 별|乙 새 을|亅 갈고리 궐|二 두 이|亠 돼지해머리 두|人 사람 인|儿 어진사람 인|入 들 입|八 여덟 팔|冂 멀 경|冖 민갓머리 멱|冫 이수변 빙|几 안석 궤|凵 위터진입구 감|刀 칼 도|力 힘 력|勹 쌀 포|匕 비수 비|匚 상자 방|匸 감출 혜|十 열 십|卜 점 복|卩 병부 절|厂 굴바위 엄|厶 마늘 모|又 또 우|口 입 구|囗 에운담 위|土 흙 토|士 선비 사|夂 뒤져올 치|夊 천천히걸을 쇠|夕 저녁 석|大 큰 대|女 여자 녀|子 아들 자|宀 갓머리 면|寸 마디 촌|小 작을 소|尢 절름발이 왕|尸 주검 시|屮 싹날 철|山 메 산|巛 개미허리 천|工 장인 공|己 몸 기|巾 수건 건|干 방패 간|幺 작을 요|广 엄호 엄|廴 민책받침 인|廾 스물입발 공|弋 주살 익|弓 활 궁|彐 튼가로왈 계|彡 터럭 삼|彳 두인변 척|心 마음 심|戈 창 과|戶 지게 호|手 손 수|支 지탱할 지|攴 칠 복|文 글월 문|斗 말 두|斤 도끼 근|方 모 방|无 없을 무|日 날 일|曰 가로 왈|月 달 월|木 나무 목|欠 하품 흠|止 그칠 지|歹 부서진뼈 알|殳 갖은등글월문 수|毋 말 무|比 견줄 비|毛 털 모|氏 각시 씨|气 기운 기|水 물 수|火 불 화|爪 손톱 조|父 아비 부|爻 점괘 효|爿 장수장변 장|片 조각 편|牙 어금니 아|牛 소 우|犬 개 견|玄 검을 현|玉 구슬 옥|瓜 오이 과|瓦 기와 와|甘 달 감|生 날 생|用 쓸 용|田 밭 전|疋 필 필|疒 병질엄 녁|癶 필발머리 발|白 흰 백|皮 가죽 피|皿 그릇 명|目 눈 목|矛 창 모|矢 화살 시|石 돌 석|示 보일 시|禸 짐승발자국 유|禾 벼 화|穴 구멍 혈|立 설 립|竹 대 죽|米 쌀 미|糸 실 사|缶 장군 부|网 그물 망|羊 양 양|羽 깃 우|老 늙을 로|而 말이을 이|耒 쟁기 뢰|耳 귀 이|聿 붓 율|肉 고기 육|臣 신하 신|自 스스로 자|至 이를 지|臼 절구 구|舌 혀 설|舛 어그러질 천|舟 배 주|艮 그칠 간|色 빛 색|艸 풀 초|虍 범호엄 호|虫 벌레 충|血 피 혈|行 다닐 행|衣 옷 의|襾 덮을 아|見 볼 견|角 뿔 각|言 말씀 언|谷 골 곡|豆 콩 두|豕 돼지 시|豸 갖은돼지시변 치|貝 조개 패|赤 붉을 적|走 달릴 주|足 발 족|身 몸 신|車 수레 거|辛 매울 신|辰 별 진|辵 쉬엄쉬엄갈 착|邑 고을 읍|酉 닭 유|釆 분별할 변|里 마을 리|金 쇠 금|長 길 장|門 문 문|阜 언덕 부|隶 미칠 이|隹 새 추|雨 비 우|靑 푸를 청|非 아닐 비|面 낯 면|革 가죽 혁|韋 다룸가죽 위|韭 부추 구|音 소리 음|頁 머리 혈|風 바람 풍|飛 날 비|食 밥 식|首 머리 수|香 향기 향|馬 말 마|骨 뼈 골|高 높을 고|髟 터럭 표|鬥 싸울 투|鬯 울창주 창|鬲 솥 력|鬼 귀신 귀|魚 물고기 어|鳥 새 조|鹵 소금 로|鹿 사슴 록|麥 보리 맥|麻 삼 마|黃 누를 황|黍 기장 서|黑 검을 흑|黹 바느질할 치|黽 맹꽁이 맹|鼎 솥 정|鼓 북 고|鼠 쥐 서|鼻 코 비|齊 가지런할 제|齒 이 치|龍 용 룡|龜 거북 귀|龠 피리 약`
  .split('|')
  .map((s) => {
    const [c, ...name] = s.split(' ');
    return [c, name.join(' ')];
  });
export const RAD = (n) => (n >= 1 && n <= 214 ? { n, ch: RAD_LIST[n - 1][0], name: RAD_LIST[n - 1][1] } : null);

// 변·머리 모양 (한자 안에서 바뀐 모습) → [부수 번호, 이름]
const VARIANT = {
  亻: [9, '사람인변'], 刂: [18, '선칼도방'], 忄: [61, '심방변'], 㣺: [61, '마음심발'], 扌: [64, '재방변'], 氵: [85, '삼수변'],
  灬: [86, '연화발'], 犭: [94, '개사슴록변'], 王: [96, '구슬옥변'], 礻: [113, '보일시변'], 衤: [145, '옷의변'], 艹: [140, '초두머리'],
  '⺾': [140, '초두머리'], '⻌': [162, '책받침'], 辶: [162, '책받침'], 罒: [122, '그물망머리'], 攵: [66, '등글월문'], 爫: [87, '손톱조머리'],
  冫: [15, '이수변'], 𠆢: [9, '사람인머리'], '⺍': [42, '작을소머리'], 耂: [125, '늙을로엄'], 肀: [129, '붓율머리'], '⺌': [42, '작을소머리'],
  飠: [184, '밥식변'], 糹: [120, '실사변'], 訁: [149, '말씀언변'], 釒: [167, '쇠금변'], 㓁: [122, '그물망머리'], '⺤': [87, '손톱조머리'],
  '⻖': [170, '좌부변 (언덕 부)'], '⻏': [163, '우부방 (고을 읍)'],
  歺: [78, '부서진뼈알변'], 彑: [58, '튼가로왈'], 夊: [35, '천천히걸을쇠'], 尣: [43, '절름발이왕'], 旡: [71, '이미기방'],
};
// 왼쪽 阝 = 언덕 부(좌부변), 오른쪽 阝 = 고을 읍(우부방)
const sideAo = (ch, parts) => (parts[0] === '阝' ? [170, '좌부변 (언덕 부)'] : parts.at(-1) === '阝' ? [163, '우부방 (고을 읍)'] : null);

// 부품 하나의 이름: 변 모양 이름 · 한국 훈음 · 부수 이름
export function partName(p) {
  if (VARIANT[p]) return VARIANT[p][1];
  if (p === '阝') return '좌부변·우부방';
  const h = HANJA.get(p);
  if (h?.hun) return h.hun;
  const i = RAD_LIST.findIndex((x) => x[0] === p);
  return i >= 0 ? RAD_LIST[i][1] : '';
}

// 한자의 부수 { n, ch 원래 부수 글자, form 이 한자 안에서의 모습, name, formName }
export function radicalOf(ch) {
  const info = PARTS.get(ch);
  if (!info?.rad) return null;
  const r = RAD(info.rad);
  if (!r) return null;
  let form = r.ch;
  let formName = '';
  const side = info.parts.includes('阝') && sideAo(ch, info.parts);
  if (side && side[0] === info.rad) {
    form = '阝';
    formName = side[1];
  } else {
    const v = info.parts.find((p) => VARIANT[p]?.[0] === info.rad);
    if (v) {
      form = v;
      formName = VARIANT[v][1];
    }
  }
  return { ...r, form, formName };
}

// 단어 전체: { parts: [{ k, r, kind } | { kana }], type }
//  type: on 음독만 · kun 훈독만 · jubako 음+훈(重箱読み) · yuto 훈+음(湯桶読み) · mix 섞임 · special 사전에 없는 특별한 읽기(土産 みやげ 같은 熟字訓)
export function wordKinds(w, r) {
  const parts = readingParts(w, r);
  if (!parts) return null;
  const out = parts.map((p) => (p.k ? { ...p, kind: readingKind(p.k, p.r) } : p));
  const ks = out.filter((p) => p.k).map((p) => p.kind);
  let type = '';
  if (ks.length && ks.every((k) => k === 'on')) type = 'on';
  else if (ks.length && ks.every((k) => k === 'kun')) type = 'kun';
  else if (ks.length === 2 && ks[0] === 'on' && ks[1] === 'kun') type = 'jubako';
  else if (ks.length === 2 && ks[0] === 'kun' && ks[1] === 'on') type = 'yuto';
  else if (ks.length && ks.every(Boolean)) type = 'mix';
  else if (ks.length) type = 'special';
  return { parts: out, type, tail: out.some((p) => p.kana && out.indexOf(p) > 0) };
}

export const KIND_KO = { on: '음독', kun: '훈독' };
export const TYPE_KO = { on: '음독 + 음독', kun: '훈독', jubako: '음 + 훈 (重箱読み)', yuto: '훈 + 음 (湯桶読み)', mix: '섞임', special: '특별한 읽기 (통째로)' };

// 이 단어 모양으로 짐작하는 규칙 (화면 '어떻게 알아보나')
export function kindTip(w, r) {
  const k = wordKinds(w, r);
  if (!k) return '';
  const n = k.parts.filter((p) => p.k).length;
  if (k.type === 'on') return n > 1 ? '한자 두 개 이상, 뒤에 히라가나 없음 → 대개 음독' : '한자 하나뿐인 음독 단어 (드묾 · 외워 두기)';
  if (k.type === 'kun') return k.tail ? '한자 뒤에 히라가나(오쿠리가나)가 붙음 → 대개 훈독' : n === 1 ? '한자 하나만 → 훈독일 때가 많음' : '한자 두 개인데 훈독 (예외 · 외워 두기)';
  if (k.type === 'jubako') return '앞은 음독, 뒤는 훈독 (重箱 じゅう+ばこ 모양 · 외워 두기)';
  if (k.type === 'yuto') return '앞은 훈독, 뒤는 음독 (湯桶 ゆ+とう 모양 · 외워 두기)';
  if (k.type === 'special') return '한자 하나하나의 소리가 아니라 단어 통째로 읽는 말 (熟字訓 · 외워 두기)';
  return '';
}
