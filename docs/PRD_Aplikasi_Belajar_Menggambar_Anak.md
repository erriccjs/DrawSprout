# PRD — Aplikasi Tablet untuk Anak Belajar Menggambar

Versi: 1.1  
Tanggal: 10 Oktober 2026  
Product owner: Eric  
Status: Draft implementasi; konsep utama disepakati, asumsi dan target perlu divalidasi  
Nama produk: Belum ditentukan  
Platform MVP: web app/PWA yang dioptimalkan untuk tablet; Safari di iPad dan Chrome di Android tablet menjadi target uji utama. Native dievaluasi setelah pengujian drawing.

## 1. Ringkasan produk

Aplikasi membantu anak belajar menggambar melalui tahapan kecil di atas kanvas digital. Anak memilih gambar dari katalog atau mengambil foto dari kamera/galeri. Foto ditransformasikan menjadi ilustrasi sederhana yang tetap mempertahankan kemiripan dengan objek asli. Pengguna menyetujui preview tersebut sebelum pelajaran dibuat dan dimulai.

Pada setiap tahap, aplikasi menampilkan petunjuk, menyiapkan warna serta ukuran pen, dan membiarkan anak menggambar sendiri. Bantuan dapat berupa garis putus-putus yang tetap terlihat, petunjuk yang menghilang setelah beberapa detik, atau contoh tanpa tracing. Setelah menggambar, anak mewarnai per bagian, menambahkan kreasi, dan menyimpan hasil.

Nilai utama: anak dapat menggambar objek yang dekat dengan kehidupannya, dengan bantuan yang berkurang secara bertahap tanpa menghilangkan kebebasan berekspresi.

## 2. Masalah dan tujuan

### Masalah pengguna

- Kanvas kosong sulit dihadapi anak yang belum tahu harus mulai dari bagian mana.
- Tutorial video menuntut anak membagi perhatian antara contoh dan kanvas serta mengatur jeda sendiri.
- Drawing pad biasa menyediakan alat, tetapi tidak menyediakan urutan belajar.
- Tracing saja belum membuktikan anak dapat menggambar tanpa bantuan.
- Transformasi kartun yang berlebihan dapat menghilangkan kemiripan dengan foto yang dipilih anak.

### Tujuan produk

1. Membantu anak menyelesaikan satu karya melalui tahapan yang mudah dipahami.
2. Mempertahankan ciri objek asli dalam ilustrasi yang lebih mudah digambar.
3. Mengurangi kebutuhan orang tua menjelaskan setiap langkah.
4. Memungkinkan pengurangan bantuan tanpa harus mengganti gambar target.
5. Menyimpan proses serta karya anak secara andal.

### Bukan tujuan versi awal

- Aplikasi ilustrasi profesional atau editor foto umum.
- Reproduksi foto secara fotorealistis.
- Penilaian bakat atau diagnosis kemampuan perkembangan anak.
- Jejaring sosial, chat, galeri publik, atau kompetisi antaranak.
- Dukungan semua jenis foto dan semua gaya menggambar sejak peluncuran.

## 3. Keputusan yang sudah disepakati dan asumsi

| Area | Keputusan / asumsi | Status |
| --- | --- | --- |
| Sumber gambar | Katalog, kamera, dan galeri | Disepakati untuk produk tujuan |
| Transformasi | Ilustrasi sederhana dengan kemiripan tinggi; tanpa deformasi kartun berlebihan | Disepakati |
| Preview | Pengguna menyetujui ilustrasi sebelum mulai menggambar | Disepakati |
| Konsistensi | Semua tahap berasal dari satu gambar target yang dikunci | Disepakati |
| Bantuan | Garis terlihat, petunjuk sementara, dan mode mandiri | Disepakati |
| Alat | Warna dan ketebalan otomatis, tetap dapat diubah | Disepakati |
| Navigasi | Lanjut manual tersedia; deteksi otomatis membantu | Disepakati |
| Penyelesaian | Menggambar, mewarnai, lalu menyimpan | Disepakati |
| Usia pilot | 6–8 tahun sebagai hipotesis awal | Perlu validasi |
| Durasi sesi | Sekitar 10–20 menit, tanpa batas waktu wajib | Hipotesis UX |
| Platform MVP | Web/PWA tablet-first; native berdasarkan gate kualitas drawing | Disepakati 10 Oktober 2026 |
| Perangkat pilot | iPad + Apple Pencil dan Android tablet + stylus aktif; model dan versi browser dicatat saat pengujian | Model perangkat belum dipilih |
| Bahasa | Bahasa Indonesia dahulu | Usulan |
| Monetisasi | Belum ditentukan sebelum validasi pengalaman belajar | Terbuka |

Angka performa, metrik keberhasilan, jadwal, dan ambang evaluasi di dokumen ini adalah target desain awal, bukan hasil pengujian atau komitmen vendor.

## 4. Pengguna dan pekerjaan yang ingin diselesaikan

| Pengguna | Kebutuhan | Indikator keberhasilan |
| --- | --- | --- |
| Anak pemula | Tahu harus menggambar apa dan di mana | Menyelesaikan pelajaran dengan sedikit bantuan orang dewasa |
| Anak yang mulai mandiri | Tantangan tanpa petunjuk terus-menerus | Menggambar ulang dengan bantuan lebih sedikit |
| Orang tua | Aktivitas kreatif yang mudah dimulai dan aman | Dapat menyiapkan sesi dan melihat hasil tanpa pengaturan rumit |
| Pengelola konten | Membuat dan memperbaiki pelajaran | Template tervalidasi dapat diterbitkan tanpa mengubah aplikasi |

User stories utama:

- Sebagai anak, saya ingin menggambar kucing atau anggota keluarga yang saya kenali.
- Sebagai anak, saya ingin melihat contoh satu bagian saja agar tidak bingung.
- Sebagai anak, saya ingin memilih warna sendiri dan tetap bisa melanjutkan.
- Sebagai anak, saya ingin memunculkan petunjuk kembali ketika lupa.
- Sebagai orang tua, saya ingin menyetujui pemrosesan foto dan menghapusnya.
- Sebagai orang tua, saya ingin karya tidak hilang ketika aplikasi ditutup.

