# Context Slicer — Dokumentasi Endpoint (`/api/slicin/*`)

> Cakupan dokumen ini: **hanya Context Slicer** (UI: sidebar `Context Slicer`, komponen `src/components/SlicinView.tsx`).
> Semua endpoint di bawah prefix `/api/slicin/*` yang didefinisikan di `server.ts`.
> Base URL lokal: `http://localhost:3333` (lihat `server.ts:13`, `vite.config.ts:21`).
> Semua request/response memakai `Content-Type: application/json`, kecuali disebutkan lain.

---

## 1. Gambaran umum & alur

Context Slicer mengubah **transcript panjang + 1 file video lokal** menjadi **5–7 kandidat clip viral siap export** (Reels/Shorts/TikTok).

Alur 3 langkah di frontend (`SlicinView.tsx`):

```
Step 1 Input                    Step 2 Analyze              Step 3 Export
────────────────────            ──────────────────          ─────────────────────
paste markdown Obsidian    →    POST /api/slicin/analyze →  POST /api/slicin/cut
(+ validasi lokal /            (Gemini pilih timestamp       (ffmpeg potong + crop
     server parse)               viral + caption)              + caption + .md)
video sudah ada di server            ↓
(hasil download/upload)         user pilih clip            POST /api/slicin/thumbnail
                                                           (opsional, preview frame)
```

Daftar endpoint:

| # | Method & Path | Fungsi | Dipakai di UI? |
|---|---------------|--------|----------------|
| 1 | `POST /api/slicin/parse-obsidian` | Parse markdown Obsidian Web Clipper → array baris transcript | Tombol "Parse transcript" (validasi server; frontend juga punya parser lokal `src/lib/obsidianParser.ts`) |
| 2 | `POST /api/slicin/analyze` | **Inti Context Slicer.** Kirim transcript → Gemini (`gemini-3.5-flash-lite`) → kandidat clip berkonteks + caption (Podcast maksimal 6 per kategori) | Tombol "Analyze transcript" (`analyze()` di `SlicinView.tsx`) |
| 3 | `POST /api/slicin/process` | **Legacy.** Versi lama analyze, output minimal. Sekarang hanya wrapper yang mewajibkan `transcript` | Tidak dipakai frontend aktif; dipertahankan untuk kompatibilitas |
| 4 | `POST /api/slicin/thumbnail` | Ambil 1 frame JPEG pada detik `time` via ffmpeg, kembalikan `thumbPath` + `dataUrl` base64 | Utilitas preview (tidak ada tombol di `SlicinView` saat ini) |
| 5 | `POST /api/slicin/cut` | **Export.** Potong video (`startTime–endTime`), crop aspect ratio, opsional smart-crop face-follow + burn caption, tulis file `.md` caption | `exportClip()` / `exportSelected()` (`SlicinView.tsx:325,433`), dipanggil 1–2× per clip saat smart-crop aktif |

Yang **sengaja TIDAK dibahas** di dokumen ini (di luar scope Context Slicer, walau dipakai SlicinView sebagai penyedia input): `/api/upload-video`, `/api/youtube/download`, `/api/youtube/transcript`, `/api/face/detect`, `/api/video/info`, `/api/cleaner/process`.

---

## 2. Konsep input bersama

### 2.1. Format transcript (`TranscriptLine`)

Semua endpoint analyze/cut memakai bentuk yang sama:

```ts
interface TranscriptLine {
  start: number; // detik, mis. 3
  end: number;   // detik, mis. 33 (diambil dari timestamp baris berikutnya, atau start+10 untuk baris terakhir)
  text: string;  // kalimat bersih tanpa markup bold
}
```

Server menambahkan `timeStr` (string timestamp asli, mis. `"0:03"`) pada hasil `parse-obsidian`.

### 2.2. Format timestamp markdown Obsidian yang diterima

Regex parser (identik di `server.ts:252` dan `src/lib/obsidianParser.ts:12`):

```
/^\s*(?:[-*]\s*)?(?:\*{0,2})\[?(\d{1,2}:\d{2}(?::\d{2})?)\]?(?:\*{0,2})(?:\s*(?:·|[-–—|])\s*|\s+)(.+?)\s*$/
```

Contoh baris valid (lihat `src/example_obsidian/obs.md`):

