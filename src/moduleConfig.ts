// Module CONFIG registry (ADR-0044) — the schema layer that makes a sold module
// actually settable by the owner who bought it.
//
// WHY: MODULE_CATALOG (src/modules.ts) owns what a module IS and what it COSTS.
// It had no notion of settings, so every module was a bare ON/OFF flag: a tenant
// could pay 990 Ft/month for "Online foglalás" and then not set one thing about
// it. This file closes that gap and the lint (scripts/module-config-lint.mts)
// keeps it closed: a module with priceMonthly > 0 MUST appear here.
//
// THREE DEFAULT LAYERS, merged on read (industry is a PARAMETER, not baked code):
//   catalog defaults  →  industry defaults  →  the site's stored config
// so a hairdresser's booking module ships different sensible defaults from a
// guesthouse's, out of the SAME module.
//
// CONFIG vs DATA: only small declarative settings live here. A module's growing,
// queryable data (availability days, booking requests, subscribers) belongs in
// its own tables — see migrations/0023_module_config.sql.
//
// ERGONOMICS (the target user has no digital footprint in 2026):
//   · every field has a working default — an untouched module still behaves;
//   · labels are the owner's words, never jargon ("Mikor van tele?", not "availability");
//   · few fields per module: each extra decision is a cost to the owner.
// All owner-facing text sits in THIS file, so wrapping the module-config surface
// for the language pack later is a single-file mechanical change (§B.18).

export type ModuleFieldType =
  | "text"
  | "textarea"
  | "number"
  | "toggle"
  | "select"
  | "time"
  | "email"
  /** Free list, one item per line. */
  | "lines";

export interface ModuleFieldOption {
  readonly value: string;
  readonly label: string;
}

export interface ModuleField {
  readonly key: string;
  readonly type: ModuleFieldType;
  /** Owner-facing label — plain language. */
  readonly label: string;
  /** One line under the field: WHY it matters, in the owner's terms. */
  readonly help?: string;
  readonly placeholder?: string;
  readonly min?: number;
  readonly max?: number;
  /** Unit rendered after a number input, e.g. "éjszaka". */
  readonly suffix?: string;
  readonly options?: readonly ModuleFieldOption[];
  /** Cap for `lines` fields. */
  readonly maxItems?: number;
}

export type ModuleConfigValues = Record<string, unknown>;

export interface ModuleConfigDef {
  /** Bump when the shape changes; `migrate` moves older rows forward on read. */
  readonly version: number;
  /** Declarative fields, drawn by the generic admin form renderer. */
  readonly fields: readonly ModuleField[];
  readonly defaults: ModuleConfigValues;
  /** Industry-keyed overlays on top of `defaults` (industry = parameter). */
  readonly industryDefaults?: Readonly<Record<string, ModuleConfigValues>>;
  /** Bespoke editor id for what a generic form cannot express (a calendar). */
  readonly editor?: string;
  /** Short owner-facing note shown above a bespoke editor. */
  readonly editorNote?: string;
  /** Forward-migrate a stored config written by an older version. */
  readonly migrate?: (fromVersion: number, config: ModuleConfigValues) => ModuleConfigValues;
  /** Owner-facing validation messages; empty array = valid. */
  readonly validate?: (config: ModuleConfigValues) => string[];
}

const NOTIFY_HELP = "Ide küldjük az értesítést. Erre a címre érkeznek a vendégek üzenetei.";

