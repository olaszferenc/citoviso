# Partner-felület — végrehajtási specifikáció

**Státusz:** adatréteg KÉSZ, felület NINCS. Ez a dokumentum az átadás egy friss szálnak.
**Forrás:** a tulaj MineREAL CRM képernyői (2026-08-23), **Citovisóra értelmezve** — a képek
a felület MINTÁJA, nem adat-lista.

## Tulaj-rendeletek (nem újratárgyalható)

1. **„Ez teljesen két külön felület."** A partner-lap és a lead-lap KÜLÖN él. A lead-lap marad a
   marketing/szolgáltatás oldal (mock, kuráció, megkeresés, oldal); a partner-lap a pénzügyi +
   CRM oldal. Egymásra hivatkoznak, de nem olvadnak össze. Indok: a SZÁLLÍTÓNAK nincs leadje,
   és ugyanazt a partner-lapot kell kapnia, mint a vevőnek.
2. **„Nyilván a partnereknél kell nézni a lead előzményeket is, hogy tudjak róla. Milyen
   előfizetései vannak, és milyen aktivitásai vannak? Kvázi CRM szintű adatok."**
   → a partner-lap NEM számla-lista. Idővonal + előfizetés + aktivitás.

## Ami MÁR kész (ne építsd újra)

- **Séma:** `partner`, `partner_contact`, `partner_bank_account`, `partner_entity_setting`,
  `legal_entity`, `accounting_document(_line)`, `bank_account`, 5 dimenzió-tábla.
  Migrációk 0031/0032/0034/0035, mind alkalmazva.
- **Partner születése:** `upsertPartnerFromOrder()` (`src/billing/partner.ts`), a fizetési útba
  kötve (`src/payment/service.ts:429`). A 0029-es nyilatkozatból jön a JOGI név + adószám, és a
  számlázási e-mail `billing` kontaktként rögzül. Élesen tesztelve.
- **Azonosság:** adószám UNIQUE (0035) — nem lehet duplikátum.

## Amit építeni kell