## 5. Scope dan strategi rilis

### Tahap A — Prototipe pengalaman inti

Satu pelajaran yang dibuat manual, misalnya kucing dengan 6–8 tahap bentuk/detail ditambah tahap warna. Mencakup kanvas, dua mode petunjuk, preset alat, lanjut manual, undo/redo, autosave, dan ekspor.

Tujuan: membuktikan anak memahami alur. Tahap A bukan implementasi lengkap fitur foto dan tidak boleh dipresentasikan seolah-olah telah membuktikan kemampuan AI.

### Tahap B — MVP pilot

- Satu codebase web/PWA tablet-first, diuji di Safari iPad dan Chrome Android tablet.
- Mode browser biasa dan PWA Home Screen; mendukung mode pencil dan mode jari.
- App shell serta paket pelajaran dapat diunduh untuk penggunaan offline; AI foto tetap membutuhkan jaringan.
- Sekitar 10 template sederhana yang direview manusia.
- Mode garis terlihat dan petunjuk sementara; mode mandiri sederhana.
- Menggambar, mewarnai, pilihan warna bebas, autosave, galeri lokal, ekspor PNG.
- Kamera/galeri sebagai fitur beta terbatas: satu objek utama, foto cukup jelas, latar sederhana atau dapat dipisahkan.
- Preview sebelum menggambar, crop/pilih objek, regenerasi terbatas.
- Pipeline foto harus melewati evaluasi kemiripan dan keterajaran sebelum dibuka untuk pilot.
- Jika pipeline belum lolos, rilis pilot template-only dengan status keterbatasan yang jelas; jangan menyatakan MVP foto sudah selesai.

### Tahap C — Setelah validasi

Deteksi selesai otomatis, aplikasi native jika gate migrasi terpenuhi, lebih banyak kategori foto, adaptasi bantuan berbasis riwayat lokal, sinkronisasi akun orang tua, dan pembayaran. Prioritas ditentukan hasil pilot, bukan ditambahkan seluruhnya sekaligus.

## 6. Perjalanan pengguna

1. Buka aplikasi → pilih pelajaran baru atau lanjutkan karya.
2. Pilih katalog, kamera, atau galeri.
3. Untuk foto: izin yang diperlukan → pilih/crop objek → persetujuan unggah orang tua jika diproses di server.
4. Sistem menyiapkan ilustrasi → pengguna membandingkan foto dan preview.
5. Pengguna memilih gunakan, lebih mirip foto, lebih sederhana, atau ganti foto. Permintaan tidak menjamin generasi berikutnya lebih baik; hasil tetap harus dipreview.
6. Setelah disetujui, ilustrasi dikunci dan struktur pelajaran disiapkan serta divalidasi.
7. Pilih bantuan → mulai menggambar dari bentuk besar, kemudian detail.
8. Setiap tahap menyiapkan alat dan petunjuk. Anak menggambar, mengulang petunjuk, undo, kembali, atau lanjut.
9. Setelah tahap garis selesai, lanjut mewarnai per bagian.
10. Tambahkan kreasi bebas secara opsional → selesai → simpan dan lihat karya.

Keluar atau menutup aplikasi pada tahap menggambar tidak membatalkan karya. Sesi dapat dilanjutkan pada checkpoint terkonfirmasi selama data browser masih tersedia. Penghapusan data situs, mode privat, atau eviction dapat menghilangkan data lokal; ekspor cadangan harus tersedia.

## 7. Persyaratan fungsional

Prioritas: P0 wajib untuk rilis terkait; P1 setelah fungsi dasar stabil; P2 pengembangan berikutnya. P0-FOTO wajib sebelum beta foto diaktifkan, bukan syarat prototipe manual.

| ID | Fitur | Prioritas | Perilaku dan kriteria penerimaan |
| --- | --- | --- | --- |
| FR-01 | Kanvas | P0 | Kanvas putih dengan goresan jari/stylus; perubahan orientasi tidak menggeser posisi relatif gambar |
| FR-02 | Alat | P0 | Pen, penghapus, palet warna, ketebalan, undo/redo; minimal 50 operasi terakhir dapat dibatalkan dalam sesi |
| FR-03 | Preset per tahap | P0 | Warna dan ukuran disiapkan sebelum input dimulai; tidak berganti saat pen menyentuh layar |
| FR-04 | Preferensi warna | P0 | Pilihan “ikuti panduan” atau “warna pilihanku”; pilihan sendiri bertahan sampai pengguna mengaktifkan panduan kembali |
| FR-05 | Template | P0 | Pelajaran menyertakan preview, urutan tahap, instruksi, geometri, area warna, dan versi |
| FR-06 | Garis panduan | P0 | Garis putus-putus hanya untuk bagian aktif; tidak ikut ekspor dan tidak menghapus goresan anak |
| FR-07 | Petunjuk sementara | P0 | Default usulan 5 detik, dapat diatur 3/5/10 detik atau terus terlihat; tombol tampilkan kembali selalu tersedia |
| FR-08 | Mandiri | P0 | Contoh tampil di panel terpisah; overlay tidak tampil kecuali anak memintanya |
| FR-09 | Navigasi | P0 | Kembali/lanjut tidak mensyaratkan kemiripan sempurna; karya sebelumnya tetap tersimpan |
| FR-10 | Penyelesaian otomatis | P1 | Menilai geometri secara lokal; transisi hanya setelah pen-up dan jeda singkat; tersedia sakelar nonaktif |
| FR-11 | Mewarnai | P0 | Sorot bagian aktif, atur kuas/warna, dan sediakan pilihan bebas; clipping bantuan tidak menambahkan warna otomatis |
| FR-12 | Kreasi bebas | P0 | Anak dapat menambah detail setelah pelajaran; tidak mengubah target referensi |
| FR-13 | Autosave/resume | P0 | Simpan stroke selesai dan checkpoint melalui transaksi IndexedDB; resume checkpoint terkonfirmasi selama penyimpanan situs masih tersedia |
| FR-14 | Galeri/ekspor | P0 | Simpan karya lokal dan ekspor PNG tanpa petunjuk; izin ditangani tanpa menghilangkan karya bila ditolak |
| FR-15 | Kamera/galeri | P0-FOTO | Memakai izin minimum dan pemilihan foto terbatas bila platform mendukung; crop serta koreksi orientasi sebelum unggah |
| FR-16 | Transformasi | P0-FOTO | Hasil memenuhi kontrak kemiripan pada bagian 8; kegagalan memberi opsi retry, foto lain, atau katalog |
| FR-17 | Preview | P0-FOTO | Foto dan ilustrasi dapat dibandingkan; persetujuan eksplisit diperlukan sebelum target dikunci |
| FR-18 | Job AI | P0-FOTO | Status proses, pembatalan, timeout, dan retry tersedia; retry jaringan tidak otomatis membuat pekerjaan berbayar duplikat |
| FR-19 | Privasi | P0 | Kontrol orang tua untuk unggah dan tindakan keluar aplikasi; penghapusan karya/foto dapat dilakukan |
| FR-20 | Audio instruksi | P1 | Instruksi pendek dapat diputar ulang/mute; teks dan ikon tetap tersedia |
| FR-21 | Sinkronisasi | P2 | Akun orang tua, backup cloud, pemulihan perangkat, serta kebijakan konflik versi tersendiri |
| FR-22 | Mode input | P0 | Mode pencil menerima pen saja untuk stroke; mode jari menerima touch. Pergantian mode tidak mereset karya; stylus yang terbaca sebagai touch memakai mode jari |
| FR-23 | PWA dan offline | P0 | Manifest, service worker, app shell dan paket terunduh; status siap offline hanya setelah seluruh dependency tersimpan dan tervalidasi |
| FR-24 | Backup proyek | P0 | Ekspor/impor paket proyek berversi berisi stroke, state, dan lesson yang diperlukan untuk resume, tanpa foto sumber mentah; berbeda dari ekspor PNG |
| FR-25 | Update aplikasi | P0 | Versi baru tidak memaksa reload saat menggambar; migrasi data transaksional dan paket lesson lama tetap dapat dibuka |

