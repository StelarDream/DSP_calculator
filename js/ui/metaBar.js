// Two-sided meta bar: left = numeric stats (time, chance), right = type +
// icon-only list of the buildings that handle it. Used by recipe cards.
export function renderMetaBar(left, right) {
  const bar = document.createElement('div');
  bar.className = 'meta-bar';
  bar.appendChild(renderMetaLine(left));
  bar.appendChild(renderMetaLine(right));
  return bar;
}

// A single left-aligned line of stats/icon-rows joined by "|" dividers.
// Used on its own by collectable cards (type | tables | source-or-yield).
export function renderMetaLine(nodes) {
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

// A single "<icon> value" stat, e.g. the clock + time, or the type icon +
// name. Clickable (renders as a button) when onClick is given.
export function renderStat(iconEl, text, onClick) {
  const clickable = typeof onClick === 'function';
  const stat = document.createElement(clickable ? 'button' : 'span');
  stat.className = 'meta-stat';
  if (clickable) {
    stat.type = 'button';
    stat.addEventListener('click', onClick);
  }

  if (iconEl) stat.appendChild(iconEl);

  const label = document.createElement('span');
  label.textContent = text;
  stat.appendChild(label);

  return stat;
}

// A row of icons only (no names) - e.g. which buildings/collectors handle
// this. Each entry renders as a button (navigating via onClick) when one is
// given, otherwise as a plain image.
export function renderIconRow(entries) {
  const row = document.createElement('span');
  row.className = 'meta-icons';

  for (const { icon, label, onClick } of entries) {
    const clickable = typeof onClick === 'function';
    const el = document.createElement(clickable ? 'button' : 'span');
    el.className = 'meta-icon';
    if (clickable) {
      el.type = 'button';
      el.addEventListener('click', onClick);
    }

    const img = document.createElement('img');
    img.src = icon ?? '';
    img.alt = label ?? '';
    img.title = label ?? '';
    el.appendChild(img);

    row.appendChild(el);
  }

  return row;
}

// A standalone icon-only button - e.g. the recipe-tree trigger. Distinct
// from renderStat, which always pairs its icon with a text label.
export function renderIconButton(svg, label, onClick) {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'icon-btn';
  button.title = label;
  button.setAttribute('aria-label', label);
  button.innerHTML = svg;
  if (typeof onClick === 'function') button.addEventListener('click', onClick);
  return button;
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
