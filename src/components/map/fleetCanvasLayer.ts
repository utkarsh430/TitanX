import type { CanonicalLiveBus } from '@/models/canonical';

/**
 * Canvas overlay for the live fleet.
 *
 * Why not google.maps.Marker: the feed carries ~9.5k vehicles. One Marker per
 * bus means 9.5k overlay objects, and MarkerClusterer then re-clusters and
 * re-creates cluster markers on every zoom/pan — measured at 5.1 seconds of
 * main-thread blocking across a handful of zoom steps.
 *
 * This layer draws every vehicle into a single canvas. Redraw is O(visible)
 * with no DOM churn, so pan/zoom stays on the compositor and the main thread
 * stays free. Clustering is done in screen space, which is both cheaper and
 * more stable visually than geographic clustering.
 */

const QUALITY_COLOUR: Record<CanonicalLiveBus['dataQuality'], string> = {
  good: '#2bff88',
  degraded: '#ffb020',
  stale: '#ff4d5e',
};

const SELECTED_COLOUR = '#3ff0ff';

/** Screen-space grid cell size, in CSS pixels. */
const CELL_PX = 46;

interface Cell {
  count: number;
  sumX: number;
  sumY: number;
  bus: CanonicalLiveBus;
  x: number;
  y: number;
}

export interface FleetLayerHandle {
  setBuses(buses: CanonicalLiveBus[]): void;
  setSelected(id: string | null): void;
  destroy(): void;
}

export function createFleetLayer(
  map: google.maps.Map,
  onSelectBus: (bus: CanonicalLiveBus) => void,
): FleetLayerHandle {
  let buses: CanonicalLiveBus[] = [];
  let selectedId: string | null = null;
  let redrawQueued = false;

  /** Populated on each draw so click hit-testing matches exactly what is drawn. */
  let hitCells: Cell[] = [];

  class FleetOverlay extends google.maps.OverlayView {
    private canvas: HTMLCanvasElement | null = null;
    private ctx: CanvasRenderingContext2D | null = null;

    onAdd(): void {
      const canvas = document.createElement('canvas');
      canvas.style.position = 'absolute';
      canvas.style.left = '0';
      canvas.style.top = '0';
      // The canvas must never swallow map gestures; clicks are resolved by a
      // hit-test on the map's own click event instead.
      canvas.style.pointerEvents = 'none';
      this.canvas = canvas;
      this.ctx = canvas.getContext('2d');
      this.getPanes()?.overlayLayer.appendChild(canvas);
    }

    onRemove(): void {
      this.canvas?.parentNode?.removeChild(this.canvas);
      this.canvas = null;
      this.ctx = null;
    }

    draw(): void {
      const canvas = this.canvas;
      const ctx = this.ctx;
      const projection = this.getProjection();
      if (!canvas || !ctx || !projection) return;

      const div = map.getDiv();
      const width = div.clientWidth;
      const height = div.clientHeight;
      if (width === 0 || height === 0) return;

      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      if (canvas.width !== width * dpr || canvas.height !== height * dpr) {
        canvas.width = width * dpr;
        canvas.height = height * dpr;
        canvas.style.width = `${width}px`;
        canvas.style.height = `${height}px`;
      }

      // The overlayLayer pane is itself translated by the map; counter-position
      // the canvas so its origin stays aligned with the viewport top-left.
      const bounds = map.getBounds();
      if (!bounds) return;
      const topLeft = projection.fromLatLngToDivPixel(
        new google.maps.LatLng(bounds.getNorthEast().lat(), bounds.getSouthWest().lng()),
      );
      if (topLeft) {
        canvas.style.transform = `translate(${topLeft.x}px, ${topLeft.y}px)`;
      }

      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, width, height);

      // ---- Screen-space bucketing ----
      const cells = new Map<number, Cell>();
      const columns = Math.ceil(width / CELL_PX) + 1;
      let selectedPoint: { x: number; y: number; bus: CanonicalLiveBus } | null = null;

      for (const bus of buses) {
        const point = projection.fromLatLngToContainerPixel(
          new google.maps.LatLng(bus.latitude, bus.longitude),
        );
        if (!point) continue;

        const x = point.x;
        const y = point.y;
        // Cull generously so markers do not pop at the edges while panning.
        if (x < -60 || y < -60 || x > width + 60 || y > height + 60) continue;

        if (bus.id === selectedId) {
          selectedPoint = { x, y, bus };
          continue;
        }

        const key = Math.floor(y / CELL_PX) * columns + Math.floor(x / CELL_PX);
        const cell = cells.get(key);
        if (cell) {
          cell.count += 1;
          cell.sumX += x;
          cell.sumY += y;
        } else {
          cells.set(key, { count: 1, sumX: x, sumY: y, bus, x, y });
        }
      }

      // ---- Paint ----
      hitCells = [];
      for (const cell of cells.values()) {
        const cx = cell.sumX / cell.count;
        const cy = cell.sumY / cell.count;
        cell.x = cx;
        cell.y = cy;
        hitCells.push(cell);

        if (cell.count === 1) {
          drawVehicle(ctx, cx, cy, cell.bus.headingDegrees ?? 0, QUALITY_COLOUR[cell.bus.dataQuality], 1);
        } else {
          drawCluster(ctx, cx, cy, cell.count);
        }
      }

      if (selectedPoint) {
        drawVehicle(ctx, selectedPoint.x, selectedPoint.y, selectedPoint.bus.headingDegrees ?? 0, SELECTED_COLOUR, 1.7);
        hitCells.push({ count: 1, sumX: 0, sumY: 0, bus: selectedPoint.bus, x: selectedPoint.x, y: selectedPoint.y });
      }
    }
  }

  const overlay = new FleetOverlay();
  overlay.setMap(map);

  /** Coalesce redraws to one per animation frame. */
  function scheduleRedraw(): void {
    if (redrawQueued) return;
    redrawQueued = true;
    requestAnimationFrame(() => {
      redrawQueued = false;
      overlay.draw();
    });
  }

  const clickListener = map.addListener('click', (event: google.maps.MapMouseEvent) => {
    const projection = overlay.getProjection();
    if (!projection || !event.latLng) return;
    const point = projection.fromLatLngToContainerPixel(event.latLng);
    if (!point) return;

    let best: Cell | null = null;
    let bestDistance = 18; // px hit radius
    for (const cell of hitCells) {
      const distance = Math.hypot(cell.x - point.x, cell.y - point.y);
      if (distance < bestDistance) {
        bestDistance = distance;
        best = cell;
      }
    }
    if (!best) return;

    if (best.count > 1) {
      // Zoom into a cluster rather than guessing which vehicle was meant.
      map.panTo(event.latLng);
      map.setZoom(Math.min(16, (map.getZoom() ?? 7) + 2));
    } else {
      onSelectBus(best.bus);
    }
  });

  const moveListeners = [
    map.addListener('bounds_changed', scheduleRedraw),
    map.addListener('zoom_changed', scheduleRedraw),
    map.addListener('idle', scheduleRedraw),
    map.addListener('resize', scheduleRedraw),
  ];

  return {
    setBuses(next: CanonicalLiveBus[]) {
      buses = next;
      scheduleRedraw();
    },
    setSelected(id: string | null) {
      selectedId = id;
      scheduleRedraw();
    },
    destroy() {
      clickListener.remove();
      moveListeners.forEach((listener) => listener.remove());
      overlay.setMap(null);
    },
  };
}

