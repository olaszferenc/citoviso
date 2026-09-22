// ⭐⭐ REFINE-DÖNTÉSI SOR — a javaslat, ami túléli a review lezárását.
//
// A MÉRT LELET (2026-09-19). A desztilláló háromféle javaslatot ad. A PROMOTE ÚJ tudást tesz
// hozzá, azt a gép átvezeti. A **REFINE a MÁR MEGLÉVŐ kanonikus szöveget írná át** — ez a
// legkockázatosabb művelet, ezért SOHA nem automatikus (04-INDEX, ADR): mindig ember dönt.
//
// ⛔ CSAKHOGY SENKI NEM DÖNTÖTT, ÉS A JAVASLAT NEM IS VÁRT MEG. A `distill-apply.mts`
// `listReviews()`-a kiszűr minden review-t, aminek a bélyege az `_inbox/applied/`-ban van —
// MÉG AZELŐTT, hogy a tartalom-alapú idempotencia egyáltalán lefutna. PROMOTE-nál ez helyes
// (azokat átvezették). REFINE-nál végzetes: **a review lezárása MAGA az a művelet, ami a
// javaslatot örökre eltemeti.** Mérve: 24 REFINE-blokk állt így, elérhetetlenül — miközben a
// kód egy kommentben pont az ellenkezőjét ígéri („the proposal must come back, not vanish
// silently"). Az ígéret a még PÁROSÍTATLAN review-kra igaz; a lezártakra nem.
//
// ⚠️ A NYERSANYAG NEM VESZETT EL: az `_inbox/applied/*.md` COMMITOLT, a javaslatok ott ülnek
// a gitben. Ami törött volt: semmi nem hozta őket többé elő. Ez a szerszám hozza.
//
// ── A SZERKEZET: SZÁRMAZTATOTT SOR, NEM MÁSOLT LISTA ─────────────────────────────────────
// A sor nem egy fájl, amibe a javaslatok szövegét bemásoljuk (az két igazságot adna, és
// elcsúszna a forrástól). A sor SZÁMÍTOTT:
//     nyitott = MINDEN REFINE-javaslat (inbox ∪ applied)  −  amiről EMBER már döntött
// Az egyetlen új tartós állapot a DÖNTÉS — `REFINE-DECISIONS.md`, commitolt, ember-olvasható.
// A javaslat szövege és mai státusza mindig frissen mérve jön (`collectRefineProposals`).
//
// ⛔ A GÉP SOHA NEM ZÁR LE TÉTELT. Nincs „elavult, ezért kidobom" ág: a néma elnyelés pont az
// a hibaosztály, ami ezt a szerszámot szükségessé tette. Lezárni csak ember tud, és **az
// indoklás KÖTELEZŐ** — indoklás nélküli lezárás hiba, nem alapértelmezés.
//
//   npx tsx _planning/DOMAIN/_tools/refine-queue.mts                      # a nyitott sor
//   npx tsx … refine-queue.mts --close <id> --reason "<miért>"            # elvetés
//   npx tsx … refine-queue.mts --accept <id> --reason "<hol vezetted át>" # elfogadás
//   npx tsx … refine-queue.mts --close-stale --reason "<miért>"           # a NEM TALÁLHATÓ-k

import fs from "node:fs";
import path from "node:path";

import { collectRefineProposals, type RefineProposal } from "./distill-apply.mts";

const REPO = path.resolve(import.meta.dirname, "../../..");
const DOMAIN = path.join(REPO, "_planning/DOMAIN");
const DECISIONS = path.join(DOMAIN, "_tools/REFINE-DECISIONS.md");

/** A review-k KÉT helyen ülhetnek; a lezártakat SZÁNDÉKOSAN is olvassuk (ez a lényeg). */
function reviewDirs(domainDir: string): string[] {
  return [path.join(domainDir, "_inbox"), path.join(domainDir, "_inbox/applied")];
}

export type DecisionKind = "elfogadva" | "elvetve";

export interface Decision {
  readonly id: string;
  readonly kind: DecisionKind;
  readonly date: string;
  readonly reason: string;
}

const LINE = /^- `([0-9a-f]{8,})`\s+·\s+(elfogadva|elvetve)\s+·\s+(\d{4}-\d{2}-\d{2})\s+·\s+(.+)$/;

