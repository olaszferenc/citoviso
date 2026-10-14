// „Megközelítés”: útvonaltervező link a térkép alatt (Elek-foglaló F-8, 2026-10-14).
// A lelet „üres doboza” mérve nem hiba: az élő oldalon a térkép betölt, ha a vendég odagörget —
// a teljes oldalas képernyőkép a lusta iframe-et betöltés ELŐTT fotózta. A valós hiány: a dobozból
// nem lehetett útvonalat tervezni. A link a térkép UGYANAZON pozíciójára mutat (koordináta, ha van,
// különben a cím), a kereten KÍVÜL áll, így letiltott keretnél is működik.
// Futtatás: npx tsx scripts/map-route-link-check.mts
const { moduleSections } = await import("../src/engine/moduleSections.js");
type SiteData = import("../src/engine/recipe.js").SiteData;

let fail = 0;
const check = (n: string, c: boolean, d?: unknown): void => {
  console.log(`${c ? "  ✓" : "  ✗"} ${n}${c || d === undefined ? "" : ` — ${String(d).slice(0, 260)}`}`);
  if (!c) fail++;
};
const site = (o: Partial<SiteData>): string =>
  moduleSections({ name: "Térkép Teszt", tagline: "", intro: "", highlights: [], photos: [], contact: {}, location: { showMap: true }, ...o } as unknown as SiteData);
const route = (h: string): string | null => /data-cit-route>[\s\S]*?<a href="([^"]+)"/.exec(h)?.[1]?.replace(/&amp;/g, "&") ?? null;

const geo = site({ geo: { lat: 46.77016, lon: 17.662962 }, contact: { address: "8630 Balatonboglár, Zrínyi u. 41." } } as never);
check("⭐ koordinátával: a link a térkép pozíciójára mutat", route(geo) === "https://www.google.com/maps/dir/?api=1&destination=46.77016%2C17.662962", route(geo));
check("⭐ a felirat: „Útvonaltervezés ide”, új lapon", /Útvonaltervezés ide/.test(geo) && /data-cit-route>[\s\S]*?target="_blank" rel="noopener"/.test(geo));
check("a cím-sor is megmarad", /Balatonboglár, Zrínyi u\. 41\./.test(geo));
const addr = site({ contact: { address: "8630 Balatonboglár, Zrínyi u. 41." } } as never);
check("cím alapján is (koordináta nélkül)", route(addr) === `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent("8630 Balatonboglár, Zrínyi u. 41.")}`, route(addr));
check("negatív kontroll: kikapcsolt térképnél nincs link", route(site({ location: { showMap: false, approachNote: "Parkolás az udvaron." }, contact: { address: "X" } } as never)) === null);
check("negatív kontroll: hely nélkül nincs szakasz és nincs link", !/data-cit-module="map"/.test(site({ location: undefined } as never)));

console.log(fail ? `\n⛔ MAP-ROUTE-LINK: ${fail} bukás` : "\n🟢 MAP-ROUTE-LINK: a Megközelítés alatt útvonaltervező link, a térkép pozíciójára");
process.exit(fail ? 1 : 0);
