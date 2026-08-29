# JÓVÁHAGYOTT TERV — Mobil-megkeresés: MMS+SMS páros (B változat)

Tulaj-jóváhagyás: 2026-08-29 („B az tök jó irány"). ADR-0083. Ez a terv a megvalósítás
KONTRAKTUSA — elvárt viselkedés, nem stílus-javaslat.

## Amit a terv KÖT

1. **Két csatorna-kártya:** E-mail (változatlan) + „Mobil-megkeresés" — az önálló hideg
   SMS-gomb NINCS többé a felületen (a kártya ki is mondja, miért: link kép nélkül =
   phishing-gyanú).
2. **Idővonal a kártyák alatt, teljes szélességben:** ① MMS (a kimenő KÉP előnézetével +
   folyamatjelző + a ~60–90 mp és az SMS-sor-várakozás kimondva) → ② kísérő SMS (a kimenő
   szöveg dobozban) → ✓ „a pár = EGY megkeresés" összefoglaló (kapu-sor felsorolva).
3. **Indítás:** egy gomb („Páros indítása"), őszinte confirm-szöveggel ([]VALÓDI MMS+SMS,
   nem visszavonható), küldés alatt letiltva; az állapot-pill a kártyafejlécben frissül.
4. **Hiba-ág (KÖTELEZŐ):** ha az MMS kiment, de az SMS-fele elhasal → HANGOS hiba-sáv +
   „SMS újra" gomb (csak az SMS-fele megy újra; a pár claimje marad, mert a lead már látta
   a képet). A ② lépés `fail` állapotot mutat.
5. **Élő követés:** a valódi ~90 mp alatt a felület mutatja, hol tart (a mockban
   szimulált; élesben poll/frissítés — az ütemezés implementációs részlet, a LÁTHATÓSÁG nem).
6. **Állapot kattintás ELŐTT:** kiküldött pár = nincs gomb, „kiküldve — <időpont>" (ADR-0082
   elve); allowlist-blokkolt szám = a gomb helyén az ok szövege.

## Ami a tervtől INDOKOLTAN eltér (jogi kötelező, §C)

A mock SMS-doboza nem tartalmazta a jogalap-szót és a feladó nevét — a kimenő VALÓDI
szövegben mindkettő KÖTELEZŐ (checkOutreachSms C2-kapuja), tehát a doboz szövege élesben:
„{név} – az imént MMS-ben küldött látványtervet élőben itt nézheti meg (jogos érdekű
megkeresés, nem kötelez): {link} – {feladó}. Leiratkozás: {unsub}".
