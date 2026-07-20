import type { NextRequest } from 'next/server';
import { jsonResponse } from '@/lib/upsrtc/respond';
import { z } from 'zod';
import {
  fetchUpstream,
  buildScheduleUrl,
  indiaDate,
  isValidRegistrationNumber,
  REQUEST_TIMEOUT_MS,
} from '@/lib/upsrtc/client';
import { normalizeSchedulePayload } from '@/lib/upsrtc/normalizer';
import { TtlCache } from '@/lib/upsrtc/cache';
import scheduleFixture from '@/fixtures/upsrtc-schedule-sample.json';
import type { CanonicalSchedule, ScheduleResponse } from '@/models/canonical';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const CACHE_TTL_MS = 120_000;
const cache = new TtlCache<CanonicalSchedule | null>(CACHE_TTL_MS);

export const scheduleDiagnostics = {
  lastAttemptAt: null as string | null,
  lastSuccessAt: null as string | null,
  lastError: null as string | null,
  requestCount: 0,
};

const querySchema = z.object({
  regNum: z
    .string()
    .min(4)
    .max(16)
    .refine(isValidRegistrationNumber, { message: 'Malformed registration number' }),
  date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be YYYY-MM-DD')
    .optional(),
});

export async function GET(request: NextRequest): Promise<Response> {
  const acceptEncoding = request.headers.get('accept-encoding');
  const { searchParams } = new URL(request.url);

  const parsed = querySchema.safeParse({
    regNum: searchParams.get('regNum') ?? '',
    date: searchParams.get('date') ?? undefined,
  });

  if (!parsed.success) {
    return jsonResponse({
        schedule: null,
        fetchedAt: new Date().toISOString(),
        source: 'live' as const,
        stale: false,
        message: parsed.error.issues[0]?.message ?? 'Invalid request',
      } satisfies ScheduleResponse, { status: 400, acceptEncoding });
  }

  const regNum = parsed.data.regNum.toUpperCase();
  const date = parsed.data.date ?? indiaDate();
  const cacheKey = `${regNum}:${date}`;
  const now = Date.now();

  scheduleDiagnostics.requestCount += 1;

  const cached = cache.get(cacheKey, now);
  if (cached !== null) {
    return jsonResponse({
        schedule: cached,
        fetchedAt: new Date(now).toISOString(),
        source: 'cache' as const,
        stale: false,
      } satisfies ScheduleResponse, { acceptEncoding });
  }

  if (process.env.NEXT_PUBLIC_DEMO_MODE === '1') {
    return jsonResponse(fixtureSchedule(regNum, date, 'Fixture mode forced'), { acceptEncoding });
  }

  scheduleDiagnostics.lastAttemptAt = new Date(now).toISOString();
  const result = await fetchUpstream(buildScheduleUrl(regNum, date), REQUEST_TIMEOUT_MS);

  if (result.ok) {
    const schedule = normalizeSchedulePayload(result.payload, regNum, date);
    cache.set(cacheKey, schedule, now);
    scheduleDiagnostics.lastSuccessAt = new Date(now).toISOString();
    scheduleDiagnostics.lastError = null;

    return jsonResponse({
        schedule,
        fetchedAt: new Date(now).toISOString(),
        source: 'live' as const,
        stale: false,
        // Upstream returns a bare JSON string when a bus has no assignment today.
        message: schedule
          ? undefined
          : 'No UPSRTC schedule assigned to this vehicle for the selected date.',
      } satisfies ScheduleResponse, { acceptEncoding });
  }

  scheduleDiagnostics.lastError = result.error ?? 'Unknown upstream failure';

  const lastGood = cache.getLastGood(cacheKey);
  if (lastGood?.value) {
    return jsonResponse({
        schedule: lastGood.value,
        fetchedAt: new Date(lastGood.storedAt).toISOString(),
        source: 'cache' as const,
        stale: true,
      } satisfies ScheduleResponse, { acceptEncoding });
  }

  return jsonResponse(fixtureSchedule(regNum, date, scheduleDiagnostics.lastError), { acceptEncoding });
}

function fixtureSchedule(regNum: string, date: string, reason: string | null): ScheduleResponse {
  const schedule = normalizeSchedulePayload(scheduleFixture, regNum, date);
  return {
    schedule,
    fetchedAt: new Date().toISOString(),
    source: 'fixture',
    stale: true,
    message: reason
      ? `Showing UPSRTC fixture fallback (${reason}).`
      : 'Showing UPSRTC fixture fallback.',
  };
}
