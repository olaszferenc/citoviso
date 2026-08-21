# 2026-08-21 — A konfigurátor: nyitott lista, követhető ár, szabadon választható domain (ADR-0051)

## Kiváltó (tulaj)
„Amikor a lead leendő tenant megnézi a linket, amit kap, és elkezdi konfigurálni magának a
holnapot, akkor legyen automatikusan kinyitva a **testre szabom** rész, és folyamatosan lássa a
havi díjak alakulását, ahogy ki-be kapcsolja azt." Majd: „a testre szabom rész vizuálisan is
térjen el egy kicsit"; „határozhasson meg saját magának egy egyedi domain nevet, ha a javaslatok
közül egyik sem tetszik. Amit ellenőrzés gombbal ellenőrizzünk le, hogy szabad-e."

## Elvégzett munka
- **Tételes lista alapból NYITVA**, a gomb csak összecsukásra marad. A csomag-kártyák maradnak
  fölötte (az egy-koppintásos út sértetlen).
- **Saját felület:** `.cit-cfg-custombox` — világosabb doboz, akcent-él, saját fejléc-sáv; a
  csomag-kártyáktól ránézésre elválik.
- **Az ár nem tűnhet el és nem néma:** a láb `flex: 0 0 auto`; minden változás megdobja az összeget
  és 2,2 mp-re kiírja a különbséget (`+490 Ft/hó` / `−690 Ft/hó`), csomag-váltásnál is.
- **Saját domain + „Ellenőrzés" gomb:** `normalizeCustomDomain()` (`src/domains.ts`) + új végpont
  `GET /configure/:id/domain-check` ugyanazon a DNS+RDAP rétegen. Élesben próbálva: `google.com`
  → foglalt, kitalált `.hu` → szabadnak tűnik, `nincsvegzodes` → „Végződés is kell…", `ékezetes.hu`
  → elutasítva (a registrar-API punycode-ot kap; ne ígérjünk többet, mint amit átveszünk).
  Foglalt név SOSEM lesz a választás; szerkesztés után az elavult ítélet és a választás is elszáll.
- **Robusztusság:** a saját-domain blokk csak akkor renderel, ha a manifest hozza a `checkUrl`-t —
  a runtime-fájl előbb ér ki egy hosztra, mint a szerver-kód, és a sosem válaszoló gomb rosszabb a
  hiányánál.

## Őr (a doktrína szerint pirosra futtatva)
`scripts/configurator-price-check.mts` — valódi böngésző, 1180px + 390px + egy „régi backend"
nézet (checkUrl nélküli manifest). Méri: nyitva vannak-e a kapcsolók, a képernyőn van-e az összeg,
pontosan a modul árával mozdul-e, van-e változás-jelzés, a saját-domain út négy állítása, és hogy
régi backenden a mező NEM jelenik meg (a javaslatok viszont igen). Öt szándékos rontás, mind piros:
rejtett lista, kivett delta, elfogadott foglalt név, bennmaradó elavult választás, feltétel nélküli
mező. Pre-commitba kötve (csak konfigurátor-fájl staged-elésekor).

## Menet közbeni leletek
- **A `smoke-configurator-browser` némán semmit nem mért:** két lépése a SOR KÖZEPÉRE kattintott,
  ami az info-ikonra esik (az stopPropagation-öl) → `galleryHideToggle: "block → block"` zöldnek
  látszott. A kapcsolóra (`.cit-cfg-sw`) célozva: `block → none`. Ugyanez a csapda az új őrben is
  előjött az első futáskor — desktopon bukott, mobilon átment, mert a rövidebb sornál máshová esik
  a közép.
- A „Havi/Éves" váltó és a Megrendelem gomb a láb 2. lépésébe került egy korábbi átalakításkor; a
  smoke még az elsőben kereste, ezért 30s timeouttal halt.
- **ADR-szám kétszer ütközött** (0046, majd 0050) párhuzamos szálakkal → 0051 lett.

## Éles deploy (tulaj-engedéllyel) — RÉSZLEGES, tudatosan
Kiment: `assets/runtime/cit-configurator.{js,css}` + `citoviso-console` restart.
Backup: `/opt/citoviso/backups/cfgprice-20260821-202239/`. Verifikálva a CF-edge-en, böngészővel,
390px-en (`https://citoviso.com/configure/…`): 13 tételes sor nyitva, ár 10 180 → 9 690 a −490
Ft/hó jelzéssel, 0 JS-hiba. Az untracked `/configure/` utat használtam, hogy ne szennyezzem a
lead-statisztikát `mock_view` sorokkal.

**NEM ment ki a `server.ts` + `configurator.ts` + `domains.ts`**, tehát a domain-ellenőrző végpont
élesen még nincs (a mező ezért ott nem is jelenik meg). Ok: a fa-diff szerint az éles ~4 szálnyival
le van maradva — **51 eltérő fájl, 20 teljesen hiányzó**, és a mostani `src/console/server.ts`
import-gráfjából **10 függőség hiányzik élesen** (`moduleSections`, `kb`, `moduleConfig`,
`reviews/*`, `tenant/units|prices|siteModuleConfig`, …). Egy fájl-szintű deploy ott a konzolt
INDÍTÁSKOR megölte volna. Ráadásul 29 lokális migrációval szemben élesen 22 van.

## Következő lépés
**Koordinált utólagos éles deploy** (külön engedéllyel): a hiányzó fájl-halmaz + a 7 migráció
együtt, a többi szál mai munkájával (booking, reviews, units, KB, portál-fotó). Fájlonként
szemezgetve ez nem megy — a séma és a kód együtt mozog.
