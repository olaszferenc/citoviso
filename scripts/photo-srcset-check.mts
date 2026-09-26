// PHOTO-SRCSET GUARD — the page we send out offers every Google photo in phone-sized widths
// (FK-009 E2/V4, 2026-09-26). Measured before: 8–17 <img> per page at =w1200 (553 KB each),
// 1,2–5,5 MB per page on a link opened on a phone. `responsiveGooglePhotos()` (render.ts)
// adds srcset/sizes to lh3 <img> and a width/DPR image-set to lh3 background heroes; portal
// photos carry no size parameter and stay untouched.
//
// What is measured (pure, browser-free, no DB, no network):
//   ① an lh3 <img> gets srcset with 480/800/1200 (WebP, `-rw`) and a sizes attribute; the hero
//      (data-cit-hero-img, or the first eager one) says 100vw, a lazy one says auto…
//   ② a portal <img> (no size suffix) is untouched; an existing srcset is respected
//   ③ a smaller source (=w800) never offers a width it does not have
//   ④ an lh3 background-image hero becomes data-cit-bg + --cit-bg-{s,m,l}, and the page
//      carries exactly ONE <style data-cit-bgset>; a portal background stays inline
//   ⑤ idempotent: the second pass changes nothing
//   ⑥ integration: fullbleed (background hero) and brutalism (<img> hero) rendered from a
//      fixture with lh3 URLs carry the markup after renderSite — the pass IS wired in
//   ⑦ negative control: a copy of the fullbleed page with the pass undone fails ⑥
//
//   npx tsx scripts/photo-srcset-check.mts
import type { Recipe, SiteData } from "../src/engine/recipe.js";
import { renderSite, responsiveGooglePhotos } from "../src/engine/render.js";
import { TEMPLATES } from "../src/engine/templates.js";

let fails = 0;
function check(ok: boolean, label: string): void {
  console.log(`${ok ? "✓" : "✗"} ${label}`);
  if (!ok) fails++;
}

const LH3 = "https://lh3.googleusercontent.com/place-photos/AG9NLjTESTabc=s4800-w1200";
const LH3_800 = "https://lh3.googleusercontent.com/place-photos/AG9NLjTESTdef=w800";
const PORTAL = "https://hovamenjek.hu/upload/places/1_x/main/x.jpg";

