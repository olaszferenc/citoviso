/**
 * Kapu — http-s fotó NE kerüljön a https-es mockra, és ha mégis, a fotókapu BUKJON (ADR-0341).
 *
 * Kiváltó (mérve élesen 2026-10-08): a saját-honlapos fotó-behúzás `http://` URL-eket hozott
 * (16 lead · 237 URL). A mock https-en fut, a böngésző a képet https-re emeli, és ahol a hoszt
 * tanúsítványa rossz (Kerékhegy, Forrás: nem a domainre szól), ott a kép nem jelenik meg. A
 * kapu „ép"-et mondott, mert a szerver http-n 200-at kapott.
 *
 * Amit mér:
 *  ① CSERE (`applyPhotoTransport`): a forrás MINDEN alakja lecserélődik (src, srcset, CSS
 *    url(), JSON-LD, inline JS, `&amp;`), és egy hosszabb URL-be nem harap bele.
 *  ② ÚT-DÖNTÉS (`planPhotoTransport`): https csak BÁJTRA azonos képnél; eltérő bájt / rossz
 *    tanúsítvány / http-hiba → saját proxy; https-forrás érintetlen.
 *  ③ NEM NYÍLT PROXY: a route csak az artefaktum TÁROLT forrásaira old fel.
 *  ④ KAPU: http-s hivatkozás = `insecure` törött, NEM tudomásul vehető; a proxy-URL a
 *    forrásán mérődik; idegen artefaktum proxy-URL-je törött.
 *  ⑤ SZERKEZET: minden mock-író út a `secureMockPhotos`-on át ír, és a route a
 *    `resolveProxiedSource` + http-only feltétellel szolgál ki.
 *  Minden állítás mellett piros iker: a visszarontott bemenetet a detektornak el KELL utasítania.
 *
 * Futtatás: npx tsx scripts/mock-photo-transport-check.mts
 */
import { readFileSync } from "node:fs";

import {
  applyPhotoTransport,
  photoSourceHash,
  planPhotoTransport,
  proxiedMockPhotoUrl,
  resolveProxiedSource,
  type PhotoFetcher,
} from "../src/generator/photoTransport.js";
import {
  classifyServedRefs,
  extractImageRefs,
  hasInsecurePhoto,
  photoGateBlocks,
  type MockPhotoHealth,
} from "../src/outreach/mockPhotoHealth.js";

let bad = 0;
const check = (cond: boolean, m: string): void => {
  if (cond) console.log(`  ✓ ${m}`);
  else {
    bad++;
    console.log(`  ✗ ${m}`);
  }
};

const AID = "f8054cbe-7600-465b-acd2-57346841a94f";
const OTHER = "a63daf3e-8ae2-471e-b298-b4e176fdb8b8";
const SAME = "http://www.lehelvendeghaz.hu/img/a.jpg";
const BADCERT = "http://kerekhegyvendeghaz.hu/img/rooms/konyha-1.jpg";
const DIFFBYTES = "http://example.hu/x.jpg";
const SECURE = "https://places.googleapis.com/v1/x/media";

console.log("http-fotó a https-es mockon — út-döntés + kapu\n");

console.log("① a csere minden alakot elér, és nem harap bele egy hosszabb URL-be");
const Q = "http://h.hu/p.jpg?a=1&b=2";
const html = [
  `<meta property="og:image" content="${BADCERT}">`,
  `<script type="application/ld+json">{"image":["${BADCERT}"]}</script>`,
  `<img src="${BADCERT}" srcset="${BADCERT} 800w, ${BADCERT}2 1200w">`,
  `<div style="background-image:url('${BADCERT}')"></div>`,
  `<img src="${Q.replace(/&/g, "&amp;")}">`,
  `<script>var g=["${BADCERT}"];</script>`,
].join("\n");
const rows = [
  { source: BADCERT, served: proxiedMockPhotoUrl(AID, BADCERT), via: "proxy" as const },
  { source: Q, served: "https://h.hu/p.jpg?a=1&b=2", via: "https" as const },
];
const out = applyPhotoTransport(html, rows);
check(!out.includes(`${BADCERT}"`) && !out.includes(`${BADCERT}'`) && !out.includes(`${BADCERT} `), "a forrás egyik alakban sem maradt");
check(out.includes(`${BADCERT}2 1200w`), "a hosszabb (…jpg2) URL érintetlen");
check(out.split(`/configure/${AID}/photo/`).length - 1 === 6, "mind a 6 előfordulás a proxy-URL-re cserélődött");
check(!out.includes("http://h.hu/"), "az &amp;-kódolt query-s alak is cserélődött");
// red twin: a raw-only replacer misses the &amp; form
const naive = html.split(Q).join("X");
check(naive.includes("http://h.hu/"), "PIROS IKER: a csak-nyers csere az &amp;-alakot kihagyja (a detektor ezt látja)");

