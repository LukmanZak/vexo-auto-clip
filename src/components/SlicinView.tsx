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
  GraduationCap,
  Link2,
  Loader2,
  Mic2,
  Play,
  Scissors,
  Sparkles,
  Upload,
  Video,
} from "lucide-react";
import { cn } from "../lib/utils";
import { SLICIN_MODE_OPTIONS, type SlicinMode } from "../lib/slicinPrompt";
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
  transcript_snippet?: string;
  caption?: string;
  viralPotential?: number;
  category?: "comedy" | "mystery" | "education";
}

type PodcastCategory = NonNullable<Clip["category"]>;
const PODCAST_CATEGORY_OPTIONS: { id: PodcastCategory; label: string; hint: string }[] = [
  { id: "comedy", label: "Comedy", hint: "setup, punchline, reaksi" },
  { id: "mystery", label: "Mystery", hint: "pertanyaan, mitos, reveal" },
  { id: "education", label: "Edukasi", hint: "penjelasan utuh" },
];

type Aspect = "9:16" | "1:1" | "4:5" | "original";
type DownloadQuality = "best" | "1080" | "720";
type WhisperModelChoice = "small" | "medium";

const REQUEST_TIMEOUT_MS = 15 * 60 * 1000;

async function fetchJsonWithTimeout(input: RequestInfo | URL, init: RequestInit = {}, timeoutMs = REQUEST_TIMEOUT_MS) {
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(input, { ...init, signal: controller.signal });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || `Request gagal (${response.status})`);
    return data;
  } catch (error: any) {
    if (error?.name === "AbortError") throw new Error("Proses melewati batas waktu 15 menit. Coba export clip ini lagi atau matikan caption Whisper.");
    throw error;
  } finally {
    window.clearTimeout(timeout);
  }
}

const STEPS = [
  { id: 1, label: "Input", desc: "Paste + URL YouTube" },
  { id: 2, label: "Analyze", desc: "Find best clips" },
  { id: 3, label: "Export", desc: "Cut + download" },
];