```md
**0:03** · [musik] komunikasi. Jadi saya selalu mengatakan ...
**0:33** · Tapi ini adalah salah satu menurut saya ...
- [1:04] Iya, ya. Ya.
**00:01:20** | Judul segmen ...
```

Aturan:

- Timestamp boleh `MM:SS` (`0:03`) atau `HH:MM:SS` (`00:01:20`), boleh dibungkus `**`, `[]`, bullet `-`/`*`.
- Pemisah timestamp–teks boleh `·`, `-`, `–`, `—`, `|`, atau spasi.
- Baris tanpa timestamp (deskripsi video, link sosmed, heading) **diabaikan**.
- Timestamp duplikat berurutan digabung dan seluruh teksnya dipertahankan, termasuk marker reaksi seperti `[tertawa]`.
- `end` = `start` baris berikutnya; baris terakhir `end = start + 10`.
- Markup `**` di ujung teks dibersihkan; escape Markdown `\\[tertawa\\]` dinormalisasi menjadi `[tertawa]`.

### 2.3. Format timestamp clip (`startTime` / `endTime`)

String `MM:SS` atau `HH:MM:SS`, mis. `"00:01:20"`, `"01:55"`, `"00:00:00"`. Fungsi konversi server: `timestampSeconds()` (`server.ts:137`), `timestampString()` (`server.ts:145`), `toSec()` lokal di `/cut` (`server.ts:1177`), `toTime()` (`server.ts:1352`).

### 2.4. Dependensi & env yang dipakai Context Slicer

| Nama | Sumber | Dipakai di |
|------|--------|------------|
| `GEMINI_API_KEY` | `.env` / env | `/analyze`, `/process` (atau `apiKey` per-request dari `ApiKeyContext` frontend) |
| `GEMINI_MODEL` | env, default `"gemini-3.5-flash-lite"` (`server.ts:35`) | `/analyze`, `/process` |
| `FFMPEG_PATH` | env, default `""` → mengandalkan `ffmpeg` di PATH (`server.ts:1157`, `runFfmpegCommand`) | `/thumbnail`, `/cut` (butuh build ffmpeg dengan `libx264`, `aac`, dan `libass` untuk burn caption non-Whisper) |
| `WHISPER_MODEL` | env untuk pemanggilan langsung `src/python/transcribe_clip.py`; UI/API memakai model lokal yang dipilih | `/cut` hanya bila `burnCaptions=true` + `captionEngine="whisper"` (via `src/python/transcribe_clip.py`, butuh `faster-whisper`) |
| Direktori `temp/thumbs`, `temp/clips` | dibuat otomatis (`server.ts:39-48`) | output thumbnail & clip |
| `@google/genai` (`GoogleGenAI`) | `package.json` | `/analyze`, `/process` |

---

## 3. `POST /api/slicin/parse-obsidian`

**Definisi:** `server.ts:453`. **Helper:** `parseObsidianLine()` (`server.ts:251`).

Mengubah markdown mentah hasil Obsidian Web Clipper menjadi array baris transcript. Murni sinkron, tanpa AI, tanpa file.

### 3.1. Request

```http
POST /api/slicin/parse-obsidian
Content-Type: application/json
```

```json
{
  "markdown": "**0:03** · komunikasi. Jadi saya selalu...\n**0:33** · Tapi ini adalah salah satu..."
}
```

| Field | Tipe | Wajib | Keterangan |
|-------|------|-------|------------|
| `markdown` | `string` | Ya | Teks mentah paste dari Web Clipper. Kosong → `400 Missing markdown`. |

### 3.2. Response sukses (`200`)

```json
{
  "lines": [
    { "start": 3, "end": 33, "text": "[musik] komunikasi. Jadi saya selalu...", "timeStr": "0:03" },
    { "start": 33, "end": 43, "text": "Tapi ini adalah salah satu...", "timeStr": "0:33" }
  ],
  "count": 2
}
```

| Field | Tipe | Keterangan |
|-------|------|------------|
| `lines` | `Array<{start,end,text,timeStr}>` | `start/end` detik (number), `text` bersih, `timeStr` timestamp asli |
| `count` | `number` | `lines.length` |

### 3.3. Error

| Status | Body | Penyebab |
|--------|------|----------|
| `400` | `{ "error": "Missing markdown" }` | `markdown` kosong/absen |
| `500` | `{ "error": "<pesan>" }` | Gagal parsing tak terduga |

### 3.4. Contoh curl

