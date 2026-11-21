// KÍSÉRLET-MOTOR önteszt (ADR-0462 kiserlet-motor-hideg-megkereses, brief kiserlet-motor-20261121 ⑤).
//
// Fixes the rules that decide who gets which letter and what counts as an open — so a later
// tweak cannot quietly reshuffle the split or start counting Apple's prefetch as readers:
//   ① the split is deterministic from its seed, sums to 1, and favours the better arm;
//   ② the floor: every enabled variant keeps ≥ floorPct of the cap (exploration never stops);
//   ③ the pick: the variant furthest below its share of today's cap; a non-applicable one never;
//   ④ the guard: ≥ minSends and unsubscribe > unsubMax, or a complaint → disable; the control is
//      exempt (the sending path never sees `guardVerdict` on a control — runGuard alerts only);
//   ⑤ the open classifier: Gmail proxy = open, Apple prefetch ≠ open, bots excluded;
//   ⑥ the letter: today's letter is unchanged with no options; the remote hero drops the CID
//      attachment; the plain layout has no price box / button; the first line and the From name
//      follow the variant; the owner's pilot copy marks the hero URL (own-view);
//   ⑦ the §C gate catches a misleading variant subject on the FINISHED letter.
// Pure — no DB writes, no network.
//
//   npx tsx scripts/experiment-selftest.mts

import {
  allocateDimension,
  applyFloor,
  guardVerdict,
  pickVariant,
  renderTemplate,
  rngOf,
  seedOf,
  thompsonShares,
  DEFAULT_EXPERIMENT,
  COMPLAINT_PATTERN,
} from "../src/outreach/experiment.js";
import { classifyMailFetch, RE_MAIL_HERO } from "../src/outreach/emailOpen.js";
import { renderDraft } from "../src/outreach/draft.js";
import { buildOutreachEmail, HERO_CID } from "../src/email/outreachEmail.js";
import { checkOutreachDraft } from "../src/outreach/outreachCheck.js";
import { markOwnViewLinks } from "../src/console/prospectPath.js";
import { loadPricing } from "../src/pricing.js";
import { prepareMailLang } from "../src/i18n/mail.js";

let failures = 0;
function check(name: string, ok: boolean, detail?: unknown): void {
  if (ok) console.log(`  ✓ ${name}`);
  else {
    failures++;
    console.log(`  ✗ ${name}${detail === undefined ? "" : `\n      ${JSON.stringify(detail).slice(0, 600)}`}`);
  }
}
const sum = (o: Record<string, number>): number => Object.values(o).reduce((a, b) => a + b, 0);
const near = (a: number, b: number, eps = 1e-9): boolean => Math.abs(a - b) <= eps;

console.log("① osztás");
{
  const arms = [
    { key: "control", trials: 500, successes: 60 },
    { key: "b", trials: 500, successes: 110 },
  ];
  const a1 = allocateDimension(arms, 10, "2026-11-23:subject");
  const a2 = allocateDimension(arms, 10, "2026-11-23:subject");
  check("ugyanabból a magból ugyanaz az osztás", JSON.stringify(a1) === JSON.stringify(a2), { a1, a2 });
  check("az osztás összege 1", near(sum(a1), 1), a1);
  const raw = thompsonShares(arms, rngOf(seedOf("x")));
  check("a jobb kar (22% vs 12%) P(best) > 0,95", raw.b > 0.95, raw);
  check("padlóval a gyengébb pontosan 10%-ot kap", near(a1.control, 0.1), a1);
  const fresh = thompsonShares([{ key: "a", trials: 0, successes: 0 }, { key: "b", trials: 0, successes: 0 }], rngOf(1));
  check("adat nélkül nagyjából fele-fele (0,4–0,6)", fresh.a > 0.4 && fresh.a < 0.6, fresh);
  const single = allocateDimension([{ key: "control", trials: 10, successes: 1 }], 10, "d");
  check("egyetlen engedélyezett változat = a teljes keret", near(single.control, 1), single);
  check("rossz siker-szám (több siker, mint próba) nem dob hibát", sum(thompsonShares([{ key: "a", trials: 3, successes: 9 }, { key: "b", trials: 3, successes: 0 }], rngOf(2))) > 0.99);
}

