# 2026-09-21 — A számlázó fiók követte az adószám-cserét (új Számlázz.hu fiók + Agent kulcs)

## Mi történt

A 2026-09-16-i javítás (`2026-09-16_terminated_tax_number.md`) az **`.env`-et** hozta helyre: a
megszűnt e.v. `69646014-1-33` száma helyére a valós `92227011-1-33` került. Ami **kimaradt**: a
**Számlázz.hu fiók maga** továbbra is a megszűnt adószámon állt, és a `SZAMLAZZ_AGENT_KEY` is
ahhoz a fiókhoz tartozott. Vagyis a konfigunk a jó számot mondta, a számlát kiállító **szolgáltató
a rosszat** — egy éles fizetés a megszűnt vállalkozás nevére állított volna ki bizonylatot.

## Amit a Számlázz.hu KÉNYSZERÍT (nem választás kérdése)

| Adószám-rész | Módosítható a fiókban? |
|---|---|
| törzsszám (első 8) | ❌ **soha** — más törzsszám = más adóalany |
| áfakód (9. jegy) | ✅ ceruza ikon |
| megyekód (utolsó 2) | ✅ ceruza ikon |

Új törzsszám ⇒ **új számlázási fiók**, kivétel nincs. **„Alfiók" nem létezik**: a helyes forma egy
külön fiók **ugyanazzal a belépéssel** (bal felső cégválasztó; „Hozzám kötődő cégek"). Előfizetés
fiókonként külön, a számlasor 1-től indul.

⛔ **A tesztüzem kapuja egyirányú:** csak akkor kapcsolható be, ha a fiókban **még nincs kiállított
számla ÉS még nincs NAV Online Számla összekötés**. A Vezérlőpult felkínálja a NAV-összekötést egy
linkkel — aki arra kattint előbb, **végleg elveszti a tesztüzemet** abban a fiókban. A kapcsoló a
**Vezérlőpulton, a jobb oldali hasábban**, a `#free` és a reklám-doboz alatt van (nem a Fiók
beállításainál — ott csak a *kikapcsolása* jelenik meg, ha már be van kapcsolva).

## ⭐ A kulcsot kiállítás NÉLKÜL igazoltuk — és a negatív kontroll tette bizonyítékká

`fetchIssuedInvoicePdf("<nem létező számlaszám>")` egy nem létező bizonylat PDF-jét kéri. Nem
gyárt semmit, és a `szlahu_error_code` elválasztja a két esetet:

| Kulcs | Hibakód | Jelentés |
|---|---|---|
| az új | **7** | „ismeretlen számlaszám" → **a hitelesítés átment** |
| szándékosan rossz | **3** | „Sikertelen bejelentkezés" |

⛔ A 7-es **önmagában semmit nem bizonyít** — ha egy rossz kulcs is 7-et adna, a mérés üres. A
kulcs a függvényen belül olvasódik (`szamlazz.ts:191`), ezért futásidőben felülírható, és a két
hívás egy scriptben elvégezhető. **Kulcs-próbához ez az olcsó, mellékhatás-mentes út.**

## ⛔⛔ Az `.env` csere NEM ér el a futó szerverhez

A tulaj bejelentése: *„a dev rendszer még a régi fiókot használja"* — pedig az `.env` már az újat
tartalmazta, és a próba-számla is az új fiókba ment.

**Ok:** `src/config.ts:10` — `process.loadEnvFile()` **egyszer fut, modul-betöltéskor**. A
`tsx watch` a `.ts` fájlokra figyel, az `.env`-re **nem**. A szerverek 2026-09-20 22:42 óta
futottak, az `.env` 11:38-kor változott → 13 órán át a régi kulcsot tartották a memóriájukban.

**Javítás:** `sudo systemctl restart citoviso-public citoviso-console` (a dev szerverek **system**
systemd unitok, nem tmux és nem user-service; a szülőjük PID 1). Igazolás: az
`ExecMainStartTimestamp` (12:06:29) **későbbi**, mint az `.env` mtime-ja (11:38:52).

⚠️ **Csapda a diagnózisban:** a `/proc/<pid>/environ` **NEM mutatja** a kulcsot, mert a
`loadEnvFile()` a process saját memóriájába tölt, nem az exec-kori környezetbe. A „nincs benne"
lelet tehát **nem** azt jelenti, hogy nincs beállítva — a `ps` indulási ideje az árulkodó jel.

## Végponttól végpontig igazolva

`CITO-2026-1` próba-számla a **valódi `SzamlazzAgent` adapteren** át (ugyanaz a kód-út, amit egy
fizetés használ), 14 900 Ft, AAM / 0 Ft áfa, PDF visszajött (26 kB, `JVBERi0`).

⭐ **A tesztüzemet nem a szóbeli állítás igazolta, hanem a dokumentum:** a PDF-en **„minta minta"
vízjel** és az eladó neve előtt **„TESZT –"** előtag. A lapon a helyes `92227011-1-33`, a
`62588818` nyilvántartási szám, a bankszámlaszám és a CITO-logó.

**Lelet a PDF-en:** a Számlázz.hu fiók székhelyében **„Klebe*s*berg"** állt (hiányzó `l`) — a régi
fiókban helyesen volt. A tulaj javította.

## Amit a tesztüzem a CITO-tesztelésből ELVESZ

- 🔴 **A számlaértesítő e-mail MINDIG a fiók kapcsolattartási címére megy, nem a vevőére** — a
  fizetés-visszaigazoló folyamat tesztelésekor ez félrevezető, és **nem a kódunk hibája**.
- Nincs NAV-adatszolgáltatás, Autokassza, online fizetés-teszt, archívum; díjcsomag-váltás és
  felhasználó-meghívás tiltva; a kiállító adatai/adószám **tesztüzemben nem módosíthatók**.
- Az éles átálláskor a Számlázz.hu **törli az összes teszt bizonylatot**, a számlasor 1-től indul.

## ⛔ Saját hiba: a `| sed` elnyelte a grep kilépőkódját

`grep -n "69646014" "$E" | sed 's/…/…/' || echo "tiszta"` — a pipeline exit kódja a **`sed`-é
(mindig 0)**, ezért a `||` ág **sosem futott**. Nem hamis zöldet adott, hanem **néma semmit**: úgy
néztem el a „tiszta" sor hiányát, hogy közben azt hittem, mértem. Újramérve `if grep -q` szerkezettel
→ az `.env`-ben a régi adószám és a régi nyilvántartási szám **0 előfordulás**, a régi Agent kulcs
a fájlon kívül sehol.

## Állás

| Tétel | Állapot |
|---|---|
| Új Számlázz.hu fiók (92227011-1-33), tesztüzem | ✅ igazolva a PDF vízjelén |
| `SZAMLAZZ_AGENT_KEY` cserélve, hitelesít | ✅ negatív kontrollal |
| Dev szerverek friss `.env`-vel | ✅ restart + időbélyeg-igazolás |
| Számla kiállítás + PDF a CITO kódján át | ✅ `CITO-2026-1` |
| Barion: `UEVH-00277388` feltöltve az Üzleti profilba + videó-azonosítás | ✅ **tulaj elvégezte**, jóváhagyásra vár |

## 🔴 NYITOTT

1. **A székhely ékezete az `.env`-ben:** `LEGAL_ENTITY_ADDRESS=… Klebelsberg **Kunó** utca 6. 2.`,
   a NAV nyilvántartás szerint **`Kuno`**. A 09-16-i jegyzet ezt nyitva hagyta („nem blokkoló"), és
   **öt nappal később is áll** — a hat publikus jogi lapon ez megy ki. Lokál javítás + **külön éles
   engedély** kell. ⚠️ A lokál `.env` **symlink a fő fába** → `sed -i --follow-symlinks`.
2. **Éles `.env` kulcscsere:** élesen még a **régi fiók** Agent kulcsa fut. Amíg ott nem cserélődik,
   egy éles fizetés a megszűnt adószámú fiókba számlázna. Külön engedélyt kér (§0.3).
3. A teljes fizetési folyamat (Elek) a **valódi** Számlázz.hu-val nincs végigvive — csak az adapter
   közvetlen hívása történt meg.

## Módosított fájlok

- `/home/citoviso/citoviso/.env` — `SZAMLAZZ_AGENT_KEY` az új (CITO) fiókéra *(nem verziókövetett)*
- `/home/citoviso/citoviso/.env.bak-20260921-szamlazz-cito` — backup a régi kulccsal
- `_planning/memory/2026-09-21_szamlazz_uj_fiok.md`, `_planning/memory/INDEX.md`, `MEMORY.md`

Kód nem változott.