### Perilaku penting saat navigasi dan edit

- Kembali ke tahap sebelumnya tidak menghapus stroke tahap sesudahnya.
- “Ulangi tahap” menghapus hanya stroke milik tahap tersebut setelah konfirmasi; “mulai ulang karya” adalah tindakan terpisah.
- Mengganti mode bantuan tidak mereset karya atau mengganti geometri target.
- Undo memulihkan operasi pengguna, termasuk penghapusan; redo dibatalkan setelah input baru.
- Selesai manual pada suatu tahap tidak ditafsirkan sebagai bukti kemampuan menggambar yang benar.

## 8. Kontrak kemiripan foto → ilustrasi

Prinsip wajib: sederhanakan kompleksitas visual sambil mempertahankan identitas visual objek. Produk tidak menjanjikan kemiripan sempurna untuk semua foto.

| Harus dipertahankan | Boleh disederhanakan | Tidak boleh tanpa permintaan eksplisit |
| --- | --- | --- |
| Pose dan arah wajah | Tekstur kulit/bulu/kain | Mengganti pose atau ekspresi utama |
| Siluet dan proporsi relatif | Bayangan, pantulan, gradasi | Kepala/mata diperbesar berlebihan |
| Posisi serta jumlah bagian tubuh yang terlihat | Lipatan dan detail kecil | Menambah anggota tubuh atau objek utama |
| Ciri utama: rambut, kacamata, pola bulu | Jumlah warna | Menghapus ciri yang membuat objek dikenali |
| Warna dominan dan pakaian khas | Latar atas persetujuan pengguna | Mengganti pakaian atau warna utama secara substansial |

Bagian tubuh yang tertutup tidak boleh direkonstruksi secara spekulatif menjadi pose baru. Foto yang ambigu atau sulit harus ditolak dengan penjelasan sederhana atau diarahkan ke crop/foto lain.

### Evaluasi awal

Gunakan dataset uji minimal 30 foto berizin, mencakup manusia, hewan, dan benda dalam cakupan yang dipilih. Penilai manusia membandingkan sumber dan hasil dengan rubrik 1–5 untuk pose, proporsi/siluet, ciri khas, warna, dan kemudahan digambar.

Target go/no-go awal: minimal 80% foto dalam cakupan mencapai nilai minimal 4 pada setiap dimensi kemiripan; tidak ada kesalahan struktur kritis pada hasil yang ditawarkan sebagai pelajaran siap pakai. Ambang ini perlu dikalibrasi setelah baseline tersedia. Hasil dengan cacat struktur harus disaring, bukan dirata-ratakan ke dalam skor tinggi.

Evaluasi otomatis boleh menjadi penyaring awal, tetapi bukan bukti tunggal kemiripan. Persetujuan pengguna tidak menggantikan validasi geometri pelajaran. Hindari pengenalan identitas orang dan penyimpanan embedding biometrik pada versi awal.

## 9. Kontrak pelajaran dan prinsip pedagogi

1. Mulai dari bentuk besar atau struktur utama, kemudian detail, lalu warna; urutan disesuaikan objek, bukan aturan universal.
2. Satu tahap mempunyai satu tujuan yang mudah disebutkan, misalnya “Gambar telinga kiri”.
3. Contoh dan teks tidak menutupi area yang sedang digambar.
4. Toleransi cukup longgar untuk tangan anak; tidak mewajibkan garis identik.
5. Tidak ada hukuman atau label “jelek” ketika hasil berbeda.
6. Tingkat bantuan dan tingkat detail adalah dua pengaturan berbeda.
7. Gambar target tetap sama ketika bantuan dikurangi. Perubahan detail target membuat versi pelajaran baru sebelum sesi dimulai.
8. Karya anak tetap karya anak; sistem tidak diam-diam memperbaiki bentuk agar menyerupai contoh.

### Layer dan sketsa konstruksi

