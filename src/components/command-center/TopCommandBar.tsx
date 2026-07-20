'use client';

import { useMemo } from 'react';
import { Maximize2, Minimize2, Play, FlaskConical, Activity, ShieldCheck, ScrollText } from 'lucide-react';
import { useCopilotStore } from '@/stores/copilotStore';
import { useIndiaClock } from '@/hooks/useIndiaClock';
import { Badge, CountUp } from '@/components/shared/hud';
import { PRODUCT_NAME, PRODUCT_SUBTITLE, LIVE_LABELS } from '@/lib/constants';
import { formatRelativeAge } from '@/lib/formatters';

export function TopCommandBar({
  visibleCount,
  onToggleFullscreen,
  isFullscreen,
}: {
  visibleCount: number;
  onToggleFullscreen: () => void;
  isFullscreen: boolean;
}) {
  const buses = useCopilotStore((state) => state.buses);
  const feedMeta = useCopilotStore((state) => state.feedMeta);
  const setPitchMode = useCopilotStore((state) => state.setPitchMode);
  const toggleScenarioLab = useCopilotStore((state) => state.toggleScenarioLab);
  const toggleDiagnostics = useCopilotStore((state) => state.toggleDiagnostics);
  const toggleAudit = useCopilotStore((state) => state.toggleAudit);
  const clock = useIndiaClock();

  const connectionState = useMemo(() => {
    if (feedMeta.error) return { label: 'DEGRADED', tone: 'amber' as const };
    if (feedMeta.source === 'fixture') return { label: 'FIXTURE', tone: 'fixture' as const };
    if (feedMeta.stale) return { label: 'STALE CACHE', tone: 'amber' as const };
    return { label: 'CONNECTED', tone: 'green' as const };
  }, [feedMeta]);

  return (
    <header className="relative z-30 flex h-[62px] shrink-0 items-center gap-4 border-b border-holo-glow/20 bg-[rgb(5,11,23)] px-4">
      {/* Identity */}
      <div className="flex items-center gap-3">
        <div className="relative flex h-9 w-9 items-center justify-center">
          <span className="absolute inset-0 rounded-full border border-holo-glow/40" />
          <span className="absolute inset-[3px] animate-orbit rounded-full border border-dashed border-holo-teal/40" />
          <span className="absolute inset-[7px] animate-core-breathe rounded-full bg-holo-glow/25" />
          <Activity className="relative h-4 w-4 text-holo-glow" aria-hidden />
        </div>
        <div className="leading-tight">
          <h1 className="text-[13px] font-bold tracking-[0.16em] text-holo-glow text-glow">
            {PRODUCT_NAME}
          </h1>
          <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-holo-glow/45">
            {PRODUCT_SUBTITLE}
          </p>
        </div>
      </div>

      <div className="h-8 w-px bg-holo-glow/15" />

      {/* System status with animated pulse */}
      <div className="flex items-center gap-2">
        <span className="relative flex h-2.5 w-2.5" aria-hidden>
          <span
            className={`absolute inline-flex h-full w-full animate-ping rounded-full opacity-70 ${
              connectionState.tone === 'green' ? 'bg-alert-green' : 'bg-alert-amber'
            }`}
          />
          <span
            className={`relative inline-flex h-2.5 w-2.5 rounded-full ${
              connectionState.tone === 'green' ? 'bg-alert-green' : 'bg-alert-amber'
            }`}
          />
        </span>
        <span
          className={`font-mono text-[11px] font-semibold tracking-[0.18em] ${
            connectionState.tone === 'green' ? 'text-alert-green' : 'text-alert-amber'
          }`}
        >
          {connectionState.label}
        </span>
      </div>

      {/* Metrics cluster */}
      <div className="ml-2 flex items-center gap-5">
        <Metric label="India Time" value={clock} />
        <Metric label="Last GPS Update" value={formatRelativeAge(feedMeta.lastFetchAt)} />
        <Metric
          label="Live Buses"
          value={<CountUp value={buses.length} className="text-holo-glow" />}
        />
        <Metric
          label="Visible"
          value={<CountUp value={visibleCount} className="text-holo-teal" />}
        />
      </div>

      <div className="ml-auto flex items-center gap-2">
        {/* The core labelling affordance: live data vs simulated capability */}
        <div className="mr-1 flex items-center gap-2">
          <Badge variant={feedMeta.source === 'fixture' ? 'fixture' : 'live'} pulse>
            {feedMeta.source === 'fixture' ? LIVE_LABELS.fixture : LIVE_LABELS.gps}
          </Badge>
          <Badge variant="sim">SIMULATED AI CAPABILITIES</Badge>
        </div>

        <button type="button" className="hud-button" onClick={() => toggleAudit()}>
          <ScrollText className="h-3.5 w-3.5" aria-hidden />
          Audit
        </button>
        <button type="button" className="hud-button" onClick={() => toggleDiagnostics()}>
          <ShieldCheck className="h-3.5 w-3.5" aria-hidden />
          Diagnostics
        </button>
        <button type="button" className="hud-button" onClick={() => toggleScenarioLab()}>
          <FlaskConical className="h-3.5 w-3.5" aria-hidden />
          Scenario Lab
        </button>
        <button
          type="button"
          className="hud-button-primary"
          onClick={() => setPitchMode(true)}
          data-testid="start-pitch-mode"
        >
          <Play className="h-3.5 w-3.5" aria-hidden />
          Pitch Mode
        </button>
        <button
          type="button"
          className="hud-button"
          onClick={onToggleFullscreen}
          aria-label={isFullscreen ? 'Exit full screen' : 'Enter full screen'}
        >
          {isFullscreen ? (
            <Minimize2 className="h-3.5 w-3.5" aria-hidden />
          ) : (
            <Maximize2 className="h-3.5 w-3.5" aria-hidden />
          )}
        </button>
      </div>
    </header>
  );
}

function Metric({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="leading-tight">
      <div className="hud-label">{label}</div>
      <div className="font-mono text-xs tabular-nums text-holo-glow/90">{value}</div>
    </div>
  );
}
