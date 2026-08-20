// Suspected-duplicate detection and the curator's ruling on it.
//
// The signals (shared website / phone / e-mail / same doorstep) are STRONG but
// AMBIGUOUS — the 2026-08-20 survey of the live stock found all four of these
// behind them:
//   · one business, two names        → "Bánó Porta Köveskál" / "Bánó Gábor"
//   · one property, many units       → Abbázia Club Hotel Sárga/Kék/Piros/…
//   · one owner, several businesses  → Eldorádó Kemping / Eldorádó Fogadó
//   · a chain sharing one website    → Ensana Thermal Aqua / Ensana Thermal Hévíz
// Merging automatically would fuse two real hotels into one; ignoring the
// signal leaves duplicates in the funnel and mails the same owner twice. So the
// machine proposes and the operator rules — and the ruling is stored
// (lead_link) so a pair is never raised again.

import { sql } from "kysely";
import { db } from "../db/client.js";
import { deaccent, tokens } from "../scraper/enrichPresence.js";
import { distanceKm } from "../scraper/regions.js";
import type { ContactCandidate, PortalListing, QualifiedLead } from "../scraper/types.js";

export type DupSignal = "website" | "phone" | "email" | "proximity";
export type DupVerdict = "duplicate" | "same_owner" | "unrelated";

export interface DupCandidate {
  readonly a: DupLead;
  readonly b: DupLead;
  readonly signals: DupSignal[];
  /** Metres between the two, when both have coordinates. */
  readonly distanceM?: number;
}

export interface DupLead {
  readonly id: string;
  readonly name: string;
  readonly city?: string;
  readonly website?: string;
  readonly email?: string;
  readonly phone?: string;
  readonly qualification: string;
  readonly lifecycle: string;
  readonly contacts?: readonly ContactCandidate[];
  readonly listings?: readonly PortalListing[];
  readonly lat?: number;
  readonly lon?: number;
}

/** Same number written differently is the same number. */
function phoneKey(v?: string): string | undefined {
  if (!v) return undefined;
  const d = v.replace(/\D/g, "");
  const n = d.startsWith("0036")
    ? d.slice(4)
    : d.startsWith("36") && d.length >= 10
      ? d.slice(2)
      : d.startsWith("06")
        ? d.slice(2)
        : d;
  return n.length >= 8 ? n : undefined;
}

/** Host without www — two URLs on one host are the same presence. */
function hostKey(v?: string): string | undefined {
  if (!v) return undefined;
  try {
    return new URL(v).hostname.toLowerCase().replace(/^www\./, "");
  } catch {
    return undefined;
  }
}

/**
 * Distinctive name tokens — used ONLY to strengthen a proximity match. Trade
 * words are excluded: two "Apartman" entries next door are not evidence.
 */
const GENERIC = new Set([
  "szallas", "apartman", "apartmanok", "apartmanhaz", "vendeghaz", "vendeghazak",
  "panzio", "hotel", "haz", "villa", "kemping", "camping", "udulo", "tabor",
  "hely", "etterem", "vendeglo", "szoba", "szobak", "motel", "resort", "porta",
]);
function brandTokens(name: string): string[] {
  return tokens(name).filter((t) => t.length >= 4 && !GENERIC.has(t));
}

/**
 * Find pairs worth asking about, skipping any pair already ruled on.
 *
 * A shared PORTAL page is not a signal — three different apartments can sit on
 * the same apartman.hu listing page, which says nothing about ownership. Only a
 * shared OWN-site host counts, so the caller passes leads whose website already
 * classified as has_own.
 */
