# Daftar uji di tablet

Daftar ini untuk orang tua yang mencoba DrawSprout bersama anak, di tablet sungguhan.
Bahasanya biasa. Tidak perlu tahu cara membuat aplikasi.

Hasil yang disebut "wajib" disalin dari dokumen produk (uji AT-01 sampai AT-07, AT-14, dan
AT-16 sampai AT-22). Angka yang ada di sana dipakai apa adanya. Tidak ada ambang baru di
daftar ini.

Alamat yang dicoba: <https://drawsprout.erriccjs.cloud>

Jangan memakai halaman pengembangan di komputer. Halaman itu tidak menyimpan aplikasi untuk
dibuka tanpa internet.

## Cara memakai

1. Isi catatan perangkat di bawah ini. Satu catatan untuk iPad, satu lagi untuk tablet Android.
2. Jalankan uji di bagian "Yang terlihat saat anak mencoba", lalu uji AT satu per satu.
3. Pada setiap uji, centang **satu** saja: Lulus, Gagal, atau Tidak bisa diuji.
4. Lulus berarti seluruh hasil wajib terpenuhi.
5. Gagal berarti bagian yang dicoba tidak sesuai hasil wajib.
6. Tidak bisa diuji berarti uji tidak bisa dijalankan, atau bagian wajib itu belum ada di aplikasi.
   Tulis di catatan apa yang sudah terlihat.
7. Salin hasilnya ke berkas baru, seperti yang dijelaskan di akhir. Jangan mengubah daftar ini.

Untuk mencetak: buka halaman ini di GitHub, lalu pilih cetak. Setiap uji punya judul sendiri
dan kotak centang, supaya satu uji tidak menempel ke uji berikutnya.

## Dua perangkat

Jalankan daftar yang sama pada dua susunan ini.

| Perangkat | Cara membuka | Alat gambar |
| --- | --- | --- |
| iPad yang dipakai untuk uji coba | Safari, dan ikon di Layar Utama | Apple Pencil yang cocok dengan iPad itu, dan jari |
| Tablet Android yang dipakai untuk uji coba | Chrome, dan aplikasi terpasang bila ada | Stylus aktif yang cocok, dan jari |

Versi sistem dan browser dicatat dari perangkat yang ada di tangan. Jangan mengira versinya
dari daftar ini.

Desktop boleh untuk melihat saja. Desktop bukan sasaran uji ini.

## Catatan perangkat

Salin blok ini sekali untuk iPad dan sekali untuk tablet Android.

| Yang dicatat | Isi |
| --- | --- |
| Perangkat | iPad / tablet Android |
| Model | |
| Versi sistem | |
| Browser dan versinya | |
| Cara membuka | tab browser / ikon layar utama |
| Pena | Apple Pencil / pena kapasitif (pena biasa, dianggap jari) / stylus aktif lain / tidak ada |
| Tanggal | |
| Penguji | |

## Sebelum mulai

1. Buka <https://drawsprout.erriccjs.cloud> saat internet menyala.
2. Di iPad, dalam Safari: tombol Bagikan, lalu Tambahkan ke Layar Utama.
3. Di Android, dalam Chrome: menu browser, lalu Pasang aplikasi atau Tambahkan ke layar utama.
   Pakai kalimat yang muncul di menu.
4. Layar pilih gambar bertuliskan "Mau gambar apa hari ini?".
5. Tunggu sampai muncul kalimat "Bisa dibuka tanpa internet." Kalimat itu baru ada setelah
   aplikasi selesai menyimpan halaman. Jika tidak muncul, catat itu. Uji tanpa internet (AT-19)
   menjadi Tidak bisa diuji.

## Yang terlihat saat anak mencoba

Bagian ini dari pengamatan saat anak memakai aplikasi. Langkah offline yang lengkap ada di AT-19.
Lakukan AT-19, jangan diganti dengan ringkasan di sini.

### C-01 — Tepi layar Android saat mode jari

**Yang dicek.** Saat menggambar dengan jari, sentuhan di tepi layar tidak boleh mencoret sendiri,
dan gerakan sistem (kembali, beranda, aplikasi terakhir, bayangan notifikasi) tidak boleh
menyambar goresan di tengah kertas.

**Langkah**

1. Di tablet Android, buka sebuah gambar. Pilih **Jari**.
2. Gambar di tengah kertas. Garis harus mengikuti jari.
3. Letakkan jari di pinggir kertas, dekat tepi fisik tablet, lalu geser ke dalam seperti akan
   menggambar.
4. Dari tepi fisik, geser seperti orang membuka beranda, kembali, atau daftar aplikasi.