- Target referensi, overlay petunjuk, stroke anak, dan warna disimpan terpisah.
- Sketsa konstruksi dapat ditandai sementara. Jika perlu dihilangkan, aplikasi memberi instruksi menghapus atau menawarkan menyembunyikan layer konstruksi secara eksplisit.
- Ilustrasi target tidak ikut diekspor sebagai karya anak.
- Untuk bantuan warna, mask target digunakan sebagai pembatas opsional. Jika garis anak menyimpang, warna dapat terlihat tidak cocok; pengguna harus bisa menonaktifkan pembatas. Mask tidak boleh menggantikan garis anak secara diam-diam.

### Deteksi selesai tahap (P1)

Gunakan coverage jalur target, jarak stroke terhadap target, serta toleransi berdasarkan ukuran kanvas. Deteksi hanya pada stroke tahap aktif. Coverage saja tidak cukup karena coretan acak dapat menutupi target. Gabungkan dengan proporsi stroke di luar area dan panjang minimum yang masuk akal, lalu validasi pada anak.

Setelah kandidat selesai: tunggu pen-up, jeda usulan 800 ms, lalu transisi. Jika ada stroke baru selama jeda, batalkan transisi. Lanjut manual tetap tersedia. Untuk tahap warna, hindari menuntut cakupan penuh sebagai syarat wajib.

## 10. Layar dan UX tablet

| Layar | Elemen utama |
| --- | --- |
| Beranda | Lanjutkan karya, katalog, buat dari foto, galeri |
| Pilih foto | Kamera/galeri, crop/pilih objek, penjelasan pemrosesan |
| Preview | Sumber dan ilustrasi, gunakan, ulangi, ganti foto |
| Persiapan | Bantuan, detail yang tersedia, preview target |
| Drawing pad | Kanvas dominan, palet, ukuran pen, penghapus, undo/redo, tahap, petunjuk, lanjut/kembali |
| Mewarnai | Kanvas yang sama, highlight area aktif, preset kuas, bantuan batas warna |
| Selesai | Karya anak, simpan, gambar lagi, kreasi tambahan |
| Area orang tua | Pengaturan unggah, data, penghapusan, izin, pengaturan sesi |

Usulan UX: orientasi landscape utama dengan portrait tetap dapat digunakan, target sentuh minimal sekitar 48 logical pixels, label singkat beserta ikon, toolbar dapat dipindah untuk tangan kiri, dan informasi tidak dibedakan hanya melalui warna. Tampilan garis harus tetap jelas untuk anak dengan kesulitan membedakan warna.

Stylus tidak wajib. Sediakan pilihan eksplisit mode pencil dan mode jari. Pada mode pencil, hanya pointerType pen yang membuat stroke; touch pada kanvas tidak menggambar. Gesture navigasi harus dibedakan dan diuji agar telapak tidak memicu zoom/pan. Pada mode jari, stylus kapasitif yang terbaca sebagai touch diperlakukan seperti jari; jangan menjanjikan palm rejection. Zoom/pan tidak boleh tercatat sebagai stroke. Ketebalan tetap sesuai preset adalah default MVP; pressure sensitivity bersifat opsional dengan fallback ketebalan tetap.

## 11. Arsitektur konseptual dan batas AI

### Client web/PWA tablet

- Usulan baseline UI: React + TypeScript; pilihan build tooling ditetapkan saat implementasi.
- Canvas engine: HTML Canvas 2D sebagai baseline, overlay panduan terpisah, Pointer Events untuk pen/touch/mouse, undo/redo, dan stroke smoothing ringan. Render stroke tidak bergantung pada rerender seluruh komponen React per pointermove.
- Input: pointer capture, penanganan pointercancel, transformasi koordinat/DPR, dan touch-action pada area kanvas; jangan mematikan gesture aksesibilitas seluruh halaman. Coalesced events hanya optimasi jika tersedia.
- Tetapkan hanya satu input stroke aktif; pointer yang dibatalkan tidak menjadi garis panjang ketika input kembali.
- Lesson engine: state machine, petunjuk, preset, navigasi, mask warna.
- Penyimpanan lokal: IndexedDB untuk stroke log, checkpoint, preferensi, dan metadata; Cache Storage untuk app shell dan aset pelajaran. Jangan memakai localStorage untuk data drawing besar.
- Service worker mengelola cache berversi; UI siap offline hanya setelah dependency lengkap. Update diaktifkan setelah sesi disimpan dan pengguna siap.
- Kamera: file picker sebagai jalur dasar, capture jika didukung; live camera melalui getUserMedia hanya pada HTTPS dan setelah izin. Jika tidak tersedia, gunakan file picker atau katalog.
- Ekspor PNG melalui download/share yang didukung, tanpa menjanjikan penyimpanan otomatis ke Photos. Ekspor/impor proyek menyediakan backup yang dapat dilanjutkan.
- Job client: upload terotorisasi, polling/backoff atau notifikasi status, unduh paket final.

### Backend untuk fitur foto

- API autentikasi sesi/orang tua sesuai fase produk, otorisasi objek, kuota dan rate limit.
- Object storage privat untuk foto dan hasil sementara.
- Job queue dengan worker transformasi dan penyusunan pelajaran.
- Validator schema, geometri, keselamatan konten, dan kualitas output.
- Metadata job/pelajaran serta observability tanpa menyimpan foto di log.

### Pipeline foto

1. Client memperbaiki orientasi, menghapus EXIF yang tidak diperlukan, mengecilkan resolusi, dan mengunggah objek terpilih.
2. Backend memvalidasi file, ukuran, jenis, dan cakupan konten.
3. Segmentasi objek dan penyederhanaan berbasis referensi menghasilkan kandidat ilustrasi.
4. Pengguna menyetujui kandidat; simpan hash dan versi target yang immutable.
5. Pipeline membuat geometri semantik, grup bagian, urutan stroke, area warna, dan instruksi dari target tersebut.
6. Validator memeriksa geometri dan render ulang paket terhadap target. Jika perbedaannya material, kembalikan ke review pengguna, bukan diam-diam mengganti target.
7. Paket final diunduh; seluruh sesi menggambar dapat berjalan offline.

Tahap 5 adalah risiko R&D tersendiri: PNG yang baik tidak otomatis menghasilkan path dan urutan pedagogis yang baik. Alternatif awal adalah pemetaan ke template berparameter untuk kategori terbatas. Jika metode tersebut mengubah pose atau ciri terlalu jauh, input dinyatakan belum didukung.