/** Holographic vehicle chevron, rotated to the reported heading. */
function drawVehicle(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  heading: number,
  colour: string,
  scale: number,
): void {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate((heading * Math.PI) / 180);
  ctx.scale(scale, scale);

  ctx.beginPath();
  ctx.moveTo(0, -7);
  ctx.lineTo(4.4, 5.6);
  ctx.lineTo(0, 2.8);
  ctx.lineTo(-4.4, 5.6);
  ctx.closePath();

  ctx.fillStyle = colour;
  ctx.globalAlpha = 0.9;
  ctx.fill();

  if (scale > 1.4) {
    ctx.globalAlpha = 1;
    ctx.lineWidth = 1.4;
    ctx.strokeStyle = colour;
    ctx.shadowColor = colour;
    ctx.shadowBlur = 10;
    ctx.stroke();
  }

  ctx.restore();
}

/** Cluster disc with a count label, matching the HUD language. */
function drawCluster(ctx: CanvasRenderingContext2D, x: number, y: number, count: number): void {
  const radius = Math.min(17, 8 + Math.log2(count + 1) * 1.5);

  ctx.save();
  ctx.beginPath();
  ctx.arc(x, y, radius, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(11,58,82,0.82)';
  ctx.fill();
  ctx.lineWidth = 1.2;
  ctx.strokeStyle = 'rgba(63,240,255,0.9)';
  ctx.stroke();

  ctx.fillStyle = '#d9f6ff';
  ctx.font = `600 ${radius > 13 ? 11 : 9}px ui-monospace, monospace`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(String(count), x, y);
  ctx.restore();
}
