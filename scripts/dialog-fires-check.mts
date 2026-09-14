// A MEGERŐSÍTŐ KÉRDÉS TÉNYLEG LEFUT-E — MINDEN NYELVI CSOMAGON, A RENDERELT KIMENETEN.
//
//   npx tsx scripts/dialog-fires-check.mts
//   npx tsx scripts/dialog-fires-check.mts --selftest   (piros önteszt)
//
// ⛔⛔ MIÉRT LÉTEZIK (mérve 2026-09-14, tulajdonosi kiemeléssel):
//   A konzol „jóváhagyott mock törlése" gombja `onsubmit="return confirm('…')"`-mel védte a
//   visszafordíthatatlan törlést — de a szöveg `jsStr()` NÉLKÜL ment az egyszeres idézőjelbe.
//   A MAGYAR forrásban nincs aposztróf, A FORDÍTÁSBAN VAN:
//       en: „It hasn't been sent yet"   ·   it: „l'operazione è irreversibile"
//   Mindkét nyelven a kezelő SyntaxError lett → a `confirm()` SOHA nem futott le → a törlés
//   MEGERŐSÍTÉS NÉLKÜL ment a szerverre. Valódi böngészőben mérve a javítás előtt:
//       hu: dialógus=1, megállítva · en: dialógus=0, JS-hiba=1, ELMEGY · it: ugyanaz.
//   A tulaj szava: „ez adatvesztés-kockázat… az őröd MINDEN nyelvi csomagra, a RENDERELT
//   kimeneten mérje, hogy a dialógus tényleg lefut-e, piros önteszttel."
//
// ⚠️ Miért nem elég a forrás-grep vagy a szintaxis-elemzés: a hiba a FORDÍTÁS tartalmától
// függ, az pedig DB-ben él és AI-generált (`language_pack.status='generated'`). Egy kód-szintű
// „van-e jsStr()" minta ráadásul zöld maradna ott, ahol a szöveg ma véletlenül aposztróf-mentes
// — ezért az őr ① a VALÓDI csomagokat rendereli, ÉS ② egy szándékosan ellenséges ál-csomagot,
// amely MINDEN feliratba beleteszi az `'`, `"`, `\` hármast. A ② az, ami a LAPPANGÓ helyeket
// fogja meg: ott a mai zöld szerencse, nem garancia.
//
// Amit állít, felületenként és nyelvenként:
//   ① VÉDETT vezérlő: a kattintás PONTOSAN EGY dialógust vált ki, és ha a dialógust
//      elutasítjuk, a művelet MEGÁLL (űrlapnál `defaultPrevented`, gombnál: a mellékhatás
//      nem történt meg). Nulla dialógus = a védelem néma kikapcsolása.
//   ② SIMA kezelő (nincs megerősítés, de van inline JS): a kattintás NEM dob JS-hibát, és a
//      kezelő hatása bekövetkezik (a felirat átvált).
//   ③ FEDETTSÉG: a mérés nem lehet üresen igaz — a futásnak el kell érnie a kitűzött
//      vezérlő-darabszámot MINDEN nyelven, különben az őr magát jelenti be vaknak.
//
// Piros önteszt (`--selftest`): a renderelt lapon VISSZAÍRJA a régi, escape-eletlen kezelőt
// (a nyers fordítást teszi az egyszeres idézőjelbe).
// ⚠️ Amit az önteszt PONTOSAN bizonyít (ne állítsunk többet nála): mérve 9 bukás, és NEM
// „valahol", hanem MEGNEVEZETT halmazon — piros `en`, `it` és `zz`, ZÖLD `hu`, `de`, `hr`,
// `pl`, `sk`. A kétirányú elvárás a lényeg: a pirosnak ott kell lennie, ahol a fordítás
// aposztrófot tartalmaz, és ott NEM lehet, ahol nem — ez bizonyítja, hogy a mérés a
// FORDÍTÁS TARTALMÁTÓL függ, nem attól, hogy „elrontottunk valamit". A bukás-sorok
// `elmenne: true`-t írnak: a törlés tényleg elment volna a szerverre.
//
// ⚠️ KÉT CSAPDA, AMIBE EZ AZ ŐR ELŐSZÖR BELESÉTÁLT (a javítás a kódban van, a tanulság itt):
//   ① ÜRESEN IGAZ ÁLLÍTÁS. Az első változat csak azt mérte, hogy a beküldés „megállt-e".
//      A küldő-sáv viszont LETILTJA a gombokat, amíg a `#cit-letter-end` be nem jött a
//      nézetbe — a kattintás így el sem indította a submitot, és a „megállt" ZÖLD lett
//      NULLA dialógus mellett is. Ezért van külön állítás arra, hogy a beküldés TÉNYLEG
//      ELINDULT, és ezért görget az őr a levél végéig.
//   ② A SZELEKTOR VÁDOLTA A TERMÉKET. A lapon három vágólap-gomb van (tárgy · SMS-szöveg ·
//      levéltörzs); a `.first()` a TÁRGY gombját fogta, ami szándékosan nem kérdez — az őr
//      mind a 8 nyelven „hibát" jelentett egy ép felületre. A cél most `#mailbody`.