**Yang diharapkan.** Sentuhan hanya di tepi tidak memulai coretan. Gerakan sistem Android tetap
bisa muncul; itu bukan kegagalan selama coretan di tengah kertas tidak hilang, tidak tersambung
sendiri, dan halaman tidak tergeser. Aplikasi tidak mematikan gerakan sistem.

- [ ] Lulus
- [ ] Gagal
- [ ] Tidak bisa diuji

> Catatan:

### C-02 — Masuk layar penuh, goresan pertama tidak tercoret

**Yang dicek.** Memilih gambar meminta layar penuh. Goresan pertama tidak boleh jadi coretan
panjang karena layar sedang berubah.

**Langkah**

1. Dari layar pilih gambar, ketuk satu gambar, misalnya Kucing Duduk.
2. Jika browser bertanya tentang layar penuh, izinkan. Tunggu kertas diam.
3. Baru kemudian tarik satu garis pendek.
4. Keluar ke pilih gambar. Ketuk **Layar penuh** (gambar empat sudut) hanya jika ingin mencoba
   tombol itu. Menggambar sendiri tidak boleh memunculkan permintaan layar penuh.

**Yang diharapkan.** Garis mulai di tempat jari atau pena mulai, bukan sapuan dari sudut. Tidak
ada garis penghubung dari tempat yang tidak disentuh.

- [ ] Lulus
- [ ] Gagal
- [ ] Tidak bisa diuji

> Catatan:

### C-03 — Pesan karya dilanjutkan

**Yang dicek.** Membuka gambar yang sudah ada menampilkan pesan singkat, dan anak tetap bisa
menggambar.

**Langkah**

1. Gambar beberapa garis, lalu ketuk **Pilih gambar lain**.
2. Buka gambar yang sama lagi, dari daftar pelajaran atau dari **Karyaku**.
3. Baca pesan yang muncul. Kalimatnya: "Karya terakhirmu dilanjutkan dari tempat kamu berhenti."
4. Gambar lagi sementara pesan masih ada. Jangan tunggu pesan hilang dulu.
5. Biarkan pesan hilang sendiri. Ada tombol **Mulai ulang** pada pesan itu. Tombol itu langsung
   memulai gambar dari awal, tanpa pertanyaan. Jangan menekannya jika gambar ingin disimpan.

**Yang diharapkan.** Pesan tidak menutup tombol gambar. Menggambar tidak ditahan. Pesan hilang
sendiri setelah kira-kira 3 detik. Angka 3 detik adalah lama pesan di aplikasi, bukan syarat baru.

- [ ] Lulus
- [ ] Gagal
- [ ] Tidak bisa diuji

> Catatan:

### C-04 — Kotak Jari dan Pensil

**Yang dicek.** Mode jari dan mode pensil bisa diganti tanpa menghapus gambar.

**Langkah**

1. Gambar satu garis.
2. Ketuk **Jari**, lalu **Pensil**, lalu kembali ke mode yang dipakai anak.
3. Lihat garis yang sudah ada.

**Yang diharapkan.** Gambar tidak hilang. **Pensil** hanya menerima pena, bukan jari. **Jari**
menerima jari. Kedua tombol tetap terlihat, tidak tertutup kartu contoh atau pesan lanjutan.

- [ ] Lulus
- [ ] Gagal
- [ ] Tidak bisa diuji

> Catatan:

### C-05 — Kartu contoh

**Yang dicek.** Contoh hasil jadi terpisah dari tulisan langkah, dan bisa dilihat lebih besar.

**Langkah**

1. Pegang tablet mendatar. Lihat kartu gambar di pojok kiri atas, di luar kertas gambar anak.
2. Ketuk kartu itu. Contoh besar terbuka. Ketuk lagi untuk menutup.
3. Putar tablet ke tegak. Contoh menjadi gambar kecil di sudut yang sama. Ketuk, lalu tutup.

**Yang diharapkan.** Contoh bukan gambar anak. Membuka dan menutup contoh tidak memindahkan
goresan dan tidak mengubah langkah.

- [ ] Lulus
- [ ] Gagal
- [ ] Tidak bisa diuji

> Catatan:

### C-06 — Karyaku

**Yang dicek.** Gambar yang sudah dikerjakan muncul di layar pilih gambar, bisa dibuka, disimpan
sebagai PNG, dan dihapus setelah konfirmasi.

**Langkah**

1. Gambar sampai ada goresan, lalu kembali ke pilih gambar.
2. Di bawah daftar gambar, cari judul **Karyaku**.
3. Kartu menunjukkan nama pelajaran dan tanggal. Gambar kecilnya hanya coretan anak, tanpa garis
   putus-putus panduan.
4. Ketuk **Buka**. Gambar yang sama terbuka.
5. Kembali. Ketuk **Simpan PNG**. Berkas gambar terunduh. Buka berkas itu: hanya coretan anak.
6. Ketuk **Hapus**. Muncul "Hapus karya ini?". Ketuk **Batal**. Kartu masih ada.
7. Jika boleh menghapus gambar uji: **Hapus**, lalu **Hapus** lagi. Kartu hilang.

