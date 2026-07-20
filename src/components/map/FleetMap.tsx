'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { Loader } from '@googlemaps/js-api-loader';
import { MarkerClusterer, type Marker } from '@googlemaps/markerclusterer';
import { useCopilotStore, useSelectedBus } from '@/stores/copilotStore';
import { MAP_DARK_STYLE, DEFAULT_MAP_CENTER, DEFAULT_MAP_ZOOM, SELECTED_BUS_ZOOM } from '@/lib/constants';
import { MapFallback } from './MapFallback';
import { RadarSweep } from './RadarSweep';
import { useScenarioOverlays } from './useScenarioOverlays';
import type { CanonicalLiveBus } from '@/models/canonical';

const API_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ?? '';

/** Custom holographic bus marker, rotated to the reported heading. */
function busMarkerIcon(bus: CanonicalLiveBus, selected: boolean): google.maps.Symbol {
  const colour = selected
    ? '#3ff0ff'
    : bus.dataQuality === 'good'
      ? '#2bff88'
      : bus.dataQuality === 'degraded'
        ? '#ffb020'
        : '#ff4d5e';

  return {
    path: 'M 0,-9 L 5.4,7 L 0,3.4 L -5.4,7 Z',
    fillColor: colour,
    fillOpacity: selected ? 1 : 0.85,
    strokeColor: colour,
    strokeOpacity: selected ? 0.9 : 0.35,
    strokeWeight: selected ? 2.4 : 1,
    scale: selected ? 1.75 : 1.05,
    rotation: bus.headingDegrees ?? 0,
  };
}

