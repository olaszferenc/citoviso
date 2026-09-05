# FK-005a — Vásárlás a levél linkjéről: konfigurátor → mock-fizetés → aktiválás

cél: A megkeresés linkjéről induló önkiszolgáló vásárlás végigmegy — konfigurátor, számlázási adatok, kötelező hozzájárulások, mock-fizetőoldal —, a sikeres fizetés aktivál, és a vevő (elek@citoviso.com) belépő-adatokat kap.
felület: konzol
kontraktus: kb/entries/console-lead/entry.hu.md

## Előkészítés

- [ ] A követett link megnyílik, a konfigurátor-indító él
  user: anon
  út: ${ELEK_PROSPECT_PATH}
  várd: látható "ELEK-TESZT Vendégház"
  várd: darab ".cit-cfg-launch" >= 1

## Konfigurátor

- [ ] A konfigurátor megnyílik és a megrendelés-út elindul (döntés-segítő ajánlat-kártyán át is)
  tedd?: kattints ".cit-cfg-escgo"
  tedd?: kattints ".cit-cfg-launch"
  tedd: kattints ".cit-cfg-next"
  várd: darab ".cit-cfg-rights" >= 1

- [ ] A fotó-jognyilatkozat kipipálása után a számlázási lépés elérhető
  tedd: kattints ".cit-cfg-rights"
  tedd: kattints ".cit-cfg-submit"
  várd: darab ".cit-cfg-step3" >= 1

## Számlázási adatok és hozzájárulások

- [ ] A vevő-adatok kitölthetők (magánszemély, vevő-email: elek@citoviso.com)
  tedd: írd "[data-f='buyer_name']" "Elek Teszt"
  tedd: írd "[data-f='buyer_zip']" "8630"
  tedd: írd "[data-f='buyer_city']" "Balatonboglár"
  tedd: írd "[data-f='buyer_address']" "Erzsébet utca 23."
  tedd: írd "[data-f='buyer_email']" "elek@citoviso.com"
  adat: ELEK-TESZT vevő-adatok (magánszemély)

- [ ] A kötelező hozzájárulások bejelölhetők, a fizetés indítható
  tedd: kattints "[data-c='withdrawal'] input"
  tedd: kattints ".cit-cfg-terms"
  tedd: kattints ".cit-cfg-recurring"
  tedd: kattints ".cit-cfg-pay"
  tedd: várj "Mock fizetőoldal" 30
  várd: látható "Fizetek ▸"
  adat: ELEK-TESZT megrendelés + fizetési kérés (mock)

## Sikeres fizetés és aktiválás

- [ ] A fizetés sikeres, az aktiválás megtörténik, a belépő-adatok látszanak
  tedd: kattints "Fizetek ▸"
  tedd: várj "Sikeres fizetés" 60
  várd: látható "Sikeres fizetés"
  adat: ELEK-TESZT tenant + élő oldal + belépő (a levél elek@citoviso.com-ra megy)

- [ ] Az aktiválás-összegzés tartalma — a vevő innen indul tovább
  kézi: a képről ítélendő, mit kap a vevő (oldal-link, felhasználónév, belépés-útmutató, összeg-visszaigazolás)

## Összkép

- [ ] A fizetőoldal és az eredmény-oldal elrendezése rendezett
  kézi: elrendezés-ítélet a képről
