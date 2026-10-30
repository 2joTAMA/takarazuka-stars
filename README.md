# 宝塚スター一覧

花・月・雪・星・宙・専科 × 期 の早見表。スマホ優先、GitHub Pages で公開。
データは Wikipedia 日本語版から自動で取り込んで整理して表示する（アプリ内での編集はしない）。

## ファイル

| パス | 内容 |
|---|---|
| `index.html` / `css/` / `js/` | アプリ本体（ビルド不要の素の HTML/JS） |
| `data/stars.json` | 生徒データ（1人1行）。取り込みスクリプトが作る |
| `tools/import-wikipedia.mjs` | 期別ページ・組ページから生徒の一覧を作る |
| `tools/import-works.mjs` | 個人ページから主演作品（`works`）と退団公演（`farewell`）を足す |
| `tools/wiki-fetch.mjs` | Wikipedia のページ取得（共通） |
| `.github/workflows/update-data.yml` | 上の2つを GitHub 上で定期実行してコミットする |

## データの更新

- 自動: 毎月2日と16日の朝4時ごろ（日本時間）に GitHub Actions が取り込み、`data/stars.json` をコミットする
- 手動: GitHub の **Actions → Wikipediaから取り込む → Run workflow**
- 人数が前回より1割以上減ったとき（取り込みの失敗が疑われるとき）はコミットしない
- 手元で動かすとき（取得したページは cacheDir に保存され、次からはそれを使う）
  ```
  node tools/import-wikipedia.mjs <cacheDir> data/stars.json 45 112
  node tools/import-works.mjs <cacheDir> data/stars.json 85
  ```

## 公開

リポジトリの **Settings → Pages** で「Deploy from a branch」→ `main` / `/(root)`。
スマホの Safari で開いて「共有 → ホーム画面に追加」。

## データの形

```json
{"id":"95-18","name":"柚香光","kana":"ゆずか れい","term":95,"order":18,"role":"otoko","troupe":"hana","retired":2024,"statuses":["top","shinko","bow"]}
```

- `id`: `期-期内の順番`（取り込み直しても変わらない）
- `order`: 期の中の並び（Wikipedia の一覧の順）
- `role`: `otoko`（男役）/ `musume`（娘役）
- `roleFrom` / `roleSince`: 役柄を変えた人の元の役柄と、変えた年（例 男役→娘役 2017年）
- `troupe`: `hana` `tsuki` `yuki` `hoshi` `sora` `senka`、未配属は `null`
- `history`: 組替え履歴（例 `["tsuki","sora","hana"]`）
- `retired`: 退団年（現役なら項目なし、年不明は `0`）
- `kana`: ふりがな
- `statuses`: `top` `topMusume` `kumicho` `fukuKumicho` `tojo` `bow` `shinko`（画面には出さないが、名前の色や「主演経験者」の絞り込みに使う）
- `works`: 主演作品 `[{y: 初日の年, t: 作品名, k: shinko|bow|tojo|tour|top|lead, g?: 組, v?: 会場}]`（85期以降）
- `farewell`: 退団公演 `{y, t, g?}`
- `debuts`（全体）: 期ごとの初舞台公演 `{期: {y, t, troupe}}`
- 名前の見た目は `css/style.css` の「名前の見た目（ステータス）」で決めている