```bash
curl -s http://localhost:3333/api/slicin/parse-obsidian \
  -H "Content-Type: application/json" \
  -d "{\"markdown\":\"**0:03** · Halo semua\\n**0:33** · Lanjut ke topik utama\"}"
```

### 3.5. Catatan pemakaian frontend

`SlicinView.parseSource()` (`SlicinView.tsx:129`) memakai parser lokal `parseObsidianMarkdown()` sehingga tidak memanggil endpoint ini; endpoint server tersedia untuk validasi konsisten / klien lain.

---

## 4. `POST /api/slicin/analyze` ⭐ (inti)

**Definisi:** `server.ts:709`. **Frontend:** `SlicinView.analyze()` (`SlicinView.tsx:254`) → `fetch("/api/slicin/analyze", ...)`.

Menerima transcript (string atau array), memotongnya maks ~30.000 karakter, membangun prompt editor viral, memanggil Gemini dengan JSON schema terstruktur, me-repair JSON bila perlu (termasuk 1× retry otomatis), menormalisasi boundary transcript, lalu mengembalikan kandidat clip. Podcast diproses sebagai satu konteks utuh dan menghasilkan maksimal 6 clip kuat per kategori terpilih.

### 4.1. Request

```http
POST /api/slicin/analyze
Content-Type: application/json
```

```json
{
  "transcript": [
    { "start": 3, "end": 33, "text": "komunikasi. Jadi saya selalu..." },
    { "start": 33, "end": 44, "text": "Tapi ini adalah salah satu..." }
  ],
  "videoPath": "C:/codingan/vexo/temp/downloads/HYwS8HAzwRs_720_....mp4",
  "mode": "podcast",
  "categories": ["comedy", "education"],
  "customPrompt": "string opsional — bila diisi, menggantikan prompt bawaan",
  "apiKey": "string opsional — API key per-request, menimpa server key"
}
```

| Field | Tipe | Wajib | Keterangan |
|-------|------|-------|------------|
| `transcript` | `string \| TranscriptLine[]` | Ya | Bila array: tiap item minimal `{start, text}`; server memformat ulang jadi `[MM:SS] teks` per baris (detik → `MM:SS`, tanpa jam). Bila string: dipakai apa adanya. Kosong → `400 Missing transcript`. |
| `videoPath` | `string` | Tidak | Hanya dipakai untuk nama file di prompt (`Video: "<basename>"`). Tidak dibaca/divalidasi di endpoint ini. Frontend wajib sudah mengisinya sebelum Analyze (kalau kosong, UI menolak dengan "Download video YouTube dulu"). |
| `mode` | `"podcast" \| "gaming"` | Tidak (default `"podcast"`) | Mengubah persona prompt: `podcast` = "Indonesian Podcast (Helmy Yahya style)", fokus hot takes/punchline/kontroversi; `gaming` = "Gaming (MOBA HOK/MLBB)", fokus savage/maniac/lord steal/comeback. Bahasa title/summary Indonesia untuk mode podcast. |
| `categories` | `("comedy" \| "mystery" \| "education")[]` | Wajib untuk Podcast UI | Multi-select kategori Podcast. Alias `komedi`, `misteri`, `edukasi` dinormalisasi; kategori invalid dibuang. Jika client lama tidak mengirim field ini, server fallback ke `["comedy"]`. Gaming mengabaikannya. Target maksimal 6 clip kuat per kategori, tanpa filler lemah. |
| `customPrompt` | `string` | Tidak | Prompt mentah pengganti. Bila diisi, `mode`/`videoPath` diabaikan kecuali disisipkan manual. |
| `apiKey` | `string` | Tidak | Bila diisi, request ini memakai `new GoogleGenAI({apiKey})`; bila kosong memakai server `genAI` (`.env GEMINI_API_KEY`). Frontend mengisi dari `ApiKeyContext.effectiveApiKey`. |

Batas transcript: bila `plain.length > 30000`, dipotong + suffix `\n...[truncated]` (`server.ts:729`).

### 4.2. Apa yang dipakai/dilakukan server (berurutan)

