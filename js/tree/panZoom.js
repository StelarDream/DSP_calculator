// Generic drag-to-pan + wheel-to-zoom controller. Knows nothing about trees
// specifically - just applies a CSS transform to `world` based on pointer
// input on `viewport`, and exposes zoomIn/zoomOut/reset/fitToView for an
// external toolbar to call.
export function createPanZoom(viewport, world, { minScale = 0.25, maxScale = 2.5, zoomStep = 0.2 } = {}) {
  let scale = 1;
  let x = 0;
  let y = 0;
  let dragging = false;
  let lastX = 0;
  let lastY = 0;

  viewport.style.cursor = 'grab';
  world.style.transformOrigin = '0 0';

  function apply() {
    world.style.transform = `translate(${x}px, ${y}px) scale(${scale})`;
  }

  function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
  }

  // Rescales around a fixed viewport-space point (the cursor, or the
  // viewport center for the toolbar buttons) so that point doesn't drift.
  function zoomAt(clientX, clientY, nextScale) {
    nextScale = clamp(nextScale, minScale, maxScale);
    const rect = viewport.getBoundingClientRect();
    const originX = clientX - rect.left;
    const originY = clientY - rect.top;
    x = originX - ((originX - x) / scale) * nextScale;
    y = originY - ((originY - y) / scale) * nextScale;
    scale = nextScale;
    apply();
  }

  function viewportCenter() {
    const rect = viewport.getBoundingClientRect();
    return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
  }

  function onWheel(event) {
    event.preventDefault();
    const direction = event.deltaY > 0 ? -1 : 1;
    zoomAt(event.clientX, event.clientY, scale * (1 + direction * 0.15));
  }

  function onPointerDown(event) {
    // Only the primary button/touch pans - avoids hijacking right-click etc.
    if (event.button !== 0) return;
    // Let interactive elements sitting on the canvas (toolbar buttons, and
    // later node controls) handle their own clicks - grabbing pointer
    // capture here would hijack the click before it ever fires.
    if (event.target.closest('button, a, input, select, textarea')) return;
    dragging = true;
    lastX = event.clientX;
    lastY = event.clientY;
    viewport.style.cursor = 'grabbing';
    viewport.setPointerCapture(event.pointerId);
  }

  function onPointerMove(event) {
    if (!dragging) return;
    x += event.clientX - lastX;
    y += event.clientY - lastY;
    lastX = event.clientX;
    lastY = event.clientY;
    apply();
  }

  function onPointerUp(event) {
    dragging = false;
    viewport.style.cursor = 'grab';
    if (viewport.hasPointerCapture(event.pointerId)) viewport.releasePointerCapture(event.pointerId);
  }

  viewport.addEventListener('wheel', onWheel, { passive: false });
  viewport.addEventListener('pointerdown', onPointerDown);
  viewport.addEventListener('pointermove', onPointerMove);
  viewport.addEventListener('pointerup', onPointerUp);
  viewport.addEventListener('pointercancel', onPointerUp);

  apply();

  return {
    zoomIn() {
      const c = viewportCenter();
      zoomAt(c.x, c.y, scale * (1 + zoomStep));
    },
    zoomOut() {
      const c = viewportCenter();
      zoomAt(c.x, c.y, scale / (1 + zoomStep));
    },
    // Centers the world's content (worldWidth/Height) in the viewport at
    // whatever scale fits it entirely, clamped to the normal zoom range.
    fitToView(worldWidth, worldHeight) {
      const fitScale = Math.min(viewport.clientWidth / worldWidth, viewport.clientHeight / worldHeight);
      scale = clamp(fitScale, minScale, maxScale);
      x = (viewport.clientWidth - worldWidth * scale) / 2;
      y = (viewport.clientHeight - worldHeight * scale) / 2;
      apply();
    },
    destroy() {
      viewport.removeEventListener('wheel', onWheel);
      viewport.removeEventListener('pointerdown', onPointerDown);
      viewport.removeEventListener('pointermove', onPointerMove);
      viewport.removeEventListener('pointerup', onPointerUp);
      viewport.removeEventListener('pointercancel', onPointerUp);
    },
  };
}
