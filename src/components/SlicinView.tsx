import React, { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  Check,
  ChevronLeft,
  ChevronRight,
  ClipboardPaste,
  Cpu,

  Download,
  Eye,
  Gamepad2,
  Loader2,
  Mic2,
  Play,
  Scissors,
  Sparkles,
  Upload,
  Video,
} from "lucide-react";
import { cn } from "../lib/utils";
import { parseObsidianMarkdown, TranscriptLine } from "../lib/obsidianParser";
import { detectFacesInVideo, FaceTrack } from "../lib/faceTracking";
import { useApiKey } from "../context/ApiKeyContext";

interface Clip {
  id: string;
  startTime: string;
  endTime: string;
  title?: string;
  summary?: string;
  reason?: string;
  context?: string;
  caption?: string;
  viralPotential?: number;
}

type Aspect = "9:16" | "1:1" | "4:5" | "original";

const STEPS = [
  { id: 1, label: "Input", desc: "Paste + upload" },
  { id: 2, label: "Analyze", desc: "Find best clips" },
  { id: 3, label: "Export", desc: "Cut + download" },
];

function secondsToTime(value: number) {
  const minutes = Math.floor(value / 60);
  const seconds = Math.floor(value % 60);
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

export const SlicinView = () => {
  const { effectiveApiKey } = useApiKey();
  const [step, setStep] = useState(1);
  const [obsidianText, setObsidianText] = useState("");
  const [transcript, setTranscript] = useState<TranscriptLine[]>([]);
  const [videoPath, setVideoPath] = useState("");
  const [videoUrl, setVideoUrl] = useState("");
  const [videoName, setVideoName] = useState("");
  const [mode, setMode] = useState<"podcast" | "gaming">("podcast");
  const [clips, setClips] = useState<Clip[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [aspect, setAspect] = useState<Aspect>("9:16");
  const [smartCrop, setSmartCrop] = useState(true);
  const [burnCaptions, setBurnCaptions] = useState(true);
  const [sampleInterval, setSampleInterval] = useState(0.5);
  const [tracks, setTracks] = useState<FaceTrack[]>([]);
  const [exports, setExports] = useState<Record<string, string>>({});
  const [captionFiles, setCaptionFiles] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<"upload" | "analyze" | "track" | string | null>(null);
  const [progress, setProgress] = useState(0);
  const [message, setMessage] = useState<{ type: "error" | "info" | "success"; text: string } | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => () => {
    if (videoUrl.startsWith("blob:")) URL.revokeObjectURL(videoUrl);
  }, [videoUrl]);

  const showError = (text: string) => setMessage({ type: "error", text });

  const parseSource = () => {
    const lines = parseObsidianMarkdown(obsidianText);
    if (!lines.length) {
      showError("Timestamp belum ditemukan. Paste baris seperti **0:03** · kalimat atau [0:03] kalimat.");
      return false;
    }
    setTranscript(lines);
    setMessage({ type: "success", text: `${lines.length} baris transcript terbaca.` });
    return true;
  };

  const loadExample = async () => {
    try {
      const response = await fetch("/src/example_obsidian/obs.md");
      setObsidianText(await response.text());
      setMessage({ type: "info", text: "Contoh dimuat. Klik Parse transcript untuk memeriksa hasilnya." });
    } catch {
      showError("Contoh Obsidian tidak bisa dimuat.");
    }
  };

  const handleVideoChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("video/")) {
      showError("Pilih file video yang valid.");
      return;
    }
    if (videoUrl.startsWith("blob:")) URL.revokeObjectURL(videoUrl);
    setVideoName(file.name);
    setVideoUrl(URL.createObjectURL(file));
    setVideoPath("");
    setBusy("upload");
    setMessage({ type: "info", text: "Mengupload video ke server agar bisa dipotong..." });
    try {
      const form = new FormData();
      form.append("file", file);
      const response = await fetch("/api/upload-video", { method: "POST", body: form });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Upload gagal");
      setVideoPath(data.videoPath);
      setMessage({ type: "success", text: `${file.name} siap diproses.` });
    } catch (error: any) {
      showError(`Upload gagal: ${error.message}`);
    } finally {
      setBusy(null);
    }
  };

  const analyze = async () => {
    let sourceLines = transcript;
    if (!sourceLines.length) {
      sourceLines = parseObsidianMarkdown(obsidianText);
      if (!sourceLines.length) {
        showError("Timestamp belum ditemukan. Paste baris seperti **0:03** · kalimat atau [0:03] kalimat.");
        return;
      }
      setTranscript(sourceLines);
    }
    if (!videoPath) {
      showError("Upload video dulu sebelum Analyze.");
      return;
    }
    setBusy("analyze");
    setMessage(null);
    try {
      const response = await fetch("/api/slicin/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ transcript: sourceLines, videoPath, mode, apiKey: effectiveApiKey }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Analyze gagal");
      const nextClips = data.clips || [];
      setClips(nextClips);
      setSelectedIds(new Set(nextClips.map((clip: Clip) => clip.id)));
      setStep(2);
      setMessage({ type: "success", text: `${nextClips.length} kandidat clip ditemukan. Pilih yang mau diekspor.` });
    } catch (error: any) {
      showError(error.message);
    } finally {
      setBusy(null);
    }
  };

  const detectFaces = async () => {
    const video = videoRef.current;
    if (!video || !videoUrl) {
      showError("Video belum siap dipreview.");
      return;
    }
    setBusy("track");
    setProgress(0);
    try {
      const nextTracks = await detectFacesInVideo(video, sampleInterval, setProgress);
      setTracks(nextTracks);
      if (!nextTracks.length) showError("Wajah tidak terdeteksi. Export tetap bisa dilakukan dengan crop tengah.");
      else setMessage({ type: "success", text: `${nextTracks.length} titik wajah terdeteksi.` });
    } catch (error: any) {
      showError(`Deteksi wajah gagal: ${error.message}`);
    } finally {
      setBusy(null);
    }
  };

  const exportClip = async (clip: Clip) => {
    if (!videoPath) {
      showError("Video belum diupload.");
      return;
    }
    const key = `${clip.id}-${aspect}`;
    setBusy(key);
    try {
      const response = await fetch("/api/slicin/cut", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          videoPath,
          startTime: clip.startTime,
          endTime: clip.endTime,
          title: clip.title || clip.context || clip.id,
          caption: clip.caption || "",
          outputName: `vexo_${Date.now()}_${clip.id}_${aspect.replace(":", "x")}.mp4`,
          aspectRatio: aspect,
          smartCrop: smartCrop && aspect !== "original",
          burnCaptions,
          captionEngine: "whisper",
          subtitleLines: transcript,
          faceTracks: smartCrop ? tracks : [],
          sampleInterval,
          version: 3,
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Export gagal");
      setExports((current) => ({ ...current, [key]: data.outputPath }));
      setCaptionFiles((current) => ({ ...current, [key]: data.captionPath }));
      setMessage({ type: "success", text: `${clip.title || clip.id} berhasil diekspor.` });
    } catch (error: any) {
      showError(error.message);
    } finally {
      setBusy(null);
    }
  };

  const exportSelected = async () => {
    for (const clip of clips.filter((item) => selectedIds.has(item.id))) await exportClip(clip);
  };

  const toggle = (id: string) => setSelectedIds((current) => {
    const next = new Set(current);
    next.has(id) ? next.delete(id) : next.add(id);
    return next;
  });

  const canInput = transcript.length > 0 && !!videoPath;
  const canAnalyze = clips.length > 0;

  return (
    <div className="max-w-5xl mx-auto px-6 lg:px-8 py-8 space-y-6 pb-24">
      <header className="border-b border-white/5 pb-6">
        <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-yellow-400/10 border border-yellow-400/20 rounded-full">
          <Sparkles size={14} className="text-yellow-400" />
          <span className="text-[10px] font-black uppercase tracking-[0.25em] text-yellow-400">Context Slicer</span>
        </div>
        <h1 className="text-4xl font-black tracking-tighter uppercase mt-4">Paste. <span className="text-yellow-400">Analyze.</span> Export.</h1>
        <p className="text-sm text-white/60 mt-2 max-w-2xl">Alur khusus workflow kamu: copy-paste hasil Obsidian Web Clipper, upload video yang sudah didownload, pilih clip, lalu export ke format short-form.</p>
      </header>

      <div className="glass-card p-3 flex gap-2">
        {STEPS.map((item) => {
          const enabled = item.id === 1 || (item.id === 2 && canInput) || (item.id === 3 && canAnalyze);
          return <button key={item.id} disabled={!enabled} onClick={() => setStep(item.id)} className={cn("flex-1 flex items-center gap-3 p-3 rounded-xl border text-left transition disabled:opacity-30", step === item.id ? "bg-yellow-400 text-black border-yellow-400" : "border-white/10 text-white/60 hover:bg-white/5")}>
            <span className={cn("w-8 h-8 rounded-full flex items-center justify-center text-xs font-black", step === item.id ? "bg-black text-yellow-400" : "bg-white/10")}>{item.id}</span>
            <span className="hidden sm:block"><span className="block text-xs font-black uppercase">{item.label}</span><span className="text-[11px] opacity-70">{item.desc}</span></span>
          </button>;
        })}
      </div>

      {message && <div className={cn("p-3 rounded-xl text-sm border", message.type === "error" ? "bg-red-500/10 border-red-500/20 text-red-300" : message.type === "success" ? "bg-green-500/10 border-green-500/20 text-green-300" : "bg-blue-500/10 border-blue-500/20 text-blue-200")}>{message.text}</div>}

      <div className="glass-card p-6 min-h-[520px]">
        <AnimatePresence mode="wait">
          {step === 1 && <motion.div key="input" initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -16 }} className="space-y-6">
            <div><h2 className="font-black uppercase flex items-center gap-2"><ClipboardPaste className="text-yellow-400" size={20} /> 1. Masukkan sumber</h2><p className="text-sm text-white/50 mt-1">Tidak perlu URL YouTube atau path server. Cukup dua input di bawah.</p></div>
            <section className="p-4 bg-black/30 rounded-2xl border border-white/5 space-y-3">
              <div className="flex items-center justify-between"><label className="text-xs font-black uppercase">Transcript dari Obsidian Web Clipper</label><button onClick={loadExample} className="text-[10px] text-yellow-400 hover:underline">Load contoh</button></div>
              <textarea value={obsidianText} onChange={(event) => setObsidianText(event.target.value)} placeholder="Paste isi hasil Web Clipper di sini...\nContoh: **0:03** · Ini kalimat pertama" className="w-full h-48 bg-black/40 border border-white/10 rounded-xl p-4 text-xs font-mono outline-none focus:border-yellow-400/50" />
              <div className="flex items-center justify-between gap-3"><span className="text-xs text-white/40">{transcript.length ? `${transcript.length} baris sudah terbaca` : "Belum diparse"}</span><button onClick={parseSource} disabled={!obsidianText.trim()} className="px-4 py-2.5 bg-white/10 rounded-xl text-xs font-black uppercase disabled:opacity-30">Parse transcript</button></div>
            </section>
            <section className="p-4 bg-black/30 rounded-2xl border border-white/5 space-y-3">
              <label className="text-xs font-black uppercase flex items-center gap-2"><Video className="text-yellow-400" size={16} /> Video yang sudah didownload</label>
              <input ref={fileInputRef} type="file" accept="video/*" onChange={handleVideoChange} className="hidden" />
              <button onClick={() => fileInputRef.current?.click()} disabled={busy === "upload"} className="w-full min-h-28 border-2 border-dashed border-white/10 rounded-2xl flex flex-col items-center justify-center gap-2 hover:border-yellow-400/50 transition disabled:opacity-50"><Upload size={24} className="text-yellow-400" /><span className="text-xs font-black uppercase">{busy === "upload" ? "Uploading..." : videoName || "Pilih file video"}</span><span className="text-[11px] text-white/40">MP4, MOV, WebM • file diproses di server lokal</span></button>
              {videoUrl && <video src={videoUrl} controls muted playsInline className="w-full max-h-56 rounded-xl bg-black object-contain" />}
            </section>
            <div className="flex justify-end"><button onClick={() => setStep(2)} disabled={!canInput} className="px-6 py-3 bg-yellow-400 text-black rounded-xl text-xs font-black uppercase flex items-center gap-2 disabled:opacity-30">Lanjut Analyze <ChevronRight size={16} /></button></div>
          </motion.div>}

          {step === 2 && <motion.div key="analyze" initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -16 }} className="space-y-6">
            <div><h2 className="font-black uppercase flex items-center gap-2"><Cpu className="text-yellow-400" size={20} /> 2. Cari kandidat clip</h2><p className="text-sm text-white/50 mt-1">Gemini hanya menganalisis transcript yang kamu paste. Tidak ada download otomatis.</p></div>
            <div className="grid grid-cols-2 gap-3"><button onClick={() => setMode("podcast")} className={cn("p-4 rounded-2xl border flex items-center justify-center gap-2 text-xs font-black uppercase", mode === "podcast" ? "bg-yellow-400/10 border-yellow-400 text-yellow-400" : "border-white/10 text-white/50")}><Mic2 size={18} /> Podcast</button><button onClick={() => setMode("gaming")} className={cn("p-4 rounded-2xl border flex items-center justify-center gap-2 text-xs font-black uppercase", mode === "gaming" ? "bg-yellow-400/10 border-yellow-400 text-yellow-400" : "border-white/10 text-white/50")}><Gamepad2 size={18} /> Gaming</button></div>
            <div className="p-4 bg-black/30 rounded-2xl text-xs font-mono text-white/50 max-h-52 overflow-auto">{transcript.slice(0, 14).map((line, index) => <div key={index}>[{secondsToTime(line.start)}] {line.text}</div>)}{transcript.length > 14 && <div className="text-yellow-400">... +{transcript.length - 14} baris</div>}</div>
            <button onClick={analyze} disabled={busy === "analyze" || !canInput} className="w-full py-4 bg-yellow-400 text-black rounded-2xl font-black uppercase flex justify-center items-center gap-2 disabled:opacity-30">{busy === "analyze" ? <Loader2 className="animate-spin" /> : <Cpu size={18} />} {busy === "analyze" ? "Gemini sedang menganalisis..." : "Analyze transcript"}</button>
            {clips.length > 0 && <div className="space-y-3"><div className="flex justify-between items-center"><h3 className="font-black uppercase text-sm">Kandidat ({clips.length})</h3><button onClick={() => setSelectedIds(new Set(clips.map((clip) => clip.id)))} className="text-xs text-yellow-400">Pilih semua</button></div>{clips.map((clip) => <button key={clip.id} onClick={() => toggle(clip.id)} className={cn("w-full text-left p-3 rounded-2xl border-2", selectedIds.has(clip.id) ? "bg-yellow-400/10 border-yellow-400" : "bg-white/[0.02] border-white/5")}><div className="flex gap-2 items-center"><span className="text-[11px] font-mono bg-white/10 px-2 py-1 rounded">{clip.startTime} – {clip.endTime}</span>{clip.viralPotential !== undefined && <span className="text-[11px] text-yellow-400">{clip.viralPotential}%</span>}{selectedIds.has(clip.id) && <Check size={14} className="text-yellow-400" />}</div><div className="font-bold text-sm mt-1">{clip.title || clip.context || "Untitled"}</div><div className="text-xs text-white/50">{clip.summary}</div></button>)}</div>}
            <div className="flex justify-between"><button onClick={() => setStep(1)} className="px-5 py-3 bg-white/10 rounded-xl text-xs font-black uppercase flex items-center gap-2"><ChevronLeft size={16} /> Kembali</button><button onClick={() => setStep(3)} disabled={!canAnalyze} className="px-6 py-3 bg-yellow-400 text-black rounded-xl text-xs font-black uppercase flex items-center gap-2 disabled:opacity-30">Lanjut Export <ChevronRight size={16} /></button></div>
          </motion.div>}

          {step === 3 && <motion.div key="export" initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -16 }} className="space-y-6">
            <div><h2 className="font-black uppercase flex items-center gap-2"><Scissors className="text-yellow-400" size={20} /> 3. Export clip terpilih</h2><p className="text-sm text-white/50 mt-1">Export langsung dari video sumber. Tidak ada langkah “Cut Original” terpisah.</p></div>
            <div className="grid grid-cols-4 gap-2">{(["9:16", "1:1", "4:5", "original"] as Aspect[]).map((item) => <button key={item} onClick={() => setAspect(item)} className={cn("py-3 rounded-xl border text-xs font-black", aspect === item ? "bg-yellow-400 text-black border-yellow-400" : "bg-white/5 border-white/10 text-white/60")}>{item}</button>)}</div>
            <label className="flex items-center gap-3 p-4 bg-white/[0.03] rounded-2xl border border-white/10 cursor-pointer"><input type="checkbox" checked={burnCaptions} onChange={(event) => setBurnCaptions(event.target.checked)} className="accent-yellow-400 w-4 h-4" /><div><div className="text-sm font-bold">Caption sinkron Whisper Medium</div><div className="text-xs text-white/50">Video dipotong dulu, lalu Whisper Medium membuat caption pendek dari word timestamps sebelum export final. Export pertama mengunduh model dan dapat memerlukan beberapa menit di CPU.</div></div></label>
            {aspect !== "original" && <div className="p-4 bg-white/[0.03] rounded-2xl border border-white/10 space-y-3"><label className="flex items-center gap-3 text-sm font-bold"><input type="checkbox" checked={smartCrop} onChange={(event) => setSmartCrop(event.target.checked)} className="accent-yellow-400 w-4 h-4" /> Face-follow crop</label>{smartCrop && <><div className="flex justify-between text-xs text-white/50"><span>Sampling gerakan</span><span className="text-yellow-400">{sampleInterval}s</span></div><input type="range" min={0.2} max={1} step={0.1} value={sampleInterval} onChange={(event) => setSampleInterval(Number(event.target.value))} className="w-full accent-yellow-400" /><button onClick={detectFaces} disabled={busy === "track"} className="w-full py-2.5 bg-white/10 rounded-xl text-xs font-black uppercase flex justify-center gap-2">{busy === "track" ? <Loader2 className="animate-spin" size={14} /> : <Eye size={14} />} {busy === "track" ? `Detecting ${progress}%` : tracks.length ? `${tracks.length} titik terdeteksi • Detect ulang` : "Detect wajah (opsional)"}</button></>}</div>}
            <button onClick={exportSelected} disabled={!selectedIds.size || !!busy} className="w-full py-4 bg-yellow-400 text-black rounded-2xl font-black uppercase flex justify-center gap-2 disabled:opacity-30"><Download size={18} /> Export {selectedIds.size} clip</button>
            <div className="space-y-3">{clips.filter((clip) => selectedIds.has(clip.id)).map((clip) => { const key = `${clip.id}-${aspect}`; return <div key={clip.id} className="p-4 rounded-2xl border border-white/10 bg-white/[0.03] flex items-center justify-between gap-3"><div><div className="font-bold text-sm">{clip.title || clip.context}</div><div className="text-xs font-mono text-white/50">{clip.startTime} – {clip.endTime}</div>{exports[key] && <div className="text-[11px] text-green-400 break-all mt-1">✓ Video: {exports[key]}</div>}{captionFiles[key] && <div className="text-[11px] text-blue-300 break-all mt-1">✓ Caption: {captionFiles[key]}</div>}</div><button onClick={() => exportClip(clip)} disabled={busy === key} className="shrink-0 px-3 py-2 bg-white/10 rounded-xl text-xs font-black flex items-center gap-2">{busy === key ? <Loader2 className="animate-spin" size={14} /> : <Play size={14} />} Export</button></div>; })}</div>
            <div className="flex justify-between"><button onClick={() => setStep(2)} className="px-5 py-3 bg-white/10 rounded-xl text-xs font-black uppercase flex items-center gap-2"><ChevronLeft size={16} /> Kembali</button><button onClick={() => { setStep(1); setClips([]); setTranscript([]); setTracks([]); setExports({}); setCaptionFiles({}); }} className="px-5 py-3 bg-white/5 border border-white/10 rounded-xl text-xs font-black uppercase">Mulai baru</button></div>
          </motion.div>}
        </AnimatePresence>
      </div>
    </div>
  );
};
