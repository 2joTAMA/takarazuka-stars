import { TROUPES, TROUPE_BY_ID, ROLES, STATUSES, STATUS_BY_ID, SHINKO_MAX_KEN, kenOf, isActive, isTop } from './config.js';
import * as store from './store.js';

const $ = sel => document.querySelector(sel);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

// ---- 表示設定（この端末だけ） ----
const LS_VIEW = 'tz.view';
const view = { split: true, retired: 'tops', allTerms: false, history: true, size: 'm', focus: null, ...readView() };
function readView() {
  try { return JSON.parse(localStorage.getItem(LS_VIEW)) || {}; } catch { return {}; }
}
function saveView() {
  try { localStorage.setItem(LS_VIEW, JSON.stringify(view)); } catch { /* 保存できなくても表示はできる */ }
}

const state = { data: null, sha: null, changes: [], editing: false };

// ---- 表 ----
const cellKey = (term, troupe, role) => `${term}|${troupe ?? ''}|${role ?? ''}`;
const historyText = h => (h || []).map(id => TROUPE_BY_ID[id]?.short ?? '?').join('→');

function isVisible(s) {
  if (isActive(s)) return true;
  return view.retired === 'all' || (view.retired === 'tops' && isTop(s));
}

function starHtml(s) {
  const cls = ['star', `role-${s.role}`, ...(s.statuses || []).map(st => `st-${st}`)];
  if (!isActive(s)) cls.push('is-retired');
  const hist = view.history && s.history?.length > 1 ? `<span class="hist">(${historyText(s.history)})</span>` : '';
  return `<span class="${cls.join(' ')}" data-id="${esc(s.id)}"><span class="nm">${esc(s.name)}</span>${hist}</span>`;
}

