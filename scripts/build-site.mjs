// DUGA のカテゴリデータから、ashi-fetish.click のページを作る。
//
// 方針:
//   - DUGA が公式に付けたカテゴリだけを根拠にする。推測で分類しない
//   - 作品のタイトルと紹介文は載せない（露骨な語を含むものが多いため）
//   - プロフィール（生年月日・身長など）は載せず、darekore.jp へ案内する。
//     同じ内容を2つのサイトに置くと、どちらも評価されにくくなるため
//
// 使い方: node scripts/build-site.mjs

import { mkdir, readFile, writeFile, rm } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = fileURLToPath(new URL('..', import.meta.url))
const publicDir = path.join(root, 'public')

const SITE_URL = 'https://ashi-fetish.click'
const SITE_NAME = '足フェチ作品データベース'
const CONTACT = 'info@ashi-fetish.click'
const PROFILE_SITE = 'https://darekore.jp'

// DUGA の代理店ID。リンクに現れる公開の値で、秘密のキーではない。
const DUGA_AGENT_ID = process.env.DUGA_AGENT_ID || '21786'

// DUGA ウェブサービスの規約で表示が義務づけられているクレジット。
// 「ソースや画像の改変はできません」とされているため、そのままの形で出す。
const DUGA_CREDIT = `<a href="https://click.duga.jp/aff/api/${DUGA_AGENT_ID}-01" target="_blank">Powered by DUGAウェブサービス</a>`

// 五十音の見出しと、そこに入れる読みの頭文字。濁音・半濁音は清音にまとめる。
const KANA_ROWS = [
  ['あ', [['あ', 'あ'], ['い', 'い'], ['う', 'うゔ'], ['え', 'え'], ['お', 'お']]],
  ['か', [['か', 'かが'], ['き', 'きぎ'], ['く', 'くぐ'], ['け', 'けげ'], ['こ', 'こご']]],
  ['さ', [['さ', 'さざ'], ['し', 'しじ'], ['す', 'すず'], ['せ', 'せぜ'], ['そ', 'そぞ']]],
  ['た', [['た', 'ただ'], ['ち', 'ちぢ'], ['つ', 'つづっ'], ['て', 'てで'], ['と', 'とど']]],
  ['な', [['な', 'な'], ['に', 'に'], ['ぬ', 'ぬ'], ['ね', 'ね'], ['の', 'の']]],
  ['は', [['は', 'はばぱ'], ['ひ', 'ひびぴ'], ['ふ', 'ふぶぷ'], ['へ', 'へべぺ'], ['ほ', 'ほぼぽ']]],
  ['ま', [['ま', 'ま'], ['み', 'み'], ['む', 'む'], ['め', 'め'], ['も', 'も']]],
  ['や', [['や', 'やゃ'], ['ゆ', 'ゆゅ'], ['よ', 'よょ']]],
  ['ら', [['ら', 'ら'], ['り', 'り'], ['る', 'る'], ['れ', 'れ'], ['ろ', 'ろ']]],
  ['わ', [['わ', 'わゎ'], ['を', 'を'], ['ん', 'ん']]],
]

const KANA_OF = new Map(
  KANA_ROWS.flatMap(([, initials]) => initials.flatMap(([head, members]) => [...members].map((c) => [c, head])))
)

function kanaHead(reading) {
  return KANA_OF.get(String(reading || '').charAt(0)) ?? 'その他'
}

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;')
}

