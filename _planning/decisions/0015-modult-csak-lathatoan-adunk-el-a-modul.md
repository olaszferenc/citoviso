## ADR-0015 — Modult CSAK láthatóan adunk el: a modul-konfigurátor + élő előnézet a konverzió szíve

- **Dátum:** 2026-07-13
- **Kontextus:** az ADR-0014 provisioning-szelete a jóváhagyott mock statikus pillanatképét adja; a modul-választás
  csak `entitlement`-sorként rögzül, a Site nem renderelődik újra a választásból. Felmerült egy hibás
  megnyugvás („hagyjuk így: az entitlement a kereskedelmi rekord, az oldal a mock"). A tulaj elkapta:
  **így egy sosem-látott modulért kérnénk pénzt.**
- **Diagnózis:** ez ellentmond a termék MAGjának. A horog = „előre kész, személyre szabott mock, amit **LÁTNAK**".
  Egy fizetős kapu, ahol láthatatlan modult kell venni (aki 2026-ban nincs is a neten, azt a **látvány** győzi
  meg, nem egy checkbox), önellentmondás. **Azt adjuk el, amit mutatunk.** Az „entitlement ≠ render" igaz, de
  ebből NEM következik, hogy a sales-felület lehet vak — épp fordítva: a sales-felületnek vizuálisnak kell lennie.
- **Döntés:**
  1. **Modult csak láthatóan értékesítünk.** A prospect a mockon **be/kikapcsolja** a modulokat és **azonnal
     látja**, mit kap → *utána* fizet. Ez az **interaktív modul-konfigurátor + élő előnézet** (BACKLOG-ból
     előléptetve: NEM nice-to-have, hanem a **konverzió szíve**). Olcsó, mert a modul-UI már prezentáció-kész
     (ADR-0011: token-kontraktus + hidratáló runtime).
  2. **A tényhűség fázis-határának élesítése (§B.17):** a **keretezett, fizetés-ELŐTTI előnézetben** egy adat
     nélküli modul **reprezentatív/minta-állapottal MEGmutatható**, **félreérthetetlenül mintaként jelölve**
     („így fog kinézni a vélemény-szekciód, ha lesz véleményed") — ugyanaz a logika, mint a demó-fotóknál
     (demo-framing). A **NYILVÁNOS ÉLŐ oldalra** a minta-tartalom **SOHA** nem másolódik át adat-fedezet nélkül
     (§B.17 kőbe vésve marad): vétel *enged*, valós adat (vagy a tulaj admin-feltöltése) *tölt*.
- **Ami marad az ADR-0014-ből:** a `tenant`/`site`/`module_entitlement` + `convertLead` a kereskedelmi +
  provisioning **gerinc** — helyes, marad. Az élő oldal továbbra is adat-kapuzott. Csak a **vizuális
  sales-felület** hiányzott, azt scope-oljuk következőnek.
- **Elvetett alternatíva:** (A) statikus snapshot + entitlement-rekord, vizuális konfigurátor nélkül — elvetve,
  mert láthatatlan modult nem lehet eladni (a termék horgával ütközik).
- **Visszafordíthatóság:** 🔄 · fogalmi rögzítés; a konfigurátor önálló, additív szelet.
- **Státusz:** ELFOGADVA (fogalmi rész) — a konfigurátor-szelet külön scope + implementáció.

### ADR-0015 — Implementáció (2026-07-15): prospect-konfigurátor 1. szelet

- **Scope (a tulaj választása):** **toggle + minta-állapot**. A modul-UI prezentáció-kész, így kliens-oldali,
  regenerálás nélküli togglelés; a védett generálási promptot NEM érintettük.
- **Réteg:** serve-time overlay a `GET /configure/:artifactId` úton (`injectConfigurator`), a tárolt artifact tiszta
  marad. Present-modul (`data-cit-module` horog) → élő ki/be; gerinc (enquiry) jelen → lockolt ON; minden más
  katalógus-modul → jelölt „MINTA" blokk a sample-zone-ban (§B.17: reprezentatív, sosem valós adat, sosem élő oldalra).
- **Fájlok:** ÚJ `src/modules.ts` (egy-forrás katalógus + present-detektálás), `assets/runtime/cit-configurator.{css,js}`,
  `src/generator/configurator.ts`; MÓD `src/console/server.ts` (2 route + configurator-serve), `src/console/views.ts`
  (katalógus-import + prospect-konfigurátor link), `_planning/DOMAIN/06-UI-CONTRACT.md`. Teszt: `scripts/smoke-configurator*.ts`.
- **Verifikáció:** tsc tiszta; injektor-füst (grandis: present=[gallery,enquiry,location]; harsona: csupa minta) PASS;
  headless böngésző-teszt: panel nyílik, minta-toggle injektál/eltávolít, present-szekció rejtődik (block→none),
  gerinc lockolt, submit köszönet, 0 page-error. Screenshot: a minta-blokkok felveszik a skint, MINTA-szalag = akcent.
- **Submit:** `POST /configure/:id/request` → operátor-log (A2), nulla séma. A `convertLead` gerinc marad a kereskedelmi réteg.
- **Visszafordíthatóság:** 🔄 · additív (új fájlok + 2 route); a generátor érintetlen.
- **Nyitott (következő szelet):** `data-cit-section="<id>"` szekció-horog a generátor-promptban → az in-skin modulok
  (szobák/felszereltség/USP…) is togglelhetők legyenek (ma horog nélkül MINTA-ként jönnek akkor is, ha jelen vannak).