function render() {
  document.body.dataset.size = view.size;
  document.body.classList.toggle('editing', state.editing);
  renderTabs();
  renderSaveButton();

  const troupes = view.focus ? [TROUPE_BY_ID[view.focus]] : TROUPES;
  const shownIds = new Set(troupes.map(t => t.id));
  const roles = view.split ? ROLES.map(r => r.id) : [null];
  const stars = state.data.stars.filter(s => isVisible(s) && (s.troupe ? shownIds.has(s.troupe) : !view.focus));
  const active = stars.filter(isActive);

  const cells = new Map();
  for (const s of stars) {
    const key = cellKey(s.term, s.troupe, s.troupe && view.split ? s.role : null);
    if (!cells.has(key)) cells.set(key, []);
    cells.get(key).push(s);
  }
  for (const list of cells.values()) list.sort((a, b) => a.order - b.order);

  const activeTerms = new Set(active.map(s => s.term));
  const terms = [...new Set(stars.map(s => s.term))]
    .filter(t => view.allTerms || activeTerms.has(t))
    .sort((a, b) => a - b);
  const now = new Date();
  const upper = terms.filter(t => kenOf(t, now) > SHINKO_MAX_KEN);
  const lower = terms.filter(t => kenOf(t, now) <= SHINKO_MAX_KEN);
  const colCount = troupes.length * roles.length;
  const split = roles.length > 1;
  const addBtn = state.editing ? '<button class="add" data-add aria-label="ここに追加">＋</button>' : '';

  const countIn = (termSet, troupe, role) =>
    active.filter(s => termSet.has(s.term) && s.troupe === troupe && (!role || s.role === role)).length;

  let h = `<table class="grid ${split ? 'split' : 'merged'}${view.focus ? ' focus' : ''}"><thead><tr class="h1">`;
  const rs = split ? ' rowspan="2"' : '';
  h += `<th class="c-term"${rs}>期</th><th class="c-ken"${rs}>研</th>`;
  for (const t of troupes) {
    h += `<th class="t-head t-${t.id} tend" colspan="${roles.length}"><button data-focus="${t.id}">${t.name}</button></th>`;
  }
  h += `<th class="c-sum"${rs}>計</th></tr>`;
  if (split) {
    h += '<tr class="h2">';
    for (const t of troupes) for (const r of ROLES) h += `<th class="r-head t-${t.id}${r.id === 'musume' ? ' tend' : ''}">${r.name}</th>`;
    h += '</tr>';
  }
  h += '</thead><tbody>';

  const termRows = term => {
    const termActive = active.filter(s => s.term === term).length;
    h += `<tr><th class="c-term">${term}</th><td class="c-ken">${kenOf(term, now)}</td>`;
    for (const t of troupes) {
      for (const r of roles) {
        const list = cells.get(cellKey(term, t.id, r)) || [];
        const tend = !r || r === 'musume' ? ' tend' : '';
        h += `<td class="cell t-${t.id}${r ? ` r-${r}` : ''}${tend}" data-term="${term}" data-troupe="${t.id}" data-role="${r ?? ''}">${list.map(starHtml).join('')}${addBtn}</td>`;
      }
    }
    h += `<td class="c-sum">${termActive || ''}</td></tr>`;
    const unassigned = cells.get(cellKey(term, null, null));
    if (unassigned?.length) {
      h += `<tr class="unassigned"><th class="c-term"></th><td class="c-ken"></td>`;
      h += `<td class="cell" colspan="${colCount}" data-term="${term}" data-troupe="" data-role=""><span class="un-label">${term}期 未配属</span>${unassigned.map(starHtml).join('')}${addBtn}</td><td class="c-sum"></td></tr>`;
    }
  };
  const subtotal = (list, label, cls) => {
    const set = new Set(list);
    const total = active.filter(s => set.has(s.term)).length;
    h += `<tr class="sub ${cls}"><th class="c-term" colspan="2"${rs}>${label}</th>`;
    for (const t of troupes) for (const r of roles) {
      h += `<td class="${!r || r === 'musume' ? 'tend' : ''}">${countIn(set, t.id, r)}</td>`;
    }
    h += `<td class="c-sum"${rs}>${total}</td></tr>`;
    if (split) {
      h += `<tr class="sub sub2 ${cls}">`;
      for (const t of troupes) h += `<td class="tend" colspan="2">${countIn(set, t.id, null)}</td>`;
      h += '</tr>';
    }
  };

  for (const t of upper) termRows(t);
  if (upper.length) subtotal(upper, `研${SHINKO_MAX_KEN + 1}〜`, 'sub-upper');
  for (const t of lower) termRows(t);
  if (lower.length) subtotal(lower, `研1〜${SHINKO_MAX_KEN}`, 'sub-lower');
  subtotal(terms, '合計', 'sub-grand');
  h += '</tbody></table>';
  h += legendHtml();
  $('#wrap').innerHTML = h;
}

function legendHtml() {
  const sample = (cls, text) => `<span class="star ${cls}"><span class="nm">${text}</span></span>`;
  return `<div class="legend">
    ${sample('st-top', 'トップ')}
    ${sample('st-kumicho', '組長')}
    ${sample('st-fukuKumicho', '副組長')}
    ${sample('st-shinko', '新公主演')}
    ${sample('st-top is-retired', '退団トップ')}
    ${view.split ? '' : sample('role-musume', '娘役')}
    <span class="legend-note">研${SHINKO_MAX_KEN}までが新人公演の対象</span>
  </div>`;
}

function renderTabs() {
  const tabs = [{ id: '', name: '全体' }, ...TROUPES];
  $('#tabs').innerHTML = tabs.map(t =>
    `<button class="tab${t.id ? ` t-${t.id}` : ''}" data-focus="${t.id}" aria-pressed="${(view.focus ?? '') === t.id}">${t.name}</button>`
  ).join('');
}

function setFocus(id) {
  view.focus = id && view.focus !== id ? id : null;
  saveView();
  render();
  $('#wrap').scrollLeft = 0;
}

