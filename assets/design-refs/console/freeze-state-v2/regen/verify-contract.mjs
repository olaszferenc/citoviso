import { chromium } from "playwright-core";
import { pathToFileURL } from "node:url";
const F = "assets/design-refs/console/freeze-state-v2/freeze-state-B.html";
const b = await chromium.launch(); let bad = 0;
for (const [w, size] of [[390,"mobil"],[1280,"asztali"]]) {
  const p = await b.newPage({ viewport:{width:w,height:844} });
  const errs=[]; p.on("pageerror",e=>errs.push(String(e))); p.on("dialog",d=>d.accept());
  await p.goto(pathToFileURL(F).href,{waitUntil:"networkidle"});
  if (size==="asztali") await p.click('.mk-sw button[data-size="asztali"]');
  const log=[];
  for (const t of ["modulok","uzenetek","attekintes"]) {
    await p.click(`.mk-tabs button[data-tab="${t}"]`);
    const ok = await p.evaluate(`document.querySelector('.mk-pane[data-pane="${t}"]').hidden===false`);
    log.push(`fül:${t}=${ok?"ok":"BUKÁS"}`); if(!ok) bad++;
  }
  const cols = await p.evaluate(`getComputedStyle(document.querySelector(".fz-hero__grid")).gridTemplateColumns`);
  log.push(`hero-rács=${String(cols).slice(0,22)}`);
  await p.click('.mk-tabs button[data-tab="modulok"]');
  await p.locator('.mk-pane:not([hidden]) [data-retry]').first().click();
  const msg = await p.locator('.mk-pane:not([hidden]) [data-retrymsg]').first().innerText();
  log.push(`újrapróba="${msg.slice(0,26)}…"`); if(!msg.trim()) bad++;
  await p.locator('.mk-pane:not([hidden]) [data-pay]').first().click();
  await p.waitForTimeout(150);
  const paid = await p.locator(".adm-paid").count();
  log.push(`fizetés→visszakapcsolt=${paid>0?"ok":"BUKÁS"}`); if(!paid) bad++;
  log.push(`JS-hiba=${errs.length}`); if(errs.length) bad++;
  console.log(`  @${w} (${size}): ${log.join(" · ")}`);
  await p.close();
}
await b.close();
console.log(bad ? `⛔ ${bad} bukás` : "✅ a BEFAGYASZTOTT terv élő és kattintható — nem képernyőkép extra lépésekkel");
process.exit(bad?1:0);
