// Depth-map worker (ADR-0472 depth hero) — runs in its OWN process, one photo per run.
//
// Why a separate process: the ONNX session holds ~300 MB while it runs (measured 336 MB RSS on the
// dev box). The console and the public server live on a 4 GB box; keeping that resident in either
// of them for a job that runs a few times a day would be waste, and a native crash in the runtime
// must never take a server down. The parent (depthMap.ts) spawns this, one at a time.
//
//   node --import tsx src/media/depthWorker.ts <model.onnx> <in-image> <out.png>
//   → stdout, one JSON line: {"ok":true,"width":…,"height":…,"spread":…} | {"ok":false,"error":"…"}
//
// The maths mirror the prototype the owner approved the look on (2026-11-23): the model input is
// the photo resized so its long edge is ~518 px in multiples of 14 (the ViT patch), ImageNet
// normalisation; the output is relative inverse depth (near = high), min-max normalised to 0–255,
// resized to ≤ 768 px wide and softened (blur 2) so the shader does not tear along hard edges.

import ort from "onnxruntime-node";
import sharp from "sharp";

const MEAN = [0.485, 0.456, 0.406] as const;
const STD = [0.229, 0.224, 0.225] as const;

async function main(): Promise<void> {
  const [modelPath, input, output] = process.argv.slice(2);
  if (!modelPath || !input || !output) throw new Error("usage: depthWorker <model> <in> <out>");
  const sess = await ort.InferenceSession.create(modelPath, {
    intraOpNumThreads: 2,
    interOpNumThreads: 1,
    graphOptimizationLevel: "all",
  });
  // .rotate() honours EXIF orientation, the same way the browser shows the photo.
  const img = sharp(input).rotate().removeAlpha();
  const meta = await img.clone().metadata();
  const oriented = (meta.orientation ?? 1) >= 5;
  const width = (oriented ? meta.height : meta.width) ?? 0;
  const height = (oriented ? meta.width : meta.height) ?? 0;
  if (!width || !height) throw new Error("unreadable image");
  const s = 518 / Math.max(width, height);
  const nw = Math.max(14, Math.round((width * s) / 14) * 14);
  const nh = Math.max(14, Math.round((height * s) / 14) * 14);
  const raw = await img.resize(nw, nh, { fit: "fill", kernel: "cubic" }).raw().toBuffer();
  const plane = nw * nh;
  const x = new Float32Array(3 * plane);
  for (let i = 0; i < plane; i++) {
    for (let c = 0; c < 3; c++) x[c * plane + i] = (raw[i * 3 + c]! / 255 - MEAN[c]!) / STD[c]!;
  }
  const out = await sess.run({ [sess.inputNames[0]!]: new ort.Tensor("float32", x, [1, 3, nh, nw]) });
  const t = out[sess.outputNames[0]!]!;
  const data = t.data as Float32Array;
  const [oh, ow] = t.dims.slice(-2) as [number, number];
  let mn = Infinity;
  let mx = -Infinity;
  for (const v of data) {
    if (v < mn) mn = v;
    if (v > mx) mx = v;
  }
  const span = mx - mn || 1;
  const g = Buffer.alloc(ow * oh);
  let sum = 0;
  let sq = 0;
  for (let i = 0; i < g.length; i++) {
    const n = (data[i]! - mn) / span;
    sum += n;
    sq += n * n;
    g[i] = Math.round(n * 255);
  }
  const mean = sum / g.length;
  const spread = Math.sqrt(Math.max(0, sq / g.length - mean * mean));
  const W = Math.min(768, width);
  const H = Math.max(1, Math.round((W * height) / width));
  await sharp(g, { raw: { width: ow, height: oh, channels: 1 } })
    .resize(W, H, { kernel: "cubic" })
    .blur(2)
    .png({ compressionLevel: 9 })
    .toFile(output);
  process.stdout.write(`${JSON.stringify({ ok: true, width, height, spread: Number(spread.toFixed(4)) })}\n`);
}

main().catch((e: unknown) => {
  process.stdout.write(`${JSON.stringify({ ok: false, error: e instanceof Error ? e.message : String(e) })}\n`);
  process.exit(1);
});
