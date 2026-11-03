// ŐR — A DOMAIN-NYILVÁNTARTÁS ADATRÉTEGE (SUB-E, 2026-11-03).
//
// Amit mér — a nyilvántartás ígérete a tulajnak: „minden lépésnél dátum, ha mért; ha nem mért,
// azt írd ki” (§B.17), és a „Figyelmet kér” jelzés pontosan akkor szól, amikor kell.
//
//   ① ÉLETÚT: a lépések sorrendje és állapota az éles 3 domain alakján (dunavibehouse.hu
//      dns_pending állapotban és élesen, overseer.hu él, citoviso.hu saját). Mért időpont nélkül
//      a lépés soha nem kap kitalált időt; a kész, de időpont nélküli lépés `gap`-et visz.
//   ② .hu MEGERŐSÍTÉS: dns_pending közben a megerősítés a „folyamatban” lépés, amíg a
//      Nyilvántartó „adatok rögzítése” levele meg nem jött; nem-.hu névnek nincs ilyen lépése.
//   ③ FIGYELEM: 24/72 órás elakadás, a regisztrátor levele, lejárat 60/30/7 napon belül,
//      megújítási gond, megszűnt előfizetés mellett élő cím; a saját név lejárata nem riaszt.
//   ④ STATISZTIKA: a saját név kimarad az átfutásból és a költségből; a csomagban adott cím
//      nem hoz bevételt; a 90 napos lejárat-lista a legközelebbivel kezdődik.
//   ⑤ MEGERŐSÍTÉSI NYOM (a figyelő): a link a levélben megnevezett, FOLYAMATBAN lévő sorra
//      kerül; a „rögzítés” értesítő registry_recorded_at-et ad; idegen név és régi sor nem.
//
// Futtatás:  npx tsx scripts/domain-registry-check.mts

process.env.CIT_SHOT = "1";

const { lifeSteps, attentionOf, domainStats } = await import("../src/console/domainRegistry.js");
const { confirmTrailMarks } = await import("../src/domains/registryConfirmWatch.js");
type Rec = Parameters<typeof domainStats>[0][number];

let failed = 0;
const say = (ok: boolean, what: string, detail = ""): void => {
  if (ok) console.log(`✅ ${what}`);
  else {
    failed++;
    console.error(`❌ ${what}${detail ? `\n     ${detail}` : ""}`);
  }
};
const d = (s: string): Date => new Date(s);
const shape = (steps: ReturnType<typeof lifeSteps>): string =>
  steps.map((s) => `${s.key}:${s.state}${s.at ? "@" : s.gap ? `~${s.gap}` : ""}`).join(" ");

// ── ① + ② ÉLETÚT — az éles sorok alakja (élesen olvasva 2026-11-03) ──────────────
const duna = {
  tld: ".hu",
  house: false,
  stuckStage: 0,
  orderedAt: d("2026-11-03T09:15:48Z"),
  paidAt: d("2026-11-03T09:16:47Z"),
  boughtAt: d("2026-11-03T09:16:57Z"),
  confirmLinkAt: null,
  registryRecordedAt: null,
  nsActiveAt: null,
  liveAt: null,
  bought: true,
};
let s = shape(lifeSteps({ ...duna, status: "dns_pending" }));
say(
  s === "ordered:done@ paid:done@ bought:done@ confirm:current ns:todo tls:todo live:todo",
  "dns_pending .hu: a megerősítés a folyamatban lévő lépés, utána semmi nem kész",
  s,
);
s = shape(lifeSteps({ ...duna, status: "dns_pending", confirmLinkAt: d("2026-11-03T09:20:00Z"), registryRecordedAt: d("2026-11-03T10:55:00Z") }));
say(s.includes("confirm:done@ ns:current"), "a Nyilvántartó „rögzítés” levele után a megerősítés kész, a névszerver jön", s);
s = shape(
  lifeSteps({
    ...duna,
    status: "live",
    nsActiveAt: d("2026-11-03T11:05:27Z"),
    liveAt: d("2026-11-03T11:11:28Z"),
  }),
);
say(
  s === "ordered:done@ paid:done@ bought:done@ confirm:done~untracked ns:done@ tls:done~untracked live:done@",
  "élő .hu: a nem tárolt lépés (megerősítés a nyom-migráció előtt, TLS) KÉSZ, de időpont nélkül — nem kitalált idő",
  s,
);
s = shape(
  lifeSteps({
    ...duna,
    tld: ".hu",
    house: true,
    status: "live",
    orderedAt: null,
    paidAt: null,
    boughtAt: d("2026-10-17T09:16:44Z"),
    liveAt: d("2026-10-17T09:18:09Z"),
  }),
);
say(s.startsWith("ordered:done~house paid:done~house"), "saját név: a rendelés/fizetés hiánya „saját”, nem „nincs adat”", s);
s = shape(lifeSteps({ ...duna, tld: ".com", status: "tls_pending", nsActiveAt: d("2026-11-04T09:00:00Z") }));
say(!s.includes("confirm") && s.includes("tls:current"), "nem-.hu névnek nincs megerősítés-lépése", s);
s = shape(lifeSteps({ ...duna, status: "dns_pending", stuckStage: 2 }));
say(s.includes("confirm:stuck"), "72 órás elakadás: a folyamatban lévő lépés „elakadt”", s);
s = shape(lifeSteps({ ...duna, status: "failed", bought: false, boughtAt: null }));
say(s.includes("bought:stuck") && s.includes("paid:done@"), "vétel előtt bukott sor: a vétel az elakadt lépés", s);

