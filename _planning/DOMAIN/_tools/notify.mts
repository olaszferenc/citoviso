// ⭐⭐ A DESZTILLÁLÓ ÉRTESÍTŐJE — a némaság GYÖKÉROKÁNAK ellenszere.
//
// A MÉRT LELET (2026-09-17). A `distill.sh` 6. szakasza hónapok óta hordoz egy hook-pontot:
//   NOTIFY="$TOOLS/notify.sh"; if [ -x "$NOTIFY" ]; then "$NOTIFY" "$OUT" …
// …csakhogy a fájl SOHA NEM LÉTEZETT, tehát a `[ -x ]` mindig hamis volt, és a lépés NÉMÁN
// kimaradt. Ennek az ára mérve: 2026-07-12 és 2026-09-13 között 9 review / 62 érdemi javaslat
// állt feldolgozatlanul egy GITIGNORE-OLT `_inbox/`-ban. A tudás nem veszett el — befagyott.
// A `distill-apply.mts` (jóváhagyható ág) és a frissesség-őr azóta landolt, de mindkettő TÜNETET
// kezel: az egyik előkészíti a döntést, a másik commitkor rászól. Az OK — hogy senki nem tudja
// meg, hogy döntenie kell — eddig érintetlen maradt. Ez a fájl az.
//
// ── NÉGY SZABÁLY, MIND MÉRT HIBÁBÓL ──────────────────────────────────────────────────────
//
// ① CSAK AKKOR SZÓL, HA VAN MIT DÖNTENI. A heti ÜRES futásra néma. Ha minden héten jönne
//    üzenet, a tulaj három hét múlva átnézné, és ugyanott lennénk, ahonnan indultunk — a
//    csend és a zaj ugyanoda vezet. A predikátumot NEM írjuk újra: a frissesség-őr
//    `readCorpus` + `judge` párosából jön („párosítatlan ÉS érdemi tudást hordoz"), mert egy
//    szabály két példányban két igazság (a ház memóriájában több rögzített esetünk van rá).
//
// ② AZ ÜZENET ÖNMAGÁBAN CSELEKVŐKÉPES. Megmondja, MENNYI vár döntésre, és kiírja a három
//    parancsot KONKRÉT útvonallal. Az útvonal a `distill-apply.mts` `branchPaths()`-ából jön —
//    ugyanabból a függvényből, amelyik az ágat ténylegesen létrehozza.
//    ⛔ ÉS CSAK LÉTEZŐ ÁGAT NEVEZ MEG: a `git branch --list` a forrás, nem egy kiszámolt név.
//    Egy értesítés, ami nem létező útvonalat ír, rosszabb a csendnél — egyszer hazudik, és
//    utána a következő igaz üzenetét sem hiszi el senki.
//
// ③ A KÜLDÉS-KAPCSOLÓ FAIL-CLOSED. `--mode=send` NÉLKÜL nem megy ki semmi, és az ISMERETLEN
//    kapcsoló HIBA (exit 2), nem néma átengedés. Ennek a gépnek a `.env`-jében mérve
//    `SMS_PROVIDER=gammu` ÉS `EMAIL_PROVIDER=smtp` — vagyis MINDKÉT csatorna ÉLES, a küldő
//    modulok puszta betöltése is veszélyes. Két rögzített esetünk pontosan ez: egy „mock"
//    e-mail-kapcsoló VALÓDI levelet küldött, mert az ESM a static importokat a `process.env`
//    beállítása ELŐTT hajtja végre; és egy `--dry` kapcsoló, amit a program `--dry-run`-ként
//    várt, NÉMA kikapcsolás lett (29 valódi mellékhatás egy „zöld" tesztből).
//    ⭐ EZÉRT a küldő modulokat DINAMIKUS import hozza be, és CSAK `--mode=send` ágon: száraz
//    futásban a `src/sms/sender.ts` és a `src/email/sender.ts` be sem töltődik.
//
// ④ A DRY-RUN HANGOS. Ha van mit küldeni, de nem `send` módban futunk, azt stderr-re kiírjuk.
//    Enélkül egy rosszul bekötött hook (hiányzó `--mode=send`) pontosan úgy nézne ki, mint a
//    siker — vagyis visszaállítaná az eredeti hibát, csak most egy „működő" értesítővel.
//
// ── CSATORNA (tulajdonosi döntés, 2026-09-17): SMS + E-MAIL EGYÜTT ───────────────────────
// Az SMS a megszakítás, ami a telefonra ér (a postafiók pont az a hely, ahol a 9 review is
// elsüllyedt volna); az e-mail viszi a három parancsot, mert egy SMS-be a worktree-útvonal +
// három parancs nem fér el olvashatóan. A minta a házé: `src/console/aamAlert.ts` ugyanígy
// küld SMS-t ÉS e-mailt, a címzettek a `getAlertRecipients()`-ből (konzol /settings, telefon
// fallback `OWNER_ALERT_PHONE`), és „nincs címzett → hangos hiba, nem pecsétel".
// ⛔ MMS-t MÉRÉS alapján NEM használunk: csak JPEG, root kell, ~90 mp/darab, és a küldés
// idejére áll az SMS-relé — ez az üzenet viszont szöveg (útvonalak és parancsok).
//
//   npx tsx _planning/DOMAIN/_tools/notify.mts                      # SZÁRAZ (alapértelmezés)
//   npx tsx _planning/DOMAIN/_tools/notify.mts --mode=send          # ÉLES küldés
//   npx tsx _planning/DOMAIN/_tools/notify.mts --record=<fájl>      # a tervezett üzenet JSONL-be
//   npx tsx _planning/DOMAIN/_tools/notify.mts --inbox=<dir>