process.env.CIT_SHOT = "1"; // no boot self-heal, no AI calls, no DB writes

import { chromium, type Browser, type Page } from "playwright-core";

import { config } from "../src/config.js";
import { db } from "../src/db/client.js";
import { installPack, tSync } from "../src/i18n/packs.js";
import { leadPage, outreachDraftPage } from "../src/console/views.js";
import { runWithConsoleLang, setConsoleLang } from "../src/console/i18nCtx.js";
import type { LeadDetail, ProspectView } from "../src/console/data.js";

const selftest = process.argv.includes("--selftest");

let failures = 0;
function check(name: string, ok: boolean, detail?: unknown): boolean {
  if (ok) console.log(`    ✓ ${name}`);
  else {
    failures++;
    console.error(`    ✗ ${name}${detail === undefined ? "" : ` — ${JSON.stringify(detail)}`}`);
  }
  return ok;
}

/* ── nyelvi csomagok ───────────────────────────────────────────────────────
 * A VALÓDI csomagok a DB-ből. Hungarian is measured (it is the source language and
 * the one that worked — without it the guard could not show the contrast). */

const packRows = await db.selectFrom("language_pack").select(["lang", "strings"]).execute();
for (const r of packRows) installPack(r.lang, r.strings as Record<string, string>);
const realLangs = ["hu", ...packRows.map((r) => r.lang).sort()];
if (packRows.length === 0) {
  console.error("⛔ egyetlen nyelvi csomag sincs a DB-ben — az őr nem tudja mérni, amiért készült.");
  process.exit(1);
}

/**
 * ELLENSÉGES ál-csomag. Nem fordítás: minden felirat elé betűzi azt a három karaktert,
 * amely egy inline kezelőt el tud törni (`'`, `"`, `\`). Ami ezt túléli, az azért éli túl,
 * mert ESCAPE-ELVE van — nem azért, mert a mai fordítás véletlenül szelíd.
 */
const ADV = "zz";
{
  const strings: Record<string, string> = {};
  for (const r of packRows) {
    for (const hu of Object.keys(r.strings as Record<string, string>)) {
      strings[hu] = `'"\\ ${hu}`;
    }
  }
  installPack(ADV, strings);
}
const LANGS = [...realLangs, ADV];

/* ── fixtures ──────────────────────────────────────────────────────────────
 * Minden mező kiírva: a `scripts/` NINCS típus-ellenőrizve (tsconfig include: src/**),
 * ezért egy `as ProspectView` annotáció NEM véd a hiányzó mezőtől — a fedettség-állítás
 * (③) az, ami tényleg bizonyítja, hogy a vezérlők ott vannak. */

