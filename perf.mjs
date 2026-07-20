import { chromium } from '@playwright/test';
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1920, height: 1080 } });
await p.goto('http://127.0.0.1:3000/', { waitUntil: 'networkidle' });
await p.waitForSelector('[data-testid="fleet-bus-row"]', { timeout: 60000 });
await p.waitForTimeout(5000);

async function fps(label, action) {
  const r = await p.evaluate((ms) => new Promise((res) => {
    let frames = 0; const long = [];
    const obs = new PerformanceObserver((l) => { for (const e of l.getEntries()) long.push(Math.round(e.duration)); });
    try { obs.observe({ entryTypes: ['longtask'] }); } catch {}
    const t0 = performance.now();
    (function tick(){ frames++; if (performance.now()-t0 < ms) requestAnimationFrame(tick);
      else { obs.disconnect(); const el = performance.now()-t0;
        res({ fps:+(frames/(el/1000)).toFixed(1), longTasks:long.length, worst:long.length?Math.max(...long):0,
              blockingMs:long.reduce((s,d)=>s+Math.max(0,d-50),0) }); } })();
  }), 5000);
  console.log(`  ${label.padEnd(22)} fps=${String(r.fps).padStart(5)}  longTasks=${String(r.longTasks).padStart(3)}  worst=${String(r.worst).padStart(5)}ms  blocking=${r.blockingMs}ms`);
  return r;
}

console.log('=== BASELINE ===');
await fps('idle');
const t0 = Date.now();
await p.getByTestId('fleet-bus-row').nth(2).click();
await p.waitForSelector('[data-testid="bus-detail-drawer"]');
console.log(`  bus-select latency      ${Date.now()-t0}ms`);
await p.waitForTimeout(1500);
await fps('after selection');

const counts = await p.evaluate(() => ({
  dom: document.querySelectorAll('*').length,
  blur: [...document.querySelectorAll('*')].filter(e=>{const s=getComputedStyle(e);return s.backdropFilter&&s.backdropFilter!=='none';}).length,
  anim: [...document.querySelectorAll('*')].filter(e=>{const s=getComputedStyle(e);return s.animationName&&s.animationName!=='none';}).length,
}));
console.log('  DOM nodes:', counts.dom, '| backdrop-filter layers:', counts.blur, '| CSS-animated els:', counts.anim);
await b.close();
