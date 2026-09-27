# Üzenetek fül — a foglalási kérés döntés-linkjei (jóváhagyott terv: C)

**Jóváhagyva:** 2026-09-27, tulajdonosi döntés (§2b terv-kapu), a három vázlatból (A gombsor ·
B ikonos link · C Foglalások-fül) a **C**. A kiváltó ok a tulaj szavával: „Dev-en még mindig
linkként jelenik meg az emailes jóváhagyás vagy elutasítás. Nem lehetne ezt ikonként?”
**Vázlat:** `mail-links.html` (méret-váltóval). **Megvalósítás:** `src/server/adminViews.ts`
(`messageBodyHtml`), `public/assets/ui/citui-admin.css` (`.adm-msg__acts`, `.adm-msg__quick`).

Háttér: a tulaj-levél HTML-változata már a jóváhagyott `../booking-email/` (Tulaj B) szerkezetű —
fő gomb a Foglalások fülre, gyors döntés másodlagos linkként. Az Üzenetek fül viszont a levél
SZÖVEGES részét tárolja, így ott két nyers URL állt. Ez a terv ugyanazt a szerkezetet viszi át
az Üzenetek fülre.

## Mit KÖT ez a terv (nem stílus-javaslat)

1. **Nyers döntés-URL nem látszik.** A levéltörzs „<felirat>: <url>” sorai, ahol az URL egy
   `/foglalas/<token>/elfogadom|elutasitom|ajanlat` cím, kikerülnek a szöveg-folyamból.
2. **Fő gomb:** **„Foglalások megnyitása”** → `/admin?tab=foglalasok` (ott a naptár és a többi
   kérés). Mobilon teljes szélességű.
3. **Gyors döntés:** **„Gyors döntés innen is:”** felirat után ikonos linkek (pipa = elfogadás,
   X = elutasítás, nyíl = ajánlatküldés); a felirat a levél saját (a szállás nyelvén írt) szövege.
4. **Az azonnal döntő link ELŐBB RÁKÉRDEZ.** Az elfogadás/elutasítás GET-re azonnal dönt és a
   vendégnek levelet küld, ezért kattintásra megerősítő doboz nyílik, benne **„Igen, elfogadom”**
   ill. **„Igen, elutasítom”** gombbal; a döntés új lapon nyílik. A vázlat modális ablaka helyett
   a megvalósítás a sor alatt nyíló dobozt használ (JS nélkül működik; a natív `confirm()` ezen a
   felületen tiltott) — a kötés a kérdés megléte, nem a doboz helye.
   Az ajánlatküldés linkje nem kérdez: az ajánlat-oldalt nyitja meg, nem dönt.
5. **A többi szöveg változatlan**, a döntés utáni mondat (pl. „A vendég csak azután kap…”)
   halványítva a linkek alatt marad. Minden más URL a levéltörzsben továbbra is sima link.