import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import {
  judge,
  readCorpus,
  resolveInbox,
  type Corpus,
  type Review,
} from "../../../scripts/domain-inbox-freshness-check.mts";
import { branchPaths } from "./distill-apply.mts";

const DAY_MS = 86_400_000;

// ── AZ ÁG, AMIT MEG KELL ÍTÉLNI ──────────────────────────────────────────────────────────

export interface BranchInfo {
  readonly branch: string;
  readonly wtDir: string;
  readonly pendingPath: string;
  /** a worktree könyvtára tényleg ott van-e (az ág létezik, de a fa eltávolítható) */
  readonly wtExists: boolean;
}

/**
 * A VALÓDI `wt/distill*` ágak — a gitből, nem kiszámolva.
 *
 * ⛔ Miért nem a mai dátumból képezzük? Mert a felhalmozás-ág (lásd `distill.sh` 0. szakasz)
 * olyan héten is futhat, amikor ma NEM készült új ág; a mai névre hivatkozó üzenet akkor egy
 * nem létező útvonalat írna ki. Az ág-NÉVBŐL viszont visszafejtjük a bélyeget, és az útvonalat
 * a közös `branchPaths()` adja — így a git a forrás, a forma meg egy példányban él.
 */
export function liveBranches(repo: string, branchDirRoot: string): BranchInfo[] {
  let out = "";
  try {
    out = execFileSync("git", ["branch", "--list", "wt/distill*", "--format=%(refname:short)"], {
      cwd: repo,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    });
  } catch {
    return [];
  }
  const found: BranchInfo[] = [];
  for (const line of out.split("\n")) {
    const m = /^wt\/distill(\d{8})$/.exec(line.trim());
    if (!m) continue;
    const p = branchPaths(m[1], branchDirRoot);
    found.push({
      branch: p.branch,
      wtDir: p.wtDir,
      pendingPath: p.pendingPath,
      wtExists: fs.existsSync(p.wtDir),
    });
  }
  return found.sort((a, b) => a.branch.localeCompare(b.branch));
}

// ── AZ ÍTÉLET: VAN-E MIT MONDANI ─────────────────────────────────────────────────────────

export interface NotifyPlan {
  /** szólunk-e egyáltalán */
  readonly speak: boolean;
  /** ha nem szólunk, MIÉRT nem — ez megy a notify.log-ba, hogy a csend is indokolt legyen */
  readonly silentReason: string | null;
  readonly reviews: readonly Review[];
  readonly suggestions: number;
  readonly oldestDays: number | null;
  readonly structural: readonly string[];
  readonly sms: string;
  readonly emailSubject: string;
  readonly emailText: string;
}

/** Ékezet nélküli SMS-törzs — a ház `aamAlert.ts` mintája (WSP/GSM-alfabet barát). */
function ascii(s: string): string {
  return s
    .replace(/[áà]/g, "a").replace(/[ÁÀ]/g, "A")
    .replace(/[éè]/g, "e").replace(/[ÉÈ]/g, "E")
    .replace(/[íì]/g, "i").replace(/[ÍÌ]/g, "I")
    .replace(/[óöőò]/g, "o").replace(/[ÓÖŐÒ]/g, "O")
    .replace(/[úüűù]/g, "u").replace(/[ÚÜŰÙ]/g, "U")
    .replace(/[–—]/g, "-");
}

const ageDays = (iso: string, now: number): number => Math.floor((now - Date.parse(iso)) / DAY_MS);

