import { formatLabel } from './format.js';
import { renderEntityRow } from './entityRow.js';
import { renderMetaBar, renderStat, renderIconRow, imgIcon } from './metaBar.js';

export function renderCollectableCard(collectable, registries, onSelect) {
  const card = document.createElement('div');
  card.className = 'recipe-card';
  card.appendChild(renderMeta(collectable, registries));

  if (collectable.source) {
    const sourceObj = registries.objects.get(collectable.source);
    card.appendChild(renderEntityRow({
      id: collectable.source,
      entity: sourceObj,
      label: formatLabel(collectable.source),
      onSelect,
    }));
  }

  return card;
}

function renderMeta(collectable, registries) {
  const left = [];
  // Only shown when it isn't the default guaranteed drop - see
  // js/data/collectables.js for where that default comes from.
  if (collectable.rarity !== 'guaranteed') {
    left.push(renderStat(null, `Rarity: ${formatLabel(collectable.rarity)}`));
  }

  const right = [
    renderStat(imgIcon(`assets/collectors/${collectable.type}.png`, collectable.type), formatLabel(collectable.type)),
  ];

  const collectedWith = registries.collectors.byCollectionType.get(collectable.type) ?? [];
  if (collectedWith.length) {
    right.push(renderIconRow(collectedWith.map((entry) => ({
      icon: registries.objects.get(entry.collector)?.icon,
      label: formatLabel(entry.collector),
    }))));
  }

  return renderMetaBar(left, right);
}