1. **Serialisasi transcript** (`server.ts:713-725`): array → string `[MM:SS] teks` join newline.
2. **Prompt bawaan** (`server.ts`): satu prompt gabungan untuk semua kategori terpilih. Comedy mempertahankan setup → punchline → reaksi; Mystery mempertahankan pertanyaan/mitos → reveal; Edukasi mempertahankan pertanyaan → penjelasan → kesimpulan. Target durasi Podcast 15–75 detik, batas mengikuti timestamp transcript, caption natural Bahasa Indonesia tanpa emoji/em dash.
3. **JSON schema terstruktur** dibangun dinamis: Podcast mewajibkan `category` sesuai kategori terpilih dan `maxItems = jumlah kategori × 6`; Gaming tetap schema lama maksimal 7 item.
4. **Panggil Gemini 3 lapis fallback** (`server.ts:885-897`): (a) `responseMimeType: application/json + responseJsonSchema + temperature:0.2` → (b) `responseMimeType: application/json` → (c) plain. Model dari `GEMINI_MODEL`.
5. **Ekstraksi array JSON** `extractJsonArray()` (`server.ts:770`): buang fence ```` ```json ````, scan bracket `[…]` dengan state string/escape.
6. **Repair sintaks** `repairJsonSyntax()` (`server.ts:798`): perbaiki key ter-escape (`\_reason":` → `"reason":`), quote keriting, escape ilegal, newline mentah → `\n`, hapus trailing comma. Dicoba via `tryParseClips()` (`server.ts:853`).
7. **1× retry deterministik** (`server.ts:908-921`): bila parse gagal, kirim prompt yang sama + instruksi "Return the same result again as ONLY a JSON array..." lalu parse lagi.
8. **Normalisasi bentuk** (`server.ts:923-928`): bila object `{clips:[...]}` → ambil isinya; bila object tunggal → bungkus `[obj]`.
9. **Normalisasi boundary**: timestamp di-clamp ke transcript, start di-snap ke awal baris, end ke batas baris berikutnya. Comedy dapat diperluas maksimal dua baris/8 detik ke setup dan sampai marker reaksi terdekat, tetap maksimal 75 detik. Duplikat identik di kategori yang sama dibuang; overlap antar kategori tetap boleh bila angle berbeda. Hasil diurutkan skor dan dipotong maksimal 6 per kategori. Warning dikirim bila kategori hanya memiliki kandidat kuat kurang dari enam.

### 4.3. Response sukses (`200`)

```json
{
  "clips": [
    {
      "id": "c1",
      "category": "comedy",
      "startTime": "00:01:20",
      "endTime": "00:01:55",
      "title": "Judul Hook",
      "summary": "Ringkasan 1 kalimat",
      "reason": "Alasan kenapa segmen ini viral",
      "transcript_snippet": "cuplikan transcript",
      "caption": "Caption gaya creator.\n\n#topik #konteks",
      "viralPotential": 92
    }
  ],
  "model": "gemini-3.5-flash-lite",
  "categories": ["comedy", "education"],
  "targetPerCategory": 6,
  "categoryCounts": {"comedy": 2, "education": 3},
  "warnings": []
}
```

| Field clip | Tipe | Keterangan |
|------------|------|------------|
| `id` | `string` | Mis. `"c1"` |
| `category` | `"comedy" \| "mystery" \| "education"` | Wajib pada clip Podcast; diabaikan pada Gaming. |
| `startTime`, `endTime` | `string` | Sudah dinormalisasi (`MM:SS`/`HH:MM:SS`), dalam rentang transcript |
| `title` | `string` | Judul hook (Indonesia bila podcast) |
| `summary` | `string` | Ringkasan 1 kalimat |
| `reason` | `string` | Alasan viral |
| `transcript_snippet` | `string` | Cuplikan pendukung |
| `caption` | `string` | 1–2 paragraf pendek gaya creator + ≤5 hashtag relevan, tanpa emoji |
| `viralPotential` | `number 0–100` | Skor viralitas |
| Top-level `model` | `string` | Model yang dipakai (`GEMINI_MODEL`) |
| Top-level `categories` | `string[]` | Kategori Podcast yang dipakai; Gaming mengembalikan tanpa kategori. |
| Top-level `targetPerCategory` | `number` | Selalu `6` untuk Podcast. |
| Top-level `categoryCounts` | `Record<string, number>` | Jumlah kandidat kuat setelah dedupe dan limit. |
| Top-level `warnings` | `string[]` | Catatan bila kategori tidak memiliki enam kandidat kuat; tidak ada filler lemah. |

Frontend lalu: `setClips`, pilih semua (`setSelectedIds`), pindah ke Step 2/3 (`SlicinView.tsx:278-282`).

