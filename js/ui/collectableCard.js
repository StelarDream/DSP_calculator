import { formatLabel } from './format.js';
import { renderMetaBar, renderStat, renderIconRow, imgIcon } from './metaBar.js';

// Two-sided meta bar: left = type | source-or-yield | rarity, right =
// icon-only list of the collectors that handle it.
// showResult: shows the yielded item instead of the source - used when this
// card is rendered on the *source's* own page (e.g. "what does this source
// yield"), where showing the source again would be redundant.
export function renderCollectableCard(collectable, registries, onSelect, { showResult = false } = {}) {
  const card = document.createElement('div');
  card.className = 'recipe-card';
  card.appendChild(renderMeta(collectable, registries, onSelect, showResult));
  return card;
}

function renderMeta(collectable, registries, onSelect, showResult) {
  const left = [
    renderStat(imgIcon(`assets/collectors/${collectable.type}.png`, collectable.type), formatLabel(collectable.type)),
  ];

  const targetId = showResult ? collectable.result : collectable.source;
  if (targetId) {
    const target = registries.objects.get(targetId);
    const onClick = onSelect ? () => onSelect(targetId) : undefined;
    left.push(renderStat(imgIcon(target?.icon ?? '', formatLabel(targetId)), formatLabel(targetId), onClick));
  }

  // Only shown when it isn't the default guaranteed drop - see
  // js/data/collectables.js for where that default comes from.
  if (collectable.rarity !== 'guaranteed') {
    left.push(renderStat(null, formatLabel(collectable.rarity)));
  }

  const right = [];
  const collectedWith = registries.collectors.byCollectionType.get(collectable.type) ?? [];
  if (collectedWith.length) {
    right.push(renderIconRow(collectedWith.map((entry) => ({
      icon: registries.objects.get(entry.collector)?.icon,
      label: formatLabel(entry.collector),
      onClick: onSelect ? () => onSelect(entry.collector) : undefined,
    }))));
  }

  return renderMetaBar(left, right);
}
