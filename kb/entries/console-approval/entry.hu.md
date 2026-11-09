---
id: console-approval
title: Jóváhagyás — mehet-e ki a megkeresés, és hol
audience: operator
category: lead-path
anchors: console.approval
updated: 2026-11-08
---

A **„Jóváhagyás”** lapon döntöd el, hogy egy elkészült, átnézett mock megkeresése kimehet-e a
leadnek. A lap két fülből áll: **„Jóváhagyásra vár”** (az új megkeresések) és
**„Messengeren nem nézte meg”** (akiknek Viberen vagy WhatsAppon már kiment, de nem nézték meg).
A fülek fölötti sor mutatja a messenger-út állapotát: bekapcsolva, kikapcsolva, vagy a fék
leállította. A lap a teljes képernyő-szélességet használja, hogy a terv minél nagyobban látsszon.

## „Jóváhagyásra vár”

Bal oldalt a lista, csatornánként csoportosítva: **„Viberen megy”**, **„WhatsAppon megy”**,
**„MMS + SMS megy”**, **„E-mailben megy”** és **„Még ellenőrizzük”**. A csatornát a telefon
dönti el: kiküldéskor üzenet NÉLKÜL megnézi, van-e Vibere vagy WhatsAppja. Előre is megnézi: azt a
leadet, amelyiket itt megnyitod, vagy amelyiknek a lead lapján mobilszámot írsz be és elmentesz,
soron kívül a Vibert 1–2 percen belül (a lap magától frissül, amint megvan az eredmény; ha Vibert nem
talál, a WhatsApp a háttérsorral együtt jön sorra, akár órák múlva); a sor többi számát
a háttérben, éjjel-nappal, másfél percenként egyet — az e-mail-címes leadekkel kezdve. A háttérben csak
a Vibert nézi; a WhatsAppot csak ott, ahol Vibert nem talált, és legfeljebb 5 percenként egy számot,
mert sok idegen szám gyors egymás utáni lekérdezését a WhatsApp tiltással büntette. Amíg egy lead nincs megnézve, a **„Még ellenőrizzük”**
csoportban áll — nyugodtan jóváhagyhatod, kiküldéskor a telefon megnézi, és a jó csatornán küld.
Ha a WhatsApp szünetel (például mert a fiók felülvizsgálat alatt áll), a telefon a WhatsAppot nem
nyitja meg: Viberen megy, különben MMS + SMS-ben, és a követő WhatsApp-üzenet sem megy. Akinek csak
WhatsAppja van (Vibere nincs), az a **„WhatsAppon megy”** csoportban marad, óra-jellel a WhatsApp
jelvényén: a WhatsApp feloldásáig vár, addig nem megy ki, MMS-ként sem.
A lista minden sorában jelvények mutatják, mi van a leadnek: **„E-mail”**, **„Viber”**, **„WhatsApp”**,
**„Mobil”** (a szám még nincs megnézve) vagy **„MMS + SMS”** (se Vibere, se WhatsAppja).
Telefonon a lista felül áll, alatta a kiválasztott lead.

- **Szűrés:** a keresőmezőbe név vagy település írható, alatta csatorna és honlap szerint
  szűrhetsz. A **„Messenger-ellenőrzés”** sorban az **„Ellenőrizve”** csak azokat mutatja, akiknél
  a telefon már megnézte a Vibert, és ha Vibert nem talált (és a WhatsApp nem szünetel), a WhatsAppot is; az **„Ellenőrzésre vár”** csak a még meg nem
  nézetteket. A **„Második terv”** sorban a **„Nincs — egy tervvel megy”** azokat mutatja, akiknek
  nincs második, átnézett terve: ők egy tervvel kapják meg a megkeresést, a levél is egy tervről szól. Minden gombon ott
  a darabszám; a 0 darabos gomb nem nyomható. A **„Szűrők törlése”** mindent visszaállít.
