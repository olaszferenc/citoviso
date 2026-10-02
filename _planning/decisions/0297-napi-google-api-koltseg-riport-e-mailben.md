## ADR-0297 — Napi Google API költség-riport e-mailben: listaáras becslés a Monitoring hívásszámaiból, csak szól, nem korlátoz (2026-10-02)

**Dátum:** 2026-10-02 · **Státusz:** elfogadva (SUB, G rész; koordinátor: CIT „Places API 600 $” session;
brief: `~/rc-briefs/places-g-napi-koltseg-riport.md`; tulaj: „Napi reportot kérek.”) · **Visszafordíthatóság:** 🔄 olcsó
(egy dev-időzítő + egy szkript) · **Kapcsolódó:** ADR-0295 (árlista), ADR-0296.

**Kontextus.** A Places-költség 2026-09-23 … 10-01 között ~600 $/hét volt, és egy hétig senki nem vette észre. Kell egy
reggeli jelzés a TEGNAPI napról.

**Döntés.**
1. **Forrás:** Cloud Monitoring `serviceruntime.googleapis.com/api/request_count` (`consumed_api`), projekt `mineralcrm`,
   service × method × credential bontás, **órás** `ALIGN_SUM`, a budapesti napot a riport maga összegzi (DST-nap 23/25 óra).
   ⚠️ Mérve: a napi (86400 s) igazítás a LEGUTOLSÓ vödröt torzítja (10-01: 1 074 vs a nyers percadat 756; SearchText 199 vs
   138; a korábbi napok egyeznek) — ezért órás, és a nyers percadat-összeggel egyezik.
2. **Költség = listaáras BECSLÉS.** A Monitoring a mező-maszkot nem látja, ezért metódusonként EGY feltételezett SKU (a kódunk
   legdrágább használata: SearchText → Text Search Enterprise 35 $, GetPlace → Place Details Enterprise 20 $, GetPhotoMedia
   → Photos 7 $, Street View Static 7 $, Metadata 0, Dynamic Maps 7 $, Static Maps 2 $, Geocoding 5 $, Autocomplete 2,83 $,
   Legacy Details 17 $); a havi ingyenes keretet NEM vonja le (a hónap eddigi darabszáma mellé kiírja). Az árak EGY helyen:
   `METHOD_PRICES` (`src/ops/googleCostReport.ts`). Ár nélküli Maps-metódus külön listában („NINCS ÁR”), nem 0 $.
   A riport kimondja: a valós a Billing → Reports; a projektet MR is használja (a számok a projekt egészére szólnak).
3. **Kiemelés:** ha a napi becslés > `GOOGLE_COST_DAILY_THRESHOLD_USD` (alap 20 $), vagy egy tétel ≥2× az előző 7 nap
   átlagának ÉS a napi becslése ≥ `GOOGLE_COST_ITEM_MIN_USD` (alap 1 $ — centes tételek ne zajongjanak). Tárgy: `[FIGYELEM]`.
   **Semmit nem korlátoz, nem állít le** (tulaj: „saját magunkat nem korlátozzuk”).
4. **Néma bukás tilos:** token- vagy Monitoring-hiba, vagy üres válasz → a levél AKKOR IS kimegy `[NINCS ADAT]` tárggyal, az
   okkal és a teendővel. Nem-nulla kilépés csak, ha maga a levél nem ment ki.
5. **Kézbesítés:** a meglévő levélküldő (`getEmailSender`, `audience: "platform"`); címzett `GOOGLE_COST_REPORT_TO`, üresen a
   konzol riasztási e-mail listája (/settings, `alert_email`). **Ütemezés:** `citoviso-google-cost-report.timer` 07:10,
   `Persistent=true`, a fő fából, rendszer-szintű unit `User=citoviso`-val (mint a gép többi időzítője), `targets.json`-ban
   **dev** cél → élesre sosem települ. Oneshot + alap `KillMode=control-group` szándékosan: rövid, magától kilépő futás,
   hosszan élő gyereket nem indít (az rc-watchdog-tanulság arra áll).

**Mérés (első valódi riport, 10-01):** ~11,68 $ (7 napos átlag 44,64 $/nap); visszamenőleg 09-27: ~80,17 $, `[FIGYELEM]`
(SearchText 1 801 hívás, 5,6× az átlagnak) — vagyis a riport a 600 $-os héten másnap reggel szólt volna.

**Elvetett.** (a) Cloud Billing export BigQuery-be — pontos, de a projektben nincs beállítva, és csak ~1 nap késéssel tölt;
később kiválthatja a becslést. (b) Budget-alert a Google-ban — havi keretre szól, nem napi kiugrásra, és a projekt közös MR-rel.

**Őr.** `scripts/google-cost-report-check.mts` (hermetikus, fetch-csonk, a globális fetch dob; pre-commit): ár × darab,
küszöb, ≥2× / tételminimum, adat-nincs ág (token / 403 / üres / kivétel), 25 órás DST-nap, lapozás, ár nélküli és nem-Maps
tételek, a lekérés paraméterei, a szöveg őszintesége. Mutációval mérve: /1000 → /100, 2× → 20×, a vödör −1 ms nélkül, az
üres-ág kivéve, napi igazítás, küszöb ×10 → mind piros.