// ---- 閲覧用の詳細 ----
function openInfo(id) {
  const s = state.data.stars.find(x => x.id === id);
  if (!s) return;
  const row = (k, v) => v ? `<dt>${k}</dt><dd>${v}</dd>` : '';
  const statuses = (s.statuses || []).map(st => STATUS_BY_ID[st]?.label ?? st).join('、');
  $('#info-body').innerHTML = `
    <h2 class="info-name">${starHtml({ ...s, history: [] })}</h2>
    <dl class="info">
      ${row('期', `${s.term}期（研${kenOf(s.term)}）`)}
      ${row('組', s.troupe ? TROUPE_BY_ID[s.troupe].name : '未配属')}
      ${row('役柄', ROLES.find(r => r.id === s.role)?.name)}
      ${row('組替え', s.history?.length > 1 ? historyText(s.history) : '')}
      ${row('ステータス', esc(statuses))}
      ${row('退団', isActive(s) ? '' : s.retired ? `${s.retired}年` : '退団')}
      ${row('メモ', esc(s.note))}
    </dl>`;
  $('#dlg-info').showModal();
}

// ---- 編集 ----
let editTarget = null;
const form = () => $('#edit-form').elements;

function parseHistory(text) {
  const bySymbol = {};
  for (const t of TROUPES) { bySymbol[t.short] = t.id; bySymbol[t.name] = t.id; bySymbol[t.name.replace('組', '')] = t.id; }
  return text.split(/[→>＞ー\-、,\s]+/).map(x => bySymbol[x.trim()]).filter(Boolean);
}

function openEditor(id, preset = {}) {
  const s = id ? state.data.stars.find(x => x.id === id) : null;
  editTarget = s;
  const f = form();
  f.name.value = s?.name ?? '';
  f.term.value = s?.term ?? preset.term ?? '';
  f.troupe.value = s ? s.troupe ?? '' : preset.troupe ?? '';
  f.troupe.dataset.prev = f.troupe.value;
  f.role.value = s?.role ?? (preset.role || 'otoko');
  for (const cb of document.querySelectorAll('#edit-statuses input')) cb.checked = Boolean(s?.statuses?.includes(cb.value));
  f.history.value = historyText(s?.history);
  f.retiredFlag.checked = s ? !isActive(s) : false;
  f.retiredYear.value = s?.retired || '';
  f.note.value = s?.note ?? '';
  $('#edit-title').textContent = s ? `${s.name} を編集` : '追加';
  $('#edit-order').hidden = !s;
  $('#edit-delete').hidden = !s;
  $('#dlg-edit').showModal();
}

function onTroupeChange() {
  const f = form();
  const prev = f.troupe.dataset.prev;
  const next = f.troupe.value;
  f.troupe.dataset.prev = next;
  if (!editTarget || !prev || !next) return;
  const hist = parseHistory(f.history.value);
  if (!hist.length) hist.push(prev);
  if (hist.at(-1) !== next) hist.push(next);
  f.history.value = historyText(hist);
}

const maxOrder = term => Math.max(0, ...state.data.stars.filter(s => s.term === term).map(s => s.order || 0));

function applyEdit() {
  const f = form();
  const term = Number(f.term.value);
  const troupe = f.troupe.value || null;
  const history = parseHistory(f.history.value);
  if (troupe && history.length && history.at(-1) !== troupe) history.push(troupe);
  const rec = {
    name: f.name.value.trim(),
    term,
    role: f.role.value,
    troupe,
    history: history.length > 1 ? history : undefined,
    statuses: [...document.querySelectorAll('#edit-statuses input:checked')].map(cb => cb.value),
    retired: f.retiredFlag.checked || f.retiredYear.value ? Number(f.retiredYear.value) || 0 : undefined,
    note: f.note.value.trim() || undefined,
  };
  if (editTarget) {
    if (editTarget.term !== term) rec.order = maxOrder(term) + 1;
    Object.assign(editTarget, rec);
    for (const k of Object.keys(editTarget)) if (editTarget[k] === undefined) delete editTarget[k];
    markDirty(`${rec.name}を編集`);
  } else {
    const s = { id: `n${Date.now().toString(36)}`, ...rec, order: maxOrder(term) + 1 };
    for (const k of Object.keys(s)) if (s[k] === undefined) delete s[k];
    state.data.stars.push(s);
    markDirty(`${rec.name}を追加`);
  }
  render();
}

