// Őr: a `.hu` Nyilvántartó megerősítő-figyelője (tulaj-rendelet 2026-09-09).
//
// A figyelő EGY dolgot ígér: ha megerősítő link érkezik, a tulaj SMS-t és e-mailt kap,
// és a gép NEM nyúl a kódhoz. Ez az őr azt méri, amitől ez az ígéret igaz vagy hamis —
// hálózat és postafiók nélkül, a tiszta függvényeken.
//
// A negatív esetek a MÉRT valóságból jönnek, nem a fantáziámból:
//   · a 2026-09-06-i levél `Fwd:`-ként, `info@minerallog.hu`-ról érkezett → feladóra
//     szűrni hibás; a horgony a LINK. Ezt külön eset pinne le.
//   · a levéltestben a quoted-printable sortörés KETTÉVÁGJA az URL-t → e nélkül a
//     detektor pont az éles alakon bukna el.
//
// Usage: npx tsx scripts/registry-confirm-check.mts

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const HERE = dirname(fileURLToPath(import.meta.url));
const SRC = resolve(HERE, "..", "src/domains/registryConfirmWatch.ts");
const src = readFileSync(SRC, "utf8");

let failed = 0;
const say = (ok: boolean, what: string, detail = ""): void => {
  if (ok) console.log(`✅ ${what}`);
  else {
    failed++;
    console.error(`❌ ${what}${detail ? `\n     ${detail}` : ""}`);
  }
};

// ── 1. A LINK-detektor a valódi alakokon. ────────────────────────────────────
// ⚠️ A SZÁLLÍTOTT függvényt hívjuk, nem a szabály másolatát: egy külön regex a
// tesztben pár hónap múlva már mást mérne, mint ami élesben fut.
const { extractConfirmLinks, processFindings } = await import(
  "../src/domains/registryConfirmWatch.js"
);
const TOKEN = "eca582367ceed9da2a40f5a56252f25564d4f9c7e08266187482f1aee7abe978";
const hits = (s: string): string[] => extractConfirmLinks(s).map((f) => f.token);

console.log("── Link-detektor ─────────────────────────────────────────────────");
say(
  hits(`Kérjük kattintson: https://cfm.drr.hu/hu/confirmations/${TOKEN}`)[0] === TOKEN,
  "a magyar nyelvű link felismerve",
);
say(
  hits(`https://cfm.drr.hu/en/confirmations/${TOKEN}`)[0] === TOKEN,
  "az angol nyelvű változat UGYANAZT a tokent adja (nem duplázza a riasztást)",
);
// Ez a kettő EGY levélben érkezik (mérve) — dedup nélkül két SMS menne ki.
const both = new Set(
  hits(`hu: https://cfm.drr.hu/hu/confirmations/${TOKEN} en: https://cfm.drr.hu/en/confirmations/${TOKEN}`),
);
say(both.size === 1, "egy levélben lévő hu+en link EGYETLEN riasztás (a token a kulcs)");

// Quoted-printable: a valódi levéltestben a hosszú URL sortörést kap.
say(
  hits(`https://cfm.drr.hu/hu/confir=\r\nmations/${TOKEN}`)[0] === TOKEN,
  "a quoted-printable sortöréssel KETTÉVÁGOTT URL is felismerhető",
);
say(
  [...`https://cfm.drr.hu/hu/confir=\r\nmations/${TOKEN}`.matchAll(
    /https:\/\/cfm\.drr\.hu\/(?:hu|en)\/confirmations\/([0-9a-f]{16,})/gi,
  )].length === 0,
  "önteszt: a QP-feloldás NÉLKÜL tényleg nem találná meg (a lépés nem dísz)",
);

say(hits("https://cfm.drr.hu/hu/confirmations/rovid").length === 0, "túl rövid token NEM link");
say(hits("https://hamis.example/hu/confirmations/" + TOKEN).length === 0, "idegen hoszt NEM link");
say(hits("Tisztelt Ügyfelünk! Köszönjük a megrendelést.").length === 0, "link nélküli levél nem riaszt");

// ── 2. A DÖNTÉS: kap-e a tulaj értesítést? ───────────────────────────────────
//
// Injektált riasztóval, hogy a kapu SOSE küldjön valódi SMS-t/levelet — de az
// ígéretet (nem a szerkezetet) mérje. A pair-repair őre ugyanezt csinálja.
console.log("\n── Riasztás-döntés (injektált küldővel) ──────────────────────────");
const LINK = `https://cfm.drr.hu/hu/confirmations/${TOKEN}`;
const NEW: { token: string; link: string; mailAt: string }[] = [
  { token: TOKEN, link: LINK, mailAt: "09-Sep-2026 08:00:00 +0000" },
];

// (a) Első futás: üres állapot → BEJEGYEZ, de NEM riaszt.
let sent: string[] = [];
const spy = async (l: string): Promise<boolean> => {
  sent.push(l);
  return true;
};
let st: Record<string, unknown> = {};
let msg = await processFindings(NEW, st as never, "2026-09-09T08:00:00Z", spy);
say(sent.length === 0, "első futás: NEM riaszt a már ott lévő (régi) linkre");
say(Boolean((st as Record<string, unknown>)[TOKEN]), "első futás: azért BEJEGYZI (különben később hamis riasztás lenne)");
say(/BEJEGYEZVE/.test(msg), "első futás: a napló KIMONDJA, hogy szándékosan hallgatott");

