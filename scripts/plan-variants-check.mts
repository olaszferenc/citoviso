// Regression gate for the DATA RULES behind a multi-plan link (plan-tabs contract,
// assets/design-refs/prospect-page/plan-tabs/; jog/provenance-őr FLAG, 2026-09-23).
//
// The page guard (plan-switcher-check) measures what the lead SEES; this one measures
// what makes the letter's words TRUE — against the real dev DB, on a throwaway prospect
// and synthetic artifacts it removes again:
//   · the plan set LOCKS once ANY channel claimed the link (not just `sent_at`);
//   · once offered, a plan STANDS — a later curator reject may not shrink the link
//     under a letter that said "mindhármat" (§I); before the offer it still drops;
//   · every plan a DIFFERENT template, all from the SAME photo set — the copy says
//     "háromféle kinézettel" and "ugyanazokból a képekből" (§B.17);
//   · the claim-time check: a set changed after the message was written is caught.
//
// Run:  npx tsx scripts/plan-variants-check.mts
process.env.CIT_SHOT = "1";

import { randomBytes } from "node:crypto";
import { db } from "../src/db/client.js";
import {
  curateArtifact,
  deleteArtifact,
  isArtifactDeletable,
  listProspectPlans,
  planCountStill,
  setProspectVariants,
} from "../src/console/data.js";
import { repointHero } from "../src/generator/heroOverride.js";
import { recopyArtifact } from "../src/generator/recopy.js";

let failures = 0;
function check(name: string, cond: boolean, detail?: unknown): void {
  if (cond) console.log(`  ✓ ${name}`);
  else {
    failures++;
    console.error(`  ✗ ${name}${detail === undefined ? "" : ` — ${JSON.stringify(detail)}`}`);
  }
}

const lead = await db.selectFrom("lead").select("id").orderBy("created_at").limit(1).executeTakeFirst();
if (!lead) {
  console.error("❌ plan-variants-check: nincs egyetlen lead sem a DB-ben — a próba nem futtatható.");
  process.exit(1);
}
const OTHER_LEAD = await db
  .selectFrom("lead")
  .select("id")
  .where("id", "!=", lead.id)
  .limit(1)
  .executeTakeFirst();

const PHOTOS = [{ url: "https://x.test/a.jpg" }, { url: "https://x.test/b.jpg" }];
const made: string[] = [];
async function artifact(template: string | null, opts: { photos?: unknown; leadId?: string; status?: string } = {}) {
  const r = await db
    .insertInto("mock_artifact")
    .values({
      lead_id: opts.leadId ?? lead!.id,
      path: `mock-plan-variants-check-${randomBytes(4).toString("hex")}.html`,
      status: (opts.status ?? "generated") as "generated",
      inputs: JSON.stringify({
        ...(template ? { template } : {}),
        siteData: { photos: opts.photos ?? PHOTOS },
      }),
    })
    .returning(["id", "path"])
    .executeTakeFirstOrThrow();
  made.push(r.id);
  return { artifactId: r.id, artifactPath: r.path! };
}

const P1 = await artifact("fullbleed", { status: "approved" });
const P2 = await artifact("editorial");
const P3 = await artifact("dopamine");
const SAME = await artifact("editorial");
const OTHERPHOTOS = await artifact("aurora", { photos: [{ url: "https://x.test/zzz.jpg" }] });
const NOLOOK = await artifact(null);
const FOREIGN = OTHER_LEAD ? await artifact("parallax", { leadId: OTHER_LEAD.id }) : null;

const prospect = await db
  .insertInto("prospect")
  .values({ lead_id: lead.id, mock_artifact_id: P1.artifactId, token: randomBytes(18).toString("base64url"), segment: "plan-variants-check" })
  .returning("id")
  .executeTakeFirstOrThrow();
const PID = prospect.id;
const count = async () => (await listProspectPlans(PID, P1)).length;

