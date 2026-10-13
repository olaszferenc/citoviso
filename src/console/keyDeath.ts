// The ONE call the API adapters make when a provider answers 401/403 (ADR-XXXX).
// Fire-and-forget and import-light on purpose: the adapters (Places, Brave, the registrar
// and DNS client, the mail sender) sit under the scraper, the generator and the mailer,
// and must neither wait for the alert nor pull the console's alert chain into their static
// import graph (the mail sender is itself part of that chain — a static import would be a
// cycle). The alert itself (once per provider per Budapest day, live host only, mail + SMS):
// reportCredentialFailure in src/console/stallWatch.ts.

export function noteDeadKey(provider: string, detail: string): void {
  void import("./stallWatch.js")
    .then((m) => m.reportCredentialFailure(provider, detail))
    .catch((e) => console.error(`[api-key] ${provider} kulcs-hiba jelzése elhasalt:`, e));
}
