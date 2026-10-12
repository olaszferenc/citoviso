// EDGE-ROUTING ŐR — a dev-útválasztás = az éles nginx (ADR-0366, Elek 10-11 B1).
//
//   npx tsx scripts/edge-routing-check.mts
//   npx tsx scripts/edge-routing-check.mts --selftest   (csak ①–②, DB és szerver nélkül)
//
// ⛔⛔ MIÉRT (mérve 2026-10-11, Elek). A lead saját előnézeti aldomainjén (ADR-0330) nyitott
// terv-lap konfigurátora relatív `/configure/<id>/domains|domain-check|subdomain` címet hív.
// Élesen az nginx ezt a konzolra küldi (ADR-0212), dev-ben viszont nincs nginx: a public
// szerver kapta, 404-et adott, a domain-választó halott volt, és a rendelés csendben az
// ingyenes címre esett. A repóban egyetlen állítás volt az útválasztásról — egy komment a
// public.ts-ben („/p/ → konzol, a többi → public”), és az HIÁNYOS volt.
//
// MIT MÉR:
//   ① az éles nginx OLVASOTT másolata (deploy/nginx/citoviso.conf) és a kódbeli tábla
//      (src/server/edgeRoutes.ts — CONSOLE_EDGE_PREFIXES) UGYANAZT a konzol-előtag-halmazt
//      mondja; a `location /` a publicra megy; az admin-host egésze a konzolra.
//   ② a konfigurátor MINDEN szerver-hívása (a manifest `/configure/${artifactId}/…` címei)
//      konzol-előtagra esik — egy új végpont, amit az nginx nem visz a konzolra, PIROS.
//   ③ ÉLŐ MÉRÉS a valódi public és konzol szerveren (in-process, efemer port, saját fixtúra):
//      az előnézeti hoston a konzol-előtagú kérés UGYANAZT a választ adja, mint a konzol
//      közvetlenül (GET /configure/…/subdomain, GET /configure/…/domains, POST
//      /configure/…/request) — a régi kódon itt 404 jött (a mutáció-próba ezt PIROSnak mérte).
//      Kontroll: egy nem-konzol út (/aszf) a publicon marad.
process.env.CIT_SHOT = "1";
process.env.PUBLIC_PORT = "0";
process.env.CONSOLE_PORT = "0";
// The probes reach the domain suggester and the order route: everything outbound is mock.
process.env.EMAIL_PROVIDER = "mock";
process.env.SMS_PROVIDER = "mock";
process.env.MMS_PROVIDER = "mock";
process.env.PAYMENT_GATEWAY = "mock";
process.env.REGISTRAR_PROVIDER = "mock";
process.env.DNS_PROVIDER = "mock";

import http from "node:http";
import { once } from "node:events";
import { readFile } from "node:fs/promises";
import { randomBytes } from "node:crypto";

const SELFTEST = process.argv.includes("--selftest");
let failed = 0;
function check(label: string, ok: boolean, detail = ""): void {
  console.log(`  ${ok ? "✅" : "⛔"} ${label}${detail ? ` — ${detail}` : ""}`);
  if (!ok) failed++;
}

const { CONSOLE_EDGE_PREFIXES, routesToConsole } = await import("../src/server/edgeRoutes.js");

// ── ① nginx-másolat ↔ kód-tábla ──────────────────────────────────────────────
/** `location <prefix> { … proxy_pass http://127.0.0.1:<port>; … }` → prefix → port. */
function locations(conf: string): Map<string, number> {
  const out = new Map<string, number>();
  const re = /location\s+(\S+)\s*\{([^}]*)\}/g;
  for (let m = re.exec(conf); m; m = re.exec(conf)) {
    const port = /proxy_pass\s+http:\/\/127\.0\.0\.1:(\d+)/.exec(m[2]!);
    if (port) out.set(m[1]!, Number(port[1]));
  }
  return out;
}
const main = await readFile(new URL("../deploy/nginx/citoviso.conf", import.meta.url), "utf8");
const admin = await readFile(new URL("../deploy/nginx/citoviso-admin.conf", import.meta.url), "utf8");
const locs = locations(main);
const nginxConsole = [...locs].filter(([, p]) => p === 4600).map(([l]) => l).sort();
const codeConsole = [...CONSOLE_EDGE_PREFIXES].sort();
check(
  "① az nginx konzol-előtagjai = CONSOLE_EDGE_PREFIXES",
  JSON.stringify(nginxConsole) === JSON.stringify(codeConsole),
  `nginx: ${nginxConsole.join(" ")} · kód: ${codeConsole.join(" ")}`,
);
check("① az nginx `location /` a publicra (4800) megy", locs.get("/") === 4800, String(locs.get("/")));
check(
  "① minden más location a konzolra vagy a publicra mutat (nincs ismeretlen cél)",
  [...locs.values()].every((p) => p === 4600 || p === 4800),
  JSON.stringify([...locs]),
);
check(
  "① a blokk a lead-aldomaineket is fedi (*.citoviso.com) — ADR-0330 hostja",
  /server_name[^;]*\*\.citoviso\.com/.test(main),
);
check("① az admin-host egésze a konzolra megy", locations(admin).get("/") === 4600);
// Negative controls of the predicate itself — a matcher that says "console" to everything is blind.
check("① kontroll: /configure/x/domains → konzol", routesToConsole("/configure/x/domains"));
check("① kontroll: /aszf → public", !routesToConsole("/aszf"));
check("① kontroll: / → public", !routesToConsole("/"));

