// Design plans read straight off the working tree (ADR-0068).
//
// WHY: the plan-approval gate (§2b) used to run through an external design app —
// upload, then hunt for a refresh button because its card index lagged behind the
// files. The owner's verdict (2026-08-25): "csak nem ergonomikus workflow… el fogjuk
// hagyni". So the plans move to the surface he already has open on his phone: the
// console. The list IS the directory listing, so a plan is visible the moment it
// lands — there is no index to rebuild and nothing to press.
//
// The owner's decision is stored OUTSIDE the repo, in the shared `sites/` volume
// (symlinked into every worktree), so any thread reads the same verdict and no
// runtime write ever touches version control.

import { readdir, readFile, stat, writeFile } from "node:fs/promises";
import path from "node:path";

const ROOT = "assets/design-refs";
const PICKS = "sites/_design-picks.json";

export interface DesignRef {
  /** Path relative to ROOT, e.g. "console/finance-c-tabla.html". */
  readonly rel: string;
  readonly group: string;
  readonly title: string;
  /** Last modification, epoch ms — drives "what is new since I last looked". */
  readonly mtime: number;
}

export interface DesignPick {
  readonly choice: "yes" | "no";
  readonly note: string;
  readonly at: string;
}

export interface DesignGroup {
  readonly group: string;
  readonly label: string;
  readonly hint: string;
  /** Archive folders (corpus, reference bar) open closed: they are background
   *  material, and a hundred of them would bury the plan actually being asked about. */
  readonly collapsed: boolean;
  readonly items: readonly DesignRef[];
}

/** Human labels + one line on what the folder is FOR (the list has to explain itself). */
const GROUPS: Readonly<Record<string, { label: string; hint: string; rank: number }>> = {
  "tenant-admin": { label: "Tenant-admin", hint: "A tulaj saját szerkesztő-felülete", rank: 1 },
  console: { label: "Konzol", hint: "Belső operátor-felület", rank: 2 },
  public: { label: "Publikus honlap", hint: "A citoviso.com felületei", rank: 3 },
  structures: { label: "Szerkezetek", hint: "Oldal-vázak", rank: 8 },
  "reference-quality": { label: "Referencia-minőség", hint: "A mérce", rank: 8 },
  corpus: { label: "Korpusz", hint: "Generált korpusz", rank: 9 },
};

/**
 * Metadata for a folder. A sub-folder inherits its parent's rank (so the corpus
 * sub-tiers stay archived, not promoted to the top of the page) and names itself
 * after the parent label.
 */
function groupMeta(group: string): { label: string; hint: string; rank: number } {
  const exact = GROUPS[group];
  if (exact) return exact;
  const top = group.split("/")[0] ?? group;
  const parent = GROUPS[top];
  const leaf = group.slice(top.length + 1);
  if (parent && leaf) return { label: `${parent.label} — ${leaf}`, hint: parent.hint, rank: parent.rank };
  return { label: group, hint: "", rank: 5 };
}

/** Reject anything that could climb out of ROOT or is not a plan file. */
export function resolveRef(rel: string): string | null {
  if (!rel || rel.includes("\0") || !rel.endsWith(".html")) return null;
  const base = path.resolve(process.cwd(), ROOT);
  const full = path.resolve(base, rel);
  if (full !== base && !full.startsWith(base + path.sep)) return null;
  return full;
}

/**
 * Title of a plan: its own <title>, else a leading design-card comment, else the
 * first <h1>, else the prettified file name. Read from the head of the file only —
 * the list must stay fast with a hundred plans in the tree.
 */
function titleOf(head: string, rel: string): string {
  const t =
    /<title[^>]*>([^<]+)<\/title>/i.exec(head)?.[1] ??
    /name="([^"]+)"/.exec(/<!--\s*@dsCard[^>]*-->/.exec(head)?.[0] ?? "")?.[1] ??
    /<h1[^>]*>([^<]+)<\/h1>/i.exec(head)?.[1];
  const clean = (t ?? "").replace(/\s+/g, " ").replace(/\s*[—–|]\s*Citoviso.*$/i, "").trim();
  if (clean) return clean;
  const name = path.basename(rel, ".html").replace(/[-_]+/g, " ");
  return name.charAt(0).toUpperCase() + name.slice(1);
}

/**
 * Every plan in the tree, grouped by folder, newest group and newest file first.
 * Walks SUB-folders too (the corpus keeps its plans one level deeper) — a plan the
 * list cannot show is a plan the owner never gets asked about.
 */
export async function listDesignRefs(): Promise<DesignGroup[]> {
  const base = path.resolve(process.cwd(), ROOT);
  const byGroup = new Map<string, DesignRef[]>();

  async function walk(relDir: string, depth: number): Promise<void> {
    let entries;
    try {
      entries = await readdir(path.join(base, relDir), { withFileTypes: true });
    } catch {
      return;
    }
    for (const e of entries) {
      if (e.name.startsWith("_") || e.name.startsWith(".")) continue;
      const rel = relDir ? `${relDir}/${e.name}` : e.name;
      if (e.isDirectory()) {
        if (depth < 3) await walk(rel, depth + 1);
        continue;
      }
      if (!e.isFile() || !e.name.endsWith(".html") || !relDir) continue;
      try {
        const full = path.join(base, rel);
        const st = await stat(full);
        const head = (await readFile(full, "utf8")).slice(0, 4096);
        const list = byGroup.get(relDir) ?? [];
        list.push({ rel, group: relDir, title: titleOf(head, rel), mtime: st.mtimeMs });
        byGroup.set(relDir, list);
      } catch {
        /* a file that vanished mid-listing is simply not shown */
      }
    }
  }
  await walk("", 0);

  const groups: DesignGroup[] = [];
  for (const [group, items] of byGroup) {
    items.sort((a, b) => b.mtime - a.mtime);
    const meta = groupMeta(group);
    groups.push({ group, label: meta.label, hint: meta.hint, collapsed: meta.rank >= 8, items });
  }

  // Working folders first (by their own rank), then whichever changed most recently —
  // the plan the owner is being asked about is always the one at the top.
  groups.sort((a, b) => {
    const ra = groupMeta(a.group).rank;
    const rb = groupMeta(b.group).rank;
    if (ra !== rb) return ra - rb;
    return (b.items[0]?.mtime ?? 0) - (a.items[0]?.mtime ?? 0);
  });
  return groups;
}

/** Find one plan (and its siblings, for prev/next stepping) by relative path. */
export async function findDesignRef(
  rel: string,
): Promise<{ item: DesignRef; siblings: readonly DesignRef[] } | null> {
  const groups = await listDesignRefs();
  for (const g of groups) {
    const item = g.items.find((i) => i.rel === rel);
    if (item) return { item, siblings: g.items };
  }
  return null;
}

export async function readPicks(): Promise<Record<string, DesignPick>> {
  try {
    const raw = await readFile(path.resolve(process.cwd(), PICKS), "utf8");
    const parsed: unknown = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? (parsed as Record<string, DesignPick>) : {};
  } catch {
    return {};
  }
}

/** Record (or clear) the owner's verdict on one plan. */
export async function savePick(
  rel: string,
  pick: DesignPick | null,
  now: Date = new Date(),
): Promise<void> {
  const picks = await readPicks();
  if (pick) picks[rel] = { ...pick, at: now.toISOString() };
  else delete picks[rel];
  await writeFile(path.resolve(process.cwd(), PICKS), `${JSON.stringify(picks, null, 2)}\n`, "utf8");
}