const ARTIFACT = {
  id: "aaaa1111-2222-3333-4444-555555555555",
  status: "approved",
  generatedAt: "2026-09-14T09:00:00.000Z",
  path: "/tmp/a.html",
  inputs: {},
  decisions: [],
} as unknown as LeadDetail["artifacts"][number];

const PROSPECT = {
  id: "bbbb1111-2222-3333-4444-555555555555",
  token: "TOKEN0123456789",
  segment: "szállás",
  contactEmail: "ellenorzes@example.test",
  status: "created",
  sentAt: null,
  emailSentAt: null,
  smsSentAt: null,
  mmsSentAt: null,
  unsubscribedAt: null,
  createdAt: "2026-09-14T08:00:00.000Z",
  artifactId: ARTIFACT.id,
  views: 0,
  events: 0,
  optoutLog: [],
} as unknown as ProspectView;

const LEAD = {
  id: "11111111-2222-3333-4444-555555555555",
  name: "Őr-teszt Vendégház",
  qualification: null,
  lifecycle: "new",
  matchConfidence: 0.9,
  address: "Teszt utca 1.",
  region: "teszt",
  raw: {},
  provenance: [],
  artifacts: [ARTIFACT],
  heroScores: {},
} as unknown as LeadDetail;

const DRAFT = {
  subject: "Elkészült az Őr-teszt Vendégház látványterve",
  body: "Jó napot! Készítettünk egy előzetes látványtervet…",
  link: "https://citoviso.com/p/or-teszt/TOKEN0123456789",
};

function channel(emailSentAt: string | null) {
  return {
    sms: { text: "Őr-teszt Vendégház – látványterv: …" },
    phone: "+36301200971",
    emailSentAt,
    emailAddressMailed: false,
    smsSentAt: null,
    mmsSentAt: null,
    pairJob: null,
    smsBlockedReason: null,
    mmsPreview: { kind: "ready", path: "/tmp/hero.jpg" } as never,
  };
}

type SurfaceId = "lead" | "draft" | "draftSent";

function render(surface: SurfaceId, lang: string): string {
  return runWithConsoleLang(() => {
    setConsoleLang(lang);
    if (surface === "lead") return leadPage(LEAD, { running: false }, null, [], [], [PROSPECT]);
    const sent = surface === "draftSent" ? "2026-09-14T07:00:00.000Z" : null;
    return outreachDraftPage(
      PROSPECT.id,
      { leadName: LEAD.name as string, segment: "szállás" },
      DRAFT,
      { verdict: "PASS", reasons: [] },
      PROSPECT.contactEmail,
      null,
      channel(sent),
      LEAD.id as string,
    );
  });
}

/* ── a régi, escape-eletlen kezelő visszaírása (piros önteszt) ─────────────
 * Ugyanaz az alak, ami 2026-09-14 előtt élt: a NYERS fordítás az egyszeres idézőjelben. */

const DEL_HU = "Biztosan törlöd ezt a jóváhagyott mockot? Még nem küldtük ki, a művelet nem vonható vissza.";

function regress(html: string, lang: string): string {
  const raw = tSync(lang, DEL_HU);
  return html.replace(
    /(<form method="post" action="[^"]*\/delete"[^>]*onsubmit=")[^"]*(")/,
    `$1return confirm('${raw}')$2`,
  );
}

/* ── vezérlők ──────────────────────────────────────────────────────────────
 * `guarded` = megerősítés nélkül nem történhet meg · `plain` = nincs kérdés, de van
 * inline JS, aminek le kell futnia. A `effect` a mellékhatás mérőszáma (gomboknál). */

interface Target {
  readonly surface: SurfaceId;
  readonly what: string;
  readonly sel: string;
  readonly kind: "guarded" | "plain";
  /** Gombnál: a kezelő hatása a feliratban látszik; űrlapnál a submit a hatás. */
  readonly effectIsLabel?: boolean;
}