export const MODULE_CONFIG_REGISTRY: Readonly<Record<string, ModuleConfigDef>> = {
  // The old "Hogyan mutassuk a képeket?" selector (grid/carousel/mosaic) was removed:
  // each of the 16 art templates arranges photos in its OWN direction, so the choice
  // either did nothing (as it did) or fought the design. Selling a control that
  // cannot act is the same lie as selling a module with no settings at all.
  // What DOES carry to every template is the DATA: photos[0] is the cover everywhere,
  // and the list length decides how many appear. So that is what the owner controls —
  // the order and cover live on the Fotók tab, next to the photos themselves.
  gallery: {
    version: 1,
    fields: [
      {
        key: "maxPhotos",
        type: "number",
        label: "Hány képet mutassunk az oldalon?",
        min: 3,
        max: 40,
        suffix: "kép",
        help: "A sorrendet és a főképet a „Fotók” fülön állítja be — az első kép lesz a nyitókép.",
      },
    ],
    defaults: { maxPhotos: 12 },
  },

  // The rooms module DISPLAYS the site's bookable units (site_unit) — the same rows
  // the booking module makes bookable and the pricing module puts a number on.
  // It deliberately has NO list of its own: a second list would be free to disagree
  // with the calendar about what the owner actually rents out.
  rooms: {
    version: 1,
    fields: [],
    defaults: {},
    editor: "rooms",
  },

  amenities: {
    version: 1,
    fields: [
      {
        key: "items",
        type: "lines",
        label: "Mit kap a vendég?",
        help: "Soronként egy dolog. Például: Ingyenes wifi / Ingyenes parkolás / Reggeli / Klíma",
        placeholder: "Ingyenes wifi",
        maxItems: 24,
      },
    ],
    defaults: { items: [] },
  },

  pricing: {
    version: 1,
    fields: [
      {
        key: "currency",
        type: "select",
        label: "Pénznem",
        options: [
          { value: "HUF", label: "Forint (Ft)" },
          { value: "EUR", label: "Euró (€)" },
        ],
      },
      {
        key: "unit",
        type: "select",
        label: "Mire vonatkozik az ár?",
        options: [
          { value: "per_night", label: "Éjszakánként" },
          { value: "per_person_night", label: "Fő / éjszaka" },
          { value: "per_stay", label: "A teljes tartózkodásra" },
        ],
      },
      {
        key: "note",
        type: "text",
        label: "Megjegyzés az árakhoz",
        help: "Például: Az ár tartalmazza az idegenforgalmi adót.",
      },
    ],
    defaults: { currency: "HUF", unit: "per_night", note: "" },
    // The amounts themselves are per UNIT (unit_price, 0025) — an owner prices a
    // room, not an abstract season — so they live in the bespoke editor, not in a
    // field here. What stays here is what genuinely applies site-wide.
    editor: "pricing",
  },

  usp: {
    version: 1,
    fields: [
      {
        key: "items",
        type: "lines",
        label: "Miért Önt válasszák?",
        help: "Soronként egy erősség, rövid mondatban. Legfeljebb hatot mutatunk.",
        placeholder: "Közvetlenül a strand mellett",
        maxItems: 6,
      },
    ],
    defaults: { items: [] },
  },

  reviews: {
    version: 1,
    fields: [
      {
        key: "source",
        type: "select",
        label: "Honnan mutassuk a véleményeket?",
        options: [
          { value: "google", label: "A Google-értékelésekből" },
          { value: "own", label: "Csak amit az oldalon írnak" },
          { value: "both", label: "Mindkettőből" },
        ],
      },
      {
        key: "minStars",
        type: "number",
        label: "Csak ennyi csillagtól mutassuk",
        min: 1,
        max: 5,
        suffix: "csillag",
        help: "A gyengébb értékelések nem jelennek meg az oldalon.",
      },
      { key: "maxCount", type: "number", label: "Hány véleményt mutassunk", min: 1, max: 20, suffix: "db" },
    ],
    defaults: { source: "google", minStars: 4, maxCount: 6 },
  },

  poi: {
    version: 1,
    fields: [
      {
        key: "items",
        type: "lines",
        label: "Mi van a közelben?",
        help: "Soronként egy hely, ha tudja, távolsággal. Például: Strand — 300 m",
        placeholder: "Strand — 300 m",
        maxItems: 12,
      },
    ],
    defaults: { items: [] },
  },

  enquiry: {
    version: 1,
    fields: [
      { key: "notifyEmail", type: "email", label: "Hová küldjük az érdeklődéseket?", help: NOTIFY_HELP },
      {
        key: "askPhone",
        type: "toggle",
        label: "Kérjük a vendég telefonszámát is",
        help: "Telefonszámmal gyorsabban egyeztet, de kevesebben töltik ki az űrlapot.",
      },
      {
        key: "responseNote",
        type: "text",
        label: "Mit ígérünk a vendégnek?",
        placeholder: "24 órán belül válaszolunk",
        help: "Ez jelenik meg az űrlap alatt. Csak olyat írjon, amit tartani tud.",
      },
    ],
    defaults: { notifyEmail: "", askPhone: true, responseNote: "24 órán belül válaszolunk" },
  },

  location: {
    version: 1,
    fields: [
      { key: "showMap", type: "toggle", label: "Térkép látszódjon" },
      {
        key: "approachNote",
        type: "textarea",
        label: "Hogyan találnak oda?",
        placeholder: "A főúton a templomnál forduljon jobbra, a ház a harmadik a sorban.",
        help: "Amit telefonban szokott elmondani. Ez a leghasznosabb szöveg az egész oldalon.",
      },
      { key: "parkingNote", type: "text", label: "Parkolás", placeholder: "Ingyenes parkolás az udvarban" },
    ],
    defaults: { showMap: true, approachNote: "", parkingNote: "" },
  },

  hours: {
    version: 1,
    fields: [
      { key: "checkInFrom", type: "time", label: "Érkezni ettől lehet" },
      { key: "checkInTo", type: "time", label: "Érkezni eddig lehet" },
      { key: "checkOutUntil", type: "time", label: "Távozás eddig" },
      {
        key: "note",
        type: "text",
        label: "Megjegyzés",
        placeholder: "Késői érkezés előre egyeztetve lehetséges",
      },
    ],
    defaults: { checkInFrom: "14:00", checkInTo: "20:00", checkOutUntil: "10:00", note: "" },
    industryDefaults: {
      // A restaurant has no check-in/out; the module degrades to opening hours.
      restaurant: { checkInFrom: "11:00", checkInTo: "22:00", checkOutUntil: "22:00" },
    },
    validate: (c) => {
      const errs: string[] = [];
      const from = String(c.checkInFrom ?? "");
      const to = String(c.checkInTo ?? "");
      if (from && to && from >= to) errs.push("Az érkezés kezdete korábbi kell legyen, mint a vége.");
      return errs;
    },
  },

  booking: {
    version: 1,
    fields: [
      {
        key: "minNights",
        type: "number",
        label: "Legrövidebb foglalás",
        min: 1,
        max: 30,
        suffix: "éjszaka",
        help: "Ennél rövidebb időre nem lehet foglalni.",
      },
      {
        key: "maxNights",
        type: "number",
        label: "Leghosszabb foglalás",
        min: 1,
        max: 365,
        suffix: "éjszaka",
      },
      {
        key: "horizonMonths",
        type: "number",
        label: "Meddig előre lehet foglalni",
        min: 1,
        max: 24,
        suffix: "hónap",
      },
      {
        key: "leadTimeDays",
        type: "number",
        label: "Legkorábbi érkezés mostantól",
        min: 0,
        max: 60,
        suffix: "nap",
        help: "0 = akár mai napra is foglalhatnak.",
      },
      { key: "notifyEmail", type: "email", label: "Hová küldjük a foglalási kéréseket?", help: NOTIFY_HELP },
      {
        key: "autoDeclineHours",
        type: "number",
        label: "Ennyi idő után magától lejár a kérés",
        min: 0,
        max: 336,
        suffix: "óra",
        help: "Ha nem válaszol, a vendég értesítést kap, hogy szabadon keressen máshol. 0 = sosem jár le.",
      },
    ],
    defaults: {
      minNights: 1,
      maxNights: 30,
      horizonMonths: 12,
      leadTimeDays: 0,
      notifyEmail: "",
      autoDeclineHours: 48,
    },
    editor: "booking",
    editorNote: "Koppintson a naptárban azokra a napokra, amikor tele van.",
    validate: (c) => {
      const errs: string[] = [];
      const min = Number(c.minNights ?? 1);
      const max = Number(c.maxNights ?? 30);
      if (min > max) errs.push("A legrövidebb foglalás nem lehet hosszabb, mint a leghosszabb.");
      return errs;
    },
  },

  newsletter: {
    version: 1,
    fields: [
      { key: "title", type: "text", label: "Felirat a feliratkozó doboz fölött", placeholder: "Maradjunk kapcsolatban" },
      {
        key: "subtitle",
        type: "text",
        label: "Rövid magyarázat",
        placeholder: "Évente néhányszor írunk, akciókról és szabad időpontokról.",
      },
      { key: "notifyEmail", type: "email", label: "Hová küldjük az új feliratkozókat?", help: NOTIFY_HELP },
    ],
    defaults: {
      title: "Maradjunk kapcsolatban",
      subtitle: "Évente néhányszor írunk, akciókról és szabad időpontokról.",
      notifyEmail: "",
    },
  },

  email: {
    version: 1,
    fields: [
      {
        key: "localPart",
        type: "text",
        label: "Milyen címet szeretne?",
        placeholder: "info",
        help: "A webcíme elé kerül. Ha ide „info”-t ír, a címe info@ lesz a saját domainjén.",
      },
      {
        key: "forwardTo",
        type: "email",
        label: "Hová továbbítsuk a leveleket?",
        help: "Az ide érkező leveleket erre a meglévő címére küldjük tovább.",
      },
    ],
    defaults: { localPart: "info", forwardTo: "" },
    validate: (c) => {
      const errs: string[] = [];
      const lp = String(c.localPart ?? "");
      if (lp && !/^[a-z0-9](?:[a-z0-9._-]*[a-z0-9])?$/.test(lp)) {
        errs.push("A cím eleje csak angol kisbetűt, számot, pontot és kötőjelet tartalmazhat.");
      }
      return errs;
    },
  },
};