console.log("\n② út-döntés: https csak bájtra azonos képnél");
const img = (s: string): Buffer => Buffer.from(s);
const fake: PhotoFetcher = async (u) => {
  if (u === SAME || u === SAME.replace("http:", "https:")) return { ok: true, body: img("A") };
  if (u === BADCERT) return { ok: true, body: img("B") };
  if (u === BADCERT.replace("http:", "https:")) return { ok: false };
  if (u === DIFFBYTES) return { ok: true, body: img("C") };
  if (u === DIFFBYTES.replace("http:", "https:")) return { ok: true, body: img("parked-domain") };
  return { ok: false };
};
const plan = await planPhotoTransport([SAME, BADCERT, DIFFBYTES, SECURE], AID, fake);
const via = (u: string): string | undefined => plan.find((r) => r.source === u)?.via;
check(via(SAME) === "https" && plan.find((r) => r.source === SAME)?.served === SAME.replace("http:", "https:"), "azonos bájt → (a) https");
check(via(BADCERT) === "proxy", "rossz tanúsítvány → (b) proxy");
check(via(DIFFBYTES) === "proxy", "https-en MÁS kép (pl. parkoló domain) → (b) proxy, nem https");
check(!plan.some((r) => r.source === SECURE), "https-forrás (Places) érintetlen — nem megy a proxyra");
check(
  plan.filter((r) => r.via === "proxy").every((r) => r.served.endsWith(`/configure/${AID}/photo/${photoSourceHash(r.source)}`)),
  "a proxy-URL az artefaktum + a forrás lenyomata",
);
const optimist: PhotoFetcher = async (u) => ({ ok: true, body: img(u.startsWith("https") ? "Z" : "Y") });
const planRed = await planPhotoTransport([DIFFBYTES], AID, optimist);
check(planRed[0]?.via === "proxy", "PIROS IKER: két 200-as, de eltérő válasz nem elég a https-hez");

console.log("\n③ nem nyílt proxy: csak a tárolt forrás oldódik fel");
const inputs = { siteData: { photos: [{ url: BADCERT }, { url: SAME }] } };
check(resolveProxiedSource(inputs, photoSourceHash(BADCERT)) === BADCERT, "tárolt forrás → feloldva");
check(resolveProxiedSource(inputs, photoSourceHash("http://evil.example/x.jpg")) === null, "nem tárolt URL lenyomata → null (404)");
check(resolveProxiedSource({}, photoSourceHash(BADCERT)) === null, "üres inputs → null");
check(
  resolveProxiedSource({ photoTransport: [{ source: DIFFBYTES }] }, photoSourceHash(DIFFBYTES)) === DIFFBYTES,
  "a régebbi út (photoTransport) forrása is feloldódik",
);

