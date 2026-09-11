// OPERÁTORI NYITÓKÉP-VÁLASZTÁS (jóváhagyott terv: assets/design-refs/console/hero-override/).
//
// A motor választja a nyitóképet (heroPick.ts). A gép ítélete JAVASLAT — a döntés az emberé:
// a kurátor néha többet tud a leadről, mint amennyi a képen látszik.
//
// Két dolgot csinál ez a modul, és mind a kettő KELL:
//  ① Megjegyzi a választást a LEADHEZ kötve (0061), tehát túléli az újragenerálást. Ha az
//    artefaktumon ülne, minden új sablon/újraírt szöveg eldobná, és a kurátor újra meg újra
//    ugyanazt a kattintást csinálná.
//  ② ÚJRARENDERELI a már meglévő mockot. A mentés önmagában NEM publikálás: a mock statikus
//    pillanatkép, a DB-írástól a lead pontosan ugyanazt látná, mint eddig. A felület ezt ki
//    is mondja ("Újrarenderelem a mockot az új nyitóképpel…"), mert a néma írás hazugság.
//
// ⛔ AI-hívás NINCS benne. A szöveg, a paletta, a sablon, a szekció-sorrend érintetlen — csak
// a fotó-sorrend változik, tehát ez ingyen van és nem kockáztat új, nem-verifikált állítást.

import { writeFile } from "node:fs/promises";
import { db } from "../db/client.js";
import type { Recipe, SiteData } from "../engine/recipe.js";
import { renderSite } from "../engine/render.js";
import { getDisabledModules, sampleDenyKeys } from "../moduleSales.js";
import { injectRuntime } from "./runtime.js";
import { checkDesign } from "./designCheck.js";
import {
  dropNeverShown,
  judgeHero,
  orderPhotosForHero,
  photoUrlKey,
  readCachedScores,
  scoreHeroCandidates,
} from "./heroPick.js";

/** A lead operátori nyitókép-választása, ha van. */
export async function getHeroPin(leadId: string): Promise<{ url: string; actor: string } | null> {
  const row = await db
    .selectFrom("lead_hero_override")
    .select(["url", "actor"])
    .where("lead_id", "=", leadId)
    .executeTakeFirst();
  return row ?? null;
}

export async function setHeroPin(leadId: string, url: string, actor: string): Promise<void> {
  await db
    .insertInto("lead_hero_override")
    .values({ lead_id: leadId, url, actor })
    .onConflict((oc) => oc.column("lead_id").doUpdateSet({ url, actor, created_at: new Date() }))
    .execute();
}

export async function clearHeroPin(leadId: string): Promise<void> {
  await db.deleteFrom("lead_hero_override").where("lead_id", "=", leadId).execute();
}

/**
 * A kiválasztott képet előre emeli, a többi sorrendjét változatlanul hagyja.
 *
 * Az egyeztetés query-string NÉLKÜLI kulcson megy: a Places-fotók URL-je aláírt és lejár,
 * tehát a nyers string-egyezés egy újragenerálás után elveszítené a választást — pontosan
 * azt, aminek túl kellene élnie.
 */
export function applyHeroPin<T extends { url: string }>(photos: readonly T[], pinnedUrl: string | null): T[] {
  if (!pinnedUrl) return [...photos];
  const key = photoUrlKey(pinnedUrl);
  const at = photos.findIndex((p) => photoUrlKey(p.url) === key);
  if (at <= 0) return [...photos]; // nincs a készletben, vagy már ő az első
  return [photos[at]!, ...photos.slice(0, at), ...photos.slice(at + 1)];
}

export interface RepointResult {
  readonly ok: boolean;
  readonly message: string;
}

/**
 * Átteszi a mock nyitóképét a megadott fotóra (vagy vissza a gépi választásra), és
 * ÚJRARENDERELI a mock HTML-t. A recept, a szöveg és a paletta érintetlen.
 */
