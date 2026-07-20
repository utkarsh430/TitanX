export const PRODUCT_NAME = 'UPSRTC AI OPERATIONS COPILOT';
export const PRODUCT_SUBTITLE = 'Predictive Fleet Command Intelligence';

export const LIVE_POLL_INTERVAL_MS = 15_000;

/** Uttar Pradesh geographic centre — default map camera. */
export const DEFAULT_MAP_CENTER = { lat: 26.85, lng: 80.95 };
export const DEFAULT_MAP_ZOOM = 7;
export const SELECTED_BUS_ZOOM = 13;

export const FOOTER_DISCLAIMER =
  'Prototype demonstration. Only UPSRTC GPS locations and schedule information are live. All AI alerts, recommendations, traffic conditions, demand forecasts, breakdowns and communication events are simulated to demonstrate future platform capabilities.';

export const LIVE_LABELS = {
  gps: 'LIVE UPSRTC GPS',
  schedule: 'LIVE UPSRTC SCHEDULE',
  fixture: 'UPSRTC FIXTURE FALLBACK',
  liveData: 'LIVE UPSRTC DATA',
} as const;

/** Copilot status states shown on the intelligence core. */
export const AI_STATES = [
  'Listening',
  'Analysing',
  'Recommendation Ready',
  'Awaiting Authorization',
  'Monitoring',
] as const;
export type AiState = (typeof AI_STATES)[number];

/** Ambient copilot lines. Local templates only — no LLM is called. */
export const AI_AMBIENT_LINES = [
  'Fleet telemetry synchronized.',
  'Potential operational disruption identified.',
  'Simulation engine has generated an intervention scenario.',
  'Dispatcher authorization is required.',
  'Communication channel prepared.',
  'Network impact projection updated.',
  'Corridor monitoring active across connected depots.',
  'Headway variance within tolerance on monitored services.',
] as const;

export const MAP_DARK_STYLE: google.maps.MapTypeStyle[] = [
  { elementType: 'geometry', stylers: [{ color: '#06080f' }] },
  { elementType: 'labels.text.stroke', stylers: [{ color: '#06080f' }] },
  { elementType: 'labels.text.fill', stylers: [{ color: '#4a6a86' }] },
  { featureType: 'administrative', elementType: 'geometry', stylers: [{ color: '#123048' }] },
  {
    featureType: 'administrative.locality',
    elementType: 'labels.text.fill',
    stylers: [{ color: '#5f8fb0' }],
  },
  { featureType: 'poi', stylers: [{ visibility: 'off' }] },
  { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#0d1b2a' }] },
  { featureType: 'road', elementType: 'labels', stylers: [{ visibility: 'off' }] },
  { featureType: 'road.highway', elementType: 'geometry', stylers: [{ color: '#14304a' }] },
  {
    featureType: 'road.highway',
    elementType: 'geometry.stroke',
    stylers: [{ color: '#1b4568' }],
  },
  { featureType: 'transit', stylers: [{ visibility: 'off' }] },
  { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#03060d' }] },
  { featureType: 'landscape.natural', elementType: 'geometry', stylers: [{ color: '#080d18' }] },
];
