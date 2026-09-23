// ⛔⛔ AZ ÁRAZÁS-KÉPERNYŐ NEM KÍNÁL OLYAT, AMI FOGLALÁS NÉLKÜL NEM HAT — az őr.
//
// A LELET (mérve 2026-09-23). Az Árak / szezonok szerkesztő feltétel nélkül kirajzolta
// a „Csak a felsorolt időszakokban adom ki" kapcsolót és az időszakonkénti „éj min."
// mezőt. Mindkettőt KIZÁRÓLAG a foglalási naptár olvassa (src/tenant/availability.ts,
// src/booking/requests.ts); a vendégnek szóló ártábla nem (src/engine/recipe.ts: név,
// dátum, ár). Az árazás a foglalástól függetlenül is megvehető (a függőség egyirányú:
// booking ──requires──▶ pricing, ADR-0192), tehát foglalás nélkül a tulaj átbillentette
// a kapcsolót, és a lapján SEMMI nem változott: ál-választás.
//
// A döntés (tulaj, 2026-09-23, jóváhagyott B terv — assets/design-refs/_drafts/
// seasonal-toggle.html): foglalás nélkül a kapcsoló, az „éj min." mező, a meglévő
// „min. N éj" jelölés ÉS az általános minimumra utaló mondat eltűnik; helyette EGY sor
// mondja meg, mit adna hozzá az Online foglalás.
//
// Amit állít — a szerkesztő VALÓDI kimenetén (moduleSettingsSection), mindkét állapotban:
//   ① foglalás NÉLKÜL a négy foglalás-függő elem nincs a lapon, az egy sor ott van;
//   ② foglalással MIND a négy ott van (különben elemek törlésével is „nyerhetnénk"),
//      a kapcsoló a tárolt állapotot mutatja, és az egy sor NINCS ott;
//   ③ az ár-szerkesztés maga (alapár, időszak-sor, új időszak) MINDKÉT állapotban él —
//      a rejtés nem viheti el azt, amiért a tulaj az Árak modult megvette;
//   ④ BÖNGÉSZŐBEN MÉRVE, a valódi stíluslapokkal: 390px-en az új-időszak űrlap egyetlen
//      mezője sem lóg ki a kártyából (2026-09-23: 143px-t lógott, a második dátum-mező
//      levágva), asztalon az egysoros elrendezés változatlan.
//
// A bekötést (a szerver tényleg átadja-e a foglalás-állapotot) nem ez az őr, hanem a
// típus-ellenőrzés tartja: `PricingEditorData.bookingActive` KÖTELEZŐ mező, a hívás
// nélküle nem fordul (rontással igazolva: `tsc` bukik).
//
// Futtatás:
//   npx tsx scripts/pricing-booking-only-check.mts
//   npx tsx scripts/pricing-booking-only-check.mts --selftest   ← PIROSNAK KELL LENNIE

import { moduleSettingsSection } from "../src/server/moduleConfigViews.js";

const selftest = process.argv.includes("--selftest");

let failures = 0;
function check(name: string, cond: boolean, detail?: unknown): void {
  if (cond) console.log(`  ✓ ${name}`);
  else {
    failures++;
    console.log(`  ✗ ${name}${detail === undefined ? "" : ` — ${JSON.stringify(detail)}`}`);
  }
}

// Fixture: one unit with a base price, one season WITH a per-period minimum and one
// without, and the switch stored ON — the state that must not leak without booking.
const unit = {
  id: "u-1",
  name: "Levendula apartman",
  capacity: 4,
  description: null,
  slug: "levendula",
  amenities: [],
  photoCount: 0,
  photoUrls: [],
  coverUrl: null,
  seasonalOnly: true,
  isWholeProperty: false,
};
const prices = {
  "u-1": [
    { id: "p-base", label: "Alapár", from: null, to: null, amount: 24000, isBase: true, minNights: null },
    { id: "p-high", label: "Főszezon", from: "06-15", to: "08-31", amount: 32000, isBase: false, minNights: 3 },
    { id: "p-pre", label: "Előszezon", from: "05-01", to: "06-14", amount: 26000, isBase: false, minNights: null },
  ],
};

function render(bookingActive: boolean): string {
  return moduleSettingsSection("pricing", {
    values: {},
    pricing: { units: [unit], prices, currency: "HUF", bookingActive },
  } as Parameters<typeof moduleSettingsSection>[1]);
}

const withBooking = render(true);
// --selftest: feed the WITH-booking page into the WITHOUT-booking assertions, i.e.
// what an ungated editor would show. Every ① line must go red.
const noBooking = selftest ? withBooking : render(false);

// The four booking-only elements, each by a marker that exists ONLY for it.
const BOOKING_ONLY: readonly [string, RegExp][] = [
  ["a „csak a felsorolt időszakokban” kapcsoló", /name="seasonal_only"/],
  ["az „éj min.” mező az új időszaknál", /name="min_nights"/],
  ["a meglévő „min. 3 éj” jelölés", /min\. 3 éj/],
  ["az általános minimumra utaló mondat", /foglalás-modulnál beállított általános minimum/],
];
const ONE_LINE = /data-cit-booking-only[^>]*>[\s\S]*?href="\/admin\?tab=modulok"/;

