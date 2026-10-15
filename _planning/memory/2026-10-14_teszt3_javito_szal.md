# 2026-10-14 — Éles végigteszt (teszt3) leleteinek javítása — SUB cit48b0dc69

Koordinátor: `citfb4ed7ab` (előbb a `-92`, majd az utód `-a6`). Éles a kezdéskor: `0038426a`. Brief: `~/rc-briefs/teszt3-javitasok-20261014.md`.

## Elvégezve (mind landolva; élesítés a koordinátoré, utána tenant-rerender)
| Tétel | Commit | Lényeg |
|---|---|---|
| 1. gyerekszám | 54664462 (ADR-0388) | Az „Ebből gyermek” mindig ott van; gyerekár nélkül „(18 év alatt)”, és csak az IFA-ra hat. A létszám mindenhol „N fő, ebből K gyermek”. Mellékes javítás: `.cit-book__field[hidden]`, mert ellátás nélküli oldalon üres „Ellátás” legördülő látszott. |
| 2. / F-1 férőhely | 3a51e8db (ADR-0389) | A korlát a választott egység férőhelye. A szelvény megáll, a szerver elutasít. Régi túllépő kérésnél figyelmeztet a tulaj-levél, a kártya, a visszaigazolás és a megerősítő oldal. |
| F-4 + F-7 | a4b2cff9 | Az elutasítás a szállásadó indokát mondja. A visszaigazolásban szerepel a cím (tartalék a lead címe, mint az .ics-ben) és a hivatkozás. |
| N-1 | 05c12d54 | A próba-űrlapon előtöltve a megkeresett e-mail cím. |
| T-1r | 9eb4bd22 | A Segítő egy életkorra kimondja az ellátás-korhatárt és az IFA-szabályt. Élő hívással mérve; az első prompt-változat a 15 évesnél tévedett. |
| F-2 | f35c248f | A minimum éjszaka már választáskor látszik (naptár, sáv, Árak), az időszak saját minimuma is. |
| F-5 | 92e5b5ad | A kéréskorlát kulcsa végpont, tenant és IP. Csak a létrejött kérés fogy a keretből; a nyers plafon 30. |
| F-6 | b0d010f4 | Minden űrlap-hiba egyszerre látszik, a hibás mező megjelölve, és a szerver összes hibája is. |
| F-8 | 6814a093 | Az „üres doboz” mérési hiba volt (lusta iframe). Valós hiány volt az útvonaltervező link, ezt pótoltam. |
| F-3 („B”) | a292bba7 (ADR-0390) | A portál-molinó elérhetőséggel reklám (v4 prompt). Csak a v3 sign_map-eket kérdezzük újra. |
| P-4 + pirula | 8a7f16de, 6b364fea | Lemondásnál nincs T−3 levél és nincs megújítási rendelés. Minden felület „zárul, nem terhelünk”, a pirula „LEMONDVA — NEM TERHELÜNK”. |
| P-5 | c4a8e362 | Visszaigazoló levél a lemondásról, a visszalépésről és a megbízás visszavonásáról. |
| P-2 | ce71d2b6 | Fizetés-visszaigazoló levél, ha a számla elbukik. |
| P-3 | 41206301 | A próba-modul nem „kifizette”, mellette „próbában ingyen” és a kikapcsolás napja. |
| P-6 | 6118e84d | Kártya nélkül „Korábbi fizetések”; a fizetés-történet nem tűnik el. |
| L-1 | 663b71a6 | A pirula a kártya felső sávjára és szövegsorra sem ül. A csukott panelnek nincs árnyéka. |
| S-1 CSRF | cc137998 (ADR-0391) | Origin/Referer = Host, mindkét szerveren (az nginx `Host $host`-ot ad). Fejléc nélküli kérés átmegy. Kivétel a webhook és a relay. |
| R-1 | (land b1865060) | Nem-uuid egység = „nincs ilyen egység”, nem 500. |
| P-1 | e5b36159 | Az Irányítópult COUNT, a lista 7 mezős vetítés. Lapozás: tulaj-döntés szerint NEM (az ADR-0188 áll). |

## Deploy után
1. `npx tsx scripts/rescore-photo-verdicts.mts --sign-map`, majd ugyanez `--go`-val (F-3). Utána a tenant-oldalak újrarenderelése.
2. A `[csrf] elutasítva` naplósorok figyelése egy napig.

## Tanulságok
- **Követett fájlt land közben nem szerkesztünk.** A land a munkafát nézi: egy félkész fájl miatt a „commitolatlan változás” hibán bukik, és a pre-commit kapuk is a félkész állapotot tesztelik. Ezt egyszer el is követtem (P-3), ezért a munkát patch-be tettem és visszaállítottam.
- **A `hooks/pre-commit` kommentjébe nem kerülhet ADR-XXXX helyőrző.** A land a mechanizmus-fájlt nem írja át, és megáll.
- **A mock outbox csak a levél HTML-részét menti.** A szöveges részt a küldő burkolásával lehet mérni.
- **A photo_hero_score `url_key` kisbetűsített.** A Google-fotót az eredeti URL nélkül nem lehet letölteni.
- **Egy meglévő őr hibás:** a `hero-override-check` a közös dev-DB egyik mock-sora miatt bukik (útvonal helyett csak fájlnév van benne). Nincs bekötve, nem ehhez a szálhoz tartozik.