export function FleetMap() {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<google.maps.Map | null>(null);
  const markersRef = useRef<Map<string, google.maps.Marker>>(new Map());
  const clustererRef = useRef<MarkerClusterer | null>(null);

  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [errorMessage, setErrorMessage] = useState('');
  const [mapInstance, setMapInstance] = useState<google.maps.Map | null>(null);

  const buses = useCopilotStore((state) => state.buses);
  const selectedBusId = useCopilotStore((state) => state.selectedBusId);
  const selectBus = useCopilotStore((state) => state.selectBus);
  const logAudit = useCopilotStore((state) => state.logAudit);
  const isPitchMode = useCopilotStore((state) => state.isPitchMode);
  const selectedBus = useSelectedBus();

  // Simulated scenario geometry (corridors, congestion, rescue links, heatmap).
  useScenarioOverlays(mapInstance);

  // ---- Map bootstrap -------------------------------------------------------
  useEffect(() => {
    if (!API_KEY) {
      setStatus('error');
      setErrorMessage('Google Maps API key is not configured (NEXT_PUBLIC_GOOGLE_MAPS_API_KEY).');
      return;
    }

    let cancelled = false;
    const loader = new Loader({ apiKey: API_KEY, version: 'weekly' });

    loader
      .importLibrary('maps')
      .then(({ Map }) => {
        if (cancelled || !containerRef.current) return;

        const map = new Map(containerRef.current, {
          center: DEFAULT_MAP_CENTER,
          zoom: DEFAULT_MAP_ZOOM,
          styles: MAP_DARK_STYLE,
          disableDefaultUI: true,
          zoomControl: true,
          gestureHandling: 'greedy',
          backgroundColor: '#02040a',
          clickableIcons: false,
          // Explicitly NOT enabling TrafficLayer — all traffic here is simulated.
        });

        mapRef.current = map;
        setMapInstance(map);
        setStatus('ready');
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        setStatus('error');
        setErrorMessage(
          error instanceof Error ? error.message : 'Google Maps failed to initialise.',
        );
      });

    return () => {
      cancelled = true;
    };
  }, []);

  // ---- Incremental marker sync --------------------------------------------
  // Only create/remove/update what actually changed — the feed carries ~9.5k
  // buses and a full rebuild every 15s would visibly stutter.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || status !== 'ready') return;

    const existing = markersRef.current;
    const seen = new Set<string>();
    const added: google.maps.Marker[] = [];

    for (const bus of buses) {
      seen.add(bus.id);
      const position = { lat: bus.latitude, lng: bus.longitude };
      const current = existing.get(bus.id);

      if (current) {
        const previous = current.getPosition();
        if (!previous || previous.lat() !== bus.latitude || previous.lng() !== bus.longitude) {
          current.setPosition(position);
        }
        current.setIcon(busMarkerIcon(bus, bus.id === selectedBusId));
        current.setZIndex(bus.id === selectedBusId ? 999 : 1);
      } else {
        const marker = new google.maps.Marker({
          position,
          icon: busMarkerIcon(bus, bus.id === selectedBusId),
          title: bus.registrationNumber,
          optimized: true,
        });
        marker.addListener('click', () => {
          selectBus(bus.id);
          logAudit('bus-selected', `Operator selected live bus ${bus.registrationNumber} from map`, {
            registrationNumber: bus.registrationNumber,
            simulated: false,
          });
        });
        existing.set(bus.id, marker);
        added.push(marker);
      }
    }

    // Drop markers for buses that disappeared from the feed.
    const removed: google.maps.Marker[] = [];
    for (const [id, marker] of existing) {
      if (!seen.has(id)) {
        removed.push(marker);
        existing.delete(id);
      }
    }

    if (!clustererRef.current) {
      clustererRef.current = new MarkerClusterer({
        map,
        markers: [...existing.values()],
        renderer: {
          // Kept deliberately compact: at the statewide overview zoom the
          // fleet produces hundreds of clusters, and larger discs overlap
          // into an unreadable mass.
          render: ({ count, position }) => {
            const scale = Math.min(17, 8 + Math.log2(count + 1) * 1.5);
            return new google.maps.Marker({
              position,
              icon: {
                path: google.maps.SymbolPath.CIRCLE,
                fillColor: '#0b3a52',
                fillOpacity: 0.82,
                strokeColor: '#3ff0ff',
                strokeOpacity: 0.9,
                strokeWeight: 1.2,
                scale,
              },
              label: {
                text: String(count),
                color: '#d9f6ff',
                fontSize: scale > 13 ? '11px' : '9px',
                fontFamily: 'monospace',
                fontWeight: '600',
              },
              zIndex: 500,
            });
          },
        },
      });
    } else {
      if (removed.length > 0) clustererRef.current.removeMarkers(removed as Marker[], true);
      if (added.length > 0) clustererRef.current.addMarkers(added as Marker[], true);
      if (removed.length > 0 || added.length > 0) {
        clustererRef.current.render();
      }
    }
  }, [buses, selectedBusId, status, selectBus, logAudit]);

  // ---- Camera fly-to on selection -----------------------------------------
  // Runs on selection change only, so 15s polling never yanks the camera back.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !selectedBus || status !== 'ready') return;
    map.panTo({ lat: selectedBus.latitude, lng: selectedBus.longitude });
    if ((map.getZoom() ?? 0) < SELECTED_BUS_ZOOM) map.setZoom(SELECTED_BUS_ZOOM);
    // Intentionally keyed on id alone: position updates must not re-pan.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedBusId, status]);

  // Entering Pitch Mode returns the camera to the statewide view — the opening
  // caption claims network-wide visibility, so a city-level zoom undercuts it.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || status !== 'ready') return;

    // The zoom control sits under the caption letterbox and shows through the
    // blur as a bright artefact; hide it for the duration of the presentation.
    map.setOptions({ zoomControl: !isPitchMode });

    if (!isPitchMode) return;
    map.panTo(DEFAULT_MAP_CENTER);
    map.setZoom(DEFAULT_MAP_ZOOM);
  }, [isPitchMode, status]);

  const handleRetry = useCallback(() => window.location.reload(), []);

  return (
    <div className="relative h-full w-full overflow-hidden rounded-lg">
      <div ref={containerRef} className="absolute inset-0" aria-label="Live UPSRTC fleet map" role="application" />

      {status !== 'ready' && (
        <MapFallback status={status} message={errorMessage} onRetry={handleRetry} />
      )}

      {/* HUD framing over the basemap */}
      <div aria-hidden className="pointer-events-none absolute inset-0 z-10">
        <div className="absolute inset-0 border border-holo-glow/20 rounded-lg" />
        <div className="absolute left-0 top-0 h-6 w-6 border-l-2 border-t-2 border-holo-glow/60" />
        <div className="absolute right-0 top-0 h-6 w-6 border-r-2 border-t-2 border-holo-glow/60" />
        <div className="absolute bottom-0 left-0 h-6 w-6 border-b-2 border-l-2 border-holo-glow/60" />
        <div className="absolute bottom-0 right-0 h-6 w-6 border-b-2 border-r-2 border-holo-glow/60" />
        <div className="absolute inset-0 scanline-overlay opacity-30" />
      </div>

      {selectedBus && mapInstance && <RadarSweep map={mapInstance} bus={selectedBus} />}
    </div>
  );
}