// 同じマスの中で1つ上/下の人と入れ替える
function move(dir) {
  const s = editTarget;
  if (!s) return;
  const list = state.data.stars
    .filter(x => x.term === s.term && x.troupe === s.troupe && (!view.split || !s.troupe || x.role === s.role) && isVisible(x))
    .sort((a, b) => a.order - b.order);
  const i = list.indexOf(s);
  const other = list[i + dir];
  if (!other) return toast(dir < 0 ? 'これより上はいません' : 'これより下はいません');
  [s.order, other.order] = [other.order, s.order];
  markDirty(`${s.name}の並び順`);
  render();
  toast(`${other.name} と入れ替えました`);
}

function removeStar() {
  const s = editTarget;
  if (!s || !confirm(`${s.name} を削除しますか？\n（退団の場合は削除ではなく「退団」にチェックがおすすめです）`)) return;
  state.data.stars = state.data.stars.filter(x => x !== s);
  markDirty(`${s.name}を削除`);
  $('#dlg-edit').close();
  render();
}

// ---- 保存 ----
function markDirty(message) {
  state.changes.push(message);
  store.saveDraft({ data: state.data, baseSha: state.sha, changes: state.changes });
  renderSaveButton();
}

function renderSaveButton() {
  const n = state.changes.length;
  $('#btn-save').hidden = n === 0;
  $('#dirty-count').textContent = n ? `（${n}）` : '';
}

async function save(force = false) {
  if (!store.hasToken()) {
    toast('先に「設定」でGitHub連携をしてください');
    openSettings();
    return;
  }
  const btn = $('#btn-save');
  btn.disabled = true;
  toast('保存中…', 0);
  try {
    const list = [...new Set(state.changes)];
    const message = `更新: ${list.slice(0, 5).join('、')}${list.length > 5 ? ` ほか${list.length - 5}件` : ''}`;
    state.data.updatedAt = new Date().toISOString();
    state.sha = await store.saveData(state.data, state.sha, message, { force });
    state.changes = [];
    store.clearDraft();
    toast('保存しました（サイトへの反映は1〜2分後）');
  } catch (e) {
    toast('');
    if (e instanceof store.ConflictError) {
      if (confirm('PCなど他の端末で先に更新されています。\nこの端末の内容で上書きしますか？')) return save(true);
    } else {
      toast(e.message, 6000);
    }
  } finally {
    btn.disabled = false;
    renderSaveButton();
  }
}

// ---- 設定 ----
function openSettings() {
  const f = $('#dlg-settings form').elements;
  f.split.value = view.split ? '1' : '0';
  f.retired.value = view.retired;
  f.allTerms.value = view.allTerms ? '1' : '0';
  f.history.value = view.history ? '1' : '0';
  f.size.value = view.size;
  const cfg = store.getConfig();
  $('#cfg-owner').value = cfg.owner;
  $('#cfg-repo').value = cfg.repo;
  $('#cfg-branch').value = cfg.branch;
  $('#cfg-token').value = cfg.token;
  const d = state.data;
  $('#data-source').textContent = d
    ? `${d.source ?? ''}（取得 ${d.importedAt ?? '-'}${d.updatedAt ? ` / 最終更新 ${d.updatedAt.slice(0, 10)}` : ''}）`
    : '';
  $('#dlg-settings').showModal();
}

const readCfgForm = () => ({
  owner: $('#cfg-owner').value.trim(),
  repo: $('#cfg-repo').value.trim(),
  branch: $('#cfg-branch').value.trim() || 'main',
  token: $('#cfg-token').value.trim(),
});