**Yang diharapkan.** Gambar uji terlihat, terbuka, dan PNG-nya tanpa panduan. Hapus tidak jalan
sebelum dikonfirmasi.

- [ ] Lulus
- [ ] Gagal
- [ ] Tidak bisa diuji

> Catatan:

### C-07 — Gambar bebas

**Yang dicek.** Setelah langkah terakhir, anak bisa terus menggambar tanpa garis panduan, dengan
semua alat dan warna.

**Langkah**

1. Pada langkah terakhir, ketuk **?** (**Bantuan**).
2. Ketuk **Gambar bebas**.
3. Lihat kertas: garis putus-putus panduan hilang. Kartu contoh tetap ada.
4. Coba pena, kuas, penghapus, dan warna.
5. Ketuk **Kembali**. Langkah terakhir yang berpanduan muncul lagi. Goresan bebas tidak dihapus
   oleh Kembali.

Tombol yang sama juga ada di layar selesai, setelah **Selesai**.

**Yang diharapkan.** Tidak ada garis panduan di kertas saat gambar bebas. Lebar tombol di tepi
tidak bertambah. **Kembali** tidak menghapus coretan.

- [ ] Lulus
- [ ] Gagal
- [ ] Tidak bisa diuji

> Catatan:

### C-08 — Ulangi langkah ini

**Yang dicek.** Mengulang satu langkah hanya menghapus coretan langkah itu, dan bisa dibatalkan.

**Langkah**

1. Gambar di dua langkah yang berurutan. Ingat bentuk di langkah sebelumnya.
2. Di langkah yang sekarang, ketuk **?** (**Bantuan**), lalu **Ulangi langkah ini**.
3. Tidak ada pertanyaan sebelumnya. Coretan langkah ini hilang. Coretan langkah lain tetap ada.
4. Ketuk **Batalkan**. Coretan langkah ini kembali.
5. Di lembar bantuan yang sama, **Mulai ulang** bertanya dulu: "Mau mulai dengan gambar kosong?".
   **Gambar lama tetap ada** membatalkan. Jangan memilih gambar baru jika karya ingin disimpan.
   Tombol **Mulai ulang** pada pesan lanjutan (C-03) adalah tombol lain: itu tidak bertanya.

**Yang diharapkan.** Hanya langkah yang sedang dibuka yang kosong, lalu **Batalkan** mengembalikannya.
Langkah lain tidak ikut hilang.

- [ ] Lulus
- [ ] Gagal
- [ ] Tidak bisa diuji

> Catatan:

## Uji penerimaan

### AT-01 — Selesaikan template dari awal

**Yang dicek.** Satu pelajaran bisa diselesaikan dari garis pertama sampai disimpan, dan berkas
PNG hanya berisi karya anak.

**Hasil wajib.** Menggambar → mewarnai → simpan berhasil; PNG hanya memuat karya.

**Langkah**

1. Pilih satu pelajaran dari awal, misalnya Kucing Duduk.
2. Ikuti langkah sampai ada tahap mewarnai, lalu sampai tombol **Selesai**.
3. Di layar selesai, ketuk **Simpan gambar (PNG)**.
4. Buka berkas PNG di luar aplikasi.

**Yang diharapkan.** Simpan berhasil. Di dalam PNG ada coretan anak saja. Tidak ada garis
putus-putus, tidak ada kartu contoh, tidak ada tulisan tombol.

- [ ] Lulus
- [ ] Gagal
- [ ] Tidak bisa diuji

> Catatan:

### AT-02 — Ubah warna lalu lanjut

**Yang dicek.** Warna yang dipilih anak bertahan di langkah berikutnya, dan warna panduan bisa
dipakai lagi.

**Hasil wajib.** Preferensi bebas bertahan; mode panduan dapat diaktifkan kembali.

**Langkah**

1. Di tengah pelajaran, ketuk lingkaran warna.
2. Pilih warna lain, misalnya Merah.
3. Gambar sedikit, lalu ketuk **Lanjut**.
4. Lihat warna yang masih terpilih.
5. Ketuk lingkaran warna lagi, lalu **Ikuti panduan**.

**Yang diharapkan.** Langkah baru masih memakai warna yang anak pilih, sampai **Ikuti panduan**
ditekan. Setelah itu warna kembali ke warna langkah.

- [ ] Lulus
- [ ] Gagal
- [ ] Tidak bisa diuji

> Catatan:

### AT-03 — Petunjuk hilang lalu diminta kembali

**Yang dicek.** Garis panduan yang hilang bisa dimunculkan lagi tanpa menghapus coretan atau
mengganti langkah.

