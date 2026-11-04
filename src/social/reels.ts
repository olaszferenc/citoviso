// Reels maker: a lodging's own photos → a vertical 1080×1920 slideshow with a slow zoom,
// cross-fades and caption overlays (RESEARCH-2026-11-facebook-modul §3.2). Local ffmpeg,
// no model call, $0.
//
// Every photo is laid over a blurred, cover-cropped copy of itself, so a landscape
// photo is shown WHOLE (nothing of the room is cut away) and the 9:16 frame is still
// full. Music is optional and only accepted together with a license file — the brief
// forbids audio we cannot prove we may use; without music the video gets a silent AAC
// track, because some players and upload pipelines refuse a video with no audio stream.

import { spawn } from "node:child_process";
import { existsSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

export const REEL_W = 1080;
export const REEL_H = 1920;
export const REEL_FPS = 30;
/** Meta Reels accept 3–90 s; the content concept asks for 15–30 s. */
export const MIN_SECONDS = 15;
export const MAX_SECONDS = 30;
const FADE_S = 0.6;

export interface Caption {
  readonly text: string;
  /** Seconds from the start of the video. */
  readonly from: number;
  readonly to: number;
  /** "top" sits in the upper third; "bottom" stays above the Reels UI strip. */
  readonly at?: "top" | "bottom";
}

export interface ReelSpec {
  readonly photos: readonly string[];
  readonly out: string;
  /** Total length in seconds; clamped to [MIN_SECONDS, MAX_SECONDS]. */
  readonly seconds?: number;
  readonly captions?: readonly Caption[];
  readonly music?: { readonly file: string; readonly licenseFile: string };
  readonly font?: string;
}

export const DEFAULT_FONT = "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf";

/** Seconds each photo is on screen so that the cross-faded total equals `total`. */
export function perPhotoSeconds(count: number, total: number): number {
  // total = n·d − (n−1)·fade  →  d = (total + (n−1)·fade) / n
  return (total + (count - 1) * FADE_S) / count;
}

export function clampSeconds(requested: number | undefined, count: number): number {
  const wanted = requested ?? Math.min(MAX_SECONDS, Math.max(MIN_SECONDS, count * 3));
  return Math.min(MAX_SECONDS, Math.max(MIN_SECONDS, wanted));
}

/**
 * The ffmpeg argument list. `captionFiles[i]` holds the text of `spec.captions[i]`:
 * drawtext reads it with `textfile=`, so accents, quotes and colons need no escaping.
 */
export function buildReelArgs(spec: ReelSpec, captionFiles: readonly string[]): string[] {
  const n = spec.photos.length;
  if (n < 2) throw new Error("legalább 2 fotó kell");
  const total = clampSeconds(spec.seconds, n);
  const d = perPhotoSeconds(n, total);
  const frames = Math.round(d * REEL_FPS);
  const font = spec.font ?? DEFAULT_FONT;

  const args: string[] = ["-y", "-hide_banner", "-loglevel", "error"];
  for (const p of spec.photos) args.push("-i", p);
  if (spec.music) args.push("-i", spec.music.file);
  else args.push("-f", "lavfi", "-t", String(total), "-i", "anullsrc=channel_layout=stereo:sample_rate=48000");
  const audioIdx = n;

  const f: string[] = [];
  for (let i = 0; i < n; i++) {
    // Work at 2× size, so the zoom's sub-pixel steps do not visibly jitter.
    const W2 = REEL_W * 2;
    const H2 = REEL_H * 2;
    f.push(
      `[${i}:v]scale=${W2}:${H2}:force_original_aspect_ratio=increase,crop=${W2}:${H2},boxblur=40:4,setsar=1[bg${i}]`,
      `[${i}:v]scale=${W2}:${H2}:force_original_aspect_ratio=decrease,setsar=1[fg${i}]`,
      `[bg${i}][fg${i}]overlay=(W-w)/2:(H-h)/2,format=yuv420p[st${i}]`,
      // Alternate zoom-in / zoom-out so consecutive photos do not all move the same way.
      i % 2 === 0
        ? `[st${i}]zoompan=z='min(1+0.10*on/${frames},1.10)':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d=${frames}:s=${REEL_W}x${REEL_H}:fps=${REEL_FPS},setsar=1[v${i}]`
        : `[st${i}]zoompan=z='max(1.10-0.10*on/${frames},1.0)':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d=${frames}:s=${REEL_W}x${REEL_H}:fps=${REEL_FPS},setsar=1[v${i}]`,
    );
  }
  let last = "v0";
  for (let i = 1; i < n; i++) {
    const offset = (i * (d - FADE_S)).toFixed(3);
    const outLabel = `x${i}`;
    f.push(`[${last}][v${i}]xfade=transition=fade:duration=${FADE_S}:offset=${offset}[${outLabel}]`);
    last = outLabel;
  }
  (spec.captions ?? []).forEach((c, i) => {
    const y = c.at === "top" ? "h*0.16" : "h*0.66";
    const outLabel = `c${i}`;
    f.push(
      `[${last}]drawtext=fontfile='${font}':textfile='${captionFiles[i]}':fontsize=64:fontcolor=white:` +
        `line_spacing=14:box=1:boxcolor=black@0.45:boxborderw=28:x=(w-text_w)/2:y=${y}:` +
        `enable='between(t,${c.from},${c.to})'[${outLabel}]`,
    );
    last = outLabel;
  });
  f.push(`[${last}]trim=duration=${total},setpts=PTS-STARTPTS[vout]`);
  f.push(`[${audioIdx}:a]atrim=duration=${total},afade=t=out:st=${Math.max(0, total - 1.5)}:d=1.5[aout]`);

  args.push(
    "-filter_complex", f.join(";"),
    "-map", "[vout]", "-map", "[aout]",
    "-c:v", "libx264", "-profile:v", "high", "-pix_fmt", "yuv420p", "-r", String(REEL_FPS),
    "-preset", "medium", "-crf", "20",
    "-c:a", "aac", "-b:a", "128k", "-ar", "48000",
    "-movflags", "+faststart",
    "-t", String(total),
    spec.out,
  );
  return args;
}

/** Wrap a caption to lines of at most `width` characters (drawtext does not wrap). */
export function wrapCaption(text: string, width = 22): string {
  const lines: string[] = [];
  for (const para of text.split("\n")) {
    let line = "";
    for (const word of para.split(/\s+/).filter(Boolean)) {
      if (line && (line + " " + word).length > width) {
        lines.push(line);
        line = word;
      } else line = line ? `${line} ${word}` : word;
    }
    lines.push(line);
  }
  return lines.join("\n");
}

export async function makeReel(spec: ReelSpec): Promise<{ seconds: number }> {
  for (const p of spec.photos) if (!existsSync(p)) throw new Error(`nincs ilyen fotó: ${p}`);
  if (spec.music && !existsSync(spec.music.licenseFile)) {
    throw new Error(`zene csak igazolt licenccel: hiányzik a licencfájl (${spec.music.licenseFile})`);
  }
  const work = mkdtempSync(join(tmpdir(), "reel-"));
  try {
    const captionFiles = (spec.captions ?? []).map((c, i) => {
      const p = join(work, `cap${i}.txt`);
      writeFileSync(p, wrapCaption(c.text));
      return p;
    });
    const args = buildReelArgs(spec, captionFiles);
    await new Promise<void>((resolve, reject) => {
      const ff = spawn("ffmpeg", args, { stdio: ["ignore", "inherit", "inherit"] });
      ff.on("error", reject);
      ff.on("exit", (code) => (code === 0 ? resolve() : reject(new Error(`ffmpeg kilépési kód: ${code}`))));
    });
    return { seconds: clampSeconds(spec.seconds, spec.photos.length) };
  } finally {
    rmSync(work, { recursive: true, force: true });
  }
}
