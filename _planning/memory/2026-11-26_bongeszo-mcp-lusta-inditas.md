# 2026-11-26 — Böngésző- és térkép-MCP csak ott fut, ahol használják (lusta indító)

Session `cit2f755e49`, brief `~/rc-briefs/cit-bongeszo-mcp-csak-agenseknek-20261126.md` (Ferenc döntése: „1”).

## Mérés előtte (2026-11-26 16:53, `python3 /home/mineral/.claude/rc-measure/mcp-servers.py`)
- citoviso uid: **45 `chrome-devtools-mcp` szerver, 9216 MB**, ebből 1-ben fut böngésző (760 MB, 5 renderer), 44 üresjáratban (8456 MB); 22 session, sessionönként max. 3.
- Plusz 15 `openstreetmap-mcp-server` (node rész ~290 MB RSS).
- Forrás: a `~/.claude.json` `projects["/home/citoviso/citoviso"].mcpServers` (`openstreetmap`, `chrome-devtools`, `chrome`). A `~/.claude.json`-ban csak két projekt-bejegyzés van: a munkafás sessionök (`~/wt/cit…`, `~/wt/poe`…) a fő repó bejegyzését kapják, mert a CLI a git-munkafát a fő repóhoz rendeli. Ezért munkafánkénti `~/.claude.json`-bejegyzés nem lehetséges.
- A `chrome-devtools` `--workspace /home/citoviso/wt/cit98ddcdbb` egy rég törölt fára mutatott (ez a fájlrendszer-gyökér: ide menthetett képernyőképet a szerver).

## Ki hívja ténylegesen (átiratok, utolsó 15 nap, alágensekkel együtt)
| session | chrome (Neo-profil) | chrome-devtools | openstreetmap |
|---|---|---|---|
| Neo `274260e0` (~/wt/neo, utolsó 11-17) | 9959 | 658 | 771 |
| CIT ➕ hero `e2d1c9b4` | | 318 | |
| Vera `14813de9` | | | 278 |
| Poe `a85fdc76` | | | 267 |
| CIT ➕ Telefon `27baf523` | | 204 | |
| CIT ➕ email Spam `73105eb0` | 97 | 80 | |
| Poe2 `612e3b37` | | | 75 |
| CIT ➕ szétesett a rendszer `791d44a9` | | 51 | |
| CIT ➕ Portál feltöltés `5926a648` | 30 | 35 | |
| SUB Barion euró-tárca `234c10a1` | | 39 | |
| SUB Kép nélküli hero `561ec018` | | 13 | |
| SUB Ország-réteg pénzút `8e9c29ff` | | 12 | |
| 🟨3 Nemzetközi Terjeszkedés `9b4690e3` | | | 3 |
- Következtetés: a „kell” lista NEM csak az ágensek. 8 eseti fejlesztő-session is használt `chrome-devtools`-t, és előre nem tudható, melyik session fog. Egy fix lista ezeket eltörné, és a futó session nem kaphat utólag MCP-szervert.
- Poe saját profilos `poe-chrome`-ja a `~/wt/poe/.mcp.json`-ban él (ezt a mérés nem számolta), és Poe a `chrome`/`chrome-devtools`-t tiltja (`permissions.deny`). Ettől a két szerver nála is elindult.

## Megoldás: `scripts/mcp-lazy.py` (lusta indító)
- A `~/.claude.json` mindhárom szervere a proxyn át indul: `python3 /home/citoviso/citoviso/scripts/mcp-lazy.py --name <név> -- npx -y …`. A proxy az `initialize`, a `tools/list` és a `ping` kérésre gyorsítótárból válaszol (`~/.cache/citoviso-mcp-lazy/<név>-<hash>.json`). A valódi szervert csak az első valódi kérésnél (`tools/call` stb.) indítja el, akkor újrajátssza neki a kliens kézfogását, és onnantól átlátszó cső.
- Gyorsítótár nélkül (az első futáskor, vagy ha megváltozik a parancs) azonnal indul a valódi szerver, és a kliens saját `tools/list` válaszát menti el. A proxy így soha nem ad olyan eszközlistát, amit a valódi szervertől nem látott.
- A `{cwd}` a session munkakönyvtárára cserélődik: a `chrome-devtools --workspace {cwd}` így a session saját fájába menthet, nem egy törölt fába.
- Túléli a watchdog RESUME / HARD-RESTART-ját, mert a közös konfigban él, nem egy indító-kapcsolóban.
- Önteszt: `python3 scripts/mcp-lazy.py --selftest`. Valódi CLI-vel is igazolva (2.1.332, chrome-devtools-mcp 1.14.0): hívás nélküli sessionben a proxy alatt nincs `npm exec`; `list_pages` hívásnál a szerver elindul és helyesen válaszol; kilépés után nem marad árva folyamat.
- ⛔ A valódi szervert ezután sem öljük le (a CLI nem indítja újra). Ha a valódi szerver kilép, a proxy is kilép, ugyanúgy, mint eddig.

## Mi érvényesül csak újraindulás után
- A konfigot a CLI a session indulásakor olvassa. A már futó sessionökben a régi, azonnal indított szerverek futnak tovább, amíg a watchdog újra nem indítja őket. Kézzel senkit nem indítottunk újra.
