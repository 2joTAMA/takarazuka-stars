import { TROUPES, TROUPE_BY_ID, ROLES, statusLabel, SHINKO_MAX_KEN, kenOf, isActive, isTop } from './config.js?v=14';
import * as store from './store.js?v=14';
import { ICONS } from './icons.js?v=14';

// 更新したら index.html と import の ?v= と一緒に上げる（iPhoneの古いキャッシュ対策）
const APP_VERSION = 14;

const $ = sel => document.querySelector(sel);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

// ---- 表示設定（この端末だけ） ----
const LS_VIEW = 'tz.view';
const view = {
  split: false, mark: 'dots', retired: 'leads', senka: true, allTerms: false, history: true, size: 'm', theme: null, focus: null,
  ...readView(),
};
// v14 で初期設定を「まとめる」「主演経験者」に変えたので、それより前の設定は一度だけ合わせる
if ((view.ver ?? 0) < 14) Object.assign(view, { split: false, retired: 'leads', ver: 14 });
// まとめたときの見分け方は「両方に点」だけにした
view.mark = 'dots';
// ライト・ダークはヘッダーのボタンで切り替えて覚えておく（初めて開いたときだけ端末の設定に合わせる）
if (view.theme !== 'light' && view.theme !== 'dark') view.theme = matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
function readView() {
  try { return JSON.parse(localStorage.getItem(LS_VIEW)) || {}; } catch { return {}; }
}
function saveView() {
  try { localStorage.setItem(LS_VIEW, JSON.stringify(view)); } catch { /* 保存できなくても表示はできる */ }
}

const state = { data: null };

// ---- 表 ----
const cellKey = (term, troupe, role) => `${term}|${troupe ?? ''}|${role ?? ''}`;
const historyText = h => (h || []).map(id => TROUPE_BY_ID[id]?.short ?? '?').join('→');

// 初舞台・退団公演の「2009年 宙組『…』」の形（初舞台の組は「宙組」、退団公演の組は組のid で入っている）
const showText = d => d ? `${d.y}年 ${esc(TROUPE_BY_ID[d.g]?.name ?? d.troupe ?? '')}『${esc(d.t)}』` : '';

function isVisible(s) {
  if (isActive(s)) return true;
  if (view.retired === 'tops') return isTop(s);
  // 主演経験者: トップと別箱（バウ・東上）主演。新公主演だけの人は出さない
  if (view.retired === 'leads') return isTop(s) || (s.statuses || []).some(st => st === 'bow' || st === 'tojo');
  return false;
}

function starHtml(s) {
  const cls = ['star', `role-${s.role}`, ...(s.statuses || []).map(st => `st-${st}`)];
  if (!isActive(s)) cls.push('is-retired');
  const hist = view.history && s.history?.length > 1 ? `<span class="hist">(${historyText(s.history).replaceAll('→', '→<wbr>')})</span>` : '';
  return `<span class="${cls.join(' ')}" data-id="${esc(s.id)}"><span class="nm">${esc(s.name)}</span>${hist}</span>`;
}

const kenHtml = n => `<span class="ken"><small>研</small>${n}</span>`;
const nin = n => `${n}<small class="unit">人</small>`;

function applyTheme() {
  const dark = view.theme === 'dark';
  document.documentElement.dataset.theme = view.theme;
  document.querySelector('meta[name="theme-color"]').content = dark ? '#2e2770' : '#5b4bc4';
  // ボタンには押したあとのモードのマーク（ライトなら月、ダークなら太陽）
  const btn = $('#btn-theme');
  if (btn) btn.innerHTML = dark ? ICONS.sun : ICONS.moon;
}