### 4.4. Error

| Status | Body | Penyebab |
|--------|------|----------|
| `400` | `{ "error": "Missing transcript" }` | `transcript` kosong |
| `500` | `{ "error": "<pesan>", "model": "<model>", "hint": "..." }` | AI kosong / tidak ada array JSON / parse gagal setelah retry / error Gemini (hint: cek model/API key, kurangi panjang transcript) |

### 4.5. Contoh curl

```bash
curl -s http://localhost:3333/api/slicin/analyze \
  -H "Content-Type: application/json" \
  -d "{\"transcript\":[{\"start\":3,\"text\":\"komunikasi itu penting\"},{\"start\":33,\"text\":\"semua orang harus berkomunikasi\"}],\"videoPath\":\"video.mp4\",\"mode\":\"podcast\"}"
```

---

## 5. `POST /api/slicin/process` (legacy)

**Definisi:** `server.ts:945`. Tidak dipakai frontend aktif.

### 5.1. Request

```json
{
  "videoPath": "opsional, untuk konteks prompt",
  "mode": "podcast | gaming (string bebas, disisip ke prompt)",
  "transcript": "wajib — string atau array [{timeStr?, text}]"
}
```

Tanpa `transcript` → `400 { "error": "Provide transcript (obsidian markdown or lines). Use /api/slicin/parse-obsidian + /api/slicin/analyze" }`.

### 5.2. Perilaku

- Array transcript diformat `[timeStr] text` (pakai `timeStr`, bukan konversi detik), dipotong 30.000 char.
- Prompt minimal: `You are viral editor for ${mode}... Return ONLY valid JSON array... [{"id":"c1","startTime":"00:01:20","endTime":"00:01:55","context":"reason","viralPotential":90}]`.
- Panggil Gemini 2 lapis (JSON mime → plain), strip fence, ambil substring `[`…`]`, hapus trailing comma, `JSON.parse`.
- **Tidak ada**: JSON schema, repair escape, retry, normalisasi timestamp, caption Indonesia.

### 5.3. Response

- Sukses `200`: `{ "clips": [...] }` dengan item minimal `{id, startTime, endTime, context, viralPotential}`.
- Gagal `500`: `{ "error": "<pesan>" }` (mis. `"no json"`).

---

## 6. `POST /api/slicin/thumbnail`

**Definisi:** `server.ts:983`. Via `runFfmpegCommand()` (`server.ts:185`) + `ffmpeg -ss <time> -i <video> -vframes 1`.

### 6.1. Request

```json
{
  "videoPath": "C:/codingan/vexo/temp/downloads/....mp4",
  "time": 12.5
}
```

| Field | Tipe | Wajib | Keterangan |
|-------|------|-------|------------|
| `videoPath` | `string` | Ya | Path video di server. Tidak melalui `resolveVideoPath` — harus path yang valid langsung. |
| `time` | `number \| string` | Ya | Posisi detik frame. `undefined` → `400`. |

### 6.2. Response sukses (`200`)

```json
{
  "thumbPath": "C:/codingan/vexo/temp/thumbs/thumb_....jpg",
  "dataUrl": "data:image/jpeg;base64,/9j/4AAQ..."
}
```

`dataUrl` hanya ada bila file berhasil ditulis; bila tidak, response hanya `{ "thumbPath": "..." }`. File tersimpan di `temp/thumbs/thumb_<timestamp>_<rand>.jpg` (`-q:v 2`).

### 6.3. Error

| Status | Body | Penyebab |
|--------|------|----------|
| `400` | `{ "error": "Missing videoPath/time" }` | Field wajib absen |
| `500` | `{ "error": "<pesan ffmpeg>" }` | ffmpeg tidak ada / path salah / time di luar durasi |

### 6.4. Contoh curl

```bash
curl -s http://localhost:3333/api/slicin/thumbnail \
  -H "Content-Type: application/json" \
  -d "{\"videoPath\":\"C:/codingan/vexo/temp/downloads/video.mp4\",\"time\":12.5}"
```

---

## 7. `POST /api/slicin/cut` (export)

**Definisi:** `server.ts:1155`. **Frontend:** `SlicinView.exportClip()` (`SlicinView.tsx:325`) dan `exportSelected()` batch (`SlicinView.tsx:433`). Ini endpoint terbesar Context Slicer: potong + crop + caption + tulis `.md`.