/**
 * A DÖNTÉS. Tiszta függvény: se git, se hálózat, se küldés — ezért az őr fixture-ökkel
 * végig tudja mérni, és a mérésnek nincs mellékhatása.
 *
 * A konjunkció NEM itt születik: a `judge()` mondja meg, melyik review ÜRES futás
 * (`emptyRuns`), és ami a párosítatlanokból nem üres, az a döntésre váró halmaz.
 */
export function plan(
  corpus: Corpus,
  now: number,
  branches: readonly BranchInfo[],
  repo: string,
): NotifyPlan {
  const verdict = judge(corpus, now);
  const empty = new Set(verdict.emptyRuns.map((r) => r.file));
  const reviews = corpus.pending.filter((r) => !empty.has(r.file));
  const suggestions = reviews.reduce((n, r) => n + r.suggestions, 0);
  const oldestDays = reviews.length ? ageDays(reviews[0].iso, now) : null;
  const structural = verdict.structural;

  if (reviews.length === 0 && structural.length === 0) {
    return {
      speak: false,
      silentReason:
        `nincs mit eldönteni — ${corpus.pending.length} párosítatlan review, abból ` +
        `${verdict.emptyRuns.length} üres futás, 0 érdemi. A heti üres futásra SZÁNDÉKOSAN néma.`,
      reviews: [],
      suggestions: 0,
      oldestDays: null,
      structural: [],
      sms: "",
      emailSubject: "",
      emailText: "",
    };
  }

  // ── SMS: a megszakítás. Rövid, ékezet nélküli, és megnevezi az ágat, ha van.
  const ready = branches.filter((b) => b.wtExists);
  const smsParts: string[] = [];
  if (reviews.length > 0) {
    smsParts.push(
      `Citoviso desztillalo: ${reviews.length} review / ${suggestions} javaslat var dontesre` +
        (oldestDays !== null ? ` (a legregebbi ${oldestDays} napja)` : "") + ".",
    );
    smsParts.push(
      ready.length === 1
        ? `Az atvezeto ag kesz: ${ready[0].branch}.`
        : ready.length > 1
          ? `${ready.length} atvezeto ag var (${ready.map((b) => b.branch).join(", ")}).`
          : "Atvezeto ag MEG NINCS - a reszletek az e-mailben.",
    );
  }
  if (structural.length > 0) {
    smsParts.push(`FIGYELEM: ${structural.length} szerkezeti lelet az inboxban (reszletek e-mailben).`);
  }
  smsParts.push("A harom parancs a reszletes e-mailben.");
  const sms = ascii(smsParts.join(" "));

  // ── E-MAIL: a cselekvőképes törzs, KONKRÉT útvonalakkal.
  const lines: string[] = [];
  lines.push("A heti ontológia-desztilláló lefutott. Ami EMBERI döntésre vár:");
  lines.push("");
  if (reviews.length > 0) {
    lines.push(
      `  • ${reviews.length} párosítatlan review, összesen ${suggestions} érdemi javaslat`,
    );
    if (oldestDays !== null) {
      lines.push(`  • a legrégebbi ${oldestDays} napja áll (${reviews[0].iso.slice(0, 10)})`);
    }
    lines.push("");
    lines.push("Review-k:");
    for (const r of reviews) {
      const what = r.unparsed
        ? "ISMERETLEN FORMÁTUM (fail-closed: érdeminek vesszük)"
        : `${r.suggestions} javaslat`;
      const targets = r.targets.length ? ` → ${r.targets.join(", ")}` : "";
      lines.push(`  - ${r.file} — ${what}${targets}`);
    }
    lines.push("");
  }
  if (structural.length > 0) {
    lines.push("⛔ SZERKEZETI LELET (a mérés maga hibás lehet):");
    for (const s of structural) lines.push(`  - ${s}`);
    lines.push("");
  }

  if (ready.length > 0) {
    for (const b of ready) {
      lines.push(`── A TULAJ DOLGA — három parancs (${b.branch}) ${"─".repeat(20)}`);
      lines.push(`  1) Mit változna?     git -C ${b.wtDir} diff HEAD~1 --stat`);
      lines.push(`                       git -C ${b.wtDir} diff HEAD~1`);
      lines.push(`  2) Ember-döntések:   less ${b.pendingPath}`);
      lines.push(`  3a) ELFOGADOM  →     cd ${b.wtDir} && bash scripts/land.sh`);
      lines.push(`  3b) ELDOBOM    →     git -C ${repo} worktree remove --force ${b.wtDir} && \\`);
      lines.push(`                       git -C ${repo} branch -D ${b.branch}`);
      lines.push("─".repeat(72));
      lines.push("");
    }
  } else if (reviews.length > 0) {
    lines.push("── ÁTVEZETŐ ÁG MÉG NINCS — egy paranccsal elkészül ──────────────────────");
    lines.push(`  npx tsx ${path.join(repo, "_planning/DOMAIN/_tools/distill-apply.mts")} --go`);
    lines.push("  (alapból SZÁRAZ; írni csak a --go kapcsolóval lehet)");
    lines.push("  Utána a fenti három parancs következik — az ág kiírja őket.");
    lines.push("─".repeat(72));
    lines.push("");
  }

  lines.push(
    "Amíg nem döntesz, ez az üzenet hetente megismétlődik — és CSAK akkor, ha tényleg van",
  );
  lines.push("mit eldönteni. Üres desztilláló-futásra ez az értesítő szándékosan néma.");

  const emailSubject =
    reviews.length > 0
      ? `Citoviso — ${reviews.length} desztilláló-review vár döntésre (${suggestions} javaslat)`
      : `Citoviso — szerkezeti lelet a desztilláló inboxában (${structural.length})`;

  return {
    speak: true,
    silentReason: null,
    reviews,
    suggestions,
    oldestDays,
    structural,
    sms,
    emailSubject,
    emailText: lines.join("\n"),
  };
}

