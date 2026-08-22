"""DUGA ウェブサービスから、作品データCSVに無い項目を取る。

出典: DUGA アフィリエイト Web サービス
      https://affiliate.duga.jp/

CSVには次が無い。
  - 出演者の読み仮名と出演者ID（CSVは氏名だけ）
  - レビューの評価と件数
  - マイリストへの登録数
  - シリーズ名

読み仮名が取れると五十音で引けるようになり、評価と登録数は
DUGAが公表している実数なので、推測せずに人気の目安を出せる。

対象はカテゴリで絞る。足裏・パンスト・ソックスの3つだけなので、
全商品を巡回する必要がなく、20分ほどで終わる。

  足裏     category=1302     483件
  パンスト  category=100015  1,544件
  ソックス  category=100014    151件

APIの制限は60秒あたり60回。1.2秒の間隔を空ける。
appid は環境変数 DUGA_APP_ID から読む。リポジトリには置かない。

使い方: DUGA_APP_ID=xxx python scripts/fetch-api-details.py public/data/api-details.json
"""
import json
import os
import sys
import time
import urllib.parse
import urllib.request
from collections import Counter, defaultdict
from datetime import date
from pathlib import Path

API = 'http://affapi.duga.jp/search'
HITS = 100
INTERVAL = 1.2

CATEGORIES = {
    '足裏': '1302',
    'パンスト': '100015',
    'ソックス': '100014',
}

SKIP_NAMES = {'不明', '素人', '一般女性', '（不明）', '-', '―'}

HALF_TO_FULL = {
    'ｱ': 'ア', 'ｲ': 'イ', 'ｳ': 'ウ', 'ｴ': 'エ', 'ｵ': 'オ', 'ｶ': 'カ', 'ｷ': 'キ', 'ｸ': 'ク',
    'ｹ': 'ケ', 'ｺ': 'コ', 'ｻ': 'サ', 'ｼ': 'シ', 'ｽ': 'ス', 'ｾ': 'セ', 'ｿ': 'ソ', 'ﾀ': 'タ',
    'ﾁ': 'チ', 'ﾂ': 'ツ', 'ﾃ': 'テ', 'ﾄ': 'ト', 'ﾅ': 'ナ', 'ﾆ': 'ニ', 'ﾇ': 'ヌ', 'ﾈ': 'ネ',
    'ﾉ': 'ノ', 'ﾊ': 'ハ', 'ﾋ': 'ヒ', 'ﾌ': 'フ', 'ﾍ': 'ヘ', 'ﾎ': 'ホ', 'ﾏ': 'マ', 'ﾐ': 'ミ',
    'ﾑ': 'ム', 'ﾒ': 'メ', 'ﾓ': 'モ', 'ﾔ': 'ヤ', 'ﾕ': 'ユ', 'ﾖ': 'ヨ', 'ﾗ': 'ラ', 'ﾘ': 'リ',
    'ﾙ': 'ル', 'ﾚ': 'レ', 'ﾛ': 'ロ', 'ﾜ': 'ワ', 'ｦ': 'ヲ', 'ﾝ': 'ン',
    'ｧ': 'ァ', 'ｨ': 'ィ', 'ｩ': 'ゥ', 'ｪ': 'ェ', 'ｫ': 'ォ', 'ｬ': 'ャ', 'ｭ': 'ュ', 'ｮ': 'ョ',
    'ｯ': 'ッ', 'ｰ': 'ー',
}
VOICED = {'ｶ': 'ガ', 'ｷ': 'ギ', 'ｸ': 'グ', 'ｹ': 'ゲ', 'ｺ': 'ゴ', 'ｻ': 'ザ', 'ｼ': 'ジ',
          'ｽ': 'ズ', 'ｾ': 'ゼ', 'ｿ': 'ゾ', 'ﾀ': 'ダ', 'ﾁ': 'ヂ', 'ﾂ': 'ヅ', 'ﾃ': 'デ',
          'ﾄ': 'ド', 'ﾊ': 'バ', 'ﾋ': 'ビ', 'ﾌ': 'ブ', 'ﾍ': 'ベ', 'ﾎ': 'ボ', 'ｳ': 'ヴ'}
SEMI = {'ﾊ': 'パ', 'ﾋ': 'ピ', 'ﾌ': 'プ', 'ﾍ': 'ペ', 'ﾎ': 'ポ'}


def to_hiragana(text: str) -> str:
    """DUGA の読みは半角カナ。全角にしてから、ひらがなに寄せる。"""
    out = []
    index = 0

    while index < len(text):
        char = text[index]
        mark = text[index + 1] if index + 1 < len(text) else ''

        if mark == 'ﾞ' and char in VOICED:
            out.append(VOICED[char])
            index += 2
        elif mark == 'ﾟ' and char in SEMI:
            out.append(SEMI[char])
            index += 2
        else:
            out.append(HALF_TO_FULL.get(char, char))
            index += 1

    katakana = ''.join(out).replace(' ', '').replace('　', '')

    return ''.join(
        chr(ord(c) - 0x60) if 'ァ' <= c <= 'ヶ' else c
        for c in katakana
    )