const TARGETS: readonly Target[] = [
  { surface: "lead", what: "jóváhagyott mock törlése", sel: 'form[action$="/delete"] button[type=submit]', kind: "guarded" },
  { surface: "lead", what: "kiküldöttnek jelölés (lezárja az e-mail csatornát)", sel: 'form[action$="/sent"] button[type=submit]', kind: "guarded" },
  { surface: "lead", what: "követett link másolása", sel: 'button[onclick*="clipboard"]', kind: "plain", effectIsLabel: true },
  { surface: "draft", what: "e-mail kiküldése", sel: 'form[action$="/send"] button[type=submit]', kind: "guarded" },
  { surface: "draft", what: "MMS+SMS páros indítása", sel: 'form[action$="/send-pair"] button[type=submit]', kind: "guarded" },
  { surface: "draft", what: "indítás MINDKÉT csatornán", sel: 'form[action$="/send-all"] button[type=submit]', kind: "guarded" },
  // ⚠️ A levél TÖRZSÉNEK gombjára kell célozni (`#mailbody`), nem az első vágólap-gombra:
  // a lapon HÁROM vágólap-gomb van (tárgy · SMS-szöveg · levéltörzs), és az első változatom
  // `.first()`-tel a TÁRGY gombját mérte — az nem kérdez, tehát az őr a TERMÉKET vádolta
  // volna a saját szelektoráért, mind a 8 nyelven. A tárgy/SMS másolása szándékosan nincs
  // megerősítve: a MÁSODIK PÉLDÁNY kockázata a levél szövegéhez tapad, nem a tárgysorhoz.
  { surface: "draft", what: "levél szövegének másolása (még nem ment ki)", sel: 'button[onclick*="mailbody"]', kind: "plain", effectIsLabel: true },
  { surface: "draftSent", what: "MÁR KIMENT levél szövegének másolása", sel: 'button[onclick*="mailbody"]', kind: "guarded", effectIsLabel: true },
];

/* ── mérés ─────────────────────────────────────────────────────────────────── */

interface Outcome {
  readonly found: boolean;
  readonly dialogs: number;
  readonly pageErrors: readonly string[];
  /** Elindult-e EGYÁLTALÁN a beküldés (különben a „megállt" üresen igaz lenne). */
  readonly submitFired: boolean | null;
  /** Űrlapnál: a dialógus elutasítása után is elindult volna a beküldés? */
  readonly wouldProceed: boolean | null;
  /** Gombnál: megváltozott-e a felirat (a kezelő hatása). */
  readonly labelChanged: boolean | null;
}

async function measure(page: Page, t: Target): Promise<Outcome> {
  const errs: string[] = [];
  let dialogs = 0;
  const onErr = (e: Error): void => void errs.push(e.message);
  const onDlg = async (d: { dismiss: () => Promise<void> }): Promise<void> => {
    dialogs++;
    await d.dismiss(); // MINDIG „Mégsem" — a művelet nem történhet meg
  };
  page.on("pageerror", onErr);
  page.on("dialog", onDlg as never);

  const el = page.locator(t.sel).first();
  if ((await el.count()) === 0) {
    page.off("pageerror", onErr);
    page.off("dialog", onDlg as never);
    return { found: false, dialogs: 0, pageErrors: errs, submitFired: null, wouldProceed: null, labelChanged: null };
  }

  const before = t.effectIsLabel ? await el.innerText() : "";
  const result = await page.evaluate((sel) => {
    const node = document.querySelector(sel) as HTMLElement | null;
    if (!node) return { proceed: null as boolean | null };
    const form = node.closest("form");
    if (!form) {
      node.click();
      return { proceed: null as boolean | null, fired: null as boolean | null, disabled: false };
    }
    let proceed = false;
    let fired = false;
    form.addEventListener("submit", (e) => {
      // Az `onsubmit` ATTRIBÚTUM-kezelő korábban regisztrált listener, tehát ELŐBB fut.
      // Ha `false`-t adott vissza, a böngésző ekkorra MÁR törölte a default-ot.
      fired = true;
      proceed = !e.defaultPrevented;
      e.preventDefault(); // a mérés SOHA nem navigál
    });
    const disabled = (node as HTMLButtonElement).disabled;
    (node as HTMLButtonElement).click();
    return { proceed, fired, disabled };
  }, t.sel);
  await page.waitForTimeout(80);
  const after = t.effectIsLabel ? await el.innerText() : "";

  page.off("pageerror", onErr);
  page.off("dialog", onDlg as never);
  return {
    found: true,
    dialogs,
    pageErrors: errs,
    submitFired: result.fired,
    wouldProceed: result.proceed,
    labelChanged: t.effectIsLabel ? before !== after : null,
  };
}

