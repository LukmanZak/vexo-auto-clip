# Context Slicer: Tahapan sampai Clip Siap Upload

Dokumen ini menjelaskan alur clip di Vexo, mulai dari sumber video sampai file final yang berada di `temp/clips` dan siap diunggah ke platform short-form.

## Alur singkat

```text
Input video + transcript
        ↓
Parse transcript
        ↓
Analyze Gemini
        ↓
Pilih kategori dan kandidat clip
        ↓
Export / Cut FFmpeg
        ↓
Face-follow dan crop ratio (opsional)
        ↓
Whisper caption (opsional)
        ↓
Validasi audio/video + caption sidecar
        ↓
temp/clips/*.mp4  ← siap upload
```

## 1. Input video

Video dapat berasal dari dua jalur:

- **Download YouTube**: URL diproses oleh `yt-dlp` + FFmpeg dan disimpan di `temp/downloads`.
- **File dari folder**: browser mengunggah file ke server lokal; server menyimpannya di `temp/uploads`.

Setelah salah satu jalur selesai, `videoPath` aktif menjadi sumber untuk Analyze dan Cut. File asli tidak dipotong pada tahap ini.

## 2. Parse transcript

Transcript Obsidian diparse menjadi baris timestamp. Timestamp duplikat digabung, semua teks pada detik yang sama dipertahankan, dan marker seperti `[tertawa]` tidak dibuang. Escape Markdown seperti `\\[tertawa\\]` dinormalisasi menjadi `[tertawa]`.

`end` setiap baris mengikuti timestamp berikutnya. Baris terakhir memakai batas aman dari durasinya.

## 3. Analyze konteks

Pada mode Podcast, pilih minimal satu kategori:

- **Comedy**: setup → eskalasi → punchline → reaksi.
- **Mystery**: pertanyaan/hal aneh → jawaban atau reveal.
- **Edukasi**: pertanyaan/mitos → penjelasan → kesimpulan.

Satu prompt gabungan membaca transcript sebagai konteks utuh. Setiap kategori mengembalikan maksimal 6 kandidat kuat. Jika kandidat kuat kurang dari 6, Vexo menampilkan warning dan tidak mengisi slot dengan clip lemah.

Mode Gaming tetap memakai alur gaming lama. Semua clip yang dikembalikan otomatis terpilih.

## 4. Menentukan batas clip

Server melakukan post-processing terhadap timestamp dari AI:

- clamp ke rentang transcript;
- snap awal ke batas baris transcript;
- snap akhir ke batas baris berikutnya;
- target durasi Podcast 15–75 detik;
- khusus Comedy, awal dapat diperluas maksimal dua baris atau 8 detik sebelum punchline;
- akhir dapat diperluas sampai marker reaksi terdekat, tetap maksimal 75 detik;
- clip identik dalam kategori yang sama dihapus;
- overlap antar kategori diperbolehkan jika angle, judul, dan alasannya berbeda.

## 5. Export clip

Klik **Lanjut Export**, pilih ratio, lalu export satu clip atau seluruh clip terpilih secara berurutan.

### Export biasa

FFmpeg mengambil langsung rentang `startTime–endTime` dari video sumber, lalu re-encode ke MP4 H.264/AAC dengan timestamp audio/video yang di-reset dan `faststart`.

### Face-follow crop

Jika ratio bukan `original` dan **Face-follow crop** aktif:

1. Vexo membuat potongan sementara dalam ratio original.
2. Model MediaPipe Tasks memakai `public/src/model/face_landmarker.task` untuk membaca beberapa sample wajah.
3. Koordinat dinormalisasi, di-interpolasi, di-median-filter, dan di-smooth dua arah.
4. Crop akhir mengikuti pusat wajah dan selalu di-clamp agar tidak keluar frame.
5. Audio diproses ulang bersama video agar tetap sinkron.

Jika tidak ada wajah, gunakan crop tengah atau matikan Face-follow untuk export biasa.

## 6. Caption

Caption dari Gemini dibersihkan sebelum disimpan: tanpa emoji, maksimal lima hashtag, dan ditambah sumber bila tersedia.

- `burnCaptions = false`: video tetap bersih; caption tersedia sebagai file `.md`.
- `burnCaptions = true`: Whisper Small lokal membuat word timestamps, lalu caption dibakar ke video final.

Whisper hanya berjalan ketika checkbox caption diaktifkan.

## 7. Isi folder `temp/clips`