/**
 * The effective config for a module on a site: catalog defaults, overlaid with
 * the industry's defaults, overlaid with what the owner actually saved.
 * A missing/blank stored value falls through to the layer below, so a partially
 * filled form can never leave a module in a broken half-configured state.
 */
export function effectiveModuleConfig(
  moduleId: string,
  stored: ModuleConfigValues | null,
  industry?: string | null,
): ModuleConfigValues {
  const def = MODULE_CONFIG_REGISTRY[moduleId];
  if (!def) return { ...(stored ?? {}) };
  const industryLayer = (industry && def.industryDefaults?.[industry]) || {};
  return { ...def.defaults, ...industryLayer, ...(stored ?? {}) };
}

/**
 * Bring a stored config written by an older schema version up to the current one.
 * Pure: callers persist the result lazily (on the next save), never on read.
 */
export function migrateModuleConfig(
  moduleId: string,
  storedVersion: number,
  config: ModuleConfigValues,
): { version: number; config: ModuleConfigValues } {
  const def = MODULE_CONFIG_REGISTRY[moduleId];
  if (!def) return { version: storedVersion, config };
  if (storedVersion >= def.version) return { version: def.version, config };
  const migrated = def.migrate ? def.migrate(storedVersion, config) : config;
  return { version: def.version, config: migrated };
}

/** Owner-facing validation messages for a candidate config; empty = valid. */
export function validateModuleConfig(moduleId: string, config: ModuleConfigValues): string[] {
  return MODULE_CONFIG_REGISTRY[moduleId]?.validate?.(config) ?? [];
}

/** Does this module have anything for the owner to set (form fields or an editor)? */
export function isModuleConfigurable(moduleId: string): boolean {
  const def = MODULE_CONFIG_REGISTRY[moduleId];
  return Boolean(def && (def.fields.length > 0 || def.editor));
}
