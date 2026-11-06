// ADR-0429 — the embedded setup questions, one set per registry topic (src/tenant/moduleSetup.ts).
// Approved plan: assets/design-refs/tenant-admin/modul-statusz/.
//
// A step renders its fields (no <form> — the wizard and the module page wrap it) and saves
// THROUGH THE EXISTING WRITE FUNCTIONS — the same ones the module screens use — so the
// wizard, the module page and the „Foglalás beállítása” page (ADR-0380) can never disagree.
// Every step names the writer it goes through (`writes`); the land gate checks the name is a
// registered one (WRITERS).
//
// ⛔ setSiteModuleConfig STORES EXACTLY THE KEYS IT IS GIVEN: every config write here merges
// the stored values first, or a one-field answer would wipe the module's other settings.

import { normaliseFeedUrl, SYNC_MSG, syncCalendarLink } from "../booking/sync.js";
import { huArticleLower } from "../hu.js";
import { T } from "../i18n/mail.js";
import { addCalendarLink, EXPORT_PORTALS, getExportFeedUrl } from "../tenant/availability.js";
import { AMENITY_CATALOG, composeAmenities } from "../tenant/amenityCatalog.js";
import { saveTenantContact, saveTenantContent } from "../tenant/editor.js";
import {
  bookableOf,
  holds,
  lettingMode,
  modulePriceText,
  moduleName,
  roomsOf,
  type LettingMode,
  type SetupCtx,
} from "../tenant/moduleSetup.js";
import { setBasePrice } from "../tenant/prices.js";
import { setSiteModuleConfig } from "../tenant/siteModuleConfig.js";
import { createUnit, deleteUnit, settleHouse, setHouseOnly, setUnitAmenities, setUnitPriceOnRequest, updateUnit } from "../tenant/units.js";
import { MODULE_CATALOG } from "../modules.js";

