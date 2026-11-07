// Every 5 minutes: the maintenance job (send orders to providers, follow them, refunds, balances, trials…).
// Runs in the "cron" container of docker-compose.yml, calling the site the same way Vercel Cron would.
const url = process.env.CRON_URL ?? "http://app:3000/api/cron/maintenance";
const every = 5 * 60_000;

async function tick() {
  try {
    const r = await fetch(url, { headers: { authorization: `Bearer ${process.env.CRON_SECRET}` }, signal: AbortSignal.timeout(280_000) });
    console.log(new Date().toISOString(), r.status, (await r.text()).slice(0, 300));
  } catch (e) {
    console.error(new Date().toISOString(), "maintenance failed:", e instanceof Error ? e.message : e);
  }
}

await new Promise((r) => setTimeout(r, 60_000)); // let the site start first
for (;;) {
  const started = Date.now();
  await tick();
  await new Promise((r) => setTimeout(r, Math.max(10_000, every - (Date.now() - started))));
}
