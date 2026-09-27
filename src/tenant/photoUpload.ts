// Owner photo uploads — ONE size rule, two halves.
//
// A phone photo is 3–12 MB at 4000+ px; the public page never shows more than a
// 2560 px wide hero. So the picture is converted twice over:
//  · in the BROWSER before sending (SHRINK_JS): downscaled and re-encoded as JPEG —
//    a fraction of the bytes over mobile data, and the 6 MB cap stops refusing
//    ordinary phone photos (it now applies to what is SENT, not to the original);
//    the canvas output carries no EXIF, so the owner's GPS position stays at home;
//  · on the SERVER (normalizeUpload) for whatever still arrives raw (no JS, a browser
//    that could not decode it): EXIF orientation baked in, the same edge cap,
//    metadata stripped.
// Guard: scripts/photo-normalize-check.mts.

import sharp from "sharp";

/** The longest edge a stored upload keeps — the widest hero the templates render. */
export const UPLOAD_MAX_EDGE = 2560;
/** Below this and within the edge cap, the browser sends the original untouched. */
const SHRINK_ABOVE_BYTES = 1_500_000;
const JPEG_QUALITY = 85;

/**
 * Browser half, spliced into the admin's inline scripts. Defines
 * `citShrink(file) → Promise<Blob>`: the converted JPEG, or the ORIGINAL file when
 * it is already small, the browser cannot decode it, or conversion would not shrink
 * it. Never rejects — a failed conversion falls back to sending the original, which
 * the server then normalizes.
 */
export const SHRINK_JS =
  `function citShrink(f){if(!window.createImageBitmap||!/^image\\/(jpeg|png|webp)$/.test(f.type))return Promise.resolve(f);` +
  `return createImageBitmap(f,{imageOrientation:'from-image'}).then(function(b){` +
  `var s=Math.min(1,${UPLOAD_MAX_EDGE}/Math.max(b.width,b.height));` +
  `if(s===1&&f.size<=${SHRINK_ABOVE_BYTES}){if(b.close)b.close();return f}` +
  `var c=document.createElement('canvas');c.width=Math.round(b.width*s);c.height=Math.round(b.height*s);` +
  // JPEG has no alpha: a transparent PNG would turn black without a white ground.
  `var g=c.getContext('2d');g.fillStyle='#fff';g.fillRect(0,0,c.width,c.height);g.drawImage(b,0,0,c.width,c.height);if(b.close)b.close();` +
  `return new Promise(function(res){c.toBlob(function(o){res(o&&o.size<f.size?o:f)},'image/jpeg',${JPEG_QUALITY / 100})})` +
  `}).catch(function(){return f})}`;

export interface NormalizedUpload {
  data: Buffer;
  ext: "jpg" | "png" | "webp";
}

/**
 * Server half. Throws when the bytes are not a decodable image (the caller refuses
 * the file). A JPEG that is already clean — within the edge cap, upright, no
 * metadata — is kept byte for byte, so the browser's conversion is not re-encoded
 * a second time.
 */
export async function normalizeUpload(input: Buffer): Promise<NormalizedUpload> {
  const meta = await sharp(input, { failOn: "error" }).metadata();
  const w = meta.width ?? 0;
  const h = meta.height ?? 0;
  if (!w || !h) throw new Error("not an image");
  const upright = !meta.orientation || meta.orientation === 1;
  const clean = !meta.exif && !meta.icc && !meta.xmp && !meta.iptc;
  if (meta.format === "jpeg" && upright && clean && Math.max(w, h) <= UPLOAD_MAX_EDGE) {
    return { data: input, ext: "jpg" };
  }
  // sharp drops all metadata (EXIF · GPS · XMP) unless asked to keep it.
  const img = sharp(input, { failOn: "error" })
    .rotate()
    .resize({ width: UPLOAD_MAX_EDGE, height: UPLOAD_MAX_EDGE, fit: "inside", withoutEnlargement: true });
  if (meta.hasAlpha) return { data: await img.webp({ quality: JPEG_QUALITY }).toBuffer(), ext: "webp" };
  return { data: await img.jpeg({ quality: JPEG_QUALITY, mozjpeg: true }).toBuffer(), ext: "jpg" };
}