**Hasil wajib.** Muncul ulang tanpa menghapus stroke atau mereset tahap.

**Langkah**

1. Gambar sedikit di satu langkah. Ingat bentuknya dan nomor langkahnya.
2. Ketuk **?** (**Bantuan**). Pilih **Petunjuk sementara**.
3. Tutup bantuan. Tunggu sampai garis putus-putus di kertas hilang. Lama pilihannya 3, 5, atau
   10 detik, di **Lama petunjuk** pada bantuan. Tidak ada lama lain.
4. Buka **Bantuan** lagi. Ketuk **Tampilkan petunjuk**.

**Yang diharapkan.** Garis panduan kembali. Coretan anak tetap ada. Langkah tidak kembali ke awal.

- [ ] Lulus
- [ ] Gagal
- [ ] Tidak bisa diuji

> Catatan:

### AT-04 — Lanjut sebelum menggambar

**Yang dicek.** Anak boleh pindah langkah tanpa menggambar, dan aplikasi tidak mengatakan
langkah itu benar.

**Hasil wajib.** Diperbolehkan dan dicatat sebagai manual; tidak mengklaim tahap benar.

**Langkah**

1. Pada langkah yang masih kosong, langsung ketuk **Lanjut**.
2. Baca layar. Tidak ada nilai, bintang, atau kalimat bahwa gambar benar atau salah.
3. Ketuk **Kembali**. Langkah tadi masih bisa dibuka.

**Yang diharapkan.** Pindah langkah diizinkan. Tidak ada klaim bahwa tahap benar. Tidak ada
layar nilai untuk orang tua; bagian "dicatat sebagai manual" tidak punya tampilan. Jika pindah
langkah berjalan dan tidak ada klaim benar atau salah, bagian yang terlihat lulus. Tulis di
catatan bahwa catatan manual tidak ditampilkan.

- [ ] Lulus
- [ ] Gagal
- [ ] Tidak bisa diuji

> Catatan:

### AT-05 — Tutup tab atau ikon setelah simpanan otomatis

**Yang dicek.** Setelah aplikasi sempat menyimpan, menutupnya lalu membukanya lagi mengembalikan
langkah, mode, alat, dan coretan yang sudah masuk.

**Hasil wajib.** Resume tahap, mode, alat, dan stroke committed selama storage situs masih tersedia.

**Langkah**

1. Gambar beberapa garis. Ganti ke **Jari** atau **Pensil**, dan pilih satu warna.
2. Tunggu kata **Tersimpan** di dekat atas layar.
3. Tutup paksa. Di iPad: geser dari bawah dan tahan, lalu geser kartu DrawSprout ke atas.
   Di Android: buka daftar aplikasi terakhir, lalu geser kartu DrawSprout.
4. Buka lagi dengan cara yang sama (tab yang sama, atau ikon yang sama).
5. Buka gambar yang tadi. Perhatikan juga pesan di C-03.

**Yang diharapkan.** Langkah, mode, alat, warna yang dipilih, dan garis yang sudah tersimpan
kembali. Garis yang belum sempat tersimpan boleh hilang. Jika data situs sudah dihapus oleh
browser, uji ini Tidak bisa diuji.

- [ ] Lulus
- [ ] Gagal
- [ ] Tidak bisa diuji

> Catatan:

### AT-06 — Perbesar, putar, dan ubah ukuran

**Yang dicek.** Goresan tetap menempel pada gambar, bukan pada tepi layar, saat tampilan berubah.

**Hasil wajib.** Referensi dan stroke tetap sejajar dalam koordinat kanvas.

**Langkah**

1. Gambar satu bentuk yang mudah diingat, misalnya lingkaran di kepala contoh.
2. Cubit dua jari untuk memperbesar. Geser dua jari untuk menggeser kertas. Tidak ada putar
   dengan jari.
3. Jika tombol kaca pembesar **Sesuai layar** muncul, ketuk sekali.
4. Putar tablet dari mendatar ke tegak, lalu kembali.
5. Bandingkan bentuk dengan kartu contoh.

**Yang diharapkan.** Lingkaran tetap di tempat yang sama pada gambar. Tidak melar, tidak pindah
ke sudut lain. Contoh dan coretan masih sejajar. **Sesuai layar** mengembalikan kertas ke muat
layar.

- [ ] Lulus
- [ ] Gagal
- [ ] Tidak bisa diuji

> Catatan:

### AT-07 — Batalkan, ulangi, lalu goresan baru

**Yang dicek.** Urutan batal dan ulang konsisten, dan goresan baru membuang ulang yang lama.

**Hasil wajib.** Histori konsisten, redo lama dibatalkan.

**Langkah**

