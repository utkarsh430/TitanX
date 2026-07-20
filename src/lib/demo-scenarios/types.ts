import type { CanonicalLiveBus, CanonicalSchedule } from '@/models/canonical';

/**
 * Types for SIMULATED scenario output.
 *
 * Nothing here is computed from real operational data. Every value is produced
 * by a local template seeded from the selected bus's registration number.
 * See docs/LIVE_VS_SIMULATED.md.
 */

export type ScenarioKind = 'bunching' | 'traffic' | 'breakdown' | 'demand' | 'communication';

export type AlertSeverity = 'info' | 'advisory' | 'warning' | 'critical';

export interface SimulatedPoint {
  latitude: number;
  longitude: number;
}

export interface SimulatedBusMarker extends SimulatedPoint {
  id: string;
  label: string;
  role: 'ahead' | 'selected' | 'behind' | 'rescue' | 'incident';
  headingDegrees: number;
  /** True only for the operator's genuinely selected live bus. */
  isRealBus: boolean;
}

export interface ScenarioAction {
  id: string;
  label: string;
  kind: 'accept' | 'modify' | 'reject' | 'monitor' | 'message' | 'call' | 'notify' | 'generate';
}

export interface ImpactMetric {
  label: string;
  before: string;
  after: string;
  /** Direction that represents improvement, for colour + screen-reader text. */
  improvement: 'up' | 'down';
  delta: string;
}

export interface TimelineEntry {
  at: string;
  label: string;
}

/** Common envelope every scenario template returns. */
export interface ScenarioBase {
  kind: ScenarioKind;
  /** Always rendered on screen — the simulation disclosure. */
  simulationLabel: string;
  headline: string;
  severity: AlertSeverity;
  severityText: string;
  confidencePercent: number;
  observation: string;
  recommendation: string;
  expectedOutcome: string;
  affectedBuses: string[];
  suggestedDriverMessageEn: string;
  suggestedDriverMessageHi: string;
  actions: ScenarioAction[];
  markers: SimulatedBusMarker[];
  impact: ImpactMetric[];
  timeline: TimelineEntry[];
  seed: string;
}

export interface ScenarioContext {
  bus: CanonicalLiveBus;
  schedule: CanonicalSchedule | null;
  /** Presenter overrides from the Scenario Lab. */
  overrides?: ScenarioOverrides;
}

export interface ScenarioOverrides {
  bunchingRisk?: number;
  gapAheadMinutes?: number;
  gapBehindMinutes?: number;
  holdSeconds?: number;
  congestionSeverity?: 'moderate' | 'heavy' | 'severe';
  trafficDelayMinutes?: number;
  congestionDistanceKm?: number;
  alternativeSavingMinutes?: number;
  breakdownType?: string;
  passengerCount?: number;
  rescueCandidateCount?: number;
  responseTimeMinutes?: number;
  demandMultiplier?: number;
  peakWindow?: '06:00' | '08:00' | '10:00' | '13:00' | '17:00' | '20:00';
  festivalSurge?: boolean;
  reserveBuses?: number;
  messageLanguage?: 'en' | 'hi' | 'both';
  acknowledgementDelaySeconds?: number;
  callDurationSeconds?: number;
}

export const SIMULATION_LABELS = {
  bunching: 'SIMULATED BUNCHING DEMO',
  traffic: 'SIMULATED TRAFFIC DEMO',
  breakdown: 'SIMULATED BREAKDOWN DEMO',
  demand: 'SIMULATED DEMAND DEMO',
  communication: 'SIMULATED COMMUNICATION',
} as const satisfies Record<ScenarioKind, string>;

export const GENERIC_SIM_BADGE = 'SIMULATED AI DEMONSTRATION';
export const FUTURE_CAPABILITY_BADGE = 'FUTURE CAPABILITY DEMO';
