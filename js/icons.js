// 線画アイコン（24x24、currentColor）。歯車・ペンは Lucide (ISC) の形を元にしている
const svg = body =>
  `<svg class="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${body}</svg>`;

const petals = [0, 72, 144, 216, 288]
  .map(r => `<ellipse cx="12" cy="6.6" rx="2.9" ry="3.9" transform="rotate(${r} 12 12)"/>`).join('');

export const ICONS = {
  hana: svg(`${petals}<circle cx="12" cy="12" r="1.9"/>`),
  tsuki: svg('<path d="M12 3a6.5 6.5 0 0 0 9 9 9 9 0 1 1-9-9Z"/>'),
  yuki: svg('<path d="M12 2.5v19M3.8 7.25l16.4 9.5M3.8 16.75l16.4-9.5"/><path d="M9.5 4 12 6l2.5-2M9.5 20l2.5-2 2.5 2M4.2 10.6l2.9-.9-.6-3M19.8 13.4l-2.9.9.6 3M4.2 13.4l2.9.9-.6 3M19.8 10.6l-2.9-.9.6-3"/>'),
  hoshi: svg('<path d="m12 2.8 2.8 5.8 6.3.9-4.6 4.4 1.1 6.3L12 17.2l-5.6 3 1.1-6.3-4.6-4.4 6.3-.9Z"/>'),
  sora: svg('<circle cx="12" cy="12" r="5.2"/><ellipse cx="12" cy="12" rx="10.2" ry="3.4" transform="rotate(-22 12 12)"/>'),
  senka: svg('<path d="M6.5 3.5h11l4 5.5L12 20.5 2.5 9Z"/><path d="M2.5 9h19M9 3.5 7.6 9 12 20.5 16.4 9 15 3.5"/>'),
  all: svg('<rect x="3.5" y="3.5" width="7" height="7" rx="1.8"/><rect x="13.5" y="3.5" width="7" height="7" rx="1.8"/><rect x="3.5" y="13.5" width="7" height="7" rx="1.8"/><rect x="13.5" y="13.5" width="7" height="7" rx="1.8"/>'),
  edit: svg('<path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/><path d="m15 5 4 4"/>'),
  settings: svg('<path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/><circle cx="12" cy="12" r="3"/>'),
};
