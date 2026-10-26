// Where „Megrendelem" was pressed (ADR-XXXX, Próba riport) — a pure helper the letters and
// the admin share with the /folytatas route; no DB, no server imports.

/** The /folytatas link tagged with its source (the SMS stays bare: its length is counted). */
export function withOrderFrom(url: string, from: "admin" | "level"): string {
  return `${url}${url.includes("?") ? "&" : "?"}from=${from}`;
}

/** `?from=` of the /folytatas link → the source the report names; anything else = unknown. */
export function orderOpenFrom(raw: string | null): "admin" | "level" | null {
  return raw === "admin" || raw === "level" ? raw : null;
}