try {
  console.log("\ncsatolás — a szabályok");
  check("azonos sablon → elutasítva (same-look)", (await setProspectVariants(PID, [SAME.artifactId, P2.artifactId])).ok === false);
  const sl = await setProspectVariants(PID, [P2.artifactId, SAME.artifactId]);
  check("…és az OK neve same-look", !sl.ok && sl.reason === "same-look", sl);
  const dp = await setProspectVariants(PID, [OTHERPHOTOS.artifactId]);
  check("más fotókészlet → different-inputs", !dp.ok && dp.reason === "different-inputs", dp);
  const nl = await setProspectVariants(PID, [NOLOOK.artifactId]);
  check("nem ismert kinézet → look-unknown", !nl.ok && nl.reason === "look-unknown", nl);
  if (FOREIGN) {
    const fl = await setProspectVariants(PID, [FOREIGN.artifactId]);
    check("más lead terve → foreign-lead", !fl.ok && fl.reason === "foreign-lead", fl);
  }
  const ok = await setProspectVariants(PID, [P2.artifactId, P3.artifactId]);
  check("két eltérő sablon, azonos fotók → elfogadva", ok.ok, ok);
  check("a link 3 tervet visz", (await count()) === 3);

  console.log("\nfagyasztás — a csatolt alternatíva nem renderelődik újra a lead alatt");
  // The freeze runs BEFORE any rendering, so these calls have no side effect on a frozen
  // artifact; on the unattached control they stop at "no stored recipe" (synthetic rows).
  const FROZEN = /ki lett ajánlva/;
  check("nyitókép-csere: csatolt 3. terv BEFAGYASZTVA", FROZEN.test((await repointHero(P3.artifactId, null, "plan-variants-check")).message));
  check("szöveg-újraírás: csatolt 3. terv BEFAGYASZTVA", FROZEN.test((await recopyArtifact(P3.artifactId)).message));
  check("kontroll: egy CSATOLATLAN terv nem fagyott (a nyitókép-csere nem erre hivatkozik)", !FROZEN.test((await repointHero(SAME.artifactId, null, "plan-variants-check")).message));
  check("kontroll: egy CSATOLATLAN terv nem fagyott (a szöveg-újraírás nem erre hivatkozik)", !FROZEN.test((await recopyArtifact(SAME.artifactId)).message));

  console.log("\nelőtte elutasítva → kiesik; utána → marad");
  await db.updateTable("mock_artifact").set({ status: "rejected" }).where("id", "=", P3.artifactId).execute();
  check("MEGAJÁNLÁS ELŐTT az elutasított alternatíva kiesik (3 → 2)", (await count()) === 2);
  await db.updateTable("mock_artifact").set({ status: "generated" }).where("id", "=", P3.artifactId).execute();
  check("visszaállítva újra 3", (await count()) === 3);

  console.log("\nclaim-kori ellenőrzés");
  const still3 = await db.transaction().execute((trx) => planCountStill(trx, PID, 3));
  check("a levél 3 tervvel íródott, a link 3-at visz → mehet", still3);
  const still2 = await db.transaction().execute((trx) => planCountStill(trx, PID, 2));
  check("a levél 2 tervvel íródott, a link közben 3-at visz → MEGÁLL", !still2);

  console.log("\ntörlés — előtte szabad, utána nem");
  await curateArtifact(P3.artifactId, "approve", "plan-variants-check", "plan-variants-check");
  check("MEGAJÁNLÁS ELŐTT egy jóváhagyott alternatíva törölhető (házon belüli rendrakás)", await isArtifactDeletable(P3.artifactId));

  for (const col of ["mms_sent_at", "sms_sent_at", "email_sent_at", "sent_at"] as const) {
    console.log(`\nzár — ${col}`);
    await db.updateTable("prospect").set({ [col]: new Date() }).where("id", "=", PID).execute();
    const lk = await setProspectVariants(PID, [P2.artifactId]);
    check(`${col} után a tervkészlet ZÁROLT`, !lk.ok && lk.reason === "already-sent", lk);
    await db.updateTable("mock_artifact").set({ status: "rejected" }).where("id", "=", P3.artifactId).execute();
    check(`${col} után egy MEGAJÁNLOTT terv elutasítása sem szűkíti a linket (3 marad)`, (await count()) === 3);
    // …and it cannot be DELETED out from under the letter either (the variant row would
    // cascade away with the mock). Approved first: that is the state the delete button needs.
    await db.updateTable("mock_artifact").set({ status: "approved" }).where("id", "=", P3.artifactId).execute();
    check(`${col} után a megajánlott alternatíva NEM törölhető`, !(await isArtifactDeletable(P3.artifactId)));
    check(`${col} után a törlés no-op, a link 3 tervet visz`, !(await deleteArtifact(P3.artifactId)) && (await count()) === 3);
    await db.updateTable("mock_artifact").set({ status: "generated" }).where("id", "=", P3.artifactId).execute();
    await db.updateTable("prospect").set({ [col]: null }).where("id", "=", PID).execute();
  }
} finally {
  await db.deleteFrom("prospect").where("id", "=", PID).execute();
  if (made.length) await db.deleteFrom("mock_artifact").where("id", "in", made).execute();
  const left = await db.selectFrom("mock_artifact").select("id").where("id", "in", made).execute();
  check("takarítás: a szintetikus sorok törölve", left.length === 0, left.length);
  await db.destroy();
}

if (failures) {
  console.error(`\n❌ plan-variants-check: ${failures} bukás.`);
  process.exit(1);
}
console.log("\n✅ plan-variants-check: a tervkészlet a claimnél zárol, a megajánlott terv áll, a „háromféle kinézet” szerkezetileg igaz.");
process.exit(0);
