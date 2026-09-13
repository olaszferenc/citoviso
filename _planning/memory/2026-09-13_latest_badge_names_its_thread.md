# 2026-09-13 — Az egyediség-állítás nevezze meg a halmazát (FK-006b HIBA-1 + HIBA-3)

**ADR:** ADR-0133 · **Elek-kör:** FK-006b (2026-09-13T12-54-46) · **Élesítés:** NINCS

## A bejelentés és amit a mérés mondott

A feed tetején két sor viselte egyszerre a zöld „Ez a legfrissebb" jelvényt, azonos
időbélyeggel. A bejelentés szerint „az egyik biztosan hamis".

**A kódból mérve egyik sem volt hamis.** A `positionThreads()` SZÁLANKÉNT jelöl egy
legfrissebbet (`threadKeyOf` szerinti csoport, legújabb `sentAt`), és csak akkor, ha a
szálnak van korábbi tagja. A két jelvény két KÜLÖN szál feje volt: egy foglalási kérés
(`booking` + `related_id`) és a dunning-létra (`dunning`, tenantonként egy).

**A valódi rés:** a jelvény egyediséget állít, de nem nevezi meg a halmazt, amiben egyedi.
A listában az olvasó egyetlen halmazt lát — a képernyőt —, ezért ellentmondást olvas.

## Amit építettem

- `src/tenant/messageThreads.ts`: a `STATE_THREADS` bejegyzés a szabály mellé megkapta a
  szál TÁRGYÁT is (`ThreadSubject`: előfizetés · foglalási kérés · többnyelvű modul),
  `threadSubjectLabel()` kimerítő switch-csel. A `ThreadPosition` két új mezőt kapott:
  `subject` és `supersedesTitle` (ez utóbbi CSAK akkor, ha a fej pontosan EGY üzenetet
  váltott le).
- `src/server/adminViews.ts`: a jelvény „Ez a legfrissebb — <tárgy>", alatta a „Felülírta:"
  sor tükreként „N korábbi üzenetet ír felül" (egynél a CÍMÉVEL).
- `src/payment/publicRef.ts` + `scripts/find-payment.mts`: `CIT-XXXXXXXX` hivatkozás a
  SAJÁT `payment.id`-ból, és a visszakeresés (mindkét alakot elfogadja).

## Amit külön érdemes megjegyezni

- **Az azonos tárgyú fejek esete.** A `tenant`-szabályú szálakból fiókonként EGY van, tehát
  két „előfizetés"-fej nem létezhet; a `related`-szabályúból viszont sok. Két külön foglalási
  kérés feje AZONOS nevet visel — ezért kell a felülírt üzenet címe. És pont ezek azok a
  szálak, amik az ADR-0126 szerint szerkezetileg SOSEM hosszabbak 2 tagnál, tehát a
  „pontosan egy → nevezd meg" szabály éppen a kétértelmű esetet fedi le.
- **Az őr rontása célzott:** csak a jelvény TÁRGYÁT és a számot üríti ki, a szálasítást nem.
  A ④ blokk rontása (üres `ThreadPosition`) minden jelvényt eltüntet, és egy nulla-jelvényes
  nézeten a ⑦ ÜRESEN zöld maradt volna.
- **A `scripts/` nincs típus-ellenőrizve:** a fixture `EMPTY` pozíciója ezért kiírja mind az
  öt mezőt — új mező különben némán `undefined`-ként érkezne a nézetbe.

## ⚠️ MEGOSZTOTT WORKTREE — a landolás külön fából ment

A `~/wt/cit2167c7de` fában MÁSIK session is dolgozott (outreach / mock-fotó kapu,
ADR-0130): menet közben megjelent `src/console/views.ts`, `src/outreach/*`,
`citui-console.css`. Két következménye lett:

1. **A katalógus.** Az `extract-i18n` a MUNKAFÁRÓL olvas, tehát az ő stringjeiket is
   betette. Megoldás: `git archive HEAD` egy `/tmp` fába → CSAK az én fájljaim rámásolva →
   ott futtatott extract. A diff pontosan 6 string lett, az enyémek.
2. **A commit.** A pre-commit kapuk a MUNKAFÁN mérnek, így az ő `views.ts`-ük ADR-0130
   hivatkozásai az én commitomat blokkolták volna. Megoldás: külön worktree
   (`~/wt/fk006bbadge`, `wt/fk006bbadge` ág) az én bázisomon, oda csak az én fájljaim.
   ⛔ **Az első másolás során a `src/console/server.ts` az Ő módosításaikat is áthozta**
   (159 sor / az enyém 5) — a fájlt vissza kellett állítani a bázisról és a két hunkot
   újra alkalmazni. **Fájl-szintű másolás megosztott fából = idegen munka átvitele.**

## Nyitott

- A FK-006b többi lelete (süti-sáv natív gombjai, „10-a/-e" ragozás-hack, „a(z)",
  a Foglalások-csempe „0 visszaigazolt" ellentmondása, a 77 azonos előnézetű számla-sor)
  NEM ebben a körben ment — külön döntés.
- A `multilangResume.ts` operátor-riasztása továbbra is a NYERS gateway-refet idézi. Ez
  szándékos (operátor-felület, ADR-0126 megengedi), de ha a vevő a `CIT-` alakot idézi,
  az operátornak a `find-payment.mts`-t kell használnia.
