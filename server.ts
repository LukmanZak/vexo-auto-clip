import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { spawn } from "child_process";
import fs from "fs";
import dotenv from "dotenv";
import multer from "multer";
import { GoogleGenAI } from "@google/genai";

dotenv.config();

const app = express();
const PORT = Number(process.env.PORT) || 3001;

app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true }));
app.use("/temp", express.static(path.join(process.cwd(), "temp")));

// Fix Chrome DevTools 404 + Kaspersky CSP injection
app.get("/.well-known/appspecific/com.chrome.devtools.json", (_req, res) => res.status(204).end());
app.use((req, _res, next) => {
  // allow Kaspersky + Vite HMR
  req.headers["content-security-policy"] = undefined;
  next();
});
app.use((_req, res, next) => {
  res.setHeader(
    "Content-Security-Policy",
    "default-src * 'unsafe-inline' 'unsafe-eval' data: blob:; connect-src * ws: wss: http://gc.kis.v2.scr.kaspersky-labs.com ws://gc.kis.v2.scr.kaspersky-labs.com http://localhost:* https://localhost:* http://127.0.0.1:* ws://127.0.0.1:* http://0.0.0.0:* ws://0.0.0.0:* http://192.168.*:* ws://192.168.*:* http://10.*:* ws://10.*:*; script-src * 'unsafe-inline' 'unsafe-eval' blob:; style-src * 'unsafe-inline' data: blob:; img-src * data: blob:; media-src * data: blob:"
  );
  next();
});

// Gemini Setup - use @google/genai with gemini-3.5-flash-lite
const GEMINI_MODEL = process.env.GEMINI_MODEL || "gemini-3.5-flash-lite";
const genAI = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || "" });

// Ensure temp dirs
const TEMP_DIR = path.join(process.cwd(), "temp");
const THUMB_DIR = path.join(TEMP_DIR, "thumbs");
const CLIP_DIR = path.join(TEMP_DIR, "clips");
const DOWNLOAD_DIR = path.join(TEMP_DIR, "downloads");
const UPLOAD_DIR = path.join(TEMP_DIR, "uploads");
for (const d of [TEMP_DIR, THUMB_DIR, CLIP_DIR, DOWNLOAD_DIR, UPLOAD_DIR]) {
  if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true });
}

const upload = multer({ dest: UPLOAD_DIR, limits: { fileSize: 800 * 1024 * 1024 } });

// Resolve videoPath yang bisa berupa absolute, relative filename, atau cuma basename dari upload
function resolveVideoPath(p: string): string {
  if (!p) return p;
  if (fs.existsSync(p)) return p;
  // coba basename di beberapa folder temp
  const base = path.basename(p);
  for (const dir of [DOWNLOAD_DIR, CLIP_DIR, UPLOAD_DIR, TEMP_DIR, process.cwd()]) {
    const cand = path.join(dir, base);
    if (fs.existsSync(cand)) return cand;
  }
  // kalau p adalah nama file tanpa path (dari file input lama), coba cari di uploads/downloads
  if (!path.isAbsolute(p)) {
    const cand2 = path.join(UPLOAD_DIR, p);
    if (fs.existsSync(cand2)) return cand2;
  }
  return p; // biarkan apa adanya, nanti ffmpeg kasih error yang jelas
}

function safeFilePart(value: string, fallback: string): string {
  const clean = value
    .normalize("NFKC")
    .replace(/[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}]/gu, "")
    .replace(/[^a-zA-Z0-9\u00C0-\u024F\u1E00-\u1EFF]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 100);
  return clean || fallback;
}