export function readDecisions(file: string): Map<string, Decision> {
  const out = new Map<string, Decision>();
  if (!fs.existsSync(file)) return out;
  for (const line of fs.readFileSync(file, "utf8").split("\n")) {
    const m = LINE.exec(line.trim());
    if (!m) continue;
    out.set(m[1], { id: m[1], kind: m[2] as DecisionKind, date: m[3], reason: m[4].trim() });
  }
  return out;
}

export interface RefineQueue {
  readonly all: readonly RefineProposal[];
  readonly open: readonly RefineProposal[];
  readonly decisions: ReadonlyMap<string, Decision>;
  /** Döntés olyan azonosítóra, ami ma egyetlen javaslatban sem szerepel — gyanús, kimondjuk. */
  readonly orphanDecisions: readonly string[];
}

export function loadRefineQueue(domainDir = DOMAIN, decisionsFile = DECISIONS): RefineQueue {
  const all = collectRefineProposals(domainDir, reviewDirs(domainDir));
  const decisions = readDecisions(decisionsFile);
  const ids = new Set(all.map((p) => p.id));
  return {
    all,
    open: all.filter((p) => !decisions.has(p.id)),
    decisions,
    orphanDecisions: [...decisions.keys()].filter((id) => !ids.has(id)),
  };
}

const LABEL: Record<string, string> = {
  LIVE: "🔴 ÉLŐ — a szöveg ma is szó szerint így áll, a javaslat ÉRVÉNYES",
  REFORMATTED: "🟡 ÁTFOGALMAZOTT — a mondat megvan, a formája változott",
  STALE: "⚪ NEM TALÁLHATÓ — a szó szerinti idézet nincs meg (valószínűleg elavult)",
  AMBIGUOUS: "🟠 TÖBBSZÖR IS SZEREPEL — nem egyértelmű, melyikre vonatkozik",
  "NO-TARGET": "⚫ NINCS CÉLFÁJL — a javaslat nem nevez meg DOMAIN-fájlt",
  ELLIPSIZED: "⚫ CSONKÍTOTT IDÉZET — három ponttal rövidítve, gépileg mérhetetlen",
  UNPARSEABLE: "⚫ NEM OLVASHATÓ — nincs kiolvasható OLD: idézet",
};
const ORDER = ["LIVE", "REFORMATTED", "AMBIGUOUS", "STALE", "NO-TARGET", "ELLIPSIZED", "UNPARSEABLE"];

function list(q: RefineQueue): void {
  console.log(`REFINE-döntési sor — ${q.all.length} javaslat összesen, ${q.open.length} NYITOTT, ${q.decisions.size} eldöntve\n`);
  if (q.open.length === 0) {
    console.log("✅ Nincs nyitott REFINE-döntés.");
  }
  for (const st of ORDER) {
    const items = q.open.filter((p) => p.status === st);
    if (!items.length) continue;
    console.log(`── ${LABEL[st] ?? st} (${items.length}) ${"─".repeat(Math.max(0, 40 - st.length))}`);
    for (const p of items) {
      console.log(`  \`${p.id}\`  ${p.target ?? "—"}`);
      console.log(`      ${p.heading.replace(/^#+\s*/, "").slice(0, 100)}`);
      if (p.why) console.log(`      miért: ${p.why.slice(0, 120)}`);
    }
    console.log("");
  }
  if (q.orphanDecisions.length) {
    console.log(
      `⚠️ ${q.orphanDecisions.length} döntés olyan azonosítóra szól, ami ma egyetlen javaslatban ` +
        `sem szerepel (a review szövege változhatott): ${q.orphanDecisions.join(", ")}`,
    );
  }
  console.log(
    "Lezárás (az indoklás KÖTELEZŐ):\n" +
      "  npx tsx _planning/DOMAIN/_tools/refine-queue.mts --close <id> --reason \"<miért vetjük el>\"\n" +
      "  npx tsx _planning/DOMAIN/_tools/refine-queue.mts --accept <id> --reason \"<hol vezetted át>\"",
  );
}

