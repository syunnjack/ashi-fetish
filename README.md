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

## データの作り直し

```
python scripts/build-data.py public/data/performers.json   # CSVから抽出
node   scripts/build-site.mjs                              # ページ生成
```

- CSV は https://duga.jp/productcsv/（認証不要・毎日12:30と18:30に更新）
- 生成したページは `.gitignore` に入れてある。commit するのは
  `public/data/performers.json` だけ
- 取り直しは `refresh-data.yml`（週1回）

## 削除依頼

`info@ashi-fetish.click`。画面にも表示している。