// ── A KÜLDÉS ─────────────────────────────────────────────────────────────────────────────

export interface Recipients {
  readonly phone: string | null;
  readonly email: string | null;
}

export interface Sink {
  readonly kind: string;
  sms(to: string, text: string): Promise<void>;
  email(to: string, subject: string, text: string): Promise<void>;
}

/**
 * Rögzítő nyelő — SEMMIT nem importál a küldő modulokból, tehát nem is tud küldeni.
 * Ez az őr mérőeszköze: megmutatja, MI MENNE ki, anélkül hogy bármi elhagyná a gépet.
 */
export function recordingSink(file: string | null): Sink {
  const write = (rec: unknown): void => {
    if (file) fs.appendFileSync(file, `${JSON.stringify(rec)}\n`);
  };
  return {
    kind: "recording",
    async sms(to, text) {
      write({ channel: "sms", to, text });
    },
    async email(to, subject, text) {
      write({ channel: "email", to, subject, text });
    },
  };
}

/**
 * ÉLES nyelő. ⛔ A két küldő modul DINAMIKUS importtal jön be, és ez a függvény CSAK a
 * `--mode=send` ágon hívódik: száraz futásban a `src/sms/sender.ts` és a `src/email/sender.ts`
 * be sem töltődik. Ez nem stílus-kérdés — ezen a gépen mindkét csatorna ÉLES a `.env`-ben, és
 * a házban van rögzített esetünk arra, hogy a static import mellékhatása valódi levelet küldött.
 */
export async function liveSink(): Promise<Sink> {
  const { sendSms } = await import("../../../src/sms/sender.js");
  const { getEmailSender } = await import("../../../src/email/sender.js");
  return {
    kind: "live",
    async sms(to, text) {
      await sendSms({ to, text });
    },
    async email(to, subject, text) {
      await getEmailSender().send({ to, audience: "platform", subject, text });
    },
  };
}

/** ÉLES címzettek — konzol /settings, telefon fallback `OWNER_ALERT_PHONE` (aamAlert minta). */
export async function liveRecipients(): Promise<Recipients> {
  const { getAlertRecipients } = await import("../../../src/console/appSettings.js");
  const r = await getAlertRecipients();
  return { phone: r.phone, email: r.email };
}

/**
 * A kézbesítés. Ugyanez a kódút fut száraz és éles módban is — csak a nyelő más —, hogy a
 * teszt NE egy másik ágat mérjen, mint ami élesben fut.
 */
export async function deliver(p: NotifyPlan, rcpt: Recipients, sink: Sink): Promise<string[]> {
  const sent: string[] = [];
  if (!p.speak) return sent;
  if (rcpt.phone) {
    await sink.sms(rcpt.phone, p.sms);
    sent.push("sms");
  }
  if (rcpt.email) {
    await sink.email(rcpt.email, p.emailSubject, p.emailText);
    sent.push("email");
  }
  return sent;
}

// ── CLI ──────────────────────────────────────────────────────────────────────────────────

export type Mode = "send" | "dry-run";

export interface Args {
  readonly mode: Mode;
  readonly record: string | null;
  readonly inbox: string | null;
  readonly reviewFile: string | null;
}

export class ArgError extends Error {}