- **A kiválasztott lead fejlécében** a neve és a települése mellett a **„Keresés”** gomb új ablakban
  megnyitja a Google-t a szállás nevével, a településsel és az e-mail-címmel. A név alatt jelvények
  mutatják az elérhetőségeit, benne az adattal: az e-mail-cím, a telefonszám, a Viber (az utolsó
  aktivitással) és a WhatsApp, így egy pillantással ellenőrizheted. Ha a telefon még nem nézte meg
  a számot, **„Ellenőrzés vár”** áll; ha se Vibere, se WhatsAppja nincs, **„MMS + SMS”**. Alattuk a
  négy lépcső áll: 1. Viber (ha 30 napon belül aktív),
  2. WhatsApp, 3. Viber régi aktivitással, 4. MMS + SMS együtt. A kiemelt lépcső alatt
  **„EZ MEGY”** áll, alatta egy mondat, hogy miért. Messengeren a terv képe és a szöveg a
  linkkel EGY üzenetben megy, SMS nélkül. Ha a messenger-út ki van kapcsolva vagy a fék
  leállította, MMS + SMS megy, együtt — SMS soha nem megy egyedül.
- **A megkeresés szövege** (alapból összecsukva, a címére kattintva nyílik le): a levél, és messenger-csatornánál a kép alatti
  szöveg is. Ez nem szerkeszthető; a lenti SMS átírásával változik. Alatta a kísérő SMS, ami
  akkor megy, ha a küldés MMS + SMS-re esik vissza. Ha átírod, nyomd meg a **„Mentés”** gombot,
  mielőtt a **„Mehet”**-re koppintasz — a „Mehet” a szöveget nem menti el. Mentés után a te
  szöveged megy a messengeren is. Üresen hagyott mező = a gépi szöveg megy; a
  **„Vissza a gépi szövegre”** gomb visszaállítja. Ha a mentés nem sikerül, piros
  **„Nem mentettem”** sáv sorolja fel az okokat.
- **„Mehet”** — a lead visszakerül a kiküldési sorba, és hétköznap 9 és 16 óra között kimegy.
  **„Nem mehet ki”** — a megkeresés törlődik. Mindkettő után a következő lead nyílik meg.
- Alul a terv teljes oldala: **„1. terv”** / **„2. terv”**, és **„Asztali”** / **„Mobil”**
  szélességben.

## „Messengeren nem nézte meg”

Ide az kerül, akinek legalább 3 napja kiment a megkeresés Viberen vagy WhatsAppon, és nem
nézte meg. Ha Viberen nem nézte meg, és van WhatsAppja (vagy a telefon még nem tudja), a gép
előbb magától elküldi ugyanazt a képet és szöveget WhatsAppon is (a küldési ablakban, gomb
nélkül), és csak ha azt sem nézi meg újabb 3 nap alatt, akkor kerül ide. Ha a WhatsApp-küldés
nem sikerül (például mégsincs WhatsAppja), a lead azonnal ide kerül. Aki válaszolt, elutasított vagy leiratkozott, ide soha nem
kerül, és második üzenetet sem kap. WhatsAppon az is
„nem nézte meg”-nek látszik, aki kikapcsolta az olvasási visszaigazolást.

- **Szűrés:** csatorna, állapot (kézbesítve / csak elküldve), Viberen aktív az elmúlt 7
  napban, és mióta (3 / 4–6 / 7+ napja), darabszámmal és **„Szűrők törlése”** gombbal.
- **A kiválasztott leadnél** idővonal: mikor ment el, mikor kézbesült, hány napja nem nézte
  meg, és Viberen mikor volt utoljára aktív. Mellette a kiküldött kép és szöveg.
- **„Mehet MMS + SMS-ben is”** — ugyanaz a kép MMS-ben, utána a kísérő SMS ugyanazzal a
  linkkel, együtt, a következő küldési ablakban. A messenger-üzenet marad, újat ott nem
  küldünk. **„Nem kell”** — a lead lekerül a listáról, és többet nem kap üzenetet ezen az úton.
