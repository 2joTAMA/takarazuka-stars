// データの読み込み（data/stars.json は GitHub Actions が Wikipedia から取り込んで更新する）
const DATA_PATH = 'data/stars.json';

// 以前の版（アプリ内編集）で端末に保存していた GitHub のトークンと下書きを消す
try {
  localStorage.removeItem('tz.github');
  localStorage.removeItem('tz.draft');
} catch { /* プライベートモードなどでは触れない */ }

export async function loadData() {
  const res = await fetch(`${DATA_PATH}?t=${Date.now()}`, { cache: 'no-store' });
  if (!res.ok) throw new Error(`データを読み込めませんでした (${res.status})`);
  return res.json();
}