/**
 * ⛔ FAIL-CLOSED. Hiányzó `--mode` = száraz futás; ISMERETLEN kapcsoló vagy ismeretlen
 * mód-érték = HIBA, nem néma átengedés. A `--dry` (a `--dry-run` elgépelése) így NEM csúszik
 * át küldésbe: dobunk. Ez a ház rögzített hibájából jön — ott egy `--dry` néma kikapcsolás
 * lett, és a „zöld" teszt 29 valódi mellékhatást termelt.
 */
export function parseArgs(argv: readonly string[]): Args {
  let mode: Mode = "dry-run";
  let record: string | null = null;
  let inbox: string | null = null;
  let reviewFile: string | null = null;
  for (const a of argv) {
    if (a.startsWith("--mode=")) {
      const v = a.slice("--mode=".length);
      if (v !== "send" && v !== "dry-run") {
        throw new ArgError(`ismeretlen --mode érték: "${v}" (csak: send | dry-run)`);
      }
      mode = v;
    } else if (a.startsWith("--record=")) {
      record = a.slice("--record=".length);
    } else if (a.startsWith("--inbox=")) {
      inbox = a.slice("--inbox=".length);
    } else if (a.startsWith("-")) {
      throw new ArgError(
        `ismeretlen kapcsoló: ${a}\nKüldeni CSAK a --mode=send kapcsolóval lehet; minden más száraz futás.`,
      );
    } else if (reviewFile === null) {
      reviewFile = a; // a distill.sh ezt adja át: a friss review útvonala (csak naplóba)
    } else {
      throw new ArgError(`váratlan második pozicionális argumentum: ${a}`);
    }
  }
  return { mode, record, inbox, reviewFile };
}

async function main(): Promise<number> {
  let args: Args;
  try {
    args = parseArgs(process.argv.slice(2));
  } catch (e) {
    console.error(`[notify] ⛔ ${(e as Error).message}`);
    return 2;
  }

  const repo = path.resolve(import.meta.dirname, "../../..");
  const loc = resolveInbox(repo, args.inbox ?? process.env.DOMAIN_INBOX_DIR);
  const corpus = readCorpus(loc.dir, [path.join(repo, "_planning/DOMAIN/_inbox/applied")]);
  const branches = liveBranches(repo, path.join(os.homedir(), "wt"));
  const p = plan(corpus, Date.now(), branches, repo);

  console.log(`[notify] inbox: ${loc.dir} (${loc.how})`);
  if (!p.speak) {
    console.log(`[notify] NÉMA — ${p.silentReason}`);
    return 0;
  }
  console.log(
    `[notify] van mit eldönteni: ${p.reviews.length} review / ${p.suggestions} javaslat` +
      `${p.structural.length ? ` + ${p.structural.length} szerkezeti lelet` : ""}`,
  );

  if (args.mode !== "send") {
    // ④ A dry-run HANGOS: egy rosszul bekötött hook (hiányzó --mode=send) különben
    //    pontosan úgy nézne ki, mint a siker — és visszahozná az eredeti csendet.
    console.error(
      `[notify] ⚠️ SZÁRAZ FUTÁS — NEM küldtem semmit, pedig lett volna mit (${p.reviews.length} ` +
        `review / ${p.suggestions} javaslat). Éles küldés: --mode=send`,
    );
    await deliver(p, { phone: "(száraz futás)", email: "(száraz futás)" }, recordingSink(args.record));
    if (args.record) console.error(`[notify] a tervezett üzenet rögzítve: ${args.record}`);
    return 0;
  }

  const rcpt = await liveRecipients();
  if (!rcpt.phone && !rcpt.email) {
    // aamAlert minta: hangos, és NEM nyeljük el zölddel — a riasztás esedékes marad.
    console.error(
      "[notify] ⛔ VAN mit eldönteni, de nincs riasztási címzett (konzol /settings vagy " +
        "OWNER_ALERT_PHONE) — az értesítés NEM ment ki.",
    );
    return 1;
  }
  const sent = await deliver(p, rcpt, await liveSink());
  console.log(`[notify] kiküldve: ${sent.join(", ") || "(semmi)"}`);
  return 0;
}

// Main-guard: a fájl importálható (az őr ebből méri a `plan()`-t), és olyankor nem fut le.
if (process.argv[1] !== undefined && path.resolve(process.argv[1]) === import.meta.filename) {
  main().then(
    (rc) => process.exit(rc),
    (e) => {
      console.error(`[notify] ⛔ hiba: ${(e as Error).stack ?? e}`);
      process.exit(1);
    },
  );
}
