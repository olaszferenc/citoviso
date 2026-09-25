// The console's navigation TREE — ONE registry, every surface derives from it
// (owner decree, 2026-09-25: „struktúrát építs — lesz még számos alrész meg főrész").
//
// Contract: assets/design-refs/console/linear-shell/README.md. A MODULE (group) is a
// row in the sidebar that is itself a page — its own dashboard at `href` — and folds
// the tree beneath it; a FUNCTION (leaf) is a screen. Adding a sub-section = one more
// node here; the sidebar, the module dashboard, the breadcrumb, the ⌘K search, the
// phone's drawer and bottom bar all read this tree — none of them keeps its own list.
//
// Depth is not limited: a group may hold groups. Counts are NOT here — they come from
// the request (navCounts.ts) keyed by node id, so this file stays free of the DB.
//
// A FUNCTION of the reader's language (ADR-0067 ③): labels translate at RENDER time,
// and the T() calls keep LITERAL source strings for the catalog extractor. `href` and
// `match` are routing, not text — never translated.

import { T } from "../i18n/mail.js";

export interface NavLeaf {
  readonly kind: "leaf";
  readonly id: string;
  readonly label: string;
  /** Sidebar label when the full one would not fit 232 px (the module page and ⌘K keep the full text). */
  readonly short?: string;
  readonly icon?: string;
  readonly href: string;
  /** Path prefixes (besides `href` itself) that mark this leaf active — e.g. the lead page under the lead list. */
  readonly match?: readonly string[];
}

export interface NavGroup {
  readonly kind: "group";
  readonly id: string;
  readonly label: string;
  readonly icon: string;
  /** One sentence: what the module is for (module dashboard + ⌘K). */
  readonly role: string;
  /** The module's OWN dashboard. */
  readonly href: string;
  readonly children: readonly NavNode[];
}

export type NavNode = NavLeaf | NavGroup;

/** A count or a badge beside a node (sidebar, module page, ⌘K). */
export interface NavMark {
  readonly n?: number | string;
  readonly badge?: { readonly text: string; readonly tone: "ok" | "warn" | "bad" };
  /** Tooltip explaining what the number counts (Elek FK-003: a badge and the list it opens must agree). */
  readonly title?: string;
}
export type NavCounts = Readonly<Record<string, NavMark>>;

/** The raw numbers a request loads once (navCounts.ts); the marks are derived at render time
 *  in the reader's language. Only counts the operator can act on from the node — a number that
 *  answers a different question than the screen it opens is a false label. */
export interface NavNumbers {
  /** Every scraped player, disqualified ones included — what „Lead-sor" (all=1) lists. */
  readonly players: number;
  readonly approvedMocks: number;
  readonly documents: number;
  readonly partners: number;
  readonly sellable: number;
  readonly catalog: number;
}

/** Numbers → marks beside the nodes. Pure, so a guard can feed fixtures; null → no marks. */
export function navCountsOf(n: NavNumbers | null, lang = "hu"): NavCounts {
  if (!n) return {};
  return {
    leads: {
      n: n.players,
      title: T(lang, "{n} felmért szereplő összesen, a diszkvalifikáltakkal együtt — a link a szűretlen AKTÍV listát nyitja, a diszkvalifikáltak külön nézetben vannak", { n: n.players }),
    },
    approved: { n: n.approvedMocks },
    documents: { n: n.documents },
    partners: { n: n.partners },
    pricing: {
      badge: {
        text: T(lang, "{on}/{all} eladó", { on: String(n.sellable), all: String(n.catalog) }),
        tone: n.sellable < n.catalog ? "warn" : "ok",
      },
    },
  };
}

/** Module dashboards live under one prefix so a new main section never collides with a screen. */
export const HUB_PREFIX = "/hub/";