console.log("① foglalás NÉLKÜL");
for (const [what, re] of BOOKING_ONLY) check(`nincs a lapon: ${what}`, !re.test(noBooking));
check("ott van az egy sor az Online foglalásról, a Modulok fülre mutató linkkel", ONE_LINE.test(noBooking));

console.log("② foglalással");
for (const [what, re] of BOOKING_ONLY) check(`a lapon van: ${what}`, re.test(withBooking));
check("a kapcsoló a tárolt állapotot mutatja (bekapcsolva)", /name="seasonal_only" value="1" checked/.test(withBooking));
check("nincs ott az egy sor (foglalással nincs mit eladni)", !/data-cit-booking-only/.test(withBooking));

console.log("③ az ár-szerkesztés mindkét állapotban él");
for (const [state, html] of [["foglalás nélkül", noBooking], ["foglalással", withBooking]] as const) {
  check(`${state}: alapár-mező`, /action="\/admin\/prices\/base"[\s\S]*?name="amount"/.test(html));
  check(`${state}: a meglévő időszak sora (Főszezon, 32 000)`, /Főszezon[\s\S]*?32[\s  ]000/.test(html));
  check(`${state}: új időszak felvétele`, /action="\/admin\/prices\/season"/.test(html));
}

// ④ Measured in a browser, not assumed: at phone width no field of the "add a period"
// form may stick out of its card (2026-09-23: the second date field and the amount
// were cut off at 390px — the rows were 482px wide in a 320px card), and on desktop
// the row layout must stay as it was. Both booking states, real stylesheets.
console.log("④ böngészőben mérve: az új-időszak űrlap a kártyán belül marad");
{
  const { readFileSync } = await import("node:fs");
  const { chromium } = await import("playwright-core");
  const { config } = await import("../src/config.js");
  const { MODCFG_STYLE } = await import("../src/server/moduleConfigViews.js");
  const css =
    readFileSync("public/assets/ui/citui.css", "utf8") + readFileSync("public/assets/ui/citui-admin.css", "utf8");
  const page = (body: string) =>
    `<!doctype html><html lang="hu"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">` +
    `<style>${css}</style>${MODCFG_STYLE}</head><body><main class="adm-main"><div class="adm-main__inner">${body}</div></main></body></html>`;
  const browser = await chromium.launch({ executablePath: config.chromiumPath });
  try {
    for (const [state, html] of [["foglalás nélkül", noBooking], ["foglalással", withBooking]] as const) {
      for (const vw of [390, 1280]) {
        const p = await browser.newPage({ viewport: { width: vw, height: 900 } });
        await p.setContent(page(html));
        // String form: tsx would inject a __name helper into a nested function.
        const m = (await p.evaluate(`(() => {
          const form = document.querySelector(".price-new");
          const card = form.closest(".adm-card").getBoundingClientRect();
          let over = -1e9;
          form.querySelectorAll("*").forEach((e) => {
            const r = e.getBoundingClientRect();
            if (r.width) over = Math.max(over, r.right - card.right);
          });
          const dates = form.querySelectorAll(".price-new__dates .citui-input");
          // A unit label ("Ft", "éj min.") broken over two lines reads as two words.
          const broken = [...form.querySelectorAll(".mcfg-suffix > span")]
            .filter((sp) => sp.getBoundingClientRect().height > parseFloat(getComputedStyle(sp).lineHeight || "0") * 1.5 ||
                            sp.getClientRects().length > 1)
            .map((sp) => sp.textContent);
          return { over: Math.round(over), pageX: document.documentElement.scrollWidth - innerWidth, broken,
                   dateW: Math.round(dates[0].getBoundingClientRect().width),
                   sameRow: Math.abs(form.querySelector(".citui-input").getBoundingClientRect().top - dates[0].getBoundingClientRect().top) < 2 };
        })()`)) as { over: number; pageX: number; dateW: number; sameRow: boolean; broken: string[] };
        check(`${state} @${vw}px: semmi nem lóg ki a kártyából (túllógás ${m.over}px)`, m.over <= 0, m);
        check(`${state} @${vw}px: nincs vízszintes lapgörgetés`, m.pageX <= 0, m);
        check(`${state} @${vw}px: a mező-feliratok egy sorban (nem „éj / min.”)`, m.broken.length === 0, m.broken);
        if (vw === 1280) {
          // Desktop keeps the one-row layout with the compact 88px date fields.
          check(`${state} @1280px: az asztali elrendezés változatlan (egy sor, 88px-es dátum)`, m.sameRow && m.dateW === 88, m);
        }
        await p.close();
      }
    }
  } finally {
    await browser.close();
  }
}

if (selftest) {
  if (failures) {
    console.log(`\n✅ SELFTEST: ${failures} állítás PIROS a kapuzatlan lapon — az őr harap.`);
    process.exit(0);
  }
  console.log("\n❌ SELFTEST: a kapuzatlan lap is ZÖLD — az őr vak.");
  process.exit(1);
}
console.log(failures ? `\n❌ ${failures} bukás` : "\n✅ minden állítás teljesül");
process.exit(failures ? 1 : 0);
