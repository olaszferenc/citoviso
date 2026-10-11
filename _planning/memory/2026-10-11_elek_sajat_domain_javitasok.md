# 2026-10-11 — Elek 10-11 saját domain kör: javítások (B1–B5, K1–K6, A1–A4)

**Szál:** SUB `cit8a5530e0` (koordinátor: „Elek-teszt koordinátor”, `cit333dea6d`). Brief: `~/rc-briefs/domain-javitasok-elek-20261011.md`.
**ADR:** `ADR-XXXX` — saját domain: egy rendelés tenantonként, `setup_retry`, `www` → 301, mock regisztrátor ⇒ mock orákulum.
**Commit:** `fix(domain): Elek 10-11 saját domain kör …` (247bf203 a fában). Migráció: `0106_domain_order_single_flight.sql`
(a dev `citoviso_dev`-re kézzel lefuttatva; élesen olvasva: ütköző sor nincs). Nem élesítve.

## Elvégezve
- **B1** dupla beküldés: `/admin/domain/order` tenantonként sorosít (`domainOrderLock`), `domainOrderBlocker` (él / fut / zárolt / friss
  pay-link ugyanarra → visszaadja), másik névre a régi link `cancelled`; `startDomainProvisioning` site-onként egy aktív sor (új részleges
  egyedi index), versenyvesztes → zárolás feloldva, nincs nyers `duplicate key`; árva `reserved` 15 perc után feloldva; élő site állapotát
  semmi nem írja vissza.
- **B2** `setup_retry` állapot (vétel UTÁNI DNS/TLS-hiba): lehívás marad, időzítő újrapróbál, házi riasztás, igaz levél + felület.
- **B3** `uj=1` végig a GET-űrlapokon. **B4** Áttekintés/zárolás/Barion = a választott végződés díja; Pénztárca + Modulok következő terhelése
  domain-díjjal, `domainFeeForRenewal`-ból. **B5** `order_intent.platform_label` → aktiváláskor a slug.
- **K1** nem kínált végződés szövege; **K2** számla-levél kedvezmény a valós alapon + „Saját webcím” sor; **K3** /pricing hiányzó mező
  nem nulláz; **K4** csomag-tartalom domainnél a díj kimondva; **K5** `www.<saját>` → 301; **K6** (koordinátor) mock regisztrátor ⇒ mock
  elérhetőség-orákulum. **A1–A4** kész; ISMERT (díj nélküli utólagos igénylés) → kézi intézés + házi riasztás.
- KB `admin-domain` frissítve; i18n katalógus újragenerálva.

## Őr
`scripts/domain-order-single-flight-check.mts` (pre-commit bekötve) — a régi kódon 28 bukás.

## Elek-utómérés (scratch-DB `citoviso_domfix_10111927`, mock)
B1 (38, 60) · B2 (37) · B3 (36) · B4 (31c, 70: Pénztárca = Modulok = kibocsátott megújulás 86 800 / 8 440 / 8 240) · B5 (93: `cimke-sajat`
+ `elek-cimke.hu` live) · K1/A2/A4 (39) · K3/K2 · K4 (79/81: 9 500 → váltás után 5 880, benne 1 000 domain) · K5 (97) · A1 (11). Képek:
`_fix/shots/` (gitből kizárva, a koordinátor hozza át).

## Nyitott (koordinátornak jelezve)
- Webcím 1. lépés díj-sora választás előtt az elsődleges végződés díját mondja — új szöveg kellene (UI-döntés).
- Konfigurátorban az új „régi cím megmarad” mondat az első vásárlónál kissé idegen („régi cím”) — szöveg-döntés.
- Ismeretlen host továbbra is 200 + nyitóoldal (K5 mellett, külön döntés).
- Dev Webcím mostantól mock-elérhetőséget mutat, ha a `.env` nem kéri: `DOMAIN_AVAILABILITY_SOURCE=registrar`.
- ISMERT: a „kézi intézés” mondat a meglévő mintából épült — tulaj-OK kell.
