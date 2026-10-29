#!/usr/bin/env python3
"""한자 부수·부품·닮은 한자·음독/훈독 표 만들기 → src/features/words/lists/parts.txt

쓰는 법: npm pack kanji (echamudi/japanese-toolkit) 을 풀고
  python3 tools/parts-build.py <package/dist/data>
- kanji-tree (KanjiVG, CC BY-SA 3.0) : 한자 → 한 단계 부품
- kanjidic (KANJIDIC2, EDRDG CC BY-SA 4.0) : 부수 번호(classical), 음독·훈독
- kanjium lookalikes (CC BY-SA 4.0) : 닮은 한자

한 줄: 字|부수 번호|부품(띄어쓰기)|닮은 한자|음독(,)|훈독(, 오쿠리가나 앞은 .)
단어 목록(n3·n2·n1.tsv)·hanja.txt 한자 + 상용·급수·빈도 있는 한자 + 그 부품(내려가며).
"""
import json
import os
import re
import sys

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..')
LISTS = os.path.join(ROOT, 'src', 'features', 'words', 'lists')
KANJI = re.compile(r'[㐀-鿿豈-﫿\U00020000-\U0002ffff]')


def kata2hira(s):
    return ''.join(chr(ord(c) - 0x60) if 'ァ' <= c <= 'ヶ' else c for c in s)


def load(path):
    try:
        with open(path, encoding='utf-8') as f:
            return json.loads(f.read().strip() or "null")
    except ValueError:
        return None
    except FileNotFoundError:
        return None


def main(data):
    want = []
    seen = set()
    for name in ('n3.tsv', 'n2.tsv', 'n1.tsv', 'hanja.txt'):
        with open(os.path.join(LISTS, name), encoding='utf-8') as f:
            for line in f:
                if line.startswith('#'):
                    continue
                head = line.split('\t' if name.endswith('.tsv') else '|')[0]
                for ch in KANJI.findall(head):
                    if ch not in seen:
                        seen.add(ch)
                        want.append(ch)
    # 상용 한자·급수 있는 한자도 (단어 목록에 없어도 箱·桶 처럼 다른 단어에서 만남)
    kd = os.path.join(data, 'kanjidic')
    for fn in sorted(os.listdir(kd)):
        d = load(os.path.join(kd, fn)) or {}
        misc = (d.get('misc') or [{}])[0]
        ch = (d.get('literal') or [''])[0]
        if ch and ch not in seen and (misc.get('grade') or misc.get('jlpt') or misc.get('freq')):
            seen.add(ch)
            want.append(ch)
    look = load(os.path.join(data, 'kanjium', 'kanjium-lookalikes.json')) or {}
    rows = []
    i = 0
    while i < len(want):
        ch = want[i]
        i += 1
        cp = '%05x' % ord(ch)
        tree = load(os.path.join(data, 'kanji-tree', cp + '.json')) or {}
        parts = [g.get('element', '') for g in tree.get('g', []) if g.get('element')]
        # 같은 부품만 둘(林 = 木 木) 이어도 그대로 둠
        for p in parts:
            if KANJI.match(p) and p not in seen:
                seen.add(p)
                want.append(p)
        dic = load(os.path.join(data, 'kanjidic', ('%x' % ord(ch)).upper() + '.json')) or load(os.path.join(data, 'kanjidic', '%x' % ord(ch) + '.json')) or {}
        rad = ''
        for r in (dic.get('radical') or [{}])[0].get('rad_value', []):
            if r.get('rad_type') == 'classical':
                rad = r['$t']
        on, kun = [], []
        for g in (dic.get('reading_meaning') or [{}])[0].get('rmgroup', []):
            for r in g.get('reading', []):
                t = r.get('$t', '')
                if r.get('r_type') == 'ja_on':
                    on.append(kata2hira(t))
                elif r.get('r_type') == 'ja_kun':
                    kun.append(t.replace('-', ''))
        lk = ''.join(x for x in look.get(ch, []) if x != ch)
        if not (rad or parts or on or kun):
            continue
        rows.append('|'.join([ch, rad, ' '.join(parts), lk, ','.join(on), ','.join(kun)]))
    out = os.path.join(LISTS, 'parts.txt')
    with open(out, 'w', encoding='utf-8') as f:
        f.write('# 字|부수 번호|부품|닮은 한자|음독|훈독 — tools/parts-build.py (KanjiVG·KANJIDIC2·kanjium, CC BY-SA, NOTICE.md)\n')
        f.write('\n'.join(rows) + '\n')
    print(len(rows), 'rows →', out)


if __name__ == '__main__':
    main(sys.argv[1])