1. Gambar garis A, lalu garis B.
2. Ketuk **Batalkan**. Garis B hilang.
3. Ketuk **Ulangi**. Garis B kembali. **Ulangi** di sini adalah tombol di alat gambar, bukan
   **Ulangi langkah ini**.
4. Ketuk **Batalkan** lagi supaya garis B hilang.
5. Gambar garis C.
6. Ketuk **Ulangi**.

**Yang diharapkan.** Garis B tidak kembali setelah garis C digambar. **Batalkan** menghapus
garis C, bukan garis B.

- [ ] Lulus
- [ ] Gagal
- [ ] Tidak bisa diuji

> Catatan:

### AT-14 — Penyimpanan penuh saat simpan otomatis

**Yang dicek.** Jika tablet benar-benar kehabisan ruang saat menyimpan, simpanan yang sudah ada
tidak rusak, dan ada kalimat pemulihan.

**Hasil wajib.** Checkpoint valid tidak rusak; pengguna mendapat opsi pemulihan.

**Langkah**

1. Jangan menghapus foto keluarga atau data orang lain untuk membuat ruang penuh.
2. Lihat sisa ruang di pengaturan tablet. Jika ruang masih longgar dan tidak ada cara aman
   untuk mengisinya (berkas besar yang boleh dihapus lagi), centang Tidak bisa diuji.
3. Jika ada berkas besar yang memang boleh dihapus: isi ruang sampai tablet melaporkan penyimpanan
   penuh, buka DrawSprout, gambar goresan baru, lalu lihat pesan.
4. Hapus berkas besar itu. Buka gambar yang sama lagi.

**Yang diharapkan.** Gambar yang sudah tersimpan sebelumnya masih utuh. Pesan yang ada di
aplikasi: "Penyimpanan penuh. Karya yang sudah tersimpan tetap aman, tetapi goresan terbaru belum
tersimpan. Kosongkan ruang, lalu coba lagi." Goresan yang dibuat saat ruang penuh boleh belum
masuk.

- [ ] Lulus
- [ ] Gagal
- [ ] Tidak bisa diuji

> Catatan:

### AT-16 — Pena dengan telapak menempel di kaca

**Yang dicek.** Dalam mode pensil, telapak tangan tidak menggambar, tidak menggeser halaman, dan
tidak memperbesar tanpa sengaja.

**Hasil wajib.** Pada mode pencil tidak ada stroke touch, scroll halaman, atau zoom tak disengaja
pada perangkat yang dinyatakan didukung.

**Langkah**

1. Jika tidak ada Apple Pencil atau stylus aktif, centang Tidak bisa diuji. Jari saja tidak
   menggantikan uji ini.
2. Pilih **Pensil**.
3. Letakkan telapak di kaca seperti saat menulis. Gambar dengan pena.
4. Sengaja geser telapak. Coba cubit dengan jari saat mode pensil.
5. Gambar terus sekitar sepuluh menit jika anak mau. Uji kenyamanan telapak yang disebut di
   rencana produk adalah satu sesi 10–20 menit. Jika waktunya lebih pendek, tulis berapa lama.
   Jangan menganggap sesi pendek sebagai bukti sesi 10–20 menit.

**Yang diharapkan.** Hanya pena yang menggores. Telapak tidak menambah garis, tidak menggeser
halaman, dan tidak mengubah ukuran kertas. Di Android, gerakan tepi sistem tetap bisa muncul;
catat jika gerakan itu menyela. Uji tepi saat mode jari ada di C-01, terpisah dari uji ini.

- [ ] Lulus
- [ ] Gagal
- [ ] Tidak bisa diuji

> Catatan:

### AT-17 — Goresan cepat, dan catatan kecepatan

**Yang dicek.** Goresan pendek yang cepat dan angkat-tempel berulang tidak macet, tidak
menyambung sendiri, dan tidak hilang berulang. Kecepatan gambar dan keterlambatan dicatat.

**Hasil wajib.** Tidak ada input macet, garis penghubung tak sengaja, atau kehilangan goresan
berulang; catat fps dan p95 latency.

Sasaran di dokumen produk, bagian kualitas: 60 gambar per detik pada perangkat uji, dan
keterlambatan dari sentuh sampai goresan p95 paling lama 50 milidetik, diukur di perangkat
nyata. Itu sasaran, bukan angka yang sudah diukur. Daftar ini tidak menambah sasaran lain.

**Langkah yang dilihat mata, ini perkiraan**

1. Pilih mode yang anak pakai.
2. Buat banyak garis pendek, cepat, angkat pena atau jari, tempel lagi, di tempat yang berbeda.
3. Saat ada panggilan, geser sistem, atau layar berubah di tengah garis, lihat garis itu dan
   garis berikutnya.
