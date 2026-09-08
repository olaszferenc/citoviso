// OUTLOOK-lint (ADR-0101) — STRUCTURAL guard for the outreach letter's HTML.
//
// WHY THIS EXISTS. On 2026-09-06 the letter was flawless in the browser AND in Gmail,
// and fell apart in Outlook: the dark price box stretched across the whole 1900px
// window and the header label slid into the logo. Nothing was "wrong" by any visual
// check we had — ui-shot was green, Gmail was green. The break is SILENT, because
// Outlook's Word engine simply drops constructs it does not know:
//
//   - `max-width` on a <div>      → the 600px cage disappears, content goes full width
//   - `float`                     → side-by-side blocks stack or slide
//   - flex / grid                 → ignored entirely
//
// A screenshot cannot catch this (we have no Outlook to shoot), so the check has to be
// structural: assert the letter is built the way Outlook survives, not that it "looks
// fine somewhere". That is the point — a heuristic eye needs a structural twin.
//
// The fixed 600px table is served to Outlook ONLY, inside an MSO conditional comment:
// measured, a plain fixed width="600" CUTS TEXT OFF on a 390px phone, so every other
// client must get the fluid max-width table.
//
//   npx tsx scripts/outlook-lint.mts

import { renderDraft } from "../src/outreach/draft.js";
import { buildOutreachEmail } from "../src/email/outreachEmail.js";
import { buildTrafficEmail } from "../src/email/trafficEmail.js";
import { loadPricing } from "../src/pricing.js";
import { prepareMailLang } from "../src/i18n/mail.js";

interface Rule {
  readonly name: string;
  /** Returns an error message when the markup VIOLATES the rule, else null. */
  readonly check: (html: string) => string | null;
}

/** Strip the MSO-only branch: those constructs are FOR Outlook and are meant to be fixed. */
function withoutMsoBranch(html: string): string {
  return html.replace(/<!--\[if mso\]>[\s\S]*?<!\[endif\]-->/g, "");
}

const RULES: readonly Rule[] = [
  {
    name: "nincs float (az Outlook eldobja)",
    check: (h) => (/float\s*:/i.test(h) ? "float: talált a levél HTML-jében" : null),
  },
  {
    name: "nincs flex/grid (az Outlook nem ismeri)",
    check: (h) =>
      /display\s*:\s*(flex|grid|inline-flex)/i.test(h) ? "display:flex/grid a levélben" : null,
  },
  {
    name: "max-width CSAK <table>/<img>-en (a <div>-ét az Outlook eldobja)",
    check: (h) => {
      // Every tag that carries a max-width must be a table or an img.
      const bad: string[] = [];
      for (const m of h.matchAll(/<([a-z]+)\b[^>]*max-width[^>]*>/gi)) {
        const tag = m[1].toLowerCase();
        if (tag !== "table" && tag !== "img") bad.push(`<${tag}>`);
      }
      return bad.length ? `max-width nem-tábla elemen: ${[...new Set(bad)].join(", ")}` : null;
    },
  },
  {
    name: "MSO szellem-táblázat: a fix 600px KIZÁRÓLAG Outlooknak megy",
    check: (h) => {
      const opens = (h.match(/<!--\[if mso\]>/g) ?? []).length;
      const closes = (h.match(/<!\[endif\]-->/g) ?? []).length;
      if (opens === 0) return "hiányzik az MSO-feltételes szellem-táblázat";
      if (opens !== closes) return `páratlan MSO-komment (${opens} nyitó, ${closes} záró)`;
      if (!/<!--\[if mso\]>[\s\S]*?width="600"[\s\S]*?<!\[endif\]-->/.test(h)) {
        return "az MSO-ágban nincs fix width=\"600\" tábla";
      }
      return null;
    },
  },
  {
    name: "a nem-Outlook ág FOLYÉKONY (különben 390px-en levág)",
    check: (h) => {
      const fluid = withoutMsoBranch(h);
      if (/width="600"/.test(fluid)) return "fix width=\"600\" az MSO-ágon KÍVÜL — mobilon levág";
      if (!/max-width:\s*600px/.test(fluid)) return "hiányzik a max-width:600px-es folyékony tábla";
      return null;
    },
  },
  {
    name: "a szerkezet táblákból áll (van legalább egy presentation-tábla)",
    check: (h) =>
      /<table[^>]*role="presentation"/i.test(h) ? null : "nincs role=\"presentation\" szerkezeti tábla",
  },
];