async function runLang(browser: Browser, lang: string): Promise<number> {
  const label = lang === ADV ? `${ADV} (ellenséges ál-csomag)` : lang;
  console.log(`\n── nyelv: ${label}${selftest ? "  [RÉGI KEZELŐ — bukást várunk]" : ""}`);
  let measured = 0;

  for (const surface of ["lead", "draft", "draftSent"] as const) {
    const targets = TARGETS.filter((t) => t.surface === surface);
    if (!targets.length) continue;
    let html = render(surface, lang);
    if (selftest) html = regress(html, lang);

    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    await page.setContent(`<!doctype html><html lang="hu"><meta charset="utf-8">${html}`, {
      waitUntil: "domcontentloaded",
    });
    // A vágólap nem-biztonságos kontextusban nem létezik; az őr a KEZELŐT méri, nem a
    // böngésző jogosultság-modelljét. (addInitScript-tel NEM ült le: a setContent utáni
    // dokumentumban `navigator.clipboard` továbbra is undefined volt — mérve.)
    // ⚠️ SZTRINGKÉNT átadva: a tsx/esbuild `keepNames` egy `__name` segédhívást fűz a
    // névhez jutó nyílfüggvényekhez, az pedig a lapon nem létezik („__name is not
    // defined" — mérve). A sztring-alak érintetlenül jut a böngészőbe.
    await page.evaluate(
      "Object.defineProperty(navigator,'clipboard',{value:{writeText:function(){return Promise.resolve();}},configurable:true})",
    );
    // ⛔ A küldő-sáv KAPUJA (ADR: „amíg a levél végét nem láttad, a küldés zárva"):
    // a gombok `disabled`-ek, amíg a `#cit-letter-end` be nem jött a nézetbe. Ez VALÓDI,
    // szándékos viselkedés — az őrnek a KINYITOTT állapotot kell mérnie, különben egy
    // letiltott gombon mérne „nem kérdez"-t, és a terméket vádolná a saját vakságáért.
    const end = page.locator("#cit-letter-end");
    if ((await end.count()) > 0) {
      await end.evaluate((el) => el.scrollIntoView());
      await page.waitForTimeout(250);
    }

    for (const t of targets) {
      const o = await measure(page, t);
      if (!check(`[${surface}] ${t.what}: a vezérlő a lapon van`, o.found)) continue;
      measured++;
      check(`[${surface}] ${t.what}: nincs JS-hiba a kezelőben`, o.pageErrors.length === 0, o.pageErrors);
      if (t.kind === "guarded") {
        check(`[${surface}] ${t.what}: a kattintás MEGKÉRDEZ (dialógus)`, o.dialogs === 1, { dialogs: o.dialogs });
        if (o.submitFired !== null) {
          // ⛔ EZ AZ ÁLLÍTÁS NEM HAGYHATÓ EL. Az első változatom csak azt mérte, hogy a
          // beküldés „megállt-e" — a küldő-sáv viszont LETILTJA a gombot, amíg a levél
          // végét nem láttad, ezért a kattintás el sem indította a submitot, és a
          // „megállt" ÜRESEN IGAZ lett (0 dialógus mellett is zöld).
          check(`[${surface}] ${t.what}: a beküldés tényleg elindult (nem üres mérés)`, o.submitFired === true);
          check(`[${surface}] ${t.what}: elutasítva MEGÁLL`, o.wouldProceed === false, { elmenne: o.wouldProceed });
        } else {
          check(`[${surface}] ${t.what}: elutasítva a hatás elmarad`, o.labelChanged === false, {
            felirat_valtozott: o.labelChanged,
          });
        }
      } else {
        check(`[${surface}] ${t.what}: nem kérdez (nincs mit megerősíteni)`, o.dialogs === 0, { dialogs: o.dialogs });
        check(`[${surface}] ${t.what}: a kezelő hatása bekövetkezik`, o.labelChanged === true);
      }
    }
    await ctx.close();
  }
  return measured;
}