export async function findDuplicateCandidates(limit = 60): Promise<DupCandidate[]> {
  const rows = await db
    .selectFrom("lead")
    .select(["id", "name", "qualification", "lifecycle_status", "lat", "lng", "raw"])
    .where("lifecycle_status", "not in", ["terminated", "disqualified"])
    .execute();

  const leads: DupLead[] = rows.map((r) => {
    const raw = (typeof r.raw === "string" ? JSON.parse(r.raw) : r.raw) as QualifiedLead;
    return {
      id: r.id,
      name: r.name,
      city: raw.city,
      website: raw.website,
      email: raw.email,
      phone: raw.phone,
      qualification: r.qualification ?? "unknown",
      lifecycle: r.lifecycle_status,
      contacts: raw.contacts,
      listings: raw.listings,
      lat: r.lat ?? undefined,
      lon: r.lng ?? undefined,
    };
  });

  const decided = new Set(
    (await db.selectFrom("lead_link").select(["lead_a", "lead_b"]).execute()).map(
      (l) => `${l.lead_a}|${l.lead_b}`,
    ),
  );

  const pairs = new Map<string, { a: DupLead; b: DupLead; signals: Set<DupSignal> }>();
  const add = (x: DupLead, y: DupLead, signal: DupSignal): void => {
    const [a, b] = x.id < y.id ? [x, y] : [y, x];
    const key = `${a.id}|${b.id}`;
    if (decided.has(key)) return;
    const entry = pairs.get(key) ?? { a, b, signals: new Set<DupSignal>() };
    entry.signals.add(signal);
    pairs.set(key, entry);
  };

  // Index by each strong key.
  const byHost = new Map<string, DupLead[]>();
  const byPhone = new Map<string, DupLead[]>();
  const byEmail = new Map<string, DupLead[]>();
  for (const l of leads) {
    // Own-site host only — a shared portal listing proves nothing.
    const h = l.qualification !== "no_site" ? hostKey(l.website) : undefined;
    if (h) byHost.set(h, [...(byHost.get(h) ?? []), l]);
    // Every phone/e-mail we ever saw counts, not just the chosen one: the
    // duplicate pair often keeps DIFFERENT primaries (gmail vs freemail) while
    // sharing a number deeper in the ledger.
    const phones = new Set<string>();
    const emails = new Set<string>();
    for (const c of [
      ...(l.contacts ?? []),
      ...(l.phone ? [{ kind: "phone", value: l.phone } as ContactCandidate] : []),
      ...(l.email ? [{ kind: "email", value: l.email } as ContactCandidate] : []),
    ]) {
      if (c.kind === "phone") {
        const k = phoneKey(c.value);
        if (k) phones.add(k);
      } else {
        emails.add(c.value.trim().toLowerCase());
      }
    }
    for (const p of phones) byPhone.set(p, [...(byPhone.get(p) ?? []), l]);
    for (const e of emails) byEmail.set(e, [...(byEmail.get(e) ?? []), l]);
  }

  const fanOut = (map: Map<string, DupLead[]>, signal: DupSignal): void => {
    for (const group of map.values()) {
      if (group.length < 2) continue;
      // A value shared by a whole crowd is an intermediary's, not a link.
      if (group.length > 6) continue;
      for (let i = 0; i < group.length; i++) {
        for (let j = i + 1; j < group.length; j++) add(group[i]!, group[j]!, signal);
      }
    }
  };
  fanOut(byHost, "website");
  fanOut(byPhone, "phone");
  fanOut(byEmail, "email");

  // Proximity: same doorstep AND a shared distinctive name token. Without the
  // name test every neighbouring guesthouse would pair up.
  const withGeo = leads.filter((l) => l.lat != null && l.lon != null);
  for (let i = 0; i < withGeo.length; i++) {
    for (let j = i + 1; j < withGeo.length; j++) {
      const a = withGeo[i]!;
      const b = withGeo[j]!;
      const km = distanceKm(a.lat!, a.lon!, b.lat!, b.lon!);
      if (km > 0.06) continue; // ~60 m
      const ta = brandTokens(a.name);
      const tb = brandTokens(b.name);
      if (!ta.some((t) => tb.some((u) => deaccent(u) === deaccent(t)))) continue;
      add(a, b, "proximity");
    }
  }

  return [...pairs.values()]
    .map((p) => ({
      a: p.a,
      b: p.b,
      signals: [...p.signals],
      distanceM:
        p.a.lat != null && p.a.lon != null && p.b.lat != null && p.b.lon != null
          ? Math.round(distanceKm(p.a.lat, p.a.lon, p.b.lat, p.b.lon) * 1000)
          : undefined,
    }))
    // Strongest evidence first: more signals, then closer.
    .sort((x, y) => y.signals.length - x.signals.length || (x.distanceM ?? 1e9) - (y.distanceM ?? 1e9))
    .slice(0, limit);
}

export interface DupCluster {
  /** Stable id for the form: the smallest member id. */
  readonly id: string;
  readonly leads: DupLead[];
  readonly signals: DupSignal[];
  /** All pairs inside the cluster — the verdict is stored per pair. */
  readonly pairs: { a: string; b: string }[];
  readonly maxDistanceM?: number;
}

/**
 * Group the pairs into connected components.
 *
 * Six Abbázia buildings produce fifteen pairs, and asking fifteen times about
 * one hotel is not a workflow — the operator sees ONE group ("these six belong
 * together") and rules once. The ruling is still recorded pair by pair, so the
 * stored knowledge stays exact.
 */
/**
 * Is this pair strong enough to FUSE two records into one proposal?
 *
 * Grouping is transitive, so a weak edge contaminates everything it touches:
 * on the live stock a single shared agency website chained six apartments in
 * six different villages (34 km apart) into one "group", which is a false
 * claim, not a proposal. A lone website match across town is therefore not
 * enough — either several signals agree, or they are on the same doorstep.
 */
function isStrongEdge(c: DupCandidate): boolean {
  if (c.signals.length >= 2) return true;
  if (c.signals.includes("proximity")) return true;
  return c.distanceM != null && c.distanceM <= 300;
}