Hasil selalu tersimpan di `temp/clips/` dan bisa diakses via static `/temp/clips/...`.

### 7.1. Request — semua field

```json
{
  "videoPath": "C:/codingan/vexo/temp/downloads/HYwS8HAzwRs_720_....mp4",
  "startTime": "00:01:20",
  "endTime": "00:01:55",
  "outputName": "vexo_..._c1_9x16.mp4",
  "aspectRatio": "9:16",
  "smartCrop": true,
  "faceTracks": [{ "time": 80, "x": 0.5, "y": 0.45, "width": 0.18, "height": 0.24 }],
  "sampleInterval": 0.25,
  "version": 3,
  "title": "Judul Hook",
  "caption": "Caption dari hasil analyze...",
  "subtitleLines": [{ "start": 80, "end": 85, "text": "kalimat..." }],
  "burnCaptions": false,
  "captionEngine": "whisper",
  "whisperModel": "small",
  "sourceName": "Nama channel / file",
  "sourceUrl": "https://www.youtube.com/watch?v=..."
}
```

| Field | Tipe | Wajib | Default / aturan | Keterangan |
|-------|------|-------|------------------|------------|
| `videoPath` | `string` | Ya | — | Diresolve via `resolveVideoPath()` (absolute → basename di `downloads/clips/uploads/temp/cwd`). Tidak ketemu → `400 Video file not found...`. |
| `startTime`, `endTime` | `string` | Ya | — | `MM:SS`/`HH:MM:SS`. Dikonversi ke detik; `duration = end-start` harus `> 0`, else `400 Rentang waktu tidak valid`. |
| `outputName` | `string` | Tidak | `cut_<Date.now()>.mp4` | Nama file di `temp/clips/`. Frontend selalu mengisi (`vexo_raw_...` untuk potongan mentah, `vexo_..._<aspect>.mp4` untuk final). |
| `aspectRatio` | `"9:16" \| "1:1" \| "4:5" \| "original"` | Tidak | `"original"` ( Evidence: `vfFor` else-branch → `scale=1280:720`) | Menentukan filter crop+scale (lihat 7.3). |
| `smartCrop` | `boolean` | Tidak | `false` | `true` + track cukup + durasi cukup → mode dinamis face-follow; bila tidak → static crop. |
| `faceTracks` | `Array<{time,x,y,width,height}>` | Tidak | `[]` | Koordinat ternormalisasi 0–1. Dinormalisasi (`normalizeFaceTracks`), diisi yang bolong, dihaluskan (`smoothFaceTracks`: median window-3 + EMA dua arah α=0.18, clamp ukuran 0.02–0.95). `height` default `width*1.35` bila absen. |
| `sampleInterval` | `number` | Tidak | `0.25` (diclamp `0.2–2`) | Hanya memengaruhi fallback segmented (jumlah segmen ≈ durasi/interval). Mode per-frame memakai downsample maks 96 titik ekspresi. |
| `version` | `number` | Tidak | `3` | `1` = crop + kotak hijau debug; `2` = kotak hijau + titik posisi; `3` = bersih tanpa overlay. Frontend selalu kirim `3`. |
| `title` | `string` | Tidak | `"Context Slicer"` | Dipakai untuk nama file `.md` caption + isi caption. |
| `caption` | `string` | Tidak | dibuatkan fallback | Dibersihkan via `cleanCaption()` (buang emoji, batasi 5 hashtag, rapikan spasi/newline). Fallback: `"Di bagian ini, <title> dibahas dari <start> sampai <end>."`. Selalu ditambah atribusi `\n\nSrc: <sourceName>\nLink: <sourceUrl>` bila ada (`buildSourceAttribution`). |
| `subtitleLines` | `TranscriptLine[]` | Tidak | `[]` | Hanya dipakai bila `burnCaptions=true` **dan** `captionEngine != "whisper"` → dibuat file `.ass` sementara (style Arial 44, 720×1280, alignment bawah-tengah) lalu diburn via filter `subtitles`. |
| `burnCaptions` | `boolean` | Tidak | `false` | `true` = bakar subtitle ke video. Dua jalur: (a) `captionEngine="whisper"` → transcribe ulang hasil potongan via Python faster-whisper lalu burn; (b) lainnya → burn dari `subtitleLines`. Butuh ffmpeg `libass` untuk jalur (b). |
| `captionEngine` | `string` | Tidak | — | Hanya nilai `"whisper"` yang spesial (mengaktifkan jalur Whisper). Nilai lain/blank → jalur `.ass` dari `subtitleLines`. |
| `whisperModel` | `"small"` atau `"medium"` | Tidak | `"small"` | Dipakai saat `burnCaptions=true` dan `captionEngine="whisper"`. Model dipetakan ke folder lokal `models/faster-whisper-small` atau `models/faster-whisper-medium`; jika `config.json` tidak ada, export gagal dengan pesan instalasi yang jelas. |
| `sourceName`, `sourceUrl` | `string` | Tidak | — | Ditulis ke file `.md` dan footer caption. Frontend mengisi dari info download YouTube / nama file upload. |