/* ── futás ─────────────────────────────────────────────────────────────────── */

console.log(
  `\nMEGERŐSÍTÉS-ŐR — tényleg lefut-e a kérdés${selftest ? "  [ÖNTESZT: a régi kezelővel BUKNIA KELL]" : ""}` +
    `\nnyelvek: ${LANGS.join(", ")}  ·  vezérlők/nyelv: ${TARGETS.length}`,
);

const browser = await chromium.launch({ executablePath: config.chromiumPath });
const perLang: Record<string, number> = {};
const redIn: string[] = [];
for (const lang of LANGS) {
  const before = failures;
  perLang[lang] = await runLang(browser, lang);
  if (failures > before) redIn.push(lang);
}
await browser.close();

// ③ FEDETTSÉG: a mérés nem lehet üresen igaz.
console.log(`\n── fedettség`);
for (const lang of LANGS) {
  check(
    `${lang}: mind a ${TARGETS.length} vezérlő mérve`,
    perLang[lang] === TARGETS.length,
    { mert: perLang[lang], vart: TARGETS.length },
  );
}

console.log("");
if (selftest) {
  // ⛔ NEM ELÉG, hogy „valahol piros". A visszarontás egy MEGNEVEZHETŐ halmazon kell,
  // hogy bukjon: azokon a nyelveken, ahol a fordítás tényleg tartalmaz aposztrófot,
  // plusz az ellenséges ál-csomagon. Egy „bukott valahol" önteszt egy JÖVŐBELI,
  // teljesen más okból keletkező piroson is zöldet mondana magára.
  const MUST_BE_RED = ["en", "it", ADV];
  const missing = MUST_BE_RED.filter((l) => !redIn.includes(l));
  // És AMELYIKEN NINCS aposztróf, ott ZÖLDNEK kell maradnia — ez bizonyítja, hogy a
  // mérés a FORDÍTÁS TARTALMÁTÓL függ, nem attól, hogy „visszarontottunk valamit".
  const MUST_STAY_GREEN = ["hu", "de", "hr", "pl", "sk"];
  const wrongRed = MUST_STAY_GREEN.filter((l) => redIn.includes(l));
  if (failures > 0 && missing.length === 0 && wrongRed.length === 0) {
    console.log(
      `✅ ÖNTESZT RENDBEN — a régi kezelővel ${failures} mérés bukott, pontosan a várt nyelveken.\n` +
        `   piros: ${redIn.join(", ")}  ·  zöld (a fordításban nincs aposztróf): ${MUST_STAY_GREEN.join(", ")}`,
    );
    process.exit(0);
  }
  console.error(
    "⛔ ÖNTESZT BUKOTT — a visszarontás nem ott (vagy nem csak ott) ment pirosra, ahol kell.\n" +
      `   pirosnak kellett volna, de zöld maradt: ${missing.join(", ") || "—"}\n` +
      `   zöldnek kellett volna, de piros: ${wrongRed.join(", ") || "—"}\n` +
      `   összes bukás: ${failures}`,
  );
  process.exit(1);
}
if (failures > 0) {
  console.error(`⛔ ${failures} mérés bukott — van olyan nyelv, ahol a megerősítés nem fut le.`);
  process.exit(1);
}
console.log(`✅ minden védett művelet megkérdez, minden nyelven (${LANGS.length} csomag)`);
process.exit(0);