export function clusterCandidates(cands: DupCandidate[]): DupCluster[] {
  const parent = new Map<string, string>();
  const find = (x: string): string => {
    parent.set(x, parent.get(x) ?? x);
    let r = parent.get(x)!;
    while (r !== parent.get(r)) r = parent.get(r)!;
    parent.set(x, r);
    return r;
  };
  const union = (x: string, y: string): void => {
    const rx = find(x);
    const ry = find(y);
    if (rx !== ry) parent.set(rx, ry);
  };
  const strong = cands.filter(isStrongEdge);
  const byId = new Map<string, DupLead>();
  for (const c of strong) {
    byId.set(c.a.id, c.a);
    byId.set(c.b.id, c.b);
    union(c.a.id, c.b.id);
  }

  const groups = new Map<string, DupCluster & { signalSet: Set<DupSignal> }>();
  for (const c of strong) {
    const root = find(c.a.id);
    const g =
      groups.get(root) ??
      ({
        id: root,
        leads: [],
        signals: [],
        signalSet: new Set<DupSignal>(),
        pairs: [],
        maxDistanceM: undefined,
      } as DupCluster & { signalSet: Set<DupSignal> });
    for (const s of c.signals) g.signalSet.add(s);
    g.pairs.push({ a: c.a.id, b: c.b.id });
    if (c.distanceM != null) {
      (g as { maxDistanceM?: number }).maxDistanceM = Math.max(g.maxDistanceM ?? 0, c.distanceM);
    }
    groups.set(root, g);
  }
  for (const g of groups.values()) {
    const ids = new Set(g.pairs.flatMap((p) => [p.a, p.b]));
    const mut = g as { leads: DupLead[]; signals: DupSignal[] };
    mut.leads = [...ids].map((id) => byId.get(id)!).filter(Boolean);
    mut.signals = [...g.signalSet];
  }
  return [...groups.values()]
    .map(({ signalSet: _drop, ...g }) => g)
    .sort((x, y) => y.leads.length - x.leads.length || y.signals.length - x.signals.length);
}

/**
 * Record the ruling. For 'duplicate' the kept lead ABSORBS the other's contact
 * ledger and portal listings before the loser is disqualified — the whole point
 * is that no evidence is lost, only the second funnel entry.
 *
 * Disqualification (not deletion) is deliberate: it is the existing, reversible
 * mechanism, so a wrong merge can be undone from the console.
 */
export async function ruleOnPair(input: {
  aId: string;
  bId: string;
  verdict: DupVerdict;
  keptId?: string;
  signal?: string;
  note?: string;
}): Promise<void> {
  const [lead_a, lead_b] =
    input.aId < input.bId ? [input.aId, input.bId] : [input.bId, input.aId];

  if (input.verdict === "duplicate" && input.keptId) {
    const loserId = input.keptId === lead_a ? lead_b : lead_a;
    const rows = await db
      .selectFrom("lead")
      .select(["id", "name", "raw"])
      .where("id", "in", [input.keptId, loserId])
      .execute();
    const kept = rows.find((r) => r.id === input.keptId);
    const loser = rows.find((r) => r.id === loserId);
    if (kept && loser) {
      const k = (typeof kept.raw === "string" ? JSON.parse(kept.raw) : kept.raw) as QualifiedLead;
      const l = (typeof loser.raw === "string" ? JSON.parse(loser.raw) : loser.raw) as QualifiedLead;
      const { mergeContacts } = await import("../scraper/contactLedger.js");
      // The loser's sightings arrive tagged with where they came from, so the
      // merged card still shows which record each contact was found on.
      const absorbed = (l.contacts ?? []).map((c) => ({
        ...c,
        source: `${c.source} (${loser.name})`,
      }));
      const byUrl = new Map<string, PortalListing>();
      for (const x of [...(k.listings ?? []), ...(l.listings ?? [])]) {
        const prev = byUrl.get(x.url);
        byUrl.set(x.url, prev?.verified ? { ...x, verified: true } : x);
      }
      const merged: QualifiedLead = {
        ...k,
        // Gaps only — a curated value on the kept lead always wins.
        email: k.email ?? l.email,
        phone: k.phone ?? l.phone,
        website: k.website ?? l.website,
        city: k.city ?? l.city,
        contacts: mergeContacts(k.contacts, absorbed),
        listings: byUrl.size ? [...byUrl.values()] : k.listings,
      };
      await db
        .updateTable("lead")
        .set({ raw: sql`${JSON.stringify(merged)}::jsonb` })
        .where("id", "=", input.keptId)
        .execute();
      await db
        .updateTable("lead")
        .set({
          lifecycle_status: "disqualified",
          raw: sql`${JSON.stringify({
            ...l,
            disqualifiedReason: `duplikátum — összevonva ide: ${kept.name}`,
          })}::jsonb`,
        })
        .where("id", "=", loserId)
        .execute();
    }
  }

  await db
    .insertInto("lead_link")
    .values({
      lead_a,
      lead_b,
      verdict: input.verdict,
      kept_id: input.verdict === "duplicate" ? (input.keptId ?? null) : null,
      signal: input.signal ?? null,
      note: input.note ?? null,
    })
    .onConflict((oc) =>
      oc.columns(["lead_a", "lead_b"]).doUpdateSet({
        verdict: input.verdict,
        kept_id: input.verdict === "duplicate" ? (input.keptId ?? null) : null,
        note: input.note ?? null,
        decided_at: sql`now()`,
      }),
    )
    .execute();
}