Dua pola pemanggilan frontend (smart-crop aktif, `SlicinView.tsx:340-419`):

1. **Pass 1 — potongan mentah:** `aspectRatio:"original", smartCrop:false, burnCaptions:false, subtitleLines:[], faceTracks:[]` → simpan `rawExports`.
2. **Pass 2 — final:** `videoPath=<hasil pass 1>`, `startTime:"00:00:00"`, `endTime=<durasi clip>`, `aspectRatio=<pilihan>`, `smartCrop:true`, `faceTracks=<hasil /api/face/detect atas potongan mentah>`, `subtitleLines=<transcript digeser relatif>`.

Tanpa smart-crop / aspect `original`: cukup 1× panggil langsung dari video sumber.

### 7.2. Response sukses (`200`)

```json
{
  "success": true,
  "outputPath": "C:/codingan/vexo/temp/clips/vexo_..._c1_9x16.mp4",
  "captionPath": "C:/codingan/vexo/temp/clips/judul_hook_00-01.md",
  "caption": "Caption final + footer Src/Link",
  "aspectRatio": "9:16",
  "smartCrop": true,
  "mode": "per-frame-smooth",
  "interval": 0.25,
  "version": 3,
  "xExprLen": 1234
}
```

| Field | Keterangan |
|-------|------------|
| `outputPath` | Path absolut MP4 hasil (bila Whisper aktif: varian `*_captioned.mp4`; file mentah dihapus). Selalu divalidasi `assertValidVideoOutput` (ada + ≥4096 bytes). |
| `captionPath` | Path absolut file `.md` (`# <Title>\n\nWaktu: <start> sampai <end>\n\n<caption+atribusi>`). Nama: `<safeTitle>_<safeStart>.md`. |
| `caption` | Teks caption final yang juga ditulis ke `.md`. |
| `mode` | `"static"` (1-pass crop) \| `"per-frame-smooth"` (1-pass ekspresi `x(t)` halus) \| `"dynamic"` (fallback potong-per-segmen + concat). |
| `segments` | Hanya bila `mode:"dynamic"` — jumlah segmen. |
| `interval`, `version`, `xExprLen` | Gema parameter + panjang ekspresi crop (debug). |

Efek samping file: MP4 di `temp/clips/`, `.md` caption di `temp/clips/`, file `.ass` sementara selalu dihapus (`finally`), direktori `_seg_*` sementara dihapus setelah concat.

### 7.3. Mesin render (ringkas, sesuai kode)

- **Static** (`!useDynamic`): 1 perintah ffmpeg `-ss <s> -t <dur> -vf "<crop>[,subtitles],setpts=PTS-STARTPTS" -c:v libx264 -preset fast -crf 18 -c:a aac ... -movflags +faststart`. Posisi crop = rata-rata face-track relevan bila smartCrop, else tengah (`x=0.5`).
  - `9:16` → `crop=ih*9/16:ih:(in_w-ih*9/16)*x:0,scale=720:1280`
  - `1:1` → `crop=ih:ih:(in_w-ih)*x:0,scale=720:720`
  - `4:5` → `crop=ih*4/5:ih:(in_w-ih*4/5)*x:0,scale=720:900`
  - `original`/lain → `scale=1280:720`
