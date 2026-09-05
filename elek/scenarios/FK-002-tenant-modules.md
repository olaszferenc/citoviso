# FK-002 — Tenant-admin: Modulok-fül (saját modulok, előnézet, kirakat)

cél: A vevő a Modulok fülön látja, mi az övé, mindent meg tud nézni az előnézeten a saját oldalán, és világos, mit tehetne még hozzá (ALL-IN vétel után: mit mutat a kirakat, ha már minden az övé).
felület: tenant-admin
kontraktus: kb/entries/admin-modules/entry.hu.md

## Előkészítés

- [ ] Belépés a kapott jelszóval
  user: anon
  út: /login
  tedd: írd "#username" "${ELEK_TENANT_USER}"
  tedd: írd "#password" "${ELEK_TENANT_PASSWORD}"
  tedd: kattints "Belépés"
  várd: látható "Áttekintés"

- [ ] A Modulok fül megnyílik
  út: /admin?tab=modulok
  várd: látható "Az én moduljaim"

## Saját modulok

- [ ] A megvett modulok kártyái kezelhetők (kikapcsolás felkínálva)
  várd: látható "Kikapcsolom"

- [ ] Minden modul megnézhető a saját oldalon, fizetés előtt
  várd: látható "Megnézem"

- [ ] A kártyák tartalma — ár, címkék, kicsinyített képek
  kézi: a modul-kártyák (ár/„az árban" címke, szakasz-kép, leírás) képről ítélendők

## Kirakat ALL-IN vétel után

- [ ] A bővítés-szekció állapota, amikor már minden modul az övé
  kézi: mit mutat a „Bővítés" rész, ha nincs mit hozzáadni — üresen kong, vagy értelmes állapotot ad? Képről ítélendő

## Összkép

- [ ] A Modulok-fül elrendezése rendezett
  kézi: elrendezés-ítélet a képről
