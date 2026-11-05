// Icons with tooltips for the flight bar (#bar .rail) of the Shipyard and the Landing lab.
// The page code keeps driving the same elements (it rewrites the text of #run / #pause as the state changes, and reads the selects and the
// checkbox by id), so this module only restyles: buttons become icon buttons whose label is kept for screen readers and shown as a tooltip,
// the "speed / follow / camera / track" labels become icons, and the auto-slow checkbox becomes an icon toggle.
const IC = {
  launch: 'M12 3c3 2 5 5 5 9l-2 3H9l-2-3c0-4 2-7 5-9zM9 15l-2 4 3-1.5M15 15l2 4-3-1.5M12 9.2h.01',
  play: 'M8 5l11 7-11 7z',
  pause: 'M8 5v14M16 5v14',
  skip: 'M5 5l9 7-9 7zM18 5v14',
  reset: 'M4 12a8 8 0 1 0 2.6-5.9M4 4v5h5',
  speed: 'M4 17a8 8 0 1 1 16 0M12 17l4-5M7 17h.01M17 17h.01',
  follow: 'M12 4v3M12 17v3M4 12h3M17 12h3M12 9.5a2.5 2.5 0 1 0 0 5 2.5 2.5 0 0 0 0-5',
  camera: 'M4 8h3l1.5-2h7L17 8h3v11H4zM12 11a3 3 0 1 0 0 6 3 3 0 0 0 0-6',
  track: 'M7 11V8a5 5 0 0 1 10 0v3M5 11h14v9H5zM12 14.5v2',
  slow: 'M7 3h10M7 21h10M8 3v4l4 5 4-5V3M8 21v-4l4-5 4 5v4'
};
const svg = n => `<svg class="ric" viewBox="0 0 24 24" aria-hidden="true"><path d="${IC[n]}"/></svg>`;

// What a button's text means (the pages write "▶ Launch", "▶ Resume", "Pause", "Play", "↻ Fly again", "Skip to end", "Reset").
function meaning(raw) {
  const t = raw.toLowerCase();
  if (/fly again|↻/.test(t)) return ['reset', 'Fly again'];
  if (/launch/.test(t)) return ['launch', 'Launch'];
  if (/resume/.test(t)) return ['play', 'Resume'];
  if (/pause/.test(t)) return ['pause', 'Pause'];
  if (/play/.test(t)) return ['play', 'Play'];
  if (/skip/.test(t)) return ['skip', 'Skip to end'];
  if (/reset/.test(t)) return ['reset', 'Reset'];
  return null;
}

function paintButton(b) {
  const raw = b.textContent.trim();
  if (!raw || (b.dataset.painted === raw && b.querySelector('svg'))) return;   // already ours (our own repaint also lands here)
  const m = meaning(raw);
  if (!m) return;
  const [icon, label] = m;
  b.dataset.painted = label;
  b.classList.add('ib');
  b.innerHTML = svg(icon) + `<span class="sr">${label}</span>`;
  b.dataset.tip = label;
  b.setAttribute('aria-label', label);
}

function init() {
  const rail = document.querySelector('#bar .rail');
  if (!rail || rail.dataset.icons) return;
  rail.dataset.icons = '1';

  for (const id of ['run', 'pause', 'ff', 'reset']) {
    const b = document.getElementById(id);
    if (!b) continue;
    paintButton(b);
    new MutationObserver(() => paintButton(b)).observe(b, { childList: true, characterData: true, subtree: true });
  }

  // "speed [5x]", "follow [Vehicle]", "camera [Chase]", "track [Locked]": the word becomes an icon, the select stays.
  const SELECTS = { warp: ['speed', 'Playback speed'], follow: ['follow', 'Camera follows'], camAngle: ['camera', 'Camera angle'], camTrack: ['track', 'Camera tracking'] };
  for (const [id, [icon, tip]] of Object.entries(SELECTS)) {
    const sel = document.getElementById(id), label = sel?.closest('label');
    if (!label) continue;
    for (const n of [...label.childNodes]) if (n.nodeType === 3) n.remove();
    label.insertAdjacentHTML('afterbegin', svg(icon));
    label.classList.add('il');
    label.dataset.tip = tip;
    sel.setAttribute('aria-label', tip);
  }

  // The auto-slow checkbox: an icon toggle that keeps the checkbox (and its id) for the page code; the old text becomes the tooltip.
  for (const label of rail.querySelectorAll('label.chk')) {
    const input = label.querySelector('input[type=checkbox]');
    if (!input) continue;
    const text = label.textContent.replace(/\s+/g, ' ').trim();
    for (const n of [...label.childNodes]) if (n.nodeType === 3) n.remove();
    label.insertAdjacentHTML('afterbegin', svg('slow'));
    label.classList.add('il', 'tg');
    label.dataset.tip = text ? text[0].toUpperCase() + text.slice(1) : 'Toggle';
    const sync = () => label.classList.toggle('on', input.checked);
    input.addEventListener('change', sync); sync();
  }
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