### 1. Menüpont
`src/console/views.ts` `MENU` tömb: új elem (`/partners`, „Partnerek"). Ikon a közös készletből
(`src/ui/icons.ts`) — emoji TILOS.

### 2. Partner-lista — `/partners`
MineREAL-minta: kereső („Név, adószám, város…"), oszlopok NÉV · VÁROS · ADÓSZÁM + Citoviso-
specifikus: **Típus** (vevő/szállító jelölés), **Bizonylatok (db)**, **Forgalom**, **Kintlévőség**.
Szűrő: vevő / szállító / mind.

### 3. Partner-lap — `/partner/:id`
**Fejléc:** jogi név · cím · adószám-badge · cégjegyzékszám-badge (MineREAL-mintára).

**KPI-csempék — a partner arca szerint MÁSOK:**
| Vevő (tenant) | Szállító |
|---|---|
| Havi díj · Éves érték · Kintlévőség · Aktív modulok | Éves költség · Nyitott tartozás |

**Fülek:**
- **Áttekintés** — KPI + partner-adatok blokk (Cégnév, Ország, Irsz, Város, Cím, Adószám,
  Cégjegyzékszám, Bankszámla a `partner_bank_account`-ból).
- **Előzmények / Aktivitás** ⭐ **EZ A CRM-MAG, ez a kérés lényege.** Egyetlen, időrendi,
  ÖSSZEFÉSÜLT idővonal nyolc forrásból:

  | Forrás | Idővonal-esemény |
  |---|---|
  | `lead` + `lead_provenance` | mikor és honnan találtuk, melyik adat honnan jött |
  | `mock_artifact` + `curator_decision` | mock generálva / jóváhagyva / elutasítva |
  | `prospect` | megkeresés kiküldve (`sent_at`), leiratkozás (`unsubscribed_at`) |
  | `mock_view` + `mock_event` | **a valódi arany:** megnyitotta · görgetett · modult kapcsolt · megrendelést indított · fizetéshez ment (a típusok címkéi már megvannak a `views.ts`-ben) |
  | `order_intent` | mit konfigurált, milyen áron, milyen ciklusra, mikor nyilatkozott |
  | `payment` | fizetés kezdeményezve / sikeres / sikertelen |
  | `accounting_document` | számla kiállítva, fizetve, könyvelve |
  | `site` + `module_entitlement` | élesítés (`live_at`), modul be/ki |
  | `tenant_user` | belépett-e valaha az admin felületére (`last_login_at`) |

- **Előfizetés** (csak vevőnél) — aktív modulok, havi/éves díj, ciklus, domain, élő oldal linkje,
  átvezetés a lead-lapra.
- **Bizonylatok** — MineREAL-minta 1:1 (ADR-0064/0066 „C” irány): a globális `/documents` listán
  per-deviza KPI-sáv (Nekem jár · Én fizetek · Lejárt · Nettó pozíció) + oszloponkénti szűrő a
  fejlécben, szerver-oldali GET-formban (Szám · Partner · Típus · Kelte tól-ig · Fiz. határidő
  tól-ig · Pénznem · Állapot), aktív-szűrő chipek egyenkénti törléssel. Irány NINCS a felületen
  (a Típus hordozza). Tábla: Bizonylatszám · Partner · Típus · Kelte · **Fiz. határidő** ·
  **Esedékesség** (a határidőből számolt olvasat) · Nettó · Bruttó · **Pénznem** · Állapot +
  **Számlakép** gomb soronként (`document_file`) + Excel-export. **Lapozás:** 50 sor/oldal,
  klasszikus lapozó (tartomány + oldalszámok, sima linkek). ⚠️ A lapozás CSAK a sorokat vágja:
  a KPI-sáv, a korosítás, a végösszegek és az Excel-export mindig a TELJES szűrt halmazra
  vonatkoznak (külön aggregáló lekérdezés) — az Áttekintés-fül KPI-csíkja és havi diagramja
  ezért `{ all: true }`-val kéri a bizonylatokat. Őr: `scripts/documents-paging-check.mts`.
  A partner-lap fülén slim
  Típus/Fizetve szűrő + **korosítás** (Nem lejárt · 1-30 · 31-60 · 61-90 · 90+ nap). Sztornó
  negatív összeggel, ugyanabban a listában.
- **Kontaktok** — `partner_contact`, `kind` szerint (billing / technical / owner).

### 4. Számított mutatók (NEM tárolt mezők)
- **Korosítás:** `due_date` + `paid` — vödrökbe sorolás.
- **Fizetési szokás:** átlagos `paid_at − due_date` (negatív = határidő előtt) + „% időben fizetett".
Ezekre NINCS oszlop és ne is legyen — a `paid_at`/`due_date` kiadja őket.

## Kötelező kapuk (a projekt doktrínája)
- **i18n:** a konzol OPERÁTOR-felület → `// i18n-exempt: operator-facing (console …)` jelölés kell,
  különben a PostToolUse-hook blokkol.
- **Dizájn-token:** a konzol a `--citui-*` magból veszi a színt; nyers hex TILOS
  (`scripts/design-token-lint.mts`).
- **Tudásbázis (§J, ADR-0045):** admin-funkció súgó nélkül nem születhet → `data-kb-anchor` +
  KB-entry, különben a `kb-check --coverage` bukik.
- **Mobil:** a tulaj TELEFONRÓL használja a konzolt → **390px-en is verifikálni**.
- **Őr:** viselkedést mérj, ne jelölést; futtasd PIROSRA szándékos rontással; kösd pre-commitba.

## Csapdák, amikbe ezen a szálon már beleléptünk
- A konzol **cache-eli** a konfigurátor CSS/JS blokkját → `assets/runtime/*` szerkesztés után
  KÖTELEZŐ szerver-restart, különben álló kódot tesztelsz.
- Új migráció előtt `git fetch` + MINDEN worktree ellenőrzése (a `schema_migrations` a fájl NEVÉT
  jegyzi, a DB közös → azonos név = néma kihagyás sikerjelentéssel).
- A `schema.ts` és a DB szinkronját a `scripts/schema-drift-check.mts` őrzi — új tábla esetén a
  MAP-be is fel kell venni.
