// Guard for the console's walk read-out (K2 / S-1, Elek live round 2, 2026-10-02).
//
// Why this exists: the „Séta a kapun át” template (ADR-0304) leaves the walk out when the
// photos have fewer than three walk subjects after the hero collage — the owner's ruling,
// unchanged. The defect was the SILENCE: the console offered the template as „ragadós
// séta-jelenet a fotókból”, and neither the picker, the preview nor the finished mock card
// said that this lead's mock would not walk. The curator got a plain one-column page.
// Approved plan (owner: „A”): assets/design-refs/console/walk-readiness/.
//
// What this guard holds, deterministically (NO database, NO browser):
//   ① walkReadiness: the Muschel/Carina shape is `short`, no subjects is `unknown`, a rich
//     set is `ok` — and `ok` is exactly when the RENDERER would draw a walk (one collage
//     definition for both);
//   ② the picker card, the note under it, the preview warning and the mock-card row each
//     say it, with the count and the threshold; the `ok` case stays quiet on the picker;
//   ③ the wiring: the server computes the read-out and hands it to the page; the picker,
//     the form, the preview and the card all use it.
//
// Run: npx tsx scripts/walk-readiness-check.mts
import { readFileSync } from "node:fs";
import type { Photo } from "../src/engine/recipe.js";
import { walkCollage, walkReadiness, walkSteps, WALK_MIN_STEPS } from "../src/engine/templates/walkThrough.js";
import { walkCardFact, walkPickerNote, walkPickerTag, walkPreviewWarn } from "../src/console/views.js";

let pass = 0;
const failures: string[] = [];
const check = (name: string, ok: boolean, detail: string): void => {
  if (ok) pass++;
  else failures.push(`${name} — ${detail}`);
};
const read = (rel: string) => readFileSync(new URL(`../${rel}`, import.meta.url), "utf8");
const set = (...subjects: (string | undefined)[]): Photo[] =>
  subjects.map((s, i) => ({ url: `https://x.test/${i}.jpg`, alt: "", ...(s ? { subject: s } : {}) }) as Photo);

// ── ① the read-out ─────────────────────────────────────────────────────────────
// Camping Carina (dev, measured 2026-10-02): view,view,pool_garden | exterior,bathroom,sign_map
const carina = set("view", "view", "pool_garden", "exterior", "bathroom", "sign_map");
const none = set(undefined, undefined, undefined);
const rich = set("exterior", "pool_garden", "pool_garden", "pool_garden", "dining", "interior");
{
  const r = walkReadiness(carina);
  check("Carina: a séta nem áll össze (short)", r.state === "short", r.state);
  check("Carina: a kollázs után 1 tárgy marad (kívülről)", r.have.join() === "exterior", r.have.join());
  check("Carina: a kert és a kilátás csak a kollázsban van", r.collageOnly.join() === "pool_garden,view", r.collageOnly.join());
  check("A küszöb 3 (ADR-0304 ③)", r.need === 3 && WALK_MIN_STEPS === 3, String(r.need));
  check("Tárgy-ítélet nélkül: előre nem tudható (unknown)", walkReadiness(none).state === "unknown", walkReadiness(none).state);
  const ok = walkReadiness(rich);
  check("Gazdag készlet: rendben, 3 lépés", ok.state === "ok" && ok.steps === 3, `${ok.state}/${ok.steps}`);
  for (const [name, ps] of [["carina", carina], ["none", none], ["rich", rich]] as const) {
    const drawn = walkSteps(ps, new Set(walkCollage(ps).map((p) => p.url))).length > 0;
    check(`${name}: a jelzés ugyanazt mondja, mint amit a sablon rajzol`, drawn === (walkReadiness(ps).state === "ok"), `rajzol=${drawn}`);
  }
  check(
    "A sablon ugyanazt a kollázs-definíciót használja (walkCollage)",
    /const collage = walkCollage\(photos\);\s*\n\s*const collageSet/.test(read("src/engine/templates/walkThrough.ts")),
    "a renderWalk saját kollázst vág",
  );
}

