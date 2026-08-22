# ashi-fetish（ashi-fetish.click）

DUGA が公式に付けているカテゴリ（足裏・パンスト・ソックス）から、
出演者と作品数をまとめたサイト。

- 本番URL: https://ashi-fetish.click
- 配信: GitHub Pages（`public/CNAME` に `ashi-fetish.click`）
- **GitHub の Settings → Pages でも Custom domain の設定が要る。**
  CNAME ファイルだけでは足りない

**Xserver には置けない。** アダルトを禁止しているため。

## 掲載の方針

- **DUGA が付けたカテゴリだけを根拠にする。** 題名や紹介文に「ストッキング」
  などの語が出てくるだけの作品は含めない。その拾い方をすると 2,020件 →
  12,264件に増えるが、該当しない作品が大量に混ざる
- **作品のタイトルと紹介文は載せない。** 露骨な語を含むものが多いため。
  レーベル名も、露骨な語を含むものは `EXPLICIT` で除いている
- **プロフィールは載せない。** 生年月日・身長などは
  [darekore.jp](https://darekore.jp) にあり、同じ内容を2つのサイトに
  置くと、どちらも評価されにくくなる。こちらからはリンクするだけ
- 18歳未満向けでない旨と、削除依頼の窓口を全ページに出す

## いまの規模

| カテゴリ | 作品 | 出演者 |
|---|---|---|
| パンスト | 1,506 | 1,633 |
| 足裏 | 431 | 827 |
| ソックス | 83 | 209 |

のべ 2,348人・2,354ページ。

## DUGA のクレジット表示（義務）

DUGA ウェブサービスの規約で、指定のクレジットの表示が義務づけられている。
全ページのフッタに次を出している。

```html
<a href="https://click.duga.jp/aff/api/21786-01" target="_blank">Powered by DUGAウェブサービス</a>
```

**ソースの改変は認められていない。** `rel` などを足さないこと。
アプリケーションIDの申請内容と違うURLでの表示も認められていないため、
このドメインを使うなら申請内容に追加すること。

## 2つの出典を組み合わせている

| 出典 | 取れるもの | 認証 |
|---|---|---|
| 作品データCSV | 作品数・カテゴリ・公開日・レーベル・商品ID | 不要 |
| ウェブサービス（API） | **読み仮名・出演者ID・評価・マイリスト数・シリーズ** | appid が要る |

読み仮名はCSVに無く、APIからしか取れない。これがあるので五十音索引が作れる。
評価とマイリスト数は DUGA が公表している実数で、当サイトの集計ではない。

APIは全商品を巡回する必要がなく、カテゴリで絞れば2,178件で済む。

| カテゴリ | category | 件数 |
|---|---|---|
| 足裏 | 1302 | 483 |
| パンスト | 100015 | 1,544 |
| ソックス | 100014 | 151 |

**APIのレスポンスは、要素が1つでも配列で返る**（`review` `mylist` `series` `ranking`）。
`[{"rating":"4.3"}]` の形。辞書として読むと落ちる。
数値も「2,473」のように桁区切りが入ることがある。

## データの作り直し

```
python scripts/build-data.py public/data/performers.json          # CSVから抽出
DUGA_APP_ID=xxx python scripts/fetch-api-details.py public/data/api-details.json
node   scripts/build-site.mjs                                     # ページ生成
```

- CSV は https://duga.jp/productcsv/（認証不要・毎日12:30と18:30に更新）
- API の appid はこのサイト専用のもの（アプリ名 `ashi-fetish`）を使う
- 生成したページは `.gitignore` に入れてある。commit するのは
  `public/data/performers.json` だけ
- 取り直しは `refresh-data.yml`（週1回）

## 削除依頼

`info@ashi-fetish.click`。画面にも表示している。
