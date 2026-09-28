// Kapu — a süti-sáv a tenant-admin TARTALMÁNAK műveleteit sem takarhatja (ADR-0145 ④ utószál).
//
// ⛔ KIVÁLTÓ, MÉRVE (éjszakai kör, 2026-09-28, 390×844): a sáv a bejelentkezett adminban
// 125 px magas, a 660–784 sávban ül — és a képernyők LEGALSÓ művelete (Megközelítés
// „Mentés és frissítés", Vélemények / Foglalás / Árak „Beállítások mentése", a Modulok
// fül többnyelvű „Fizetés és generálás"-a) SOHA nem volt kigörgethető alóla: a lap vége
// pont a sáv mögé esett. A meglévő `consent-style-check` csak a FÜL-SÁVOT mérte (ADR-0145
// ④), a tartalmat nem — a rés a vakfoltjában ült.
//
// Amit mér, a legtöbb modult birtokló bérlő MINDEN aktív modul-képernyőjén + a fő füleken,
// telefon- és asztali szélességen, a VALÓDI sávval (a futtató publikálja a mért magasságát):
//  ① a lap aljára görgetve egyetlen látható művelet (gomb / gomb-link / submit) sem esik a
//     sáv alá (`elementFromPoint` a gomb közepén);
//  ② `scrollIntoView({block:"nearest"})` után sem — a mobil böngésző a fókuszált mezőt és
//     az ugró horgonyt is így hozza be;
//  ③ az alsó ragadó/rögzített rétegek (fotó-tömeges sáv, toast, többnyelvű ár-sáv) doboza
//     nem metszi a sávot, amikor látszanak.
// ⚠️ Smooth-scroll kikapcsolva a mérés idejére: a `scroll-behavior:smooth` mellett a
// `scrollTo` aszinkron, és a mérés a görgetés ELŐTTI állapotot olvasná (mérve: y=0).
//
// Futtatás: npx tsx scripts/consent-admin-actions-check.mts [--self-test]
//   --self-test → a helyfoglalást visszarontja (a javítás előtti CSS), tehát PIROS kell.

process.env.PUBLIC_PORT = "0";
process.env.CIT_SHOT = "1";

import { once } from "node:events";
import { chromium, type Browser } from "playwright-core";

const SELF_TEST = process.argv.includes("--self-test");

const { server } = await import("../src/server/public.js");
const { mintTenantCookieValue } = await import("../src/auth/tenantAuth.js");
const { db } = await import("../src/db/client.js");
const { config } = await import("../src/config.js");
const { PLATFORM_DOMAIN } = await import("../src/domains.js");
const { MODULE_CONFIG_REGISTRY } = await import("../src/moduleConfig.js");

let failed = 0;
const check = (ok: boolean, what: string, detail = ""): void => {
  if (ok) console.log(`  ✓ ${what}`);
  else {
    failed++;
    console.error(`  ✗ ${what}${detail ? `\n     ↳ ${detail}` : ""}`);
  }
};

if (!/^BP-[A-Za-z0-9]{6,20}-[A-Za-z0-9]{1,4}$/.test(config.barionPixelId)) {
  console.error("⛔ BARION_PIXEL_ID nincs — a sáv meg sem jelenik, az őr nem tud mérni. Ez NEM zöld.");
  server.close();
  await db.destroy();
  process.exit(1);
}
if (!server.listening) await once(server, "listening");
const PORT = (server.address() as { port: number }).port;

// Az alany NEVESÍTETT szabállyal (ADR-0252: nem a közös DB vak „első sora"): a site-tal
// bíró bérlők közül az, amelyiknek a LEGTÖBB aktív modulja van — minél több képernyő, annál
// kevesebb vakfolt. Döntetlennél az azonosító dönt, hogy két futás ugyanazt mérje.
const subject = await db
  .selectFrom("tenant_user")
  .innerJoin("site", "site.tenant_id", "tenant_user.tenant_id")
  .innerJoin("module_entitlement as e", "e.tenant_id", "tenant_user.tenant_id")
  .select(["tenant_user.id as id", "site.slug as slug", (eb) => eb.fn.count<string>("e.module").as("n")])
  .where("e.active", "=", true)
  .groupBy(["tenant_user.id", "site.slug"])
  .orderBy("n", "desc")
  .orderBy("tenant_user.id", "asc")
  .limit(1)
  .executeTakeFirst();
