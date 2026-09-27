# Context Slicer — Setup Lokal

Dokumen ini menjelaskan dependency dan file model yang diperlukan untuk menjalankan Context Slicer di Windows. README utama project masih berisi instruksi umum AI Studio, jadi setup khusus Context Slicer ada di sini.

## 1. Prasyarat sistem

Install dan pastikan semuanya tersedia di `PATH`. Untuk hasil paling konsisten, gunakan virtual environment project `.venv` atau `venv`; server akan memprioritaskan Python dari virtual environment tersebut.

- Node.js LTS dan npm
- Python 3.11–3.13
- FFmpeg (harus menyediakan `ffmpeg` dan `ffprobe`)
- Git, jika project diambil dari repository

Contoh membuat dan mengaktifkan virtual environment di Windows:

```powershell
py -3.11 -m venv .venv
.\.venv\Scripts\Activate.ps1
```

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

Server akan mencoba executable `yt-dlp` terlebih dahulu, lalu fallback ke `python -m yt_dlp`. Python dari `.venv`/`venv` project akan dipakai lebih dulu; bila memakai instalasi Python lain, isi `PYTHON_PATH` di `.env` secara eksplisit.

## 4. Model yang diperlukan

### Face tracking

File model face tracking yang dipakai project:

- `public/face_landmarker.task` (browser)
- `public/src/model/face_landmarker.task`
- `src/model/blaze_face_short_range.tflite`
- `public/src/model/blaze_face_short_range.tflite`

`src/model/blaze_face_short_range.tflite` adalah lokasi utama Python tracker. Salinan di `public/src/model/` menjadi fallback bila lokasi utama tidak ada. Python tracker memprioritaskan BlazeFace TFLite, lalu MediaPipe Solutions, MediaPipe Tasks, dan Haar cascade.

### Whisper Small dan Medium

Pilih model **Small** atau **Medium** pada opsi caption di halaman Export. Siapkan folder lokal yang sesuai:

```text
models/faster-whisper-small/
models/faster-whisper-medium/
```

Folder tersebut berisi `config.json`, `model.bin`, dan `tokenizer.json`. Model lokal tidak masuk Git karena ukurannya besar, sehingga folder ini tidak dijamin ikut ketika project di-clone. Jika belum ada, download model yang dipilih sekali dengan Python:

```powershell
python -c "from faster_whisper.utils import download_model; print(download_model('small', output_dir='models/faster-whisper-small'))"
```

Setelah folder model tersedia, export caption tidak perlu mengunduh model lagi. Jika Hugging Face gagal karena SSL perusahaan/proxy, download folder model pada koneksi yang valid lalu copy ke path tersebut.

## 5. File `.env`

Buat atau edit `.env` di root project. Jangan commit API key ke Git.

```env
GEMINI_API_KEY=isi_api_key_gemini
PORT=3333
MAX_UPLOAD_GB=4
```

Keterangan:

- `GEMINI_API_KEY`: diperlukan untuk Analyze transcript.
- `PORT`: default `3333`.
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

Jika memakai virtual environment, jalankan perintah Python dengan environment tersebut aktif. Server juga otomatis mencarinya di `.venv` lalu `venv`; gunakan `PYTHON_PATH` bila ingin memilih interpreter tertentu.

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