// ── ③ FIGYELEM ─────────────────────────────────────────────────────────────────
const base = { status: "live", stuckStage: 0, registrarNote: null, renewProblem: null, renewEnd: null, house: false };
const att = (o: Partial<typeof base>, days: number | null): string => attentionOf({ ...base, ...o }, days).join(",");
say(att({}, 352) === "", "élő, egy évre lejáró név: nincs jelzés");
say(att({}, 60) === "expires_60" && att({}, 30) === "expires_30" && att({}, 7) === "expires_7", "lejárat 60/30/7 napon belül: a megfelelő fokozat");
say(att({ house: true }, 5) === "", "saját név lejárata nem riaszt (kézzel újítjuk)");
say(att({ renewEnd: d("2027-10-21T00:00:00Z") }, 20) === "subscription_ended", "megszűnt előfizetés mellett élő cím: ez a jelzés, nem a lejárat");
say(att({ status: "dns_pending", stuckStage: 1, registrarNote: "hiányzó adat" }, 360) === "stuck_24h,registrar_note", "elakadás + a regisztrátor levele");
say(att({ status: "live", stuckStage: 1, registrarNote: "régi levél" }, 352) === "", "élő név régi elakadás-nyoma már nem kér figyelmet (overseer.hu)");
say(att({ renewProblem: "egyenleg" }, 300) === "renew_problem", "megújítási gond");

// ── ④ STATISZTIKA ──────────────────────────────────────────────────────────────
const NOW = d("2026-11-03T16:00:00Z");
const rec = (o: Partial<Rec> & { domain: string }): Rec =>
  ({
    house: false,
    status: "live",
    tld: ".hu",
    attention: [],
    daysLeft: 300,
    costNet: 1990,
    cover: "package",
    monthlyFee: 0,
    steps: lifeSteps({ ...duna, status: "live", nsActiveAt: d("2026-11-03T11:05:27Z"), liveAt: d("2026-11-03T11:11:28Z") }),
    ...o,
  }) as Rec;
const st = domainStats(
  [
    rec({ domain: "dunavibehouse.hu" }),
    rec({ domain: "citoviso.hu", house: true, daysLeft: 20 }),
    rec({ domain: "a.hu", daysLeft: 40, attention: ["expires_60"] }),
    rec({ domain: "b.hu", daysLeft: 10, attention: ["expires_30"], cover: "fee", monthlyFee: 1000 }),
  ],
  NOW,
);
say(st.total === 4 && st.byState.live === 4 && st.attention === 2, "darabszám és figyelem-szám", JSON.stringify(st.byState));
say(st.expiring90.map((e) => e.domain).join(",") === "b.hu,a.hu" && st.expiring90Cost === 3980, "90 napos lejárat: a legközelebbi elöl, a saját név nélkül, díjjal");
say(st.turnaround.total?.n === 3 && Math.round(st.turnaround.total.ms / 60000) === 116, "átfutás: a saját név kimarad, rendeléstől élesig 1 óra 56 perc", JSON.stringify(st.turnaround.total));
const nov = st.months.find((m) => m.month === "2026-11");
say(!!nov && nov.cost === 3 * 1990 && nov.revenue === 1000, "november: 3 vétel költsége (saját nélkül), bevétel csak a havidíjas névből", JSON.stringify(nov));

// ── ⑤ MEGERŐSÍTÉSI NYOM ────────────────────────────────────────────────────────
const inflight = [{ id: "row-duna", domain: "dunavibehouse.hu" }];
const marks = confirmTrailMarks(
  [
    { token: "t1", link: "https://cfm.drr.hu/hu/confirmations/aaaa", mailAt: "03-Nov-2026 09:20:11 +0000", domain: "dunavibehouse.hu" },
    { token: "t1", link: "https://cfm.drr.hu/en/confirmations/aaaa", mailAt: "03-Nov-2026 09:20:11 +0000", domain: "dunavibehouse.hu" },
    { token: "t2", link: "https://cfm.drr.hu/hu/confirmations/bbbb", mailAt: "22-Oct-2026 13:23:35 +0000", domain: "overseer.hu" },
  ],
  [
    { msgId: "<r1@nic.hu>", from: "confirmation@domain.hu", subject: "[.hu] Domain adatok rögzítése (összefoglaló)", mailAt: "03-Nov-2026 10:55:02 +0000", text: "dunavibehouse.hu rögzítve" },
    { msgId: "<s1@websupport>", from: "support@websupport.hu", subject: "Re: dunavibehouse.hu", mailAt: "03-Nov-2026 10:00:00 +0000", text: "dunavibehouse.hu kérdés" },
  ],
  inflight,
);
const m = Object.fromEntries(marks.map((x) => [x.field, x]));
say(marks.length === 2, "két jel: a link és a rögzítés — az idegen (nem folyamatban lévő) név és a support-levél nem", JSON.stringify(marks));
say(m.confirm_link_at?.provisioningId === "row-duna" && m.confirm_link_at.at.toISOString() === "2026-11-03T09:20:11.000Z", "a link ideje a levélé, a megnevezett sorra");
say(m.registry_recorded_at?.at.toISOString() === "2026-11-03T10:55:02.000Z", "a „rögzítés” értesítő ideje registry_recorded_at");

if (failed) {
  console.error(`\n⛔ ${failed} ellenőrzés bukott — a domain-nyilvántartás ígérete sérült.`);
  process.exit(1);
}
console.log("\n✅ domain-registry-check: életút mért időkkel, figyelem-szabály, statisztika és a megerősítési nyom rendben.");
process.exit(0);