export function navTree(lang = "hu"): readonly NavNode[] {
  return [
    { kind: "leaf", id: "home", label: T(lang, "Irányítópult"), icon: "home", href: "/" },
    {
      kind: "group",
      id: "crm",
      label: "CRM",
      icon: "leads",
      role: T(lang, "Lead-től a megrendelésig — akit megszólítunk, és ahol tart."),
      href: `${HUB_PREFIX}crm`,
      children: [
        { kind: "leaf", id: "leads", label: T(lang, "Lead-sor"), href: "/leads", match: ["/lead/"] },
        { kind: "leaf", id: "approved", label: T(lang, "Jóváhagyott mockok"), href: "/leads?mock=approved" },
        { kind: "leaf", id: "duplicates", label: T(lang, "Duplikátumok"), href: "/duplicates" },
        { kind: "leaf", id: "scrape", label: T(lang, "Adatgyűjtés indítása"), href: "/scrape" },
        { kind: "leaf", id: "map", label: T(lang, "Térkép (lefedettség)"), href: "/scrape/map" },
        { kind: "leaf", id: "regions", label: T(lang, "Területek"), href: "/scrape/regions" },
        { kind: "leaf", id: "pricing", label: T(lang, "Árazás és értékesítés"), short: T(lang, "Árazás"), href: "/pricing" },
      ],
    },
    {
      kind: "group",
      id: "finance",
      label: T(lang, "Pénzügy"),
      icon: "pricing",
      role: T(lang, "Bizonylatok, partnerek, árazás — a pénz papír-oldala."),
      href: `${HUB_PREFIX}finance`,
      children: [
        { kind: "leaf", id: "documents", label: T(lang, "Bizonylat keresése"), href: "/documents", match: ["/accounting-document"] },
        { kind: "leaf", id: "document-new", label: T(lang, "Új bizonylat rögzítése"), href: "/documents/new" },
        { kind: "leaf", id: "open-items", label: T(lang, "Nyitott tételek"), href: "/documents?paid=0" },
        { kind: "leaf", id: "partners", label: T(lang, "Partnerek"), href: "/partners", match: ["/partner/"] },
        { kind: "leaf", id: "partner-new", label: T(lang, "Új partner rögzítése"), href: "/partners/new" },
      ],
    },
    {
      kind: "group",
      id: "report",
      label: T(lang, "Riport"),
      icon: "report",
      role: T(lang, "Mi termel és mi szivárog — a döntéshez elég szám."),
      href: `${HUB_PREFIX}report`,
      children: [
        { kind: "leaf", id: "funnel", label: T(lang, "Megkeresés-tölcsér — hol akadnak el"), short: T(lang, "Megkeresés-tölcsér"), href: "/report" },
        { kind: "leaf", id: "sent", label: T(lang, "Kiküldött megkeresések"), href: "/report#sent" },
        { kind: "leaf", id: "orders", label: T(lang, "Megkezdett rendelések"), href: "/report#orders" },
      ],
    },
    {
      kind: "group",
      id: "system",
      label: T(lang, "Rendszer"),
      icon: "settings",
      role: T(lang, "Fiók, jelszó, működési beállítások."),
      href: `${HUB_PREFIX}system`,
      children: [{ kind: "leaf", id: "settings", label: T(lang, "Beállítások"), href: "/settings" }],
    },
    { kind: "leaf", id: "help", label: T(lang, "Súgó"), icon: "help", href: "/help" },
  ];
}

/** Top-level groups in order (the phone's bottom bar takes the first three). */
export function navGroups(tree: readonly NavNode[] = navTree()): readonly NavGroup[] {
  return tree.filter((n): n is NavGroup => n.kind === "group");
}

export function findGroup(id: string, tree: readonly NavNode[] = navTree()): NavGroup | null {
  for (const n of tree) {
    if (n.kind !== "group") continue;
    if (n.id === id) return n;
    const inner = findGroup(id, n.children);
    if (inner) return inner;
  }
  return null;
}

/** Every leaf with its ancestor groups — the ⌘K index and the module lists. */
export function navLeaves(
  tree: readonly NavNode[] = navTree(),
  trail: readonly NavGroup[] = [],
): ReadonlyArray<{ readonly leaf: NavLeaf; readonly trail: readonly NavGroup[] }> {
  const out: Array<{ leaf: NavLeaf; trail: readonly NavGroup[] }> = [];
  for (const n of tree) {
    if (n.kind === "leaf") out.push({ leaf: n, trail });
    else out.push(...navLeaves(n.children, [...trail, n]));
  }
  return out;
}

/** The path in a href, query and hash stripped — what `match` compares against. */
function pathOf(href: string): string {
  return href.replace(/[?#].*$/, "");
}

/**
 * The ancestor chain (root → active node) for a page's `active` path. The deepest,
 * longest match wins: „/lead/abc" lights „Lead-sor" (via match) inside „CRM"; „/hub/crm"
 * lights the CRM group itself. Unknown path → empty trail (nothing highlighted).
 */
export function activeTrail(active: string | undefined, tree: readonly NavNode[] = navTree()): readonly NavNode[] {
  if (!active) return [];
  const a = pathOf(active);
  let best: { trail: readonly NavNode[]; len: number } = { trail: [], len: -1 };
  const walk = (nodes: readonly NavNode[], trail: readonly NavNode[]): void => {
    for (const n of nodes) {
      const here = [...trail, n];
      const own = pathOf(n.href);
      const prefixes = [own, ...(n.kind === "leaf" ? (n.match ?? []) : [])];
      for (const p of prefixes) {
        const hit = p === "/" ? a === "/" : a === p || a.startsWith(p.endsWith("/") ? p : `${p}/`) || a.startsWith(p);
        if (hit && p.length > best.len) best = { trail: here, len: p.length };
      }
      if (n.kind === "group") walk(n.children, here);
    }
  };
  walk(tree, []);
  return best.trail;
}
