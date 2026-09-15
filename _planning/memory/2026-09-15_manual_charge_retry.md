# 2026-09-15 — Kézi terhelés-újrapróbálás (ADR-0176)

**Szál:** `wt/fagyasztottkartya` · **Kontraktus:** `freeze-state-v2/` ⑤
**Tulajdonosi utasítás:** „Csináld meg a terhelés-újrapróbálás szerver-útvonalát is."

## Mit épített

A 2026-09-14-én jóváhagyott terv „Újrapróbálom ezzel a kártyával" gombjának hiányzó útja:
`POST /admin/subscription/retry-charge` → `retryRenewalCharge()` → a MEGLÉVŐ
`chargeRenewalWithToken()`.

**Miért kell:** a leggyakoribb elutasítás a fedezethiány, és a létra a **fagyás után már
nem próbálkozik** — ha a tulaj közben feltöltötte a kártyát, az automata SOHA nem jön
vissza érte.

## A három tervezési döntés

1. **A terhelés nem új kód.** A meglévő függvényben már benne van a dupla-terhelés
   önjavítása, a függő MIT újrahasználata, az elakadt pending lezárása. Második út két
   igazság lenne, és a bankszámlán derülne ki.
2. **A fékek a WHERE-ben.** Egyetlen feltételes UPDATE az `order_intent`-en: várakozás ÉS
   sorozat-korlát egyszerre. Két párhuzamos kattintásból pontosan egy nyer.
3. **A próbaszám LEVEZETETT** (`pay_url IS NULL` payment sorok), nem külön oszlop. Tárolva
   csak tény: `manual_charge_at` (migráció 0069) — egyszerre óra és zár.

## ⛔ Amit a KÉP fogott meg, nem az őr

Az „Újrapróbálom" gomb `--primary` osztályt kapott, mégis **ugyanolyan fehér** lett, mint
a másodlagos: a `.adm-mand__btn` alapszabály a stíluslapban KÉSŐBB áll, tehát azonos
fajsúlynál mindig ő nyert. Mérve a két gomb háttere **bitre azonos** volt — vagyis „a
fizetés útja a leghalkabb elem" hibaosztály, **épp abban a blokkban, ami ellene készült**.
Javítva kétosztályos szelektorral; kontraszt 6,91.

Ugyanitt: a magyarázó mondat két gomb alatt állt, és az újrapróbálásra is vonatkozhatott
— most megnevezi, melyikre.

## Az őr (piros önteszt: 4 sértés)

`scripts/charge-retry-check.mts` — pénzt mozgató útnál nem a boldog ágat mérjük, hanem a
fékeket. **Valódi DB-t használ**, mert a szabály MAGA egy SQL WHERE (egy TS-ben újraírt
másolat nem a szabályt mérné). Eldobható, egyedi nevű fixtúra, `finally`-ben takarítás.
**Valódi pénz nem mozdul:** a terhelés injektált.

Hét állítás. Az önteszt a fékek NÉLKÜLI változatot futtatja ugyanarra a forgatókönyvre:
**2 párhuzamos terhelés** és **11 próbálkozás a 4-es korlát ellenében** → 4 sértés.

## Fixtúra-tanulság

A `scripts/` nincs típus-ellenőrizve, ezért a fixtúra kétszer futásidőben halt meg
(`tenant.slug` nem létezik — `lead_id` kell; `subscription.current_period_start` NOT NULL).
A fixtúrát a TERMÉK sémájából kell építeni, nem emlékezetből.

## Módosított / létrehozott fájlok

- `migrations/0069_manual_charge_retry.sql` · `src/db/schema.ts`
- `src/payment/retryCharge.ts` (új) · `src/server/public.ts` (route) · `src/server/adminViews.ts`
- `public/assets/ui/citui-admin.css` · `src/i18n/catalog.json`
- `scripts/charge-retry-check.mts` (új) · `hooks/pre-commit`
- `assets/design-refs/console/freeze-state-v2/README.md` (⑤ átírva)
- `_planning/DECISIONS.md` (ADR-0176)

## Nyitott

- **Élesítés NINCS** (§0.3) — és ez MIGRÁCIÓT is visz, tehát élesítéskor a `deploy-prod.sh`
  pg_dump-ja külön figyelmet érdemel.
- A sorozat-korlát (4) és a várakozás (15 perc) konstans — hangolható, ha a gyakorlat mást mutat.

---

## 🔴 A LAND BLOKKOLVA — és a blokkoló NEM ez a diff

**Kimondva, mérve (2026-09-15):** a `consent-style-check` kapu piros, ezért a commit nem
tud landolni. **A bukás nem ebből a munkából ered.**

| Bizonyíték | Mérés |
|---|---|
| Piros a TISZTA `origin/main`-en is | külön `git worktree`-ben lefuttatva: **pontosan ugyanaz a 2 bukás** |
| A bukó ellenőrzés | `/pay/done` → `.panel` hiányzik (mobil 390 ÉS asztali 1280) |
| Érinti-e a diffem? | `src/console/server.ts` **0×**, `src/payment/barion.ts` **0×**, `scripts/consent-style-check.mts` **0×** a commitban |

**Gyökér-ok (diagnosztizálva, NEM javítva):** a `/pay/done` minden GET-re újrafuttatja a
webhookot (`console/server.ts:2871`), az pedig a **valódi Barion API-t** hívja
(`barion.ts:200` `fetch` → `resp.json()`). A kapu egy **tetszőleges régi** fizetés
`gateway_ref`-jét adja neki a közös parkból; a Barion HTML hibalapot ad rá → a `json()`
dob → a lap nem rendereli a `.panel`-t. Vagyis **külső hívás bukása, nem termék-regresszió**
— és mivel a kapunak nincs fájl-szűrője, **minden szál landolását blokkolja**.

⛔ **Szándékosan NEM javítottam.** Tulajdonosi koordináció: ugyanezt a hibát a
**megkeresés-szerkesztő szál (B6)** is megtalálta, és **ő kapta meg a feladatot** (értelmes
lap ismeretlen/elavult referenciára + determinisztikus, de a hibát el nem fedő őr, külön
ADR-rel). Két szál ugyanazt a fájlt írná.

⛔ **Nem kerültem meg `--no-verify`-jal.** Piros kapun átpusholni pont az a doktrína-sértés,
amit a §3 tilt — és pénzt mozgató diffnél különösen.

**Következő lépés:** B6 landolása után `git rebase origin/main` + `land.sh`. A commit addig
a munkafában áll, **NEM landolt** — a „felküldve" csak az „IGAZOLTAN FENT" sor után mondható ki.
