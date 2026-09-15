# Context Slicer — Setup Lokal

Dokumen ini menjelaskan dependency dan file model yang diperlukan untuk menjalankan Context Slicer di Windows. README utama project masih berisi instruksi umum AI Studio, jadi setup khusus Context Slicer ada di sini.

## 1. Prasyarat sistem

Install dan pastikan semuanya tersedia di `PATH`:

- Node.js LTS dan npm
- Python 3.11–3.13
- FFmpeg (harus menyediakan `ffmpeg` dan `ffprobe`)
- Git, jika project diambil dari repository

Verifikasi dari PowerShell:

```powershell
node --version
npm --version
python --version
ffmpeg -version
ffprobe -version
```

Jika FFmpeg tidak ada di `PATH`, set path executable di `.env`:

```env
FFMPEG_PATH=C:\ffmpeg\bin\ffmpeg.exe
```

## 2. Install dependency JavaScript

Jalankan dari root project:

```powershell
npm install
```

Server dijalankan dengan:

```powershell
npm run dev
```

Port default aplikasi adalah `3333`, buka `http://localhost:3333`.

## 3. Install dependency Python

Context Slicer memakai Python untuk face tracking dan caption Whisper:

```powershell
python -m pip install --upgrade pip
python -m pip install -r src/python/requirements-whisper.txt
python -m pip install opencv-python mediapipe
```

`yt-dlp` juga dapat dipasang lewat Python. Ini menjadi fallback bila executable `yt-dlp.exe` tidak ditemukan:

```powershell
python -m pip install --upgrade yt-dlp
```

Server akan mencoba executable `yt-dlp` terlebih dahulu, lalu fallback ke `python -m yt_dlp`.

## 4. Model yang diperlukan

### Face tracking

File berikut sudah ada di repository dan tidak perlu di-install ulang:

- `public/src/model/face_landmarker.task`
- `src/model/blaze_face_short_range.tflite`
- `public/src/model/blaze_face_short_range.tflite`

Python tracker memprioritaskan MediaPipe Tasks/BlazeFace dan memiliki fallback bila salah satu API tidak tersedia.

### Whisper Small

Caption otomatis sekarang memakai **faster-whisper Small**, bukan Medium. Konfigurasi default ada di `.env`:

```env
WHISPER_MODEL=small
```

Aplikasi akan memprioritaskan folder lokal berikut:

```text
models/faster-whisper-small/
```

Folder tersebut berisi `config.json`, `model.bin`, `tokenizer.json`, dan `vocabulary.txt`. Model lokal tidak masuk Git karena ukurannya besar. Pada project ini model Small sudah disiapkan secara lokal (sekitar 483 MB).

Jika setup di komputer baru, download sekali dengan Python:

```powershell
python -c "from faster_whisper.utils import download_model; print(download_model('small', output_dir='models/faster-whisper-small'))"
```

Setelah folder model tersedia, export caption tidak perlu mengunduh model lagi. Jika Hugging Face gagal karena SSL perusahaan/proxy, download folder model pada koneksi yang valid lalu copy ke path tersebut.

## 5. File `.env`

Buat atau edit `.env` di root project. Jangan commit API key ke Git.

```env
GEMINI_API_KEY=isi_api_key_gemini
PORT=3333
WHISPER_MODEL=small
MAX_UPLOAD_GB=4
```

Keterangan:

- `GEMINI_API_KEY`: diperlukan untuk Analyze transcript.
- `PORT`: default `3333`.
- `WHISPER_MODEL`: default `small`; bila diisi path model, path tersebut dipakai.
- `MAX_UPLOAD_GB`: batas upload file lokal dari browser, default 4 GB.

Setelah mengubah `.env`, restart `npm run dev`.

## 6. Alur sumber video

- URL YouTube: server menjalankan `yt-dlp` lalu menyimpan hasil ke `temp/downloads`.
- File dari folder: browser mengirim file ke server lokal, lalu server menyimpan hasilnya ke `temp/uploads`.
- Browser tidak dapat memberikan path Windows mentah ke JavaScript. Karena itu file lokal tetap perlu ditransfer ke server lokal; pastikan ruang disk cukup.

## 7. Validasi instalasi

Jalankan pemeriksaan project:

```powershell
npm run lint
npm run build
python -m unittest src/python/test_transcribe_clip.py
```

Untuk memastikan model Whisper bisa dipakai, jalankan pada video pendek:

```powershell
python src/python/transcribe_clip.py path\ke\clip.mp4 --model models\faster-whisper-small
```

Output yang benar berupa JSON dengan field `captions`, `wordCount`, `language`, `model`, dan `device`.

## 8. Troubleshooting singkat

### `Python tidak ditemukan`

Install Python dari python.org dan centang **Add Python to PATH**, kemudian buka terminal baru.

### `faster-whisper belum terinstall`

```powershell
python -m pip install -r src/python/requirements-whisper.txt
```

### `ffmpeg is not recognized`

Install FFmpeg, tambahkan folder `bin` ke `PATH`, atau isi `FFMPEG_PATH` di `.env`.

### `File terlalu besar`

Naikkan batas upload, lalu restart server:

```env
MAX_UPLOAD_GB=8
```

### Caption terasa lambat

Whisper Small lebih ringan daripada Medium, tetapi tetap membutuhkan waktu CPU. Caption hanya dijalankan jika checkbox **Caption sinkron Whisper Small** di Wizard 3 diaktifkan.
