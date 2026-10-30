// Wikipedia の個人ページから主演・ヒロイン作品（作品名と上演年）を取り込み、stars.json の works に入れる
// あわせて退団者全員の退団公演（farewell）も取り込む
// usage: node tools/import-works.mjs <cacheDir> <stars.json> [fromTerm=85]
// works: [{ y: 初日の年, t: 作品名, k: 種類, g?: 組, v?: 会場 }]
// farewell: { y: 年, t: 作品名, g?: 組 }
//   k = shinko（新人公演） / bow（バウ） / tojo（東上） / tour（全国ツアー） / top（トップ時代の公演） / lead（その他の主演・ヒロイン）
import fs from 'node:fs';
import path from 'node:path';

const [cacheDir, starsFile, fromArg = '85'] = process.argv.slice(2);
if (!cacheDir || !starsFile) {
  console.error('usage: node tools/import-works.mjs <cacheDir> <stars.json> [fromTerm]');
  process.exit(1);
}
fs.mkdirSync(path.join(cacheDir, 'p'), { recursive: true });

async function raw(title, file) {
  const f = path.join(cacheDir, file);
  if (fs.existsSync(f)) return follow(fs.readFileSync(f, 'utf8'), file);
  const res = await fetch('https://ja.wikipedia.org/w/index.php?action=raw&title=' + encodeURIComponent(title),
    { headers: { 'User-Agent': 'takarazuka-stars-personal/0.1' } });
  await new Promise(r => setTimeout(r, 300)); // 続けて取りすぎると失敗するので少し待つ
  if (!res.ok) { console.warn('取得失敗', res.status, title); return ''; } // 失敗はキャッシュしない
  const text = await res.text();
  fs.writeFileSync(f, text);
  return follow(text, file);
}
// 「#転送 [[真矢ミキ]]」のような転送ページは転送先を読む
function follow(text, file) {
  const to = text.match(/^#(?:転送|REDIRECT)\s*\[\[([^\]|#]+)/i)?.[1];
  return to ? raw(to, path.join(path.dirname(file), `${to}.txt`)) : text;
}

const clean = s => s
  .replace(/<ref[^>]*\/>/g, '').replace(/<ref[\s\S]*?<\/ref>/g, '').replace(/\{\{[^{}]*\}\}/g, '')
  .replace(/<!--[\s\S]*?-->/g, '').replace(/<[^>]+>/g, '')
  .replace(/\[\[(?:[^\]|]*\|)?([^\]]*)\]\]/g, '$1').replace(/'''?/g, '').trim();

const TROUPE_OF = { '花': 'hana', '月': 'tsuki', '雪': 'yuki', '星': 'hoshi', '宙': 'sora', '専科': 'senka' };
const troupeIn = s => TROUPE_OF[(s.match(/(花|月|雪|星|宙)組|専科/) || [])[1] ?? (/専科/.test(s) ? '専科' : '')];

// 宝塚在団中の舞台の行だけを対象にする（退団後・TV・イベントなどの節に入ったら止める）
// 「雪組時代」のような見出しから、その行がどの組の公演かも拾う
// （見出しが無いページは、行の『』より前に書かれた「○組」を使う）
const STOP_HEADING = /退団後|出演イベント|イベント|TV|テレビ|映画|ドラマ|CM|広告|コンサート|ライブ|受賞|人物|著書|写真集|ディスコグラフィ|外部リンク|脚注/;
function stageLines(txt) {
  const out = [];
  let inStage = false;
  let g = null;
  let blocked = false; // 「退団後の活動」などの大見出しの中は、小見出しが「舞台」でも対象外
  for (const line of txt.split('\n')) {
    const h = line.match(/^(=+)\s*(.*?)\s*=+\s*$/);
    if (h) {
      if (h[1].length <= 2) blocked = STOP_HEADING.test(h[2]);
      inStage = !blocked && /舞台|時代|初舞台|組まわり|組回り|宝塚歌劇団/.test(h[2]) && !STOP_HEADING.test(h[2]);
      g = /初舞台|組まわり|組回り/.test(h[2]) ? null : troupeIn(h[2]) ?? null;
      continue;
    }
    if (inStage && /^\*\s*\d{4}年/.test(line)) {
      const before = clean(line).replace(/^\*\s*\d{4}年[^、『]*、?/, '').split('『')[0];
      out.push({ line, g: g ?? troupeIn(before.slice(0, 12)) ?? null });
    }
  }
  return out;
}

const titlesOf = s => [...s.matchAll(/『([^』]+)』/g)].map(m => m[1].trim());
// 劇場名の略称（ドラマシティ・梅芸メインホール・赤坂ACTシアターだけ。ほかは書かれたまま）
const VENUE_ABBR = [
  // 「シアター・ドラマシティ」は中点で区切られるので、区切る前に置き換える
  // 「赤坂ACTシアター・ドラマシティ」は2つの劇場なので、ACT の直後は置き換えない
  [/梅田芸術劇場シアター・ドラマシティ|(?<!ACT)シアター・ドラマシティ/g, 'ドラマシティ'],
  [/梅田芸術劇場(メインホール)?(?!シアター)/g, '梅芸メインホール'],
  [/TBS赤坂ACTシアター/g, '赤坂ACTシアター'],
];
const shortVenue = v => {
  let s = v.replace(/\s+/g, '');
  for (const [re, abbr] of VENUE_ABBR) s = s.replace(re, abbr);
  return [...new Set(s.split('・'))].slice(0, 3).join('・');
};
const venueOf = s => {
  const m = [...s.matchAll(/（([^（）]+)）/g)].map(x => x[1]).find(x =>
    /全国ツアー|博多座|バウ|青年館|ドラマシティ|梅田|東京建物|KAAT|フォーラム|オーブ|赤坂|御園座|中日劇場|シアター|ホール|劇場|台湾|香港|公演/.test(x));
  if (!m) return undefined;
  if (/全国ツアー/.test(m)) return '全国ツアー';
  return shortVenue(m);
};
const startOf = line => {
  const m = line.match(/(\d{4})年\s*(\d{1,2})?/);
  return { y: Number(m[1]), m: Number(m[2] || 1) };
};

function kindOf(mark) {
  if (!/主演|ヒロイン/.test(mark)) return null;
  if (/新人公演/.test(mark)) return 'shinko';
  if (/バウ/.test(mark)) return 'bow';
  if (/東上/.test(mark)) return 'tojo';
  if (/全国ツアー/.test(mark)) return 'tour';
  return 'lead';
}

// 歴代トップの就任日（お披露目の印が無いページ用）
const TROUPE_PAGES = { hana: '花組 (宝塚歌劇)', tsuki: '月組 (宝塚歌劇)', yuki: '雪組 (宝塚歌劇)', hoshi: '星組 (宝塚歌劇)', sora: '宙組 (宝塚歌劇)' };
const topSince = new Map();
for (const [tid, title] of Object.entries(TROUPE_PAGES)) {
  const txt = await raw(title, `g-${tid}.txt`);
  for (const m of txt.matchAll(/^\*\s*(\[\[[^\]]*\]\])（(\d{4})年(\d{1,2})月/gm)) {
    const name = clean(m[1]);
    const d = { y: Number(m[2]), m: Number(m[3]) };
    const prev = topSince.get(name);
    if (!prev || d.y < prev.y || (d.y === prev.y && d.m < prev.m)) topSince.set(name, d);
  }
}

const data = JSON.parse(fs.readFileSync(starsFile, 'utf8'));
const targets = data.stars.filter(s => s.term >= Number(fromArg)
  && (s.statuses || []).some(st => ['top', 'topMusume', 'shinko', 'bow', 'tojo'].includes(st)));
let withWorks = 0;
for (const s of targets) {
  const txt = await raw(s.name, `p/${s.name}.txt`);
  if (!txt) { console.warn('ページなし', s.name); continue; }
  const entries = stageLines(txt);
  const lines = entries.map(e => e.line);
  const isTop = s.statuses.includes('top') || s.statuses.includes('topMusume');
  let topIdx = isTop ? lines.findIndex(l => /'''[^']*トップお披露目/.test(l)) : -1;
  if (isTop && topIdx < 0 && topSince.has(s.name)) {
    const d = topSince.get(s.name);
    topIdx = lines.findIndex(l => { const x = startOf(l); return x.y > d.y || (x.y === d.y && x.m >= d.m); });
  }
  let endIdx = lines.findIndex((l, i) => i >= Math.max(topIdx, 0) && /'''[^']*退団公演/.test(l));
  if (endIdx < 0) endIdx = lines.length - 1;

  const works = [];
  lines.forEach((line, i) => {
    const c = clean(line);
    const { y } = startOf(line);
    if (s.retired && y > s.retired) return;
    if (topIdx >= 0 && i >= topIdx && i <= endIdx) {
      if (/外部出演|特別出演/.test(line)) return;
      const t = titlesOf(c);
      if (t.length) works.push({ y, t: t.join('／'), k: 'top', g: entries[i].g, v: venueOf(c) });
      return;
    }
    const marks = [...line.matchAll(/'''([^']+)'''/g)].map(m => clean(m[1]));
    const kinds = [...new Set(marks.flatMap(m => m.split(/[、・]/).length > 1 && /バウ・東上/.test(m) ? ['bow', 'tojo'] : [kindOf(m)]).filter(Boolean))];
    for (const k of kinds) {
      let t;
      if (k === 'shinko') {
        const at = c.indexOf('新人公演：');
        t = titlesOf(at >= 0 ? c.slice(0, at) : c).at(-1);
      } else t = titlesOf(c)[0];
      if (t) works.push({ y, t, k, g: entries[i].g, v: k === 'lead' || k === 'tojo' ? venueOf(c) : undefined });
    }
  });
  for (const w of works) { if (!w.v) delete w.v; if (!w.g) delete w.g; }
  if (works.length) { s.works = works; withWorks++; }
}

