// Regression gate: an owner finds the way back to their admin from ANY of our letters and
// from every page of the password-link flow.
//
// WHAT WAS MEASURED (owner, production, 2026-10-15, [TESZT] Matróz Üdülőház): outreach → mock →
// "14 nap ingyen" → credentials letter → password set → admin → the owner CLOSED THE WINDOW and
// did not know where to log in again ("honnan tudjam a címet? sehol nem jött meg!!!!"). The
// credentials letter named the address only in a small note at the very bottom, the reset letter
// not at all; the success page redirected after 2.5 s without naming it; the used-link page only
// offered a new link; the trial reminders, billing, invoice and domain letters carried none.
//
// WHAT IT MEASURES (pure: builders and views rendered in-process, no DB, no server):
//   1. platformMail ends every letter with "Belépés a szerkesztő felületre: <login>" — HTML and
//      plain text; `ownerLogin: false` only in the allow-listed builders (no login yet / the
//      address already in the details box);
//   2. every real owner-letter builder (trial T−3/T−1, purge warning, billing, invoice, domain,
//      booking owner letters) actually renders the line;
//   3. the credentials and the reset letter: the login row stands right under „Felhasználónév”
//      in the details box, and the plain text names it before the password-setting link;
//   4. the inline owner letters (enquiry, review) use ownerLoginLine();
//   5. the password-link pages: the success page and the used-link page name the address, the
//      used-link page's first button is the login;
//   6. a PAUSED tenant site (lapsed trial, freeze) still routes /admin and /login to the login and
//      carries the owner-login line;
//   7. ADR-0402 "A" (owner, production purchase 2026-10-21: „Semmi nincs, ahol be tudnék lépni”):
//      ONE sentence — every login line is loginSentence() („Belépés: citoviso.com/login”); the
//      „Megrendelését aktiváltuk” letter carries ① the site address now ② the own-domain state
//      ③ „Belépés: … · Felhasználónév: …” (password link ONLY for a new account) ④ the next charge,
//      and the activation path sends it (no separate credentials letter after a paid order).
//
// Run:  npx tsx scripts/owner-login-mail-check.mts
//       npx tsx scripts/owner-login-mail-check.mts --self-test   (must go RED: a letter built
//         with the line switched off, and the pre-fix credentials text, are fed to the same checks)

import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";

const SELF_TEST = process.argv.includes("--self-test");
let failed = 0;
function ok(cond: boolean, label: string, detail = ""): void {
  if (!cond) failed++;
  console.log(`${cond ? "✓" : "✗ FAIL"}  ${label}${cond ? "" : `\n     ↳ ${detail}`}`);
}
const read = (p: string): string => readFileSync(path.resolve(process.cwd(), p), "utf8");

const layout = await import("../src/email/platformLayout.js");
const LOGIN = layout.tenantLoginUrl("hu");
const LABEL = layout.loginAddressLabel(LOGIN);
const LINE = layout.loginSentence("hu").label;

/** The one rule every owner letter must pass. */
function hasLoginLine(m: { html?: string; text: string }): boolean {
  const html = m.html ?? "";
  return html.includes(LINE) && html.includes(`href="${LOGIN}"`) && html.includes(LABEL) && m.text.includes(`${LINE} ${LOGIN}`);
}

/** The credentials / reset rule: the login row right under the username, early in the text. */
function loginNextToUsername(m: { html?: string; text: string }, setUrl: string): boolean {
  const html = m.html ?? "";
  const u = html.indexOf(">Felhasználónév<");
  const b = html.indexOf(">Belépés<", u);
  const rowsBetween = u >= 0 && b > u ? (html.slice(u, b).match(/<tr/g) ?? []).length : 99;
  const tUser = m.text.indexOf("Felhasználónév:");
  const tLogin = m.text.indexOf(`Belépés: ${LOGIN}`);
  const tSet = m.text.indexOf(setUrl);
  return rowsBetween === 1 && html.includes(`href="${LOGIN}"`) && tUser >= 0 && tLogin > tUser && tLogin < tSet;
}

