// Guard: an unreachable Places API must never render as a FINDING ABOUT THE LEAD.
//
// The defect this locks down (measured 2026-09-09): our SearchText day-quota ran out
// (HTTP 429), placesLookup swallowed it with `if (!res.ok) return null`, and the console
// printed "Ehhez a leadhez nem találtunk fotót." next to a list column that still read
// "10 kép". Two claims about one lead, one of them false, and the real cause — ours —
// nowhere on the screen.
//
// The rule being enforced: `null` means ASKED-AND-NOTHING-MATCHES; a call that could not
// be MADE throws PlacesUnavailableError carrying WHY. Each case is exercised with the
// REAL error-body shapes Google returns, not with a convenient stand-in — a guard fed
// invented inputs proves only that the guard runs.
//
//   npx tsx scripts/places-outage-check.mts

import {
  placesLookup,
  PlacesUnavailableError,
  type PlacesFailure,
} from "../src/scraper/sources/googleMaps.js";
import { resolvePhotos } from "../src/generator/images.js";
import { enrichPlaces } from "../src/scraper/enrichPlaces.js";

const realFetch = globalThis.fetch;

/** Verbatim 429 body from the live API on 2026-09-09 (the incident that started this). */
const QUOTA_BODY = JSON.stringify({
  error: {
    code: 429,
    message:
      "Quota exceeded for quota metric 'SearchTextRequest' and limit 'SearchTextRequest per day' of service 'places.googleapis.com' for consumer 'project_number:1053502558775'.",
    status: "RESOURCE_EXHAUSTED",
  },
});

/** Verbatim 403 body from the live API on 2026-09-09, 10:45 (the SAME key, later). */
const DENIED_BODY = JSON.stringify({
  error: { code: 403, message: "The caller does not have permission", status: "PERMISSION_DENIED" },
});

function stubFetch(status: number, body: string): void {
  globalThis.fetch = (async () =>
    new Response(body, {
      status,
      headers: { "content-type": "application/json" },
    })) as typeof fetch;
}

function stubNetworkFailure(): void {
  globalThis.fetch = (async () => {
    throw new Error("fetch failed: ETIMEDOUT");
  }) as typeof fetch;
}

let failures = 0;
function check(label: string, ok: boolean, detail: string): void {
  console.log(`${ok ? "✅" : "⛔"} ${label} — ${detail}`);
  if (!ok) failures++;
}

async function expectFailure(
  label: string,
  want: PlacesFailure,
  call: () => Promise<unknown>,
): Promise<void> {
  try {
    const got = await call();
    check(label, false, `NEM dobott — ${JSON.stringify(got)} (ez a néma nulla, amit tiltunk)`);
  } catch (e) {
    if (!(e instanceof PlacesUnavailableError)) {
      check(label, false, `rossz hibatípus: ${(e as Error).message}`);
      return;
    }
    check(label, e.failure === want, `failure=${e.failure} (várt: ${want})`);
  }
}

// ── The outage cases: every one of these used to be a silent null/[] ──────────
stubFetch(429, QUOTA_BODY);
await expectFailure("kvóta kimerült (429) → lookup", "quota", () =>
  placesLookup("Sziklakert panzió", 46.79, 17.43, "test-key"),
);
await expectFailure("kvóta kimerült (429) → fotó-feloldás", "quota", () =>
  resolvePhotos(["places/X/photos/Y"], 3),
);

stubFetch(403, DENIED_BODY);
await expectFailure("kulcs elutasítva (403) → lookup", "auth", () =>
  placesLookup("Sziklakert panzió", 46.79, 17.43, "test-key"),
);

// 403 CAN also mean a spent quota — Google says so in the body, not in the status.
stubFetch(403, JSON.stringify({ error: { status: "RESOURCE_EXHAUSTED" } }));
await expectFailure("403 + RESOURCE_EXHAUSTED → kvóta, nem jogosultság", "quota", () =>
  placesLookup("Sziklakert panzió", 46.79, 17.43, "test-key"),
);

stubFetch(500, "internal");
await expectFailure("Google 500 → upstream", "upstream", () =>
  placesLookup("Sziklakert panzió", 46.79, 17.43, "test-key"),
);

stubNetworkFailure();
await expectFailure("hálózati hiba → network", "network", () =>
  placesLookup("Sziklakert panzió", 46.79, 17.43, "test-key"),
);

// ── The NEGATIVE case: a real answer of "nothing here" must stay a plain null ──
// Without this the fix would over-swing: every empty area would become an "outage",
// and the operator would chase infrastructure that is perfectly healthy.
stubFetch(200, JSON.stringify({ places: [] }));
const empty = await placesLookup("Nemletezo Panzio", 46.79, 17.43, "test-key");
check("üres találat (200) → null, NEM hiba", empty === null, `visszatérés: ${JSON.stringify(empty)}`);

// A partial photo failure must not sink the whole strip: one ref resolves, one dies.
let call = 0;
globalThis.fetch = (async () => {
  call++;
  return call === 1
    ? new Response(JSON.stringify({ photoUri: "https://example.test/a.jpg" }), { status: 200 })
    : new Response(QUOTA_BODY, { status: 429 });
}) as typeof fetch;
const partial = await resolvePhotos(["places/X/photos/A", "places/X/photos/B"], 2);
check(
  "részleges bukás → a megmaradt fotó átjön",
  partial.length === 1,
  `${partial.length} URL (várt: 1)`,
);

// ── The re-enrich path: the button the operator presses when photos are missing ──
// It used to end on "Újragyűjtés kész — nem változott semmi." while every lookup in it
// was bouncing off the closed API. The pass must still SURVIVE the outage (the other
// enrichers have work to do) AND report it.
stubFetch(429, QUOTA_BODY);
let reported: PlacesFailure | undefined;
const lead = {
  name: "Sziklakert panzió",
  lat: 46.7941879,
  lon: 17.4308746,
  region: "balaton-north",
  sources: ["osm"],
} as unknown as Parameters<typeof enrichPlaces>[0][number];
const out = await enrichPlaces([lead], "test-key", (f) => {
  reported = f;
});
check("reenrich: a kvóta-kimaradás JELENTVE", reported === "quota", `jelentett: ${reported}`);
check("reenrich: a lánc túléli a kimaradást", out.length === 1, `${out.length} lead jött vissza`);

globalThis.fetch = realFetch;

if (failures) {
  console.error(
    `\n⛔ places-outage-check: ${failures} sértés — egy elérhetetlen forrás NEM állítás a leadről.`,
  );
  process.exit(1);
}
console.log(
  '\n✅ places-outage-check: a kimaradás megnevezi magát, a „nincs találat" nulla marad.',
);