function render() {
  applyTheme();
  document.body.dataset.size = view.size;
  renderTabs();

  const troupes = view.focus ? [TROUPE_BY_ID[view.focus]] : TROUPES.filter(t => view.senka || t.id !== 'senka');
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
  const cellStars = list => list.map(starHtml).join('');

  const activeTerms = new Set(active.map(s => s.term));
  const terms = [...new Set(stars.map(s => s.term))]
    .filter(t => view.allTerms || activeTerms.has(t))
    .sort((a, b) => a - b);
  const now = new Date();
  const upper = terms.filter(t => kenOf(t, now) > SHINKO_MAX_KEN);
  const lower = terms.filter(t => kenOf(t, now) <= SHINKO_MAX_KEN);
  const colCount = troupes.length * roles.length;
  const split = roles.length > 1;

  const countIn = (termSet, troupe, role) =>
    active.filter(s => termSet.has(s.term) && s.troupe === troupe && (!role || s.role === role)).length;

  let h = `<table class="grid ${split ? 'split' : `merged mark-${view.mark}`}${view.focus ? ' focus' : ''}"><thead><tr class="h1">`;
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
    const head = `<th class="c-term">${term}</th><td class="c-ken">${kenHtml(kenOf(term, now))}</td>`;
    const sum = `<td class="c-sum">${termActive ? nin(termActive) : ''}</td>`;
    const unassigned = cells.get(cellKey(term, null, null)) || [];
    const unassignedCell = label =>
      `<td class="cell un-cell" colspan="${colCount}" data-term="${term}" data-troupe="" data-role=""><span class="un-label">${label}</span>${cellStars(unassigned)}</td>`;
    const hasAssigned = troupes.some(t => roles.some(r => cells.get(cellKey(term, t.id, r))?.length));
    // 期の全員が未配属（組まわり中）なら、その期の行に組を横断して並べる
    if (unassigned.length && !hasAssigned) {
      h += `<tr class="unassigned">${head}${unassignedCell('未配属（組まわり中）')}${sum}</tr>`;
      return;
    }
    h += `<tr>${head}`;
    for (const t of troupes) {
      for (const r of roles) {
        const list = cells.get(cellKey(term, t.id, r)) || [];
        const tend = !r || r === 'musume' ? ' tend' : '';
        h += `<td class="cell t-${t.id}${r ? ` r-${r}` : ''}${tend}" data-term="${term}" data-troupe="${t.id}" data-role="${r ?? ''}">${cellStars(list)}</td>`;
      }
    }
    h += `${sum}</tr>`;
    if (unassigned.length) {
      h += `<tr class="unassigned"><th class="c-term"></th><td class="c-ken"></td>${unassignedCell(`${term}期 未配属`)}<td class="c-sum"></td></tr>`;
    }
  };
  const subtotal = (list, label, cls) => {
    const set = new Set(list);
    const total = active.filter(s => set.has(s.term)).length;
    h += `<tr class="sub ${cls}"><th class="c-term" colspan="2"${rs}>${label}</th>`;
    for (const t of troupes) for (const r of roles) {
      h += `<td class="${!r || r === 'musume' ? 'tend' : ''}">${nin(countIn(set, t.id, r))}</td>`;
    }
    h += `<td class="c-sum"${rs}>${nin(total)}</td></tr>`;
    if (split) {
      h += `<tr class="sub sub2 ${cls}">`;
      for (const t of troupes) h += `<td class="tend" colspan="2">${nin(countIn(set, t.id, null))}</td>`;
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
    <span class="lg"><span class="lg-badge">組</span>組長</span>
    <span class="lg"><span class="lg-badge">副</span>副組長</span>
    ${sample('st-shinko', '新公主演・ヒロイン')}
    ${sample('st-top is-retired', '退団トップ')}
    ${view.split ? '' : `<span class="mark-${view.mark}">${sample('role-otoko', '男役')}${sample('role-musume', '娘役')}</span>`}
    <span class="legend-note">研${SHINKO_MAX_KEN}までが新人公演の対象</span>
  </div>`;
}

function renderTabs() {
  const tabs = [...TROUPES.filter(t => t.id !== 'senka').map(t => ({ id: t.id, label: t.short })), { id: '', label: '全体' }];
  $('#tabs').innerHTML = tabs.map(t =>
    `<button class="tab t-${t.id || 'all'}" data-focus="${t.id}" aria-pressed="${(view.focus ?? '') === t.id}">${ICONS[t.id || 'all']}<span>${t.label}</span></button>`
  ).join('');
}

// 組別表示のときは左右スワイプで隣の組へ（指を左へ→次の組、右へ→前の組。全体からは移らない）
function bindSwipe() {
  const wrap = $('#wrap');
  let start = null;
  wrap.addEventListener('touchstart', e => {
    start = view.focus && e.touches.length === 1
      ? { x: e.touches[0].clientX, y: e.touches[0].clientY, t: Date.now() }
      : null;
  }, { passive: true });
  wrap.addEventListener('touchend', e => {
    if (!start) return;
    const p = e.changedTouches[0];
    const dx = p.clientX - start.x;
    const dy = p.clientY - start.y;
    const quick = Date.now() - start.t < 700;
    start = null;
    if (!quick || Math.abs(dx) < 60 || Math.abs(dx) < Math.abs(dy) * 1.5) return;
    const order = [null, ...TROUPES.filter(t => t.id !== 'senka').map(t => t.id)];
    const i = order.indexOf(view.focus);
    const next = order[i + (dx < 0 ? 1 : -1)];
    if (i < 0 || next === undefined) return;
    view.focus = next;
    saveView();
    render();
    const grid = wrap.querySelector('.grid');
    grid?.classList.add(dx < 0 ? 'slide-from-right' : 'slide-from-left');
      });
}

// 下部メニューはその組へ、表の組見出しは押すたびに組別⇄全体を切り替える
function setFocus(id, exact = false) {
  view.focus = exact ? id || null : id && view.focus !== id ? id : null;
  saveView();
  render();
  $('#wrap').scrollLeft = 0;
}

// ---- 閲覧用の詳細 ----
const WORK_TAG = { shinko: '新公', bow: 'バウ', tojo: '東上', tour: '全ツ', top: 'トップ' };
// バウでも東上でもない主演作（ドラマシティだけ、など）は、1つの劇場ならその略称をラベルにする
const VENUE_TAG = {
  'ドラマシティ': 'DC', '梅芸メインホール': '梅芸', 'バウ': 'バウ',
  '博多座': '博多座', '御園座': '御園座', '中日劇場': '中日', '日生劇場': '日生', '全国ツアー': '全ツ',
};
function worksHtml(s) {
  if (!s.works?.length) return '';
  let prev = null;
  const items = s.works.map(w => {
    // 大劇場主演・ヒロインは会場に「大劇場」と出し、ラベルは主演／ヒロイン（男役が女役でヒロインを務めた例もあるので印に従う）
    const lead = (w.k === 'grand' ? w.h : s.role === 'musume') ? 'ヒロイン' : '主演';
    const tag = WORK_TAG[w.k] ?? (w.k === 'grand' ? lead : VENUE_TAG[w.v] ?? lead);
    const venue = w.v ?? (w.k === 'top' ? '大劇場' : '');
    // 組が変わったところ（初めの組・組替え）に組名の見出しを入れる
    const head = w.g && w.g !== prev ? `<li class="w-group t-${w.g}">${TROUPE_BY_ID[w.g].name}</li>` : '';
    prev = w.g || prev;
    return `${head}<li><span class="w-year">${w.y}</span><span class="w-tag k-${w.k}${tag.length > 3 ? ' long' : ''}">${tag}</span><span class="w-title">${esc(w.t)}${venue ? `<small>${esc(venue)}</small>` : ''}</span></li>`;
  }).join('');
  return `<h3 class="info-sub">主演作品</h3><ul class="works">${items}</ul>`;
}


function openInfo(id) {
  const s = state.data.stars.find(x => x.id === id);
  if (!s) return;
  const row = (k, v) => v ? `<dt>${k}</dt><dd>${v}</dd>` : '';
  // 詳細では名前は色を付けず、肩書きはラベルで出す
  const badges = ['top', 'topMusume', 'kumicho', 'fukuKumicho'].filter(st => s.statuses?.includes(st))
    .map(st => `<span class="info-badge b-${st}">${st === 'top' ? 'トップスター' : statusLabel(st, s.role)}</span>`).join('');
  const dot = `<span class="role-dot role-${s.role}"></span>`;
  // 右上に今の組（組替えした人は最後の組）のマークを薄く大きく出す
  const mark = s.troupe && ICONS[s.troupe] ? `<div class="info-mark t-${s.troupe}">${ICONS[s.troupe]}</div>` : '';
  $('#info-body').innerHTML = `${mark}
    <div class="info-head">${dot}<div>${s.kana ? `<div class="info-kana">${esc(s.kana)}</div>` : ''}<h2 class="info-name">${esc(s.name)}${badges}</h2></div></div>
    <dl class="info">
      ${row('期', `${s.term}期（研${kenOf(s.term)}）`)}
      ${row('組', s.troupe ? TROUPE_BY_ID[s.troupe].name : '未配属')}
      ${row('役柄', dot + ROLES.find(r => r.id === s.role)?.name)}
      ${row('組替え', s.history?.length > 1 ? historyText(s.history) : '')}
      ${row('初舞台', showText(state.data.debuts?.[s.term]))}
      ${row('退団', isActive(s) ? '' : showText(s.farewell) || (s.retired ? `${s.retired}年` : '退団'))}
    </dl>
    ${worksHtml(s)}`;
  $('#dlg-info').showModal();
}

// ---- 設定 ----
function openSettings() {
  const f = $('#dlg-settings form').elements;
  f.split.value = view.split ? '1' : '0';
  f.retired.value = view.retired;
  f.allTerms.value = view.allTerms ? '1' : '0';
  f.senka.value = view.senka ? '1' : '0';
  f.history.value = view.history ? '1' : '0';
  f.size.value = view.size;
  const d = state.data;
  $('#data-source').textContent = d ? `${d.source ?? ''}（最終取得 ${d.importedAt ?? '-'}）` : '';
  $('#app-version').textContent = `アプリの版: ${APP_VERSION}`;
  $('#dlg-settings').showModal();
}

function bindSettings() {
  $('#dlg-settings').addEventListener('change', e => {
    const { name, value } = e.target;
    if (!(name in view) || e.target.closest('.field-input')) return;
    view[name] = value === '1' ? true : value === '0' ? false : value;
    saveView();
    render();
  });
  $('#btn-reload').addEventListener('click', async () => {
    try {
      await reload();
      toast(`読み込みました（最終取得 ${state.data.importedAt}）`);
    } catch (e) {
      toast(e.message, 6000);
    }
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
  if (popover) {
    try {
      if (el.matches(':popover-open')) el.hidePopover();
      if (text) el.showPopover();
    } catch { /* 古いブラウザは通常表示 */ }
  }
  el.classList.toggle('show', Boolean(text));
  if (text && ms) {
    toastTimer = setTimeout(() => {
      el.classList.remove('show');
      try { if (popover && el.matches(':popover-open')) el.hidePopover(); } catch { /* 同上 */ }
    }, ms);
  }
}

async function reload() {
  state.data = await store.loadData();
  render();
}

function bindUi() {
  $('#btn-settings').innerHTML = `${ICONS.settings}<span>設定</span>`;
  document.addEventListener('click', e => {
    const focusBtn = e.target.closest('[data-focus]');
    if (focusBtn) return setFocus(focusBtn.dataset.focus, focusBtn.classList.contains('tab'));
    const star = e.target.closest('#wrap .star[data-id]');
    if (star) return openInfo(star.dataset.id);
  });

  $('#btn-settings').addEventListener('click', openSettings);
  $('#btn-theme').addEventListener('click', () => {
    view.theme = view.theme === 'dark' ? 'light' : 'dark';
    saveView();
    applyTheme();
  });

  // シートの外側タップで閉じる
  for (const dlg of document.querySelectorAll('dialog')) {
    dlg.addEventListener('click', e => { if (e.target === dlg) dlg.close(); });
  }
  bindSettings();
  bindSwipe();
}

// ホーム画面アプリでは 100dvh が実際より短いことがあるので、実測した高さを使う
function syncAppHeight() {
  const h = window.innerHeight || window.visualViewport?.height || 0;
  if (h) document.documentElement.style.setProperty('--app-h', h + 'px');
}
syncAppHeight();
addEventListener('resize', syncAppHeight);
addEventListener('orientationchange', syncAppHeight);
window.visualViewport?.addEventListener('resize', syncAppHeight);

async function init() {
  applyTheme();
  bindUi();
  try {
    state.data = await store.loadData();
  } catch (e) {
    $('#wrap').innerHTML = `<p class="loading">${esc(e.message)}</p>`;
    return;
  }
  render();
}

init();
