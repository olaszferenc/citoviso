// Test-log persistence — file-based BY DESIGN, not Postgres: the shared dev DB
// is wiped by parallel sessions (reference_shared_dev_db_has_no_backup) while a
// test log must survive exactly those events. Per-user JSON = current state,
// append-only history.jsonl = audit trail (who saved what, when).
//
// Two-track doctrine (elek/charter/CHARTER.md): the `elek` app-user's saves are
// EXCLUDED from the shared save list — they are only reachable via the explicit
// ?user=elek viewer link.

import { existsSync, mkdirSync, readFileSync, writeFileSync, appendFileSync } from "node:fs";
import path from "node:path";
import { ELEK_ROOT } from "./fkParse.js";

const DATA_DIR = path.resolve(ELEK_ROOT, "..", "data", "test-log");

/** The machine tester's app-user name — hidden from the shared save list. */
export const ELEK_USER = "elek";

export interface TestLogSave {
  user: string;
  fkId: string;
  ts: string;
  /** One flag per checklist step, in document order. */
  checks: boolean[];
  /** One free-text finding per section, in document order. */
  comments: string[];
  summary: string;
}

export interface TestLogHistoryRow {
  user: string;
  ts: string;
  done: number;
  total: number;
}

function fkDir(fkId: string): string {
  // Path-fence: the id becomes a directory name; strip anything non-slug.
  const safe = fkId.replace(/[^A-Za-z0-9_-]/g, "");
  if (!safe) throw new Error("üres FK-azonosító");
  return path.join(DATA_DIR, safe);
}

export function loadSave(fkId: string, user: string): TestLogSave | null {
  const safeUser = user.replace(/[^a-z0-9_-]/gi, "");
  const f = path.join(fkDir(fkId), `${safeUser}.json`);
  if (!existsSync(f)) return null;
  try {
    return JSON.parse(readFileSync(f, "utf8")) as TestLogSave;
  } catch {
    return null;
  }
}

export function persistSave(
  fkId: string,
  user: string,
  payload: { checks: boolean[]; comments: string[]; summary: string },
  total: number,
): TestLogSave {
  const dir = fkDir(fkId);
  mkdirSync(dir, { recursive: true });
  const safeUser = user.replace(/[^a-z0-9_-]/gi, "");
  const save: TestLogSave = {
    user: safeUser,
    fkId,
    ts: new Date().toISOString(),
    checks: payload.checks.map(Boolean),
    comments: payload.comments.map((c) => String(c ?? "")),
    summary: String(payload.summary ?? ""),
  };
  writeFileSync(path.join(dir, `${safeUser}.json`), JSON.stringify(save, null, 1));
  const row: TestLogHistoryRow = {
    user: safeUser,
    ts: save.ts,
    done: save.checks.filter(Boolean).length,
    total,
  };
  appendFileSync(path.join(dir, "history.jsonl"), JSON.stringify(row) + "\n");
  return save;
}

/** Latest save per user, newest first. The elek row is filtered UNLESS asked for. */
export function latestSaves(fkId: string, opts: { includeElek?: boolean } = {}): TestLogHistoryRow[] {
  const f = path.join(fkDir(fkId), "history.jsonl");
  if (!existsSync(f)) return [];
  const byUser = new Map<string, TestLogHistoryRow>();
  for (const line of readFileSync(f, "utf8").split("\n")) {
    if (!line.trim()) continue;
    try {
      const row = JSON.parse(line) as TestLogHistoryRow;
      byUser.set(row.user, row);
    } catch {
      // a torn write must not take the whole list down
    }
  }
  return [...byUser.values()]
    .filter((r) => opts.includeElek || r.user !== ELEK_USER)
    .sort((a, b) => b.ts.localeCompare(a.ts));
}
