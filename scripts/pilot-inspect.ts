// Pilot state inspector — buyer fields (email/address) for a given order_intent,
// needed by the real Számlázz invoice. Read-only.
// Run: npx tsx scripts/pilot-inspect.ts <orderIntentId?>
(process as { loadEnvFile?: (path?: string) => void }).loadEnvFile?.();

async function main() {
  const { db } = await import("../src/db/client.js");
  const oiId = process.argv[2];

  const q = db
    .selectFrom("order_intent as oi")
    .innerJoin("prospect as p", "p.id", "oi.prospect_id")
    .innerJoin("lead as l", "l.id", "p.lead_id")
    .select([
      "oi.id as oiId",
      "oi.status as oiStatus",
      "oi.price as price",
      "oi.billing_period as period",
      "oi.modules as modules",
      "p.id as prospectId",
      "p.contact_email as email",
      "l.id as leadId",
      "l.name as leadName",
      "l.address as address",
      "p.mock_artifact_id as artifactId",
    ])
    .orderBy("oi.created_at", "desc");

  const rows = oiId ? await q.where("oi.id", "=", oiId).execute() : await q.limit(15).execute();

  for (const r of rows) {
    const mods = ((r.modules as unknown as string[]) ?? []).length;
    console.log(
      `OI ${r.oiId} · ${r.oiStatus} · ${r.price ?? "-"} Ft/${r.period} · ${mods} modul\n` +
        `   lead=${r.leadName} (id=${r.leadId})\n` +
        `   email=${r.email ?? "❌ HIÁNYZIK"}\n` +
        `   address=${r.address ?? "❌ HIÁNYZIK"}\n` +
        `   artifact=${r.artifactId ? "van" : "❌ NINCS"} · prospect=${r.prospectId}`,
    );
  }
  await db.destroy();
}
main().catch((e) => {
  console.error(e);
  process.exit(1);
});
