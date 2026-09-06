# Árazás és értékesítés — jóváhagyott terv (2026-09-06, tulaj)

A `plan.html` a KONTRAKTUS (kattintható; képek: plan-desktop/mobile.png). Amit KÖT:

1. **Hely: a CRM-en belül.** Elérés: felső „CRM ▾" legördülő menüpont + Irányítópult
   CRM-kártyáján „Árazás és értékesítés" sor, badge-dzsel (`N/14 eladó`; ha nem teljes,
   figyelmeztető szín). A teljes /pricing tartalom ide költözik; a Pénzügy-kártyáról
   és menüből az Árazás KIKERÜL.
2. **Kompakt, csík nélkül** (tulaj kétszeri visszadobása után): NINCS sor-elválasztó
   vonal; szám-inputok rövidek (~76px), jobbra igazítva, egység mellettük; a modulok
   KÉTOSZLOPOS rácsban, egy kompakt sor/modul; 760px panel; 13px alapbetű.
3. **Soronként:** kapcsoló · modulnév · élő-előfizetés chip (ha >0) · ár-input · egység.
   Gerinc (enquiry): zárolt kapcsoló, „gerinc — az alapdíjban", nem kikapcsolható.
4. **Kikapcsolás jelentése (tulaj-rendelet):** új előfizetés NEM köthető a modulra
   (konfigurátor + kiküldött mock all-in + konverzió + tenant-upsell); a MEGLÉVŐ
   entitlementek futnak tovább. Kikapcsolt sor: áthúzott név + warn-színű megjegyzés
   a sor alatt, ár-input halványítva.
5. **Email modul ALAPBÓL KI** (seed; tulaj-rendelet 2026-09-06 — marketing-kampánnyal
   hirdetjük majd ki, addig nem eladható).
6. A meglévő /pricing elemei mind megmaradnak: régió-váltó, alapdíj + éves ingyen
   hónapok + saját-domain díj, egyedi-domain feltételek (ADR-0093), „árak véglegesek"
   §C-pipa, mentés-visszajelzés.
