# 2026-09-27 — Deploy-előkészítés: száraz futás + a tudásbázis-őr lelete (a deploy másik szálban ment)

## Mi történt
- A tulaj: „Deploy → 100 Ft → GoLive”. Száraz futás a `d66e4081`-re: GATE 4 ✓, GATE 2 diff (892 fájl, 6 migráció
  0071–0076, mind additív), jogi réteg ✓, 49/49 súgó-kép ✓, kb-check ✓ — **egy kapu piros: nincs tudasbazis-or
  verdikt** a tartományra (17 KB-entry változott).
- A tudasbazis-or (szubagens) **FLAG**: az Áttekintés-súgó menü-térképe (`kb/entries/admin-overview/entry.hu.md:17-18`)
  nem ismerte a tartományban született két új fület — Elérhetőség (ADR-0241, „Az oldalam”) és Pénztárca (ADR-0226,
  „Üzlet”); a Pénztárca-entry sem mondta meg, hol a fül. Minden más (~600 idézet, lefedettség ADR-0211–0247, 6 kép
  szemmel) rendben. Nem blokkoló megjegyzések: admin-wallet:19/62 „bal/jobb oldali” telefonon egymás alatt;
  admin-subscription:198/208 csonka próza-idézet.
- Javítva + landolva (`42a41f36`), az őr ÚJ ítélete PASS, verdikt rögzítve (`kb-gate.mjs pass`, 24 h TTL,
  SHA-tartományhoz kötve), **száraz futás ZÖLD a `42a41f36`-ra** (4 új systemd-időzítő: `citoviso-events`,
  `-events-pending`). Engedélyt kértem a `--go`-ra.
- A tulaj: „nem, megint találtam egy súlyos hibát” → másik szálban rendezi; **a deploy a másik szálban megy**
  (2026-09-30: az éles fa HEAD-je már `a1b134e6` = origin/main). Ebben a sessionben élesre SEMMI nem ment ki.

## Módosított fájlok
- `kb/entries/admin-overview/entry.hu.md`, `kb/entries/admin-wallet/entry.hu.md` (`42a41f36`)

## Tanulság
- A deploy KB-kapuja (GATE 1c) a szubagens verdiktjét kéri, SHA-tartományra kötve: minden landolás után új ítélet
  kell (~7 perc). A menü-térképet tanító egyetlen entry (admin-overview) minden új fülnél frissítendő — a kb-check
  coverage ezt NEM méri (anchor-szinten zöld volt).