function appendDecisions(file: string, rows: Decision[]): void {
  if (!fs.existsSync(file)) {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(
      file,
      [
        "# REFINE — emberi döntések nyilvántartása",
        "",
        "A desztilláló REFINE-javaslatai a KANONIKUS szöveg átírását kérnék — ezt a gép SOHA nem",
        "vezeti át automatikusan. Ez a fájl azt tartja nyilván, MIRŐL DÖNTÖTT MÁR EMBER.",
        "",
        "⛔ A gép csak HOZZÁFŰZ; törölni/átírni sort nem fog. Amiről nincs itt sor, az NYITOTT —",
        "és a heti értesítő emlékeztet rá. A javaslatok szövege nincs ide másolva: a forrás az",
        "`_inbox/applied/*.md` (commitolt), a mai státuszt a `refine-queue.mts` frissen méri.",
        "",
        "Formátum: `- \\`<azonosító>\\` · elfogadva|elvetve · ÉÉÉÉ-HH-NN · <indoklás>`",
        "",
      ].join("\n"),
    );
  }
  fs.appendFileSync(
    file,
    rows.map((d) => `- \`${d.id}\` · ${d.kind} · ${d.date} · ${d.reason}\n`).join(""),
  );
}

function main(): number {
  const argv = process.argv.slice(2);
  let close: string | null = null;
  let accept: string | null = null;
  let reason: string | null = null;
  let closeStale = false;
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--list") continue;
    else if (a === "--close") close = argv[++i] ?? null;
    else if (a === "--accept") accept = argv[++i] ?? null;
    else if (a === "--reason") reason = argv[++i] ?? null;
    else if (a === "--close-stale") closeStale = true;
    else {
      // Fail-closed: egy elgépelt kapcsoló NEM csúszhat át néma listázásba.
      console.error(`⛔ ismeretlen kapcsoló: ${a}`);
      return 2;
    }
  }

  const q = loadRefineQueue();
  const today = new Date().toISOString().slice(0, 10);

  if (!close && !accept && !closeStale) {
    list(q);
    return 0;
  }

  // ⛔ AZ INDOKLÁS KÖTELEZŐ. Egy indoklás nélküli lezárás ugyanaz a néma elnyelés, ami ellen
  // ez az egész szerszám íródott — csak most emberi kézzel.
  if (!reason || !reason.trim()) {
    console.error("⛔ a --reason KÖTELEZŐ: indoklás nélkül nem zárunk le javaslatot.");
    return 2;
  }

  let rows: Decision[] = [];
  if (closeStale) {
    const stale = q.open.filter((p) => p.status === "STALE");
    if (!stale.length) {
      console.log("Nincs nyitott NEM TALÁLHATÓ tétel.");
      return 0;
    }
    rows = stale.map((p) => ({ id: p.id, kind: "elvetve" as const, date: today, reason: reason!.trim() }));
  } else {
    const id = (close ?? accept)!;
    const hit = q.all.find((p) => p.id === id || p.id.startsWith(id));
    if (!hit) {
      console.error(`⛔ nincs ilyen javaslat: ${id}`);
      return 1;
    }
    if (q.decisions.has(hit.id)) {
      console.error(`⛔ erről már született döntés: ${q.decisions.get(hit.id)!.kind}`);
      return 1;
    }
    rows = [{ id: hit.id, kind: close ? "elvetve" : "elfogadva", date: today, reason: reason.trim() }];
  }

  appendDecisions(DECISIONS, rows);
  // UTÓ-FELTÉTEL: a döntést VISSZAOLVASSUK. Ha a felismerő nem fogadja el a saját kiírt
  // sorunkat, a tétel nyitva maradna, miközben „lezárva"-ként jelentenénk.
  const back = readDecisions(DECISIONS);
  const missed = rows.filter((r) => !back.has(r.id));
  if (missed.length) {
    console.error(`⛔ ${missed.length} döntés NEM olvasható vissza a fájlból — a felismerő és az író nem egyezik.`);
    return 1;
  }
  console.log(`✅ ${rows.length} döntés rögzítve (${DECISIONS}). Nyitott: ${q.open.length - rows.length}`);
  return 0;
}

if (process.argv[1] !== undefined && path.resolve(process.argv[1]) === import.meta.filename) {
  process.exit(main());
}