if (!subject) {
  console.error("⛔ ELŐFELTÉTEL: nincs site-tal és aktív modullal bíró tenant-fiók a dev DB-ben — a mérés ÜRES volna.");
  server.close();
  await db.destroy();
  process.exit(1);
}
const active = await db
  .selectFrom("module_entitlement as e")
  .innerJoin("tenant_user as tu", "tu.tenant_id", "e.tenant_id")
  .select("e.module")
  .where("tu.id", "=", subject.id)
  .where("e.active", "=", true)
  .execute();
const moduleScreens = active
  .map((r) => r.module)
  .filter((id) => id in MODULE_CONFIG_REGISTRY)
  .sort()
  .map((id) => `/admin?tab=modulok&m=${id}`);
const paths = ["/admin", "/admin?tab=modulok", "/admin?tab=fotok", "/admin?tab=fiok", ...moduleScreens];
console.log(`alany: ${subject.slug} (${subject.n} aktív modul) · ${paths.length} képernyő`);

// The pre-fix reservation, re-imposed: the content's bottom padding without the bar's
// height, no scroll-padding, and the bottom layers at their old offsets.
const BROKEN_CSS =
  "html{scroll-padding-bottom:0!important}" +
  ".adm-main__inner{padding-bottom:32px!important}" +
  ".adm-toast{bottom:18px!important}" +
  "@media(max-width:899px){.adm-main__inner{padding-bottom:calc(28px + var(--citui-admin-bottomnav-h))!important}" +
  ".adm-toast{bottom:calc(18px + var(--citui-admin-bottomnav-h))!important}}";

const browser: Browser = await chromium.launch({
  args: [`--host-resolver-rules=MAP ${PLATFORM_DOMAIN} 127.0.0.1`],
});
const VIEWPORTS = [
  { label: "telefon 390", width: 390, height: 844, mobile: true },
  { label: "asztali 1280", width: 1280, height: 900, mobile: false },
];

