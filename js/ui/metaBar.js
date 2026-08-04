// Two-sided meta bar: left = numeric stats (time, chance, rarity), right =
// type + icon-only list of the buildings/collectors that handle it.
export function renderMetaBar(left, right) {
  const bar = document.createElement('div');
  bar.className = 'meta-bar';
  bar.appendChild(renderGroup(left));
  bar.appendChild(renderGroup(right));
  return bar;
}

function renderGroup(nodes) {
  const group = document.createElement('div');
  group.className = 'meta-group';

  nodes.forEach((node, index) => {
    if (index > 0) {
      const divider = document.createElement('span');
      divider.className = 'meta-divider';
      divider.textContent = '|';
      group.appendChild(divider);
    }
    group.appendChild(node);
  });

  return group;
}

// A single "<icon> value" stat, e.g. the clock + time, or the type icon + name.
export function renderStat(iconEl, text) {
  const stat = document.createElement('span');
  stat.className = 'meta-stat';
  if (iconEl) stat.appendChild(iconEl);

  const label = document.createElement('span');
  label.textContent = text;
  stat.appendChild(label);

  return stat;
}

// A row of icons only (no names) - e.g. which buildings/collectors handle this.
export function renderIconRow(entries) {
  const row = document.createElement('span');
  row.className = 'meta-icons';

  for (const { icon, label } of entries) {
    const img = document.createElement('img');
    img.className = 'meta-icon';
    img.src = icon ?? '';
    img.alt = label ?? '';
    img.title = label ?? '';
    row.appendChild(img);
  }

  return row;
}

export function svgIcon(svg) {
  const span = document.createElement('span');
  span.className = 'meta-stat-icon';
  span.innerHTML = svg;
  return span;
}

export function imgIcon(src, label) {
  const img = document.createElement('img');
  img.className = 'meta-stat-icon';
  img.src = src;
  img.alt = label ?? '';
  return img;
}
