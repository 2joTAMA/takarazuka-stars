// Wikipedia の期別ページ・組ページから初期データを作るスクリプト
// usage: node tools/import-wikipedia.mjs <cacheDir> <outFile> [fromTerm] [toTerm]
// 取得済みのページは cacheDir に保存して再利用する
import fs from 'node:fs';
import path from 'node:path';

const [cacheDir, outFile, fromArg = '45', toArg = '112'] = process.argv.slice(2);
if (!cacheDir || !outFile) {
  console.error('usage: node tools/import-wikipedia.mjs <cacheDir> <outFile> [fromTerm] [toTerm]');
  process.exit(1);
}
fs.mkdirSync(cacheDir, { recursive: true });

const TROUPES = { '花組': 'hana', '月組': 'tsuki', '雪組': 'yuki', '星組': 'hoshi', '宙組': 'sora', '専科': 'senka' };
const TROUPE_PAGES = { hana: '花組 (宝塚歌劇)', tsuki: '月組 (宝塚歌劇)', yuki: '雪組 (宝塚歌劇)', hoshi: '星組 (宝塚歌劇)', sora: '宙組 (宝塚歌劇)' };

async function raw(title, file) {
  const f = path.join(cacheDir, file);
  if (fs.existsSync(f)) return fs.readFileSync(f, 'utf8');
  const url = 'https://ja.wikipedia.org/w/index.php?action=raw&title=' + encodeURIComponent(title);
  const res = await fetch(url, { headers: { 'User-Agent': 'takarazuka-stars-personal/0.1' } });
  if (!res.ok) return '';
  const text = await res.text();
  fs.writeFileSync(f, text);
  return text;
}

