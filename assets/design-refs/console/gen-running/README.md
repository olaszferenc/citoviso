# Futó háttérmunka a lead-lap tetején — jóváhagyott terv („A" változat, 2026-09-11)

Tulajdonosi jóváhagyás: 2026-09-11 („A — élő sáv a fejléc alatt"), miután két változatot
látott mobil és asztali képen, kattintható HTML-lel (`plan.html`: „⚡ Hiba szimulálása",
„⟲ Alaphelyzet", méret-váltó — mind működik). Ez a terv a megvalósítás **KONTRAKTUSA**:
elvárt viselkedés, nem stílus-javaslat. Referencia: `plan.html`, `A-B-mobil.png`,
`A-B-asztali.png` (a képeken mindkét változat szerepel; a jóváhagyott a FELSŐ).

## Miért van

⛔ **Mért hiba (Elek FK-003b ②, 2026-09-11):** a percekig futó mock-generálás NÉMA volt ott,
ahol a kurátor néz. A fejléc végig „mock: approved"-ot mutatott — egy két perce meghaladott
állapotot —, a „generálás folyamatban…" chip pedig a 3014 px-es lap **y≈2560**-nál, az alsó
ötödben bujkált. Eltelt idő sehol: nem lehetett tudni, most indult-e vagy beragadt. Bukáskor
pedig a képernyő hallgatott, az ok csak a szerver-logba került.

## Mit KÖT a terv

1. **A jelzés a lap TETEJÉN van** — teljes szélességű csík közvetlenül a navy azonosító-sáv
   alatt, nem a panelek között valahol lent. A hely a lényeg, nem a szín.
2. **Eltelt idő, ami KETYEG.** `m:ss`, másodpercenként frissül a böngészőben (a szerver csak
   az indulás pillanatát küldi le). Egy befagyott „0:00" ugyanolyan néma, mint a semmi.
3. **A fejléc nem mondhat „approved"-ot, amíg fut.** A mock-pirula átvált
   „mock: generálás fut"-ra az eltelt idővel.
4. **A futás ott is látszik, ahol a kurátor éppen NEM áll:** a „Mock és generálás" fül
   lüktető pöttyöt kap.
5. **A bukást UGYANEZ a sáv mondja el**, pirosan, az OKKAL — nem egy másik helyen, kisebb
   betűvel, és nem csak a logban. A háttérmunka három dolgot tartozik: hogy elindult, hogy
   fut, és hogy miért bukott.
6. **Mobilon a haladó csík saját sorba kerül**; a szöveg és az eltelt idő előrébb való.
7. **`prefers-reduced-motion` esetén nincs animáció** — a jelzés attól még ott van.

## Amit a terv NEM köt

A pontos árnyalatok és térközök: minden a `--citui-*` dizájn-magból jön, a konzol meglévő
komponenseinek (`.pill`, `.con-lhead__pills`) mintáját követve.

## Csapda, amit a végigkattintás fogott meg

A `.con-runbar { display: flex }` **felülírja** a `[hidden]` nulla-specificitású
`display:none`-ját, tehát a „rejtett" sáv LÁTSZOTT. A CSS-ben ezért külön szerepel
`.con-runbar[hidden] { display: none }`. Ugyanez a csapda 2026-09-05-én már ütött egyszer:
képen nem látszik, csak végigkattintva.
