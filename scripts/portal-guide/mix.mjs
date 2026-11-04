// Lays the narration clips onto the silent recording at their logged times.
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import path from "node:path";
import { TTS } from "./voice.mjs";
const ffmpeg = path.join(TTS, "ffmpeg");
const [dir, name] = process.argv.slice(2);
const ev = JSON.parse(readFileSync(path.join(dir, name + ".events.json"), "utf8"));
const args = ["-y", "-loglevel", "error", "-i", path.join(dir, name + ".raw.webm")];
ev.forEach((e) => args.push("-i", e.file));
const fl = ev.map((e, i) => `[${i + 1}]adelay=${Math.max(0, Math.round(e.at))}:all=1[a${i}]`).join(";") + ";" + ev.map((_, i) => `[a${i}]`).join("") + `amix=inputs=${ev.length}:normalize=0:duration=longest,volume=1.6[a]`;
args.push("-filter_complex", fl, "-map", "0:v", "-map", "[a]", "-c:v", "copy", "-c:a", "libopus", "-b:a", "64k", path.join(dir, name + ".webm"));
execFileSync(ffmpeg, args, { stdio: "inherit" });
console.log("mixed", name, ev.length, "clips");