// ── ② what each surface says ─────────────────────────────────────────────────────
{
  const short = walkReadiness(carina);
  const unknown = walkReadiness(none);
  const ok = walkReadiness(rich);
  const tag = walkPickerTag(short, "hu");
  check("⛔ A kinézet-kártya kimondja: „Séta: nem áll össze” + 1/3", tag.includes("Séta: nem áll össze") && tag.includes("1/3"), tag);
  check("Ismeretlennél: „Séta: előre nem tudható”", walkPickerTag(unknown, "hu").includes("Séta: előre nem tudható"), walkPickerTag(unknown, "hu"));
  check("Rendben esetén a kártya NÉMA (nincs címke)", walkPickerTag(ok, "hu") === "", walkPickerTag(ok, "hu"));
  const note = walkPickerNote(short, "hu");
  check("⛔ A magyarázat: „Ennél a leadnél a séta nem áll össze”", note.includes("Ennél a leadnél a séta nem áll össze"), note.slice(0, 200));
  check("A magyarázat megnevezi a meglévő tárgyat a lap szavával („A ház kívülről”)", note.includes("A ház kívülről"), note.slice(0, 400));
  check("A magyarázat kimondja a küszöböt (legalább 3)", note.includes("legalább 3"), note.slice(0, 400));
  check("A magyarázat alapból rejtve (csak kijelöléskor nyílik)", /hidden/.test(note), "nincs hidden");
  check("Ismeretlennél is van magyarázat", walkPickerNote(unknown, "hu").includes("Előre nem tudható, összeáll-e a séta"), walkPickerNote(unknown, "hu").slice(0, 200));
  check("Rendben esetén nincs magyarázat", walkPickerNote(ok, "hu") === "", "van");
  check("⛔ Az előnézet alatt: „séta nélkül”", walkPreviewWarn(short, "hu").includes("séta nélkül"), walkPreviewWarn(short, "hu"));
  check("Rendben esetén nincs előnézet-figyelmeztetés", walkPreviewWarn(ok, "hu") === "", "van");
  const fact = walkCardFact(short, "hu");
  check("⛔ A mock-kártya „Séta: elmaradt” + 1 fotó-tárgy, 3 kell", fact.includes("Séta") && fact.includes("elmaradt") && fact.includes("1 fotó-tárgy, 3 kell"), fact);
  check("A mock-kártya elmaradt-jelvénye figyelmeztető (flag)", /data-verdict="flag"/.test(fact), fact);
  const okFact = walkCardFact(ok, "hu");
  check("Rendben: a kártya lépésszámot mond (zöld)", okFact.includes("3 lépés") && /data-verdict="pass"/.test(okFact), okFact);
}

// ── ③ the wiring ─────────────────────────────────────────────────────────────────
{
  const views = read("src/console/views.ts");
  const server = read("src/console/server.ts");
  check("A kinézet-választó a címkét a Séta-kártyára teszi", /\$\{t\.id === WALK_TPL \? walkPickerTag\(walk, lang\)/.test(views), "templateCards nem hívja");
  check("A generáló űrlap a választó alá teszi a magyarázatot", /\$\{templateCards\("", walk\.lead\)\}\s*<\/div>\s*\$\{walkPickerNote\(walk\.lead, lang\)\}/.test(views), "nincs az űrlapon");
  check("Az előnézet alá kerül a figyelmeztetés", /<\/figcaption>\s*\$\{walkPreviewWarn\(walk, lang\)\}/.test(views), "nincs az előnézetben");
  check("A kliens-szkript a kijelöléshez köti a magyarázatot", /getElementById\('tpl-walk-note'\);\s*if\(wn&&inp\.value==='walk-through'\)wn\.hidden=!inp\.checked;/.test(views), "a citTplPick nem nyitja");
  check("A mock-kártya a Séta-mockon mondja", /\$\{tplId === WALK_TPL \? walkCardFact\(walk\.byArtifact\.get\(a\.id\) \?\? null, lang\)/.test(views), "a kártya nem hívja");
  check("A szerver kiszámolja és átadja", /walkReadinessView\(/.test(server), "a lead-route nem számolja");
}

for (const f of failures) console.error(`❌ ${f}`);
console.log(`\nwalk-readiness-check: ${pass} zöld, ${failures.length} bukás`);
process.exit(failures.length ? 1 : 0);