| Jenis file | Kegunaan | Siap di-upload? |
|---|---|---|
| `vexo_*_9x16.mp4`, `vexo_*_1x1.mp4`, `vexo_*_4x5.mp4`, `vexo_*_original.mp4` | Video final hasil export | **Ya** |
| `*_captioned.mp4` | Video final setelah Whisper caption | **Ya**, pilih ini sebagai versi caption |
| `*.md` | Judul, waktu clip, caption, dan sumber/link | Tidak sebagai video; gunakan sebagai copy caption |
| `vexo_raw_*` | Potongan original sementara untuk tracking wajah | Tidak |
| `_seg_*` | Pecahan interval sementara untuk dynamic crop | Tidak |
| `_*\.ass` | File subtitle sementara FFmpeg/Whisper | Tidak |

Untuk upload, ambil hanya MP4 final. Jika ada pasangan `*_captioned.mp4` dan MP4 tanpa suffix, gunakan `*_captioned.mp4` bila ingin subtitle sudah terlihat di video.

## 8. Checklist sebelum upload

- Ratio sesuai platform: `9:16` untuk Shorts/Reels/TikTok, `1:1` atau `4:5` bila diperlukan.
- Durasi clip berada di sekitar 15–75 detik dan tidak memotong setup atau jawaban.
- Audio terdengar sejak awal dan tidak bergeser dari gambar di tengah/akhir.
- Wajah tetap berada dalam frame jika Face-follow digunakan.
- Caption `.md` sudah memuat judul, caption natural, hashtag yang relevan, dan `Src`.
- Upload MP4 final, bukan file `raw`, folder `_seg`, `.ass`, atau file sementara lainnya.

## 9. Pemetaan file ke metadata

Nama MP4 memakai ID clip dan ratio, misalnya:

```text
vexo_1789523776152_comedy-1_1x1_captioned.mp4
```

File `.md` pasangannya menyimpan:

```md
# Judul clip

Waktu: 07:53 sampai 08:32

Caption natural...

Src: Nama channel
Link: https://www.youtube.com/...
```

Jadi proses publikasi praktisnya adalah: upload MP4 final ke platform, lalu salin isi caption dari file `.md` ke kolom deskripsi/caption platform.

## 10. Review caption sebelum upload browser

Caption yang ada di file `.md` adalah **draft hasil Analyze**, bukan versi yang wajib dipublikasikan tanpa pemeriksaan. Sebelum membuka TikTok atau Instagram, betulkan caption agar benar-benar sesuai dengan isi clip.

Checklist review:

- Pastikan caption membahas isi video yang benar, bukan hanya judulnya.
- Pertahankan konteks penting: setup, punchline, pertanyaan, jawaban, atau kesimpulan.
- Gunakan Bahasa Indonesia yang natural dan terdengar seperti creator.
- Hapus kalimat kaku, klaim baru, emoji, dan em dash.
- Pertahankan hanya hashtag yang relevan, maksimal lima.
- Pastikan `Src` dan link sumber tidak salah.
- Sesuaikan panjang caption dengan platform dan jangan menambahkan informasi yang tidak ada di transcript.

Setelah selesai, gunakan caption yang sudah dibetulkan sebagai versi final. File `.md` boleh diedit langsung agar menjadi arsip caption yang benar-benar dipakai.

## 11. Upload melalui browser session

Gunakan browser session yang sudah login ke akunmu dan kerjakan satu clip sampai selesai sebelum lanjut ke clip berikutnya.

### TikTok

1. Pilih MP4 final dari `temp/clips`.
2. Buka halaman upload TikTok.
3. Upload video.
4. Salin caption final dari file `.md` yang sudah direview.
5. Atur cover, siapa yang dapat melihat video, dan opsi publikasi sesuai kebutuhan.
6. Publish, lalu tunggu sampai proses upload selesai.

### Instagram Reels

1. Buka halaman pembuatan Reel di browser session yang sama.
2. Upload MP4 final.
3. Tempel caption final yang sudah direview.
4. Pilih cover/frame yang paling jelas dan atur audience bila diminta.
5. Publish, lalu tunggu sampai Reel selesai diproses.

Jangan mengunggah file `vexo_raw_*`, folder `_seg_*`, `.ass`, atau MP4 sementara. Jika ada dua versi video, gunakan `*_captioned.mp4` bila subtitle ingin terlihat di video; gunakan MP4 tanpa suffix tersebut bila caption cukup ditulis di kolom deskripsi.

## 12. Jika perlu export ulang

Kembali ke Wizard 2 untuk mengubah kategori atau memilih kandidat lain, lalu masuk Wizard 3 lagi. Mengubah ratio, Face-follow, atau Whisper membuat output baru dengan nama unik sehingga hasil sebelumnya tidak tertimpa.

Endpoint teknis dan contoh request tersedia di [CONTEXT_SLICER_API.md](./CONTEXT_SLICER_API.md).