function cleanCaption(value: string, fallback: string): string {
  let count = 0;
  const cleaned = String(value || fallback)
    .replace(/[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}]/gu, "")
    .replace(/#[\p{L}\p{N}_-]+/gu, (tag) => (count++ < 5 ? tag : ""))
    .replace(/[ \t]{2,}/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
  return cleaned || fallback;
}

function timestampSeconds(value: string): number {
  const parts = String(value || "").split(":").map(Number);
  if (parts.some((part) => !Number.isFinite(part))) return 0;
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
  if (parts.length === 2) return parts[0] * 60 + parts[1];
  return parts[0] || 0;
}

function timestampString(seconds: number): string {
  const safe = Math.max(0, Math.floor(seconds));
  const h = Math.floor(safe / 3600);
  const m = Math.floor((safe % 3600) / 60);
  const s = safe % 60;
  return h > 0
    ? `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`
    : `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

function normalizeClipTimestamps(clip: any, maxTranscriptTime: number): any {
  const normalize = (value: string) => {
    const raw = timestampSeconds(value);
    const parts = String(value || "").split(":").map(Number);
    // Gemini sometimes writes 10:15:00 for 10 minutes 15 seconds.
    const minuteStyle = parts.length === 3 && parts[2] === 0 ? parts[0] * 60 + parts[1] : raw;
    const chosen = raw > maxTranscriptTime + 30 && minuteStyle <= maxTranscriptTime + 10 ? minuteStyle : raw;
    return timestampString(chosen);
  };
  return { ...clip, startTime: normalize(clip.startTime), endTime: normalize(clip.endTime) };
}

// Upload video file dari browser → simpan ke temp/uploads dan return path absolut
app.post("/api/upload-video", upload.single("file"), (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: "No file uploaded" });
    const orig = req.file.originalname || "video.mp4";
    const ext = path.extname(orig) || ".mp4";
    const finalName = `${Date.now()}_${orig.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
    const finalPath = path.join(UPLOAD_DIR, finalName);
    // multer menyimpan di temp dengan nama random, kita rename ke original+timestamp
    fs.renameSync(req.file.path, finalPath);
    console.log(`Upload video: ${orig} -> ${finalPath} (${(fs.statSync(finalPath).size / 1024 / 1024).toFixed(2)} MB)`);
    res.json({ videoPath: finalPath, filename: finalName, size: fs.statSync(finalPath).size });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// Helper to run ffmpeg
async function runFfmpegCommand(ffmpegPath: string, args: string[]): Promise<string> {
  return new Promise((resolve, reject) => {
    const cmd = ffmpegPath || process.env.FFMPEG_PATH || "ffmpeg";
    console.log(`FFMPEG: ${cmd} ${args.join(" ")}`);
    const proc = spawn(cmd, args, { shell: false });
    let stdout = "";
    let stderr = "";
    proc.stdout.on("data", (d) => (stdout += d.toString()));
    proc.stderr.on("data", (d) => (stderr += d.toString()));
    proc.on("close", (code) => {
      if (code === 0) resolve(stdout);
      else {
        const lines = stderr.split("\n").filter((l) => l.trim() !== "");
        reject(new Error(`FFMPEG Error (Exit ${code}): ${lines.slice(-10).join("\n") || stderr}`));
      }
    });
    proc.on("error", (err: any) => {
      if (err.code === "ENOENT") reject(new Error(`FFMPEG not found: ${cmd}`));
      else reject(new Error(`FFMPEG spawn error: ${err.message}`));
    });
  });
}

function assertValidVideoOutput(outputPath: string): void {
  if (!fs.existsSync(outputPath)) throw new Error("FFmpeg selesai tetapi file video tidak dibuat");
  const size = fs.statSync(outputPath).size;
  // An MP4 containing only ftyp/moov atoms (usually 262 bytes) has no frames.
  if (size < 4096) throw new Error(`Output video tidak valid atau kosong (${size} bytes). Periksa timestamp clip dan durasi video sumber.`);
}

function assTimestamp(seconds: number): string {
  const safe = Math.max(0, seconds);
  const hours = Math.floor(safe / 3600);
  const minutes = Math.floor((safe % 3600) / 60);
  const remaining = safe % 60;
  return `${hours}:${String(minutes).padStart(2, "0")}:${remaining.toFixed(2).padStart(5, "0")}`;
}

function buildSectionSubtitleAss(lines: unknown, clipStart: number, clipEnd: number): string | null {
  if (!Array.isArray(lines)) return null;
  const dialogue = lines.flatMap((line: any) => {
    const start = Number(line?.start);
    const end = Number(line?.end);
    const text = String(line?.text || "").trim();
    if (!Number.isFinite(start) || !Number.isFinite(end) || !text || end <= clipStart || start >= clipEnd) return [];
    const relativeStart = Math.max(0, start - clipStart);
    const relativeEnd = Math.min(clipEnd, end) - clipStart;
    if (relativeEnd - relativeStart < 0.08) return [];
    const assText = text
      .replace(/\\/g, "\\\\")
      .replace(/[{}]/g, "")
      .replace(/\r?\n/g, "\\N");
    return [`Dialogue: 0,${assTimestamp(relativeStart)},${assTimestamp(relativeEnd)},Default,,0,0,0,,${assText}`];
  });
  if (!dialogue.length) return null;
  return `[Script Info]\nScriptType: v4.00+\nPlayResX: 720\nPlayResY: 1280\nWrapStyle: 0\nScaledBorderAndShadow: yes\n\n[V4+ Styles]\nFormat: Name,Fontname,Fontsize,PrimaryColour,SecondaryColour,OutlineColour,BackColour,Bold,Italic,Underline,StrikeOut,ScaleX,ScaleY,Spacing,Angle,BorderStyle,Outline,Shadow,Alignment,MarginL,MarginR,MarginV,Encoding\nStyle: Default,Arial,44,&H00FFFFFF,&H000000FF,&H00101010,&H70000000,-1,0,0,0,100,100,0,0,1,3,1,2,45,45,150,1\n\n[Events]\nFormat: Layer,Start,End,Style,Name,MarginL,MarginR,MarginV,Effect,Text\n${dialogue.join("\n")}\n`;
}

function subtitleFilterForFile(subtitlePath: string): string {
  const escaped = subtitlePath
    .replace(/\\/g, "/")
    .replace(/:/g, "\\:")
    .replace(/'/g, "\\'");
  return `subtitles=filename='${escaped}'`;
}

function parseObsidianLine(md: string) {
  const timestamp = /^\s*(?:[-*]\s*)?(?:\*{0,2})\[?(\d{1,2}:\d{2}(?::\d{2})?)\]?(?:\*{0,2})(?:\s*(?:·|[-–—|])\s*|\s+)(.+?)\s*$/;
  const parsed = md.split(/\r?\n/).flatMap((rawLine) => {
    const match = rawLine.match(timestamp);
    if (!match) return [];
    const parts = match[1].split(":").map(Number);
    const start = parts.length === 3 ? parts[0] * 3600 + parts[1] * 60 + parts[2] : parts[0] * 60 + parts[1];
    return [{ start, timeStr: match[1], text: match[2].replace(/^\*{1,2}|\*{1,2}$/g, "").trim() }];
  });
  const unique = parsed.filter((item, index) => index === 0 || item.start !== parsed[index - 1].start);
  return unique.map((cur, index) => ({ start: cur.start, end: unique[index + 1]?.start ?? cur.start + 10, text: cur.text, timeStr: cur.timeStr }));
}

function extractVideoId(urlOrId: string): string {
  if (!urlOrId) return "";
  if (!urlOrId.includes("http") && !urlOrId.includes("youtu")) return urlOrId;
  try {
    const u = new URL(urlOrId);
    if (u.searchParams.get("v")) return u.searchParams.get("v")!;
    if (u.hostname.includes("youtu.be")) return u.pathname.slice(1).split("?")[0];
  } catch {}
  // fallback
  if (urlOrId.includes("v=")) return urlOrId.split("v=")[1].split("&")[0];
  if (urlOrId.includes("youtu.be/")) return urlOrId.split("youtu.be/")[1].split("?")[0];
  return urlOrId;
}

async function fetchTranscriptViaPython(videoId: string): Promise<{ start: number; duration: number; text: string }[]> {
  const script = path.join(process.cwd(), "src/python/fetch_transcript.py");
  const candidates = process.platform === "win32" ? ["python", "py", "python3"] : ["python3", "python", "py"];
  let lastErr = "";

  for (const exe of candidates) {
    try {
      const result: { start: number; duration: number; text: string }[] = await new Promise((resolve, reject) => {
        const proc = spawn(exe, [script, videoId], { shell: false });
        let out = "";
        let err = "";
        proc.stdout.on("data", (d) => (out += d.toString()));
        proc.stderr.on("data", (d) => (err += d.toString()));
        proc.on("close", (code) => {
          const combined = (out + err).toLowerCase();
          if (combined.includes("python was not found") || combined.includes("microsoft store")) {
            reject(new Error(`__PYTHON_NOT_FOUND__:${exe}:${err || out}`));
            return;
          }
          // Even on non-zero exit, python script prints {"error": "..."} to stdout
          if (code !== 0) {
            try {
              const j = JSON.parse(out.trim());
              if (j.error) {
                reject(new Error(j.error));
                return;
              }
            } catch {}
            // fallback: include both stdout and stderr
            const detail = (err.trim() || out.trim() || `exit ${code}`).slice(0, 800);
            reject(new Error(`${exe} exit ${code}: ${detail}`));
            return;
          }
          try {
            const j = JSON.parse(out);
            if (j.error) reject(new Error(j.error));
            else resolve(j.transcript);
          } catch (e: any) {
            reject(new Error(`Parse failed: ${e.message} out=${out.slice(0, 500)} err=${err.slice(0, 300)}`));
          }
        });
        proc.on("error", (e: any) => {
          if (e.code === "ENOENT") reject(new Error(`__ENOENT__:${exe}`));
          else reject(e);
        });
      });
      return result;
    } catch (e: any) {
      const msg = e.message || "";
      // Try next candidate if python not found / ENOENT / Store alias
      if (msg.startsWith("__PYTHON_NOT_FOUND__") || msg.startsWith("__ENOENT__")) {
        lastErr = msg;
        continue;
      }
      // Real error from script (e.g. transcript disabled, youtube_transcript_api not installed) -> don't try next exe, throw directly with hint
      throw e;
    }
  }
  throw new Error(
    lastErr.includes("Python was not found") || lastErr.includes("Microsoft Store")
      ? `Python tidak ditemukan (tried ${candidates.join(", ")}). Di Windows install Python dari python.org dan centang \"Add to PATH\", atau pakai fallback: paste hasil Obsidian Web Clipper di tab Obsidian. Detail: ${lastErr}`
      : `Python tidak ditemukan (tried ${candidates.join(", ")}). Install Python & pip install youtube_transcript_api, atau pakai fallback Obsidian. Detail: ${lastErr}`
  );
}

async function fetchFaceTracksViaPython(videoPath: string, interval: number = 2): Promise<{ time: number; x: number; y: number; width: number }[]> {
  const script = path.join(process.cwd(), "src/python/detect_faces.py");
  const candidates = process.platform === "win32" ? ["python", "py", "python3"] : ["python3", "python", "py"];
  let lastErr = "";
  for (const exe of candidates) {
    try {
      const result = await new Promise<{ time: number; x: number; y: number; width: number }[]>((resolve, reject) => {
        const proc = spawn(exe, [script, videoPath, String(interval)], { shell: false });
        let out = ""; let err = "";
        proc.stdout.on("data", d => out += d.toString());
        proc.stderr.on("data", d => err += d.toString());
        proc.on("close", code => {
          const combined = (out+err).toLowerCase();
          if (combined.includes("python was not found") || combined.includes("microsoft store")) { reject(new Error(`__PYTHON_NOT_FOUND__:${exe}:${err||out}`)); return; }
          if (code !== 0) {
            try { const j = JSON.parse(out.trim()); if (j.error) { reject(new Error(j.error)); return; } } catch {}
            reject(new Error(`${exe} exit ${code}: ${(err.trim()||out.trim()||`exit ${code}`).slice(0,800)}`)); return;
          }
          try { const j = JSON.parse(out); if (j.error) reject(new Error(j.error)); else resolve(j.tracks); } catch (e:any) { reject(new Error(`Parse failed: ${e.message} out=${out.slice(0,500)}`)); }
        });
        proc.on("error", (e:any) => { if (e.code==="ENOENT") reject(new Error(`__ENOENT__:${exe}`)); else reject(e); });
      });
      return result;
    } catch (e:any) {
      const msg = e.message||"";
      if (msg.startsWith("__PYTHON_NOT_FOUND__")||msg.startsWith("__ENOENT__")) { lastErr=msg; continue; }
      throw e;
    }
  }
  throw new Error(`Python tidak ditemukan (tried ${candidates.join(", ")}). Install python deps: pip install opencv-python mediapipe. Detail: ${lastErr}`);
}

async function transcribeClipViaPython(videoPath: string): Promise<{ captions: { start: number; end: number; text: string }[]; wordCount: number; model: string; device: string }> {
  const script = path.join(process.cwd(), "src/python/transcribe_clip.py");
  const candidates = process.platform === "win32" ? ["python", "py", "python3"] : ["python3", "python", "py"];
  let lastErr = "";
  for (const exe of candidates) {
    try {
      return await new Promise((resolve, reject) => {
        const args = [script, videoPath, "--model", process.env.WHISPER_MODEL || "medium"];
        const proc = spawn(exe, args, { shell: false });
        let out = "";
        let err = "";
        proc.stdout.on("data", (data) => (out += data.toString()));
        proc.stderr.on("data", (data) => (err += data.toString()));
        proc.on("close", (code) => {
          try {
            const parsed = JSON.parse(out.trim());
            if (parsed.error) return reject(new Error(parsed.error));
            if (code === 0 && Array.isArray(parsed.captions)) return resolve(parsed);
          } catch {}
          reject(new Error(`${exe} exit ${code}: ${(err.trim() || out.trim() || "Whisper tidak mengembalikan JSON").slice(0, 1000)}`));
        });
        proc.on("error", (error: any) => {
          if (error.code === "ENOENT") reject(new Error(`__ENOENT__:${exe}`));
          else reject(error);
        });
      }) as { captions: { start: number; end: number; text: string }[]; wordCount: number; model: string; device: string };
    } catch (error: any) {
      if (String(error.message).startsWith("__ENOENT__")) {
        lastErr = error.message;
        continue;
      }
      throw error;
    }
  }
  throw new Error(`Python tidak ditemukan (tried ${candidates.join(", ")}). Install Python lalu pip install faster-whisper. Detail: ${lastErr}`);
}


// ---------- API: parse obsidian ----------
app.post("/api/slicin/parse-obsidian", (req, res) => {
  const { markdown } = req.body;
  if (!markdown) return res.status(400).json({ error: "Missing markdown" });
  try {
    const lines = parseObsidianLine(markdown);
    res.json({ lines, count: lines.length });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// ---------- API: youtube transcript ----------
app.post("/api/youtube/transcript", async (req, res) => {
  const { url, videoId } = req.body;
  const id = extractVideoId(videoId || url || "");
  if (!id) return res.status(400).json({ error: "Missing url/videoId" });
  try {
    const transcript = await fetchTranscriptViaPython(id);
    const lines = transcript.map((t) => ({
      start: t.start,
      end: t.start + (t.duration || 3),
      text: t.text,
    }));
    res.json({ videoId: id, lines, count: lines.length });
  } catch (e: any) {
    console.error("transcript error", e);
    res.status(500).json({ error: e.message, hint: "Coba pakai Obsidian Web Clipper fallback: copy paste markdown dari extension." });
  }
});

// ---------- API: face detection via python (mediapipe/haar) ----------
app.post("/api/face/detect", async (req, res) => {
  const { videoPath, sampleInterval } = req.body;
  if (!videoPath) return res.status(400).json({ error: "Missing videoPath" });
  const resolved = resolveVideoPath(videoPath);
  if (!fs.existsSync(resolved)) return res.status(400).json({ error: `Video not found: ${videoPath} -> ${resolved}` });
  const interval = Number(sampleInterval) || 2;
  try {
    const tracks = await fetchFaceTracksViaPython(resolved, interval);
    res.json({ tracks, count: tracks.length, interval, videoPath: resolved });
  } catch (e:any) {
    console.error("face detect error", e);
    res.status(500).json({ error: e.message, hint: "Install python deps: pip install opencv-python mediapipe" });
  }
});

// ---------- API: youtube download via yt-dlp ----------
app.post("/api/youtube/download", async (req, res) => {
  const { url, videoId } = req.body;
  const id = extractVideoId(videoId || url || "");
  const fullUrl = url || (videoId ? `https://www.youtube.com/watch?v=${id}` : "");
  if (!fullUrl) return res.status(400).json({ error: "Missing url/videoId" });

  // if already downloaded, return existing
  const existing = fs.readdirSync(DOWNLOAD_DIR).find((f) => f.startsWith(id + "."));
  if (existing) {
    const p = path.join(DOWNLOAD_DIR, existing);
    const stat = fs.statSync(p);
    return res.json({ videoId: id, videoPath: p, size: stat.size, cached: true });
  }

  try {
    const outTemplate = path.join(DOWNLOAD_DIR, `${id}.%(ext)s`);
    await new Promise<string>((resolve, reject) => {
      const args = [
        "-f", "bestvideo[ext=mp4]+bestaudio[ext=m4a]/best[ext=mp4]/bestaudio/best",
        "--merge-output-format", "mp4",
        "-o", outTemplate,
        "--no-playlist",
        fullUrl,
      ];
      console.log(`yt-dlp ${args.join(" ")}`);
      const proc = spawn("yt-dlp", args, { shell: false });
      let stderr = "";
      proc.stderr.on("data", (d) => (stderr += d.toString()));
      proc.stdout.on("data", (d) => console.log(d.toString().slice(0, 500)));
      proc.on("close", (code) => {
        if (code === 0) resolve("");
        else reject(new Error(`yt-dlp exit ${code}: ${stderr.slice(-800)}`));
      });
      proc.on("error", (e: any) => reject(new Error(`yt-dlp spawn: ${e.message}`)));
    });
    const downloaded = fs.readdirSync(DOWNLOAD_DIR).find((f) => f.startsWith(id + "."));
    if (!downloaded) throw new Error("yt-dlp finished but file not found");
    const p = path.join(DOWNLOAD_DIR, downloaded);
    const stat = fs.statSync(p);
    res.json({ videoId: id, videoPath: p, size: stat.size, cached: false });
  } catch (e: any) {
    console.error("yt-dlp error", e);
    res.status(500).json({ error: e.message });
  }
});

// ---------- API: analyze transcript -> clips via Gemini 3.5 flash lite ----------
app.post("/api/slicin/analyze", async (req, res) => {
  const { transcript, videoPath, mode, customPrompt, apiKey } = req.body;
  // transcript can be string or array of lines
  let plain = "";
  if (Array.isArray(transcript)) {
    plain = transcript
      .map((l: any) => {
        const s = l.start ?? 0;
        const m = Math.floor(s / 60);
        const sec = Math.floor(s % 60);
        const ts = `${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
        return `[${ts}] ${l.text}`;
      })
      .join("\n");
  } else if (typeof transcript === "string") {
    plain = transcript;
  }
  if (!plain) return res.status(400).json({ error: "Missing transcript" });

  // limit transcript to avoid token overflow (approx 30k chars)
  if (plain.length > 30000) plain = plain.slice(0, 30000) + "\n...[truncated]";

  const fileName = videoPath ? path.basename(videoPath) : "youtube-video";
  try {
    const prompt = customPrompt || `
You are an expert viral short-form editor for ${mode === "gaming" ? "Gaming (MOBA HOK/MLBB)" : "Indonesian Podcast (Helmy Yahya style)"}.
Video: "${fileName}"

TRANSCRIPT WITH TIMESTAMPS:
${plain}

Task: Identify 5-7 most viral-worthy segments (15-60 seconds each) for Reels/Shorts/TikTok.
For gaming: focus on savage/maniac, lord steal, comeback.
For podcast: focus on hot takes, emotional punchlines, controversial statements.

Return ONLY JSON array, no markdown:
[
  {"id":"c1","startTime":"00:01:20","endTime":"00:01:55","title":"Judul Hook","summary":"Ringkasan 1 kalimat","reason":"Alasan viral","transcript_snippet":"cuplikan","caption":"Caption relevan dengan isi clip.\n\n#topik #konteks","viralPotential":92},
  ...
]
Rules:
- startTime/endTime must be HH:MM:SS or MM:SS within transcript range
- viralPotential 0-100
- Indonesian language for title/summary if podcast mode
- caption wajib berisi 1-2 paragraf pendek dalam bahasa Indonesia yang terdengar seperti ditulis creator, bukan laporan atau ringkasan AI
- mulai dengan observasi, konflik, atau kalimat yang langsung masuk ke topik clip; jangan mengulang judul sebagai kalimat pertama
- gunakan kata sehari-hari dan kalimat yang mengalir; boleh memakai "kita", "nggak", atau "ternyata" jika sesuai konteks
- sebutkan detail atau gagasan yang benar-benar ada di transcript agar caption terasa nyambung dengan video
- hindari jargon seperti "landskap", "masif", "membuktikan bahwa", "era transformasi", "menjadi bukti", dan "di era digital" kecuali benar-benar diucapkan di transcript
- jangan membuat klaim, angka, nasihat, atau kesimpulan baru yang tidak ada di transcript
- jangan terdengar seperti artikel berita, press release, atau materi presentasi
- contoh gaya yang diinginkan: "Kalau mau bicara di depan orang, jangan sibuk terdengar pintar. Yang penting, orang yang mendengar paham maksud kita."
- contoh gaya yang harus dihindari: "Hal ini membuktikan bahwa kekuatan audiens digital telah mendominasi pasar ekonomi kreatif saat ini."
- caption harus tanpa emoji dan maksimal 5 hashtag yang benar-benar relevan
- jangan menambahkan hashtag jika tidak relevan
`;

    const client = apiKey ? new GoogleGenAI({ apiKey }) : genAI;

    // helper: robust JSON array extraction
    function extractJsonArray(raw: string): string | null {
      let t = raw.trim();
      // strip ```json fences if present
      const fence = t.match(/```(?:json)?\s*([\s\S]*?)```/);
      if (fence) t = fence[1].trim();
      // find outermost [ ... ] (last ] to handle multiple objects)
      const start = t.indexOf("[");
      const end = t.lastIndexOf("]");
      if (start === -1 || end === -1 || end <= start) return null;
      return t.slice(start, end + 1);
    }
    function tryParseClips(jsonStr: string): any[] {
      // 1) direct
      try { return JSON.parse(jsonStr); } catch {}
      // 2) remove trailing commas  ",]" -> "]"  ",}" -> "}"
      const cleaned = jsonStr.replace(/,\s*([\]}])/g, "$1");
      try { return JSON.parse(cleaned); } catch {}
      // 3) fix common Gemini glitches: unescaped line breaks inside strings -> escape
      // replace smart quotes, remove control chars except \n inside strings already escaped
      const sanitized = cleaned
        .replace(/[\u201C\u201D]/g, '"')
        .replace(/[\u2018\u2019]/g, "'")
        .replace(/\r/g, "");
      try { return JSON.parse(sanitized); } catch (e: any) {
        // throw with context snippet around error position if available
        const m = e.message.match(/position (\d+)/);
        if (m) {
          const pos = Number(m[1]);
          const snippet = sanitized.slice(Math.max(0, pos - 200), pos + 200);
          throw new Error(`${e.message} -- snippet near error: ...${snippet}...`);
        }
        throw e;
      }
    }

    // Try with responseMimeType JSON first (forces valid JSON), fallback to plain if model doesn't support
    let text = "";
    try {
      const r: any = await client.models.generateContent({
        model: GEMINI_MODEL,
        contents: prompt,
        config: { responseMimeType: "application/json" } as any,
      });
      text = r.text || r.candidates?.[0]?.content?.parts?.[0]?.text || "";
    } catch (mimeErr: any) {
      // fallback without mime type (some models like 3.5-lite alias may not support it)
      console.warn("generateContent with responseMimeType failed, retry without:", mimeErr.message?.slice(0, 200));
      const r2: any = await client.models.generateContent({ model: GEMINI_MODEL, contents: prompt });
      text = r2.text || r2.candidates?.[0]?.content?.parts?.[0]?.text || "";
    }

    if (!text) throw new Error("AI returned empty response");

    const jsonStr = extractJsonArray(text);
    if (!jsonStr) throw new Error(`AI returned no JSON array: ${text.slice(0, 800)}`);

    let clips: any;
    try {
      clips = tryParseClips(jsonStr);
    } catch (parseErr: any) {
      console.error("JSON parse failed raw:", jsonStr.slice(0, 2000));
      throw new Error(`Gagal parse JSON dari Gemini: ${parseErr.message}. Raw preview: ${jsonStr.slice(0, 500)}... — coba klik Analyze lagi atau kurangi panjang transcript`);
    }

    if (!Array.isArray(clips)) {
      // if model returned object with clips inside
      if (clips && Array.isArray((clips as any).clips)) clips = (clips as any).clips;
      else if (clips && typeof clips === "object") clips = [clips];
      else throw new Error(`AI JSON bukan array: ${JSON.stringify(clips).slice(0, 500)}`);
    }

    const maxTranscriptTime = Array.isArray(transcript)
      ? Math.max(...transcript.map((line: any) => Number(line.start) || 0), 0) + 10
      : Number.POSITIVE_INFINITY;
    clips = clips
      .filter((clip: any) => clip && clip.startTime && clip.endTime)
      .map((clip: any) => normalizeClipTimestamps(clip, maxTranscriptTime));

    res.json({ clips, model: GEMINI_MODEL });
  } catch (e: any) {
    console.error("Gemini error", e);
    res.status(500).json({ error: e.message, model: GEMINI_MODEL, hint: "Jika error JSON ': after property name', coba Analyze ulang — sudah auto-repair trailing comma & fences. Jika tetap, kurangi transcript atau cek GEMINI_MODEL di .env (pakai gemini-2.0-flash atau gemini-1.5-flash jika 3.5 tidak valid)." });
  }
});

// ---------- Legacy: /api/slicin/process (now uses real transcript if provided) ----------
app.post("/api/slicin/process", async (req, res) => {
  const { videoPath, mode, transcript } = req.body;
  // forward to /analyze
  if (transcript) {
    // if transcript provided directly
    const mockReq = { body: { transcript, videoPath, mode } } as any;
    // reuse logic
    let plain = Array.isArray(transcript)
      ? transcript.map((l: any) => `[${l.timeStr || ""}] ${l.text}`).join("\n")
      : transcript;
    if (plain.length > 30000) plain = plain.slice(0, 30000);
    try {
      const prompt = `You are viral editor for ${mode}. Transcript:\n${plain}\nReturn ONLY valid JSON array, no markdown, no extra text: [{"id":"c1","startTime":"00:01:20","endTime":"00:01:55","context":"reason","viralPotential":90}]`;
      let text = "";
      try {
        const r: any = await genAI.models.generateContent({ model: GEMINI_MODEL, contents: prompt, config: { responseMimeType: "application/json" } as any });
        text = r.text || "";
      } catch {
        const r2: any = await genAI.models.generateContent({ model: GEMINI_MODEL, contents: prompt });
        text = (r2 as any).text || "";
      }
      const fence = text.match(/```(?:json)?\s*([\s\S]*?)```/);
      if (fence) text = fence[1];
      const s = text.indexOf("[");
      const e = text.lastIndexOf("]");
      if (s === -1 || e === -1) throw new Error("no json");
      const jsonStr = text.slice(s, e + 1).replace(/,\s*([\]}])/g, "$1");
      res.json({ clips: JSON.parse(jsonStr) });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
    return;
  }
  // fallback: require markdown/transcript, not fake from filename anymore
  res.status(400).json({ error: "Provide transcript (obsidian markdown or lines). Use /api/slicin/parse-obsidian + /api/slicin/analyze" });
});

// ---------- Thumbnails ----------
app.post("/api/slicin/thumbnail", async (req, res) => {
  const { videoPath, time } = req.body;
  if (!videoPath || time === undefined) return res.status(400).json({ error: "Missing videoPath/time" });
  const out = path.join(THUMB_DIR, `thumb_${Date.now()}_${Math.random().toString(36).slice(2)}.jpg`);
  try {
    const ffmpegPath = process.env.FFMPEG_PATH || "";
    await runFfmpegCommand(ffmpegPath, ["-ss", String(time), "-i", videoPath, "-vframes", "1", "-q:v", "2", "-y", out]);
    // return as base64 if file exists, else path
    if (fs.existsSync(out)) {
      const b64 = fs.readFileSync(out).toString("base64");
      res.json({ thumbPath: out, dataUrl: `data:image/jpeg;base64,${b64}` });
    } else res.json({ thumbPath: out });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// helper: build per-frame X expression for smooth 30fps follow (Version B)
function buildXExpr(tracks: {time:number,x:number}[], sSec:number, eSec:number): string {
  if (!tracks || tracks.length===0) return "0.5";
  // filter and convert to clip-relative
  const rel: {t:number,x:number}[] = [];
  for (const tr of tracks) {
    if (tr.time >= sSec - 1 && tr.time <= eSec + 1) rel.push({ t: tr.time - sSec, x: Math.max(0,Math.min(1,tr.x)) });
  }
  if (rel.length===0) {
    // clamp to nearest
    if (eSec < tracks[0].time) return tracks[0].x.toFixed(3);
    if (sSec > tracks[tracks.length-1].time) return tracks[tracks.length-1].x.toFixed(3);
    return "0.5";
  }
  // sort by t
  rel.sort((a,b)=>a.t-b.t);
  // smoothing EMA 0.35
  const smoothed = [{...rel[0]}];
  for (let i=1;i<rel.length;i++) {
    const prev = smoothed[i-1].x;
    const cur = rel[i].x;
    const sx = prev * 0.65 + cur * 0.35;
    smoothed.push({ t: rel[i].t, x: sx });
  }
  // build nested if with linear interpolation per segment, evaluated per frame (t) - escape commas for ffmpeg
  let expr = smoothed[smoothed.length-1].x.toFixed(3);
  for (let i=smoothed.length-2; i>=0; i--) {
    const a = smoothed[i], b = smoothed[i+1];
    const dt = (b.t - a.t) || 0.5;
    const segExpr = `${a.x.toFixed(3)}+(${b.x.toFixed(3)}-${a.x.toFixed(3)})*(t-${a.t.toFixed(3)})/${dt.toFixed(3)}`;
    expr = `if(lt(t\,${b.t.toFixed(3)})\,${segExpr}\,${expr})`;
  }
  if (smoothed[0].t > 0) {
    expr = `if(lt(t\,${smoothed[0].t.toFixed(3)})\,${smoothed[0].x.toFixed(3)}\,${expr})`;
  }
  return expr;
}

// ---------- Cut with aspect + smart crop sampling (dynamic per 2s follows face) ----------
app.post("/api/slicin/cut", async (req, res) => {
  const { videoPath, startTime, endTime, outputName, aspectRatio, smartCrop, faceTracks, sampleInterval, version, title, caption, subtitleLines, burnCaptions, captionEngine } = req.body;
  const ffmpegPath = process.env.FFMPEG_PATH || "";
  if (!videoPath || !startTime || !endTime) return res.status(400).json({ error: "Missing required parameters" });
  const ver = Number(version) || 3; // 1=hijau, 2=hijau+posisi, 3=bersih per-frame
  // resolve ke absolute yang ada di disk
  const resolvedVideoPath = resolveVideoPath(videoPath);
  if (!fs.existsSync(resolvedVideoPath)) {
    return res.status(400).json({ error: `Video file not found on server: ${videoPath}. Upload dulu via Pilih File atau Fetch YouTube. Tried: ${resolvedVideoPath}`, hint: "Di Step 1 klik Pilih File → file akan otomatis upload ke temp/uploads" });
  }
  let subtitlePath: string | null = null;
  try {
    // Selalu simpan di CLIP_DIR biar tidak tabrakan dan otomatis bisa diakses via /temp/clips, nama sudah include timestamp+time+segmen dari frontend
    let outputPath = path.join(CLIP_DIR, outputName || `cut_${Date.now()}.mp4`);
    const captionTitle = String(title || "Context Slicer").trim();
    const fallbackCaption = `Di bagian ini, ${captionTitle.toLowerCase()} dibahas dari ${startTime} sampai ${endTime}.`;
    const finalCaption = cleanCaption(caption, fallbackCaption);
    const captionFile = `${safeFilePart(captionTitle, "clip")}_${safeFilePart(startTime, "00-00")}.md`;
    const captionPath = path.join(CLIP_DIR, captionFile);
    const saveCaption = () => {
      fs.writeFileSync(captionPath, `# ${cleanCaption(captionTitle, "Context Slicer")}\n\nWaktu: ${startTime} – ${endTime}\n\n${finalCaption}\n`);
    };
    const toSec = (t: string) => {
      const p = t.split(":").map(Number);
      if (p.length === 3) return p[0] * 3600 + p[1] * 60 + p[2];
      if (p.length === 2) return p[0] * 60 + p[1];
      return Number(t) || 0;
    };
    const sSec = toSec(startTime);
    const eSec = toSec(endTime);
    const duration = eSec - sSec;
    if (!Number.isFinite(sSec) || !Number.isFinite(eSec) || duration <= 0) {
      return res.status(400).json({ error: `Rentang waktu tidak valid: ${startTime} – ${endTime}` });
    }
    const interval = Number(sampleInterval) || 2;
    const useWhisperCaptions = Boolean(burnCaptions && captionEngine === "whisper");
    const subtitleAss = burnCaptions && !useWhisperCaptions ? buildSectionSubtitleAss(subtitleLines, sSec, eSec) : null;
    if (subtitleAss) {
      subtitlePath = path.join(CLIP_DIR, `_sub_${Date.now()}_${Math.random().toString(36).slice(2, 8)}.ass`);
      fs.writeFileSync(subtitlePath, subtitleAss, "utf8");
    }
    const addSubtitleFilter = (videoFilter: string) => subtitlePath
      ? [videoFilter, subtitleFilterForFile(subtitlePath)].filter(Boolean).join(",")
      : videoFilter;
    const finalizeCaptionedOutput = async () => {
      if (!useWhisperCaptions) return outputPath;
      const transcript = await transcribeClipViaPython(outputPath);
      const whisperAss = buildSectionSubtitleAss(transcript.captions, 0, duration);
      if (!whisperAss) throw new Error("Whisper tidak menghasilkan caption yang bisa ditampilkan");
      subtitlePath = path.join(CLIP_DIR, `_whisper_${Date.now()}_${Math.random().toString(36).slice(2, 8)}.ass`);
      fs.writeFileSync(subtitlePath, whisperAss, "utf8");
      const captionedPath = outputPath.replace(/\.mp4$/i, "_captioned.mp4");
      await runFfmpegCommand(ffmpegPath, ["-i", outputPath, "-vf", subtitleFilterForFile(subtitlePath), "-c:v", "libx264", "-preset", "fast", "-crf", "18", "-c:a", "copy", "-y", captionedPath]);
      assertValidVideoOutput(captionedPath);
      try { fs.rmSync(outputPath, { force: true }); } catch {}
      return captionedPath;
    };

    // helper: interpolate x,y,width at time t
    const interp = (t: number) => {
      if (!faceTracks || faceTracks.length === 0) return { x: 0.5, y: 0.5, width: 0.18 };
      const tracks = faceTracks as { time: number; x: number; y: number; width: number }[];
      if (t <= tracks[0].time) return tracks[0];
      if (t >= tracks[tracks.length - 1].time) return tracks[tracks.length - 1];
      for (let i = 0; i < tracks.length - 1; i++) {
        const a = tracks[i], b = tracks[i + 1];
        if (t >= a.time && t <= b.time) {
          const r = (t - a.time) / (b.time - a.time);
          return { x: a.x + (b.x - a.x) * r, y: a.y + (b.y - a.y) * r, width: (a.width||0.18) + ((b.width||0.18)-(a.width||0.18))*r, time: t };
        }
      }
      return { x: 0.5, y: 0.5, width: 0.18, time: t } as any;
    };
    const interpX = (t: number) => interp(t).x;
    const vfFor = (x: number, version: number = 3, segMid: number = 0, y: number = 0.5, width: number = 0.18) => {
      const xf = Math.max(0, Math.min(1, x)).toFixed(3);
      let base = "";
      if (aspectRatio === "9:16") base = `crop=ih*9/16:ih:(in_w-ih*9/16)*${xf}:0,scale=720:1280:flags=lanczos`;
      else if (aspectRatio === "1:1") base = `crop=ih:ih:(in_w-ih)*${xf}:0,scale=720:720:flags=lanczos`;
      else if (aspectRatio === "4:5") base = `crop=ih*4/5:ih:(in_w-ih*4/5)*${xf}:0,scale=720:900:flags=lanczos`;
      else return "scale=1280:720:flags=lanczos";
      const bw = Math.max(0.12, Math.min(0.55, (width || 0.18) * 2.8));
      const bh = bw * 1.35;
      const bx = Math.max(0, Math.min(0.88, x - bw/2));
      const by = Math.max(0.05, Math.min(0.65, y - bh/2));
      const bxS = bx.toFixed(3), byS = by.toFixed(3), bwS = bw.toFixed(3), bhS = bh.toFixed(3);
      if (version === 1) {
        return `${base},drawbox=x=iw*${bxS}:y=ih*${byS}:w=iw*${bwS}:h=ih*${bhS}:color=green:t=4`;
      }
      if (version === 2) {
        const dotX = (x * 0.85 + 0.05).toFixed(3);
        return `${base},drawbox=x=iw*${bxS}:y=ih*${byS}:w=iw*${bwS}:h=ih*${bhS}:color=green:t=4,drawbox=x=iw*${dotX}:y=ih*0.02:w=14:h=14:color=white:t=fill,drawbox=x=iw*${dotX}:y=10:w=16:h=16:color=green:t=2`;
      }
      return base;
    };

    // Decide mode: dynamic segmented if smartCrop + enough tracks + duration > interval
    const useDynamic = !!smartCrop && faceTracks && faceTracks.length >= 2 && aspectRatio !== "original" && aspectRatio !== "16:9" && duration > interval;

    if (!useDynamic) {
      // fallback: single static crop (average or centered) — bbox mengikuti wajah
      let vf = "";
      const avg = (arr: any[]) => {
        if (!arr.length) return { x: 0.5, y: 0.5, w: 0.18 };
        return { x: arr.reduce((a,b)=>a+b.x,0)/arr.length, y: arr.reduce((a,b)=>a+(b.y||0.5),0)/arr.length, w: arr.reduce((a,b)=>a+(b.width||0.18),0)/arr.length };
      };
      if (aspectRatio === "9:16") {
        if (smartCrop && faceTracks && faceTracks.length > 0) {
          const relevant = (faceTracks as any[]).filter((f: any) => f.time >= sSec && f.time <= eSec);
          const {x,y,w} = avg(relevant);
          vf = vfFor(x, ver, (sSec + eSec) / 2, y, w);
        } else vf = vfFor(0.5, ver, (sSec + eSec) / 2, 0.45, 0.18);
      } else if (aspectRatio === "1:1") {
        if (smartCrop && faceTracks?.length) {
          const relevant = (faceTracks as any[]).filter((f: any) => f.time >= sSec && f.time <= eSec);
          const {x,y,w} = avg(relevant);
          vf = vfFor(x, ver, (sSec + eSec) / 2, y, w);
        } else vf = vfFor(0.5, ver, (sSec + eSec) / 2, 0.45, 0.18);
      } else if (aspectRatio === "4:5") {
        if (smartCrop && faceTracks?.length) {
          const relevant = (faceTracks as any[]).filter((f: any) => f.time >= sSec && f.time <= eSec);
          const {x,y,w} = avg(relevant);
          vf = vfFor(x, ver, (sSec + eSec) / 2, y, w);
        } else vf = vfFor(0.5, ver, (sSec + eSec) / 2, 0.45, 0.18);
      }
      vf = addSubtitleFilter(vf);
      const args: string[] = [];
      args.push("-ss", String(sSec), "-i", resolvedVideoPath, "-t", String(Math.max(0.1, duration)));
      if (vf) { args.push("-vf", vf, "-c:a", "aac", "-c:v", "libx264", "-preset", "fast", "-crf", "18"); } else { args.push("-c", "copy"); }
      args.push("-y", outputPath);
      await runFfmpegCommand(ffmpegPath, args);
      assertValidVideoOutput(outputPath);
      outputPath = await finalizeCaptionedOutput();
      saveCaption();
      res.json({ success: true, outputPath, captionPath, caption: finalCaption, aspectRatio, smartCrop: !!smartCrop, mode: "static" });
      return;
    }

    // Version B: per-frame smooth 30fps - coba single-pass dulu (deteksi 0.5s -> interpolasi ke 30fps)
    if (useDynamic) {
      try {
        const xExpr = buildXExpr(faceTracks as any, sSec, eSec);
        if (xExpr && xExpr.length < 8000) {
          let basePerFrame = "";
          if (aspectRatio === "9:16") basePerFrame = `crop=ih*9/16:ih:(in_w-ih*9/16)*(${xExpr}):0,scale=720:1280:flags=lanczos`;
          else if (aspectRatio === "1:1") basePerFrame = `crop=ih:ih:(in_w-ih)*(${xExpr}):0,scale=720:720:flags=lanczos`;
          else if (aspectRatio === "4:5") basePerFrame = `crop=ih*4/5:ih:(in_w-ih*4/5)*(${xExpr}):0,scale=720:900:flags=lanczos`;
          else basePerFrame = "scale=1280:720:flags=lanczos";
          let vfPerFrame = basePerFrame;
          if (ver === 1) {
            const midInfo = interp((sSec+eSec)/2);
            const bw = Math.max(0.12, Math.min(0.55, (midInfo.width||0.18)*2.8)).toFixed(3);
            const bh = (parseFloat(bw)*1.35).toFixed(3);
            vfPerFrame = `${basePerFrame},drawbox=x=(iw-iw*${bw})/2:y=(ih-ih*${bh})/2:w=iw*${bw}:h=ih*${bh}:color=green:t=4`;
          } else if (ver === 2) {
            const midInfo = interp((sSec+eSec)/2);
            const bw = Math.max(0.12, Math.min(0.55, (midInfo.width||0.18)*2.8)).toFixed(3);
            const bh = (parseFloat(bw)*1.35).toFixed(3);
            // V2 titik posisi juga pakai xExpr biar gerak smooth
            vfPerFrame = `${basePerFrame},drawbox=x=(iw-iw*${bw})/2:y=(ih-ih*${bh})/2:w=iw*${bw}:h=ih*${bh}:color=green:t=4,drawbox=x=iw*(${xExpr})*0.85+5:y=10:w=14:h=14:color=white:t=fill`;
          }
          vfPerFrame = addSubtitleFilter(vfPerFrame);
          const argsPerFrame: string[] = [];
          argsPerFrame.push("-ss", String(sSec), "-i", resolvedVideoPath, "-t", String(Math.max(0.1, duration)));
          if (vfPerFrame) argsPerFrame.push("-vf", vfPerFrame, "-c:a", "aac", "-c:v", "libx264", "-preset", "fast", "-crf", "18");
          else argsPerFrame.push("-c", "copy");
          argsPerFrame.push("-y", outputPath);
          await runFfmpegCommand(ffmpegPath, argsPerFrame);
          assertValidVideoOutput(outputPath);
          outputPath = await finalizeCaptionedOutput();
          saveCaption();
          res.json({ success: true, outputPath, captionPath, caption: finalCaption, aspectRatio, smartCrop: true, mode: "per-frame-smooth", interval, version: ver, xExprLen: xExpr.length });
          return;
        }
      } catch (e:any) {
        console.warn("per-frame smooth failed, fallback segmented", e.message.slice(0,300));
      }
    }

    // Fallback Dynamic: cut per interval then concat (segmented)
    const segDir = path.join(CLIP_DIR, `_seg_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`);
    fs.mkdirSync(segDir, { recursive: true });
    const toTime = (sec: number) => {
      const h = Math.floor(sec / 3600); const m = Math.floor((sec % 3600) / 60); const s = sec % 60;
      if (h > 0) return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s.toFixed(3)).padStart(6, "0")}`;
      return `${String(m).padStart(2, "0")}:${String(s.toFixed(3)).padStart(6, "0")}`;
    };
    const segFiles: string[] = [];
    let idx = 0;
    for (let cur = sSec; cur < eSec; cur += interval) {
      const segStart = cur;
      const segEnd = Math.min(cur + interval, eSec);
      const mid = (segStart + segEnd) / 2;
      const { x, y, width } = interp(mid);
      const vf = addSubtitleFilter(vfFor(x, ver, mid, y, width));
      const segPath = path.join(segDir, `seg_${String(idx).padStart(3, "0")}.mp4`);
      const args: string[] = [];
      args.push("-ss", toTime(segStart), "-i", resolvedVideoPath, "-t", String(Math.max(0.1, segEnd - segStart)));
      if (vf) args.push("-vf", vf, "-c:a", "aac", "-c:v", "libx264", "-preset", "fast", "-crf", "18");
      else args.push("-c", "copy");
      args.push("-y", segPath);
      try {
        await runFfmpegCommand(ffmpegPath, args);
      } catch (err: any) {
        if (ver === 2 && String(err.message).toLowerCase().includes("drawtext")) {
          const vf1 = addSubtitleFilter(vfFor(x, 1, mid, y, width));
          const args1 = ["-ss", toTime(segStart), "-i", resolvedVideoPath, "-t", String(Math.max(0.1, segEnd - segStart)), "-vf", vf1, "-c:a", "aac", "-c:v", "libx264", "-preset", "fast", "-crf", "18", "-y", segPath];
          await runFfmpegCommand(ffmpegPath, args1);
        } else throw err;
      }
      segFiles.push(segPath);
      idx++;
    }
    // concat list
    const listPath = path.join(segDir, "list.txt");
    fs.writeFileSync(listPath, segFiles.map((f) => `file '${f.replace(/'/g, "'\\''")}'`).join("\n"));
    // Try concat with re-encode (robust for differing timestamps)
    await runFfmpegCommand(ffmpegPath, ["-f", "concat", "-safe", "0", "-i", listPath, "-c:v", "libx264", "-preset", "fast", "-crf", "18", "-c:a", "aac", "-y", outputPath]);
    assertValidVideoOutput(outputPath);
    outputPath = await finalizeCaptionedOutput();
    // cleanup
    try { fs.rmSync(segDir, { recursive: true, force: true }); } catch {}
    saveCaption();
    res.json({ success: true, outputPath, captionPath, caption: finalCaption, aspectRatio, smartCrop: true, mode: "dynamic", segments: segFiles.length, interval, version: ver });
  } catch (e: any) {
    const hint = subtitlePath && /No such filter: '?(subtitles|ass)|libass/i.test(String(e.message))
      ? "FFmpeg di komputer ini belum memiliki filter subtitles/libass. Instal full build FFmpeg yang menyertakan libass."
      : undefined;
    res.status(500).json({ error: e.message, hint });
  } finally {
    if (subtitlePath) {
      try { fs.rmSync(subtitlePath, { force: true }); } catch {}
    }
  }
});

// Dynamic segment approach keeps face centered, updates every sampleInterval (default 2s) — for 25s clip => 13 segments.

app.post("/api/cleaner/process", async (req, res) => {
  const { ffmpegPath, videoPath, color, similarity, blend } = req.body;
  if (!videoPath) return res.status(400).json({ error: "Missing video path" });
  const timestamp = Date.now();
  const webmPath = path.join(path.dirname(videoPath), `purified_${timestamp}.webm`);
  const finalMp4Path = path.join(path.dirname(videoPath), `purified_${timestamp}.mp4`);
  try {
    const colorMap: Record<string, string> = { white: "0xFFFFFF", black: "0x000000", green: "0x00FF00", blue: "0x0000FF" };
    const targetColor = colorMap[color as string] || (color as string);
    const colorKeyFilter = `colorkey=${targetColor}:${similarity || 0.1}:${blend || 0.1}`;
    const fp = ffmpegPath || process.env.FFMPEG_PATH || "";
    await runFfmpegCommand(fp, ["-i", videoPath, "-vf", colorKeyFilter, "-c:v", "libvpx-vp9", "-pix_fmt", "yuva420p", "-y", webmPath]);
    await runFfmpegCommand(fp, ["-i", webmPath, "-c:v", "libx264", "-pix_fmt", "yuv420p", "-y", finalMp4Path]);
    res.json({ success: true, webmPath, outputPath: finalMp4Path });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.post("/api/video/info", async (req, res) => {
  const { videoPath } = req.body;
  if (!videoPath) return res.status(400).json({ error: "Missing videoPath" });
  try {
    const fp = process.env.FFMPEG_PATH || "ffprobe";
    // try ffprobe via spawn
    const out = await new Promise<string>((resolve, reject) => {
      const proc = spawn("ffprobe", ["-v", "quiet", "-print_format", "json", "-show_format", "-show_streams", videoPath]);
      let s = "";
      proc.stdout.on("data", (d) => (s += d.toString()));
      proc.stderr.on("data", () => {});
      proc.on("close", (c) => (c === 0 ? resolve(s) : reject(new Error(`ffprobe exit ${c}`))));
      proc.on("error", reject);
    });
    res.json(JSON.parse(out));
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({ server: { middlewareMode: true }, appType: "spa" });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => res.sendFile(path.join(distPath, "index.html")));
  }
  app.listen(PORT, "0.0.0.0", () => console.log(`Server running on http://localhost:${PORT} model=${GEMINI_MODEL}`));
}
startServer();