if (SELF_TEST) {
  // ① a letter with the line switched off must fail rule 1
  const off = layout.platformMail({ to: "x@example.invalid", subject: "s", text: "t", heading: "h", blocks: [], ownerLogin: false });
  // ② the pre-fix credentials letter: the address only at the end of the text, no details row
  const SET = "https://citoviso.test/login/jelszo/abc";
  const preFix = {
    html: `<td>Felhasználónév</td><td>u</td>`,
    text: `Felhasználónév: u\n\nJelszó beállítása: ${SET}\n\nKésőbb itt léphet be: ${LOGIN}\n`,
  };
  const red1 = !hasLoginLine(off);
  const red2 = !loginNextToUsername(preFix, SET);
  console.log(`${red1 ? "✓" : "✗"}  önteszt ①: kikapcsolt sorú levél → az őr PIROS`);
  console.log(`${red2 ? "✓" : "✗"}  önteszt ②: a javítás előtti belépő-levél → az őr PIROS`);
  process.exit(red1 && red2 ? 0 : 1);
}

// ── 1. the frame ──────────────────────────────────────────────────────────────
const plain = layout.platformMail({ to: "x@example.invalid", subject: "s", text: "Szöveg.", heading: "h", blocks: [], siteName: "Napfény" });
ok(hasLoginLine(plain), "1. platformMail: a záró belépés-sor alapból ott van (HTML + szöveg)", plain.text);
const en = layout.platformMail({ to: "x@example.invalid", subject: "s", text: "t", heading: "h", blocks: [], lang: "en" });
ok((en.html ?? "").includes(`${LOGIN}?lang=en`), "1. nem magyar olvasó: a link ?lang=-et visz (a /login-nak nincs tenant-kontextusa)");

const ALLOW_OFF: Record<string, number> = { "src/email/activationEmail.ts": 1, "src/email/loginEmail.ts": 2, "src/email/orderEmail.ts": 2 };
const offFound: Record<string, number> = {};
function walk(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
    e.isDirectory() ? walk(path.join(dir, e.name)) : e.name.endsWith(".ts") ? [path.join(dir, e.name)] : [],
  );
}
for (const f of walk("src")) {
  const n = (read(f).match(/ownerLogin:\s*false/g) ?? []).length;
  if (n) offFound[f] = n;
}
ok(JSON.stringify(offFound) === JSON.stringify(ALLOW_OFF), "1. `ownerLogin: false` csak az engedélyezett levelekben (belépő-levelek, aktiváló levél, fizetés előtti rendelés)", JSON.stringify(offFound));

