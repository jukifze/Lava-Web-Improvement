# Simulasi pelanggan → admin → pelanggan

Tanggal verifikasi: 10 Oktober 2026.

## Hasil aktual

**22 skenario lolos**, exit code 0, melalui `npm run test:simulation`.
Halaman dan handler React asli dijalankan dalam DOM terisolasi, memakai API demo dan penyimpanan sendiri. Ini bukan rekaman klik browser visual dan bukan pesanan produksi. Data browser pengguna tidak dibaca atau diubah.

Alur utama yang telah disimulasikan:

`Form pesanan → CTA pelacakan → status awal → login admin → detail pesanan → konfirmasi → proses → dua foto → galeri/pelacakan pelanggan → siap diambil → selesai → logout`

| Sisi | Pemeriksaan | Hasil |
| --- | --- | --- |
| Pelanggan | Identitas wajib, pembuatan order demo, kode pada CTA sama dengan order tersimpan | Lolos |
| Pelanggan | Tracking dengan kode + WhatsApp; 08 dan +628; nomor salah menghapus hasil sebelumnya | Lolos |
| Admin | Route guard, password salah, login demo, daftar/detail order yang sama | Lolos |
| Admin | Status sesuai urutan, dilarang lompat/aktifkan ulang, timestamp history | Lolos |
| Admin | Satu foto tidak dapat disimpan; dua file menampilkan preview; gagal upload tidak memberi sukses palsu; retry | Lolos, transport Cloudinary dimock |
| Pelanggan | Foto before/after dari order, mode berdampingan, input slider, pointer drag, detail galeri dan modal zoom/Escape | Lolos dalam DOM |
| Pelanggan | Refresh mengambil perubahan status tanpa reload/isi ulang kredensial; semua tahap selesai ditandai terlewati | Lolos |
| Galeri | Simpan ulang tidak menduplikasi; entri tersembunyi tidak tersedia publik; dokumentasi order tetap tersedia lewat tracking | Lolos, toggle visibility melalui API |
| Metode lain | Dijemput, produk dikirim, produk ambil sendiri sampai selesai | Lolos melalui API demo |
| Terminal | Pesanan dibatalkan tidak menampilkan tahap aktif; logout mengunci panel kembali | Lolos |

Verifikasi tambahan pada sesi ini:

- `npm test`: 29 tes lolos, termasuk validasi backend dengan mock Firestore, bukan emulator.
- `npm run test:ui`: empat render smoke test dan integrasi API demo lolos.
- `npm run build`: lolos; warning chunk PDF >500 kB masih ada.
- `npm run test:build`: lolos, nomor pelanggan impor dan password demo tidak muncul di bundle produksi.

## Cara mengulang otomatis

```sh
npm run test:simulation
```

Script berada di `scripts/simulate-order-flow.mjs`; jsdom ditambahkan hanya sebagai dependency development. Script menolak Firebase yang aktif, memakai localStorage DOM terisolasi, dan menolak request eksternal selain endpoint upload yang ditangani stub. Captcha, PDF, dan peta diganti hanya oleh plugin dalam script tes, tidak mengubah aplikasi atau konfigurasi keamanan produksi.