const clean = s => s
  .replace(/<ref[^>]*\/>/g, '').replace(/<ref[^>]*>[\s\S]*?<\/ref>/g, '')
  .replace(/\{\{[^{}]*\}\}/g, '').replace(/<!--[\s\S]*?-->/g, '').replace(/<[^>]+>/g, '')
  .replace(/\[\[(?:[^\]|]*\|)?([^\]]*)\]\]/g, '$1').replace(/'''?/g, '').trim();
const linkTarget = s => (s.match(/\[\[([^\]|]*)\|/) || [])[1];
const names = s => s.split(/[、，,]/).map(clean).filter(Boolean);
const section = (txt, heading) => {
  const i = txt.indexOf(`== ${heading} ==`);
  if (i < 0) return '';
  const rest = txt.slice(i + heading.length + 6);
  return rest.slice(0, rest.search(/\n==[^=]/) >>> 0);
};

const stars = [];
for (let term = Number(fromArg); term <= Number(toArg); term++) {
  const txt = await raw(`宝塚歌劇団${term}期生`, `k${term}.txt`);
  if (!txt) continue;
  const listOf = re => new Set(names((txt.match(re) || [, ''])[1]));
  const shinko = listOf(/新人公演主演（ヒロイン）経験者に(.*?)がいる/);
  const bow = listOf(/バウホール公演主演（ヒロイン）経験者に(.*?)がいる/);

  const tables = txt.split('{|').slice(1).map(t => t.split(/\n\s*\|\}/)[0]);
  const table = tables.find(t => t.includes('役柄')) || '';
  const hasHaizoku = /!\s*配属/.test(table);
  let order = 0;
  for (const row of table.split(/\n\s*\|-/).slice(1)) {
    const cells = row.split(/\n\s*\|/).slice(1)
      .map(c => c.replace(/^\s*\|?/, '').replace(/^\s*style="[^"]*"\s*\|/, ''));
    const ri = cells.findIndex(c => /^(男役|娘役)/.test(clean(c)));
    if (ri < 0) continue;
    order++;
    const roleRaw = clean(cells[ri]);
    const oldFmt = /^\d{4}年/.test(clean(cells[ri + 1] || ''));
    const history = (oldFmt ? '' : clean(cells[ri + 1] || ''))
      .split('→').map(s => TROUPES[s.trim()]).filter(Boolean);
    const retiredRaw = clean(cells[ri + (oldFmt ? 1 : 2)] || '');
    const ry = retiredRaw.match(/^(\d{4})/);
    let name = clean(cells[0]).replace(/\s/g, '');
    // 在団中に改名した人はリンク先（現在の芸名）を使う
    if (!ry && linkTarget(cells[0]) && /改名/.test(cells.at(-1) || '')) name = linkTarget(cells[0]);
    const statuses = [];
    if (shinko.has(name)) statuses.push('shinko');
    if (bow.has(name)) statuses.push('bow');
    stars.push({
      name, term, order,
      role: roleRaw === '娘役' || /→娘役$/.test(roleRaw) ? 'musume' : 'otoko',
      troupe: history.at(-1) || null,
      history,
      retired: ry ? Number(ry[1]) : null,
      statuses,
      _oldFmt: oldFmt || !hasHaizoku,
    });
  }
}

const byName = new Map(stars.map(s => [s.name, s]));
const add = (s, st) => { if (s && !s.statuses.includes(st)) s.statuses.push(st); };

// 専科の現役一覧（期別ページの古い表には配属が載っていないため）
const senkaTxt = await raw('専科 (宝塚歌劇)', 'senka.txt');
const senkaNow = section(senkaTxt, '在籍中の専科生徒一覧');
const senkaNames = [...senkaNow.matchAll(/^\*\s*\[\[([^\]|]*)/gm)].map(m => m[1]);
const ALIASES = { '京三紗子': '京三紗', '汝鳥玲': '汝鳥伶' };
for (const s of stars) if (ALIASES[s.name]) s.name = ALIASES[s.name];
for (const n of senkaNames) {
  const s = stars.find(x => x.name === n);
  if (!s) { console.warn('専科: 見つからない', n); continue; }
  s.retired = null;
  if (s.troupe !== 'senka') { s.history.push('senka'); s.troupe = 'senka'; }
}
// 古い形式の表で配属が無く、専科一覧にも無い人は退団扱い
for (const s of stars) if (s._oldFmt && s.retired === null && s.troupe !== 'senka') s.retired = true;

// 各組ページ: 現在の組長・副組長、歴代トップ
for (const [tid, title] of Object.entries(TROUPE_PAGES)) {
  const txt = await raw(title, `g-${tid}.txt`);
  const lead = clean(txt.slice(0, 3000)).match(/組長は(.*?)、副組長は(.*?)。/);
  if (lead) {
    for (const n of names(lead[1])) add(byName.get(n), 'kumicho');
    for (const n of names(lead[2])) add(byName.get(n), 'fukuKumicho');
  } else console.warn('組長が読めない', tid);
  for (const [heading, st] of [['歴代トップスター', 'top'], ['歴代トップ娘役', 'topMusume']]) {
    for (const m of section(txt, heading).matchAll(/^\*\s*(\[\[[^\]]*\]\])/gm)) {
      const s = byName.get(clean(m[1]));
      if (!s) continue;
      add(s, st);
      s.topOf = [...new Set([...(s.topOf || []), tid])];
    }
  }
}

// 現役 + 退団したトップだけを残す
const keep = stars.filter(s => !s.retired || s.statuses.includes('top') || s.statuses.includes('topMusume'));
let seq = 0;
const out = keep.map(s => {
  const r = {
    id: `s${(++seq).toString(36)}`,
    name: s.name, term: s.term, order: s.order, role: s.role,
    troupe: s.retired && s.topOf ? s.topOf.at(-1) : s.troupe,
    history: s.history,
    retired: s.retired === true ? 0 : s.retired,
    statuses: s.statuses,
  };
  if (r.history.length <= 1) delete r.history;
  if (r.retired === null) delete r.retired;
  return r;
});
fs.writeFileSync(outFile, JSON.stringify({
  version: 1,
  source: 'Wikipedia日本語版（宝塚歌劇団◯期生・各組の記事）から自動取得',
  importedAt: new Date().toISOString().slice(0, 10),
  stars: out,
}, null, 1));

const active = out.filter(s => s.retired === undefined);
const count = {};
for (const s of active) count[s.troupe ?? '未配属'] = (count[s.troupe ?? '未配属'] || 0) + 1;
console.log('出力', out.length, '件 / 現役', active.length, count);
