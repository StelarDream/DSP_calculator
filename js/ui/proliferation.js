import { svgIcon } from './metaBar.js';
import { PROLIF_SPEED_ICON, PROLIF_YIELD_ICON } from './icons.js';

// "Proliferation: <icon> Extra Yield | <icon> Speed Up"
// Yield boosts output, so it's tinted primary; speed is a throughput boost,
// tinted secondary - keeps the two kinds of effect visually distinct at a
// glance.
const EFFECTS = [
  { key: 'yield', icon: PROLIF_YIELD_ICON, text: 'Extra Yield', tone: 'primary' },
  { key: 'speed', icon: PROLIF_SPEED_ICON, text: 'Speed Up', tone: 'secondary' },
];

// Returns null when the recipe supports no proliferator effects at all, so
// the caller can skip it entirely (same convention as the time stat).
export function renderProliferationGroup(proliferation) {
  const active = EFFECTS.filter((effect) => proliferation[effect.key]);
  if (active.length === 0) return null;

  const group = document.createElement('span');
  group.className = 'proliferation-group';

  const label = document.createElement('span');
  label.className = 'proliferation-label';
  label.textContent = 'Proliferation:';
  group.appendChild(label);

  active.forEach((effect, index) => {
    if (index > 0) {
      const divider = document.createElement('span');
      divider.className = 'meta-divider';
      divider.textContent = '|';
      group.appendChild(divider);
    }
    group.appendChild(renderEffect(effect));
  });

  return group;
}

function renderEffect({ icon, text, tone }) {
  const stat = document.createElement('span');
  stat.className = `meta-stat proliferation-stat proliferation-stat--${tone}`;
  stat.appendChild(svgIcon(icon));

  const label = document.createElement('span');
  label.textContent = text;
  stat.appendChild(label);

  return stat;
}
