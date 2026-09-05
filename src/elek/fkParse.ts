// FK scenario parser — the machine half of elek/charter/SCENARIO-FORMAT.md.
// Shared by the deterministic runner (elek/bin/runner.mts) and the console
// test-log page (which renders ONLY the human-truth checklist rows: the machine
// fields never reach the human tester's surface — two-track doctrine).

import { readFileSync, readdirSync, existsSync } from "node:fs";
import path from "node:path";

export const ELEK_ROOT = path.resolve(import.meta.dirname, "..", "..", "elek");
export const SCENARIO_DIR = path.join(ELEK_ROOT, "scenarios");

export type FkSurface = "konzol" | "tenant-admin" | "publikus";

export interface FkStep {
  /** The human-truth checklist row (what a person expects to see). */
  text: string;
  /** Reason why this step is machine-unjudgeable → runner status `manual`. */
  kezi: string | null;
  /** Route to navigate to before acting; null = stay on the current page. */
  ut: string | null;
  /** Session switch: operator-elek | tenant-elek | anon; null = inherit. */
  user: string | null;
  /** Actions, one per line: kattints/írd/válaszd/várj. */
  tedd: string[];
  /** Checks, one per line: látható/nem látható/darab/szövege. */
  vard: string[];
  /** Created-record marker for the leftover-data inventory. */
  adat: string | null;
}

export interface FkSection {
  title: string;
  steps: FkStep[];
}

export interface FkScenario {
  /** e.g. "FK-001" — from the H1 line. */
  id: string;
  title: string;
  cel: string;
  felulet: FkSurface;
  kontraktus: string | null;
  sections: FkSection[];
  /** Source file path (absolute). */
  file: string;
}

const FIELD_RE = /^\s{2,}(út|user|tedd\??|várd|kézi|adat):\s*(.*)$/;

export function parseFk(file: string): FkScenario {
  const lines = readFileSync(file, "utf8").split(/\r?\n/);
  let id = "";
  let title = "";
  let cel = "";
  let felulet: FkSurface | "" = "";
  let kontraktus: string | null = null;
  const sections: FkSection[] = [];
  let sec: FkSection | null = null;
  let step: FkStep | null = null;

  for (const line of lines) {
    const h1 = line.match(/^#\s+(FK-[A-Za-z0-9]+)\s*[—-]\s*(.+)$/);
    if (h1) {
      id = h1[1];
      title = h1[2].trim();
      continue;
    }
    const h2 = line.match(/^##\s+(.+)$/);
    if (h2) {
      sec = { title: h2[1].trim(), steps: [] };
      sections.push(sec);
      step = null;
      continue;
    }
    const head = line.match(/^(cél|felület|kontraktus):\s*(.*)$/);
    if (head && !sec) {
      if (head[1] === "cél") cel = head[2].trim();
      if (head[1] === "felület") felulet = head[2].trim() as FkSurface;
      if (head[1] === "kontraktus") kontraktus = head[2].trim() || null;
      continue;
    }
    const row = line.match(/^-\s+\[[ xX]?\]\s+(.+)$/);
    if (row) {
      if (!sec) throw new Error(`${file}: checklist-sor szakasz (##) előtt`);
      step = { text: row[1].trim(), kezi: null, ut: null, user: null, tedd: [], vard: [], adat: null };
      sec.steps.push(step);
      continue;
    }
    const field = line.match(FIELD_RE);
    if (field) {
      if (!step) throw new Error(`${file}: gépi mező checklist-sor nélkül: ${line.trim()}`);
      const [, key, valRaw] = field;
      const val = valRaw.trim();
      if (key === "út") step.ut = val;
      else if (key === "user") step.user = val;
      else if (key === "tedd") step.tedd.push(val);
      // `tedd?:` — best-effort action: state-dependent overlays (campaign cards,
      // one-time offers) sit over the page on SOME visits only; a hard action
      // would fail on the other branch. Prefixed so the runner knows to tolerate.
      else if (key === "tedd?") step.tedd.push(`?${val}`);
      else if (key === "várd") step.vard.push(val);
      else if (key === "kézi") step.kezi = val || "gépileg nem ítélhető";
      else if (key === "adat") step.adat = val;
    }
  }

  if (!id) throw new Error(`${file}: hiányzó H1 (\`# FK-… — cím\`)`);
  if (felulet !== "konzol" && felulet !== "tenant-admin" && felulet !== "publikus") {
    throw new Error(`${file}: érvénytelen vagy hiányzó \`felület:\` (${felulet || "üres"})`);
  }
  if (!sections.length || !sections.some((s) => s.steps.length)) {
    throw new Error(`${file}: nincs egyetlen checklist-lépés sem`);
  }
  return { id, title, cel, felulet, kontraktus, sections, file };
}

/** All scenarios in elek/scenarios/, sorted by id. */
export function listScenarios(): FkScenario[] {
  if (!existsSync(SCENARIO_DIR)) return [];
  return readdirSync(SCENARIO_DIR)
    .filter((f) => /^FK-.*\.md$/i.test(f))
    .sort()
    .map((f) => parseFk(path.join(SCENARIO_DIR, f)));
}

export function findScenario(id: string): FkScenario | null {
  return listScenarios().find((s) => s.id.toLowerCase() === id.toLowerCase()) ?? null;
}

/** Flat step count (for progress display). */
export function stepCount(fk: FkScenario): number {
  return fk.sections.reduce((a, s) => a + s.steps.length, 0);
}