export async function repointHero(
  artifactId: string,
  url: string | null,
  actor: string,
): Promise<RepointResult> {
  const row = await db
    .selectFrom("mock_artifact")
    .select(["id", "lead_id", "path", "inputs", "status"])
    .where("id", "=", artifactId)
    .executeTakeFirst();
  if (!row) return { ok: false, message: "Nincs ilyen mock." };
  if (!row.path) return { ok: false, message: "Ehhez a mockhoz nincs fájl — generálj újat." };

  // §I: amit MEGAJÁNLOTTUNK, azt kapja. Egy élő prospect-link mögötti mock be van fagyasztva
  // — a lap átrendezése a lead alatt pontosan az a csali-csere, amit az invariáns tilt.
  const offered = await db
    .selectFrom("prospect")
    .select("id")
    .where("mock_artifact_id", "=", artifactId)
    .executeTakeFirst();
  if (offered) {
    return {
      ok: false,
      message:
        "Ez a mock már ki lett ajánlva a leadnek — a nyitóképét nem cseréljük ki alatta. " +
        "A választást elmentettük: a következő generálás már ezzel készül.",
    };
  }

  const inputs = (row.inputs ?? {}) as Record<string, unknown>;
  const recipe = inputs.recipe as Recipe | undefined;
  const siteData = inputs.siteData as SiteData | undefined;
  if (!recipe || !siteData) {
    return { ok: false, message: "Ez a mock régi formátumú (nincs eltárolt recept) — generálj újat." };
  }

  // A pillanatkép fotó-listája régebbi lehet a szűrésnél: ami `ad_banner`, az itt is kiesik,
  // különben az operátor egy újrarendezéssel visszaírná a bannert a lapra (0060/§B.17).
  const storedPhotos = siteData.photos ?? [];
  const photos = dropNeverShown(storedPhotos, await readCachedScores(storedPhotos.map((p) => p.url))).kept;
  if (url && !photos.some((p) => photoUrlKey(p.url) === photoUrlKey(url))) {
    return { ok: false, message: "Ez a kép nincs benne ebben a mockban — generálj újat vele." };
  }

  // A cache-elt ítéletek (ingyen) — kellenek az új hero verdiktjéhez, ÉS a visszaálláshoz.
  const scores = await scoreHeroCandidates(photos, siteData.name ?? "").catch(() => new Map());
  // ⚠️ MÉRT HIBA (2026-09-09, az őr fogta meg): a visszavonás nem elég a jelölés törléséhez.
  // Az előző választás a MENTETT fotó-sorrendet is átrendezte (a mock pillanatkép, a
  // sorrend maga az adat), így a `null` "hagyd, ahogy van" lett volna — és a kézzel
  // felhozott kép ott maradt a lap tetején, miközben a felület azt állította, hogy
  // visszaállt a gépi választás. Visszaálláskor tehát ÚJRA a motor szabálya rendez.
  const nextPhotos = url
    ? applyHeroPin(photos, url)
    : orderPhotosForHero(photos, scores);
  const nextData: SiteData = { ...siteData, photos: nextPhotos };
  const html = await injectRuntime(
    renderSite(recipe, nextData, { sampleDeny: sampleDenyKeys(await getDisabledModules()) }),
    nextData.lang,
  );
  await writeFile(row.path, html, "utf8");

  // Az ÚJ nyitókép ítélete kerül a panelre. Ha nincs verdikt (mert az operátor olyan
  // képet választott, amit nem néztünk meg), a judgeHero "error"-t ad: a mi hiányunk
  // nem lelet a fotóról.
  const verdict = judgeHero(nextPhotos[0]?.url, scores);
  const design = checkDesign(html);

  await db
    .updateTable("mock_artifact")
    .set({
      inputs: {
        ...inputs,
        siteData: nextData as unknown as Record<string, unknown>,
        designVerdict: design.verdict,
        heroVerdict: verdict.verdict,
        heroReason: verdict.reason,
        heroSubject: verdict.subject,
        heroScore: verdict.score,
        // Audit: a lapon a "miért ez a kép?" kérdésre egy NÉV álljon, ne egy anonim sor.
        heroPinnedBy: url ? actor : null,
      } as never,
    })
    .where("id", "=", artifactId)
    .execute();

  return {
    ok: true,
    message: url
      ? "Kész — a mock már az új nyitóképpel van renderelve."
      : "Kész — visszaállt a gépi választás, a mock újrarenderelve.",
  };
}
