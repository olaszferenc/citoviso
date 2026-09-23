# 2026-09-23 — Vendégvélemény-kezelő: a csillag nem hazudik többé, a köszönőlevél egyszer megy ki

**ADR-0219.** Brief: `~/rc-briefs/reviews-admin-list-brief.md`. Saját fa: `~/wt/cit25841bd5`.

## Tulajdonosi döntések
- **B terv** (csoportosított lista) — kontraktus: `assets/design-refs/console/reviews-inbox/`.
- A Google-kártyán a csillagok **maradnak** („Miért vegyük le a csillagokat?") — a lapot tükrözik;
  csak a hamis „5/5" jelölés ment ki (4,8 ≠ 5/5).
- Dupla köszönőlevél javítása: **új oszlop** (`site_review.thanked_at`, migráció 0073).

## Elvégezve
- `reviewsEditor` újraírva a B terv szerint (+ CSS a `MODCFG_STYLE`-ban), a döntés utáni sor megnevezi,
  kivel mi történt (PRG: `e`=sor, `uz`=published|rejected|withdrawn, `#velemenyek`).
- Súgó-horgony `admin.modules.reviews` + bejegyzés `kb/entries/admin-modules-reviews/` (tudásbázis-őr: PASS).
- Őrök: új `reviews-inbox-check` (pre-commit), `i18n-pseudo-check` bővítve (reviews + attribútumok),
  `review-flow-check` bővítve (nincs második levél).

## Tanulság
- **Az i18n-lint ékezetet keres** — a „Kiteszem/Leveszem/Az oldalon/csillag" ékezet nélküli, ezért
  átment. A szerkezeti válasz (pszeudo-nyelv) megvolt, csak ez a képernyő nem volt rajta a listán:
  **új képernyőnél a pszeudo-check `SURFACES` listájára is fel kell venni.**
- A saját mockom is hazudott egyszer: a Google 4,8-at „★★★★★ 5/5"-ként mutatta — ugyanaz a hiba, amit
  javítani mentem.
- Rontás-próbánál egy „csak az elhelyezés" rontás ZÖLD maradt, mert a rács elemei maguk hozták létre
  az oszlopokat — az nem volt valódi rontás; az egész `@container` blokk kivétele piros.

## Nyitott
- 4 meglévő i18n-szivárgás a konzol attribútumaiban („minimum", placeholder) — külön szál.
- Élesítés: NEM (külön engedély); a deploy a 0073-as migrációt futtatja.