function run(html: string): string[] {
  return RULES.map((r) => r.check(html)).filter((x): x is string => x !== null);
}

await loadPricing();
const lang = await prepareMailLang("hu");
const draft = renderDraft({
  leadName: "Rozé Fogadó",
  region: "Balaton-felvidék",
  qualification: null,
  segment: "nincs_honlap",
  rating: { value: 4.7, count: 91 },
  token: "00000000-0000-0000-0000-000000000000",
  lang,
});
const html = buildOutreachEmail(draft, "teszt@example.com", {
  lang,
  heroShotPath: "assets/design-refs/console/outreach-mail/hero.png",
}).html as string;

// ⛔ AZ ŐR HATÓKÖRE = A LEVELEK LISTÁJA. Egy új levél, ami nincs rajta, őrizetlen —
// és pont az fog némán törni (feedback_guard_scope_is_the_doctrine). Ide MINDEN
// táblázatos szerkezetű, tenant/lead felé menő levél felkerül.
const LETTERS: readonly { name: string; html: string }[] = [
  { name: "hideg megkereső levél (ADR-0101)", html },
  {
    name: "havi forgalmi levél (ADR-0108)",
    html:
      buildTrafficEmail({
        to: "teszt@example.com",
        siteName: "Nyugalom Vendégház",
        periodLabel: "augusztus",
        report: {
          days: 30, visitors: 143, views: 188, contacts: 7,
          fromGooglePct: 61, mobilePct: 78,
          hostSplit: { domain: "np.hu", custom: 96, slug: 47 },
          visitorsPerContact: 20, isEmpty: false,
        },
        adminUrl: "https://citoviso.com/admin?tab=forgalom",
        lang,
      }).html as string,
  },
];

const failures = LETTERS.flatMap((l) => run(l.html).map((f) => `${l.name}: ${f}`));

// ── ÖNTESZT: az őrnek pirosra is kell tudnia menni ───────────────────────────
// Guards that can only pass are decoration. Each mutation reproduces one real
// Outlook-breaking construct; if a mutation slips through, the rule is asleep.
const MUTATIONS: readonly { name: string; mutate: (h: string) => string }[] = [
  {
    name: "max-width egy <div>-en (a 2026-09-06-i tényleges törés)",
    mutate: (h) => h.replace("<body", `<body><div style="max-width:600px;margin:0 auto"`),
  },
  { name: "float egy szerkezeti elemen", mutate: (h) => h.replace('style="', 'style="float:right;') },
  {
    name: "fix width=600 az MSO-ágon kívül",
    mutate: (h) => h.replace('style="width:100%;max-width:600px', 'width="600" style="'),
  },
  { name: "az MSO szellem-táblázat eltávolítva", mutate: withoutMsoBranch },
];

const asleep: string[] = [];
const inert: string[] = [];
for (const m of MUTATIONS) {
  const mutated = m.mutate(html);
  // A mutation that changes nothing proves nothing — that is a broken SELF-TEST, not a
  // sleeping rule, and the two must not be confused (this fired for real: a mutation
  // targeted `text-align`, which the markup does not contain, and silently "passed").
  if (mutated === html) inert.push(m.name);
  else if (run(mutated).length === 0) asleep.push(m.name);
}

if (failures.length === 0 && asleep.length === 0 && inert.length === 0) {
  console.log(
    `✅ outlook-lint: ${LETTERS.length} levél Outlook-biztos (${RULES.length} szabály/levél), és az őr ${MUTATIONS.length}/${MUTATIONS.length} rontott változatot elkap.`,
  );
  process.exit(0);
}
for (const f of failures) console.error(`⛔ outlook-lint: ${f}`);
for (const a of asleep) console.error(`⛔ outlook-lint ÖNTESZT: a rontott változat ÁTMENT — "${a}"`);
for (const i of inert) console.error(`⛔ outlook-lint ÖNTESZT ROMLOTT: a mutáció nem változtatott semmit — "${i}"`);
process.exit(1);