AI tidak berada pada jalur input pen dan tidak dipanggil untuk setiap stroke. Web/PWA menjadi keputusan platform MVP; library drawing, model AI, dan provider dipilih setelah benchmark. Backend MVP cukup sederhana; tidak memerlukan microservices atau cluster kompleks hanya untuk pilot.

Lesson engine, schema lesson, stroke model, dan backend dipisahkan dari renderer serta browser storage agar dapat digunakan kembali bila native diperlukan. Migrasi native tetap dapat memerlukan penulisan ulang UI/rendering/input. Membungkus web dalam WebView tidak otomatis memperbaiki latency atau palm rejection.

## 12. Model data dan kontrak integrasi

### Entitas inti

| Entitas | Field penting |
| --- | --- |
| SourceAsset | id, owner_scope, mime_type, dimensions, retention_deadline, consent_reference |
| GenerationJob | id, idempotency_key, status, stage, attempt, input_ref, target_ref, error_code |
| LessonPackage | id, schema_version, content_version, target_hash, coordinate_space, steps, assets, checksum |
| LessonStep | id, phase, instruction, guide_paths, color_region_ids, tool_preset, completion_policy |
| DrawingSession | id, lesson_id/version, current_step, assistance_mode, tool_preferences, checkpoint_revision |
| Stroke | id, step_id, layer_id, points, color, width, tool, sequence |
| Artwork | id, session_id, export_ref, thumbnail_ref, created_at |

Gunakan koordinat kanvas yang dinormalisasi atau viewBox tetap dan transformasi seragam. Lebar stroke harus mempunyai unit yang jelas agar tidak berubah proporsinya antarperangkat.

Contoh kontrak satu tahap; geometri ilustratif, bukan pelajaran siap pakai:

```json
{
  "id": "head-outline",
  "phase": "outline",
  "instruction": "Buat lingkaran untuk kepala.",
  "guide_paths": [
    {"id": "head", "d": "M 300 200 A 100 100 0 1 0 500 200 A 100 100 0 1 0 300 200", "role": "final-outline"}
  ],
  "color_region_ids": [],
  "tool_preset": {"tool": "pen", "color": "#333333", "width_viewbox": 6},
  "completion_policy": {"manual_allowed": true, "automatic_enabled": false}
}
```

Kontrak API konseptual, bukan spesifikasi vendor:

- `POST /assets/upload-intents`: otorisasi unggah objek privat.
- `POST /generation-jobs`: buat kandidat; wajib idempotency key.
- `GET /generation-jobs/{id}`: status, tahap, kode error aman untuk pengguna.
- `POST /generation-jobs/{id}/cancel`: hentikan pekerjaan yang masih bisa dibatalkan.
- `POST /targets/{id}/approve`: kunci target dan mulai penyusunan pelajaran.
- `GET /lessons/{id}/manifest`: paket versi final, checksum, serta URL berumur terbatas.
- `DELETE /assets/{id}`: hapus sumber dan turunan sesuai scope yang dijelaskan.

Setiap akses memeriksa ownership; ID objek yang sulit ditebak bukan pengganti otorisasi. Retry approval harus idempoten agar tidak menggandakan job lesson.

### State machine

Job: `queued → validating → transforming → awaiting_approval → building_lesson → ready`, dengan cabang `failed`, `cancelled`, dan `expired`. Kandidat yang ditolak membuat attempt baru dalam batas kuota.

Sesi: `not_started → drawing → coloring → free_creation → completed`, dengan `paused` dan resume ke state sebelumnya. Melewati free_creation diperbolehkan. Status selesai ditentukan pengguna; bukan penilaian kemampuan.

## 13. Kualitas, reliability, dan keamanan

| Area | Target awal / persyaratan |
| --- | --- |
| Rendering | Sasaran 60 fps pada perangkat pilot; latensi input-ke-goresan p95 ≤50 ms diukur pada perangkat nyata |
| Autosave | Commit IndexedDB setelah stroke selesai; checkpoint maksimal setiap 2 detik saat aktif. Flush pada visibilitychange adalah best effort; jangan mengandalkan beforeunload atau eksekusi background |
| Pemulihan | Checkpoint yang sudah committed dapat dipulihkan selama data situs tersedia. Stroke belum committed dapat hilang saat crash; penghapusan/eviction storage membutuhkan impor backup |
| Offline | Template dan paket foto yang sudah diunduh dapat dipakai sampai selesai dan diekspor tanpa jaringan |
| AI | Target awal p95 ≤120 detik per fase kandidat dan penyusunan pelajaran; timeout terminal per fase usulan 180 detik, harus dibenchmark |
| Retry | Backoff terbatas, idempotensi, maksimal attempt per job, dan batas biaya harian |
| Integritas | Schema version dan checksum divalidasi sebelum paket diaktifkan |
| Penyimpanan penuh | Tidak menimpa checkpoint valid; tampilkan aksi kosongkan ruang dan simpan ulang |
| Konten vektor | Hanya subset path/geometri yang diizinkan; tidak mengeksekusi script, external URL, atau markup aktif dari output model |
| File upload | Verifikasi magic bytes, dimensi, batas ukuran/dekompresi, dan decode aman; usulan awal maksimum 10 MB dan resize sisi panjang 2048 px |
| Isolasi | Foto privat, URL sementara, otorisasi per objek, rahasia provider hanya di server |

Foto dianggap sensitif. Default usulan retensi foto mentah di server maksimal 24 jam setelah job terminal; job yang ditinggalkan mempunyai TTL maksimal 48 jam sejak dibuat. Orang tua dapat meminta penghapusan lebih cepat. Karya lokal bertahan selama data situs tersedia dan dapat hilang akibat penghapusan data browser atau eviction. Minta persistent storage bila API tersedia, tanpa menganggap izin pasti diberikan. Sediakan ekspor PNG dan backup proyek; sinkronisasi cloud belum termasuk MVP.