4. Tulis yang terlihat: garis mengikuti tangan, terasa tertinggal, tersambung ke garis lain,
   atau ada yang hilang. Jangan menulis angka milidetik dari perasaan. Melihat garis halus
   bukan bukti 60 gambar per detik dan bukan bukti 50 milidetik.

**Langkah dengan pemeriksa, ini juga perkiraan untuk angka waktunya**

Rekaman ini mengukur kerja halaman, bukan seluruh waktu dari pena menyentuh kaca sampai tinta
terlihat di layar. Angka di rekaman tidak sama dengan p95 50 milidetik pada dokumen produk.

- iPad: sambungkan ke Mac. Di iPad, Pengaturan, Safari, Lanjutan, nyalakan Pemeriksa Web.
  Di Mac, Safari, Pengaturan, Lanjutan, tampilkan menu Develop. Menu Develop, pilih iPad, pilih
  halaman DrawSprout. Rekam lini masa saat anak menggambar cepat. Catat jika ada frame yang
  jauh lebih lama dari yang lain.
- Android: dari komputer, Chrome, buka `chrome://inspect`, pilih halaman di tablet, rekam
  Performance saat anak menggambar cepat. Butuh sambungan yang Chrome kenali. Jika itu tidak
  berhasil, pakai pengamatan mata dan tulis bahwa rekaman tidak ada.

**Yang diharapkan.** Tidak ada gambar yang macet, tidak ada garis yang menyambung sendiri antar
sentuhan, dan goresan tidak hilang berulang-ulang. Tulis fps atau waktu frame hanya jika
rekaman menampilkannya, dan tandai sebagai perkiraan. Jika angka p95 sentuh-sampai-goresan tidak
diukur alat, jangan isi angka; tulis "tidak diukur".

- [ ] Lulus
- [ ] Gagal
- [ ] Tidak bisa diuji

> Catatan (termasuk angka yang benar-benar terlihat, atau "tidak diukur"):

### AT-18 — Tanpa tekanan, dan pena kapasitif

**Yang dicek.** Tebal garis tetap mengikuti pengaturan, dan pena yang dianggap jari bisa dipakai
di mode jari.

**Hasil wajib.** Ketebalan tetap berfungsi; stylus touch dapat dipakai melalui mode jari.

**Langkah**

1. Pilih **Jari**. Gambar pelan dan ringan, lalu tekan lebih keras. Tebal garis tidak boleh
   berubah karena tekanan.
2. Gerakkan **Ukuran kuas**. Garis baru mengikuti ukuran itu.
3. Jika ada pena kapasitif (pena layar biasa, bukan Apple Pencil dan bukan stylus aktif):
   mode **Jari**, gambar dengan pena itu.
4. Jika pena itu tidak ada, bagian pena kapasitif Tidak bisa diuji. Bagian tebal tanpa tekanan
   tetap bisa dicatat dari jari. Jika hanya satu bagian yang bisa dijalankan, hasil keseluruhan
   Tidak bisa diuji, dan catatan menyebut bagian yang berhasil.

**Yang diharapkan.** Menekan lebih keras tidak membuat garis lebih tebal. Ukuran kuas yang
dipilih tetap dipakai. Pena kapasitif menggambar di mode jari.

- [ ] Lulus
- [ ] Gagal
- [ ] Tidak bisa diuji

> Catatan:

### AT-19 — Buka tanpa internet setelah halaman tersimpan

**Yang dicek.** Setelah kalimat siap tanpa internet muncul, aplikasi yang ditutup penuh masih
bisa dibuka tanpa jaringan, lalu pelajaran, menggambar, lanjut, dan simpan tetap jalan.

**Hasil wajib.** Cold launch, lesson, drawing, resume, dan ekspor berfungsi; AI foto memberi
status perlu jaringan.

Bagian "AI foto" belum ada di aplikasi. Karena itu seluruh AT-19 belum bisa Lulus. Jika bagian
menggambar gagal, pilih Gagal. Jika menggambar berhasil dan hanya bagian foto yang tidak ada,
pilih Tidak bisa diuji dan tulis yang berhasil.

**Langkah**

1. Kunjungan pertama saat online, di <https://drawsprout.erriccjs.cloud>.
2. Tunggu kalimat **Bisa dibuka tanpa internet.** di layar pilih gambar. Jangan lanjut sebelum
   kalimat itu ada.
3. Gambar sedikit pada satu pelajaran dan tunggu **Tersimpan**, supaya ada yang dibuka lagi.
4. Nyalakan mode pesawat. Internet mati.
5. Tutup paksa aplikasi (cara yang sama seperti AT-05). Jangan hanya pindah aplikasi.
6. Buka lagi dari ikon layar utama, bukan dari tab yang masih hidup.
7. Layar pilih gambar muncul. Buka pelajaran. Gambar. Pindah langkah. Buka lagi gambar yang
   tadi tersimpan. Simpan PNG.
