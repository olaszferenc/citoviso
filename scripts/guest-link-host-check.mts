// GUEST-LINK-HOST ŐR — a levelekben kiküldött linkek a TENANT HOSTJÁN is élnek.
//
//   npx tsx scripts/guest-link-host-check.mts
//
// ⛔⛔ MIÉRT KELL (mérve élesen, csak olvasással, 2026-09-24 — Elek FK-008 utómérés).
// A vendég a szállás SAJÁT hostján foglal (`<slug>.citoviso.com` / saját domain), a
// leveleket a `publicBaseUrl(req)` = EZ a host építi, a `serveTenantHost()` pedig minden
// nem-gyökér útra 404 „Nincs ilyen oldal."-t adott: a tulaj elfogad/elutasít linkje, a
// vendég lemondó és ajánlat-linkje, a vélemény-verdikt linkje élesben MIND halott volt
// (`ferenc-haz.citoviso.com/foglalas/…` → „Nincs ilyen oldal"; `citoviso.com/foglalas/…` →
// „A link már nem él" = a kezelő él). A dev `/t/<slug>/` úton sosem látszott: ott a kérés
// hostja a platform. Az FK-007 tizenkét zöld futása ezt a hibát nem láthatta.
//
// MIT MÉR (a VALÓDI public szerveren, in-process, efemer porton, nyers Host-fejléccel):
//   ① A `MAIL_LINK_ROUTES` (src/server/mailLinkRoutes.ts — UGYANAZ a lista, amiből az
//      elosztó dolgozik) minden mintájára a tenant host NEM a tenant-404-et adja, hanem
//      azt, amit a platform host — státusz és cím szerint azonos válasz.
//   ② A lapok stíluslapja (`/assets/ui/citui.css`) a tenant hoston 200 text/css — a
//      tenant host eddig SEMMILYEN assetet nem szolgált (élesen 404), a linkelt lapok
//      pedig ezt töltik.
//   ③ NEGATÍV KONTROLL: egy tetszőleges más út a tenant hoston TOVÁBBRA IS a tenant
//      saját 404-e — az átengedés nem nyitotta ki a hostot.
//   ④ A predikátum maga: a lista minden mintáját igennel, az idegen utat nemmel ítéli
//      (ha valaki a listából kivesz egy sort, ① azonnal piros — ez a kötés).
//   ⑤ NEGATÍV KONTROLL a link HOSTJÁRA (ADR-0278): hamis `X-Forwarded-Host` fejléccel
//      a `publicBaseUrl(req)`-ből épített link a `Host`-ra (amiből a site feloldódik)
//      mutat, nem a hamisra. Az éles nginx ezt a fejlécet NEM írja felül, tehát a kliens
//      értéke változatlanul ér a Node-ig — a régi kódon egy foglalási kérés után a tulaj
//      „Elfogadom” linkje (benne az action_token) idegen domainre mutatott. A mérés a
//      vélemény-űrlap hozzájárulás nélküli POST-ja: a válaszlap „vissza” linkje UGYANAZ a
//      `publicBaseUrl(req)`, és ez az ág SEMMIT nem ír a DB-be (a consent-kapu előbb áll meg).
//
// ⚠️ Amit NEM mér: a levél TARTALMÁT (hogy a link tényleg a kérés hostjával épül) — az a
// `publicBaseUrl(req)` kódjából determinisztikus; és a saját domaint (custom_domain) sem,
// mert a feloldó ugyanaz az ág, csak más oszlopon keres.
process.env.CIT_SHOT = "1";
process.env.PUBLIC_PORT = "0";

import http from "node:http";
import { once } from "node:events";

import { MAIL_LINK_ROUTES, servesOnTenantHostToo } from "../src/server/mailLinkRoutes.js";
import { PLATFORM_DOMAIN } from "../src/domains.js";

const { server } = (await import("../src/server/public.js")) as { server: http.Server };
const { db, pool } = await import("../src/db/client.js");
if (!server.listening) await once(server, "listening");
const port = (server.address() as { port: number }).port;

interface Reply { status: number; type: string; body: string }
/** Raw POST (form body) with arbitrary extra headers — the Host goes out as given. */
const rawPost = (host: string, path: string, body: string, extra: Record<string, string> = {}): Promise<Reply> =>
  new Promise((resolve, reject) => {
    const req = http.request(
      {
        host: "127.0.0.1",
        port,
        path,
        method: "POST",
        headers: {
          Host: host,
          "content-type": "application/x-www-form-urlencoded",
          "content-length": String(Buffer.byteLength(body)),
          ...extra,
        },
      },
      (res) => {
        const chunks: Buffer[] = [];
        res.on("data", (c: Buffer) => chunks.push(c));
        res.on("end", () =>
          resolve({
            status: res.statusCode ?? 0,
            type: String(res.headers["content-type"] ?? ""),
            body: Buffer.concat(chunks).toString("utf8"),
          }),
        );
      },
    );
    req.on("error", reject);
    req.end(body);
  });