Tidak menggunakan foto anak untuk training secara default, tidak membuat galeri publik, dan tidak mengirim foto atau stroke ke analytics. Pemilihan provider harus memverifikasi retensi serta penggunaan data. Review persyaratan privasi anak, consent, dan distribusi web menjadi gate sebelum rilis publik; review store ditambahkan bila native dirilis. PRD ini tidak menyatakan kepatuhan hukum telah terpenuhi.

## 14. Error dan kondisi khusus

| Kondisi | Respons produk |
| --- | --- |
| Izin kamera/galeri ditolak | Jelaskan singkat, sediakan katalog; jangan meminta izin berulang tanpa tindakan pengguna |
| Lebih dari satu objek | Minta crop/pilih objek; tidak memilih orang secara diam-diam |
| Foto blur/gelap/objek tertutup | Minta foto lain atau crop yang lebih jelas |
| Hasil kurang mirip | Regenerasi terbatas, penyesuaian sederhana, atau ganti foto; tidak memaksa lanjut |
| Konten tidak sesuai anak | Tolak dengan pesan netral dan tawarkan katalog |
| Lesson path tidak valid | Jangan membuka paket; retry terkontrol atau fallback ke template |
| Jaringan terputus | Simpan status job dan lanjut polling setelah tersambung; drawing offline tidak terdampak |
| Pembatalan saat provider memproses | Hentikan tahapan lanjutan dan abaikan hasil terlambat; biaya yang terlanjur terjadi tetap dicatat internal |
| Aplikasi ditutup | Resume checkpoint tersedia atau status job, tanpa generasi ulang otomatis |
| Storage browser hilang | Jelaskan data lokal tidak tersedia; tawarkan impor backup, tanpa klaim pemulihan otomatis |
| Browser dan PWA memiliki storage terpisah | Jangan menganggap karya berpindah otomatis; tawarkan ekspor/impor proyek |
| Update service worker tersedia | Simpan sesi dahulu; pengguna memilih kapan memuat versi baru |
| Anak mencoret bebas | Izinkan; lanjut manual tetap tersedia, tanpa pesan menghukum |
| Referensi berbeda dari stroke anak | Pertahankan stroke anak; bantuan warna boleh dinonaktifkan |

## 15. Analitik dan kriteria keberhasilan pilot

Event minimal yang tidak memuat konten pribadi: `lesson_started`, `step_advanced` dengan sumber manual/auto, `hint_replayed`, `assistance_changed`, `lesson_completed`, `artwork_exported`, `generation_failed`, dan `preview_approved`. Gunakan ID sesi pseudonim dan telemetri sesuai pilihan orang tua. Jangan menganggap lama layar sebagai tujuan utama.

| Metrik | Definisi | Target eksplorasi |
| --- | --- | --- |
| Completion | Sesi selesai / sesi mulai, laporkan template dan foto terpisah | ≥70% pada pilot |
| Kemandirian | Anak selesai dengan ≤2 bantuan instruksional orang dewasa setelah onboarding | ≥70% peserta |
| Minat mengulang | Anak memilih pelajaran lain atau menggambar ulang setelah sesi | ≥60% peserta |
| Kemiripan | Lolos rubrik pada bagian 8 | ≥80% foto dalam cakupan |
| Paket dapat digunakan | Paket valid dan bisa diselesaikan setelah target disetujui | ≥90% pada beta terkontrol |
| Stabilitas | Sesi tanpa crash | ≥99% sebagai target awal; laporkan jumlah sesi, bukan hanya persentase |

Pilot 5–8 anak merupakan uji usability kualitatif, bukan bukti statistik efektivitas belajar. Catat observasi dan jumlah mentah. Uji transfer kemampuan dilakukan lewat menggambar objek serupa dengan bantuan berkurang setelah beberapa sesi, dengan penilaian manusia; jangan mengklaim peningkatan belajar hanya berdasarkan completion.

## 16. Rencana implementasi dan gate

Estimasi kasar: 100–170 jam pekerjaan awal untuk prototipe, fondasi MVP, dan spike foto; tambahan 40–80 jam integrasi/hardening jika pipeline foto lolos. Ini bukan estimasi final atau jaminan delivery. Pada kapasitas 10 jam/minggu, total 140–250 jam setara sekitar 14–25 minggu, belum termasuk R&D lanjutan. Angka v1.0 ini dipertahankan sebagai baseline sementara; estimasi perlu ditinjau setelah spike browser, backup proyek, dan pengujian dua perangkat. Tidak ada klaim penghematan waktu otomatis dari PWA.

| Fase | Output | Estimasi usaha | Gate keluar |
| --- | --- | --- | --- |
| 0. Persiapan | Pilih dua perangkat/browser, spike pen/touch/PWA, usia, 1 contoh pelajaran, foto uji berizin | 8–12 jam | Input dan batas scope jelas |
| 1. Vertical slice | Satu pelajaran end-to-end, save/resume/ekspor | 24–40 jam | Anak dapat menyelesaikan alur |
| 2. Pilot usability | Observasi 5–8 anak dan perbaikan utama | 12–20 jam | Hambatan utama teridentifikasi dan diperbaiki |
| 3. Fondasi MVP | Template, mode bantuan, galeri, cache offline, backup proyek, error handling | 32–48 jam | P0 dasar lulus |
| 4. Spike foto | Kandidat mirip, geometri, urutan, evaluasi dataset | Timebox 24–50 jam | Kemiripan dan struktur memenuhi gate atau scope dipersempit |
| 5. Integrasi beta | Pipeline job, privacy, reliability, device testing | Tambahan 40–80 jam | P0-FOTO lulus sebelum fitur foto dibuka |

Jika fase 4 gagal, pilih secara eksplisit: mempersempit kategori foto, memakai template berparameter, menambah waktu R&D, atau melanjutkan produk template-only. Jangan menghabiskan waktu tanpa batas untuk mendukung semua foto.

Kebutuhan kolaborasi yang disarankan: product owner/developer, pengajar menggambar anak untuk review beberapa pelajaran, dan orang tua peserta pilot. Tidak mensyaratkan tim penuh waktu.

## 17. Acceptance test dan definisi selesai

