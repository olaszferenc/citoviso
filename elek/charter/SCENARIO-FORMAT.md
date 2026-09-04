# FK-formátum — a forgatókönyv kontraktusa

> Státusz: **F0 TERVEZET — tulajdonosi jóváhagyásra vár.**
> Ez a fájl a runner (1. réteg, determinisztikus) és a forgatókönyv-írók közti kontraktus.
> A forgatókönyvek helye: `elek/scenarios/FK-<sorszám>-<slug>.md` (gitben).

## Alapszerkezet

Markdown: cím + fej-mezők + szakaszok. Minden szakasz checklist-sorokból áll; a checklist-sor
az **emberi igazság** (mit várunk emberi szemmel), alatta behúzva a **gépi mezők**.

```markdown
# FK-001 — Tenant-admin: Dokumentumok és Üzenetek

cél: A tenant a számláit és a beérkezett rendszerüzeneteit megtalálja és kezeli.
felület: tenant-admin
kontraktus: assets/design-refs/tenant-admin/dokumentumok-uzenetek-a-README.md

## Előkészítés

- [ ] Bejelentkezve a tenant-adminba a teszt-tenanttal
  user: tenant-elek
  út: /admin
  várd: látható "Vezérlőpult"

## Dokumentumok fül

- [ ] A keresés a partner nevére szűkíti a számla-listát
  út: /admin?tab=dokumentumok
  tedd: írd "#doc-search" "ELEK-TESZT"
  várd: darab ".doc-row" >= 1
  várd: nem látható "Nincs találat"

- [ ] Az összegző sor a szűrővel együtt mozog
  kézi: az összeg helyessége gépileg nem ítélhető — képen ellenőrizendő
```

## Fej-mezők

| Mező | Kötelező | Jelentés |
|---|---|---|
| `cél:` | igen | Egy mondat: mit bizonyít a futás. |
| `felület:` | igen | `konzol` \| `tenant-admin` \| `publikus` — melyik szervert bootolja a runner. |
| `kontraktus:` | nem | A design-kontraktus, amiből az FK született (nyomkövetéshez). |

## Gépi mezők (a checklist-sor alatt, behúzva)

| Mező | Jelentés |
|---|---|
| `út:` | Route, amire a lépés navigál. Elhagyva: marad az előző lépés lapján. |
| `user:` | Session-váltás: `operator-elek` \| `tenant-elek` \| `anon`. Elhagyva: örökli. |
| `tedd:` | Akciók, soronként egy: `kattints "<látható szöveg vagy szelektor>"` · `írd "<szelektor>" "<érték>"` · `válaszd "<szelektor>" "<opció>"` · `várj "<látható szöveg>" [mp]` — az opcionális másodperc-korlát hosszú aszinkron állapotra való (pl. mock-generálás ~1-2 perc, az oldal közben magától újratölt); nélküle 10 mp. |
| `várd:` | Ellenőrzések, soronként egy: `látható "<szöveg>"` · `nem látható "<szöveg>"` · `darab "<szelektor>" >= N` · `szövege "<szelektor>" = "<érték>"`. |
| `kézi:` | Gépileg nem ítélhető elvárás → a lépés státusza `manual`, kötelező screenshottal; az indoklás mondja ki, MIT kell a képen nézni. |
| `adat:` | A lépésben létrehozott rekord jelölése (leltárhoz): `adat: ELEK-TESZT <mi>`. |

## Szelektor-szabályok

- **Látható szöveg** (has-text) vagy **stabil `id` / `data-*`** horog.
- ⛔ Pozíció-alapú szelektor (`nth-child`, index) **TILOS** — az elrendezés-változásra törik,
  és FORGATÓKÖNYV-HIBA leletet szül, nem valódi hibát.
- Ha egy elemnek nincs stabil horga, az a fejlesztő felé jelzés (lelet: FORGATÓKÖNYV-HIBA
  megjegyzéssel), nem ok az nth-child-ra.

## Futási szabályok (a runner viselkedése)

- **Minden lépésről full-page screenshot** készül (`shots/<lépés-sorszám>.png`), a `várd:`
  kimenetelétől függetlenül.
- **Console-hibák és HTTP >= 400 válaszok** lépésenként gyűjtve a `result.jsonl`-be.
- **confirm/alert:** auto-accept, de a szövege RÖGZÍTVE (a kiértékelő látja, mit hagyott jóvá).
- **Előkészítés-szakasz bukása = teljes stop** — minden további szakasz `blocked`, a futás
  lelete ELŐFELTÉTEL-HIBA (⚠️ a közös dev DB-t párhuzamos sessionök üríthetik — ez itt bukik
  ki, nem mélyebben).
- **Szakaszon belüli akció-hiba** (`tedd:` nem végrehajtható) = a szakasz további lépései
  `blocked`; a többi szakasz fut tovább.
- `kézi:` mező jelenlétekor a lépés `manual` — gépi zöld nem adható rá.

## Lépés-státuszok

`pass` — minden `várd:` teljesült · `fail` — legalább egy nem · `manual` — `kézi:` mező,
ember/agent ítél a képről · `blocked` — előfeltétel vagy szakasz-akció bukása miatt nem futott.
