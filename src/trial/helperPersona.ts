// ADR-XXXX — the LOCAL name the trial helper letter is signed with (owner, 2026-11-05:
// "ne Poe legyen a kimenő név… Mindig valami helyi név, most pl. magyar").
//
// The letter goes to a trialist who has not logged in for a week; a foreign or invented-
// sounding signature ("Poe") reads like spam. So the sender name and the signature are a
// common name OF THE RECIPIENT'S LANGUAGE, in that language's usual name order. The name is a
// persona of the Citoviso customer helper — the signature always says so ("Citoviso
// ügyfélsegítő"), it never claims to be anyone else.
//
// A language without an entry falls back to the Hungarian one only for Hungarian; any other
// language gets the neutral "Citoviso" team signature instead of a wrong-country name.

/** Persona names per mail language (proper names: never translated, never run through T). */
const HELPER_NAMES: Readonly<Record<string, string>> = {
  hu: "Kiss Eszter", // i18n-exempt: proper name (family name first, Hungarian order)
  de: "Anna Becker", // i18n-exempt: proper name
  en: "Emma Clarke", // i18n-exempt: proper name
  sk: "Zuzana Kováčová", // i18n-exempt: proper name
  hr: "Ana Horvat", // i18n-exempt: proper name
  sl: "Maja Kranjc", // i18n-exempt: proper name
  pl: "Anna Nowak", // i18n-exempt: proper name
  it: "Giulia Rossi", // i18n-exempt: proper name
  cs: "Tereza Nováková", // i18n-exempt: proper name
  ro: "Ioana Popescu", // i18n-exempt: proper name
  bg: "Мария Иванова", // i18n-exempt: proper name
};

/** The helper's name for a mail language, or null (→ the team signature). */
export function helperName(lang: string | null | undefined): string | null {
  const key = (lang ?? "hu").toLowerCase().split("-")[0]!;
  return HELPER_NAMES[key] ?? null;
}

/** The e-mail From display name: "<name> · Citoviso", or plain "Citoviso". */
export function helperFromName(lang: string | null | undefined): string {
  const n = helperName(lang);
  return n ? `${n} · Citoviso` : "Citoviso"; // i18n-exempt: sender display name
}