- **Per-frame smooth** (prioritas bila `smartCrop && tracks≥2 && aspect≠original/16:9 && durasi>interval`): bangun ekspresi `x(t)` interpolasi smoothstep antar sampel (downsample ≤96 titik, `<8000` char) → 1 perintah ffmpeg dengan `crop=...*(<xExpr>)...`. Gagal → jatuh ke segmented.
- **Segmented fallback**: potong per `interval` detik dengan crop per-segmen (posisi = interpolasi tengah segmen), lalu concat re-encode (`concat` demuxer + `setpts`, `aresample`).
- **Whisper caption** (`burnCaptions && captionEngine==="whisper"`): setelah render utama, model yang dipilih (`whisperModel`, default `small`) dijalankan melalui `transcribe_clip.py` → `.ass` → pass ffmpeg kedua (`_captioned.mp4`).
- Audio selalu: `-map 0:v:0 -map 0:a:0? -af aresample=async=1:first_pts=0,asetpts=PTS-STARTPTS`.

### 7.4. Error

| Status | Body | Penyebab |
|--------|------|----------|
| `400` | `{ "error": "Missing required parameters" }` | `videoPath/startTime/endTime` absen |
| `400` | `{ "error": "Video file not found on server: ..." , "hint": "Di Step 1 klik Pilih File ..." }` | File tidak ada di disk setelah resolve |
| `400` | `{ "error": "Rentang waktu tidak valid: ..." }` | `end ≤ start` / tidak numerik |
| `500` | `{ "error": "<pesan ffmpeg>", "hint"? }` | Gagal ffmpeg (termasuk hint khusus bila filter `subtitles/libass` tidak tersedia), Whisper kosong/gagal, output <4096 bytes, wajah tidak terdeteksi (dilempar frontend bila track kosong — bukan server) |

### 7.5. Contoh curl

```bash
# 1) Potongan statis 9:16 tanpa smart-crop
curl -s http://localhost:3333/api/slicin/cut \
  -H "Content-Type: application/json" \
  -d "{\"videoPath\":\"C:/codingan/vexo/temp/downloads/video.mp4\",\"startTime\":\"00:01:20\",\"endTime\":\"00:01:55\",\"title\":\"Judul Hook\",\"caption\":\"Caption...\",\"outputName\":\"vexo_test_c1_9x16.mp4\",\"aspectRatio\":\"9:16\",\"smartCrop\":false,\"burnCaptions\":false,\"version\":3,\"sourceName\":\"Helmy Yahya\",\"sourceUrl\":\"https://www.youtube.com/watch?v=HYwS8HAzwRs\"}"

# 2) Dengan burn caption dari subtitleLines
curl -s http://localhost:3333/api/slicin/cut \
  -H "Content-Type: application/json" \
  -d "{\"videoPath\":\"C:/codingan/vexo/temp/downloads/video.mp4\",\"startTime\":\"00:00:10\",\"endTime\":\"00:00:40\",\"title\":\"T\",\"caption\":\"C\",\"aspectRatio\":\"9:16\",\"smartCrop\":false,\"burnCaptions\":true,\"subtitleLines\":[{\"start\":10,\"end\":15,\"text\":\"Halo semua\"}],\"version\":3}"
```

---

## 8. Referensi cepat: file & fungsi

| Lokasi | Isi |
|--------|-----|
| `server.ts:251` `parseObsidianLine()` | Parser markdown server |
| `server.ts:137-165` `timestampSeconds/timestampString/normalizeClipTimestamps` | Konversi & repair timestamp clip |
| `server.ts` `buildSlicinClipResponseSchema()` | JSON schema Gemini analyze; dinamis menurut mode dan kategori |
| `server.ts:453,709,945,983,1155` | Definisi 5 endpoint |
| `server.ts:103-135` `safeFilePart/cleanCaption/buildSourceAttribution` | Sanitasi caption & nama file |
| `server.ts:185,208` `runFfmpegCommand/assertValidVideoOutput` | Eksekusi & validasi ffmpeg |
| `server.ts` `transcribeClipViaPython()` | Whisper lokal (`src/python/transcribe_clip.py`, model `models/faster-whisper-small` / `WHISPER_MODEL`) |
| `server.ts:1044-1152` `smoothFaceTracks/buildTrackExpr/buildXExpr` | Smoothing & ekspresi face-follow |
| `src/components/SlicinView.tsx` | UI 3-step + semua pemanggilan `fetch` |
| `src/lib/obsidianParser.ts` | Parser lokal + `TranscriptLine`, `timeToSeconds`, `secondsToTime` |
| `src/example_obsidian/obs.md` | Contoh transcript realistis (Helmy Yahya, 1266 baris) |
| `src/context/ApiKeyContext.tsx` | `effectiveApiKey` → field `apiKey` di `/analyze` |