function secondsToTime(value: number) {
  const safe = Math.max(0, Math.floor(value));
  const hours = Math.floor(safe / 3600);
  const minutes = Math.floor((safe % 3600) / 60);
  const seconds = safe % 60;
  return hours > 0
    ? `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`
    : `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

function parseClipTime(value: string) {
  const parts = value.split(":").map(Number);
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
  if (parts.length === 2) return parts[0] * 60 + parts[1];
  return Number(value) || 0;
}

function clipDuration(clip: Clip) {
  return Math.max(0.1, parseClipTime(clip.endTime) - parseClipTime(clip.startTime));
}

function durationForApi(seconds: number) {
  return secondsToTime(seconds);
}

function parseEditableTime(value: string): number | null {
  const raw = value.trim();
  if (!/^(\d{1,3}:\d{2}|\d{1,2}:\d{2}:\d{2})$/.test(raw)) return null;
  const parts = raw.split(":").map(Number);
  if (parts.some((part) => !Number.isFinite(part)) || parts.slice(1).some((part) => part >= 60)) return null;
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
  return parts[0] * 60 + parts[1];
}

type ClipBoundary = "start" | "end";

function timelineTickValues(duration: number): number[] {
  const steps = [1, 5, 10, 15, 30, 60, 120, 300, 600, 900, 1800, 3600, 7200, 14400];
  const step = steps.find((candidate) => duration / candidate <= 8) || Math.ceil(duration / 8 / 3600) * 3600;
  const ticks: number[] = [];
  for (let tick = 0; tick < duration && ticks.length < 9; tick += step) ticks.push(tick);
  if (!ticks.length || ticks[ticks.length - 1] !== duration) ticks.push(duration);
  return ticks;
}

function TimelineOverview({
  clips,
  duration,
  activeClipId,
  currentTime,
  onSelect,
}: {
  clips: Clip[];
  duration: number;
  activeClipId: string;
  currentTime: number;
  onSelect: (clip: Clip) => void;
}) {
  const ticks = timelineTickValues(duration);
  return <section className="rounded-2xl border border-white/10 bg-black/30 p-4 space-y-3">
    <div className="flex flex-wrap items-center justify-between gap-2">
      <div><h3 className="text-xs font-black uppercase text-white">Overview timeline</h3><p className="text-[11px] text-white/40 mt-1">Semua potongan terpilih pada durasi video sumber.</p></div>
      <span className="text-[11px] font-mono text-yellow-300">Durasi {secondsToTime(duration)}</span>
    </div>
    <div className="pl-[7.5rem] pr-1">
      <div className="relative h-5 text-[9px] font-mono text-white/40">
        {ticks.map((tick, index) => <span key={`${tick}-${index}`} className="absolute -translate-x-1/2" style={{ left: `${(tick / duration) * 100}%` }}>{secondsToTime(tick)}</span>)}
      </div>
      <div className="max-h-64 space-y-2 overflow-y-auto pr-1">
        {clips.map((clip) => {
          const start = Math.max(0, Math.min(duration, parseClipTime(clip.startTime)));
          const end = Math.max(start, Math.min(duration, parseClipTime(clip.endTime)));
          const left = (start / duration) * 100;
          const width = Math.min(100 - left, Math.max(0.8, ((end - start) / duration) * 100));
          const playhead = Math.max(0, Math.min(duration, currentTime));
          const isActive = clip.id === activeClipId;
          return <div key={clip.id} className="flex items-center gap-3">
            <button type="button" onClick={() => onSelect(clip)} className={cn("w-28 shrink-0 truncate text-left text-[10px] font-bold", isActive ? "text-yellow-300" : "text-white/50")} title={clip.title || clip.id}>{clip.title || clip.id}</button>
            <button type="button" onClick={() => onSelect(clip)} aria-label={`Pilih ${clip.title || clip.id}, ${clip.startTime} sampai ${clip.endTime}`} className="relative h-8 flex-1 overflow-hidden rounded-lg border border-white/10 bg-white/[0.03] text-left">
              {ticks.map((tick, index) => <span key={`${tick}-${index}`} className="absolute inset-y-0 border-l border-white/[0.07]" style={{ left: `${(tick / duration) * 100}%` }} />)}
              <span className={cn("absolute inset-y-1 rounded-md border transition-colors", isActive ? "border-yellow-200 bg-yellow-400/70" : "border-yellow-400/40 bg-yellow-400/25")} style={{ left: `${left}%`, width: `${width}%`, minWidth: "0.5rem" }} />
              {playhead > 0 && <span className="absolute inset-y-0 z-10 border-l-2 border-white/80" style={{ left: `${(playhead / duration) * 100}%` }} />}
            </button>
            <span className="hidden w-32 shrink-0 text-right font-mono text-[9px] text-white/45 sm:block">{clip.startTime}–{clip.endTime}</span>
          </div>;
        })}
      </div>
    </div>
  </section>;
}

function FocusedClipTimeline({
  clip,
  duration,
  currentTime,
  disabled,
  onChangeBoundary,
}: {
  clip: Clip;
  duration: number;
  currentTime: number;
  disabled: boolean;
  onChangeBoundary: (boundary: ClipBoundary, seconds: number) => boolean;
}) {
  const trackRef = useRef<HTMLDivElement>(null);
  const draggingBoundaryRef = useRef<ClipBoundary | null>(null);
  const dragViewRef = useRef<{ start: number; end: number } | null>(null);
  const [dragView, setDragView] = useState<{ start: number; end: number } | null>(null);
  const start = parseClipTime(clip.startTime);
  const end = parseClipTime(clip.endTime);
  const padding = Math.max(15, Math.min(300, (end - start) * 0.75));
  const viewStart = dragView?.start ?? Math.max(0, start - padding);
  const viewEnd = dragView?.end ?? Math.min(duration, end + padding);
  const viewSpan = Math.max(1, viewEnd - viewStart);
  const startPosition = ((start - viewStart) / viewSpan) * 100;
  const endPosition = ((end - viewStart) / viewSpan) * 100;
  const playheadInView = currentTime >= viewStart && currentTime <= viewEnd;
  const playheadPosition = ((currentTime - viewStart) / viewSpan) * 100;

  const moveBoundary = (event: React.PointerEvent<HTMLButtonElement>) => {
    const boundary = draggingBoundaryRef.current;
    const track = trackRef.current;
    if (!boundary || !track || disabled) return;
    const dragScale = dragViewRef.current;
    if (!dragScale) return;
    const rect = track.getBoundingClientRect();
    const progress = Math.max(0, Math.min(1, (event.clientX - rect.left) / rect.width));
    const requested = Math.round(dragScale.start + progress * (dragScale.end - dragScale.start));
    const safe = boundary === "start"
      ? Math.max(0, Math.min(end - 1, requested))
      : Math.min(Math.floor(duration), Math.max(start + 1, requested));
    onChangeBoundary(boundary, safe);
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLButtonElement>, boundary: ClipBoundary) => {
    if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
    event.preventDefault();
    const amount = event.shiftKey ? 5 : 1;
    const current = boundary === "start" ? start : end;
    const next = current + (event.key === "ArrowRight" ? amount : -amount);
    const safe = boundary === "start" ? Math.max(0, Math.min(end - 1, next)) : Math.min(Math.floor(duration), Math.max(start + 1, next));
    onChangeBoundary(boundary, safe);
  };

  const handleProps = (boundary: ClipBoundary) => ({
    type: "button" as const,
    disabled,
    onPointerDown: (event: React.PointerEvent<HTMLButtonElement>) => {
      if (disabled) return;
      draggingBoundaryRef.current = boundary;
      const scale = { start: viewStart, end: viewEnd };
      dragViewRef.current = scale;
      setDragView(scale);
      event.currentTarget.setPointerCapture(event.pointerId);
      event.preventDefault();
    },
    onPointerMove: moveBoundary,
    onPointerUp: () => { draggingBoundaryRef.current = null; dragViewRef.current = null; setDragView(null); },
    onPointerCancel: () => { draggingBoundaryRef.current = null; dragViewRef.current = null; setDragView(null); },
    onKeyDown: (event: React.KeyboardEvent<HTMLButtonElement>) => handleKeyDown(event, boundary),
    className: "absolute top-0 z-20 h-12 w-6 -translate-x-1/2 cursor-ew-resize touch-none rounded-md border-2 border-black bg-yellow-300 shadow-lg shadow-black/40 focus:outline-none focus:ring-2 focus:ring-white disabled:cursor-not-allowed",
    "aria-label": boundary === "start" ? `Geser awal clip, ${clip.startTime}` : `Geser akhir clip, ${clip.endTime}`,
    style: { left: `${boundary === "start" ? startPosition : endPosition}%` },
  });

  return <section className="rounded-2xl border border-yellow-400/20 bg-yellow-400/[0.04] p-4 space-y-3">
    <div className="flex flex-wrap items-center justify-between gap-2"><div><h3 className="text-xs font-black uppercase text-yellow-100">Atur batas potongan</h3><p className="text-[11px] text-white/45 mt-1">Pilih handle lalu geser, atau pakai tombol panah untuk mengatur per detik.</p></div><span className="text-[11px] font-mono text-yellow-300">{secondsToTime(end - start)}</span></div>
    <div className="flex justify-between font-mono text-[10px] text-white/45"><span>{secondsToTime(viewStart)}</span><span>{secondsToTime(viewEnd)}</span></div>
    <div ref={trackRef} className="relative h-12 touch-none rounded-xl border border-white/10 bg-black/50">
      {playheadInView && <span className="absolute inset-y-0 z-10 border-l border-white/50" style={{ left: `${playheadPosition}%` }} />}
      <span className="absolute inset-y-1 rounded-md border border-yellow-200 bg-yellow-400/60" style={{ left: `${startPosition}%`, width: `${Math.max(0, endPosition - startPosition)}%` }} />
      <button {...handleProps("start")} />
      <button {...handleProps("end")} />
    </div>
  </section>;
}

export const SlicinView = () => {
  const { effectiveApiKey } = useApiKey();
  const [step, setStep] = useState(1);
  const [obsidianText, setObsidianText] = useState("");
  const [transcript, setTranscript] = useState<TranscriptLine[]>([]);
  const [videoPath, setVideoPath] = useState("");
  const [videoUrl, setVideoUrl] = useState("");
  const [videoName, setVideoName] = useState("");
  const [sourceDuration, setSourceDuration] = useState<number | null>(null);
  const [currentTime, setCurrentTime] = useState(0);
  const [videoPreviewReady, setVideoPreviewReady] = useState(false);
  const [videoPreviewError, setVideoPreviewError] = useState("");
  const [youtubeUrl, setYoutubeUrl] = useState("");
  const [downloadQuality, setDownloadQuality] = useState<DownloadQuality>("720");
  const [sourceKind, setSourceKind] = useState<"youtube" | "file" | null>(null);
  const [sourceName, setSourceName] = useState("");
  const [sourceUrl, setSourceUrl] = useState("");
  const [mode, setMode] = useState<SlicinMode>("podcast");
  const [podcastCategories, setPodcastCategories] = useState<PodcastCategory[]>([]);
  const [clips, setClips] = useState<Clip[]>([]);
  const [activeClipId, setActiveClipId] = useState("");
  const [timeDrafts, setTimeDrafts] = useState<Record<string, { start: string; end: string }>>({});
  const [rangeError, setRangeError] = useState("");
  const [reviewApproved, setReviewApproved] = useState(false);
  const [analysisWarnings, setAnalysisWarnings] = useState<string[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [aspect, setAspect] = useState<Aspect>("9:16");
  const [smartCrop, setSmartCrop] = useState(true);
  const [burnCaptions, setBurnCaptions] = useState(false);
  const [whisperModel, setWhisperModel] = useState<WhisperModelChoice>("small");
  const [sampleInterval, setSampleInterval] = useState(0.25);
  const [tracks, setTracks] = useState<FaceTrack[]>([]);
  const [rawExports, setRawExports] = useState<Record<string, string>>({});
  const [exports, setExports] = useState<Record<string, string>>({});
  const [exportUrls, setExportUrls] = useState<Record<string, string>>({});
  const [captionFiles, setCaptionFiles] = useState<Record<string, string>>({});
  const [captionUrls, setCaptionUrls] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<"upload" | "download" | "analyze" | "track" | string | null>(null);
  const [downloadProgress, setDownloadProgress] = useState<{ progress: number; status: string; message: string } | null>(null);
  const [progress, setProgress] = useState(0);
  const [renderPhase, setRenderPhase] = useState<{ clipId: string; phase: "preparing" | "countdown" | "tracking" | "rendering"; countdown?: number } | null>(null);
  const [batchProgress, setBatchProgress] = useState<{ current: number; total: number } | null>(null);
  const [message, setMessage] = useState<{ type: "error" | "info" | "success"; text: string } | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const previewEndRef = useRef<number | null>(null);
  const reviewApprovedRef = useRef(false);

  useEffect(() => () => {
    if (videoUrl.startsWith("blob:")) URL.revokeObjectURL(videoUrl);
  }, [videoUrl]);

  const showError = (text: string) => setMessage({ type: "error", text });

  const changeMode = (nextMode: SlicinMode) => {
    setMode(nextMode);
    setPodcastCategories([]);
    setClips([]);
    setActiveClipId("");
    setTimeDrafts({});
    setRangeError("");
    setReviewApproved(false);
    reviewApprovedRef.current = false;
    setSelectedIds(new Set());
    setAnalysisWarnings([]);
  };

  const togglePodcastCategory = (category: PodcastCategory) => {
    setPodcastCategories((current) => current.includes(category) ? current.filter((item) => item !== category) : [...current, category]);
    setClips([]);
    setActiveClipId("");
    setTimeDrafts({});
    setRangeError("");
    setReviewApproved(false);
    reviewApprovedRef.current = false;
    setSelectedIds(new Set());
    setAnalysisWarnings([]);
  };

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

  const downloadVideo = async () => {
    const url = youtubeUrl.trim();
    if (!url) {
      showError("Masukkan URL YouTube terlebih dahulu.");
      return;
    }
    try {
      const parsed = new URL(url);
      const host = parsed.hostname.toLowerCase().replace(/^www\./, "");
      if (!["youtube.com", "m.youtube.com", "youtu.be", "youtube-nocookie.com"].includes(host)) throw new Error("URL harus berasal dari YouTube (youtube.com atau youtu.be).");
    } catch (error: any) {
      showError(error.message || "URL YouTube tidak valid.");
      return;
    }
    if (videoUrl.startsWith("blob:")) URL.revokeObjectURL(videoUrl);
    setVideoName("");
    setSourceKind(null);
    setSourceName("");
    setSourceUrl("");
    setVideoUrl("");
    setVideoPath("");
    setSourceDuration(null);
    setCurrentTime(0);
    setVideoPreviewReady(false);
    setVideoPreviewError("");
    previewEndRef.current = null;
    setActiveClipId("");
    setTimeDrafts({});
    setRangeError("");
    setReviewApproved(false);
    reviewApprovedRef.current = false;
    setClips([]);
    setSelectedIds(new Set());
    setAnalysisWarnings([]);
    setRawExports({});
    setTracks([]);
    setExports({});
    setExportUrls({});
    setCaptionFiles({});
    setCaptionUrls({});
    setBusy("download");
    setDownloadProgress({ progress: 0, status: "queued", message: "Menyiapkan download..." });
    setMessage({ type: "info", text: "Mengunduh video YouTube ke server lokal..." });
    const jobId = `download-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    let progressTimer: number | undefined;
    const pollDownloadProgress = async () => {
      try {
        const response = await fetch(`/api/youtube/download-progress/${encodeURIComponent(jobId)}`);
        if (response.ok) {
          const next = await response.json();
          setDownloadProgress(next);
          if (next.status !== "complete" && next.status !== "error") progressTimer = window.setTimeout(() => void pollDownloadProgress(), 500);
        } else {
          progressTimer = window.setTimeout(() => void pollDownloadProgress(), 700);
        }
      } catch {
        progressTimer = window.setTimeout(() => void pollDownloadProgress(), 1000);
      }
    };
    void pollDownloadProgress();
    try {
      const data = await fetchJsonWithTimeout("/api/youtube/download", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url, quality: downloadQuality, jobId }),
      });
      setVideoPath(data.videoPath);
      setVideoName(data.filename || `YouTube ${data.videoId || "video"}`);
      setVideoUrl(data.videoUrl || "");
      setSourceKind("youtube");
      setSourceName(data.sourceName || `YouTube ${data.videoId || "video"}`);
      setSourceUrl(data.sourceUrl || url);
      setDownloadProgress({ progress: 100, status: "complete", message: "Download selesai." });
      setMessage({ type: "success", text: `${data.cached ? "Video sudah ada di cache" : "Video berhasil diunduh"} (${data.quality === "best" ? "terbaik" : `${data.quality}p`}) dan otomatis dipilih.` });
    } catch (error: any) {
      setDownloadProgress({ progress: 0, status: "error", message: error.message || "Download gagal" });
      showError(error.message);
    } finally {
      if (progressTimer) window.clearTimeout(progressTimer);
      setBusy(null);
    }
  };

  const handleVideoChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const looksLikeVideo = file.type.startsWith("video/") || /\.(mp4|mov|webm|mkv|m4v|avi)$/i.test(file.name);
    if (!looksLikeVideo) {
      showError("Pilih file video yang valid.");
      return;
    }
    if (videoUrl.startsWith("blob:")) URL.revokeObjectURL(videoUrl);
    setVideoName(file.name);
    setSourceKind(null);
    setSourceName(file.name);
    setSourceUrl("");
    setDownloadProgress(null);
    setVideoUrl(URL.createObjectURL(file));
    setVideoPath("");
    setSourceDuration(null);
    setCurrentTime(0);
    setVideoPreviewReady(false);
    setVideoPreviewError("");
    previewEndRef.current = null;
    setActiveClipId("");
    setTimeDrafts({});
    setRangeError("");
    setReviewApproved(false);
    reviewApprovedRef.current = false;
    setClips([]);
    setSelectedIds(new Set());
    setAnalysisWarnings([]);
    setRawExports({});
    setTracks([]);
    setExports({});
    setExportUrls({});
    setCaptionFiles({});
    setCaptionUrls({});
    setBusy("upload");
    setMessage({ type: "info", text: "Mengupload file video ke server lokal..." });
    try {
      const form = new FormData();
      form.append("file", file);
      const data = await fetchJsonWithTimeout("/api/upload-video", { method: "POST", body: form });
      setVideoPath(data.videoPath);
      setSourceKind("file");
      setMessage({ type: "success", text: `${file.name} berhasil diupload dan otomatis dipilih sebagai sumber.` });
    } catch (error: any) {
      showError(`Upload file gagal: ${error.message}`);
    } finally {
      setBusy(null);
      event.target.value = "";
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
      showError("Pilih atau upload video terlebih dahulu sebelum Analyze.");
      return;
    }
    if (mode === "podcast" && podcastCategories.length === 0) {
      showError("Pilih minimal satu kategori podcast terlebih dahulu.");
      return;
    }
    setBusy("analyze");
    setMessage(null);
    try {
      const data = await fetchJsonWithTimeout("/api/slicin/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ transcript: sourceLines, videoPath, mode, categories: mode === "podcast" ? podcastCategories : undefined, apiKey: effectiveApiKey }),
      });
      const nextClips = data.clips || [];
      setClips(nextClips);
      setAnalysisWarnings(Array.isArray(data.warnings) ? data.warnings : []);
      setSelectedIds(new Set(nextClips.map((clip: Clip) => clip.id)));
      setActiveClipId(nextClips[0]?.id || "");
      setTimeDrafts(Object.fromEntries(nextClips.map((clip: Clip) => [clip.id, { start: clip.startTime, end: clip.endTime }])));
      setRangeError("");
      setReviewApproved(false);
      reviewApprovedRef.current = false;
      setStep(2);
      setMessage({ type: "success", text: `${nextClips.length} kandidat clip ditemukan. Pilih yang mau diekspor.` });
    } catch (error: any) {
      showError(error.message);
    } finally {
      setBusy(null);
    }
  };

  const clearClipExports = (clipId: string) => {
    const rawKey = `${clipId}-raw`;
    setRawExports((current) => {
      const next = { ...current };
      delete next[rawKey];
      return next;
    });
    setExports((current) => Object.fromEntries(Object.entries(current).filter(([key]) => !key.startsWith(`${clipId}-`))));
    setExportUrls((current) => Object.fromEntries(Object.entries(current).filter(([key]) => !key.startsWith(`${clipId}-`))));
    setCaptionFiles((current) => Object.fromEntries(Object.entries(current).filter(([key]) => !key.startsWith(`${clipId}-`))));
    setCaptionUrls((current) => Object.fromEntries(Object.entries(current).filter(([key]) => !key.startsWith(`${clipId}-`))));
  };

  const updateClipBoundary = (clipId: string, boundary: ClipBoundary, requestedSeconds: number): boolean => {
    if (busy || batchProgress || sourceDuration === null) return false;
    const maxSeconds = Math.floor(sourceDuration);
    if (maxSeconds < 1 || !Number.isFinite(requestedSeconds)) return false;
    const clip = clips.find((item) => item.id === clipId);
    if (!clip) return false;
    const currentStart = parseClipTime(clip.startTime);
    const currentEnd = parseClipTime(clip.endTime);
    const next = Math.round(requestedSeconds);
    const start = boundary === "start" ? next : currentStart;
    const end = boundary === "end" ? next : currentEnd;
    if (start < 0 || end > maxSeconds || end - start < 1) return false;
    if (start === currentStart && end === currentEnd) return true;

    const formattedStart = secondsToTime(start);
    const formattedEnd = secondsToTime(end);
    setClips((current) => current.map((item) => item.id === clipId
      ? { ...item, startTime: formattedStart, endTime: formattedEnd }
      : item));
    setTimeDrafts((current) => ({ ...current, [clipId]: { start: formattedStart, end: formattedEnd } }));
    setRangeError("");
    setReviewApproved(false);
    reviewApprovedRef.current = false;
    previewEndRef.current = null;
    videoRef.current?.pause();
    clearClipExports(clipId);
    return true;
  };

  const commitTimeDraft = (clip: Clip, boundary: ClipBoundary) => {
    const draft = timeDrafts[clip.id]?.[boundary] ?? (boundary === "start" ? clip.startTime : clip.endTime);
    const seconds = parseEditableTime(draft);
    if (seconds === null || !updateClipBoundary(clip.id, boundary, seconds)) {
      setRangeError(`Waktu ${boundary === "start" ? "awal" : "akhir"} harus berada di dalam video dan menyisakan minimal 1 detik untuk clip.`);
      setTimeDrafts((current) => ({
        ...current,
        [clip.id]: {
          start: boundary === "start" ? clip.startTime : current[clip.id]?.start ?? clip.startTime,
          end: boundary === "end" ? clip.endTime : current[clip.id]?.end ?? clip.endTime,
        },
      }));
      return;
    }
  };

  const selectReviewClip = (clip: Clip) => {
    if (busy || batchProgress) return;
    setActiveClipId(clip.id);
    setRangeError("");
    previewEndRef.current = null;
    const start = parseClipTime(clip.startTime);
    const video = videoRef.current;
    if (video && Number.isFinite(video.duration)) {
      video.pause();
      video.currentTime = start;
      setCurrentTime(start);
    }
  };

  const previewReviewClip = (clip: Clip) => {
    if (busy || batchProgress) return;
    const video = videoRef.current;
    if (!video || !Number.isFinite(video.duration)) {
      showError("Video belum siap dipreview. Tunggu sampai video selesai dimuat.");
      return;
    }
    const start = parseClipTime(clip.startTime);
    const end = parseClipTime(clip.endTime);
    previewEndRef.current = end;
    video.currentTime = start;
    setCurrentTime(start);
    void video.play().catch(() => {
      previewEndRef.current = null;
      showError("Browser tidak bisa memutar preview video ini.");
    });
  };

  const clampClipRangesToDuration = (duration: number) => {
    const maxSeconds = Math.floor(duration);
    if (maxSeconds < 1) return clips;
    const boundedClips = clips.map((clip) => {
      const rawStart = Math.max(0, parseClipTime(clip.startTime));
      const rawEnd = Math.max(rawStart + 1, parseClipTime(clip.endTime));
      const start = Math.min(rawStart, maxSeconds - 1);
      const end = Math.min(maxSeconds, Math.max(start + 1, rawEnd));
      return { ...clip, startTime: secondsToTime(start), endTime: secondsToTime(end) };
    });
    setClips(boundedClips);
    setTimeDrafts((current) => ({
      ...current,
      ...Object.fromEntries(boundedClips.map((clip) => [clip.id, { start: clip.startTime, end: clip.endTime }])),
    }));
    return boundedClips;
  };

  const handleVideoMetadata = (event: React.SyntheticEvent<HTMLVideoElement>) => {
    const video = event.currentTarget;
    const exactDuration = video.duration;
    if (!Number.isFinite(exactDuration) || exactDuration <= 0) return;
    const duration = Math.floor(exactDuration);
    setSourceDuration(duration);
    setVideoPreviewReady(true);
    setVideoPreviewError("");
    const boundedClips = clampClipRangesToDuration(duration);
    const active = boundedClips.find((clip) => clip.id === activeClipId);
    const initialTime = active ? Math.max(0, Math.min(duration, parseClipTime(active.startTime))) : 0;
    video.currentTime = initialTime;
    setCurrentTime(initialTime);
  };

  const loadVideoDurationFallback = async () => {
    if (!videoPath) {
      setVideoPreviewError("Browser tidak bisa membaca metadata durasi video.");
      return;
    }
    try {
      const info = await fetchJsonWithTimeout("/api/video/info", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ videoPath }),
      });
      const duration = Math.floor(Number(info?.format?.duration));
      if (!Number.isFinite(duration) || duration < 1) throw new Error("Durasi video tidak ditemukan.");
      setSourceDuration(duration);
      clampClipRangesToDuration(duration);
      setVideoPreviewError("Metadata durasi dibaca dari file sumber. Preview browser mungkin tidak mendukung format video ini.");
    } catch (error: any) {
      setVideoPreviewError(error.message || "Browser tidak bisa membaca metadata durasi video.");
    }
  };

  const handleVideoError = () => {
    setVideoPreviewReady(false);
    setVideoPreviewError("Preview video belum dapat dimuat. Sedang mencoba membaca durasi dari file sumber.");
    void loadVideoDurationFallback();
  };

  const handleVideoTimeUpdate = (event: React.SyntheticEvent<HTMLVideoElement>) => {
    const video = event.currentTarget;
    let time = video.currentTime;
    if (previewEndRef.current !== null && video.currentTime >= previewEndRef.current) {
      video.pause();
      video.currentTime = previewEndRef.current;
      time = previewEndRef.current;
      previewEndRef.current = null;
    }
    setCurrentTime(time);
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
      setMessage({ type: "info", text: "Mendeteksi frame dengan tracker Python OpenCV + MediaPipe..." });
      const data = await fetchJsonWithTimeout("/api/face/detect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ videoPath, sampleInterval }),
      }, 10 * 60 * 1000);
      const pythonTracks = Array.isArray(data.tracks) ? data.tracks : [];
      if (!pythonTracks.length || data.detectedCount === 0) throw new Error("Python tracker tidak menemukan wajah");
      setTracks(pythonTracks);
      setProgress(100);
      setMessage({ type: "success", text: `${data.detectedCount || pythonTracks.length} sample wajah terdeteksi via ${data.engine || "Python"}. Crop mengikuti video original dengan smoothing halus.` });
    } catch (pythonError: any) {
      try {
        setMessage({ type: "info", text: `Tracker Python gagal (${pythonError.message}). Mencoba tracker browser...` });
        const nextTracks = await detectFacesInVideo(video, sampleInterval, setProgress);
        setTracks(nextTracks);
        if (!nextTracks.some((track) => track.width > 0)) showError("Wajah tidak terdeteksi. Export tetap bisa dilakukan dengan crop tengah.");
        else setMessage({ type: "success", text: `${nextTracks.length} titik wajah terdeteksi via browser. Crop mengikuti video original dengan smoothing halus.` });
      } catch (browserError: any) {
        showError(`Deteksi wajah gagal (Python: ${pythonError.message}; browser: ${browserError.message}).`);
      }
    } finally {
      setBusy(null);
    }
  };

  const exportClip = async (clip: Clip): Promise<boolean> => {
    if (!reviewApprovedRef.current) {
      showError("Setujui dan generate batch dari tombol utama sebelum export clip.");
      return false;
    }
    if (!videoPath) {
      showError("Video belum dipilih atau diunduh.");
      return false;
    }
    const key = `${clip.id}-${aspect}`;
    const rawKey = `${clip.id}-raw`;
    setBusy(key);
    try {
      let sourcePath = videoPath;
      let sourceStart = clip.startTime;
      let sourceEnd = clip.endTime;
      let sourceTranscript = transcript;
      let sourceTracks: FaceTrack[] = smartCrop && aspect !== "original" ? [] : tracks;

      if (smartCrop && aspect !== "original") {
        setRenderPhase({ clipId: clip.id, phase: "preparing" });
        sourcePath = rawExports[rawKey];
        if (!sourcePath) {
          const raw = await fetchJsonWithTimeout("/api/slicin/cut", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              videoPath,
              startTime: clip.startTime,
              endTime: clip.endTime,
              title: clip.title || clip.context || clip.id,
              caption: "",
              outputName: `vexo_raw_${Date.now()}_${clip.id}.mp4`,
              aspectRatio: "original",
              smartCrop: false,
              burnCaptions: false,
              subtitleLines: [],
              faceTracks: [],
              version: 3,
              sourceName,
              sourceUrl,
            }),
          });
          sourcePath = raw.outputPath;
          setRawExports((current) => ({ ...current, [rawKey]: sourcePath }));
        }

        setRenderPhase({ clipId: clip.id, phase: "countdown", countdown: 3 });
        for (let count = 3; count >= 1; count -= 1) {
          setRenderPhase({ clipId: clip.id, phase: "countdown", countdown: count });
          await new Promise((resolve) => window.setTimeout(resolve, 700));
        }

        setRenderPhase({ clipId: clip.id, phase: "tracking" });
        const detected = await fetchJsonWithTimeout("/api/face/detect", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ videoPath: sourcePath, sampleInterval }),
        }, 15 * 60 * 1000);
        sourceTracks = Array.isArray(detected.tracks) ? detected.tracks : [];
        if (!sourceTracks.some((track: FaceTrack) => track.width > 0)) throw new Error("Wajah tidak terdeteksi pada clip ini.");
        setTracks(sourceTracks);
        setMessage({ type: "info", text: `Model ${detected.engine || "BlazeFace"} selesai membaca ${detected.detectedCount || sourceTracks.length} sample. Merender crop halus…` });
        sourceStart = "00:00:00";
        sourceEnd = durationForApi(clipDuration(clip));
        const clipStart = parseClipTime(clip.startTime);
        const clipEnd = parseClipTime(clip.endTime);
        sourceTranscript = transcript
          .filter((line) => line.end > clipStart && line.start < clipEnd)
          .map((line) => ({
            ...line,
            start: Math.max(0, line.start - clipStart),
            end: Math.min(clipEnd - clipStart, Math.max(0, line.end - clipStart)),
          }));
        setRenderPhase({ clipId: clip.id, phase: "rendering" });
      }

      const data = await fetchJsonWithTimeout("/api/slicin/cut", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          videoPath: sourcePath,
          startTime: sourceStart,
          endTime: sourceEnd,
          title: clip.title || clip.context || clip.id,
          caption: clip.caption || "",
          outputName: `vexo_${Date.now()}_${clip.id}_${aspect.replace(":", "x")}.mp4`,
          aspectRatio: aspect,
          smartCrop: smartCrop && aspect !== "original",
          burnCaptions,
          captionEngine: "whisper",
          whisperModel,
          subtitleLines: sourceTranscript,
          faceTracks: smartCrop ? sourceTracks : [],
          sampleInterval,
          version: 3,
          sourceName,
          sourceUrl,
        }),
      });
      setExports((current) => ({ ...current, [key]: data.outputPath }));
      if (data.outputUrl) setExportUrls((current) => ({ ...current, [key]: data.outputUrl }));
      if (data.captionPath) setCaptionFiles((current) => ({ ...current, [key]: data.captionPath }));
      if (data.captionUrl) setCaptionUrls((current) => ({ ...current, [key]: data.captionUrl }));
      setMessage({ type: "success", text: `${clip.title || clip.id} berhasil dirender dengan ratio ${aspect}.` });
      return true;
    } catch (error: any) {
      showError(error.message);
      return false;
    } finally {
      setRenderPhase(null);
      setBusy(null);
    }
  };

  const exportSelected = async () => {
    const selected = clips.filter((item) => selectedIds.has(item.id));
    if (!selected.length || !videoPreviewReady) return;
    setReviewApproved(true);
    reviewApprovedRef.current = true;
    setBatchProgress({ current: 0, total: selected.length });
    let completed = 0;
    let failed = 0;
    for (const [index, clip] of selected.entries()) {
      setBatchProgress({ current: index + 1, total: selected.length });
      if (await exportClip(clip)) completed += 1;
      else failed += 1;
    }
    setBatchProgress(null);
    setBusy(null);
    setMessage({
      type: failed ? (completed ? "info" : "error") : "success",
      text: failed ? `${completed} clip berhasil, ${failed} clip gagal. Periksa pesan error lalu ulangi clip yang gagal.` : `${completed} clip berhasil diekspor.`,
    });
  };

  const toggle = (id: string) => {
    setReviewApproved(false);
    reviewApprovedRef.current = false;
    setSelectedIds((current) => {
      const next = new Set(current);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const transcriptFromInput = transcript.length ? transcript : parseObsidianMarkdown(obsidianText);
  const continueToAnalyze = () => {
    if (!transcriptFromInput.length) {
      showError("Timestamp belum ditemukan. Paste transcript lalu klik Parse transcript, atau gunakan format seperti **0:03** · kalimat.");
      return;
    }
    if (!transcript.length) setTranscript(transcriptFromInput);
    setStep(2);
  };
  const selectedClips = clips.filter((clip) => selectedIds.has(clip.id));
  const activeClip = selectedClips.find((clip) => clip.id === activeClipId) || selectedClips[0] || null;
  const enterReview = () => {
    if (step === 3) return;
    if (!selectedClips.length) return;
    if (!selectedClips.some((clip) => clip.id === activeClipId)) setActiveClipId(selectedClips[0].id);
    setRangeError("");
    setReviewApproved(false);
    reviewApprovedRef.current = false;
    setVideoPreviewReady(false);
    setStep(3);
  };
  const startNew = () => {
    if (busy || batchProgress) return;
    if (videoUrl.startsWith("blob:")) URL.revokeObjectURL(videoUrl);
    previewEndRef.current = null;
    reviewApprovedRef.current = false;
    setStep(1);
    setClips([]);
    setSelectedIds(new Set());
    setPodcastCategories([]);
    setAnalysisWarnings([]);
    setTranscript([]);
    setTracks([]);
    setRawExports({});
    setExports({});
    setExportUrls({});
    setCaptionFiles({});
    setCaptionUrls({});
    setVideoPath("");
    setVideoName("");
    setVideoUrl("");
    setVideoPreviewReady(false);
    setVideoPreviewError("");
    setSourceDuration(null);
    setCurrentTime(0);
    setActiveClipId("");
    setTimeDrafts({});
    setRangeError("");
    setReviewApproved(false);
    setYoutubeUrl("");
    setSourceKind(null);
    setSourceName("");
    setSourceUrl("");
    setWhisperModel("small");
    setMessage(null);
  };
  const canInput = transcriptFromInput.length > 0 && !!videoPath;
  const canReview = selectedClips.length > 0;
  const canGenerate = canReview && !!videoPath && videoPreviewReady && (sourceDuration || 0) >= 1 && !batchProgress;
  const canRunAnalyze = canInput && (mode !== "podcast" || podcastCategories.length > 0);
  const clipsByCategory = PODCAST_CATEGORY_OPTIONS.reduce<Record<string, Clip[]>>((groups, category) => {
    groups[category.id] = clips.filter((clip) => clip.category === category.id);
    return groups;
  }, {});
  const clipGroups: { id: string; label: string; clips: Clip[] }[] = mode === "podcast"
    ? PODCAST_CATEGORY_OPTIONS
      .filter((category) => clipsByCategory[category.id].length > 0)
      .map((category) => ({ id: category.id, label: category.label, clips: clipsByCategory[category.id] }))
    : [{
        id: mode,
        label: SLICIN_MODE_OPTIONS.find((option) => option.mode === mode)?.label || mode,
        clips,
      }];

  return (
    <div className="max-w-5xl mx-auto px-6 lg:px-8 py-8 space-y-6 pb-24">
      <header className="border-b border-white/5 pb-6">
        <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-yellow-400/10 border border-yellow-400/20 rounded-full">
          <Sparkles size={14} className="text-yellow-400" />
          <span className="text-[10px] font-black uppercase tracking-[0.25em] text-yellow-400">Context Slicer</span>
        </div>
        <h1 className="text-4xl font-black tracking-tighter uppercase mt-4">Paste. <span className="text-yellow-400">Analyze.</span> Export.</h1>
        <p className="text-sm text-white/60 mt-2 max-w-2xl">Alur khusus workflow kamu: copy-paste transcript, pilih sumber dari URL YouTube atau file lokal, pilih clip, lalu export ke format short-form.</p>
      </header>

      <div className="glass-card p-3 flex gap-2">
        {STEPS.map((item) => {
          const enabled = item.id === 1 || (item.id === 2 && canInput) || (item.id === 3 && canReview);
          return <button key={item.id} disabled={!enabled || !!busy || !!batchProgress} onClick={() => item.id === 3 ? enterReview() : setStep(item.id)} className={cn("flex-1 flex items-center gap-3 p-3 rounded-xl border text-left transition disabled:opacity-30", step === item.id ? "bg-yellow-400 text-black border-yellow-400" : "border-white/10 text-white/60 hover:bg-white/5")}>
            <span className={cn("w-8 h-8 rounded-full flex items-center justify-center text-xs font-black", step === item.id ? "bg-black text-yellow-400" : "bg-white/10")}>{item.id}</span>
            <span className="hidden sm:block"><span className="block text-xs font-black uppercase">{item.label}</span><span className="text-[11px] opacity-70">{item.desc}</span></span>
          </button>;
        })}
      </div>

      {message && <div className={cn("p-3 rounded-xl text-sm border", message.type === "error" ? "bg-red-500/10 border-red-500/20 text-red-300" : message.type === "success" ? "bg-green-500/10 border-green-500/20 text-green-300" : "bg-blue-500/10 border-blue-500/20 text-blue-200")}>{message.text}</div>}

      <div className="glass-card p-6 min-h-[520px]">
        <AnimatePresence mode="wait">
          {step === 1 && <motion.div key="input" initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -16 }} className="space-y-6">
            <div><h2 className="font-black uppercase flex items-center gap-2"><ClipboardPaste className="text-yellow-400" size={20} /> 1. Masukkan sumber</h2><p className="text-sm text-white/50 mt-1">Paste transcript, lalu pilih sumber video: masukkan URL YouTube untuk download otomatis atau pilih file dari folder untuk diproses lokal.</p></div>
            <section className="p-4 bg-black/30 rounded-2xl border border-white/5 space-y-3">
              <div className="flex items-center justify-between"><label className="text-xs font-black uppercase">Transcript dari Obsidian Web Clipper</label><button onClick={loadExample} className="text-[10px] text-yellow-400 hover:underline">Load contoh</button></div>
              <textarea value={obsidianText} onChange={(event) => setObsidianText(event.target.value)} placeholder="Paste isi hasil Web Clipper di sini...\nContoh: **0:03** · Ini kalimat pertama" className="w-full h-48 bg-black/40 border border-white/10 rounded-xl p-4 text-xs font-mono outline-none focus:border-yellow-400/50" />
              <div className="flex items-center justify-between gap-3"><span className="text-xs text-white/40">{transcript.length ? `${transcript.length} baris sudah terbaca` : "Belum diparse"}</span><button onClick={parseSource} disabled={!obsidianText.trim()} className="px-4 py-2.5 bg-white/10 rounded-xl text-xs font-black uppercase disabled:opacity-30">Parse transcript</button></div>
            </section>
            <section className="p-4 bg-black/30 rounded-2xl border border-white/5 space-y-3">
              <label htmlFor="youtube-url" className="text-xs font-black uppercase flex items-center gap-2"><Video className="text-yellow-400" size={16} /> Video YouTube</label>
              <div className="flex flex-col sm:flex-row gap-2">
                <input id="youtube-url" value={youtubeUrl} onChange={(event) => setYoutubeUrl(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") void downloadVideo(); }} placeholder="https://www.youtube.com/watch?v=..." className="flex-1 bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-xs outline-none focus:border-yellow-400/50" />
                <select aria-label="Kualitas download" value={downloadQuality} onChange={(event) => setDownloadQuality(event.target.value as DownloadQuality)} disabled={busy === "download"} className="sm:w-32 bg-black/40 border border-white/10 rounded-xl px-3 py-3 text-xs outline-none focus:border-yellow-400/50">
                  <option value="best">Terbaik</option>
                  <option value="1080">1080p</option>
                  <option value="720">720p</option>
                </select>
                <button onClick={() => void downloadVideo()} disabled={busy === "download" || !youtubeUrl.trim()} className="px-4 py-3 bg-yellow-400 text-black rounded-xl text-xs font-black uppercase flex items-center justify-center gap-2 disabled:opacity-30"><Link2 size={16} /> {busy === "download" ? `Mengunduh ${Math.round(downloadProgress?.progress || 0)}%` : "Download video"}</button>
              </div>
              {busy === "download" && downloadProgress && <div className="space-y-2 rounded-xl border border-yellow-400/20 bg-yellow-400/5 p-3"><div className="flex items-center justify-between text-[11px]"><span className="text-yellow-100">{downloadProgress.message}</span><span className="font-black text-yellow-400">{Math.round(downloadProgress.progress)}%</span></div><div className="h-2 overflow-hidden rounded-full bg-white/10"><div className="h-full rounded-full bg-yellow-400 transition-[width] duration-300" style={{ width: `${Math.max(0, Math.min(100, downloadProgress.progress))}%` }} /></div></div>}
              <p className="text-[11px] text-white/40">Kualitas memengaruhi ukuran dan kecepatan download. Download lokal memakai yt-dlp + ffmpeg; setelah selesai video otomatis menjadi sumber Analyze dan Cut.</p>
              <div className="flex items-center gap-3 text-[10px] uppercase tracking-widest text-white/30"><span className="h-px flex-1 bg-white/10" /><span>atau</span><span className="h-px flex-1 bg-white/10" /></div>
              <input ref={fileInputRef} type="file" accept="video/*,.mp4,.mov,.webm,.mkv,.m4v,.avi" onChange={handleVideoChange} className="hidden" />
              <button onClick={() => fileInputRef.current?.click()} disabled={busy === "upload" || busy === "download"} className="w-full min-h-20 border-2 border-dashed border-white/10 rounded-2xl flex items-center justify-center gap-3 hover:border-yellow-400/50 transition disabled:opacity-50"><Upload size={20} className="text-yellow-400" /><span className="text-xs font-black uppercase">{busy === "upload" ? "Uploading..." : "Pilih file dari folder"}</span><span className="text-[11px] text-white/40">MP4, MOV, WebM • diproses lokal</span></button>
              <p className="text-[11px] text-white/40">File dari folder di-upload ke server lokal terlebih dahulu. Browser tidak memberikan path Windows mentah, jadi file besar perlu waktu untuk ditransfer.</p>
              {videoName && <div className="text-xs text-green-400 break-all">✓ {videoName}</div>}
              {sourceKind && <div className="text-[11px] text-white/40">Sumber aktif: <span className="text-yellow-400 font-bold">{sourceKind === "youtube" ? "YouTube download" : "File lokal"}</span></div>}
              {sourceName && <div className="text-[11px] text-white/40 break-all">Src: <span className="text-white/70">{sourceName}</span>{sourceUrl && <> · <a href={sourceUrl} target="_blank" rel="noreferrer" className="text-yellow-400 hover:underline">buka link</a></>}</div>}
              {videoUrl && <video ref={videoRef} src={videoUrl} controls muted playsInline className="w-full max-h-56 rounded-xl bg-black object-contain" />}
            </section>
            <div className="flex justify-end"><button onClick={continueToAnalyze} disabled={!canInput} className="px-6 py-3 bg-yellow-400 text-black rounded-xl text-xs font-black uppercase flex items-center gap-2 disabled:opacity-30">Lanjut Analyze <ChevronRight size={16} /></button></div>
          </motion.div>}

          {step === 2 && <motion.div key="analyze" initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -16 }} className="space-y-6">
            <div><h2 className="font-black uppercase flex items-center gap-2"><Cpu className="text-yellow-400" size={20} /> 2. Cari kandidat clip</h2><p className="text-sm text-white/50 mt-1">Gemini menganalisis transcript yang kamu paste; sumber video aktif dipakai sebagai bahan cut.</p></div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">{SLICIN_MODE_OPTIONS.map(({ mode: option, label }) => {
              const Icon = option === "podcast" ? Mic2 : option === "gaming" ? Gamepad2 : option === "educate" ? GraduationCap : Sparkles;
              return <button key={option} onClick={() => changeMode(option)} className={cn("p-4 rounded-2xl border flex items-center justify-center gap-2 text-xs font-black uppercase", mode === option ? "bg-yellow-400/10 border-yellow-400 text-yellow-400" : "border-white/10 text-white/50")}><Icon size={18} /> {label}</button>;
            })}</div>
            {mode === "podcast" && <section className="p-4 rounded-2xl border border-yellow-400/20 bg-yellow-400/5 space-y-3"><div><div className="text-xs font-black uppercase text-yellow-100">Pilih angle podcast</div><p className="text-[11px] text-white/50 mt-1">Pilih minimal satu. AI membaca seluruh transcript sebagai satu konteks dan mencari hingga 6 clip kuat per kategori.</p></div><div className="grid grid-cols-1 sm:grid-cols-3 gap-2">{PODCAST_CATEGORY_OPTIONS.map((category) => { const selected = podcastCategories.includes(category.id); return <button key={category.id} type="button" onClick={() => togglePodcastCategory(category.id)} className={cn("p-3 rounded-xl border text-left transition", selected ? "bg-yellow-400 text-black border-yellow-400" : "bg-white/5 border-white/10 text-white/70 hover:border-yellow-400/50")}><div className="flex items-center justify-between"><span className="text-xs font-black uppercase">{category.label}</span>{selected && <Check size={14} />}</div><div className={cn("text-[10px] mt-1", selected ? "text-black/60" : "text-white/40")}>{category.hint}</div></button>; })}</div></section>}
            {mode === "educate" && <p className="text-xs text-white/45">Gemini membetulkan salah transkripsi yang jelas terlebih dahulu, lalu mencari klip edukatif lengkap sampai batas timestamp berikutnya.</p>}
            <div className="p-4 bg-black/30 rounded-2xl text-xs font-mono text-white/50 max-h-52 overflow-auto">{transcript.slice(0, 14).map((line, index) => <div key={index}>[{secondsToTime(line.start)}] {line.text}</div>)}{transcript.length > 14 && <div className="text-yellow-400">... +{transcript.length - 14} baris</div>}</div>
            <button onClick={analyze} disabled={busy === "analyze" || !canRunAnalyze} className="w-full py-4 bg-yellow-400 text-black rounded-2xl font-black uppercase flex justify-center items-center gap-2 disabled:opacity-30">{busy === "analyze" ? <Loader2 className="animate-spin" /> : <Cpu size={18} />} {busy === "analyze" ? mode === "educate" ? "Gemini mengoreksi lalu menganalisis..." : "Gemini sedang menganalisis..." : mode === "educate" ? "Koreksi & cari kandidat" : "Analyze transcript"}</button>
            {mode === "podcast" && !podcastCategories.length && <p className="text-xs text-yellow-200/70 text-center">Pilih minimal satu kategori agar Analyze aktif.</p>}
            {analysisWarnings.length > 0 && <div className="p-3 rounded-xl border border-yellow-400/20 bg-yellow-400/5 text-xs text-yellow-100">{analysisWarnings.map((warning) => <div key={warning}>{warning}</div>)}</div>}
            {clips.length > 0 && <div className="space-y-5"><div className="flex justify-between items-center"><h3 className="font-black uppercase text-sm">Kandidat ({clips.length})</h3><button onClick={() => setSelectedIds(new Set(clips.map((clip) => clip.id)))} className="text-xs text-yellow-400">Pilih semua</button></div>{clipGroups.map((group) => <section key={group.id} className="space-y-2"><div className="flex items-center gap-2"><h4 className="text-xs font-black uppercase text-yellow-100">{group.label}</h4>{mode === "podcast" && <span className="text-[10px] text-white/40">{group.clips.length} clip</span>}</div>{group.clips.map((clip) => <button key={clip.id} onClick={() => toggle(clip.id)} className={cn("w-full text-left p-3 rounded-2xl border-2", selectedIds.has(clip.id) ? "bg-yellow-400/10 border-yellow-400" : "bg-white/[0.02] border-white/5")}><div className="flex flex-wrap gap-2 items-center"><span className="text-[11px] font-mono bg-white/10 px-2 py-1 rounded">{clip.startTime} &ndash; {clip.endTime}</span>{clip.category && <span className="text-[10px] uppercase px-2 py-1 rounded bg-blue-400/10 text-blue-200">{PODCAST_CATEGORY_OPTIONS.find((item) => item.id === clip.category)?.label || clip.category}</span>}{clip.viralPotential !== undefined && <span className="text-[11px] text-yellow-400">{Math.round(clip.viralPotential)}%</span>}{selectedIds.has(clip.id) && <Check size={14} className="text-yellow-400" />}</div><div className="font-bold text-sm mt-1">{clip.title || clip.context || "Untitled"}</div><div className="text-xs text-white/50">{clip.summary}</div><div className="text-[11px] text-white/35 mt-1">{clip.reason}</div></button>)}</section>)}</div>}
            <div className="flex justify-between"><button onClick={() => setStep(1)} className="px-5 py-3 bg-white/10 rounded-xl text-xs font-black uppercase flex items-center gap-2"><ChevronLeft size={16} /> Kembali</button><button onClick={enterReview} disabled={!canReview} className="px-6 py-3 bg-yellow-400 text-black rounded-xl text-xs font-black uppercase flex items-center gap-2 disabled:opacity-30">Review & atur clip <ChevronRight size={16} /></button></div>
          </motion.div>}

          {step === 3 && <motion.div key="export" initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -16 }} className="space-y-6">
            <div><h2 className="font-black uppercase flex items-center gap-2"><Scissors className="text-yellow-400" size={20} /> 3. Review & atur clip</h2><p className="text-sm text-white/50 mt-1">Periksa highlight pada video, sesuaikan waktu awal dan akhir, lalu setujui batch sebelum generate.</p></div>
            {videoUrl && <video ref={videoRef} src={videoUrl} preload="metadata" controls playsInline onLoadedMetadata={handleVideoMetadata} onError={handleVideoError} onTimeUpdate={handleVideoTimeUpdate} className="w-full max-h-[55vh] rounded-2xl border border-white/10 bg-black object-contain" />}
            {!videoUrl && <div className="flex min-h-52 items-center justify-center rounded-2xl border border-white/10 bg-black/40 text-sm text-white/45">Video sumber belum tersedia.</div>}
            <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-white/50"><span>{sourceDuration ? `Durasi video: ${secondsToTime(sourceDuration)}` : "Membaca durasi video…"}</span>{videoPreviewError && <span className="flex flex-wrap items-center gap-2 text-yellow-200">{videoPreviewError}<button type="button" onClick={() => videoRef.current?.load()} className="underline">Coba muat ulang</button></span>}</div>
            {sourceDuration !== null && sourceDuration > 0 && selectedClips.length > 0 && <TimelineOverview clips={[...selectedClips].sort((a, b) => parseClipTime(a.startTime) - parseClipTime(b.startTime))} duration={sourceDuration} activeClipId={activeClip?.id || ""} currentTime={currentTime} onSelect={selectReviewClip} />}
            {activeClip && sourceDuration !== null && sourceDuration >= 1 && <section className="space-y-3">
              <div className="flex flex-wrap items-start justify-between gap-3 rounded-2xl border border-white/10 bg-white/[0.03] p-4"><div><div className="flex flex-wrap items-center gap-2"><h3 className="font-black text-sm">{activeClip.title || activeClip.context || "Clip terpilih"}</h3>{activeClip.category && <span className="rounded bg-blue-400/10 px-2 py-1 text-[9px] uppercase text-blue-200">{PODCAST_CATEGORY_OPTIONS.find((item) => item.id === activeClip.category)?.label || activeClip.category}</span>}{activeClip.viralPotential !== undefined && <span className="text-[10px] text-yellow-400">{Math.round(activeClip.viralPotential)}%</span>}</div><p className="mt-1 text-xs text-white/45">{activeClip.summary || activeClip.reason}</p></div><button type="button" onClick={() => previewReviewClip(activeClip)} disabled={!videoPreviewReady || !!busy || !!batchProgress} className="flex shrink-0 items-center gap-2 rounded-xl bg-white/10 px-3 py-2 text-xs font-bold disabled:opacity-40"><Play size={14} /> Preview clip</button></div>
              <FocusedClipTimeline clip={activeClip} duration={sourceDuration} currentTime={currentTime} disabled={!videoPreviewReady || !!busy || !!batchProgress} onChangeBoundary={(boundary, seconds) => updateClipBoundary(activeClip.id, boundary, seconds)} />
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                {(["start", "end"] as ClipBoundary[]).map((boundary) => {
                  const value = timeDrafts[activeClip.id]?.[boundary] ?? (boundary === "start" ? activeClip.startTime : activeClip.endTime);
                  const label = boundary === "start" ? "Waktu mulai" : "Waktu akhir";
                  return <label key={boundary} className="space-y-1 text-[10px] font-black uppercase text-white/50">
                    {label}
                    <input type="text" inputMode="numeric" value={value} disabled={!videoPreviewReady || !!busy || !!batchProgress}
                      onChange={(event) => setTimeDrafts((current) => ({ ...current, [activeClip.id]: { start: current[activeClip.id]?.start ?? activeClip.startTime, end: current[activeClip.id]?.end ?? activeClip.endTime, [boundary]: event.target.value } }))}
                      onBlur={() => commitTimeDraft(activeClip, boundary)} onFocus={() => setRangeError("")}
                      onKeyDown={(event) => { if (event.key === "Enter") event.currentTarget.blur(); }}
                      placeholder="MM:SS atau HH:MM:SS"
                      className="mt-1 block w-full rounded-xl border border-white/10 bg-black/40 px-3 py-2.5 font-mono text-sm text-white outline-none focus:border-yellow-400/50 disabled:opacity-40" />
                  </label>;
                })}
              </div>
              {rangeError && <p className="rounded-xl border border-red-400/20 bg-red-400/5 p-3 text-xs text-red-200">{rangeError}</p>}
            </section>}
            {(!sourceDuration || sourceDuration < 1 || !videoPreviewReady) && <div className="rounded-xl border border-yellow-400/20 bg-yellow-400/5 p-3 text-xs text-yellow-100">Timeline edit dan generate aktif setelah durasi sumber diketahui dan preview video siap.</div>}
            <div className="grid grid-cols-4 gap-2">{(["9:16", "1:1", "4:5", "original"] as Aspect[]).map((item) => <button key={item} onClick={() => setAspect(item)} className={cn("py-3 rounded-xl border text-xs font-black", aspect === item ? "bg-yellow-400 text-black border-yellow-400" : "bg-white/5 border-white/10 text-white/60")}>{item}</button>)}</div>
            {renderPhase && <div className="p-4 rounded-2xl border border-yellow-400/30 bg-yellow-400/10 text-yellow-100 flex items-center gap-3"><div className="w-10 h-10 rounded-full bg-yellow-400 text-black flex items-center justify-center font-black text-lg">{renderPhase.phase === "countdown" ? renderPhase.countdown : <Loader2 className="animate-spin" size={18} />}</div><div><div className="text-sm font-black uppercase">{renderPhase.phase === "preparing" ? "Memotong clip original" : renderPhase.phase === "countdown" ? "Siap merekam crop" : renderPhase.phase === "tracking" ? "Model membaca wajah" : "Merender hasil crop"}</div><div className="text-xs text-yellow-100/70">{renderPhase.phase === "preparing" ? "Video dipotong sesuai timestamp tanpa crop." : renderPhase.phase === "countdown" ? "Bounding box akan menjadi panduan crop sesuai ratio pilihan." : renderPhase.phase === "tracking" ? "BlazeFace mengikuti wajah dari clip original." : "Audio dan video disusun ulang dengan timestamp yang sama."}</div></div></div>}
            <div className="p-4 rounded-2xl border border-white/10 bg-white/[0.03] text-xs text-white/60"><span className="font-bold text-white">Alur Face-follow:</span> setelah batch disetujui, clip dipotong dalam ratio original, model membaca wajah pada rentang yang sudah kamu atur, lalu crop akhir dibuat sesuai ratio {aspect}.</div>
            <div className="p-4 bg-white/[0.03] rounded-2xl border border-white/10 space-y-3"><label className="flex items-start gap-3 cursor-pointer"><input type="checkbox" checked={burnCaptions} onChange={(event) => setBurnCaptions(event.target.checked)} className="accent-yellow-400 w-4 h-4 mt-1" /><div><div className="text-sm font-bold">Caption sinkron Whisper</div><div className="text-xs text-white/50">Video dipotong dulu, lalu model Whisper lokal membuat caption dari word timestamps sebelum export final.</div></div></label>{burnCaptions && <div className="pl-7 flex flex-wrap items-center gap-3"><label htmlFor="whisper-model" className="text-xs font-bold text-white/70">Model</label><select id="whisper-model" aria-label="Model Whisper" value={whisperModel} onChange={(event) => setWhisperModel(event.target.value as WhisperModelChoice)} disabled={!!busy} className="bg-black/40 border border-white/10 rounded-xl px-3 py-2 text-xs outline-none focus:border-yellow-400/50"><option value="small">Small · lebih cepat</option><option value="medium">Medium · lebih akurat</option></select><span className="text-[11px] text-white/40">Model dibaca dari folder lokal models/faster-whisper-{whisperModel}.</span></div>}</div>
            {aspect !== "original" && <div className="p-4 bg-white/[0.03] rounded-2xl border border-white/10 space-y-3"><label className="flex items-center gap-3 text-sm font-bold"><input type="checkbox" checked={smartCrop} onChange={(event) => setSmartCrop(event.target.checked)} disabled={!!busy} className="accent-yellow-400 w-4 h-4" /> Face-follow crop</label>{smartCrop && <><p className="text-[11px] text-white/50">Setelah batch disetujui, tiap clip dipotong dulu lalu model dan countdown berjalan untuk rentang yang sudah diatur.</p><div className="flex justify-between text-xs text-white/50"><span>Sampling gerakan</span><span className="text-yellow-400">{sampleInterval}s</span></div><input type="range" min={0.2} max={1} step={0.05} value={sampleInterval} onChange={(event) => setSampleInterval(Number(event.target.value))} disabled={!!busy} className="w-full accent-yellow-400 disabled:opacity-40" /></>}</div>}
            <button onClick={exportSelected} disabled={!canGenerate || !!busy} className="w-full py-4 bg-yellow-400 text-black rounded-2xl font-black uppercase flex justify-center gap-2 disabled:opacity-30"><Download size={18} /> {batchProgress ? `Generate clip ${batchProgress.current}/${batchProgress.total}` : reviewApproved ? `Generate ulang ${selectedClips.length} clip` : `Setujui & generate ${selectedClips.length} clip`}</button>
            <div className="space-y-3">{selectedClips.map((clip) => {
              const key = `${clip.id}-${aspect}`;
              const rawKey = `${clip.id}-raw`;
              const isRendering = renderPhase?.clipId === clip.id;
              const isActive = activeClip?.id === clip.id;
              return <div key={clip.id} className={cn("flex items-center justify-between gap-3 rounded-2xl border p-4", isActive ? "border-yellow-400/50 bg-yellow-400/[0.05]" : "border-white/10 bg-white/[0.03]")}>
                <div className="min-w-0">
                  <button type="button" onClick={() => selectReviewClip(clip)} className="truncate text-left font-bold text-sm hover:text-yellow-200">{clip.title || clip.context}</button>
                  <div className="text-xs font-mono text-white/50">{clip.startTime} - {clip.endTime} | {secondsToTime(clipDuration(clip))}</div>
                  {rawExports[rawKey] && <div className="mt-1 text-[11px] text-white/50">Original clip siap untuk tracking</div>}
                  {exports[key] && <div className="mt-1 break-all text-[11px] text-green-400">Video: {exports[key]}</div>}
                  {exportUrls[key] && <a href={exportUrls[key]} download className="mt-1 inline-block text-[11px] text-yellow-400 hover:underline">Download video</a>}
                  {captionFiles[key] && <div className="mt-1 break-all text-[11px] text-blue-300">Caption: {captionFiles[key]}</div>}
                  {captionUrls[key] && <a href={captionUrls[key]} download className="mt-1 inline-block text-[11px] text-blue-300 hover:underline">Download caption .md</a>}
                </div>
                <button type="button" onClick={() => void exportClip(clip)} disabled={!!busy || !reviewApproved} className="flex shrink-0 items-center gap-2 rounded-xl bg-white/10 px-3 py-2 text-xs font-black disabled:opacity-35">
                  {isRendering ? <Loader2 className="animate-spin" size={14} /> : <Download size={14} />}
                  {isRendering ? "Memproses…" : reviewApproved ? exports[key] ? "Export ulang" : "Coba export" : "Menunggu persetujuan"}
                </button>
              </div>;
            })}</div>
            <div className="flex justify-between"><button onClick={() => setStep(2)} disabled={!!busy || !!batchProgress} className="px-5 py-3 bg-white/10 rounded-xl text-xs font-black uppercase flex items-center gap-2 disabled:opacity-40"><ChevronLeft size={16} /> Kembali</button><button onClick={startNew} disabled={!!busy || !!batchProgress} className="px-5 py-3 bg-white/5 border border-white/10 rounded-xl text-xs font-black uppercase disabled:opacity-40">Mulai baru</button></div>
          </motion.div>}
        </AnimatePresence>
      </div>
    </div>
  );
};
