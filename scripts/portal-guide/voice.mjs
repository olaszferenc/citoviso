// Hungarian narration: caption text -> speakable text -> Piper wav (cached), with duration.
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, statSync, mkdirSync } from "node:fs";
import path from "node:path";
import os from "node:os";

// Piper binary + Hungarian voices + ffmpeg live OUTSIDE the repo (README.md: how to fetch them).
export const TTS = process.env.TTS_DIR || path.join(os.homedir(), ".cache", "citoviso-tts");
const VOICE = process.env.VOICE || "anna";
export const CLIPS = path.join(TTS, "clips-" + VOICE);
mkdirSync(CLIPS, { recursive: true });

// English UI labels the viewer must find on screen: said the way a Hungarian would read them aloud.
const EN = [
  [/Rates & Availability/gi, "réjtsz end evelebiliti"], [/Sync calendars/gi, "szink kelenderz"],
  [/Add calendar connection/gi, "ed kelender konnekson"],
  [/Import calendar/gi, "import kelender"], [/Export calendar/gi, "export kelender"],
  [/Calendar name/gi, "kelender ném"], [/Next step/gi, "nekszt sztep"], [/Copy link/gi, "kopi link"],
  [/Import now/gi, "import nau"], [/„Done”/g, "dan"], [/Done/g, "dan"],
];
const ORD = { 1: "első", 2: "második", 3: "harmadik", 4: "negyedik" };

export function spoken(s) {
  let t = String(s);
  t = t.replace(/\(angolul:[^)]*\)/g, "");
  t = t.replace(/\(([^)]*)\)/g, (m, inner) => (/[áéíóöőúüű]/i.test(inner) && !/^[\x00-\x7F]*$/.test(inner) ? ", " + inner + "," : ""));
  for (const [re, v] of EN) t = t.replace(re, v);
  t = t.replace(/admin\.booking\.com/g, "admin pont booking pont kom")
    .replace(/Booking\.com/g, "Booking").replace(/Szállás\.hu/g, "Szállás pont hu").replace(/Airbnb/g, "érbiendbi")
    .replace(/\biCal\b/g, "ájkál").replace(/Ctrl\+V/g, "kontrol vé").replace(/Ctrl\+C/g, "kontrol cé")
    .replace(/\bpl\./g, "például").replace(/(\d)\.(?= lépés)/g, (m, d) => ORD[d] || d)
    .replace(/SAJÁT/g, "saját").replace(/\bhost\b/g, "hoszt");
  t = t.replace(/›/g, ", ").replace(/[„”"]/g, "").replace(/\s—\s/g, ", ").replace(/\s*,\s*,/g, ",").replace(/\s+/g, " ").replace(/\s+([,.:])/g, "$1").trim();
  t = t.replace(/,\s*([.:?!])/g, "$1").replace(/,$/, "");
  if (!/[.!?]$/.test(t)) t += ".";
  t = t.charAt(0).toUpperCase() + t.slice(1);
  return t;
}

export function clip(text) {
  const say = spoken(text);
  const f = path.join(CLIPS, createHash("sha1").update(VOICE + "|" + say).digest("hex").slice(0, 16) + ".wav");
  if (!existsSync(f)) execFileSync(path.join(TTS, "piper", "piper"), ["-m", path.join(TTS, `hu_HU-${VOICE}-medium.onnx`), "--length_scale", process.env.TTS_SPEED || "1.05", "--sentence_silence", "0.35", "-f", f], { input: say, stdio: ["pipe", "ignore", "ignore"] });
  // Piper medium: 22050 Hz mono 16-bit PCM, 44-byte header
  const ms = Math.round(((statSync(f).size - 44) / (22050 * 2)) * 1000);
  return { file: f, ms, say };
}
