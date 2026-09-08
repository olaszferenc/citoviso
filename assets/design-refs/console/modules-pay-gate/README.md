# Kontraktus — Modulok fül: fizetés-kapus aktiválás (ADR-0113, jóváhagyva 2026-09-08)

Tulaj-döntés: **„B" változat — megerősítő kártya.** A `plan.html` a jóváhagyott, működő terv
(méret-váltóval; az A változat elvetve).

Amit a terv KÖT (elvárt viselkedés, nem stílus-javaslat):

1. **A kapcsolók nem élesítenek.** A lap alji összegző sáv gyűjti a változásokat; fizetős ÚJ
   modulnál a sávban látszik a „Fizetendő most" összeg és soronként a
   „fizetés most: X Ft (N hónap a fordulónapig)".
2. **Az „Alkalmazom"/„Fizetés és alkalmazás" gomb fizetős bővítésnél MEGERŐSÍTŐ KÁRTYÁT nyit**:
   tételsorok (modul · N hó × havi ár = összeg), „Fizetendő most" összesen, magyarázó mondat
   (a modul CSAK a fizetés után jelenik meg; a következő fordulónapi számlán már normál tétel),
   [Mégsem] + [Tovább a fizetéshez / Terhelés és élesítés].
3. **Díjbekérős mód:** a megerősítés után a fizetőoldalra irányítunk; a modul a fizetés
   beérkezésekor élesedik. **Kártya-megbízás mód:** azonnali terhelés; siker-sáv mondja ki az
   összeget („A kártyáját megterheltük X Ft-tal — mostantól él: …").
4. **Ingyenes változtatás** (lemondás, visszakapcsolás, 0 Ft-os modul) továbbra is azonnali,
   megerősítő kártya nélkül — kivéve ha fizetős bővítéssel együtt megy (akkor a kártya
   a fizetős részről szól, az ingyenes rész azonnal érvényes).
5. **A számok a valódi szabályból jönnek** (moduleUpsell.proratedFirstChargeMonths): megkezdett
   hónapok a fordulónapig, éves plafon 12−ajándékhónap; kupon az első díjra itt érvényesül.
