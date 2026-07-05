# Citoviso — BACKLOG / parkolt ötletek

> Később kidolgozandó ötletek, amelyek nem az aktuális fázis tárgyai, de nem szabad elveszniük.
> Ha egy ötlet aktuálissá válik, told a megfelelő ROADMAP-fázisba.

## Termék / UX

### Interaktív mock-konfigurátor + élő próbatér (fizetés ELŐTT)
Dátum: 2026-07-05 · Forrás: tulaj (ötlet)
- A **mock megnyitása interaktív önkiszolgáló folyamatot indít**, nem statikus előnézet: a leendő vevő
  **összeállítja magának a csomagot** (modulok), **cserél képet, hangol kinézetet**, és **élőben teszteli**
  az általa összerakott honlapot — mindezt **élesítés/fizetés ELŐTT**, és **bármikor visszatérhet** hozzá.
- **UX-ív (fontos):** (1) *puff-varázslat* = a kész, lenyűgöző mock, nulla erőfeszítés (a horog) →
  (2) *elmélyülés* = a motivált lead testre szab + élőben tesztel (elköteleződés) → (3) fizetés → élesítés.
  Feloldja a látszólagos feszültséget a „nulla vacakolás" elvvel: előbb a csoda fog meg, utána szöszöl vele.
- Kapcsolódik: élesítés = 1. fizetős kapu (alapmodell); minimum→szofisztikált modul-lépcső (1d);
  a 3 becsatlakozási pont fokozatos bekapcsolása (Fázis 2). Kidolgozás: várhatóan Fázis 4 (MVP).

## Működés / skálázás

### Belső moduláris back-office (operátor-platform)
Dátum: 2026-07-05 · Forrás: tulaj (megjegyzés)
- A control plane maga is egy termék: **belső, operátor-facing moduláris platform** — pénzügy, sales, **CRM**,
  **bizonylat-management**, egyéb belső modulok. Ugyanaz a „modulárisan bővül, nincs egyedi fejlesztés" filozófia,
  mint a tenant-oldalon → **két moduláris platform** (külső Site-modulok + belső back-office).
- **Belső RBAC:** szerepkör-szintű jogosultság (kurátor / pénzügy / sales / support / admin külön). Ez akkor válik
  élessé, amikor ezeket a belső modulokat fejlesztjük (későbbi fázis; a Fázis 3/3d lefektette az alapot).

### Adat-vezérelt lead-priorizálás (az all-in indulás UTÁN)
Dátum: 2026-07-05 · Döntés: indulásnál ALL IN (minden leadnek mock), közben kategória/konverziós adatot gyűjtünk.
- Később: **lead-scoring** a begyűjtött adatból (mely kategóriák/jelek konvertálnak) → a drága mock-gyártást
  a legígéretesebb leadekre fókuszáljuk (költség-optimalizálás). A1/A2-konzisztens: előbb tanulunk, majd automatizált szűrés.
