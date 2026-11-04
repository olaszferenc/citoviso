// Reels maker CLI — a lodging's photos → vertical 1080×1920 MP4 (RESEARCH-2026-11-facebook-modul §3.2).
//
//   npx tsx scripts/reels-make.mts --out reel.mp4 [--seconds 20] \
//     [--title "Szöveg az elején"] [--cta "Szöveg a végén"] \
//     [--music zene.mp3 --music-license LICENSE.txt] p1.jpg p2.jpg … (2–10 fotó)
//
// Local ffmpeg, $0. Music is refused without a license file (brief: only provably licensed audio).

import { makeReel, clampSeconds, type Caption } from "../src/social/reels.js";

function main(): Promise<void> {
  const argv = process.argv.slice(2);
  const photos: string[] = [];
  const opt = new Map<string, string>();
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]!;
    if (a.startsWith("--")) {
      const v = argv[i + 1];
      if (v === undefined) throw new Error(`hiányzó érték: ${a}`);
      opt.set(a.slice(2), v);
      i++;
    } else photos.push(a);
  }
  const out = opt.get("out");
  if (!out || photos.length < 2 || photos.length > 10) {
    console.error("Használat: reels-make.mts --out <mp4> [--seconds N] [--title …] [--cta …] [--music f --music-license f] <2–10 fotó>");
    process.exit(2);
  }
  const seconds = clampSeconds(opt.has("seconds") ? Number(opt.get("seconds")) : undefined, photos.length);
  const captions: Caption[] = [];
  const title = opt.get("title");
  const cta = opt.get("cta");
  if (title) captions.push({ text: title, from: 0.3, to: Math.min(5, seconds / 3), at: "top" });
  if (cta) captions.push({ text: cta, from: Math.max(0, seconds - 5), to: seconds, at: "bottom" });
  const musicFile = opt.get("music");
  const licenseFile = opt.get("music-license");
  if (musicFile && !licenseFile) throw new Error("--music csak --music-license mellett adható meg");
  return makeReel({
    photos,
    out,
    seconds,
    captions,
    ...(musicFile && licenseFile ? { music: { file: musicFile, licenseFile } } : {}),
  }).then((r) => console.log(`✅ ${out} — ${r.seconds} mp, ${photos.length} fotó, 1080×1920`));
}

main().catch((e: unknown) => {
  console.error(`❌ ${e instanceof Error ? e.message : String(e)}`);
  process.exit(1);
});
