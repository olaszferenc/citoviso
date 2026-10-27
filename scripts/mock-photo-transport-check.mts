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
  isPaidPhotoHost,
  photoRotations,
  resolveProxiedSource,
  rotatedPhoto,
  type HotlinkProbe,
  type PhotoFetcher,
  type SizeProbe,
} from "../src/generator/photoTransport.js";
import { SERVE_MAX_BYTES, SERVE_MAX_EDGE, downsizedPhoto } from "../src/console/photoProxy.js";
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
/** No size known (the host sent no Content-Length) — the tests below stay off the network. */
const noSize: SizeProbe = async () => null;

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
const plan = await planPhotoTransport([SAME, BADCERT, DIFFBYTES, SECURE], AID, fake, undefined, undefined, noSize);
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
const planRed = await planPhotoTransport([DIFFBYTES], AID, optimist, undefined, undefined, noSize);
check(planRed[0]?.via === "proxy", "PIROS IKER: két 200-as, de eltérő válasz nem elég a https-hez");

console.log("\n②b hotlink-tiltó https-hoszt (Huszár 62a12b3e, 2026-10-27) → saját proxy");
// Measured: huszar.info answers 200 without a Referer and 403 with the mock's — every photo
// of both mocks was a grey placeholder while the gate (no Referer) measured them healthy.
const HUSZAR = ["https://huszar.info/wp-content/uploads/nagyhaziko-001.jpg", "https://huszar.info/wp-content/uploads/kishaziko-001.jpg"];
const PORTAL = "https://hovamenjek.hu/upload/places/1_ab/fullHd/a.jpg";
const probed: string[] = [];
const blocks: HotlinkProbe = async (u) => { probed.push(u); return !u.includes("huszar.info"); };
const alive: PhotoFetcher = async (u) => ({ ok: true, body: img(u) });
const hot = await planPhotoTransport([...HUSZAR, PORTAL, SECURE], AID, alive, blocks, undefined, noSize);
check(hot.filter((r) => r.via === "proxy").map((r) => r.source).sort().join("|") === [...HUSZAR].sort().join("|"), "a tiltó hoszt MINDEN fotója a proxyra megy, a többi érintetlen");
check(hot.every((r) => r.served === proxiedMockPhotoUrl(AID, r.source)), "a proxy-URL a szokásos (b) út");
check(probed.filter((u) => u.includes("huszar.info")).length === 1, "hosztonként EGY próba");
check(!probed.some((u) => isPaidPhotoHost(u)), "fizetős hoszt (Places) soha nem próba");
const dead: PhotoFetcher = async () => ({ ok: false });
check((await planPhotoTransport(HUSZAR, AID, dead, async () => false, undefined, noSize)).length === 0, "halott kép (Referer nélkül sem él) nem kerül proxyra — az a kapu dolga");
check((await planPhotoTransport(HUSZAR, AID, alive, async () => true, undefined, noSize)).length === 0, "PIROS IKER: Refererrel is betöltődő https-kép érintetlen");
check(isPaidPhotoHost("https://places.googleapis.com/v1/x/media") && isPaidPhotoHost("https://lh3.googleusercontent.com/p/x") && !isPaidPhotoHost(HUSZAR[0]!), "isPaidPhotoHost: Places/Google igen, a szállás hosztja nem");
const hz = { siteData: { photos: HUSZAR.map((url) => ({ url })) } };
check(resolveProxiedSource(hz, photoSourceHash(HUSZAR[0]!)) === HUSZAR[0], "a tárolt https-forrás feloldódik (rerender után a route kiszolgálja)");