// ── 2. the real owner-letter builders ─────────────────────────────────────────
const trial = await import("../src/email/trialEmail.js");
const billing = await import("../src/email/billingEmail.js");
const invoice = await import("../src/email/invoiceEmail.js");
const domain = await import("../src/email/domainEmail.js");
const builders: Array<[string, unknown]> = [];
// Each builder gets a permissive sample input; a builder whose input shape changed throws, and the
// throw is a FAIL (the gate must keep seeing every letter, not silently skip one).
const S = {
  to: "x@example.invalid", lang: "hu", siteName: "Napfény Vendégház", businessName: "Napfény Vendégház",
  buyerName: "Kovács Anna", buyerIsPerson: true, untilIso: "2026-10-22", daysLeft: 3, purgeIso: "2027-01-20",
  continueUrl: "https://citoviso.test/p/t/folytatas", payUrl: "https://citoviso.test/pay/x", siteUrl: "https://napfeny.citoviso.test/",
  adminUrl: "https://citoviso.test/admin", amount: 14900, currency: "HUF", dueIso: "2026-11-01", chargeIso: "2026-11-01",
  invoiceNumber: "CITO-2026-1", domain: "napfeny.hu", coupon: null, period: "monthly", billingPeriod: "monthly",
  attempt: 1, freezeIso: "2026-11-05", closeIso: "2026-12-05", endIso: "2026-11-30", cardLast4: "4242",
};
const pick = (mod: Record<string, unknown>): void => {
  for (const [k, v] of Object.entries(mod)) if (/^build[A-Z]\w*Email$/.test(k) && typeof v === "function") builders.push([k, v]);
};
pick(trial as Record<string, unknown>);
pick(billing as Record<string, unknown>);
pick(invoice as Record<string, unknown>);
pick(domain as Record<string, unknown>);
let rendered = 0;
for (const [name, fn] of builders) {
  let msg: { html?: string; text: string } | null = null;
  try {
    msg = (fn as (i: unknown) => { html?: string; text: string })(S);
  } catch {
    msg = null;
  }
  if (!msg || typeof msg.text !== "string") continue; // shape mismatch — judged statically below
  rendered++;
  ok(hasLoginLine(msg), `2. ${name}: a belépés-sor ott van`, msg.text.slice(-200));
}
ok(rendered >= 8, `2. legalább 8 szállásadói levél ténylegesen renderelve (${rendered}/${builders.length})`);
// Every builder of these files goes through platformMail (the frame carries the line) — statically.
for (const f of ["src/email/trialEmail.ts", "src/email/billingEmail.ts", "src/email/invoiceEmail.ts", "src/email/domainEmail.ts"]) {
  const src = read(f);
  ok(src.includes("platformMail(") && !/ownerLogin:\s*false/.test(src), `2. ${f}: minden levele a platform-kereten át megy, kikapcsolás nélkül`);
}
const req = read("src/booking/requests.ts");
ok((req.match(/platformMail\(/g) ?? []).length >= 2 && !/ownerLogin:\s*false/.test(req), "2. foglalási tulaj-levelek (requests.ts): platform-keret, kikapcsolás nélkül");

// ── 3. the credentials and the reset letter ───────────────────────────────────
const { buildCredentialsEmail, buildPasswordResetEmail } = await import("../src/email/loginEmail.js");
const SET = "https://citoviso.test/login/jelszo/abc";
const cred = buildCredentialsEmail({ to: "x@example.invalid", username: "teszt-matroz", setPasswordUrl: SET, loginUrl: LOGIN, siteName: "Matróz Üdülőház", lang: "hu" });
ok(loginNextToUsername(cred, SET), "3. „Belépési adatai”: a belépő cím a Felhasználónév alatti sorban + a szövegben a link előtt", cred.text);
const credTrial = buildCredentialsEmail({ to: "x@example.invalid", username: "teszt-matroz", setPasswordUrl: SET, loginUrl: LOGIN, siteName: "Matróz Üdülőház", lang: "hu", trial: { untilIso: "2026-10-29", coupon: null } });
ok(loginNextToUsername(credTrial, SET), "3. próbás „Belépési adatai”: ugyanígy");
const reset = buildPasswordResetEmail({ to: "x@example.invalid", username: "teszt-matroz", setPasswordUrl: SET, loginUrl: LOGIN, siteName: "Matróz Üdülőház", lang: "hu" });
ok(loginNextToUsername(reset, SET), "3. „Új jelszó beállítása”: felhasználónév + belépő cím", reset.text);
const credSrc = read("src/tenant/credentials.ts");
ok((credSrc.match(/loginUrl: tenantLoginUrl\(lang\)/g) ?? []).length === 1 && credSrc.includes("const loginUrl = tenantLoginUrl(lang)"), "3. mindkét küldő a közös tenantLoginUrl()-t adja át");

// ── 4. inline owner letters ───────────────────────────────────────────────────
for (const f of ["src/booking/enquiry.ts", "src/reviews/reviews.ts"]) {
  const src = read(f);
  ok((src.match(/ownerLoginLine\(lang\)\.(text|html)/g) ?? []).length >= 2, `4. ${f}: a belépés-sor a szövegben és a HTML-ben`);
}

// ── 5. the password-link pages ────────────────────────────────────────────────
const views = await import("../src/server/adminViews.js");
const done = views.passwordSetDonePage("hu", true, "teszt-matroz");
ok(done.includes("data-login-address") && done.includes(LABEL) && done.includes("teszt-matroz"), "5. siker-lap: felhasználónév + belépő cím");
const delay = Number(/setTimeout\(function\(\)\{location\.replace\("\/admin"\)\},(\d+)\)/.exec(done)?.[1] ?? 0);
ok(delay >= 6000, `5. siker-lap: van idő elolvasni a címet (${delay} ms ≥ 6000)`);
const dead = views.passwordLinkDeadPage("hu");
const firstBtn = /class="citui-btn[^"]*" href="([^"]+)"/.exec(dead)?.[1];
ok(dead.includes(LABEL) && firstBtn === LOGIN, "5. felhasznált/lejárt link lapja: kimondja a címet, az első gomb a belépés", String(firstBtn));
const form = views.setPasswordPage({ token: "t".repeat(30), username: "teszt-matroz", siteName: "Matróz" }, "hu");
ok(form.includes(LABEL), "5. jelszó-beállító űrlap: megnevezi a későbbi belépés címét");

// ── 6. the paused tenant site ─────────────────────────────────────────────────
const pub = read("src/server/public.ts");
const susp = pub.indexOf('if (site.status === "suspended") {');
const seg = susp >= 0 ? pub.slice(susp, pub.indexOf("return;", pub.indexOf("suspendedPage(site.tenantId", susp)) + 7) : "";
ok(/pathname === "\/admin" \|\| pathname === "\/login"[\s\S]*?TENANT_LOGIN_URL[\s\S]*?statusCode = 503/.test(seg), "6. szünetelő oldal: /admin és /login a belépésre visz, nem a 503-ba");
ok(seg.includes("injectOwnerLogin(await suspendedPage("), "6. szünetelő oldal: a tulajdonosi belépés-sor rajta van");

// ── 7. one sentence + the activation letter (ADR-0402 "A") ────────────────────
ok(LINE === "Belépés:" && layout.loginSentence("hu").text === `Belépés: ${LOGIN}`, "7. egy mondat: loginSentence() = „Belépés: citoviso.com/login”", LINE);
const plSrc = read("src/email/platformLayout.ts");
ok(!plSrc.includes('"Belépés a szerkesztő felületre:"'), "7. a régi „Belépés a szerkesztő felületre:” felirat nincs többé a keretben");
const act = await import("../src/email/activationEmail.js");
const base = {
  to: "x@example.invalid", lang: "hu", siteName: "Napfény Vendégház", buyerName: "Kovács Anna", buyerIsPerson: true,
  siteUrl: "https://napfeny.citoviso.com", username: "napfeny-vendeghaz",
  renewal: { date: "2026-11-21", amount: 7000, period: "monthly" as const },
};
const actNew = act.buildActivationEmail({ ...base, domain: { domain: "napfeny.hu", live: false }, setPasswordUrl: SET });
const actOld = act.buildActivationEmail({ ...base, domain: null, setPasswordUrl: null });
const t1 = actNew.text;
const at = (s: string): number => t1.indexOf(s);
ok(actNew.subject === "Megrendelését aktiváltuk — Napfény Vendégház", "7. tárgy: „Megrendelését aktiváltuk — {site}”", actNew.subject);
ok(at("https://napfeny.citoviso.com") >= 0 && at("napfeny.hu: beszerzés alatt") > at("https://napfeny.citoviso.com") &&
  at(`Belépés: ${LOGIN} · Felhasználónév: napfeny-vendeghaz`) > at("napfeny.hu: beszerzés alatt") &&
  at("Következő terhelés:") > at("Belépés:"), "7. aktiváló levél: ① cím → ② domain → ③ belépés + felhasználónév → ④ következő terhelés", t1);
ok(t1.includes("7 000 Ft") && t1.includes("2026. 11. 21."), "7. aktiváló levél: a következő terhelés összege és napja", t1);
ok(t1.includes(SET) && (actNew.html ?? "").includes(`href="${SET}"`), "7. új fiók: jelszó-beállító link a levélben");
ok(!actOld.text.includes("/login/jelszo/") && actOld.text.includes("A jelszava nem változott.") && !actOld.text.includes("beszerzés alatt"),
  "7. meglévő fiók: nincs link, „A jelszava nem változott.”; domain nélkül a sor elmarad", actOld.text);
const actLive = act.buildActivationEmail({ ...base, siteUrl: "https://napfeny.hu", domain: { domain: "napfeny.hu", live: true }, setPasswordUrl: null });
ok(actLive.text.includes("A honlapja ezen a címen él: napfeny.hu"), "7. élő saját domain: a cím, nem a „beszerzés alatt”");
ok(!actNew.text.trimEnd().endsWith(`Belépés: ${LOGIN}`) && (actNew.text.match(/Belépés: /g) ?? []).length === 1, "7. aktiváló levél: a belépés EGYSZER szerepel (a záró sor ki)");
const svc = read("src/payment/service.ts");
ok(/if \(activated\) await sendActivationMail\(payment\.order_intent_id/.test(svc) && !svc.includes("issueAndSendTenantLogin("),
  "7. a fizetés-aktiválás az aktiváló levelet küldi (nem külön belépő-levelet)");
const views7 = read("src/console/views.ts");
ok(views7.includes("domainStateText(lang, info.domain)"), "7. a fizetés utáni oldal ugyanazt a domain-mondatot mondja");

console.log(failed ? `\n✗ owner-login-mail-check: ${failed} hiba` : "\n✓ owner-login-mail-check: zöld");
process.exit(failed ? 1 : 0);
