# Facebook-pilot — Advanced Access / App Review anyag (VÁZLAT, 2026-11-04)

> Státusz: vázlat, NINCS beadva. Kell-e egyáltalán? A pilothoz (a Citoviso SAJÁT oldala, a Citoviso
> portfóliójának rendszerfelhasználójával) a Meta-dokumentáció alapján **Standard Access elég**: „Standard
> Access … can only be requested from app users who have a role on the requesting app” és Advanced Access csak
> „an app user without a role on the app or a claiming Business” esetén kell
> (developers.facebook.com/docs/graph-api/overview/access-levels/, …/docs/pages-api/overview). Ugyanez a Pages
> overview máshol azt írja, hogy élő appnál minden oldal-jogosultság App Review-köteles — **ellentmondás, a pilot
> élőben dönti el** (`scripts/fb-pilot.mts check` + egy poszt). Advanced Access akkor kell biztosan, amikor
> **más cég (a szállásadó) oldalát** kezeljük partner-hozzáféréssel — ez a tenant-modul.

## Mi kell a beadáshoz (Meta submission guide, developers.facebook.com/docs/app-review/submission-guide)

| Elem | Honnan | Állapot |
|---|---|---|
| Üzleti ellenőrzés (Biztonsági központ → Ellenőrzés indítása) | cégadatok + `https://citoviso.com` + domain-ellenőrzés (DNS TXT) | a pilotban indítjuk |
| App-ikon 1024×1024 | `public/assets/ui/` logó | elkészítendő |
| Adatvédelmi tájékoztató URL | `https://citoviso.com/adatvedelem` | él (200, 2026-11-04) |
| Kategória, kapcsolattartó e-mail | Citoviso | — |
| App célja | „Clients” (a szállásadók oldalait kezeljük) | — |
| Jogosultságonként szöveg + képernyővideó | lent | vázlat |
| Teszt-hozzáférés a bírálónak | teszt-oldal + teszt tenant-admin | elkészítendő |

## Kért jogosultságok és indoklás (angolul, ahogy beadjuk)

**pages_manage_posts** — Citoviso builds and runs websites for small lodging businesses (guesthouses,
apartments) in Hungary. As part of an optional paid module, the lodging owner gives the Citoviso business
portfolio partner access to their Facebook Page. Our server then publishes, at most three times a week,
posts prepared from the owner's own data: a short Reel made from the property's own photos, a post about
free dates taken from the property's booking calendar, and a post listing local events the owner selected in
our admin. The owner sees every scheduled post in our admin and can stop or delete it. We never post to
groups, never comment, never message users.

**pages_read_engagement** — Used to read back the posts we published (id, permalink, status) so the owner
sees in our admin whether a post went live, and to show a monthly one-line report (reach of our posts).

**pages_show_list** — Used once when the owner connects: to list the Pages our business portfolio has been
given access to, so the right Page is linked to the right lodging.

**business_management** — Required by Meta when a business system user makes the API calls; we use it only
to read which Pages are assigned to our system user.

**publish_video** — Required for uploading the weekly Reel (`/{page-id}/video_reels`).

## Képernyővideó-forgatókönyv (Meta-követelmény: ≥1080p, angol UI, felirat, egér, hang nélkül, ≤1440 px széles)

1. (0:00) Felirat: „A lodging owner connects their Facebook Page to Citoviso.” — Meta Business Suite, a
   szállásadó portfóliója → Settings → Partners → Add → *Give a partner access to your assets* → a Citoviso
   portfólió-azonosítója → a Page → *Content* (partial access) → *Assign assets*.
2. (0:40) Citoviso tenant-admin (angol nyelv) → Facebook fül: a csatolt oldal neve megjelenik
   (`pages_show_list`).
3. (1:00) A heti terv: 3 poszt előnézete (Reels, szabad időpont, program), mindegyik mellett „Stop” gomb.
4. (1:30) „Publish now” a teszt-posztra → a Facebook-oldalon megjelenik a poszt (`pages_manage_posts`),
   majd a Reel (`publish_video`).
5. (2:10) Vissza az adminba: a poszt állapota „Live” + link (`pages_read_engagement`).
6. (2:30) A tulaj „Stop”-ot nyom → a következő poszt nem megy ki; „Delete” → a poszt eltűnik az oldalról.

⚠️ A 2–6. lépés felülete még NINCS kész (tenant-admin Facebook fül) — a beadás a tenant-modul felület-munkája
(§2b terv-kapu) után jöhet. A pilot ezt nem igényli, ha a Standard Access igazolódik.