8. Ulangi langkah 4 sampai 7 dari tab Safari atau Chrome, setelah kalimat siap sudah pernah
   muncul di tab itu. Catat tab dan ikon secara terpisah.

**Yang diharapkan.** Tanpa internet, ikon tetap membuka aplikasi. Pelajaran terbuka, bisa
digambar, bisa dilanjut, gambar tersimpan bisa dibuka, PNG bisa disimpan. Tidak ada pelajaran
dari foto, jadi tidak ada pesan "perlu jaringan" untuk foto. Tulis itu di catatan.

- [ ] Lulus
- [ ] Gagal
- [ ] Tidak bisa diuji

> Catatan:

### AT-20 — Ekspor proyek, hapus data situs, impor

**Yang dicek.** Seharusnya ada berkas cadangan proyek yang bisa dikeluarkan, lalu data situs
dihapus, lalu berkas itu dimasukkan kembali.

**Hasil wajib.** Karya, state, versi lesson, dan alat dipulihkan; file invalid/terlalu besar
ditolak tanpa merusak data.

**Langkah**

1. Cari tombol untuk menyimpan atau membuka berkas cadangan proyek. **Simpan gambar (PNG)** dan
   **Simpan PNG** di Karyaku bukan berkas itu. PNG hanya gambar jadi.
2. Jika tidak ada simpan atau buka berkas proyek, berhenti.

**Yang diharapkan.** Fitur ini belum ada. Jangan menghapus data situs untuk uji ini, karena
tidak ada berkas untuk mengembalikan karya. Pilih Tidak bisa diuji.

- [ ] Lulus
- [ ] Gagal
- [ ] Tidak bisa diuji

> Catatan:

### AT-21 — Versi baru saat gambar sedang terbuka

**Yang dicek.** Aplikasi tidak memuat ulang sendiri di tengah gambar, karya tidak hilang, dan
perpindahan data lama diperiksa sebelum versi baru dipakai.

**Hasil wajib.** Tidak ada reload paksa atau data hilang; migrasi tervalidasi sebelum versi baru
digunakan.

Perpindahan simpanan dari bentuk lama belum ada. Jika pelajaran berubah, aplikasi membuka karya
baru dan dapat menampilkan "Pelajaran sudah diperbarui, jadi karya lama dibuka sebagai karya baru."
Karena bagian migrasi belum ada, seluruh AT-21 belum bisa Lulus. Gagal hanya jika yang dicoba
melanggar hasil wajib, misalnya halaman memuat ulang sendiri saat menggambar atau garis hilang.

**Langkah**

1. Buka layar pilih gambar. Lihat apakah ada kalimat "Ada versi baru. Gambar yang sudah tersimpan
   tetap ada." dengan **Nanti saja** dan **Muat versi baru**.
2. Jika kalimat itu tidak ada, bagian muat ulang Tidak bisa diuji hari ini. Tulis itu. Jangan
   memaksa versi baru.
3. Jika kalimat itu ada: buka sebuah gambar dulu. Kalimat itu tidak boleh muncul di atas gambar,
   dan halaman tidak boleh memuat ulang sendiri. Gambar tetap ada.
4. Kembali ke pilih gambar. Tunggu sampai keluar dari gambar selesai. Baru kemudian pertanyaan
   versi baru boleh muncul.
5. Ketuk **Nanti saja**. Gambar yang tersimpan masih ada di Karyaku.
6. Jika siap memuat ulang: **Muat versi baru**. Setelah halaman baru terbuka, buka karya yang sama.

**Yang diharapkan.** Tidak ada muat ulang paksa di tengah menggambar. Setelah memuat versi baru,
karya yang tersimpan masih bisa dibuka, kecuali catatan di atas tentang pelajaran yang berubah.
Tidak ada langkah di aplikasi yang memeriksa migrasi data lama, karena migrasi itu belum dibuat.

- [ ] Lulus
- [ ] Gagal
- [ ] Tidak bisa diuji

> Catatan:

### AT-22 — Tab browser dan layar utama

**Yang dicek.** Alur inti berjalan di tab dan di ikon. Jika simpanannya terpisah, harus ada cara
memindahkan berkas cadangan, dan cara itu berfungsi.

**Hasil wajib.** Keduanya lulus alur inti; jika storage terpisah, jalur pemindahan backup
dijelaskan dan berfungsi.

**Langkah**

1. Di tab Safari atau Chrome: buka pelajaran, gambar tanda yang mudah dikenali, **Batalkan**
   sekali, kembali ke pilih gambar. Lihat kartu di **Karyaku**.
