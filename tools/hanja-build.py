#!/usr/bin/env python3
"""단어 목록에 나오는 한자의 한국 음·훈 표 만들기 → src/features/words/lists/hanja.txt

쓰는 법: python3 tools/hanja-build.py <libhangul hanja.txt> <cjkvi jp-old-style.txt>
  · libhangul data/hanja/hanja.txt (BSD, Choe Hwanjin) — 한 글자 줄 '음:字:훈 음'
  · cjkvi-variants jp-old-style.txt — 일본 신자체 → 옛 글자(營·學 …). 한국 사전엔 옛 글자로만 있어서
한 줄 = 字|음(두 개면 '락·악')|훈|옛 글자(다를 때만). 한국 사전에 없는 일본 한자(込·働 …)는 뺌
"""
import re, sys, collections, pathlib

ROOT = pathlib.Path(__file__).resolve().parent.parent
WORDS = ROOT / 'src/features/words'
OUT = WORDS / 'lists/hanja.txt'
IS_KANJI = re.compile(r'[㐀-鿿豈-﫿]')
IVS = re.compile(r'[\U000e0100-\U000e01ef︀-️]')

# 두음법칙: ㄹ/ㄴ 으로 시작하는 본음을 고름 (落 낙 → 락: 일본 음 らく 와 맞음)
def initial(s):
    return (ord(s) - 0xAC00) // 588 if '가' <= s <= '힣' else -1
def tail(s):
    return (ord(s) - 0xAC00) % 588 if '가' <= s <= '힣' else -1
def medial(s):
    return ((ord(s) - 0xAC00) % 588) // 28
Y_VOWELS = {2, 6, 7, 12, 17, 20}  # ㅑㅕㅖㅛㅠㅣ: 리→이, 녀→여 / 나머지는 라→나
def dueum_pair(a, b):  # b 가 a 의 두음 변형 (락→낙, 리→이 …)
    if initial(a) not in (2, 5) or ord(b) - ord(a) != (initial(b) - initial(a)) * 588:
        return False
    return initial(b) == (11 if medial(a) in Y_VOWELS else 2) and initial(a) != initial(b)

# jp-old-style 에 없는 신자체 몇 개 (한국 사전 쪽 글자)
EXTRA_OLD = dict(zip('飲既寛併慎挿舗惧掴伜呟', '飮旣寬倂愼揷鋪懼摑倅呟'))

def main(hanja_path, old_path):
    d = collections.defaultdict(list)
    for line in open(hanja_path, encoding='utf-8'):
        if line.startswith('#'):
            continue
        p = line.rstrip('\n').split(':')
        if len(p) >= 3 and len(p[0]) == 1 and len(p[1]) == 1 and p[2]:
            d[p[1]].append((p[0], p[2]))
    old = {}
    for line in open(old_path, encoding='utf-8'):
        if line.startswith('#') or not line.strip():
            continue
        cols = [IVS.sub('', c) for c in line.rstrip('\n').split('\t')]
        if len(cols) >= 2 and len(cols[0]) == 1 and len(cols[1]) == 1 and cols[0] not in old:
            old[cols[0]] = cols[1]
    chars = set()
    for f in [*WORDS.glob('words*.txt'), *WORDS.glob('lists/n*.tsv')]:
        chars.update(IS_KANJI.findall(f.read_text(encoding='utf-8').split('\n', 1)[1]))
    for k, v in EXTRA_OLD.items():
        old.setdefault(k, v)
    chars.update(old.keys())
    rows = []
    for c in sorted(chars):
        src = c if c in d else old.get(c)
        if not src or src not in d:
            continue
        ents = d[src]
        sounds = [s for s, _ in ents]
        keep = [e for e in ents if not any(dueum_pair(o, e[0]) for o in sounds if o != e[0])]
        keep = keep[:2]
        hun = keep[0][1].split(',')[0].strip()
        rows.append('|'.join([c, '·'.join(s for s, _ in keep), hun] + ([src] if src != c else [])))
    head = ('# 한자 → 한국 음·훈 (字|음|훈|옛 글자). tools/hanja-build.py 로 만듦\n'
            '# 출처: libhangul hanja.txt (BSD, Copyright (c) 2005,2006 Choe Hwanjin), cjkvi-variants jp-old-style.txt (Taichi Kawabata)\n')
    OUT.write_text(head + '\n'.join(rows) + '\n', encoding='utf-8')
    print(len(rows), 'chars →', OUT)

if __name__ == '__main__':
    main(*sys.argv[1:3])
