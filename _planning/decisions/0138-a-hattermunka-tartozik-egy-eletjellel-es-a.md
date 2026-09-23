## ADR-0138 — A háttérmunka tartozik egy ÉLETJELLEL, és a deploy nem gázolhat le futó munkát (2026-09-13)

**Kontextus.** A tulaj 2026-09-11 08:49:59-kor indított egy Balaton-Kelet scrape-et. A konzol
két napig „running"-ot mutatott rá. Mérve: a futás ~3 percig ment, majd 06:52:53 UTC-kor egy
deploy újraindította a `citoviso-console` szolgáltatást — a unit `KillMode=control-group`, a
scrape pedig a konzol GYEREKFOLYAMATA (`scrapeJob.ts` spawn), tehát a systemd a cgrouppal együtt
kivégezte. A sor azért maradt nyitva, mert a `failScrapeRun()` csak a folyamaton BELÜLI hibát
tudja lezárni; kívülről leölve nincs, aki lezárja. A napló ráadásul a konzol memóriájában élt,
így az újraindítással elpárolgott: a rendszernek fizikailag nem volt válasza a „miért?"-re.

**Döntés.**
1. **Aki fut, az jelezzen.** A futás percenként életjelet ad, és beleírja, HOL tart — ugyanabból
   az egy mondatból (`mark()`), amit a naplóba is ír, hogy a túlélő fél ne egy gyengébb állítás
   legyen.
2. **Aki meghal, az mondja ki.** SIGTERM-re a folyamat maga zárja le magát megszakadtként;
   SIGKILL/áramszünet esetén a LISTA LEKÉRÉSE zárja le a néma sorokat — az a képernyő fizeti meg
   az állítását, amelyik állítja. Az életjel NÉLKÜLI, régi futásokat csak a KOR ítéli el (2 óra),
   különben egy élő, régi kódú futást mondanánk halottnak: a javítandó hiba tükörképe.
3. **A „megszakadt" és a „hibára futott" két külön történet** — az operátor következő lépése is
   más —, és a megkülönböztetés ADATBÓL jön (`stats.interrupted`), nem a hibaszöveg illesztéséből.
4. **A deploy nem öl futó munkát.** GATE 4: futó scrape mellett a deploy megáll; egy predikátum,
   két hívási hely (a deploy elején ÉS közvetlenül a restart előtt, mert a kettő között is
   indulhat). Tudatos felülbírálás: `--ignore-scrape`.
5. **Az idő az OLVASÓ óráján áll.** Az éles gép UTC-ben jár, a konzol pedig zóna nélkül
   formázott: az „Indult" oszlop minden során 2 órát csalt. A zóna a nézőé, nem a gépé.

**Nyitott.** A gyökér-törékenység megmarad: amíg a scrape a konzol gyerekfolyamata, minden
konzol-újraindítás megölheti (mérve újra 2026-09-13 19:51-kor, egy párhuzamos szál élesítésekor
— a GATE 4 csak azt védi, aki a deploy-scriptet használja). A valódi javítás külön systemd-egység
(`systemd-run` / template unit), hogy a futás ne a konzol cgroupjában éljen.

**Visszafordíthatóság:** 🔄 egy additív oszlop (`scrape_run.heartbeat_at`, 0066) + kód.