2. Buka ikon layar utama. Cari tanda yang sama.
3. Di ikon, gambar tanda kedua. Kembali ke tab. Cari tanda kedua.
4. Di keduanya, simpan satu PNG.
5. Jika tanda tidak berpindah, itu simpanan terpisah. Berkas cadangan untuk memindahkannya belum
   ada (lihat AT-20). Jangan menghapus data situs.

**Yang diharapkan.** Menggambar, batal, dan PNG berhasil di tab dan di ikon. Jika karya saling
terlihat, bagian perpindahan terpenuhi karena tidak perlu dipindahkan. Jika karya tidak saling
terlihat dan tidak ada cara memindahkan, bagian perpindahan gagal. Jangan mencentang Lulus untuk
seluruh AT-22 dalam keadaan itu. Tulis hasil tab dan hasil ikon di catatan.

- [ ] Lulus
- [ ] Gagal
- [ ] Tidak bisa diuji

> Catatan:

## Ringkasan hasil

Isi satu tabel untuk iPad dan satu tabel untuk tablet Android. Tulis Lulus, Gagal, atau
Tidak bisa diuji.

### iPad

| Uji | Hasil | Catatan singkat |
| --- | --- | --- |
| C-01 Tepi Android, mode jari | | lewati jika ini iPad; tulis Tidak bisa diuji |
| C-02 Layar penuh | | |
| C-03 Pesan dilanjutkan | | |
| C-04 Jari dan Pensil | | |
| C-05 Kartu contoh | | |
| C-06 Karyaku | | |
| C-07 Gambar bebas | | |
| C-08 Ulangi langkah ini | | |
| AT-01 Selesaikan dan PNG | | |
| AT-02 Warna | | |
| AT-03 Petunjuk kembali | | |
| AT-04 Lanjut tanpa menggambar | | |
| AT-05 Tutup lalu buka | | |
| AT-06 Perbesar dan putar | | |
| AT-07 Batalkan dan ulangi | | |
| AT-14 Penyimpanan penuh | | |
| AT-16 Telapak dan pena | | |
| AT-17 Goresan cepat | | tulis angka hanya jika diukur; jika tidak, "tidak diukur" |
| AT-18 Tebal dan pena kapasitif | | |
| AT-19 Tanpa internet | | |
| AT-20 Berkas proyek | | |
| AT-21 Versi baru | | |
| AT-22 Tab dan ikon | | |

### Tablet Android

| Uji | Hasil | Catatan singkat |
| --- | --- | --- |
| C-01 Tepi Android, mode jari | | |
| C-02 Layar penuh | | |
| C-03 Pesan dilanjutkan | | |
| C-04 Jari dan Pensil | | |
| C-05 Kartu contoh | | |
| C-06 Karyaku | | |
| C-07 Gambar bebas | | |
| C-08 Ulangi langkah ini | | |
| AT-01 Selesaikan dan PNG | | |
| AT-02 Warna | | |
| AT-03 Petunjuk kembali | | |
| AT-04 Lanjut tanpa menggambar | | |
| AT-05 Tutup lalu buka | | |
| AT-06 Perbesar dan putar | | |
| AT-07 Batalkan dan ulangi | | |
| AT-14 Penyimpanan penuh | | |
| AT-16 Telapak dan pena | | |
| AT-17 Goresan cepat | | tulis angka hanya jika diukur; jika tidak, "tidak diukur" |
| AT-18 Tebal dan pena kapasitif | | |
| AT-19 Tanpa internet | | |
| AT-20 Berkas proyek | | |
| AT-21 Versi baru | | |
| AT-22 Tab dan ikon | | |

## Setelah dua perangkat selesai

Dokumen produk memakai AT-16 sampai AT-22 pada kedua susunan tablet sebagai syarat sebelum
mengatakan keduanya didukung. Daftar ini tidak menyatakan syarat itu sudah lulus.

Jika hanya satu susunan yang lulus, uji coba boleh dibatasi ke susunan itu. Susunan yang lain
belum diumumkan didukung.

Jika goresan tetap hilang, terasa terlambat, atau telapak dan gerakan sistem tetap mengganggu
di perangkat yang diprioritaskan, itu dicatat di hasil. Keputusan pindah ke aplikasi native ada
di dokumen produk, bukan di daftar ini.

## Menyimpan hasil

1. Salin [`device-results/TEMPLATE.md`](device-results/TEMPLATE.md).
2. Beri nama berkas `docs/device-results/<perangkat>-<tanggal>.md`.
   Contoh: `docs/device-results/ipad-2026-10-21.md` dan
   `docs/device-results/android-2026-10-21.md`.
3. Isi catatan perangkat dan tabel hasil. Jangan mengubah TEMPLATE.md.
4. Simpan berkas itu bersama catatan uji. Daftar centang di halaman ini tetap kosong, supaya
   bisa dicetak lagi.