console.log("② padló");
{
  const f = applyFloor({ a: 0.98, b: 0.01, c: 0.01 }, 0.1);
  check("[0,98 0,01 0,01] → [0,8 0,1 0,1]", near(f.a, 0.8) && near(f.b, 0.1) && near(f.c, 0.1), f);
  const many = applyFloor(Object.fromEntries(Array.from({ length: 12 }, (_, i) => [`k${i}`, i === 0 ? 1 : 0])), 0.1);
  check("12 változatnál a 10% nem tartható → egyenlő osztás", Object.values(many).every((v) => near(v, 1 / 12)), many);
  const ok = applyFloor({ a: 0.5, b: 0.3, c: 0.2 }, 0.1);
  check("ha mind a padló fölött van, nem változik", near(ok.a, 0.5) && near(ok.b, 0.3) && near(ok.c, 0.2), ok);
  const cascade = applyFloor({ a: 0.9, b: 0.06, c: 0.04 }, 0.1);
  check("lépcsőzetes emelés után is mind ≥ 10% és összeg 1", Object.values(cascade).every((v) => v >= 0.1 - 1e-9) && near(sum(cascade), 1), cascade);
}

console.log("③ választás");
{
  const shares = { control: 0.7, b: 0.3 };
  check("a lemaradó kap (10-es keret, 7/2 → b)", pickVariant(shares, { control: 7, b: 2 }, 10, ["control", "b"]) === "b");
  check("a lemaradó kap (6/3 → control)", pickVariant(shares, { control: 6, b: 3 }, 10, ["control", "b"]) === "control");
  check("nem alkalmazható változat sosem (b nem alkalmazható → control)", pickVariant(shares, { control: 9, b: 0 }, 10, ["control"]) === "control");
  check("üres alkalmazható lista → null", pickVariant(shares, {}, 10, []) === null);
  check("döntetlennél a nagyobb részesedés", pickVariant({ a: 0.5, b: 0.5 }, {}, 10, ["b", "a"]) === "a");
  // A 40-es napon a 70/30 osztás valóban ~28/12 lesz.
  const got: Record<string, number> = { control: 0, b: 0 };
  for (let i = 0; i < 40; i++) got[pickVariant(shares, got, 40, ["control", "b"]) as string]++;
  check("40 levélből 28 kontroll + 12 b", got.control === 28 && got.b === 12, got);
}

console.log("④ őr");
{
  const cfg = DEFAULT_EXPERIMENT;
  check("100 levél, 1 leiratkozás (1%) → kikapcsol", guardVerdict({ sends: 100, unsubs: 1, complaints: 0 }, cfg) !== null);
  check("99 levél, 5 leiratkozás → még nem ítél (min. 100)", guardVerdict({ sends: 99, unsubs: 5, complaints: 0 }, cfg) === null);
  check("400 levél, 2 leiratkozás (0,5%) → marad (nem > 0,5%)", guardVerdict({ sends: 400, unsubs: 2, complaints: 0 }, cfg) === null);
  check("1 panasz-jel → kikapcsol, levélszámtól függetlenül", guardVerdict({ sends: 3, unsubs: 0, complaints: 1 }, cfg) !== null);
  check("panasz-minta: „ez spam, ne zaklassanak”", COMPLAINT_PATTERN.test("Ez spam, ne zaklassanak"));
  check("panasz-minta nem jelez egy sima elutasításra", !COMPLAINT_PATTERN.test("Köszönöm, nem érdekel, van honlapunk."));
}

