// Generator ↔ DB boundary (Pillar 2, slice 2). The generator reads a lead from
// the DB (the scraper is the writer) and records every rendered mock as a
// mock_artifact row — the seed of the curation gate (curator_decision).
// Kept as plain service functions so a future web layer / job runner can call
// them directly; the CLI (run.ts) is just a thin wrapper.

import { randomUUID } from "node:crypto";

import { sql } from "kysely";
import { db } from "../db/client.js";
import { slugify } from "../domains.js";
import type { QualifiedLead } from "../scraper/types.js";

export interface LoadedLead {
  /** DB primary key — needed to link the mock_artifact. */
  readonly id: string;
  /** The full qualified lead, rehydrated from lead.raw. */
  readonly lead: QualifiedLead;
}

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Load a lead to generate for. No arg → the most recently scraped lead; a UUID
 * → by id; anything else → newest lead whose name contains the string.
 */
export async function loadLead(idOrName?: string): Promise<LoadedLead> {
  let query = db.selectFrom("lead").select(["id", "raw"]);
  if (idOrName && UUID_RE.test(idOrName)) {
    query = query.where("id", "=", idOrName);
  } else if (idOrName) {
    query = query.where("name", "ilike", `%${idOrName}%`);
  }
  const row = await query
    .orderBy("created_at", "desc")
    .limit(1)
    .executeTakeFirst();
  if (!row) {
    throw new Error(
      idOrName
        ? `No lead in the DB matching "${idOrName}". Run the scraper first.`
        : "No leads in the DB. Run the scraper first.",
    );
  }
  return { id: row.id, lead: row.raw as unknown as QualifiedLead };
}

/**
 * Archetypes already used by mocks in a region — the anti-collision input for AI
 * generation (so neighbours don't get the same structure). Reads the archetype
 * off each mock_artifact.inputs (recorded by the AI generator).
 */
export async function usedArchetypesInRegion(
  regionId: string,
): Promise<string[]> {
  const rows = await db
    .selectFrom("mock_artifact")
    .innerJoin("lead", "lead.id", "mock_artifact.lead_id")
    .innerJoin("scrape_run", "scrape_run.id", "lead.scrape_run_id")
    .innerJoin(
      "scraper_definition",
      "scraper_definition.id",
      "scrape_run.scraper_definition_id",
    )
    .select(sql<string | null>`mock_artifact.inputs->>'archetype'`.as("archetype"))
    .where("scraper_definition.region", "=", regionId)
    .execute();
  const set = new Set<string>();
  for (const r of rows) if (r.archetype) set.add(r.archetype);
  return [...set];
}

/**
 * EGY ARTEFAKTUM = EGY FÁJL (ADR-0140).
 *
 * ⛔⛔ MÉRT HIBA (2026-09-13): a fájlnév a lead nevéből és a sablonból állt össze,
 * tehát UGYANANNAK a leadnek UGYANAZZAL a sablonnal való újragenerálása FELÜLÍRTA a
 * korábbi artefaktum fájlját. Mérve a dev-parkon: **10 fájlon 29 artefaktum** osztozik.
 *
 * Miért súlyos: a `/mock/<id>` és a `/p/<token>` a `mock_artifact.path`-ból olvas, tehát
 * a régi artefaktum linkje az ÚJ tartalmat szolgálja ki. A kurátor mást hagyott jóvá,
 * mint ami a leadhez kimegy — ez a §I (ígéret ⇔ szállítás) közvetlen sérülése. Ugyanez
 * tette megtéveszthetővé az ADR-0134 kép-kaput: a felülírt régi artefaktumra az ÚJ fájl
 * képeit mértük, így egy törött mock zöldre válthatott attól, hogy mellé generáltak egyet.
 * A `heroOverride` és a `recopy` szintén `row.path`-ba ír — közös fájlon ezek NÉMÁN
 * átírták egy másik artefaktum tartalmát.
 *
 * A név ezért az ARTEFAKTUM AZONOSÍTÓJÁBÓL származik, egyetlen helyen — a korábbi három
 * másolat egyike sem tette egyedivé. A `generateEngine` kommentje már ki is mondta, hogy
 * „one artifact = one file", de a szabály csak a SABLON-változatokat választotta szét.
 */
export function mockArtifactPath(leadName: string, variant: string, artifactId: string): string {
  // Az azonosító első szelete adja az EGYEDISÉGET (UUID-v4), a név és a változat csak
  // olvashatóság — a teljes UUID a DB-ben van. A változat elhagyható (a régi
  // `generate.ts` útnak nem volt sablon-utótagja); a fájl attól még egyedi marad.
  const v = slugify(variant);
  return `mock-${slugify(leadName)}${v ? `-${v}` : ""}-${artifactId.slice(0, 8)}.html`;
}

/** Az azonosítót a RENDER ELŐTT kérjük el, mert a fájlnév belőle származik. */
export function newArtifactId(): string {
  return randomUUID();
}

/**
 * Record a rendered mock as a mock_artifact (status defaults to 'generated').
 * `inputs` is a snapshot of what fed generation, for audit + reproducibility.
 *
 * Az `id` KÖTELEZŐ, ha a fájlnév belőle készült: enélkül a sor más azonosítót kapna,
 * mint ami a lemezen van, és a kettő némán elválna.
 */
export async function recordMockArtifact(input: {
  leadId: string;
  path: string;
  inputs: Record<string, unknown>;
  id?: string;
}): Promise<string> {
  const row = await db
    .insertInto("mock_artifact")
    .values({
      ...(input.id ? { id: input.id } : {}),
      lead_id: input.leadId,
      path: input.path,
      inputs: JSON.stringify(input.inputs),
    })
    .returning("id")
    .executeTakeFirstOrThrow();
  return row.id;
}
