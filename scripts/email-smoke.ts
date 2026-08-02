// SMTP smoke test — verifies the configured email adapter end-to-end by sending
// one test message to an address WE own (never a lead: this is an internal
// technical check, not outreach, so the §C gate does not apply here).
//
//   npx tsx scripts/email-smoke.ts <to>
//
// Provider comes from the env (EMAIL_PROVIDER): 'mock' writes to outbox/ (no
// credentials needed); 'smtp' needs SMTP_URL + OUTREACH_FROM and sends for real.

import { config } from "../src/config.js";
import { getEmailSender } from "../src/email/sender.js";

async function main(): Promise<void> {
  const to = process.argv[2];
  if (!to || !to.includes("@")) {
    console.error("Használat: npx tsx scripts/email-smoke.ts <cél-email>");
    console.error("  (Csak SAJÁT címre — ez technikai füst-teszt, nem outreach.)");
    process.exit(1);
  }

  console.log(`Adapter: ${config.emailProvider} · From: ${config.outreachFrom || "(nincs OUTREACH_FROM)"}`);
  const sender = getEmailSender();
  const now = new Date().toISOString();
  const result = await sender.send({
    to,
    subject: `Citoviso SMTP füst-teszt · ${now}`,
    text:
      `Ez egy technikai próbalevél a Citoviso dev-szerverről (${now}).\n\n` +
      `Ha ezt olvasod, a kimenő e-mail-út működik.\n` +
      `Adapter: ${config.emailProvider}\n`,
    html:
      `<div style="font-family:Inter,Arial,sans-serif;max-width:520px;margin:0 auto;padding:24px;` +
      `border:1px solid #e3edf2;border-radius:12px">` +
      `<h2 style="color:#0e2a47;margin:0 0 12px">Citoviso — SMTP füst-teszt</h2>` +
      `<p style="color:#10243a">Ez egy technikai próbalevél a dev-szerverről (<code>${now}</code>).</p>` +
      `<p style="color:#10243a">Ha ezt olvasod, a kimenő e-mail-út <strong style="color:#1fb6d6">működik</strong>.</p>` +
      `<p style="color:#60748b;font-size:13px;margin-top:20px">Adapter: ${config.emailProvider}</p>` +
      `</div>`,
  });
  console.log(`✅ Elküldve · provider=${result.provider} · id=${result.id}`);
  if (result.provider === "mock") {
    console.log("   (mock-mód: a levél az outbox/ mappába íródott, nem ment ki)");
  }
}

main().catch((e) => {
  console.error(`⛔ Küldés-hiba: ${(e as Error).message}`);
  process.exit(1);
});