console.log("⑤ levélnyitás-osztályozás");
{
  const gmail = "Mozilla/5.0 (Windows NT 5.1; rv:11.0) Gecko Firefox/11.0 (via ggpht.com GoogleImageProxy)";
  check("Gmail képproxy = nyitás", JSON.stringify(classifyMailFetch(gmail, "66.249.84.1")) === JSON.stringify({ kind: "open", client: "gmail_proxy" }));
  const appleUa = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko)";
  check("Apple Mail előtöltés (Mac WebKit UA) ≠ nyitás", classifyMailFetch(appleUa, "203.0.113.5").kind === "proxy_prefetch");
  check("Apple IP-blokk (17/8) ≠ nyitás", classifyMailFetch("Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15", "17.58.6.1").kind === "proxy_prefetch");
  check("IPv4-mapped Apple IP ≠ nyitás", classifyMailFetch("x", "::ffff:17.1.2.3").kind === "proxy_prefetch");
  check("csupasz „Mozilla/5.0” ≠ nyitás", classifyMailFetch("Mozilla/5.0", null).kind === "proxy_prefetch");
  check("Googlebot = bot", classifyMailFetch("Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)", null).kind === "bot");
  check("WhatsApp link-előnézet = bot (a mock_view lista)", classifyMailFetch("WhatsApp/2.23.20.0 A", null).kind === "bot");
  check("üres UA = bot", classifyMailFetch("", null).kind === "bot");
  check("iOS Mail (MPP nélkül) = nyitás", classifyMailFetch("Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148", "84.2.3.4").kind === "open");
  check("Outlook asztali = nyitás", classifyMailFetch("Microsoft Office/16.0 (Windows NT 10.0; Microsoft Outlook 16.0.17126; Pro)", "84.2.3.4").kind === "open");
  check("Yahoo proxy = nyitás", classifyMailFetch("YahooMailProxy; https://help.yahoo.com/kb/yahoo-mail-proxy-SLN28749.html", null).client === "yahoo_proxy");
  check("útvonal-minta: /p/<token>/kep.jpg", RE_MAIL_HERO.test("/p/abcdefghijklmnopqrstuvwx/kep.jpg") && !RE_MAIL_HERO.test("/p/short/kep.jpg"));
}