// ── ② a konfigurátor hívásai konzol-előtagra esnek ───────────────────────────
{
  const src = await readFile(new URL("../src/generator/configurator.ts", import.meta.url), "utf8");
  const urls = [...src.matchAll(/`(\/[a-z]+\/\$\{artifactId\}\/[a-z-]+)`/g)].map((m) => m[1]!);
  check("② a konfigurátor manifestjében vannak szerver-hívások (a felismerő nem vak)", urls.length >= 4, urls.join(" "));
  for (const u of urls) check(`② ${u} → konzol`, routesToConsole(u.replace("${artifactId}", "x")));
}

if (SELFTEST) {
  console.log(failed ? `\n⛔ edge-routing-check --selftest: ${failed} bukás` : "\n✅ edge-routing-check --selftest: rendben");
  process.exit(failed ? 1 : 0);
}

// ── ③ élő mérés: előnézeti host → konzol ─────────────────────────────────────
const { server: pub } = (await import("../src/server/public.js")) as { server: http.Server };
const { server: con } = (await import("../src/console/server.js")) as { server: http.Server };
const { db, pool } = await import("../src/db/client.js");
const { sql } = await import("kysely");
for (const s of [pub, con]) if (!s.listening) await once(s, "listening");
const portOf = (s: http.Server): number => (s.address() as { port: number }).port;
// The public server's forwarder reads this at call time — the console's REAL ephemeral port.
process.env.CONSOLE_PORT = String(portOf(con));

interface Reply { status: number; body: string }
function call(server: http.Server, host: string, method: "GET" | "POST", path: string, body = ""): Promise<Reply> {
  return new Promise((resolve, reject) => {
    const req = http.request(
      {
        host: "127.0.0.1",
        port: portOf(server),
        path,
        method,
        headers: {
          Host: host,
          ...(method === "POST" ? { "content-type": "application/json", "content-length": String(Buffer.byteLength(body)) } : {}),
        },
      },
      (res) => {
        const chunks: Buffer[] = [];
        res.on("data", (c: Buffer) => chunks.push(c));
        res.on("end", () => resolve({ status: res.statusCode ?? 0, body: Buffer.concat(chunks).toString("utf8") }));
      },
    );
    req.on("error", reject);
    req.end(method === "POST" ? body : undefined);
  });
}

const { createFixtureParent } = await import("./lib/fixture-parent.mts");
const parent = await createFixtureParent(db as never, "edgeroute");
try {
  const stamp = `${Date.now().toString(36)}${randomBytes(2).toString("hex")}`;
  const label = `edgechk${stamp}`;
  const lead = await db
    .insertInto("lead")
    .values({ scrape_run_id: parent.runId, name: "Edge-őr teszt", raw: sql`'{}'::jsonb`, preview_label: label } as never)
    .returning("id")
    .executeTakeFirstOrThrow();
  const art = await db
    .insertInto("mock_artifact")
    .values({ lead_id: lead.id, path: "/nonexistent/edge-check.html", status: "approved", inputs: sql`'{}'::jsonb` } as never)
    .returning("id")
    .executeTakeFirstOrThrow();
  await db
    .insertInto("prospect")
    .values({ lead_id: lead.id, token: randomBytes(18).toString("base64url"), mock_artifact_id: art.id } as never)
    .execute();

  const previewHost = `${label}.citoviso.com`;
  const probes: { method: "GET" | "POST"; path: string; body?: string }[] = [
    { method: "GET", path: `/configure/${art.id}/subdomain?label=${label}x` },
    { method: "GET", path: `/configure/${art.id}/domains` },
    // A refused order (no photo-rights tick): a console-only, distinctive JSON answer, no write.
    { method: "POST", path: `/configure/${art.id}/request`, body: JSON.stringify({ modules: [] }) },
  ];
  for (const p of probes) {
    const viaPreview = await call(pub, previewHost, p.method, p.path, p.body);
    const direct = await call(con, previewHost, p.method, p.path, p.body);
    check(
      `③ ${p.method} ${p.path.replace(art.id, "<id>").split("?")[0]} az előnézeti hoston = a konzol válasza`,
      viaPreview.status === direct.status && viaPreview.body === direct.body && viaPreview.status !== 404,
      `előnézeti host: ${viaPreview.status} · konzol: ${direct.status} · ${viaPreview.body.slice(0, 80).replace(/\s+/g, " ")}`,
    );
  }
  const aszf = await call(pub, previewHost, "GET", "/aszf");
  check("③ kontroll: /aszf az előnézeti hoston a publicon marad (200)", aszf.status === 200, String(aszf.status));
} finally {
  await parent.drop();
  pub.close();
  con.close();
  await pool.end();
}

console.log(failed ? `\n⛔ edge-routing-check: ${failed} bukás` : "\n✅ edge-routing-check: a dev-útválasztás = az éles nginx");
process.exit(failed ? 1 : 0);