function esc(s: unknown): string {
  return String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

export interface StepEnv {
  readonly ctx: SetupCtx;
  readonly lang: string;
  /** This topic's saved answers (site_setup_progress.draft). */
  readonly draft: Record<string, unknown>;
  readonly tenantId: string;
  readonly siteId: string;
  /** tenant_user id — the `updated_by` of a config write. */
  readonly actor: string;
}

export interface StepResult {
  /** Owner-facing message; the step stays on screen with it. */
  readonly error?: string;
  /** Answers to keep (merged into the topic's draft). */
  readonly draft?: Record<string, unknown>;
  /** Modules to put in the cart; the walk continues HERE after payment. */
  readonly cart?: readonly string[];
  /** The topic is finished early (e.g. "Most egészben adom ki"). */
  readonly finish?: boolean;
}

export interface SetupStep {
  readonly key: string;
  readonly question: string;
  readonly lead: string;
  /** The write function this step goes through (gate ④ — must be in WRITERS). */
  readonly writes: string;
  readonly render: (env: StepEnv) => string;
  readonly save: (env: StepEnv, form: URLSearchParams) => Promise<StepResult>;
}

/** The write functions a step may go through (gate ④). "none" = the step only records an answer. */
export const WRITERS = [
  "createUnit/updateUnit/deleteUnit + settleHouse/setHouseOnly",
  "updateUnit",
  "setBasePrice/setUnitPriceOnRequest",
  "setSiteModuleConfig",
  "setUnitAmenities",
  "addCalendarLink+syncCalendarLink",
  "saveTenantContact",
  "saveTenantContent",
  "/admin/photos",
  "cart (/admin/modules)",
  "none",
] as const;

// ── field helpers ───────────────────────────────────────────────────────────────────
function radio(name: string, value: string, cur: string, title: string, small: string): string {
  return (
    `<label class="sw-opt${cur === value ? " on" : ""}"><input type="radio" name="${name}" value="${esc(value)}"${cur === value ? " checked" : ""}>` +
    `<span><b>${title}</b><small>${small}</small></span></label>`
  );
}
function check(name: string, value: string, on: boolean, title: string, small = ""): string {
  return (
    `<label class="sw-opt${on ? " on" : ""}"><input type="checkbox" name="${name}" value="${esc(value)}"${on ? " checked" : ""}>` +
    `<span><b>${title}</b>${small ? `<small>${small}</small>` : ""}</span></label>`
  );
}
function numberField(name: string, label: string, value: number | string, min: number, max: number): string {
  return (
    `<label class="sw-field"><span>${label}</span>` +
    `<input type="number" inputmode="numeric" name="${name}" min="${min}" max="${max}" value="${esc(String(value))}" required></label>`
  );
}
function textField(name: string, label: string, value: string, opts: { type?: string; placeholder?: string; required?: boolean } = {}): string {
  return (
    `<label class="sw-field"><span>${label}</span>` +
    `<input type="${opts.type ?? "text"}" name="${name}" value="${esc(value)}"${opts.placeholder ? ` placeholder="${esc(opts.placeholder)}"` : ""}${opts.required ? " required" : ""}></label>`
  );
}
const intIn = (raw: string | null, min: number, max: number): number | null => {
  const n = Number(String(raw ?? "").trim());
  return Number.isInteger(n) && n >= min && n <= max ? n : null;
};
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const storedOf = (env: StepEnv, m: string): Record<string, unknown> => ({ ...(env.ctx.stored.get(m) ?? {}) });

async function saveConfig(env: StepEnv, moduleId: string, patch: Record<string, unknown>): Promise<StepResult> {
  const r = await setSiteModuleConfig(env.siteId, moduleId, { ...storedOf(env, moduleId), ...patch }, env.actor);
  return r.ok ? {} : { error: r.errors.join(" ") };
}

/** Normalised price: spaces, dots and "Ft" are fine; decimals are not. */
export function parsePrice(raw: string, lang: string): { value: number | null; error?: string } {
  const s = raw.replace(/ft|huf/gi, "").replace(/[\s. ]/g, "");
  if (!s) return { value: null, error: T(lang, "Írjon be egy összeget, vagy jelölje be: „Ennél nem adok meg árat”.") };
  if (!/^\d+$/.test(s)) return { value: null, error: T(lang, "Csak számot írjon (pl. 25 000).") };
  const v = Number(s);
  if (v < 1000) return { value: null, error: T(lang, "Ez nagyon kevés egy éjszakára — biztos, hogy forintban írta?") };
  if (v > 2000000) return { value: null, error: T(lang, "Ez szokatlanul sok egy éjszakára — nézze meg a nullákat.") };
  return { value: v };
}

// ── letting (units) ─────────────────────────────────────────────────────────────────
/** Bring the units to the answer: rename/create/delete rooms, keep the house (ADR-0392). */
async function applyLetting(env: StepEnv, mode: LettingMode, names: readonly string[]): Promise<StepResult> {
  const rooms = roomsOf(env.ctx);
  const wanted = mode === "whole" ? [] : names;
  for (let i = 0; i < wanted.length; i++) {
    const r = rooms[i];
    if (r) await updateUnit(env.siteId, r.id, wanted[i]!, r.capacity, r.description);
    else await createUnit(env.siteId, wanted[i]!, null, null);
  }
  // Extra rooms go — through the existing delete and its refusals (ADR-0299: an open request blocks it).
  for (const r of rooms.slice(wanted.length).reverse()) {
    const d = await deleteUnit(env.siteId, r.id);
    if (!d.ok) return { error: T(env.lang, "{room}: {reason}", { room: r.name, reason: d.reason ? T(env.lang, d.reason) : "" }) };
  }
  await settleHouse(env.siteId);
  if (mode !== "whole") await setHouseOnly(env.siteId, mode === "wholeOnly");
  return {};
}

function lettingSteps(env: StepEnv): SetupStep[] {
  const { ctx, lang, draft } = env;
  const mode = (draft.mode as LettingMode | undefined) ?? lettingMode(ctx) ?? "";
  const withRooms = mode === "rooms" || mode === "wholeOnly";
  const steps: SetupStep[] = [
    {
      key: "mode",
      question: T(lang, "Hogyan adja ki a szállást?"),
      lead: T(lang, "Ha a vendég mindig az egész házat kapja, válassza az elsőt."),
      writes: "createUnit/updateUnit/deleteUnit + settleHouse/setHouseOnly",
      render: () =>
        radio("mode", "whole", mode, T(lang, "Egészben"), T(lang, "Egy foglalás = az egész szállás")) +
        radio("mode", "rooms", mode, T(lang, "Szobánként"), T(lang, "A vendég egy-egy szobát foglal (az egész ház is kivehető marad)")) +
        radio("mode", "wholeOnly", mode, T(lang, "Egyben adom ki, de a szobákat bemutatnám"), T(lang, "Egy foglalható egység (a ház); a szobák képpel, leírással látszanak, árat nem kérnek")),
      save: async (e, form) => {
        const m = form.get("mode");
        if (m !== "whole" && m !== "rooms" && m !== "wholeOnly") return { error: T(lang, "Válasszon egyet.") };
        if (m === "whole") {
          const r = await applyLetting(e, "whole", []);
          return r.error ? r : { draft: { mode: m }, finish: true };
        }
        return { draft: { mode: m } };
      },
    },
  ];
  if (withRooms && (!holds(ctx, "rooms") || draft.choice === "buy")) {
    const extra = holds(ctx, "pricing") ? [] : ["pricing"];
    steps.push({
      key: "module",
      question: T(lang, "Ehhez kell egy modul"),
      lead: T(lang, "Előre megmondjuk, mibe kerül — utána Ön dönt."),
      writes: "cart (/admin/modules)",
      render: () => {
        if (holds(ctx, "rooms")) {
          return `<div class="sw-box sw-box--ok"><b>${T(lang, "Megrendelve és kifizetve: {m}.", { m: moduleName("rooms", lang) })}</b><div class="sw-muted">${T(lang, "Folytatjuk ott, ahol abbahagyta.")}</div></div>`;
        }
        const pricingReq = MODULE_CATALOG.find((m) => m.id === "pricing")?.requires?.find((r) => r.id === "rooms")?.why ?? "";
        return (
          `<div class="sw-box sw-box--warn"><b>${T(lang, "Ehhez a {m} modul kell", { m: moduleName("rooms", lang) })}</b>` +
          `<div class="sw-muted">${T(lang, "A csomagjában most nincs benne. Nélküle a szobák a honlapon nem jelennek meg külön — a vendég az egész szállásra kér időpontot.")}</div></div>` +
          `<div class="sw-opt on sw-opt--fixed"><span><b>${moduleName("rooms", lang)} · ${modulePriceText(ctx, "rooms", lang)}</b><small>${T(lang, "Szobánként: név, férőhely, leírás, fotó.")}</small></span></div>` +
          extra.map((m) => check("also", m, draft.alsoPricing === true, `${moduleName(m, lang)} · ${modulePriceText(ctx, m, lang)} — ${T(lang, "nem kötelező")}`, `${T(lang, "Ha szobánként árat is mutatna.")} ${esc(T(lang, pricingReq))}`)).join("") +
          radio("choice", "buy", String(draft.choice ?? ""), T(lang, "Megrendelem, és folytatjuk"), T(lang, "A modul-kosárba tesszük; a fizetés után itt folytatja.")) +
          radio("choice", "whole", String(draft.choice ?? ""), T(lang, "Most egészben adom ki"), T(lang, "Egy egység marad. Később bármikor átállhat szobánkéntire."))
        );
      },
      save: async (e, form) => {
        if (holds(e.ctx, "rooms")) return {};
        const c = form.get("choice");
        const also = form.getAll("also").includes("pricing");
        if (c !== "buy" && c !== "whole") return { error: T(lang, "Válasszon: megrendeli, vagy most egészben adja ki."), draft: { alsoPricing: also } };
        if (c === "whole") {
          const r = await applyLetting(e, "whole", []);
          return r.error ? r : { draft: { mode: "whole", choice: "whole" }, finish: true };
        }
        return { draft: { choice: "buy", alsoPricing: also }, cart: ["rooms", ...(also ? ["pricing"] : [])] };
      },
    });
  }
  if (withRooms && holds(ctx, "rooms")) {
    const known = roomsOf(ctx).map((u) => u.name);
    const n = Number(draft.n) || known.length || ctx.suggestedRooms.length || 2;
    steps.push({
      key: "count",
      question: T(lang, "Hány szobát ad ki?"),
      lead: ctx.suggestedRooms.length && !known.length
        ? T(lang, "A honlapjára {n} szobát vettünk át a nyilvános adatokból — javítsa, ha nem így van.", { n: ctx.suggestedRooms.length })
        : T(lang, "Csak a külön kiadott szobákat számolja."),
      writes: "none",
      render: () => numberField("n", T(lang, "Szobák száma"), Math.max(2, Math.min(30, n)), 2, 30),
      save: async (_e, form) => {
        const v = intIn(form.get("n"), 2, 30);
        return v === null ? { error: T(lang, "2 és 30 között adja meg.") } : { draft: { n: v } };
      },
    });
    const names = Array.isArray(draft.names) ? (draft.names as string[]) : [];
    steps.push({
      key: "names",
      question: T(lang, "Mi a szobák neve?"),
      lead: mode === "wholeOnly" ? T(lang, "Bemutatásként látszanak — foglalni az egész házat lehet.") : T(lang, "Így látja a vendég a honlapon és a foglaláskor."),
      writes: "createUnit/updateUnit/deleteUnit + settleHouse/setHouseOnly",
      render: () =>
        Array.from({ length: Math.max(2, Math.min(30, n)) }, (_, i) =>
          textField(`name${i}`, T(lang, "{i}. szoba", { i: i + 1 }), names[i] ?? known[i] ?? ctx.suggestedRooms[i] ?? "", { placeholder: T(lang, "pl. Kétágyas szoba"), required: true }),
        ).join("") + `<p class="sw-hint">${T(lang, "Mellé az egész ház is megmarad, egyben kivehetőnek.")}</p>`,
      save: async (e, form) => {
        const list = Array.from({ length: Math.max(2, Math.min(30, n)) }, (_, i) => (form.get(`name${i}`) ?? "").trim().slice(0, 120));
        if (list.some((x) => !x)) return { error: T(lang, "Minden szobának adjon nevet."), draft: { names: list } };
        const r = await applyLetting(e, mode as LettingMode, list);
        return r.error ? { ...r, draft: { names: list } } : { draft: { names: list } };
      },
    });
  }
  return steps;
}

// ── per-unit topics ─────────────────────────────────────────────────────────────────
function capacitySteps(env: StepEnv): SetupStep[] {
  const { lang } = env;
  return bookableOf(env.ctx).map((u) => ({
    key: `cap-${u.id}`,
    question: T(lang, "Hány fő fér el: {name}?", { name: u.name }),
    lead: T(lang, "Az ágyak alapján — pótággyal együtt, ha van."),
    writes: "updateUnit",
    render: () => numberField("cap", T(lang, "Férőhely (fő)"), u.capacity ?? "", 1, 50),
    save: async (e, form) => {
      const cap = intIn(form.get("cap"), 1, 50);
      if (cap === null) return { error: T(lang, "1 és 50 fő között adja meg.") };
      await updateUnit(e.siteId, u.id, u.name, cap, u.description);
      return {};
    },
  }));
}

function pricingSteps(env: StepEnv): SetupStep[] {
  const { lang, ctx } = env;
  const units = bookableOf(ctx);
  const steps: SetupStep[] = units.map((u) => {
    const base = (ctx.unitPrices.get(u.id) ?? []).find((p) => p.isBase && !p.validFrom && !p.validTo);
    return {
      key: `price-${u.id}`,
      question: T(lang, "Mennyi egy éjszaka: {name}?", { name: u.name }),
      lead: units.length > 1 ? T(lang, "Szobánként külön ár — a vendég annak az árát látja, amit kivesz.") : T(lang, "Az egész szállás ára egy éjre. Később szezononként is módosíthatja."),
      writes: "setBasePrice/setUnitPriceOnRequest",
      render: () =>
        textField("amount", T(lang, "{name} — ár / éj (Ft)", { name: u.name }), base ? String(base.amount) : "", { placeholder: T(lang, "pl. 25 000") }) +
        check("por", "1", u.priceOnRequest, T(lang, "Ennél nem adok meg árat"), T(lang, "A vendég árajánlatot kér, Ön válaszol neki.")),
      save: async (e, form) => {
        if (form.get("por") === "1") {
          await setUnitPriceOnRequest(u.id, true);
          return {};
        }
        const p = parsePrice(form.get("amount") ?? "", lang);
        if (p.error) return { error: p.error };
        await setBasePrice(u.id, p.value);
        if (u.priceOnRequest) await setUnitPriceOnRequest(u.id, false);
        return {};
      },
    };
  });
  // The shortest stay lives on the booking module (no booking → the guest asks by message).
  if (holds(ctx, "booking")) {
    const s = ctx.stored.get("booking") ?? {};
    steps.push({
      key: "min",
      question: T(lang, "Legalább hány éjre lehet foglalni?"),
      lead: T(lang, "Minden szobára ugyanez — később szezononként finomíthatja."),
      writes: "setSiteModuleConfig",
      render: () => numberField("min", T(lang, "Legkevesebb éjszaka"), Number(s.minNights) || 1, 1, 30),
      save: async (e, form) => {
        const min = intIn(form.get("min"), 1, 30);
        if (min === null) return { error: T(lang, "1 és 30 között adja meg.") };
        return saveConfig(e, "booking", { minNights: min });
      },
    });
  }
  return steps;
}

// ── calendar ────────────────────────────────────────────────────────────────────────
const PORTAL_KEYS = Object.keys(EXPORT_PORTALS);
function calendarSteps(env: StepEnv): SetupStep[] {
  const { lang, ctx, draft } = env;
  const portals = Array.isArray(draft.portals) ? (draft.portals as string[]) : [];
  const none = draft.none === true;
  const units = bookableOf(ctx);
  const steps: SetupStep[] = [
    {
      key: "where",
      question: T(lang, "Hol hirdeti még a szállást?"),
      lead: T(lang, "Jelölje be mindet. Ha sehol máshol, azt is jelölje — akkor nincs mit összekötni."),
      writes: "none",
      render: () =>
        PORTAL_KEYS.map((k) => check("portal", EXPORT_PORTALS[k]!, portals.includes(EXPORT_PORTALS[k]!), esc(EXPORT_PORTALS[k]!))).join("") +
        check("none", "1", none, T(lang, "Sehol máshol"), T(lang, "Csak ezen a honlapon foglalnak")),
      save: async (_e, form) => {
        const ps = form.getAll("portal").filter((p) => Object.values(EXPORT_PORTALS).includes(p));
        const n = form.get("none") === "1";
        if (!ps.length && !n) return { error: T(lang, "Jelöljön be legalább egyet.") };
        return n ? { draft: { portals: [], none: true }, finish: true } : { draft: { portals: ps, none: false } };
      },
    },
  ];
  if (!none) {
    for (const p of portals) {
      steps.push({
        key: `link-${p}`,
        question: T(lang, "Másolja ide {art} {p} naptár-linkjét", { art: huArticleLower(p), p }),
        lead: T(lang, "Egyszer kell megcsinálni. Utána a rendszer óránként magától frissít."),
        writes: "addCalendarLink+syncCalendarLink",
        render: () =>
          `<p class="sw-hint"><a href="/admin?tab=modulok&amp;m=booking" target="_blank" rel="noopener">${T(lang, "Hol találja: a lépések képekkel az Online foglalás lapon")}</a></p>` +
          units
            .map((u) => {
              const have = ctx.calendar.find((l) => l.unitId === u.id && l.provider === p);
              return textField(`url-${u.id}`, units.length > 1 ? T(lang, "{p} link — {name}", { p, name: u.name }) : T(lang, "{p} naptár-link", { p }), "", { type: "url", placeholder: "https://…" }) +
                (have ? `<p class="sw-hint ${have.ok ? "sw-ok" : "sw-err"}">${have.ok ? T(lang, "Összekötve · {n} foglalt nap", { n: have.days }) : esc(T(lang, have.error ?? ""))}</p>` : "");
            })
            .join(""),
        save: async (e, form) => {
          let any = false;
          for (const u of units) {
            const raw = (form.get(`url-${u.id}`) ?? "").trim();
            if (!raw) continue;
            const url = normaliseFeedUrl(raw);
            if (!/^https?:\/\//i.test(url)) return { error: T(lang, "A link nem érvényes webcím. Másolja be újra, teljes egészében.") };
            const linkId = await addCalendarLink(u.id, p, url);
            const out = await syncCalendarLink(linkId, u.id, url);
            if (!out.ok) return { error: T(lang, out.error ?? SYNC_MSG.unreachable) };
            any = true;
          }
          const linked = units.every((u) => e.ctx.calendar.some((l) => l.unitId === u.id && l.provider === p));
          return any || linked ? {} : { error: T(lang, "Illessze be a linket — vagy lépjen vissza, és vegye ki ezt a portált.") };
        },
      });
    }
    steps.push({
      key: "export",
      question: T(lang, "Fordítva is: a mi naptárunk a portálba"),
      lead: T(lang, "Így a honlapon jött foglalás a portálon is lezárja a napot."),
      writes: "none",
      render: () => `<div data-sw-export>${T(lang, "A link a mentés után itt jelenik meg.")}</div>`,
      save: async () => ({}),
    });
  }
  return steps;
}

/** The export links for the calendar's last step (created on first view, like the booking screen). */
export async function exportLinksHtml(ctx: SetupCtx, lang: string, portals: readonly string[], siteUrl: string | null): Promise<string> {
  const rows: string[] = [];
  for (const u of bookableOf(ctx)) {
    for (const p of portals) {
      const key = Object.entries(EXPORT_PORTALS).find(([, v]) => v === p)?.[0] ?? null;
      const url = await getExportFeedUrl(u.id, siteUrl, key);
      if (url) rows.push(`<div class="sw-field"><span>${esc(p)}${bookableOf(ctx).length > 1 ? ` — ${esc(u.name)}` : ""}</span><input type="text" readonly value="${esc(url)}" onclick="this.select()"></div>`);
    }
  }
  return rows.join("") + `<p class="sw-hint">${T(lang, "Másolja ki, és illessze be a portál naptár-importjába (például „honlap” névvel).")}</p>`;
}

// ── page modules ────────────────────────────────────────────────────────────────────
function bookingSteps(env: StepEnv): SetupStep[] {
  const { lang } = env;
  const s = env.ctx.stored.get("booking") ?? {};
  return [
    {
      key: "notify",
      question: T(lang, "Kinek szóljunk, ha foglalási kérés jön?"),
      lead: T(lang, "Üresen hagyva a fiókja e-mail címére megy."),
      writes: "setSiteModuleConfig",
      render: () => textField("notify", T(lang, "Értesítési e-mail cím"), String(s.notifyEmail ?? ""), { type: "email", placeholder: T(lang, "a fiókja e-mail címe") }),
      save: async (e, form) => {
        const v = (form.get("notify") ?? "").trim();
        if (v && !EMAIL_RE.test(v)) return { error: T(lang, "Ez nem e-mail cím — nézze meg a @ utáni részt.") };
        return saveConfig(e, "booking", { notifyEmail: v });
      },
    },
    {
      key: "stay",
      question: T(lang, "Legalább hány éjre lehet foglalni?"),
      lead: T(lang, "Ugyanaz a szám, mint az Áraknál — itt is átírhatja."),
      writes: "setSiteModuleConfig",
      render: () => numberField("min", T(lang, "Legkevesebb éjszaka"), Number(s.minNights) || 1, 1, 30),
      save: async (e, form) => {
        const min = intIn(form.get("min"), 1, 30);
        if (min === null) return { error: T(lang, "1 és 30 között adja meg.") };
        return saveConfig(e, "booking", { minNights: min });
      },
    },
  ];
}

const HOURS = Array.from({ length: 18 }, (_, i) => `${String(i + 6).padStart(2, "0")}:00`);
function hourSelect(name: string, label: string, cur: string): string {
  return `<label class="sw-field"><span>${label}</span><select name="${name}">${HOURS.map((h) => `<option${h === cur ? " selected" : ""}>${h}</option>`).join("")}</select></label>`;
}
function hoursSteps(env: StepEnv): SetupStep[] {
  const { lang } = env;
  const s = env.ctx.stored.get("hours") ?? {};
  return [
    {
      key: "hours",
      question: T(lang, "Mikor érkezhet és mikor kell távoznia a vendégnek?"),
      lead: T(lang, "A szokásos: érkezés 14 órától, távozás 10 óráig."),
      writes: "setSiteModuleConfig",
      render: () =>
        hourSelect("from", T(lang, "Érkezés ettől"), String(s.checkInFrom || "14:00")) +
        hourSelect("to", T(lang, "Érkezés eddig"), String(s.checkInTo || "20:00")) +
        hourSelect("out", T(lang, "Távozás eddig"), String(s.checkOutUntil || "10:00")),
      save: async (e, form) => {
        const from = form.get("from") ?? "", to = form.get("to") ?? "", out = form.get("out") ?? "";
        if (![from, to, out].every((h) => HOURS.includes(h))) return { error: T(lang, "Válasszon időpontot.") };
        if (to <= from) return { error: T(lang, "Az „érkezés eddig” legyen később, mint az „érkezés ettől”.") };
        return saveConfig(e, "hours", { checkInFrom: from, checkInTo: to, checkOutUntil: out });
      },
    },
  ];
}

function amenityChecks(name: string, scope: "property" | "unit", chosen: readonly string[], lang: string): string {
  return AMENITY_CATALOG.filter((a) => a.scope === scope || a.scope === "both")
    .slice(0, 24)
    .map((a) => check(name, a.label, chosen.includes(a.label), T(lang, a.label)))
    .join("");
}
function amenitiesSteps(env: StepEnv): SetupStep[] {
  const { lang, ctx } = env;
  const items = Array.isArray(ctx.stored.get("amenities")?.items) ? (ctx.stored.get("amenities")!.items as string[]) : [];
  const steps: SetupStep[] = [
    {
      key: "site",
      question: T(lang, "Mi van az egész szálláson?"),
      lead: T(lang, "Ami minden vendégnek jár. Csak pipálja be."),
      writes: "setSiteModuleConfig",
      render: () => `<div class="sw-grid">${amenityChecks("am", "property", items, lang)}</div>`,
      save: async (e, form) => {
        const list = composeAmenities(form.getAll("am"), "", "property");
        if (!list.length) return { error: T(lang, "Pipáljon be legalább egyet.") };
        return saveConfig(e, "amenities", { items: list });
      },
    },
  ];
  // Per-room amenities need rooms AND amenities (ADR-0074 §5 — the save route checks both).
  if (holds(ctx, "rooms") && roomsOf(ctx).length) {
    for (const u of roomsOf(ctx)) {
      steps.push({
        key: `unit-${u.id}`,
        question: T(lang, "Mi van {art} {name} szobában?", { art: huArticleLower(u.name), name: u.name }),
        lead: T(lang, "Ami csak ebben a szobában van. Ha nincs ilyen, hagyja üresen."),
        writes: "setUnitAmenities",
        render: () => `<div class="sw-grid">${amenityChecks("uam", "unit", u.amenities, lang)}</div>`,
        save: async (e, form) => {
          await setUnitAmenities(e.siteId, u.id, composeAmenities(form.getAll("uam"), "", "unit"));
          return {};
        },
      });
    }
  }
  return steps;
}

function emailSteps(env: StepEnv): SetupStep[] {
  const { lang } = env;
  const s = env.ctx.stored.get("email") ?? {};
  return [
    {
      key: "forward",
      question: T(lang, "Hová továbbítsuk a leveleket?"),
      lead: T(lang, "A meglévő, mindennap olvasott e-mail címe."),
      writes: "setSiteModuleConfig",
      render: () => textField("fw", T(lang, "Továbbítás ide"), String(s.forwardTo ?? ""), { type: "email", required: true }),
      save: async (e, form) => {
        const v = (form.get("fw") ?? "").trim();
        if (!EMAIL_RE.test(v)) return { error: T(lang, "Ez nem e-mail cím — nézze meg a @ utáni részt.") };
        return saveConfig(e, "email", { forwardTo: v });
      },
    },
  ];
}

function gallerySteps(env: StepEnv): SetupStep[] {
  const { lang, ctx } = env;
  return [
    {
      key: "upload",
      question: T(lang, "Feltölti a saját fotóit?"),
      lead: T(lang, "JPEG, PNG vagy WEBP, legfeljebb 6 MB képenként, egyszerre 12 kép. Az első feltöltés lecseréli a bemutató képeket."),
      writes: "/admin/photos",
      render: () =>
        `<div class="sw-box" data-sw-upload><input type="file" accept="image/jpeg,image/png,image/webp" multiple hidden data-sw-file>` +
        `<input type="file" accept="image/*" capture="environment" hidden data-sw-cam>` +
        `<button type="button" class="sw-btn sw-btn--p" data-sw-pick="file">${T(lang, "Fotók választása")}</button> ` +
        `<button type="button" class="sw-btn" data-sw-pick="cam">${T(lang, "Fényképezés")}</button>` +
        `<p class="sw-hint" data-sw-upmsg>${ctx.ownPhotos ? T(lang, "{n} saját fotó van fent.", { n: ctx.photoCount }) : T(lang, "Most {n} bemutató kép látszik.", { n: ctx.photoCount })}</p></div>`,
      save: async (e) => (e.ctx.ownPhotos ? {} : { error: T(lang, "Válasszon képeket, vagy nyomja meg: „Most kihagyom”.") }),
    },
  ];
}

function locationSteps(env: StepEnv): SetupStep[] {
  const { lang, ctx } = env;
  const s = ctx.stored.get("location") ?? {};
  return [
    {
      key: "address",
      question: T(lang, "Jó ez a cím?"),
      lead: T(lang, "Ezt a címet mutatja a térkép. Ha kell, javítsa, és írja mellé, hol lehet parkolni."),
      writes: "saveTenantContact",
      render: () =>
        textField("address", T(lang, "Cím"), ctx.address, { required: true }) +
        textField("park", T(lang, "Parkolás (nem kötelező)"), String(s.parkingNote ?? ""), { placeholder: T(lang, "pl. ingyenes parkolás az udvarban") }),
      save: async (e, form) => {
        const address = (form.get("address") ?? "").trim();
        if (address.length < 4) return { error: T(lang, "Adja meg a címet (utca, házszám).") };
        const r = await saveTenantContact(e.tenantId, { address });
        if (!r.ok) return { error: T(lang, "A címet nem sikerült menteni — nézze meg, és próbálja újra.") };
        const park = (form.get("park") ?? "").trim();
        if (park !== String(s.parkingNote ?? "")) return saveConfig(e, "location", { parkingNote: park });
        return {};
      },
    },
  ];
}

function uspSteps(env: StepEnv): SetupStep[] {
  const { lang } = env;
  const items = Array.isArray(env.ctx.stored.get("usp")?.items) ? (env.ctx.stored.get("usp")!.items as string[]) : [];
  return [
    {
      key: "items",
      question: T(lang, "Mi a három legerősebb érve?"),
      lead: T(lang, "Egy-egy rövid mondat. Amit a vendégei a legtöbbet dicsérnek."),
      writes: "setSiteModuleConfig",
      render: () => [0, 1, 2].map((i) => textField(`u${i}`, T(lang, "{i}. előny", { i: i + 1 }), items[i] ?? "")).join(""),
      save: async (e, form) => {
        const list = [0, 1, 2].map((i) => (form.get(`u${i}`) ?? "").trim()).filter(Boolean);
        if (!list.length) return { error: T(lang, "Írjon legalább egyet, vagy nyomja meg: „Most kihagyom”.") };
        return saveConfig(e, "usp", { items: list });
      },
    },
  ];
}

function reviewsSteps(env: StepEnv): SetupStep[] {
  const { lang } = env;
  const on = env.ctx.stored.get("reviews")?.collectEnabled !== false;
  return [
    {
      key: "collect",
      question: T(lang, "Írhatnak-e a vendégek véleményt az oldalon?"),
      lead: T(lang, "Csak az jelenik meg, amit Ön jóváhagy."),
      writes: "setSiteModuleConfig",
      render: () =>
        radio("rv", "yes", on ? "yes" : "no", T(lang, "Igen, gyűjtsünk véleményt"), T(lang, "Értesítjük, ha új vélemény jön")) +
        radio("rv", "no", on ? "yes" : "no", T(lang, "Most nem"), T(lang, "A rész véleménygyűjtés nélkül jelenik meg")),
      save: async (e, form) => {
        const v = form.get("rv");
        if (v !== "yes" && v !== "no") return { error: T(lang, "Válasszon egyet.") };
        return saveConfig(e, "reviews", { collectEnabled: v === "yes" });
      },
    },
  ];
}

function textsSteps(env: StepEnv): SetupStep[] {
  const { lang } = env;
  return [
    {
      key: "intro",
      question: T(lang, "Így mutatkozik be az oldalon"),
      lead: T(lang, "Javítsa vagy egészítse ki. Legalább 40 karakter."),
      writes: "saveTenantContent",
      render: () => `<label class="sw-field"><span>${T(lang, "Bemutatkozás")}</span><textarea name="intro" rows="6" required>${esc(env.ctx.intro)}</textarea></label>`,
      save: async (e, form) => {
        const intro = (form.get("intro") ?? "").trim();
        if (intro.length <= 40) return { error: T(lang, "Legalább 40 karakter kell (most {n}).", { n: intro.length }) };
        await saveTenantContent(e.tenantId, { intro });
        return {};
      },
    },
  ];
}

/** topic id → its questions, built from THIS site's data. Gate ④: every "steps" topic has an entry. */
export const STEP_SETS: Readonly<Record<string, (env: StepEnv) => SetupStep[]>> = {
  letting: lettingSteps,
  capacity: capacitySteps,
  pricing: pricingSteps,
  calendar: calendarSteps,
  booking: bookingSteps,
  hours: hoursSteps,
  amenities: amenitiesSteps,
  email: emailSteps,
  gallery: gallerySteps,
  location: locationSteps,
  usp: uspSteps,
  reviews: reviewsSteps,
  texts: textsSteps,
};