// (b) Már nem első futás + ÚJ token → riaszt, pontosan egyszer.
sent = [];
st = { valamiRegi: { mailAt: "", seenAt: "", notified: true } };
msg = await processFindings(NEW, st as never, "2026-09-09T08:00:00Z", spy);
say(sent.length === 1, "ÚJ link → PONTOSAN egy riasztás", `kapott: ${sent.length}`);
say(sent[0] === LINK, "a riasztás a VALÓDI linket viszi (a tulaj erre kattint)");
say(/1 ÚJ megerősítő link, 1 riasztás/.test(msg), "a napló megmondja, hány riasztás ment ki");

// (c) Ugyanaz a token újra (a timer 2 percenként fut) → NEM riaszt megint.
sent = [];
msg = await processFindings(NEW, st as never, "2026-09-09T08:02:00Z", spy);
say(sent.length === 0, "⭐⭐ ugyanaz a link 2 perc múlva NEM riaszt újra (nem SMS-bombázza a tulajt)");

// (d) Ha a riasztás BUKIK, az állapot ne állítsa, hogy értesítettünk.
sent = [];
st = { valamiRegi: { mailAt: "", seenAt: "", notified: true } };
await processFindings(NEW, st as never, "2026-09-09T08:00:00Z", async () => false);
say(
  (st as Record<string, { notified: boolean }>)[TOKEN]?.notified === false,
  "sikertelen riasztás NEM íródik sikerként (nincs néma elnyelés)",
);

// ── 3. Szerkezeti garanciák a forráson. ──────────────────────────────────────
console.log("\n── Szerkezeti garanciák ──────────────────────────────────────────");
say(
  /EXAMINE INBOX/.test(src) && !/\bSELECT INBOX\b/.test(src),
  "a postafiók CSAK-OLVASÓ módban nyílik (EXAMINE, nem SELECT)",
  "SELECT-tel a figyelő flageket írhatna a tulaj saját postafiókjában",
);
say(/BODY\.PEEK/.test(src) && !/BODY\[TEXT\]/.test(src), "BODY.PEEK — a levelek nem lesznek olvasottá jelölve");
// ⚠️ A KÓDON mérünk, nem a prózán: a modul kommentje SZÁNDÉKOSAN leírja a 09-06-i
// Playwright-bukást, és az első változatom ezen a saját mondatán bukott el. Egy
// szó-illesztés a kommentekben ugyanazt a hibát követi el, mint a §C-kapu, ami az
// URL-t üzenetnek olvasta: a leírás nem a viselkedés.
const code = src.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/^\s*\/\/.*$/gm, " ");
say(
  !/(page\.goto|browser|chromium|firefox|webkit|\bfetch\s*\(|axios|got\s*\()/i.test(code),
  "⭐⭐ a gép SEHOL nem nyitja meg a megerősítő linket (tulaj-döntés: a kód az övé)",
  "ez a modul LÉNYEGE — ha ez pirosra vált, valaki visszatette a gépi kattintást",
);
// Önteszt: a detektor tud pirosra menni (különben örökre zöld dísz lenne).
say(
  /(page\.goto|browser|chromium|\bfetch\s*\()/i.test(`${code}\nawait page.goto(link);`),
  "önteszt: a kattintás-detektor egy visszacsempészett `page.goto(link)`-et ELKAP",
);
say(
  /SEARCH SINCE/.test(src) && /TEXT "cfm\.drr\.hu"/.test(src),
  "a keresés a LINKRE horgonyoz, nem a feladóra (a mért levél Fwd: volt, minerallog-ról)",
);
say(/firstRun/.test(src) && /riasztás nélkül/.test(src), "az első futás BEJEGYEZ, nem riaszt (régi linkre nem küldünk SMS-t)");
say(/mailAt/.test(src) && /seenAt/.test(src), "időbélyeget rögzít (ez dönti el: időkorlátos-e a kód vagy egyszeri)");

// A hívó oldala: a postafiók-hiba nem boríthatja a domain-léptetést.
const caller = readFileSync(resolve(HERE, "resume-domains.mts"), "utf8");
say(
  /try\s*\{[\s\S]*watchRegistryConfirmations[\s\S]*\}\s*catch/.test(caller),
  "a figyelő try/catch-ben fut — postafiók-hiba nem állítja meg a beszerzést",
);
say(
  caller.indexOf("resumePendingDomainProvisionings") < caller.indexOf("watchRegistryConfirmations"),
  "a domain-léptetés ELŐBB fut, csak utána a postafiók",
);

if (failed) {
  console.error(`\n⛔ ${failed} ellenőrzés bukott — a megerősítés-figyelő ígérete sérült.`);
  process.exit(1);
}
console.log("\n✅ registry-confirm-check: a detektor a valódi alakokon fog, a postafiók csak olvasódik, és a gép nem kattint.");