let total = 0;
try {
  for (const vp of VIEWPORTS) {
    console.log(`\n── ${vp.label}`);
    for (const p of paths) {
      const ctx = await browser.newContext({
        viewport: { width: vp.width, height: vp.height },
        isMobile: vp.mobile,
        hasTouch: vp.mobile,
      });
      await ctx.addCookies([
        { name: "cit_session", value: mintTenantCookieValue(subject.id), domain: PLATFORM_DOMAIN, path: "/" },
      ]);
      const page = await ctx.newPage();
      await page.addInitScript("window.__name = (f) => f;");
      const resp = await page.goto(`http://${PLATFORM_DOMAIN}:${PORT}${p}`, { waitUntil: "load" });
      if (SELF_TEST) await page.addStyleTag({ content: BROKEN_CSS });
      await page.waitForTimeout(400);
      const r = await page.evaluate(() => {
        document.documentElement.style.scrollBehavior = "auto";
        document.body.style.scrollBehavior = "auto";
        const bar = document.getElementById("cit-consent");
        if (!bar) return null;
        const br = bar.getBoundingClientRect();
        const underBar = (el: Element): boolean => {
          const q = el.getBoundingClientRect();
          const hit = document.elementFromPoint(q.left + q.width / 2, q.top + q.height / 2);
          return !!hit && (hit === bar || bar.contains(hit));
        };
        const label = (el: HTMLElement): string =>
          ((el.textContent || (el as HTMLInputElement).value || el.getAttribute("aria-label") || el.tagName).trim().replace(/\s+/g, " ").slice(0, 32));
        // Visible actions of the page content. Closed <details>, the popover layer and the
        // module shop's summary bar (another thread's surface) are not in the flow here.
        const acts = (Array.from(
          document.querySelectorAll(".adm-main button, .adm-main a.citui-btn, .adm-main input[type=submit]"),
        ) as HTMLElement[]).filter(
          (b) =>
            b.getBoundingClientRect().height > 0 &&
            getComputedStyle(b).visibility !== "hidden" &&
            !b.closest("#adm-planbar, .rs-modal, details:not([open]), .gm-style"),
        );
        window.scrollTo(0, document.documentElement.scrollHeight);
        const atEnd = acts.filter((b) => underBar(b)).map(label);
        const nearest: string[] = [];
        for (const b of acts) {
          b.scrollIntoView({ block: "nearest" });
          if (underBar(b)) nearest.push(label(b));
        }
        // The bottom layers, forced visible where they exist on this screen.
        const layers: string[] = [];
        for (const sel of [".adm-bulk", ".adm-toast", ".adm-mlbar", ".adm-cartpill"]) {
          const el = document.querySelector(sel) as HTMLElement | null;
          if (!el) continue;
          el.hidden = false;
          // ⚠️ The toast MOVES in (transition on transform): read with transitions off and in
          // its real shown state (`.on`), or the rect is the pre-animation one (measured).
          el.style.transition = "none";
          el.classList.add("on");
          el.style.display = "flex";
          el.style.minHeight = "20px";
          window.scrollTo(0, 0);
          const q = el.getBoundingClientRect();
          const cs = getComputedStyle(el);
          if (cs.position === "sticky" || cs.position === "fixed") {
            if (q.height > 0 && q.bottom > br.top && q.top < br.bottom) layers.push(`${sel} ${Math.round(q.top)}–${Math.round(q.bottom)}`);
          }
        }
        // ④ The phone cart sheet (modules-cart, ADR-0255): opened, scrolled to its end, its
        // own actions (the pay button above all) must not sit under the bar.
        const sheet: string[] = [];
        const pb = document.getElementById("adm-planbar") as HTMLElement | null;
        if (pb && getComputedStyle(document.documentElement).getPropertyValue("--citui-admin-bottomnav-h").trim() !== "") {
          pb.hidden = false;
          pb.classList.add("show", "open");
          if (getComputedStyle(pb).position === "fixed") {
            pb.scrollTop = pb.scrollHeight;
            for (const b of Array.from(pb.querySelectorAll("button, a.citui-btn")) as HTMLElement[]) {
              if (b.getBoundingClientRect().height > 0 && underBar(b)) sheet.push(label(b));
            }
          }
          pb.classList.remove("open");
        }
        return { bar: [Math.round(br.top), Math.round(br.bottom)], n: acts.length, atEnd, nearest, layers, sheet };
      });
      const tag = `${p}`;
      check((resp?.status() ?? 0) < 400, `${tag}: a lap betöltött`, `HTTP ${resp?.status()}`);
      if (!r) {
        check(false, `${tag}: a süti-sáv MEGJELENT (enélkül az állítás üres)`);
      } else {
        total += r.n;
        if (r.n === 0) console.log(`  ⚠️  ${tag}: ezen a képernyőn nincs látható művelet — ①② itt ÜRES (hangosan kihagyva)`);
        check(r.atEnd.length === 0, `${tag}: ① a lap aljára görgetve a sáv egyetlen műveletet sem takar`, `takarva: ${r.atEnd.join(" · ")} (sáv ${r.bar.join("–")})`);
        check(r.nearest.length === 0, `${tag}: ② behozva (scrollIntoView nearest) sem esik a sáv alá`, `takarva: ${r.nearest.join(" · ")}`);
        check(r.sheet.length === 0, `${tag}: ④ a telefonos kosár-lap gombjai sem esnek a sáv alá`, `takarva: ${r.sheet.join(" · ")}`);
        check(r.layers.length === 0, `${tag}: ③ az alsó ragadó rétegek nem metszik a sávot`, r.layers.join(" · "));
      }
      await ctx.close();
    }
  }
  check(total > 0, `a kontroll nem üres: összesen ${total} művelet mérve`);
} finally {
  await browser.close();
  server.close();
  await db.destroy();
}

if (failed) {
  console.error(`\n⛔ consent-admin-actions-check: ${failed} bukás`);
  process.exit(1);
}
console.log("\n✅ consent-admin-actions-check: a süti-sáv a tenant-admin egyetlen műveletét sem takarja.");
