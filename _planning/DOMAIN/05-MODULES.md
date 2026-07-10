# 05 — MODULOK (szállás pilot)

> **Mi ez?** A modul = a generált oldal FUNKCIÓ-tengelye (mit tud/mutat az oldal), szemben az
> archetípussal (forma), tierrel (tónus) és környezettel (paletta). A modul **adat, nem korpusz-tengely**:
> az archetípus egy modul-BEFOGADÓ elrendezés-nyelvtan, a modulok jelenlét/hiány-tűrő blokkok, amelyek
> az archetípus skinjét felöltve rendeződnek el (CLAUDE.md §7: „közös mag + adat-objektum"). Ez a
> szállás-iparág **interfészének** implementációja a 3 becsatlakozási ponton (KÍNÁLAT · ELÉRHETŐSÉG · KONVERZIÓ).
> Kapcsolódó: DECISIONS ADR-0009/0010, DESIGN-CATALOG §6, `src/generator/corpus.ts` + `mockFromCorpus.ts`.

⚠️ **Szándékos mélység-korlát (ADR-0010).** Most CSAK Szint 0–1 (katalógus + megjelenési jel) — ennyit
fogyaszt a korpusz-prompt (mit rendezzen) és a grounding (mit tölt / mit hagy ki). **Később** (data-plane/
konverzió): Szint 2 adat-séma · Szint 3 entitlement-kapuzás (ingyen-mock vs fizetős élő) · Szint 4 működő widget.

---

## Szállás modul-katalógus (Szint 0–1)

Jelölés: **[SPINE]** = mindig jelen (archetípustól függetlenül) · **[DATA]** = csak valós adatra jelenik meg,
hiányában KIHAGYVA (sosem fabrikálva — ADR-0007/0009 tényhűség) · **[UPSELL]** = később entitlement-kapuzott.

### KÍNÁLAT (mit ad a szállás)
| Modul | Cél | Megjelenési jel | Jelleg |
|---|---|---|---|
| `gallery` | Valós fotók bemutatása (az archetípus rendezi: bento/mozaik/carousel) | van ≥1 valós fotó | [DATA] (gyakorlatilag spine, ha van kép) |
| `rooms` | Szobák/apartmanok | van valós szoba-név/típus | [DATA] |
| `amenities` | Felszereltség/szolgáltatás | képen látható v. adatban szereplő, RELEVÁNS felszereltség | [DATA] |
| `pricing` | Árak/szezonok | van valós ár | [DATA] (nincs ár → nincs áras szekció) |

### ELÉRHETŐSÉG (hogyan érem el / foglalok)
| Modul | Cél | Megjelenési jel | Jelleg |
|---|---|---|---|
| `enquiry` | Kapcsolat/érdeklődés-CTA — a biztonságos konverziós út | mindig | **[SPINE]** |
| `contact_details` | Telefon/email/cím — csak a megadott valósat | van valós elérhetőség | [DATA] |
| `location` | Térkép + megközelítés/útvonal | van koordináta/cím | [DATA] |
| `booking` | Tényleges szállásfoglalás (widget/kérés) | — | [UPSELL] (mockban legfeljebb `enquiry`-ként) |
| `hours` | Beköltözés/kijelentkezés, nyitvatartás | van valós adat | [DATA] |

### KONVERZIÓ (miért pont ez a szállás)
| Modul | Cél | Megjelenési jel | Jelleg |
|---|---|---|---|
| `usp` | „Miért mi" — valós megkülönböztető előnyök (turisztikailag releváns) | van valós, releváns megkülönböztető tény | [DATA] |
| `reviews` | Valós vélemények (Google — enrichment) | van valós vélemény | [DATA] (kamu értékelés TILOS) |
| `poi` | Környék/látnivalók, közelség | régió-kontextus / POI-enrichment | [DATA] |
| `newsletter` | Ajánlatkérés/hírlevél-CTA | opcionális CTA | [UPSELL] |

**Gerinc (mindig):** `hero` (az archetípus nyitánya, nem külön modul) + `enquiry` + lábléc-provenance.
Minden más **adat-kapuzott**: van rá valós adat → megjelenik; nincs → kimarad. Ez a mock tényhűségének motorja.

## Következmények a motorra
- **Korpusz (agent-1):** az archetípus e modul-blokkokat rendezze el a maga egyedi szerkezetében; tervezzen
  úgy, hogy BÁRMELY részhalmaz szépen renderel (nincs üres/tört slot). A korpusz placeholder-tartalma minden
  modult megmutathat (cél-gazdagság), de a szerkezet legyen moduláris.
- **Grounding (agent-2):** a valós adatból modul-példányokat tölt; a [DATA]-modult csak akkor rendeli, ha
  van rá valós adat; a gerinc mindig ott van. Nincs fabrikáció, nincs üres szekció.
- **Nincs kombinatorikus robbanás:** a modul NEM szorozza a korpuszt (nem archetípus × modul-kombináció) —
  a modul-készlet a lead adat-objektumának része.
