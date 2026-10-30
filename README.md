# 宝塚スター一覧

花・月・雪・星・宙・専科 × 期 の早見表。スマホ優先、GitHub Pages で公開し、アプリ内で編集して GitHub に保存する。

## ファイル

| パス | 内容 |
|---|---|
| `index.html` / `css/` / `js/` | アプリ本体（ビルド不要の素の HTML/JS） |
| `data/stars.json` | 生徒データ（1人1行） |
| `tools/import-wikipedia.mjs` | Wikipedia から初期データを作るスクリプト（最初の1回用） |

## 公開の手順（最初の1回）

1. GitHub で新しいリポジトリを作る（例: `takarazuka-stars`、Public）
2. このフォルダを push する
   ```
   git remote add origin https://github.com/<ユーザー名>/takarazuka-stars.git
   git push -u origin main
   ```
3. リポジトリの **Settings → Pages** で「Deploy from a branch」→ `main` / `/(root)` を選んで保存
4. 1〜2分後に `https://<ユーザー名>.github.io/takarazuka-stars/` で開ける
5. スマホの Safari で開いて「共有 → ホーム画面に追加」

## アプリから編集・保存できるようにする（端末ごとに1回）

1. GitHub の **Settings → Developer settings → Personal access tokens → Fine-grained tokens → Generate new token**
   - Repository access: **Only select repositories** → このリポジトリだけ
   - Permissions → Repository permissions → **Contents: Read and write**
2. アプリの「設定」→ GitHub連携 にユーザー名・リポジトリ名・トークンを入れて「接続テスト」→「連携設定を保存」
3. 「編集」→ 名前をタップで編集、＋で追加 → 上部の「保存」で GitHub にコミットされる

トークンはその端末のブラウザにだけ保存される。保存していない変更も端末内に下書きとして残る。

## データの形

```json
{"id":"s1","name":"柚香光","term":95,"order":18,"role":"otoko","troupe":"hana","retired":2024,"statuses":["top","shinko","bow"]}
```

- `order`: 期の中の並び（成績順）。初期値は Wikipedia の一覧の順
- `role`: `otoko`（男役）/ `musume`（娘役）
- `troupe`: `hana` `tsuki` `yuki` `hoshi` `sora` `senka`、未配属は `null`
- `history`: 組替え履歴（例 `["tsuki","sora","hana"]`）
- `retired`: 退団年（現役なら項目なし、年不明は `0`）
- `statuses`: `top` `topMusume` `kumicho` `fukuKumicho` `shinko` `bow`
- 名前の見た目は `css/style.css` の「名前の見た目（ステータス）」で決めている