console.log("\n④ kapu: http = törött és nem vehető tudomásul; proxy a forrásán mérve");
const pageHttp = `<img src="${BADCERT}"><img src="${SECURE}">`;
const c1 = classifyServedRefs(extractImageRefs(pageHttp), AID, inputs, "hu");
check(c1.failed.length === 1 && c1.failed[0]!.failure === "insecure", "a http-s <img> → insecure");
check(c1.measure.length === 1 && c1.measure[0]!.url === SECURE, "a https kép a mérésre megy");
const loop = classifyServedRefs(extractImageRefs(`<img src="http://127.0.0.1:9/a.png"><img src="http://localhost/b.png">`), AID, inputs, "hu");
check(loop.failed.length === 0 && loop.measure.length === 2, "a loopback http (helyi fixture) nem insecure — a böngésző sem blokkolja");
check(
  classifyServedRefs(extractImageRefs(`<img src="http://127.0.0.1.evil.hu/a.png">`), AID, inputs, "hu").failed.length === 1,
  "PIROS IKER: a loopbacknek álcázott hoszt (127.0.0.1.evil.hu) insecure",
);
const pageProxy = `<img src="${proxiedMockPhotoUrl(AID, BADCERT)}">`;
const c2 = classifyServedRefs(extractImageRefs(pageProxy), AID, inputs, "hu");
check(c2.failed.length === 0 && c2.measure[0]?.url === BADCERT, "a saját proxy-URL a FORRÁSÁN mérődik");
const pageForeign = `<img src="${proxiedMockPhotoUrl(OTHER, BADCERT)}">`;
const c3 = classifyServedRefs(extractImageRefs(pageForeign), AID, inputs, "hu");
check(c3.failed.length === 1 && c3.failed[0]!.failure === "notfound", "idegen artefaktum proxy-URL-je törött (a route 404-et adna)");
const pageRel = `<img src="/configure/${AID}/photo/${photoSourceHash("http://x/y.jpg")}">`;
check(classifyServedRefs(extractImageRefs(pageRel), AID, inputs, "hu").failed.length === 1, "nem tárolt forrású relatív proxy-URL törött");

const health: MockPhotoHealth = {
  artifactId: AID,
  verdict: "broken",
  checked: 2,
  unmeasured: 0,
  broken: c1.failed,
};
const fullAck = { broken: { at: "x", by: "op", urls: [BADCERT] }, noPhoto: null };
check(hasInsecurePhoto(health), "hasInsecurePhoto felismeri");
check(photoGateBlocks(health, fullAck), "a tudomásulvétel ELLENÉRE blokkol");
const ackable: MockPhotoHealth = { ...health, broken: [{ ...c1.failed[0]!, failure: "notfound" }] };
check(!photoGateBlocks(ackable, fullAck), "PIROS IKER: ugyanez 404-ként tudomásul vehető — tehát az insecure ág dönt");

console.log("\n⑤ szerkezet: minden mock-író út a secureMockPhotos-on át ír");
const writers = [
  "src/generator/generateEngine.ts",
  "src/generator/generate.ts",
  "src/generator/heroOverride.ts",
  "src/generator/recopy.ts",
  "src/generator/copyManual.ts",
  "scripts/rerender-mock.mts",
];
// Every mock write must carry a secured html — `writeFile(<path>, html` with a raw render is the regression.
const rawWrite = (src: string): string[] =>
  [...src.matchAll(/writeFile\(\s*(?:row\.path|path)\s*,\s*([^,]+),/g)]
    .map((m) => m[1]!.trim())
    .filter((arg) => !/secured|^html$/.test(arg) || (arg === "html" && !/const \{ html[^}]*\} = await secureMockPhotos/.test(src)));
for (const f of writers) {
  const src = readFileSync(f, "utf8");
  check(src.includes("secureMockPhotos(") && rawWrite(src).length === 0, `${f}: a lap a secureMockPhotos után íródik`);
}
const redSrc = 'const html = render(x);\nawait writeFile(path, html, "utf8");';
check(rawWrite(redSrc).length === 1, "PIROS IKER: a nyers render írása felismerve");
const server = readFileSync("src/console/server.ts", "utf8");
const route = server.slice(server.indexOf("const cfgPhotoMatch"), server.indexOf("const cfgPhotoMatch") + 900);
check(/resolveProxiedSource\(/.test(route) && /\^http:/.test(route), "a route tárolt forrást old fel, és csak http-t szolgál ki");
check(!/proxiedPhotoUrl|verifyPhotoSignature/.test(route) && !/places/i.test(route), "a route nem a konzol aláírt proxyja, és nem hív Places-t");

console.log(bad ? `\n⛔ ${bad} állítás bukott` : "\n✅ minden állítás teljesült");
process.exit(bad ? 1 : 0);