DOM pengujian tidak menggambar layout atau memuat bitmap eksternal. Kemampuan dan batas emulator ini dijelaskan dalam [dokumentasi jsdom](https://github.com/jsdom/jsdom).

## Cara mencoba sendiri di browser lokal

Gunakan **origin yang sama** untuk kedua tab, misalnya `http://127.0.0.1:3000`. Jangan campur `localhost` dengan `127.0.0.1`, port lain, browser/profil lain, atau mode incognito: pesanan demo tersimpan per-origin/per-profil, bukan di server.

### 1. Tab pelanggan — buat pesanan baru

1. Buka `/pesan?service=srv-white` saat `npm run dev` aktif.
2. Pilih **Antar Sendiri ke Outlet** untuk alur paling sederhana.
3. Isi nama contoh dan WhatsApp contoh `081234567890`, pilih jadwal, lalu selesaikan pemesanan dan puzzle demo sendiri.
4. Salin kode yang tampil pada **Nomor Tiket Pesanan**. Kode setiap pesanan berbeda.
5. Klik **Lacak Progres Pesanan**, masukkan WhatsApp yang sama, lalu **Lacak Pesanan**.
6. Status awal harus **Menunggu Konfirmasi**. Foto belum tersedia sampai admin menambahkan pasangan foto.

Gunakan order baru hasil pemesanan sesudah perubahan fitur. Tombol **Coba contoh pelacakan** memakai contoh bawaan yang terpisah dan tidak berubah mengikuti order yang dikelola admin.

### 2. Tab admin — kelola order yang sama

1. Buka `/admin/login` pada origin/profil browser yang sama.
2. Hanya untuk development tanpa Firebase, akun demo adalah `admin@lavestreat.com` / `admin123`.
3. Buka menu Pesanan, cari **kode dari tab pelanggan**, lalu buka detailnya.
4. Pada **Perbarui Status Pesanan**, pilih **Dikonfirmasi** lalu **Terapkan Status Baru**.
5. Kembali ke tab pelanggan dan tekan **Perbarui**: status harus ikut berubah, bukan otomatis real-time.
6. Lanjutkan admin ke **Diproses**. Dropdown hanya menyediakan transisi yang diizinkan.

### 3. Admin — dokumentasi before/after

1. Pada detail order, cari **Dokumentasi Before-After (Galeri)**.
2. Pilih foto **Sebelum** dan **Sesudah**, lalu isi judul serta nama layanan. Jika dokumentasi sudah ada, klik **Perbarui Foto Galeri**.
3. Pastikan preview kedua foto tampil. Satu foto saja tidak boleh bisa disimpan.
4. Klik **Simpan ke Galeri & Pesanan**.
5. Tunggu konfirmasi penyimpanan. Jika upload gagal, foto belum dianggap tersimpan; periksa Cloudinary/koneksi lalu coba lagi.

**Perhatian:** upload manual melalui browser memakai akun/preset Cloudinary yang diisi di `.env` dan benar-benar membuat aset di layanan tersebut. Simulasi otomatis tidak melakukan upload ini. Gunakan foto uji milik sendiri dan preset pengujian jika tidak ingin menambah aset ke akun produksi.

### 4. Pelanggan — lihat perubahan

1. Tekan **Perbarui** pada tab tracking yang masih berisi kode + WhatsApp tadi.
2. Pasangan foto harus tampil pada **Before–After pesanan Anda**.
3. Coba **Geser** dan **Berdampingan**; gunakan input slider serta tombol panah di browser untuk pemeriksaan keyboard manual.
4. Buka `/galeri`, temukan judul dokumentasi, lalu **Lihat detail**. Coba perbesar foto dan tutup modal dengan Escape.
5. Nama, WhatsApp, alamat, dan catatan pelanggan tidak boleh ditampilkan pada galeri publik.

### 5. Admin — selesaikan

1. Ubah **Diproses → Siap Diambil → Selesai**, satu tahap setiap aksi.
2. Pelanggan menekan **Perbarui** dan harus melihat **Selesai** beserta foto yang tetap tersedia.
3. Detail admin pada tahap akhir tidak lagi menawarkan perubahan status.
4. Klik **Keluar**; membuka panel lagi harus meminta login.

Untuk metode dijemput, alurnya **Menunggu Konfirmasi → Dikonfirmasi → Sedang Dijemput → Diproses → Siap Diantar → Selesai**. Produk sabun dikirim langsung memakai **Dikonfirmasi → Dikirim → Selesai**, tanpa tahap cuci fiktif.

## Batas yang belum diverifikasi

- Inventory kontrol browser pada sesi ini kosong; tidak ada QA visual browser, ukuran layar, fokus keyboard lengkap, gestur perangkat sentuh, atau gambar nyata.
- Captcha asli, PDF, GPS/peta/rute, upload Cloudinary live, Firebase Auth/Functions/Rules live dan emulator belum diuji end-to-end.
- Keberhasilan simulasi demo bukan bukti kesiapan produksi atau sinkronisasi antarperangkat. Backend asli tetap perlu konfigurasi dan pengujian terpisah.
- Temuan dependency, CMS, keamanan data lama, serta pekerjaan tersisa di `AUDIT-PROGRESS-BEFORE-AFTER.md` tetap berlaku.
