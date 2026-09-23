# 2026-09-22 — A kapott kedvezmény láthatóvá tétele (ADR-0205)

## A kiváltó kérdés

A tulaj az előző szál végén kérdezte vissza: *„a kedvezmény láthatatlant nem értem: pedig ha
jól láttam számol vele?! Csak nem azt számlázzuk amit fizet vagy mi?"*

**Megmérve, és megnyugtató:** `list_price=19700`, `offer.percent=25`, `price=14775` →
**terhelve 14 775 Ft (`paid`)**, **számlázva OV-2026-52 → 14 775 Ft (`issued`)**. Amit
levonunk, az fillérre annyi, amiről a számla szól. **A számlázás helyes.**

A „láthatatlan" nem pénzügyi hiba volt, hanem az, hogy a levezetés (19 700 − 25 %) sehol nem
jelent meg. A legjobb bizonyíték rá, hogy **maga a tulaj sem tudta eldönteni**, jó-e a szám.
És mivel a kupon egyszeri, a megújításkor a teljes 19 700 Ft jön — magyarázat nélkül az
drágulásnak látszott volna.

## Szállítva (jóváhagyott C változat)

§2b kör: három megfogalmazás (A: a levezetés a mondatban · B: külön kedvezmény-sor ·
C: nyugta-levezetés), mindkét méret képével, **és kupon nélküli állapottal is** →
a tulaj a **C**-t választotta. Kontraktus: `assets/design-refs/tenant-admin/coupon-visible/`.

- A sáv: díj → kedvezmény (összeg + százalék) → terhelve, alatta a megújítás-figyelmeztetés.
- Kupon nélkül a régi egymondatos sáv marad.
- A számlán: a kedvezmény a **tétel nevében** és a **megjegyzésben**.
- Az ár-adat útja: a redirect mostantól `mlist`/`mpct`-t is visz (és a címsorból jövő értéket
  csak akkor fogadjuk el, ha a listaár tényleg nagyobb a fizetettnél — különben bárki hamis
  kedvezményt íratna a saját visszaigazolására).

## ⛔⛔ A legfontosabb korlát, amit a felmérés hozott

**A számlán külön kedvezmény-SOR TILOS.** A Számlázz.hu a tételeket ÖSSZEADJA, tehát egy
−4 925 Ft-os sor a 14 775 Ft-os végösszeget **9 850-re** vinné. A láthatóvá tételből rosszul
számlázás lett volna. Az őr ezért minden esetben visszaméri a végösszeg-egyezést.
⚠️ Azt, hogy az API támogat-e kedvezmény-mezőt, a kódból NEM lehetett eldönteni — ezt
kimondtam a tulajnak ahelyett, hogy tippeltem volna.

## Egy ÉLŐ hiba, amit a terv-kör tárt fel

A sáv a modulokat `", "`-vel fűzte össze — **négy helyen** —, a 14 modulnévből viszont **hat
maga is vesszős** („Árak, szezonok", „Környék, látnivalók"). Ezért olvasódott a tulaj
képernyőjén **öt tételnek a három modul**, miközben a számla mellette „3 modul"-t írt. Most
„ · " választ el, és minden név egyben törik (`.adm-nowrap`) — mérve 390 px-en a sor korábban
a NÉVEN BELÜLI vesszőnél tört, lógó vesszővel zárva a sort.

## ⛔ A mérőeszköz HÁROMSZOR hazudott, mielőtt a termék egyszer is

1. Az őr **non-greedy regexe** (`[\s\S]*?</div>`) az ELSŐ belső `</div>`-nél levágta a sávot,
   ami most beágyazott elemeket tartalmaz → **hibátlan kódra 4 bukást** jelentett. Most
   mélység-helyes kivágás (`sliceElement`).
2. A **pixel-alapú „zöld sáv keresése"** vak volt a `#e7f8ef` háttérre (a kék komponens
   magasabb, mint amit a szűrő engedett) → „a sáv nincs a lapon", miközben ott volt. A
   szöveges HTML-mérés cáfolta.
3. A **`toLocaleString` nem-törő szóköze** miatt a megjegyzés-állítás pirosra ment egy
   hibátlan szövegen.

Plusz: az első vizuális ellenőrzésnek a `--fold` (viewport) képeket adtam, amelyeken a sáv
jogosan nincs rajt — a hibát az ellenőrzőnek adott ROSSZ BEMENET okozta, nem a termék.

## Kontraszt — mérve, nem érzésre

A kedvezmény zöldje (`--citui-ok`, #2fa96b) fehér dobozon **3,00:1** — AA-bukás, és épp az a
szám, amelyik a kedvezményt igazolja. A 75 %-os keverés 4,51 lett volna (épp-hogy), ezért
70 %: **4,87:1**. Visszamérve a renderelt képen: #24805B, 4,87, és zöld maradt (hue ≈ 156°).

## ⚠️ ADR-szám: ötödször csúszott el egy szálon

A `0194b` ideiglenes hivatkozásból 0202 lett, mire a kapukon átjutottam — de a rebase közben
**valaki landolta az ADR-0202-t**. A csere ezért NEM volt vak: megmértem, hogy az én 7
hivatkozásom az `src/` alatt van, az idegené a `_planning/` alatt, és csak az `src/`-t írtam
át **0203**-ra. (`feedback_adr_number_can_collide_at_land`)

## Módosított fájlok

`src/server/adminViews.ts` · `src/server/public.ts` · `src/payment/service.ts` ·
`public/assets/ui/citui-admin.css` · `src/i18n/catalog.json` ·
`scripts/coupon-visible-check.mts` (új) · `hooks/pre-commit` ·
`kb/entries/admin-modules/entry.hu.md` · `assets/design-refs/tenant-admin/coupon-visible/` ·
`_planning/DECISIONS.md` (ADR-0205)

## Zárás (2026-09-23)

- A kedvezmény-munka **igazoltan fent** (szemantikus próba: „Üdvözlő kedvezmény", `adm-rcpt`,
  `invoiceComment`, az őr és az ADR-0205 mind az `origin/main`-en; `origin/main..HEAD = 0`).
- A KB-fordítás szálak közti versenyét egy másik szál zárta le: **ADR-0207** (a fordítás-frissesség
  a DEPLOY kapuja, nem a commité). Erre külön session nem kell.
- A session↔munkafa hibát a **§9 doktrína** + az új `rc-new.sh --brief` zárta (foglalt fát elutasít).
- 🔴 **Nyitva, a tulaj döntése szerint most NEM indul:** a ~87 worktree kitakarítása. A
  `~/wt/kbverseny` az én leállított indítási kísérletem maradéka (0 commit, csak brief) — törölhető,
  de a takarítással együtt, nem külön.