function bindSettings() {
  $('#dlg-settings').addEventListener('change', e => {
    const { name, value } = e.target;
    if (!(name in view) || e.target.closest('.field-input')) return;
    view[name] = name === 'retired' || name === 'size' ? value : value === '1';
    saveView();
    render();
  });
  // 結果は設定シートの中にも出す（スマホではトーストがシートに隠れやすいため）
  const cfgStatus = (text, ok) => {
    const el = $('#cfg-status');
    el.textContent = text;
    el.dataset.state = ok === undefined ? '' : ok ? 'ok' : 'ng';
  };
  $('#cfg-test').addEventListener('click', async () => {
    cfgStatus('接続中…');
    try {
      const r = await store.testConnection(readCfgForm());
      cfgStatus(`✓ 接続できました（${r.count}人分のデータ）`, true);
    } catch (e) {
      cfgStatus(`✕ ${e.message}`, false);
    }
  });
  $('#cfg-save').addEventListener('click', async () => {
    store.setConfig(readCfgForm());
    cfgStatus('✓ 連携設定を保存しました', true);
    if (!state.changes.length) await reload();
  });
  $('#btn-download').addEventListener('click', () => {
    const blob = new Blob([store.serialize(state.data)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `stars-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  });
  $('#btn-discard').addEventListener('click', async () => {
    if (!state.changes.length) return toast('未保存の変更はありません');
    if (!confirm(`未保存の変更（${state.changes.length}件）を破棄しますか？`)) return;
    store.clearDraft();
    state.changes = [];
    await reload();
    toast('破棄しました');
  });
}

// ---- 共通 ----
let toastTimer;
function toast(text, ms = 3000) {
  const el = $('#toast');
  const popover = typeof el.showPopover === 'function';
  el.textContent = text;
  clearTimeout(toastTimer);
  // 開いているシートより手前に出すため、表示のたびに最前面へ出し直す
  if (popover && el.matches(':popover-open')) el.hidePopover();
  if (text && popover) el.showPopover();
  el.classList.toggle('show', Boolean(text));
  if (text && ms) {
    toastTimer = setTimeout(() => {
      el.classList.remove('show');
      if (popover && el.matches(':popover-open')) el.hidePopover();
    }, ms);
  }
}

async function reload() {
  const { data, sha } = await store.loadData();
  state.data = data;
  state.sha = sha;
  render();
}

function bindUi() {
  $('#edit-troupe').innerHTML = TROUPES.map(t => `<option value="${t.id}">${t.name}</option>`).join('') + '<option value="">未配属</option>';
  $('#edit-statuses').innerHTML = STATUSES.map(s =>
    `<label class="check"><input type="checkbox" value="${s.id}"><span>${s.label}</span></label>`).join('');

  document.addEventListener('click', e => {
    const focusBtn = e.target.closest('[data-focus]');
    if (focusBtn) return setFocus(focusBtn.dataset.focus);
    const add = e.target.closest('[data-add]');
    if (add) {
      const td = add.closest('td');
      return openEditor(null, { term: Number(td.dataset.term), troupe: td.dataset.troupe, role: td.dataset.role });
    }
    const star = e.target.closest('#wrap .star[data-id]');
    if (star) return state.editing ? openEditor(star.dataset.id) : openInfo(star.dataset.id);
  });

  $('#btn-edit').addEventListener('click', () => {
    state.editing = !state.editing;
    $('#btn-edit').setAttribute('aria-pressed', state.editing);
    $('#btn-edit').textContent = state.editing ? '編集中' : '編集';
    render();
    if (state.editing) toast('名前をタップで編集、＋で追加');
  });
  $('#btn-save').addEventListener('click', () => save());
  $('#btn-settings').addEventListener('click', openSettings);

  $('#edit-troupe').addEventListener('change', onTroupeChange);
  $('#edit-form').addEventListener('submit', e => {
    if (e.submitter?.value === 'ok') applyEdit();
  });
  for (const b of document.querySelectorAll('[data-move]')) b.addEventListener('click', () => move(Number(b.dataset.move)));
  $('#edit-delete').addEventListener('click', removeStar);

  // シートの外側タップで閉じる
  for (const dlg of document.querySelectorAll('dialog')) {
    dlg.addEventListener('click', e => { if (e.target === dlg) dlg.close(); });
  }
  bindSettings();
}

async function init() {
  bindUi();
  const draft = store.loadDraft();
  try {
    const { data, sha } = await store.loadData();
    if (draft?.changes?.length) {
      state.data = draft.data;
      state.sha = draft.baseSha ?? sha;
      state.changes = draft.changes;
      toast('前回の未保存の変更を復元しました');
    } else {
      state.data = data;
      state.sha = sha;
    }
  } catch (e) {
    if (!draft) {
      $('#wrap').innerHTML = `<p class="loading">${esc(e.message)}</p>`;
      return;
    }
    Object.assign(state, { data: draft.data, sha: draft.baseSha, changes: draft.changes });
  }
  render();
}

init();