console.log("\n②c forgatott portálkép (Lakeside Home 79202242, 2026-10-27) → proxy, a route forgat");
// 9 of 17 hovamenjek photos are 1440×1080 files whose pixels are turned 90°, no EXIF. The
// curators set raw photos[].rotate; the mock gets the turned bytes (and so the turned aspect).
const LK = "https://hovamenjek.hu/upload/places/36203_e9/fullHd/balatonszarszo-lakeside-home-apartman7.jpg";
const LK2 = "https://hovamenjek.hu/upload/places/36203_e9/fullHd/balatonszarszo-lakeside-home-apartman2.jpg";
const rawLk = { portalProfiles: [{ photos: [{ url: LK, rotate: 90 }, { url: LK2 }, { url: "https://x.hu/a.jpg", rotate: 45 }, { url: "https://x.hu/b.jpg", rotate: "270" }] }], photos: [{ url: "https://own.hu/c.jpg", rotate: 180 }, { url: SECURE, rotate: 90 }] };
const rots = photoRotations(rawLk);
check(rots.get(LK) === 90 && rots.get("https://x.hu/b.jpg") === 270 && rots.get("https://own.hu/c.jpg") === 180, "a mező: photos[].rotate = 90 | 180 | 270 (szám, vagy számjegy-szöveg), portál- és saját fotón");
check(!rots.has(LK2) && !rots.has("https://x.hu/a.jpg"), "PIROS IKER: mező nélkül / 45°-kal nincs forgatás");
const noProbe: HotlinkProbe = async () => true;
const turned = await planPhotoTransport([LK, LK2, SECURE], AID, alive, noProbe, rots, noSize);
check(turned.length === 1 && turned[0]!.source === LK && turned[0]!.served === `${proxiedMockPhotoUrl(AID, LK)}?r=90`, "a forgatott kép a proxyra megy (?r=90 a cache miatt), a többi érintetlen");
check(!turned.some((r) => r.source === SECURE), "fizetős hoszt (Places) forgatva sem megy proxyra");
check(resolveProxiedSource({ siteData: { photos: [{ url: LK }] } }, photoSourceHash(LK)) === LK, "a route a ?r nélküli lenyomatból oldja fel");
const sharp = (await import("sharp")).default;
const wide = await sharp({ create: { width: 40, height: 30, channels: 3, background: "#888" } }).jpeg().toBuffer();
const meta = await sharp(await rotatedPhoto(wide, 90)).metadata();
check(meta.width === 30 && meta.height === 40 && meta.format === "jpeg", "rotatedPhoto(90): 40×30 → 30×40, a formátum marad");

console.log("\n②d túlméretes forrás (DunaTaxi b680c405, 2026-10-27) → proxy, a route kicsinyít");
// Measured: apartmanszallaskalocsa.hu serves 5196 px JPEGs of 12–17 MB straight into both
// mocks (~85 MB on a phone), and the console's 12 MiB cap called the live photos unreachable.
const DT = ["https://apartmanszallaskalocsa.hu/images/image8.jpg", "https://apartmanszallaskalocsa.hu/images/image9.jpg"];
const sizes: SizeProbe = async (u) => (u.endsWith("image8.jpg") ? 16_796_329 : u.endsWith("image9.jpg") ? 264_559 : null);
const big = await planPhotoTransport([...DT, SECURE], AID, alive, noProbe, undefined, sizes);
check(big.length === 1 && big[0]!.source === DT[0] && big[0]!.served === proxiedMockPhotoUrl(AID, DT[0]!), "a 16,8 MB-os kép a proxyra megy, a 265 kB-os közvetlen marad");
check(!big.some((r) => r.source === SECURE), "fizetős hoszt (Places) mérete nem számít, soha nem proxy");
const sameHttp = await planPhotoTransport([SAME], AID, fake, noProbe, undefined, async () => 9_000_000);
check(sameHttp.length === 1 && sameHttp[0]!.via === "proxy", "a http→https (a) úton közvetlen, de túlméretes kép is a proxyra megy");
check((await planPhotoTransport(DT, AID, alive, noProbe, undefined, async () => SERVE_MAX_BYTES)).length === 0, "PIROS IKER: a küszöbön (nem fölötte) nincs proxy");
const huge = await sharp({ create: { width: 5196, height: 3464, channels: 3, background: "#7a9" } }).jpeg({ quality: 100 }).toBuffer();
const shrunk = await downsizedPhoto(huge, "image/jpeg");
const sm = await sharp(shrunk.body).metadata();
check(sm.width === SERVE_MAX_EDGE && sm.height === 1600 && sm.format === "jpeg" && shrunk.contentType === "image/jpeg", "downsizedPhoto: 5196×3464 JPEG → 2400×1600 JPEG");
const png = await sharp({ create: { width: 3000, height: 1000, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } }).png().toBuffer();
const pngOut = await downsizedPhoto(png, "image/png");
const pm = await sharp(pngOut.body).metadata();
check(pm.width === SERVE_MAX_EDGE && pm.format === "webp" && pm.hasAlpha === true && pngOut.contentType === "image/webp", "átlátszó PNG → WebP, az alfa megmarad");
check((await downsizedPhoto(wide, "image/jpeg")).body === wide, "PIROS IKER: a kicsi kép bájtra érintetlen");
const garbage = Buffer.alloc(2_000_000, 1);
check((await downsizedPhoto(garbage, "image/jpeg")).body === garbage, "értelmezhetetlen bájt: az eredeti megy tovább (nem dob)");
const proxySrc = readFileSync("src/console/photoProxy.ts", "utf8");
check(/const served = await downsizedPhoto\(body, type\)/.test(proxySrc) && /body: served\.body/.test(proxySrc), "fetchPhoto a kicsinyített bájtot tárolja (konzol, kapu és mock-proxy egy forrásból)");