def first(value) -> dict:
    """APIは要素が1つでも配列で返す。最初の1つを辞書として取り出す。"""
    if isinstance(value, list):
        return value[0] if value and isinstance(value[0], dict) else {}
    return value if isinstance(value, dict) else {}


def number(value) -> float:
    """「2,473」のように桁区切りが入ることがある。"""
    try:
        return float(str(value).replace(',', ''))
    except (TypeError, ValueError):
        return 0.0


def call(credentials: dict, category: str, offset: int) -> dict:
    params = dict(credentials, version='1.2', bannerid='01', format='json',
                  category=category, hits=HITS, offset=offset, sort='favorite')
    query = urllib.parse.urlencode(params)

    for attempt in range(5):
        try:
            with urllib.request.urlopen(f'{API}?{query}', timeout=60) as response:
                return json.loads(response.read().decode())
        except Exception as error:
            if attempt == 4:
                raise
            print(f'    再試行 {attempt + 1}/4: {error}', file=sys.stderr)
            time.sleep(5 * (attempt + 1))

    return {}


def main() -> None:
    output = Path(sys.argv[1])

    app_id = os.environ.get('DUGA_APP_ID')
    agent_id = os.environ.get('DUGA_AGENT_ID', '21786')

    if not app_id:
        raise SystemExit('環境変数 DUGA_APP_ID が必要です。')

    credentials = {'appid': app_id, 'agentid': agent_id}

    people: dict[str, dict] = {}
    series_of = defaultdict(Counter)
    seen_products = set()

    for name, category in CATEGORIES.items():
        offset = 1
        total = None

        while True:
            payload = call(credentials, category, offset)

            if payload.get('error'):
                print(f'  {name}: APIがエラーを返しました {payload["error"]}', file=sys.stderr)
                break

            items = payload.get('items') or []

            if total is None:
                total = int(payload.get('count') or 0)
                print(f'  {name}: {total:,}件', flush=True)

            if not items:
                break

            for wrapper in items:
                item = wrapper.get('item') or {}
                product_id = (item.get('productid') or '').strip()

                if product_id in seen_products:
                    continue
                seen_products.add(product_id)

                # review / mylist / series は、要素が1つでも配列で返ってくる。
                review = first(item.get('review'))
                rating = number(review.get('rating'))
                reviewers = int(number(review.get('reviewer')))
                mylist = int(number(first(item.get('mylist')).get('total')))
                series = str(first(item.get('series')).get('name') or '').strip()

                for entry in item.get('performer') or []:
                    data = entry.get('data') or {}
                    person_name = (data.get('name') or '').strip()

                    if not person_name or person_name in SKIP_NAMES:
                        continue

                    person = people.setdefault(person_name, {
                        'name': person_name,
                        'dugaId': str(data.get('id') or ''),
                        'reading': to_hiragana(data.get('kana') or ''),
                        'ratingSum': 0.0,
                        'ratingCount': 0,
                        'reviewers': 0,
                        'mylist': 0,
                    })

                    if not person['reading'] and data.get('kana'):
                        person['reading'] = to_hiragana(data['kana'])

                    if rating > 0:
                        person['ratingSum'] += rating
                        person['ratingCount'] += 1

                    person['reviewers'] += reviewers
                    person['mylist'] += mylist

                    if series:
                        series_of[person_name][series] += 1

            offset += HITS

            if total and offset > total:
                break

            time.sleep(INTERVAL)

        time.sleep(INTERVAL)

    records = []
    for person in people.values():
        count = person.pop('ratingCount')
        total_rating = person.pop('ratingSum')
        person['rating'] = round(total_rating / count, 2) if count else None
        person['ratedWorks'] = count
        person['series'] = [name for name, _ in series_of[person['name']].most_common(3)]
        records.append(person)

    records.sort(key=lambda r: (-r['mylist'], r['name']))

    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(json.dumps({
        'confirmedOn': date.today().isoformat(),
        'sourceLabel': 'DUGA アフィリエイト Web サービス',
        'sourceUrl': 'https://affiliate.duga.jp/',
        'scannedProducts': len(seen_products),
        'performers': records,
    }, ensure_ascii=False), encoding='utf-8')

    with_reading = sum(1 for r in records if r['reading'])
    with_rating = sum(1 for r in records if r['rating'])

    print()
    print(f'{len(seen_products):,}作品から、出演者 {len(records):,}人の詳細を取りました → {output}')
    print(f'  読み仮名あり: {with_reading:,}人')
    print(f'  評価あり    : {with_rating:,}人')


main()