function slugify(name) {
  const base = String(name || '')
    .normalize('NFKC')
    .replace(/[^\p{L}\p{N}]+/gu, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase()
  return base || 'unknown'
}

function monthLabel(iso) {
  if (!iso) return ''
  const [year, month] = String(iso).split('-')
  return `${Number(year)}年${Number(month)}月`
}

function dayLabel(iso) {
  if (!iso) return ''
  const [year, month, day] = String(iso).split('-')
  return `${Number(year)}年${Number(month)}月${Number(day)}日`
}

function shell({ title, description, canonical, crumbs, body }) {
  return `<!doctype html>
<html lang="ja">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${escapeHtml(title)}</title>
    <meta name="description" content="${escapeHtml(description)}" />
    <meta name="rating" content="adult" />
    <link rel="canonical" href="${canonical}" />
    <meta property="og:type" content="website" />
    <meta property="og:locale" content="ja_JP" />
    <meta property="og:site_name" content="${escapeHtml(SITE_NAME)}" />
    <meta property="og:title" content="${escapeHtml(title)}" />
    <meta property="og:description" content="${escapeHtml(description)}" />
    <meta property="og:url" content="${canonical}" />
    <link rel="stylesheet" href="/assets/site.css" />
  </head>
  <body>
    <div class="wrap">
      <nav class="crumbs"><a href="/">${escapeHtml(SITE_NAME)}</a>${crumbs ? ` ＞ ${crumbs}` : ''}</nav>
      ${body}
      <footer>
        <p class="adult">このサイトは18歳未満の方に向けたものではありません。</p>
        <p>掲載内容の訂正・削除のご依頼は <a href="mailto:${CONTACT}">${CONTACT}</a> へご連絡ください。確認のうえ対応します。</p>
        <p><a href="/">トップ</a> ・ <a href="/kana/">五十音索引</a> ・ <a href="/about/">このサイトについて</a> ・ <a href="${PROFILE_SITE}">出演者のプロフィールは この子だれ？</a></p>
        <p class="credit">${DUGA_CREDIT}</p>
      </footer>
    </div>
  </body>
</html>
`
}

function categoryChips(person, categories) {
  return Object.entries(person.categories)
    .map(([name, count]) => {
      const info = categories.find((c) => c.name === name)
      return `<a class="chip" href="/${info.slug}/">${escapeHtml(info.label)} ${count}作品</a>`
    })
    .join('')
}

function renderPerson(person, categories) {
  const canonical = `${SITE_URL}/performer/${person.slug}/`
  const main = Object.entries(person.categories).sort((a, b) => b[1] - a[1])[0]
  const mainLabel = categories.find((c) => c.name === main[0])?.label ?? main[0]

  const title = `${person.name}の足フェチ作品${person.works}件｜${SITE_NAME}`
  const description = `${person.name}が出演する、DUGAで${mainLabel}などに分類された作品${person.works}件をまとめています。`
    + `${monthLabel(person.firstOpenedOn)}から${monthLabel(person.lastOpenedOn)}までの収録です。`

  const rows = [
    ['該当作品', `${person.works}作品`],
    ['カテゴリ', categoryChips(person, categories)],
    ['収録の範囲', `${monthLabel(person.firstOpenedOn)} 〜 ${monthLabel(person.lastOpenedOn)}`],
  ]

  if (person.reading) rows.splice(0, 0, ['読み', escapeHtml(person.reading)])

  // 評価とマイリスト数は DUGA が公表している実数。当サイトの集計ではない。
  if (person.rating) {
    rows.push(['DUGAでの評価', `${person.rating} / 5（${person.ratedWorks}作品の平均）`])
  }
  if (person.mylist) {
    rows.push(['マイリスト登録', `${person.mylist.toLocaleString('ja-JP')}件`])
  }
  if (person.series?.length) rows.push(['主なシリーズ', escapeHtml(person.series.join('、'))])
  if (person.labels.length) rows.push(['主なレーベル', escapeHtml(person.labels.join('、'))])

  const table = `<table class="profile"><tbody>${rows
    .map(([th, td]) => `<tr><th>${escapeHtml(th)}</th><td>${td}</td></tr>`)
    .join('')}</tbody></table>`

  const link = person.productId
    ? `<p class="works">
         <a class="button" href="https://click.duga.jp/ppv/${encodeURIComponent(person.productId)}/${DUGA_AGENT_ID}-01"
            target="_blank" rel="nofollow sponsored noopener">DUGA で最新の該当作品を見る（${dayLabel(person.productOpenedOn)}公開）</a>
         <span class="pr">広告</span>
       </p>`
    : ''

  return shell({
    title,
    description,
    canonical,
    crumbs: `<a href="/${categories.find((c) => c.name === main[0]).slug}/">${escapeHtml(mainLabel)}</a> ＞ ${escapeHtml(person.name)}`,
    body: `
      <h1>${escapeHtml(person.name)}</h1>
      <p class="lead">DUGA が${escapeHtml(mainLabel)}などに分類している作品が${person.works}件あります。</p>
      ${table}
      ${link}
      <p class="note">
        生年月日や身長などのプロフィールは
        <a href="${PROFILE_SITE}/actress/${encodeURIComponent(person.name)}/">この子だれ？</a>
        に載せています。
      </p>
      <section class="source-block">
        <h2>出典</h2>
        <ul class="sources"><li><a href="https://duga.jp/productcsv/" target="_blank" rel="noopener">DUGA 作品データCSV</a></li></ul>
        <p class="confirmed">DUGA が作品に付けているカテゴリをそのまま数えたものです。題名や紹介文からの推測は含みません。</p>
      </section>`,
  })
}

function renderCategory(category, people) {
  const canonical = `${SITE_URL}/${category.slug}/`
  const title = `${category.label}の出演者${people.length}人｜${SITE_NAME}`
  const description = `DUGA で${category.label}に分類された作品${category.works}件に出演している${people.length}人を、`
    + '出演数の多い順に並べています。'

  const list = people
    .map((p, index) => `
      <li>
        <span class="rank">${index + 1}</span>
        <a href="/performer/${p.slug}/">${escapeHtml(p.name)}</a>
        <span class="count">${p.categories[category.name]}作品</span>
      </li>`)
    .join('')

  return shell({
    title,
    description,
    canonical,
    crumbs: escapeHtml(category.label),
    body: `
      <h1>${escapeHtml(category.label)}の出演者</h1>
      <p class="lead">${escapeHtml(description)}</p>
      <ol class="rank-list">${list}</ol>`,
  })
}

function renderTop(categories, people, confirmedOn) {
  const cards = categories
    .map((c) => `
      <a class="card" href="/${c.slug}/">
        <span class="card-title">${escapeHtml(c.label)}</span>
        <span class="card-note">${c.works.toLocaleString('ja-JP')}作品・${c.performers.toLocaleString('ja-JP')}人</span>
      </a>`)
    .join('')

  const top = people.slice(0, 30)
    .map((p, i) => `<li><span class="rank">${i + 1}</span><a href="/performer/${p.slug}/">${escapeHtml(p.name)}</a><span class="count">${p.works}作品</span></li>`)
    .join('')

  const description = `DUGA が足裏・パンスト・ソックスに分類している作品${categories.reduce((sum, c) => sum + c.works, 0).toLocaleString('ja-JP')}件から、`
    + `出演者${people.length.toLocaleString('ja-JP')}人を出演数つきでまとめた一覧です。`

  return shell({
    title: `${SITE_NAME}｜DUGAのカテゴリで探す`,
    description,
    canonical: `${SITE_URL}/`,
    crumbs: '',
    body: `
      <h1>${escapeHtml(SITE_NAME)}</h1>
      <p class="lead">${escapeHtml(description)}${escapeHtml(confirmedOn)} 時点のデータです。</p>
      <div class="cards">${cards}</div>
      <h2>出演数の多い方</h2>
      <ol class="rank-list">${top}</ol>
      <p class="more"><a href="/all/">すべての出演者を見る</a></p>`,
  })
}

function renderAll(people) {
  const list = people
    .map((p) => `<li><a href="/performer/${p.slug}/">${escapeHtml(p.name)}</a><span class="count">${p.works}</span></li>`)
    .join('')

  return shell({
    title: `出演者一覧${people.length}人｜${SITE_NAME}`,
    description: `DUGA の足裏・パンスト・ソックスに分類された作品に出演している${people.length}人の一覧です。`,
    canonical: `${SITE_URL}/all/`,
    crumbs: '出演者一覧',
    body: `
      <h1>出演者一覧</h1>
      <p class="lead">該当作品のある${people.length.toLocaleString('ja-JP')}人を、出演数の多い順に並べています。</p>
      <ul class="name-list">${list}</ul>`,
  })
}

function renderKanaIndex(groups, total) {
  const rows = KANA_ROWS.map(([row, initials]) => {
    const links = initials
      .filter(([head]) => groups.get(head)?.length)
      .map(([head]) => `<a class="chip" href="/kana/${encodeURIComponent(head)}/">${escapeHtml(head)} ${groups.get(head).length}人</a>`)
      .join('')
    return links ? `<section><h2>${escapeHtml(row)}行</h2><p>${links}</p></section>` : ''
  }).join('')

  const others = groups.get('その他')?.length
    ? `<section><h2>その他</h2><p><a class="chip" href="/kana/${encodeURIComponent('その他')}/">その他 ${groups.get('その他').length}人</a></p></section>`
    : ''

  const description = `読み仮名が分かっている${total.toLocaleString('ja-JP')}人を、頭文字ごとに並べています。`

  return shell({
    title: `五十音索引｜${SITE_NAME}`,
    description,
    canonical: `${SITE_URL}/kana/`,
    crumbs: '五十音索引',
    body: `
      <h1>五十音索引</h1>
      <p class="lead">${escapeHtml(description)}読み仮名は DUGA のウェブサービスから取得しています。</p>
      ${rows}${others}`,
  })
}

function renderKanaPage(head, members, groups) {
  const nav = [...KANA_ROWS.flatMap(([, i]) => i.map(([h]) => h)), 'その他']
    .filter((h) => groups.get(h)?.length)
    .map((h) => h === head
      ? `<span class="chip current">${escapeHtml(h)}</span>`
      : `<a class="chip" href="/kana/${encodeURIComponent(h)}/">${escapeHtml(h)}</a>`)
    .join('')

  const list = members
    .map((p) => `<li><a href="/performer/${p.slug}/">${escapeHtml(p.name)}<span class="reading-small">${escapeHtml(p.reading || '')}</span></a><span class="count">${p.works}</span></li>`)
    .join('')

  const label = head === 'その他' ? 'その他の読み' : `${head}から始まる読み`
  const description = `${label}の出演者${members.length}人の一覧です。`

  return shell({
    title: `${label}の出演者${members.length}人｜${SITE_NAME}`,
    description,
    canonical: `${SITE_URL}/kana/${encodeURIComponent(head)}/`,
    crumbs: `<a href="/kana/">五十音索引</a> ＞ ${escapeHtml(head)}`,
    body: `
      <h1>${escapeHtml(label)}の出演者</h1>
      <p class="lead">${escapeHtml(description)}</p>
      <p>${nav}</p>
      <ul class="name-list">${list}</ul>`,
  })
}

function renderAbout(categories, people, confirmedOn) {
  return shell({
    title: `このサイトについて｜${SITE_NAME}`,
    description: 'データの出典と、掲載の方針についてご案内します。',
    canonical: `${SITE_URL}/about/`,
    crumbs: 'このサイトについて',
    body: `
      <h1>このサイトについて</h1>

      <h2>載せているもの</h2>
      <p>
        DUGA が作品に付けているカテゴリのうち、足裏・パンスト・ソックスの3つを対象に、
        出演者と作品数をまとめています。${confirmedOn} 時点で ${categories.reduce((s, c) => s + c.works, 0).toLocaleString('ja-JP')}作品・
        ${people.length.toLocaleString('ja-JP')}人です。
      </p>

      <h2>推測で分類していません</h2>
      <p>
        題名や紹介文に「ストッキング」などの語が出てくるだけの作品は含めていません。
        その拾い方をすると1万件ほど増えますが、該当しない作品が多く混ざるためです。
        <strong>DUGA が公式に付けたカテゴリだけを根拠にしています。</strong>
      </p>

      <h2>作品名は載せていません</h2>
      <p>
        露骨な語を含むものが多いため、題名と紹介文は掲載していません。
        レーベル名も、露骨な語を含むものは除いています。
      </p>

      <h2>プロフィールについて</h2>
      <p>
        生年月日や身長などは、同じ運営の
        <a href="${PROFILE_SITE}">この子だれ？</a> に載せています。
        同じ内容を2つのサイトに置かないためです。
      </p>

      <h2>訂正・削除のご依頼</h2>
      <p>
        ご本人および関係者の方から掲載を希望しない旨のご連絡をいただいた場合、確認のうえ削除します。
        <a href="mailto:${CONTACT}">${CONTACT}</a>
      </p>

      <h2>出典</h2>
      <ul class="sources">
        <li><a href="https://duga.jp/productcsv/" target="_blank" rel="noopener">DUGA 作品データCSV</a>（毎日12:30と18:30に更新）</li>
      </ul>`,
  })
}

const SITE_CSS = `:root { color-scheme: light dark; --bg:#fbf9f7; --panel:#fff; --text:#1d1a20; --muted:#615a68; --rule:#e8e0e3; --accent:#7b3f5c; --warn:#b0453c; }
@media (prefers-color-scheme: dark) { :root { --bg:#17151a; --panel:#221f27; --text:#ece8f0; --muted:#a9a2b4; --rule:#332d3d; --accent:#f0908a; --warn:#f0908a; } }
* { box-sizing:border-box; }
body { margin:0; font-family:"Hiragino Sans","Yu Gothic",system-ui,sans-serif; background:var(--bg); color:var(--text); line-height:1.7; }
.wrap { max-width:820px; margin:0 auto; padding:24px 20px 64px; }
.crumbs { font-size:13px; color:var(--muted); margin-bottom:18px; }
a { color:var(--accent); }
.crumbs a, .name-list a, .rank-list a { text-decoration:none; }
h1 { font-size:clamp(24px,5vw,34px); margin:0 0 8px; }
h2 { font-size:18px; margin:30px 0 10px; }
.lead { color:var(--muted); font-size:15px; margin:0 0 20px; }
.cards { display:grid; grid-template-columns:repeat(auto-fill,minmax(200px,1fr)); gap:12px; margin-bottom:8px; }
.card { display:block; padding:16px; border:1px solid var(--rule); border-radius:10px; background:var(--panel); text-decoration:none; color:inherit; }
.card:hover { border-color:var(--accent); }
.card-title { display:block; font-size:18px; font-weight:700; }
.card-note { display:block; font-size:13px; color:var(--muted); margin-top:4px; }
.profile { border-collapse:collapse; width:100%; background:var(--panel); border:1px solid var(--rule); border-radius:10px; overflow:hidden; }
.profile th, .profile td { text-align:left; padding:11px 14px; border-bottom:1px solid var(--rule); font-size:15px; }
.profile th { width:9em; color:var(--muted); font-weight:600; }
.profile tr:last-child th, .profile tr:last-child td { border-bottom:0; }
.chip.current { background:var(--accent); color:#fff; border-color:var(--accent); }
.reading-small { display:block; font-size:11px; color:var(--muted); }
.chip { display:inline-block; border:1px solid var(--rule); border-radius:18px; padding:3px 12px; margin:2px 4px 2px 0; font-size:13px; text-decoration:none; }
.works { margin:20px 0; display:flex; align-items:center; gap:10px; flex-wrap:wrap; }
.button { display:inline-block; background:var(--accent); color:#fff; text-decoration:none; padding:11px 20px; border-radius:8px; font-weight:700; font-size:15px; }
.pr { font-size:11px; color:var(--muted); border:1px solid var(--rule); border-radius:4px; padding:1px 6px; }
.rank-list { list-style:none; padding:0; margin:0; }
.rank-list li { display:flex; align-items:baseline; gap:10px; padding:6px 0; border-bottom:1px solid var(--rule); }
.rank { min-width:2.2em; color:var(--muted); font-size:13px; }
.count { margin-left:auto; font-size:13px; color:var(--muted); }
.name-list { list-style:none; padding:0; margin:0; display:grid; grid-template-columns:repeat(auto-fill,minmax(180px,1fr)); gap:2px 14px; }
.name-list li { display:flex; gap:8px; padding:4px 0; font-size:14px; }
.sources { padding-left:1.2em; font-size:14px; color:var(--muted); }
.note, .confirmed { font-size:13px; color:var(--muted); }
.source-block { margin-top:30px; border-top:1px solid var(--rule); padding-top:8px; }
.more { margin-top:18px; font-size:15px; }
footer { margin-top:44px; border-top:1px solid var(--rule); padding-top:16px; font-size:13px; color:var(--muted); }
.adult { font-weight:700; color:var(--warn); }
.credit { margin-top:10px; }
`

async function main() {
  const data = JSON.parse(await readFile(path.join(publicDir, 'data/performers.json'), 'utf8'))
  const people = data.performers
  const confirmedOn = data.confirmedOn

  // ウェブサービスから取った、CSVに無い項目（読み仮名・評価・マイリスト数・シリーズ）。
  let details = new Map()
  try {
    const file = JSON.parse(await readFile(path.join(publicDir, 'data/api-details.json'), 'utf8'))
    details = new Map(file.performers.map((p) => [p.name, p]))
  } catch {
    console.log('ウェブサービスの結果が無いので、読み仮名や評価は出しません。')
  }

  for (const person of people) {
    const found = details.get(person.name)
    if (!found) continue
    person.reading = found.reading
    person.dugaId = found.dugaId
    person.rating = found.rating
    person.ratedWorks = found.ratedWorks
    person.mylist = found.mylist
    person.series = found.series
  }

  const used = new Set()
  for (const person of people) {
    let slug = slugify(person.name)
    let suffix = 2
    while (used.has(slug)) slug = `${slugify(person.name)}-${suffix++}`
    used.add(slug)
    person.slug = slug
  }

  const categories = data.categories.map((c) => ({
    ...c,
    performers: people.filter((p) => c.name in p.categories).length,
  }))

  for (const dir of ['performer', 'all', 'about', ...categories.map((c) => c.slug)]) {
    await rm(path.join(publicDir, dir), { recursive: true, force: true })
  }

  await mkdir(path.join(publicDir, 'assets'), { recursive: true })
  await writeFile(path.join(publicDir, 'assets/site.css'), SITE_CSS, 'utf8')

  await writeFile(path.join(publicDir, 'index.html'), renderTop(categories, people, confirmedOn), 'utf8')

  for (const [dir, html] of [
    ['all', renderAll(people)],
    ['about', renderAbout(categories, people, confirmedOn)],
  ]) {
    await mkdir(path.join(publicDir, dir), { recursive: true })
    await writeFile(path.join(publicDir, dir, 'index.html'), html, 'utf8')
  }

  // 五十音索引。読み仮名はウェブサービスからしか取れないので、
  // 取れている人だけを載せる。
  const withReading = people.filter((p) => p.reading)
  const groups = new Map()
  for (const person of withReading) {
    const head = kanaHead(person.reading)
    if (!groups.has(head)) groups.set(head, [])
    groups.get(head).push(person)
  }
  for (const members of groups.values()) {
    members.sort((a, b) => a.reading.localeCompare(b.reading, 'ja'))
  }

  await rm(path.join(publicDir, 'kana'), { recursive: true, force: true })
  await mkdir(path.join(publicDir, 'kana'), { recursive: true })
  await writeFile(path.join(publicDir, 'kana/index.html'), renderKanaIndex(groups, withReading.length), 'utf8')

  for (const [head, members] of groups) {
    const dir = path.join(publicDir, 'kana', head)
    await mkdir(dir, { recursive: true })
    await writeFile(path.join(dir, 'index.html'), renderKanaPage(head, members, groups), 'utf8')
  }

  for (const category of categories) {
    const members = people
      .filter((p) => category.name in p.categories)
      .sort((a, b) => b.categories[category.name] - a.categories[category.name] || a.name.localeCompare(b.name, 'ja'))

    await mkdir(path.join(publicDir, category.slug), { recursive: true })
    await writeFile(path.join(publicDir, category.slug, 'index.html'), renderCategory(category, members), 'utf8')
  }

  for (const person of people) {
    const dir = path.join(publicDir, 'performer', person.slug)
    await mkdir(dir, { recursive: true })
    await writeFile(path.join(dir, 'index.html'), renderPerson(person, categories), 'utf8')
  }

  const today = new Date().toISOString().slice(0, 10)
  const urls = [
    `${SITE_URL}/`,
    `${SITE_URL}/all/`,
    `${SITE_URL}/kana/`,
    `${SITE_URL}/about/`,
    ...[...groups.keys()].map((h) => `${SITE_URL}/kana/${encodeURIComponent(h)}/`),
    ...categories.map((c) => `${SITE_URL}/${c.slug}/`),
    ...people.map((p) => `${SITE_URL}/performer/${encodeURI(p.slug)}/`),
  ]

  await writeFile(
    path.join(publicDir, 'sitemap.xml'),
    `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${
      urls.map((loc) => `  <url><loc>${loc}</loc><lastmod>${today}</lastmod></url>`).join('\n')
    }\n</urlset>\n`,
    'utf8'
  )

  await writeFile(
    path.join(publicDir, 'robots.txt'),
    `User-agent: *\nAllow: /\n\nSitemap: ${SITE_URL}/sitemap.xml\n`,
    'utf8'
  )

  await writeFile(path.join(publicDir, 'CNAME'), 'ashi-fetish.click\n', 'utf8')

  console.log(`出演者 ${people.length.toLocaleString('ja-JP')}人のページを作りました`)
  for (const c of categories) console.log(`  ${c.label}: ${c.works.toLocaleString('ja-JP')}作品 / ${c.performers.toLocaleString('ja-JP')}人`)
  console.log(`サイトマップ: ${urls.length.toLocaleString('ja-JP')}URL`)
}

main()
