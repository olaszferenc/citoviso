/**
 * Guard: POST /admin/photos accepts a real photo's worth of body, and refuses an
 * oversized one WITH an answer (not a dropped connection).
 *
 * 2026-09-27: every upload from the Fotók tab failed — the shared body reader capped
 * every request at 64 KB, a phone photo is megabytes as base64, and the reader threw
 * mid-stream, destroying the request: the browser's XHR sat at 100% and every file
 * queued behind it stayed at 0%.
 *
 * Writes nothing: the in-limit probe carries a NON-image data URL, which the route
 * refuses per file ("nem kép") after reading the whole body — exactly the proof that
 * the body got through.
 *
 * Run: npx tsx scripts/photo-upload-body-check.mts
 */
process.env.PUBLIC_PORT = "0";
process.env.CIT_SHOT = "1";
// Dynamic imports: a static import would run before the env lines above (ESM hoisting).
const { server } = await import("../src/server/public.js");
const { db } = await import("../src/db/client.js");
const { mintTenantCookieValue } = await import("../src/auth/tenantAuth.js");

let failed = 0;
const ok = (cond: boolean, msg: string): void => {
  console.log(`${cond ? "PASS" : "FAIL"} ${msg}`);
  if (!cond) failed++;
};

try {
  if (!server.listening) await new Promise((r) => server.once("listening", r));
  const port = (server.address() as { port: number }).port;
  const user = await db.selectFrom("tenant_user").select("id").limit(1).executeTakeFirstOrThrow();
  const cookie = `cit_session=${mintTenantCookieValue(user.id)}`;

  const post = async (bytes: number) => {
    const body = JSON.stringify({
      images: [{ dataUrl: `data:image/gif;base64,${"A".repeat(bytes)}`, name: "probe.gif", alt: "" }],
    });
    const r = await fetch(`http://127.0.0.1:${port}/admin/photos`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: cookie },
      body,
      signal: AbortSignal.timeout(30_000),
    });
    return { status: r.status, json: (await r.json()) as Record<string, unknown> };
  };

  // A 6 MB photo is ~8 MB of base64 — the largest body the Fotók tab can send.
  const big = await post(8_000_000);
  const reasons = ((big.json.errors ?? []) as { reason: string }[]).map((e) => e.reason);
  ok(
    big.status === 200 && reasons.some((r) => r.startsWith("nem kép")),
    `8 MB body read to the end (status ${big.status}, reasons ${JSON.stringify(reasons)})`,
  );

  // Over the limit: the browser must get a refusal back, not a reset connection.
  let over: { status: number; json: Record<string, unknown> } | null = null;
  try {
    over = await post(9_000_000);
  } catch (err) {
    console.log(`  (request error: ${(err as Error).message})`);
  }
  ok(over?.status === 400 && over.json.ok === false, `9 MB body refused with an answer (status ${over?.status})`);
} finally {
  server.close();
  await db.destroy();
}

if (failed) {
  console.error(`photo-upload-body-check: ${failed} FAIL`);
  process.exit(1);
}
console.log("photo-upload-body-check: OK");
process.exit(0);