// 退団者の退団公演（'''退団公演''' などと書かれた行。複数あれば最後の行）
let withFarewell = 0;
const retiredStars = data.stars.filter(s => s.retired !== undefined);
for (const s of retiredStars) {
  const txt = await raw(s.name, `p/${s.name}.txt`);
  delete s.farewell;
  if (!txt) continue;
  const e = stageLines(txt).filter(e => /退団公演/.test(clean(e.line))).at(-1);
  const head = e ? clean(e.line).split(/退団公演/)[0] : '';
  // 作品名は『』が普通だが「」で書かれたページもある
  const t = titlesOf(head).length ? titlesOf(head) : [...head.matchAll(/「([^」]+)」/g)].map(m => m[1].trim());
  if (t.length) {
    s.farewell = { y: startOf(e.line).y, t: t.join('／'), ...(e.g ? { g: e.g } : {}) };
  } else {
    // 舞台一覧に印が無いページは、本文の「『…』東京公演千秋楽をもって退団」「『…』で退団」から拾う
    const body = clean(txt.replace(/^\|.*$/gm, ''));
    const m = body.split(/。|\n/).map(x => x.match(/^(.*『[^』]+』)[^。『』]{0,25}?(?:千秋楽をもって|をもって|で)[^。『』]{0,10}?退団(?!公演)/)).find(Boolean);
    if (!m) continue;
    // 文の中の最後の作品（芝居とショーの2本立ては両方）
    const titles = titlesOf(m[1].match(/『[^』]+』(?:\s*[\/／]\s*『[^』]+』)?$/)?.[0] ?? '');
    const y = [...m[1].matchAll(/(\d{4})年/g)].at(-1)?.[1];
    // 他人の退団の話や退団後の話を拾わないよう、退団年と同じ年のものだけ
    if (!titles.length || !y || (s.retired && Number(y) !== s.retired)) continue;
    s.farewell = { y: Number(y), t: titles.join('／'), ...(s.troupe ? { g: s.troupe } : {}) };
  }
  withFarewell++;
}
console.log(`退団者 ${retiredStars.length}人 / 退団公演あり ${withFarewell}人`);

// 1人1行の形式で書き出す（アプリの保存形式と同じ）
const { stars, ...meta } = data;
const head = JSON.stringify(meta, null, 1).slice(0, -2);
fs.writeFileSync(starsFile, `${head},\n "stars": [\n${stars.map(s => '  ' + JSON.stringify(s)).join(',\n')}\n ]\n}\n`);
console.log(`対象 ${targets.length}人 / 作品あり ${withWorks}人`);
