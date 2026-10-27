# BÁBEL — ontológia-kivonat (amit tudnod kell, mielőtt fordítasz)

> Forrás: `_planning/DOMAIN/00-GLOSSARY.md`, `03-INVARIANTS.md` §B.17/§B.18, ADR-0036, ADR-0045,
> ADR-0067, ADR-0281, ADR-0411. A gép a `src/i18n/babel/ontology.md`-t olvassa — ez a kivonat a
> te háttered hozzá; a kettő nem mondhat ellent egymásnak (ha igen: a motoré a javítandó).

## 1. Hogyan születik egy nem-magyar felirat

- A magyar forrás a kódban él, `T(lang, "…")` / `tr("…")` burkolással. **A kulcs maga a magyar
  szöveg.** A kinyerő (`scripts/extract-i18n.mts`) ebből katalógust ír (`src/i18n/catalog.json`,
  ~5 700 string) és mellé a **felület-térképet** (`catalog-context.json`: string → felület).
- Egy nyelv **csomagja** (`language_pack` tábla) = magyar → fordítás térkép. Ami hiányzik,
  magyarul jelenik meg (hu-fallback) — a vevő ezt hibának látja, ezért a teljesség mérve van.
- A csomag forrásai, elsőbbségi sorrendben:
  1. **a te magod** (`src/i18n/babel/packs/<nyelv>.json`) — a deploy alkalmazza, felülír;
  2. **a gépi kezed** (`src/i18n/babel.ts`) — a te ontológiáddal és glosszáriumoddal, a
     felület-kontextussal fordítja, ami a magból hiányzik.
- A **súgó** (KB) cikkenként fordul (`kb_translation`), csak a szállásadóknak szóló cikkek. A
  súgóban a **„félkövér-idézőjeles”** gombfeliratok MAGYARUL maradnak, szó szerint (a gép ezt
  ellenőrzi: felirat-, kép- és alcím-egyezés).
- A **vendég-honlap tartalma** (a szállás leírása) külön, megrendelésre fordul
  (többnyelvűség-modul) — ott a §B.17 a legszigorúbb: szám nem változhat.

## 2. A felületek (ki olvas, milyen hangon)

| felület | olvasó | hang |
|---|---|---|
| konzol | a Citoviso operátora | tömör, szakmai, belső |
| admin | a szállásadó, IT-kezdő | udvarias, magázó/önöző, hétköznapi szavak |
| honlap | a szállás vendége | vendéglátós, barátságos, a szállás nevében |
| level | tulaj vagy vendég (a szövegből látszik) | levélnyelv |
| megkereses | még-nem-ügyfél szállásadó | udvarias, személyes, nem reklám |
| sms | bárki | nagyon rövid |

Több felület (pl. `admin+honlap`): olyan forma, ami mindkettőn helyes.

## 3. A Citoviso szavai — ahol a gépi fordítás eddig hibázott

- **Elérhetőség** — menüpontként „kapcsolat” (Contact), naptárként „szabad-e” (Availability).
- **Kijelentkezés / bejelentkezés** — a honlapon check-out / check-in, a fiókban log out / sign in.
- **Lemondás** — vendég-foglalásnál storno (Stornierung), előfizetésnél felmondás (Kündigung).
- **Számla** — kiállított számla (invoice) vagy bankszámla (account).
- **Csomag** — díjcsomag (plan; a neve tulajdonnév) vagy más csomag (package).
- **Minta-honlap (mock)** — bemutató honlap, nem makett, nem sablon.
- **Élesítés** — nyilvánossá tétel (go-live), nem „aktiválás”.
- **Próba** — ingyenes kipróbálás (free trial), nem „teszt”.

## 4. Kemény szabályok

1. §B.17 — átülteted, nem alkotsz: szám, ár, dátum, mérték, tulajdonnév marad.
2. Placeholder: `{x}` betűre marad; `{art}`/`{Art}`/`{art2}` (magyar névelő) nem-magyarul kimarad.
3. Jogi szöveg nem UI-fordítás — nem a te dolgod.
4. Konzisztencia: egy fogalom egy felületen egy forma — a glosszáriumé.
5. A felirat hossza: gomb, menüpont, oszlopfej ne nőjön a forrásnál érdemben hosszabbra.

## 5. Költség és kapuk (hogy értsd, miért így dolgozunk)

- Mérve 2026-10-27 élesen: egy konzol-nyelvváltás `sl`-re 16 teljes gépi csomag-fordítást
  indított egy óra alatt — $130, két kredit-újratöltés.
- A tulaj döntése ugyanaznap (ADR-0412): **fordítás API-hívással TILOS.** Fordításra csak a te
  előfizetéses sessionöd költhet — te kontextusban fordítasz, a gép nem. A kód csak a commitolt
  magodat teszi a DB-be; ami hiányzik, magyarul jelenik meg, amíg le nem fordítod.
