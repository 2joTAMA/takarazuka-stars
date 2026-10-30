// Wikipedia のページ本文（wikitext）を取る。取り込みスクリプト共通
import fs from 'node:fs';
import path from 'node:path';

// ページが無いとき（404）だけ空を返す。それ以外の失敗は何度か取り直し、
// だめなら止める（自動更新で一部が欠けたデータを書き出さないため）
async function fetchWiki(title) {
  const url = 'https://ja.wikipedia.org/w/index.php?action=raw&title=' + encodeURIComponent(title);
  for (let i = 0; ; i++) {
    const res = await fetch(url, { headers: { 'User-Agent': 'takarazuka-stars (https://github.com/2joTAMA/takarazuka-stars)' } }).catch(e => e);
    await new Promise(r => setTimeout(r, 300)); // 続けて取りすぎないよう少し待つ
    if (res.ok) return res.text();
    if (res.status === 404) return '';
    if (i >= 4) throw new Error(`Wikipedia から取得できません: ${title} (${res.status ?? res.message})`);
    await new Promise(r => setTimeout(r, 3000 * (i + 1)));
  }
}

// 取ったページは cacheDir に保存して、次からはそれを使う
export async function raw(cacheDir, title, file) {
  const f = path.join(cacheDir, file);
  if (fs.existsSync(f)) return fs.readFileSync(f, 'utf8');
  const text = await fetchWiki(title);
  fs.mkdirSync(path.dirname(f), { recursive: true });
  fs.writeFileSync(f, text);
  return text;
}
