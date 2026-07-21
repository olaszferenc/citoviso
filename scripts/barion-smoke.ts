// Barion sandbox smoke test — calls ONLY the adapter (no DB), to confirm the
// POSKey/Payee are valid and Payment/Start returns a real GatewayUrl. Run once
// after wiring the sandbox POSKey into .env, before the full DB pay-loop.
//   npx tsx scripts/barion-smoke.ts
// Load .env via Node's built-in (same as src/config.ts — no dotenv package).
// Must run BEFORE importing barion.ts, whose API/PAY consts read process.env at
// module-eval time — hence the dynamic import below.
(process as { loadEnvFile?: (path?: string) => void }).loadEnvFile?.();

async function main() {
  const { BarionGateway } = await import("../src/payment/barion.js");
  const gw = new BarionGateway();
  const base = process.env.PUBLIC_BASE_URL ?? "http://100.97.188.105:4600";
  const paymentId = `smoke_${Date.now().toString(36)}`;
  console.log(`[smoke] Payment/Start → ${process.env.BARION_URL} · payee=${process.env.BARION_PAYEE}`);
  const link = await gw.createPayLink({
    paymentId,
    amount: 100,
    currency: "HUF",
    period: "monthly",
    description: "Citoviso sandbox smoke",
    callbackUrl: `${base}/pay/webhook/barion`,
    returnUrl: `${base}/pay/done`,
  });
  console.log(`[smoke] OK ✅  gatewayRef=${link.gatewayRef}`);
  console.log(`[smoke] payUrl = ${link.payUrl}`);
}

main().catch((e) => {
  console.error(`[smoke] HIBA ❌  ${(e as Error).message}`);
  process.exit(1);
});