| ID | Skenario | Hasil wajib |
| --- | --- | --- |
| AT-01 | Selesaikan template dari awal | Menggambar → mewarnai → simpan berhasil; PNG hanya memuat karya |
| AT-02 | Ubah warna lalu lanjut | Preferensi bebas bertahan; mode panduan dapat diaktifkan kembali |
| AT-03 | Petunjuk hilang lalu diminta kembali | Muncul ulang tanpa menghapus stroke atau mereset tahap |
| AT-04 | Lanjut sebelum menggambar | Diperbolehkan dan dicatat sebagai manual; tidak mengklaim tahap benar |
| AT-05 | Tutup tab/PWA setelah checkpoint | Resume tahap, mode, alat, dan stroke committed selama storage situs masih tersedia |
| AT-06 | Zoom/rotasi/ubah ukuran tampilan | Referensi dan stroke tetap sejajar dalam koordinat kanvas |
| AT-07 | Undo, redo, lalu stroke baru | Histori konsisten, redo lama dibatalkan |
| AT-08 | Foto dengan ciri khas dan pose jelas | Preview mempertahankan ciri serta pose sesuai rubrik; cacat kritis tidak diterima |
| AT-09 | Semua tahap lesson foto dirender | Akumulasi path final konsisten dengan target yang disetujui; konstruksi sementara ditangani terpisah |
| AT-10 | Retry job/approval karena jaringan | Satu pekerjaan logis, tidak membuat charge/provider call duplikat yang dapat dicegah |
| AT-11 | Putus jaringan setelah download | Menggambar, mewarnai, resume, ekspor tetap berfungsi |
| AT-12 | Akses asset milik sesi/orang tua lain | Ditolak server meskipun ID diketahui |
| AT-13 | Penghapusan foto dan expiry | Sumber/turunan sesuai scope tidak lagi dapat diakses; lifecycle storage diuji |
| AT-14 | Storage penuh saat autosave | Checkpoint valid tidak rusak; pengguna mendapat opsi pemulihan |
| AT-15 | Auto-next mendeteksi selesai saat pen-down | Tidak berpindah sampai pen-up dan jeda selesai; input baru membatalkan jeda |
| AT-16 | Pencil dengan telapak menyentuh layar | Pada mode pencil tidak ada stroke touch, scroll halaman, atau zoom tak disengaja pada perangkat yang dinyatakan didukung |
| AT-17 | Goresan cepat, pendek, angkat-tempel berulang, pointercancel | Tidak ada input macet, garis penghubung tak sengaja, atau kehilangan goresan berulang; catat fps dan p95 latency |
| AT-18 | Input tanpa pressure dan stylus kapasitif | Ketebalan tetap berfungsi; stylus touch dapat dipakai melalui mode jari |
| AT-19 | Buka PWA offline setelah paket siap | Cold launch, lesson, drawing, resume, dan ekspor berfungsi; AI foto memberi status perlu jaringan |
| AT-20 | Ekspor proyek, hapus data situs, impor | Karya, state, versi lesson, dan alat dipulihkan; file invalid/terlalu besar ditolak tanpa merusak data |
| AT-21 | Update aplikasi saat sesi berjalan | Tidak ada reload paksa atau data hilang; migrasi tervalidasi sebelum versi baru digunakan |
| AT-22 | Browser biasa dan Home Screen | Keduanya lulus alur inti; jika storage terpisah, jalur pemindahan backup dijelaskan dan berfungsi |

Definition of Done per rilis: seluruh P0 pada scope rilis lulus, tidak ada bug kehilangan karya yang diketahui, diuji pada perangkat pilot nyata dengan jari dan stylus yang dipilih, konten direview, keterbatasan foto dinyatakan jelas, dan hasil pilot terdokumentasi. Rilis publik juga membutuhkan review privasi, distribusi, serta dukungan pengguna.

## 18. Biaya dan opsi bisnis

Biaya utama yang perlu diukur: generasi kandidat, retry, segmentasi/vectorization, penyusunan lesson, storage sementara, dan bandwidth. Ukur biaya per pelajaran yang berhasil digunakan, bukan hanya biaya per request.

Rumus operasional: biaya per pelajaran diterima = seluruh biaya pipeline termasuk pekerjaan gagal dan kandidat ditolak / jumlah pelajaran final yang diterima pengguna.

Tetapkan kuota foto, batas retry usulan 2 kali regenerasi per permintaan, serta circuit breaker biaya harian. Jangan membatasi template offline karena kegagalan layanan AI. Harga dan margin baru dapat diputuskan setelah biaya aktual serta kesediaan orang tua membayar diketahui.

Opsi yang dapat diuji setelah pilot: katalog dasar gratis dengan paket pelajaran berbayar, atau langganan orang tua dengan kuota transformasi foto. Tidak ada iklan tertarget atau pembelian yang dilakukan anak tanpa kontrol orang tua dalam scope produk ini.

## 19. Risiko dan keputusan terbuka

| Risiko / keputusan | Mitigasi / langkah berikutnya |
| --- | --- |
| Foto mirip tetapi terlalu rumit | Batasi detail, tambah tahap, uji keterajaran bersama pengajar |
| Kartun mudah digambar tetapi tidak mirip | Terapkan kontrak kemiripan dan preview; jangan mengorbankan proporsi untuk gaya |
| PNG bagus tetapi tidak bisa diuraikan | Uji pipeline geometri sebagai gate terpisah dari image generation |
| Anak hanya menjiplak | Sediakan pengurangan bantuan dan uji menggambar ulang |
| Auto-next membuat frustrasi | Manual sebagai default awal; validasi sebelum auto diaktifkan |
| Variasi tablet dan stylus | Pilih perangkat pilot dan lakukan spike input sejak awal |
| Scope membesar | Satu codebase web/PWA, sedikit kategori, timebox R&D, native hanya jika dibutuhkan |
| Browser/input bermasalah | Uji matriks perangkat dan gate native pada bagian 21; baseline UI React/TypeScript, library canvas setelah spike |
| Eviction dan isolasi storage | Backup proyek P0, uji browser vs PWA, persistence best effort; backup cloud P2 |
| Kategori foto pertama | Pilih dari manusia/hewan/benda berdasarkan benchmark; tujuan akhir tetap mendukung semuanya secara bertahap |
| Model/provider AI | Evaluasi kemiripan, geometri, latensi, biaya, retensi, dan hak penggunaan output |
| Usia, harga, dan branding | Validasi dengan orang tua; bukan blocker untuk prototipe satu pelajaran |

