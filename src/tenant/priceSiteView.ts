// Where the owner's prices show on the GUEST page — the data behind the Árak screen's
// „Hol látják a vendégek az árait?" box (owner ruling 2026-09-28, approved plan
// assets/design-refs/tenant-admin/price-where-2/).
//
// ⛔ Read from the FINAL page data (the same `effective` SiteData the renderer gets) and
// decided by the renderer's own `siteShowsPriceTable()` — never re-derived. ADR-0059 §2
// leaves the price table out when the room cards already carry the same numbers; a
// second copy of that rule here would sooner or later tell the owner something the page
// does not do (feedback_one_rule_two_copies).

import { siteShowsPriceTable } from "../engine/moduleSections.js";
import { effectiveSiteForMultilang } from "./editor.js";

export interface PriceSiteView {
  /** Does the page carry the separate price table? (siteShowsPriceTable) */
  readonly table: boolean;
  /** Why it does, when it does — only the reasons the owner controls on the Árak screen. */
  readonly tableBecause: { readonly seasons: boolean; readonly note: boolean };
  /** Room cards WITH a price line, exactly as the guest reads them ("24 000 Ft / éj"). */
  readonly cards: readonly { readonly name: string; readonly price: string }[];
  /** Room cards WITHOUT a price line (unit id = the card anchor on the Árak screen). */
  readonly unpriced: readonly { readonly id: string; readonly name: string }[];
  /** Of those, the unit ids the price table does not list either — no price ANYWHERE. */
  readonly nowhere: readonly string[];
}

/** null = the tenant has no page data yet (nothing is shown to anyone). */
export async function priceSiteView(tenantId: string): Promise<PriceSiteView | null> {
  const eff = await effectiveSiteForMultilang(tenantId);
  if (!eff) return null;
  const d = eff.effective;
  const rooms = d.rooms ?? [];
  const inTable = new Set((d.pricing?.units ?? []).map((u) => u.name));
  const unpriced = rooms
    // ADR-XXXX: a presentation room (the place is let only as one) has no price by design —
    // it is not a gap and the guest does not ask it for a quote (the house is the offer).
    .filter((r) => !r.price && r.unitId && !r.presentation)
    .map((r) => ({ id: r.unitId!, name: r.name }));
  return {
    table: siteShowsPriceTable(d),
    tableBecause: {
      seasons: (d.pricing?.units ?? []).some((u) => Boolean(u.seasons?.length)),
      note: Boolean(d.pricing?.note),
    },
    cards: rooms.filter((r) => r.price).map((r) => ({ name: r.name, price: r.price! })),
    unpriced,
    nowhere: unpriced.filter((u) => !inTable.has(u.name)).map((u) => u.id),
  };
}
