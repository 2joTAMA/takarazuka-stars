export const TROUPES = [
  { id: 'hana', short: '花', name: '花組' },
  { id: 'tsuki', short: '月', name: '月組' },
  { id: 'yuki', short: '雪', name: '雪組' },
  { id: 'hoshi', short: '星', name: '星組' },
  { id: 'sora', short: '宙', name: '宙組' },
  { id: 'senka', short: '専', name: '専科' },
];
export const TROUPE_BY_ID = Object.fromEntries(TROUPES.map(t => [t.id, t]));

export const ROLES = [
  { id: 'otoko', name: '男役' },
  { id: 'musume', name: '娘役' },
];

// 見た目は css/style.css の .st-<id> で決める
export const STATUSES = [
  { id: 'top', label: 'トップスター' },
  { id: 'topMusume', label: 'トップ娘役' },
  { id: 'kumicho', label: '組長' },
  { id: 'fukuKumicho', label: '副組長' },
  { id: 'shinko', label: '新人公演主演' },
  { id: 'bow', label: 'バウ主演' },
];
export const STATUS_BY_ID = Object.fromEntries(STATUSES.map(s => [s.id, s]));

// 新人公演に出られるのは研7まで
export const SHINKO_MAX_KEN = 7;

// 期 → 研究科の年数。入団は4月なので4月で切り替わる（例: 2026年4月〜 112期が研1）
export function kenOf(term, date = new Date()) {
  const fiscalYear = date.getMonth() >= 3 ? date.getFullYear() : date.getFullYear() - 1;
  return fiscalYear - (term + 1914) + 1;
}

export const isActive = s => s.retired === undefined || s.retired === null;
export const isTop = s => (s.statuses || []).some(st => st === 'top' || st === 'topMusume');