console.log("\n②e sok kép egy vision-hívásban (Sárgarózsa 3419993e, 2026-10-27): > 20 kép → mind ≤ 2000 px");
{
  const { fitManyImageRequest, MANY_IMAGES, MANY_IMAGES_MAX_EDGE } = await import("../src/generator/images.js");
  const block = (buf: Buffer) => ({ type: "image" as const, source: { type: "base64" as const, media_type: "image/jpeg", data: buf.toString("base64") } });
  const big = await sharp({ create: { width: 2048, height: 1536, channels: 3, background: "#7a9" } }).jpeg().toBuffer();
  const small = await sharp({ create: { width: 600, height: 800, channels: 3, background: "#97a" } }).jpeg().toBuffer();
  const many = [block(big), ...Array.from({ length: MANY_IMAGES }, () => block(small))];
  const fitted = await fitManyImageRequest(many);
  const edges = await Promise.all(fitted.map(async (b) => {
    const m = await sharp(Buffer.from((b.source as { data: string }).data, "base64")).metadata();
    return Math.max(m.width ?? 0, m.height ?? 0);
  }));
  check(fitted.length === many.length && edges.every((e) => e <= MANY_IMAGES_MAX_EDGE) && edges[0] === MANY_IMAGES_MAX_EDGE,
    `21 kép: a 2048 px-es ${MANY_IMAGES_MAX_EDGE} px-re, a sorrend és a darabszám marad (${edges.slice(0, 3).join(", ")}…)`);
  check(fitted[1] === many[1], "a határon belüli kép érintetlen (ugyanaz a blokk)");
  const few = [block(big), block(small)];
  check((await fitManyImageRequest(few))[0] === few[0], "PIROS IKER: ≤ 20 kép → nincs kicsinyítés (a teljes felbontás marad)");
  const heroSrc = readFileSync("src/generator/heroPick.ts", "utf8");
  check(/const blocks = await fitManyImageRequest\(fetched\.map\(\(f\) => f\.block\)\)/.test(heroSrc), "a nyitókép-pontozó a kérés előtt átfuttatja (scoreHeroCandidates)");
}

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
const route = server.slice(server.indexOf("const cfgPhotoMatch"), server.indexOf("const cfgPhotoMatch") + 1400);
check(/resolveProxiedSource\(/.test(route) && /\^https\?:/.test(route) && /isPaidPhotoHost\(source\)/.test(route), "a route tárolt forrást old fel, http(s)-t szolgál ki, fizetős hosztot soha");
check(!/proxiedPhotoUrl|verifyPhotoSignature/.test(route) && !/places/i.test(route), "a route nem a konzol aláírt proxyja, és nem hív Places-t");
check(/leadPhotoRotations\(row\.lead_id\)/.test(route) && /rotatedPhoto\(/.test(route), "a route a lead kézi forgatását alkalmazza (kérésidőben)");

console.log(bad ? `\n⛔ ${bad} állítás bukott` : "\n✅ minden állítás teljesült");
process.exit(bad ? 1 : 0);