## 20. Backlog pertama yang dapat dikerjakan

1. Pilih iPad + Apple Pencil dan Android tablet + stylus aktif, catat versi OS/browser, lalu tetapkan ukuran kanvas/logical coordinate space.
2. Buat satu target kucing manual berikut path, instruksi, area warna, dan 6–8 tahap bentuk/detail.
3. Implementasikan Canvas/Pointer Events, mode pencil/jari, penghapus, undo/redo, dan layer terpisah; ukur respons sebelum memperluas UI.
4. Implementasikan lesson engine serta mode petunjuk terlihat/sementara.
5. Tambahkan preset alat dan preferensi warna pengguna.
6. Tambahkan fase warna, IndexedDB autosave/resume, PWA offline, ekspor PNG, serta ekspor/impor backup proyek.
7. Jalankan AT-01 sampai AT-07, AT-14, dan AT-16 sampai AT-22 pada matriks perangkat nyata; catat keputusan lanjut PWA atau evaluasi native.
8. Uji dengan anak, catat titik bingung, perbaiki sebelum memperbanyak template.
9. Kumpulkan foto uji berizin dan jalankan spike transformasi serta penyusunan geometri.
10. Putuskan scope beta foto berdasarkan hasil evaluasi, kemudian integrasikan job backend.

Dokumen ini menjadi baseline produk. Perubahan yang memengaruhi kemiripan, privasi foto, bentuk bantuan, atau scope rilis harus dicatat dalam versi PRD berikutnya.


## 21. Keputusan platform dan gate native

### Keputusan 10 Oktober 2026

MVP dibuat sebagai web app/PWA tablet-first. Pengguna dapat membuka link tanpa instalasi atau menambahkan ikon ke Home Screen. Native bukan komitmen rilis awal; prioritas adalah membuktikan pengalaman belajar dan kenyamanan drawing. Perubahan platform tidak mengubah kontrak kemiripan foto, preview, atau kebebasan warna anak.

### Matriks dukungan awal

| Perangkat | Browser / mode | Input wajib diuji |
| --- | --- | --- |
| iPad yang dipilih untuk pilot | Safari tab dan Home Screen PWA | Apple Pencil yang kompatibel dan jari |
| Android tablet yang dipilih untuk pilot | Chrome tab dan PWA terpasang bila tersedia | Stylus aktif yang kompatibel dan jari |
| Desktop | Browser modern untuk QA dasar | Mouse; bukan target UX utama |

Catat model hardware, stylus, OS, browser, mode peluncuran, dan hasil uji. Minimum versi OS/browser ditetapkan setelah pengujian, bukan diasumsikan dari dukungan API umum. Jalankan feature detection; jangan menjanjikan semua stylus, pressure, tilt, hover, atau tombol khusus. PWA memakai batas kemampuan browser yang sama dan tidak otomatis setara native.

### Gate lanjut PWA

- AT-16 sampai AT-22 lulus pada kedua kombinasi tablet target sebelum mengklaim dukungan keduanya.
- Sasaran rendering pada bagian 13 tercapai untuk pelajaran representatif; tidak ada gangguan goresan yang membuat anak harus mengulang berulang kali.
- Mode pencil dengan tangan menempel nyaman dipakai selama satu sesi 10–20 menit.
- Autosave, resume, offline, update, ekspor PNG, dan backup proyek berfungsi dalam pengujian nyata.
- Jika hanya satu kombinasi lulus, pilot dapat dibatasi secara eksplisit ke kombinasi itu; dukungan platform lain belum diumumkan.

### Pemicu evaluasi native

Evaluasi native bila optimasi web dengan timebox awal 2–3 hari kerja belum menyelesaikan latency, hilangnya input berulang, atau konflik telapak/gesture pada perangkat prioritas; atau ketika kebutuhan produk menuntut integrasi stylus khusus yang tidak tersedia di browser. Bandingkan satu proof of concept native pada perangkat dan pelajaran yang sama sebelum memutuskan migrasi.

Untuk iPad, evaluasi PencilKit atau renderer native sesuai kebutuhan layer/lesson; untuk Android, evaluasi API stylus/rendering native. Backend AI, format lesson, aset, dan konsep state machine dipertahankan. Jangan membangun dua client native sekaligus sebelum kebutuhan terbukti.

### Referensi teknis untuk implementasi

Referensi mendukung arah teknis; kompatibilitas tetap harus diverifikasi pada versi perangkat saat implementasi.

- [Apple — Safari 13 Release Notes: Pointer Events dan Apple Pencil](https://developer.apple.com/documentation/safari-release-notes/safari-13-release-notes)
- [MDN — Pointer Events](https://developer.mozilla.org/en-US/docs/Web/API/Pointer_events)
- [MDN — Offline and background operation](https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps/Guides/Offline_and_background_operation)
- [WebKit — Updates to Storage Policy](https://webkit.org/blog/14403/updates-to-storage-policy/)
- [WebKit — Safari 17.2: Home Screen storage](https://webkit.org/blog/14787/webkit-features-in-safari-17-2/)
- [Apple — PencilKit](https://developer.apple.com/documentation/pencilkit/)
- [Android — Advanced stylus features](https://developer.android.com/develop/ui/views/touch-and-input/stylus-input/advanced-stylus-features)

## 22. Riwayat perubahan

| Versi | Tanggal | Perubahan |
| --- | --- | --- |
| 1.0 | 9 Oktober 2026 | Baseline konsep, scope MVP, pipeline foto, arsitektur, dan acceptance test |
| 1.1 | 10 Oktober 2026 | Web/PWA sebagai platform MVP; mode pencil/jari; arsitektur Canvas/Pointer Events; IndexedDB dan cache offline; backup proyek; matriks uji iPad/Android; gate native; penyesuaian roadmap dan batas durability browser |
