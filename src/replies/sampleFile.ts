// Poe's sample file (owner 2026-11-28: „Poe nézzen mintákat, hogy mik azok a válaszok, amik
// hivatalosan kimentek, tanuljon abból is”). The replies collector keeps ~/poe/mintak/kikuldott-valaszok.md
// fresh from the ingest answer's `sentSamples`: per answer that went out, what the lodging owner
// wrote, what Poe proposed, and what the operator actually sent — with a mark when it was rewritten.
// Pure: no I/O here, the collector writes the file. Read by Poe per RUNBOOK §6b.
import type { SentReplySample } from "./store.js";

/** First line of the file: the server's fingerprint, sent back as `samplesMark` (nothing new → no rewrite). */
const MARK_RE = /^<!-- samples-mark: (.*) -->$/m;

export function sampleMarkOf(md: string): string | null {
  return MARK_RE.exec(md)?.[1] ?? null;
}

/** Whitespace-insensitive equality: a re-wrapped line is not a rewrite. */
const norm = (s: string | null | undefined): string => (s ?? "").replace(/\s+/g, " ").trim();

export type SampleVerdict = "unchanged" | "rewritten" | "no-suggestion";

export function sampleVerdict(s: SentReplySample): SampleVerdict {
  if (!s.suggestion) return "no-suggestion";
  const same = norm(s.suggestion.text) === norm(s.sentBody) && (s.channel !== "email" || !s.suggestion.subject || norm(s.suggestion.subject) === norm(s.sentSubject));
  return same ? "unchanged" : "rewritten";
}

const VERDICT_LABEL: Record<SampleVerdict, string> = {
  unchanged: "Poe javaslata VÁLTOZTATÁS NÉLKÜL ment ki",
  rewritten: "⚠ az operátor ÁTÍRTA Poe javaslatát — nézd meg, min változtatott",
  "no-suggestion": "Poe javaslata nem ismert (nem volt, vagy 2026-11-28 előtti küldés) — a kiment szöveg a minta",
};

const MAX_PART = 2000;
const quote = (t: string): string => {
  const cut = t.length > MAX_PART ? `${t.slice(0, MAX_PART)} …` : t;
  return cut.split("\n").map((l) => `> ${l}`).join("\n");
};
const bp = (iso: string): string =>
  new Date(iso).toLocaleString("sv-SE", { timeZone: "Europe/Budapest", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" });

export function renderSampleFile(mark: string, items: readonly SentReplySample[], generatedAt: Date = new Date()): string {
  const rewritten = items.filter((s) => sampleVerdict(s) === "rewritten").length;
  const unchanged = items.filter((s) => sampleVerdict(s) === "unchanged").length;
  const head =
    `<!-- samples-mark: ${mark} -->\n` +
    `# Kiment válaszok — Poe mintái\n\n` +
    `Gépi fájl, a válasz-gyűjtő frissíti (${bp(generatedAt.toISOString())}). Ne szerkeszd: a következő frissítés felülírja.\n\n` +
    `- Mire való (tulaj, 2026-11-28): a ténylegesen KIMENT válaszokból tanulsz. Javaslat előtt nézd meg a hasonló mintákat (azonos típus: érdeklődő / kérdező / elutasító; azonos nyelv), és a hangot, hosszt, szerkezetet ezekhez igazítsd (RUNBOOK §6b).\n` +
    `- Ahol az operátor ÁTÍRTA a javaslatodat, abból ÁLTALÁNOS tanulság lesz a tanulsagok.md-ben (nem levélre szóló), ha még nincs ott.\n` +
    `- A minta nem forrás tényre és árra: ár CSAK az élő árlistából, tény CSAK a Forrás-csomagból.\n\n` +
    `Összesen ${items.length} minta (a legújabb elöl) · átírva ${rewritten} · változatlanul ${unchanged} · javaslat nélkül ${items.length - rewritten - unchanged}\n`;
  const body = items.map((s) => {
    const v = sampleVerdict(s);
    const lines = [
      `## ${bp(s.sentAt)} · ${s.lead} · ${s.channel === "email" ? "e-mail" : s.channel}${s.lang ? ` · ${s.lang}` : ""}`,
      ``,
      `**${VERDICT_LABEL[v]}**`,
      ``,
      `**A szállásadó írta** (${bp(s.receivedAt)}):`,
      ``,
      quote(s.incoming),
      ``,
    ];
    if (s.suggestion) {
      lines.push(`**Poe javasolta**${s.suggestion.subject ? ` — tárgy: „${s.suggestion.subject}”` : ""}:`, ``, quote(s.suggestion.text), ``);
      if (s.suggestion.basis.length) lines.push(`Mire alapozott: ${s.suggestion.basis.join(" · ")}`, ``);
    }
    if (v !== "unchanged") lines.push(`**Kiment** (${s.sentBy})${s.sentSubject ? ` — tárgy: „${s.sentSubject}”` : ""}:`, ``, quote(s.sentBody), ``);
    return lines.join("\n");
  });
  return [head, ...body].join("\n\n---\n\n") + "\n";
}