// ① / ② / ③
{
  const html = `<html><head></head><body>` +
    `<img src="${LH3}" alt="a">` +
    `<img src="${LH3}" alt="b" loading="lazy">` +
    `<img src="${PORTAL}" alt="c">` +
    `<img src="${LH3}" srcset="x 1w" alt="d">` +
    `<img src="${LH3_800}" alt="e" loading="lazy">` +
    `</body></html>`;
  const out = responsiveGooglePhotos(html);
  const imgs = [...out.matchAll(/<img\b[^>]*>/g)].map((m) => m[0]);
  check(/srcset="[^"]*=w480-rw 480w, [^"]*=w800-rw 800w, [^"]*=w1200-rw 1200w"/.test(imgs[0]!) && /sizes="100vw"/.test(imgs[0]!), "① az első (eager) lh3 kép: srcset 480/800/1200 WebP + sizes=100vw (hero)");
  check(/srcset=/.test(imgs[1]!) && /sizes="auto, \(max-width: 560px\) 100vw, 50vw"/.test(imgs[1]!), "① a lazy lh3 kép: srcset + sizes=auto…");
  check(imgs[2] === `<img src="${PORTAL}" alt="c">`, "② a portál-kép érintetlen (nincs méret-paraméter a forrásnál)");
  check(imgs[3] === `<img src="${LH3}" srcset="x 1w" alt="d">`, "② a meglévő srcset tiszteletben tartva");
  check(/srcset="[^"]*=w480-rw 480w, [^"]*=w800-rw 800w"/.test(imgs[4]!) && !/1200w/.test(imgs[4]!), "③ =w800 forrás: csak 480/800, nincs kitalált 1200");
  check(!out.includes("data-cit-bgset"), "④ nincs háttér-hero → nincs bgset stílus");
}
// ④
{
  const html = `<html><head><title>x</title></head><body>` +
    `<div class="t-herobg" style="background-image:url('${LH3}')"></div>` +
    `<section style="background-image:url('${PORTAL}')"></section>` +
    `</body></html>`;
  const out = responsiveGooglePhotos(html);
  check(/<div class="t-herobg" data-cit-bg style="--cit-bg-s:url\('[^']*=w480-rw'\);--cit-bg-m:url\('[^']*=w800-rw'\);--cit-bg-l:url\('[^']*=w1200-rw'\)"><\/div>/.test(out), "④ lh3 háttér-hero → data-cit-bg + --cit-bg-s/m/l");
  check(out.includes(`<section style="background-image:url('${PORTAL}')"></section>`), "④ a portál-háttér inline marad");
  check((out.match(/data-cit-bgset/g) ?? []).length === 1 && out.includes("</style></head>"), "④ pontosan EGY <style data-cit-bgset> a </head> előtt");
  check(/image-set\(var\(--cit-bg-s\) 1x,var\(--cit-bg-m\) 2x,var\(--cit-bg-l\) 3x\)/.test(out) && /max-width:480px/.test(out), "④ a telefonos szabály DPR szerint választ (1x/2x/3x, ≤480px)");
  // ⑤
  check(responsiveGooglePhotos(out) === out, "⑤ idempotens (második futás = első)");
}
// ⑥ integration through renderSite
const data: SiteData = {
  name: "Hotel Példa",
  tagline: "Csend és kilátás",
  intro: "Kilenc szobás butikhotel a régi városfal tövében.",
  highlights: ["Tetőterasz", "Borpince", "Wellness"],
  photos: [
    { url: LH3, alt: "A hotel", provenance: "places" },
    { url: "https://lh3.googleusercontent.com/place-photos/AG9NLjTEST2=s4800-w1200", alt: "Szoba", provenance: "places" },
    { url: PORTAL, alt: "Terasz", provenance: "portal" },
  ],
  contact: { email: "x@example.hu", phone: "+36 30 000 0000", address: "3300 Példaváros, Vár utca 2." },
  stats: [{ value: "4,8", label: "Google-értékelés · 30 vélemény", icon: "star" }],
  rating: { value: 4.8, count: 30 },
  place: { city: "Példaváros", country: "HU" },
};
const sections: Recipe["sections"] = (["hero", "features", "gallery", "enquiry"] as const).map((kind) => ({ kind }));
function render(id: string): string {
  const tpl = TEMPLATES[id]!;
  return renderSite({ template: id, skin: tpl.skins[0] ?? "editorial-warm", archetype: "stacked", sections }, data, { phase: "mock" });
}
const fb = render("fullbleed");
check(/<div class="t-herobg" data-cit-bg style="--cit-bg-s:url\('[^']*=w480-rw'\)/.test(fb) && fb.includes("data-cit-bgset"), "⑥ fullbleed: a háttér-hero DPR-választós a renderSite kimenetében");
check(/<img srcset="[^"]*=w480-rw 480w[^"]*" sizes="[^"]*"[^>]*src="https:\/\/lh3[^"]*"/.test(fb), "⑥ fullbleed: a galéria lh3 képei srcset-tel mennek");
check(fb.includes(`src="${PORTAL}"`) && !new RegExp(`srcset="[^"]*${PORTAL.replace(/[.*+?^${}()|[\]\\/]/g, "\\$&")}`).test(fb), "⑥ fullbleed: a portál-kép srcset nélkül, érintetlenül");
const br = render("brutalism");
check(/<img srcset="[^"]*=w1200-rw 1200w" sizes="100vw"[^>]*src="https:\/\/lh3[^"]*=s4800-w1200"/.test(br), "⑥ brutalism: az <img> hero sizes=100vw-vel");
// ⑦ negative control — the pass undone must fail ⑥ (a guard that cannot fail is a false green)
const undone = fb.replace(/<style data-cit-bgset>.*?<\/style>/, "").replace(/ data-cit-bg style="[^"]*"/g, ` style="background-image:url('${LH3}')"`);
check(!(/data-cit-bg style=/.test(undone) && undone.includes("data-cit-bgset")), "⑦ negatív kontroll: a visszabontott lapon a ⑥ bukik");

console.log(fails ? `\n✗ photo-srcset-check: ${fails} bukás` : "\n✓ photo-srcset-check: minden állítás zöld");
process.exit(fails ? 1 : 0);
