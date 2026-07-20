# Live vs Simulated — Definitive Reference

This is the authoritative statement of what is real in this prototype and what
is demonstration content. If any screen, document or verbal claim contradicts
this file, **this file is correct**.

---

## Rule

> Only UPSRTC GPS locations and schedule information are live.
> Everything else is a simulated demonstration of future capability.

---

## LIVE — real UPSRTC data

Sourced from the UPSRTC upstream API in real time. Labelled on screen with a
**green** badge.

| Data | Screen label | Source |
| --- | --- | --- |
| Vehicle position (lat/lng) | `LIVE UPSRTC GPS` | `getGpsLiveData.php` |
| Vehicle speed | `LIVE UPSRTC GPS` | `getGpsLiveData.php` |
| Vehicle heading | `LIVE UPSRTC GPS` | `getGpsLiveData.php` |
| Ignition state | `LIVE UPSRTC GPS` | `getGpsLiveData.php` |
| GPS timestamp | `LIVE UPSRTC GPS` | `getGpsLiveData.php` |
| Vehicle status (`Live`/`Offline`/…) | `LIVE UPSRTC GPS` | `getGpsLiveData.php` |
| Depot name | `LIVE UPSRTC GPS` | `getGpsLiveData.php` |
| Route name / id / description | `LIVE UPSRTC GPS` | `getGpsLiveData.php` |
| Registration number | `LIVE UPSRTC GPS` | `getGpsLiveData.php` |
| Fleet counts | Top command bar | Derived from the live feed |
| Data-quality classification | `GOOD` / `DEGRADED` / `STALE` | Derived from real GPS timestamp age |
| Origin & destination | `LIVE UPSRTC SCHEDULE` | `getScheduledBusInfo.php` |
| Scheduled departure / arrival | `LIVE UPSRTC SCHEDULE` | `getScheduledBusInfo.php` |
| Full stop sequence | `LIVE UPSRTC SCHEDULE` | `getScheduledBusInfo.php` |
| Stop coordinates (where surveyed) | `LIVE UPSRTC SCHEDULE` | `getScheduledBusInfo.php` |
| Route direction (`IN`/`OUT`) | `LIVE UPSRTC SCHEDULE` | Derived from real route-name suffix |

### Fixture fallback

If the upstream endpoint is unreachable, the app serves a **sanitized snapshot
of genuine UPSRTC data** captured by the inspector. It is labelled
`UPSRTC FIXTURE FALLBACK` in amber/cyan so it is never mistaken for a live feed.
The data is real; only its freshness is not.

---

## SIMULATED — demonstration content

Generated entirely by local templates in `src/lib/demo-scenarios/`, seeded
deterministically from the selected bus's registration number. Labelled on
screen with an **amber** badge.

| Feature | Screen label |
| --- | --- |
| Bunching detection & headway gaps | `SIMULATED BUNCHING DEMO` |
| Companion services A and C | `SIMULATED SERVICE A` / `SIMULATED SERVICE C` |
| Bunching risk % and clustering point | `SIMULATED BUNCHING DEMO` |
| Hold recommendation and projected recovery | `FUTURE BUNCHING-OPTIMIZATION DEMONSTRATION` |
| Traffic congestion & severity | `SIMULATED TRAFFIC DEMO` |
| Congestion corridor geometry | `SIMULATED TRAFFIC-INTELLIGENCE DEMONSTRATION` |
| Alternative route & ETA saving | `SIMULATED TRAFFIC DEMO` |
| Traffic density / speed profile | `SIMULATED TRAFFIC DEMO` |
| Breakdown event & fault type | `SIMULATED BREAKDOWN DEMO` |
| Passenger counts onboard | `SIMULATED BREAKDOWN DEMO` |
| Rescue candidates `SIM-RESCUE-0n` | `SIMULATED BREAKDOWN-RESPONSE DEMONSTRATION` |
| Response times & seat capacity | `SIMULATED BREAKDOWN DEMO` |
| Demand heatmap & hotspots | `SIMULATED DEMAND DEMO` |
| Route deficits / surpluses | `SIMULATED DEMAND DEMO` |
| Redistribution plan & arrows | `SIMULATED DEMAND AND FLEET-REDISTRIBUTION DEMONSTRATION` |
| Depot availability figures | `SIMULATED DEMAND DEMO` |
| Demand curves | `SIMULATED DEMAND DEMO` |
| AI confidence percentages | `SIMULATED AI DEMONSTRATION` |
| AI observations & recommendations | `SIMULATED AI DEMONSTRATION` |
| Driver messages (English & Hindi) | `DEMO MESSAGE — NO REAL DRIVER CONTACTED` |
| Driver acknowledgements | `SIMULATED COMMUNICATION` |
| VoIP call, audio waveform, summary | `PROTOTYPE VOIP SIMULATION — NO EXTERNAL CALL PLACED` |
| Network health percentages | `SIMULATED` |
| Before/after KPIs | `SIMULATED` |
| Future impact figures | `ILLUSTRATIVE FUTURE IMPACT` |

---

## Explicitly NOT used

Even where credentials exist in the environment, these are **not** called at
runtime:

- **Google Routes API** — no route computation. Alternative routes are local geometry.
- **Google TrafficLayer** — never enabled. All congestion is drawn by the app.
- **Any live traffic source.**
- **Anthropic API / any LLM** — every line of copilot text is a local template.
- **Any SMS, push or VoIP provider** — no message leaves the browser.

You can verify the last three by opening the Diagnostics drawer, which reports
`LLM calls: none — local templates`, `Traffic layer: disabled (simulated only)`
and `Routes API: not used`.

---

## Safety guarantees

1. No real driver is contacted by any action in this prototype.
2. No operational instruction is executed automatically or transmitted.
3. No vehicle is dispatched, held, diverted or reassigned.
4. No depot is notified.
5. No passenger data is collected, displayed or stored.
6. No upstream raw GPS payload is persisted to the browser.
7. Every simulated surface carries a visible label.
8. The footer disclaimer is present on every screen at all times.

---

## How labelling is enforced in code

- Every scenario template returns a mandatory `simulationLabel` field
  (`src/lib/demo-scenarios/types.ts`) — it cannot be omitted by type.
- `ScenarioStage` renders `SimulationBanner` above all scenario content.
- The top command bar always shows the live badge and
  `SIMULATED AI CAPABILITIES` side by side.
- The audit log stamps each event `simulated: true | false`, and exports
  carry the same distinction.
- Playwright test 12 asserts that live and simulated labels remain visible
  simultaneously while a scenario is on screen.