console.log("⑥ a levél");
{
  check("sablon: hiányzó város → nem alkalmazható", renderTemplate("{city}: a {name}", { name: "Rozé", city: "" }) === null);
  check("sablon: kitöltve", renderTemplate("Ez az Ön szállása? ({name}, {city})", { name: "Rozé Fogadó", city: "Tihany" }) === "Ez az Ön szállása? (Rozé Fogadó, Tihany)");

  await loadPricing();
  const lang = await prepareMailLang("hu");
  const token = "abcdefghijklmnopqrstuvwx";
  const draft = renderDraft({
    leadName: "Rozé Fogadó",
    region: "Balaton-felvidék",
    qualification: null,
    segment: "nincs_honlap",
    rating: { value: 4.7, count: 91 },
    token,
    lang,
    planCount: 1,
  });
  const shot = "assets/design-refs/console/outreach-mail/hero.png";
  const control = buildOutreachEmail(draft, "teszt@example.com", { lang, heroShotPath: shot, openVia: "e" });
  check("kontroll: CID-kép, mai első sor, nincs fromName", Boolean(control.html?.includes(`cid:${HERO_CID}`)) && Boolean(control.html?.includes("Elkészült a honlapja, nézze meg!")) && control.fromName === undefined);
  check("kontroll: a hős-kép csatolmány", Boolean(control.attachments?.some((a) => a.cid === HERO_CID)));

  const heroUrl = `https://getcitoviso.com/p/${token}/kep.jpg`;
  const remote = buildOutreachEmail(draft, "teszt@example.com", { lang, heroShotPath: shot, openVia: "e", heroUrl });
  check("távoli kép: az URL a HTML-ben, nincs CID", Boolean(remote.html?.includes(heroUrl)) && !remote.html?.includes(`cid:${HERO_CID}`));
  check("távoli kép: nincs hős-kép csatolmány", !remote.attachments?.some((a) => a.cid === HERO_CID));
  check("távoli kép: alt-szöveg és a gomb megmarad", Boolean(remote.html?.includes('alt="A honlap nyitóképe"')) && Boolean(remote.html?.includes("Megnézem a honlapot")));
  check("távoli kép: a szöveg-rész (text/plain) változatlan", remote.text === control.text);

  const plain = buildOutreachEmail(draft, "teszt@example.com", { lang, heroShotPath: shot, openVia: "e", bodyStyle: "plain", heroUrl });
  check("sima: nincs árdoboz, nincs gomb", !plain.html?.includes("#0a1f36") && !plain.html?.includes("Megnézem a honlapot"));
  check("sima: az ár mondatként benne (p3)", Boolean(plain.html?.includes(draft.parts.p3.slice(0, 30))));
  check("sima: ugyanaz a kapuzott szöveg (text/plain azonos)", plain.text === control.text);
  check("sima: nincs logó/aláírás-kép csatolmány", !(plain.attachments ?? []).length);
  check("sima: leiratkozás + adatkezelés + cégazonosítás", Boolean(plain.html?.includes(draft.unsubscribeLink)) && Boolean(plain.html?.includes(draft.privacyLink)) && Boolean(plain.html?.includes(draft.parts.identity.slice(0, 20))));

  const none = buildOutreachEmail(draft, "teszt@example.com", { lang, heroShotPath: shot, noImage: true });
  check("kép nélkül: se CID, se kép", !none.html?.includes(`cid:${HERO_CID}`) && !none.html?.includes("kep.jpg") && !none.attachments?.some((a) => a.cid === HERO_CID));

  const varied = buildOutreachEmail({ ...draft, subject: "Kérdés a Rozé Fogadó gazdájának" }, "teszt@example.com", {
    lang,
    firstLine: "Elkészítettük a Rozé Fogadó honlapját, csak Ön látja:",
    fromName: "Minta Név",
  });
  check("változat: tárgy, első sor, feladó-név", varied.subject === "Kérdés a Rozé Fogadó gazdájának" && Boolean(varied.html?.includes("csak Ön látja:")) && varied.fromName === "Minta Név");

  const own = markOwnViewLinks(remote.html ?? "");
  check("pilot-másolat: a kép URL-je ?sajat=1 jelet kap (nem számít nyitásnak)", own.includes(`${heroUrl}?sajat=1`));
  check("pilot-másolat: kétszer futtatva sem duplázza", markOwnViewLinks(own).split("kep.jpg?sajat=1").length === own.split("kep.jpg?sajat=1").length);

  console.log("⑦ a §C-kapu a KÉSZ levelen");
  const base = checkOutreachDraft(draft, "Rozé Fogadó", lang, { country: "HU", approved: true });
  const bad = checkOutreachDraft({ ...draft, subject: "Rozé Fogadó – élő már a honlapja" }, "Rozé Fogadó", lang, { country: "HU", approved: true });
  const badLine = checkOutreachDraft(
    { ...draft, body: `Elkészült az új honlapja!\n\n${draft.body}` },
    "Rozé Fogadó",
    lang,
    { country: "HU", approved: true },
  );
  check("a félrevezető tárgy-változat FLAG (a kapu a tárgyat is nézi)", bad.verdict === "FLAG" && bad.reasons.some((r) => r.startsWith("FÉLREVEZETÉS")), bad.reasons);
  check("a félrevezető első sor FLAG (a kapu az első sort is nézi)", badLine.verdict === "FLAG" && badLine.reasons.some((r) => r.startsWith("FÉLREVEZETÉS")), badLine.reasons);
  check("a kontroll-levél ugyanazzal a kapuval nem kap FÉLREVEZETÉS-t", !base.reasons.some((r) => r.startsWith("FÉLREVEZETÉS")), base.reasons);
}

if (failures) {
  console.error(`\n✗ experiment-selftest: ${failures} hiba`);
  process.exit(1);
}
console.log("\n✓ experiment-selftest: minden rendben");
process.exit(0);