/** Raw GET so the Host header actually goes out (fetch drops it). */
const rawGet = (host: string, path: string): Promise<Reply> =>
  new Promise((resolve, reject) => {
    const req = http.request({ host: "127.0.0.1", port, path, headers: { Host: host } }, (res) => {
      const chunks: Buffer[] = [];
      res.on("data", (c: Buffer) => chunks.push(c));
      res.on("end", () =>
        resolve({
          status: res.statusCode ?? 0,
          type: String(res.headers["content-type"] ?? ""),
          body: Buffer.concat(chunks).toString("utf8"),
        }),
      );
    });
    req.on("error", reject);
    req.end();
  });

const titleOf = (html: string): string => /<title>([^<]*)<\/title>/i.exec(html)?.[1]?.trim() ?? "";
const TENANT_404 = "Nincs ilyen oldal";

let failed = 0;
function check(label: string, ok: boolean, detail = ""): void {
  console.log(`  ${ok ? "✅" : "⛔"} ${label}${detail ? ` — ${detail}` : ""}`);
  if (!ok) failed++;
}

async function main(): Promise<void> {
  const site = await db
    .selectFrom("site")
    .select(["slug"])
    .where("status", "=", "live")
    .where("slug", "is not", null)
    .orderBy("created_at", "desc")
    .executeTakeFirst();
  if (!site?.slug) {
    console.error("⛔ ELŐFELTÉTEL: nincs élő (status=live) site slug-gal a dev DB-ben — nincs min mérni.");
    process.exit(1);
  }
  const tenantHost = `${site.slug}.${PLATFORM_DOMAIN}`;
  console.log(`guest-link-host-check — tenant host: ${tenantHost} · platform: ${PLATFORM_DOMAIN}`);

  console.log("④ predikátum");
  for (const r of MAIL_LINK_ROUTES) check(`igen: ${r.sample}`, servesOnTenantHostToo(r.sample));
  check("nem: /valami-mas", !servesOnTenantHostToo("/valami-mas"));
  check("nem: /", !servesOnTenantHostToo("/"));

  console.log("① a levél-linkek a tenant hoston a platform kezelőjét kapják");
  for (const r of MAIL_LINK_ROUTES) {
    const [t, p] = await Promise.all([rawGet(tenantHost, r.sample), rawGet(PLATFORM_DOMAIN, r.sample)]);
    const same = t.status === p.status && titleOf(t.body) === titleOf(p.body);
    check(
      `${r.who}: ${r.sample}`,
      same && !t.body.includes(TENANT_404),
      `tenant ${t.status} „${titleOf(t.body)}" · platform ${p.status} „${titleOf(p.body)}"`,
    );
  }

  console.log("② a linkelt lapok stíluslapja a tenant hoston");
  const css = await rawGet(tenantHost, "/assets/ui/citui.css");
  check("/assets/ui/citui.css → 200 text/css", css.status === 200 && /text\/css/.test(css.type), `${css.status} ${css.type}`);

  console.log("③ negatív kontroll: más út a tenant hoston marad a tenant 404-e");
  const other = await rawGet(tenantHost, "/foglalas/probe-token-000000000001/valami-mas");
  check("/foglalas/<t>/valami-mas → tenant-404", other.status === 404 && other.body.includes(TENANT_404), `${other.status}`);
  const root = await rawGet(tenantHost, "/");
  check("/ → a tenant oldala (200), nem a platform", root.status === 200 && !root.body.includes(TENANT_404), `${root.status}`);

  console.log("⑤ negatív kontroll: a hamis X-Forwarded-Host nem kerül a linkbe");
  const EVIL = "gonosz.example";
  // No consent → the review route answers with its page (backUrl = publicBaseUrl(req))
  // and stores nothing. Distinct X-Forwarded-For per request keeps the throttle out.
  const form = "name=Link-host+probe&rating=5&body=probe";
  const plain = await rawPost(tenantHost, "/api/velemeny", form, { "x-forwarded-for": "198.51.100.1" });
  check(
    "kontroll: fejléc nélkül a link a tenant hostra mutat",
    plain.body.includes(`//${tenantHost}/`),
    `${plain.status}`,
  );
  const forged = await rawPost(tenantHost, "/api/velemeny", form, {
    "x-forwarded-host": EVIL,
    "x-forwarded-for": "198.51.100.2",
  });
  check(
    `hamis X-Forwarded-Host: ${EVIL} → a link a Host-ra (${tenantHost}) mutat`,
    forged.body.includes(`//${tenantHost}/`) && !forged.body.includes(EVIL),
    forged.body.includes(EVIL) ? `a válaszban ott a hamis host (${forged.status})` : `${forged.status}`,
  );
}

try {
  await main();
} finally {
  server.close();
  await pool.end();
}
if (failed) {
  console.error(`\n⛔ guest-link-host-check: ${failed} bukás — a levelek linkjei a tenant hoston nem élnek, vagy nem a kérés hostjára mutatnak.`);
  process.exit(1);
}
console.log("\n✅ guest-link-host-check: a levelek linkjei a tenant hoston is élnek, a hostjuk a Host fejlécből jön, a többi út zárva maradt.");
process.exit(0);
