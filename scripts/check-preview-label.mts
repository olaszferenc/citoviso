// ADR-0330 — the lead's own preview subdomain (https://<label>.citoviso.com).
//
// Pure checks of the pieces that decide what the lead SEES in the message and what the
// owner's copy carries: label minting, the platform-only link, and the own-view marker
// on the new link shape (without it the owner's copy would count as the lead's visit
// again — the 2026-10-05 measurement the ?sajat=1 marker was made for).
//
// Run: npx tsx scripts/check-preview-label.mts
import { cityOfAddress, fitLabel, labelCandidates, previewLink } from "../src/outreach/previewLabel.js";
import { siteSlugCandidate } from "../src/conversion/provision.js";
import { hasTrackedLink, markOwnViewLinks } from "../src/console/prospectPath.js";

let failed = 0;
let total = 0;
function eq(why: string, got: unknown, want: unknown): void {
  total++;
  if (JSON.stringify(got) !== JSON.stringify(want)) {
    failed++;
    console.error(`❌ ${why}\n   várt:   ${JSON.stringify(want)}\n   kapott: ${JSON.stringify(got)}`);
  }
}

// ── Label minting ─────────────────────────────────────────────────────────────
eq("város a magyar címből", cityOfAddress("8600 Siófok, Vécsey u. 12."), "siofok");
eq("cím irányítószám nélkül → nincs találgatás", cityOfAddress("Vécsey u. 12."), null);
eq("hiányzó cím", cityOfAddress(null), null);
const c = labelCandidates("Vécsey Apartman", "8600 Siófok, Vécsey u. 12.");
eq("első jelölt = a név", c[0], "vecsey-apartman");
eq("második jelölt = név + város", c[1], "vecsey-apartman-siofok");
eq("harmadik jelölt = sorszám", c[2], "vecsey-apartman-2");
eq("túl rövid név → nincs címke", labelCandidates("Ab", null), []);
eq("fenntartott név kimarad", labelCandidates("Admin", null)[0], "admin-2");
eq("max 40 karakter, kötőjel-vég nélkül",
  labelCandidates("Nagyon Hosszú Nevű Balatoni Vendégház És Apartmanház", null).every((l) => l.length <= 40 && !l.endsWith("-")),
  true);

// ── Elek IT K5 + A4 (2026-10-11): ONE shaper for the outreach label and the site slug ──
// Measured before: the site's "-2" went on AFTER the 40-cut (42 chars, mid-word
// `…-csaladi-ve-2`), the outreach side cut mid-word and its city candidate kept the cut's
// hyphen (`…-napfenyes--szigliget`).
{
  const LONG = "ELEK-TESZT Balatoni Napfényes Családi Vendégház és Apartmanház Szigliget";
  const ADDR = "8264 Szigliget, Fő utca 1.";
  const lc = labelCandidates(LONG, ADDR);
  const sites = Array.from({ length: 12 }, (_, i) => siteSlugCandidate(LONG, i));
  eq("K5: minden jelölt ≤ 40 (címke ÉS site-slug, a -N/-10 utótaggal együtt)",
    [...lc, ...sites].filter((l) => l.length > 40), []);
  eq("A4: nincs dupla / vég-kötőjel", [...lc, ...sites].filter((l) => /--|-$|^-/.test(l)), []);
  eq("A4: szóhatáron vág (nem „…-csaladi-ve”)", lc[0], "elek-teszt-balatoni-napfenyes-csaladi");
  eq("A4: a városos jelölt a városra végződő névből nem dupláz és nem hagy „--”-t", lc[1], "elek-teszt-balatoni-napfenyes-szigliget");
  eq("K5: a site „-2” jelöltje a 40-en belül, szóhatáron", sites[1], "elek-teszt-balatoni-napfenyes-csaladi-2");
  eq("K5: EGY szabály — a site-slug és a kiküldés-oldali címke sorszámos jelöltje azonos",
    sites.slice(1, 10), lc.filter((l) => /-\d+$/.test(l)).slice(0, 9));
  eq("A4: egyetlen hosszú szó → kemény vágás, az utótag egészben marad", fitLabel("a".repeat(60), "2"), `${"a".repeat(38)}-2`);
  eq("A4: 40-en belüli címke érintetlen (a már kiküldött címkék nem változnak)",
    fitLabel("elek-teszt-balatoni-napfenyes-csaladi-ve"), "elek-teszt-balatoni-napfenyes-csaladi-ve");
  eq("csak-emoji név → a site „oldalam” tartalékot kap", [siteSlugCandidate("🏡🌊", 0), siteSlugCandidate("🏡🌊", 1)], ["oldalam", "oldalam-2"]);
}

// ── The link: only on the real platform ───────────────────────────────────────
eq("éles platform → saját aldomain", previewLink("vecsey-apartman", "https://citoviso.com"), "https://vecsey-apartman.citoviso.com");
eq("dev (Tailscale) → nincs aldomain-link", previewLink("vecsey-apartman", "https://mineral.tail3a89f.ts.net:8443"), null);
eq("nincs címke → nincs aldomain-link", previewLink(null, "https://citoviso.com"), null);

// ── Own-view marker on the new shape ──────────────────────────────────────────
const sms = "Vécsey Apartman – … A Citoviso csapata\nhttps://vecsey-apartman.citoviso.com";
eq("SMS-másolat: az aldomain-link jelölt", markOwnViewLinks(sms), "Vécsey Apartman – … A Citoviso csapata\nhttps://vecsey-apartman.citoviso.com/?sajat=1");
eq("aldomain-link = követett link", hasTrackedLink(sms), true);
eq("HTML href is jelölt",
  markOwnViewLinks('<a href="https://vecsey-apartman.citoviso.com">x</a>'),
  '<a href="https://vecsey-apartman.citoviso.com/?sajat=1">x</a>');
eq("az alútvonalas leiratkozás érintetlen",
  markOwnViewLinks("https://citoviso.com/p/vecsey-apartman/63cNoWfy448yNdmeietS2YWf/unsubscribe"),
  "https://citoviso.com/p/vecsey-apartman/63cNoWfy448yNdmeietS2YWf/unsubscribe");
eq("a régi /p/ link továbbra is jelölt",
  markOwnViewLinks("https://citoviso.com/p/vecsey-apartman/63cNoWfy448yNdmeietS2YWf"),
  "https://citoviso.com/p/vecsey-apartman/63cNoWfy448yNdmeietS2YWf?sajat=1");
eq("www/admin nem előnézet", markOwnViewLinks("https://admin.citoviso.com https://www.citoviso.com"), "https://admin.citoviso.com https://www.citoviso.com");
eq("platform-gyökér nem előnézet", hasTrackedLink("https://citoviso.com"), false);

if (failed) {
  console.error(`\n${failed}/${total} eset bukott.\n`);
  process.exit(1);
}
console.log(`✅ preview-label: ${total}/${total} eset rendben.`);
process.exit(0);
