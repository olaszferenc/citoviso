# Teszt-napló (Elek-rend) — jóváhagyott kontraktus: B változat

**Tulajdonosi jóváhagyás:** 2026-09-04 („B változat"). A mock: `elek-test-log-B.html`
(kattintható; Mobil 390px / Asztali váltóval). Ez a fájl mondja ki, mit KÖT a terv —
elvárt viselkedés, nem stílus-javaslat.

## Mit köt a terv

1. **Elrendezés:** folyamatos szakasz-lista (nincs akkordeon) + „Állapot" összegző.
   Asztalin (≥820px konténer): jobb oldali, ragadós sáv szakasz-ugró linkekkel;
   mobilon: alsó ragadós sáv (kész/összes + haladás-csík + szerver-mentés állapota).
2. **Checklist:** szakaszonként checkboxos lépések; a gépileg nem ítélhető lépésen
   `kézi` jelvény. Pipa/komment **helyben azonnal mentődik** (localStorage — reload-túlélő),
   szerverre a „Mentés a szerverre" gombbal kerül; a gomb után a mentés ténye és ideje
   látható állapotjelzésként.
3. **Komment / finding:** minden szakasz alatt szabad-szöveges mező + „Végső összegzés"
   az összegző-sávban.
4. **Korábbi mentések listája** az összegző-sávban (ki, hány lépés, mikor).
   ⛔ **Két-út doktrína:** az `elek` felhasználó sora a közös listában SOHA nem jelenik
   meg; Elek futása kizárólag a kapott `?user=elek` linkkel nézhető meg (megtekintő mód:
   csak olvasás, a kommentek és az összegzés kitöltve látszanak).
5. **Hozzáférés:** operátor-login mögött (`:4600`), Tailscale-en bárhonnan elérhető.
   Elek `elek` app-userként, API-n át tölti ki (hamisított session, jelszó nélkül).
6. **Tartalom-forrás:** a checklist a forgatókönyv (FK) checklist-soraiból renderelődik
   (emberi igazság-sorok + `kézi` jelölés); a gépi mezők (`út:`, `tedd:`, `várd:`) a
   naplón NEM jelennek meg.

## Ami nem kötött

Minta-adatok (FK-001 szakaszai a mockban), pontos szövegek, a mentés-lista formátumának
részletei — a megvalósítás a citui-tokenekből dolgozik, a mock formanyelvét követve.
