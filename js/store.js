// データの読み込み・下書き・GitHubへの保存
const DATA_PATH = 'data/stars.json';
const LS_CONFIG = 'tz.github';
const LS_DRAFT = 'tz.draft';

const lsGet = key => {
  try { return JSON.parse(localStorage.getItem(key)); } catch { return null; }
};
const lsSet = (key, value) => {
  try {
    if (value === null) localStorage.removeItem(key);
    else localStorage.setItem(key, JSON.stringify(value));
  } catch { /* プライベートモードなどでは保存できない */ }
};

export const getConfig = () => ({ owner: '', repo: '', branch: 'main', token: '', ...lsGet(LS_CONFIG) });
export const setConfig = cfg => lsSet(LS_CONFIG, cfg);
export const hasToken = () => {
  const c = getConfig();
  return Boolean(c.owner && c.repo && c.token);
};

export const loadDraft = () => lsGet(LS_DRAFT);
export const saveDraft = draft => lsSet(LS_DRAFT, draft);
export const clearDraft = () => lsSet(LS_DRAFT, null);

// 1人1行で書き出す（GitHub上で差分が読みやすいように）
export function serialize(data) {
  const { stars, ...meta } = data;
  const head = JSON.stringify(meta, null, 1).slice(0, -2);
  return `${head},\n "stars": [\n${stars.map(s => '  ' + JSON.stringify(s)).join(',\n')}\n ]\n}\n`;
}

function toBase64(text) {
  const bytes = new TextEncoder().encode(text);
  let bin = '';
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(bin);
}
function fromBase64(b64) {
  const bin = atob(b64.replace(/\s/g, ''));
  return new TextDecoder().decode(Uint8Array.from(bin, c => c.charCodeAt(0)));
}

function api(cfg, query = '') {
  return `https://api.github.com/repos/${encodeURIComponent(cfg.owner)}/${encodeURIComponent(cfg.repo)}/contents/${DATA_PATH}${query}`;
}
const headers = cfg => ({
  Accept: 'application/vnd.github+json',
  Authorization: `Bearer ${cfg.token}`,
});

function httpMessage(status) {
  if (status === 401) return 'トークンが正しくないか、期限切れです (401)';
  if (status === 403) return 'トークンに書き込み権限がありません (403)';
  if (status === 404) return 'ユーザー名・リポジトリ名が違うか、トークンがこのリポジトリを選んでいません (404)';
  return `GitHubから読み込めませんでした (${status})`;
}

async function fetchRemote(cfg) {
  const res = await fetch(api(cfg, `?ref=${encodeURIComponent(cfg.branch)}`), { headers: headers(cfg), cache: 'no-store' });
  if (!res.ok) throw new Error(httpMessage(res.status));
  const j = await res.json();
  return { data: JSON.parse(fromBase64(j.content)), sha: j.sha };
}

// 連携設定があればGitHubから最新を、なければ公開中のファイルを読む
export async function loadData() {
  if (hasToken()) {
    try { return await fetchRemote(getConfig()); } catch (e) { console.warn(e); }
  }
  const res = await fetch(`${DATA_PATH}?t=${Date.now()}`, { cache: 'no-store' });
  if (!res.ok) throw new Error(`データを読み込めませんでした (${res.status})`);
  return { data: await res.json(), sha: null };
}

export async function testConnection(cfg) {
  const { data, sha } = await fetchRemote(cfg);
  return { count: data.stars.length, sha };
}

export class ConflictError extends Error {}

// baseSha と GitHub 上の最新が違えば ConflictError。force なら上書き
export async function saveData(data, baseSha, message, { force = false } = {}) {
  const cfg = getConfig();
  if (!hasToken()) throw new Error('GitHub連携が設定されていません');
  const cur = await fetch(api(cfg, `?ref=${encodeURIComponent(cfg.branch)}`), { headers: headers(cfg), cache: 'no-store' });
  if (!cur.ok) throw new Error(`GitHubから読み込めませんでした (${cur.status})`);
  const remoteSha = (await cur.json()).sha;
  if (baseSha && remoteSha !== baseSha && !force) throw new ConflictError('他の端末で更新されています');
  const res = await fetch(api(cfg), {
    method: 'PUT',
    headers: { ...headers(cfg), 'Content-Type': 'application/json' },
    body: JSON.stringify({ message, content: toBase64(serialize(data)), sha: remoteSha, branch: cfg.branch }),
  });
  if (!res.ok) throw new Error(`保存できませんでした (${res.status}) ${(await res.json().catch(() => ({}))).message || ''}`);
  return (await res.json()).content.sha;
}
