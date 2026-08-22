"""DUGA の作品データCSVから、足フェチに関わるカテゴリのデータを取り出す。

出典: DUGA アフィリエイト「作品データCSV」
      https://duga.jp/productcsv/

DUGA が公式に付けているカテゴリだけを使う。題名や紹介文に「ストッキング」
などの語が出てくるだけの作品は拾わない。それをやると該当しない作品まで
混ざり、推測でデータを作ることになるため。

  カテゴリで拾える   2,020作品 / 2,348人
  語まで拾うと      12,264作品 / 6,704人（うち1万件は推測）

作品のタイトルと紹介文は載せない。露骨な語を含むものが多いため、
持つのは出演者名・カテゴリ・作品数・リンク先だけにする。

使い方: python scripts/build-data.py public/data/performers.json
"""
import csv
import io
import json
import re
import sys
import urllib.request
from collections import Counter, defaultdict
from datetime import date
from pathlib import Path

CSV_URL = 'https://duga.jp/productcsv/'
UA = ('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 '
      '(KHTML, like Gecko) Chrome/131.0 Safari/537.36')

# 扱うカテゴリと、画面に出すときの言い方。DUGA の分類名をそのまま使う。
CATEGORIES = {
    'パンスト': {'slug': 'pantyhose', 'label': 'パンスト'},
    '足裏': {'slug': 'sole', 'label': '足裏'},
    'ソックス': {'slug': 'socks', 'label': 'ソックス'},
}

SKIP_NAMES = {'不明', '素人', '一般女性', '（不明）', '-', '―'}

# レーベル名に露骨な語が入っているものは出さない（darenano と同じ扱い）。
EXPLICIT = (
    '排泄', '浣腸', '放尿', '小便', 'ウンコ', '糞', 'ゲロ', '嘔吐', 'スカトロ',
    'フェラ', '手コキ', '素股', 'ハメ', '中出し', 'アナル', '潮吹', '射精', '精子',
    '乱交', '輪姦', 'レイプ', '強姦', '近親', '痴漢', '露出', '奴隷', '調教',
    '無修正', 'ロリ', '児童', 'JK', '女子校', 'アヘ', 'アへ', '羞恥',
)


def displayable(label: str) -> bool:
    return bool(label) and not any(word in label for word in EXPLICIT)


def download() -> bytes:
    cache = Path(__file__).resolve().parent / '.cache' / 'duga-products.csv'

    if cache.exists():
        return cache.read_bytes()

    print('作品データCSVを取得します（約130MB）。', file=sys.stderr)
    request = urllib.request.Request(CSV_URL, headers={'User-Agent': UA})

    with urllib.request.urlopen(request, timeout=300) as response:
        data = response.read()

    cache.parent.mkdir(parents=True, exist_ok=True)
    cache.write_bytes(data)

    return data


def parse_date(text: str) -> str:
    matched = re.match(r'(\d{4})年(\d{1,2})月(\d{1,2})日', (text or '').strip())

    if not matched:
        return ''

    return '{}-{:02d}-{:02d}'.format(matched.group(1), int(matched.group(2)), int(matched.group(3)))


def main() -> None:
    output = Path(sys.argv[1])
    reader = csv.DictReader(io.StringIO(download().decode('cp932', 'replace')))

    people: dict[str, dict] = {}
    totals = Counter()
    scanned = 0

    for row in reader:
        scanned += 1
        categories = {c.strip() for c in (row.get('カテゴリ') or '').split(',') if c.strip()}
        matched = categories & CATEGORIES.keys()

        if not matched:
            continue

        for category in matched:
            totals[category] += 1

        product_id = (row.get('商品ID') or '').strip()
        opened = parse_date(row.get('公開開始日') or '')
        label = (row.get('レーベル名') or '').strip()

        for name in (row.get('出演者') or '').split(','):
            name = name.strip()

            if not name or name in SKIP_NAMES:
                continue

            person = people.setdefault(name, {
                'name': name,
                'works': 0,
                'categories': Counter(),
                'labels': Counter(),
                'productId': '',
                'productOpenedOn': '',
                'firstOpenedOn': '',
                'lastOpenedOn': '',
            })

            person['works'] += 1
            person['categories'].update(matched)

            if displayable(label):
                person['labels'][label] += 1

            if product_id and opened >= person['productOpenedOn']:
                person['productId'] = product_id
                person['productOpenedOn'] = opened

            if opened:
                if not person['firstOpenedOn'] or opened < person['firstOpenedOn']:
                    person['firstOpenedOn'] = opened
                if opened > person['lastOpenedOn']:
                    person['lastOpenedOn'] = opened

    records = []
    for person in people.values():
        categories = person.pop('categories')
        labels = person.pop('labels')
        person['categories'] = {name: count for name, count in categories.most_common()}
        person['labels'] = [name for name, _ in labels.most_common(3)]
        records.append(person)

    records.sort(key=lambda r: (-r['works'], r['name']))

    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(json.dumps({
        'confirmedOn': date.today().isoformat(),
        'sourceLabel': 'DUGA 作品データCSV',
        'sourceUrl': CSV_URL,
        'scannedItems': scanned,
        'categories': [
            {'name': name, **info, 'works': totals[name]}
            for name, info in CATEGORIES.items()
        ],
        'performers': records,
    }, ensure_ascii=False), encoding='utf-8')

    print(f'{scanned:,}作品を確認し、{sum(totals.values()):,}件が該当しました。')
    for name, info in CATEGORIES.items():
        count = sum(1 for r in records if name in r['categories'])
        print(f"  {info['label']}: {totals[name]:,}作品 / 出演者 {count:,}人")
    print(f'出演者は のべ {len(records):,}人 → {output}')


main()
