'use client';

import { useEffect, useRef } from 'react';
import { useCopilotStore } from '@/stores/copilotStore';
import type { ScheduleResponse } from '@/models/canonical';

/**
 * Fetches the UPSRTC schedule ONLY for the currently selected bus.
 * Never bulk-fetches schedules for the whole fleet.
 */
export function useSchedule(): void {
  const selectedBusId = useCopilotStore((state) => state.selectedBusId);
  const setSchedule = useCopilotStore((state) => state.setSchedule);
  const setLoadingSchedule = useCopilotStore((state) => state.setLoadingSchedule);
  const logAudit = useCopilotStore((state) => state.logAudit);
  const inFlight = useRef<AbortController | null>(null);

  useEffect(() => {
    if (!selectedBusId) return;

    // Cancel any outstanding request for a previously selected bus.
    inFlight.current?.abort();
    const controller = new AbortController();
    inFlight.current = controller;

    let cancelled = false;
    setLoadingSchedule(true);

    async function load(): Promise<void> {
      try {
        const response = await fetch(
          `/api/upsrtc/schedule?regNum=${encodeURIComponent(selectedBusId as string)}`,
          { signal: controller.signal, cache: 'no-store' },
        );
        const payload = (await response.json()) as ScheduleResponse;
        if (cancelled) return;

        setSchedule(payload.schedule, payload.message ?? null, payload.source);
        logAudit(
          'schedule-fetched',
          payload.schedule
            ? `Live UPSRTC schedule retrieved for ${selectedBusId}`
            : `No UPSRTC schedule assigned for ${selectedBusId}`,
          { registrationNumber: selectedBusId ?? undefined, simulated: false },
        );
      } catch (error) {
        if (cancelled) return;
        if (error instanceof DOMException && error.name === 'AbortError') return;
        setSchedule(null, 'Schedule service unavailable. Live GPS remains active.', 'error');
      }
    }

    void load();

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [selectedBusId, setSchedule, setLoadingSchedule, logAudit]);
}
