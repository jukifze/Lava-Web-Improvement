# Audit proyek & implementasi Progress Tracking / Before–After

Tanggal: 10 Oktober 2026. Ruang lingkup: kode frontend publik/admin, API, Cloud Functions, Firestore rules, Cloudinary, design tokens, build, dependency, dan pengujian terkait fitur.

## Kesimpulan

Fitur sudah diimplementasikan dan lolos pengujian lokal yang tersedia. **Belum layak dinyatakan bebas kendala atau siap produksi**: konfigurasi Firebase/reCAPTCHA belum tersedia, belum ada pengujian browser visual atau Firebase emulator/live, dan dependency lama masih memiliki advisory. Tidak ada deploy atau perubahan data live dilakukan.

## Yang selesai

- `/lacak-pesanan`: kode struk + WhatsApp, loading/error/empty states, pembaruan manual, status/timestamp, timeline sesuai metode, dan foto hasil perawatan.
- Demo development jelas diberi label, tidak mencari data pelanggan impor, tidak aktif pada build produksi.
- CTA pelacakan pada konfirmasi pesanan; kode URL tidak disertai nomor telepon. Navigasi desktop/mobile dan footer terhubung.
- `/galeri` dan detail: slider, keyboard range, mode berdampingan, sudut foto, zoom, framing, dan fallback gambar gagal.
- Typography dikembalikan ke Inter + Baloo 2; UI admin tetap Inter. Palet, komponen shared, sidebar dan pola layout umum dipertahankan. Modal mendapat focus trap, Escape dan restore focus.
- Pembuatan order, harga snapshot, status dan dokumentasi order produksi melewati server. Gagal server tidak lagi dianggap sukses lokal. Captcha tanpa secret tidak lolos.
- Status perubahan memakai transaksi; order sabun dikirim mengikuti alur PRD tanpa tahap cuci fiktif. Upload order + publikasi galeri atomik dan idempotent pada backend.
- Firestore: role admin dari custom claim; publik tidak membaca orders; client tidak menulis orders. Galeri/layanan/testimoni publik dibatasi flag tampil/aktif.
- Toggle visibility tidak lagi menghapus/menolak pasangan foto; galeri kosong produksi tidak diisi ulang oleh fallback; item demo yang dihapus tidak dihidupkan kembali dari fixture.
- Upload Cloudinary gagal memberi error, tidak diam-diam menyimpan base64. CSP mengizinkan endpoint upload dan refresh token Firebase.
- Popup peta tidak lagi memasukkan alamat pelanggan sebagai HTML mentah.
- Auto-seed saat kunjungan publik dihapus. Seeder tidak lagi menulis fixture orders atau metadata pelanggan galeri.
- Fixture order dan metadata pelanggan dibuang pada build, bukan sekadar disembunyikan oleh UI. Arsip sumber lokal tidak dihapus.
- PRD, design brief, dan security architecture diperbarui untuk penambahan ini.

## Verifikasi

| Pemeriksaan | Hasil / batasan |
|---|---|
| `npm test` | 29 tes lolos: proyeksi privasi, pasangan foto, workflow/metode, kredensial, limiter, harga server, otorisasi, transaksi/publikasi dan fixture build. Backend diuji dengan mock Firestore, bukan emulator. |
| `npm run test:ui` | Empat smoke test render JSX lolos. Integrasi API development create → track → status admin → foto → track lolos, menggunakan localStorage in-memory, bukan browser pengguna. |
| `npm run test:simulation` | 22 skenario React DOM/events dan API demo lolos, exit code 0: form pelanggan, CTA/WhatsApp, login/guard admin, status, preview/dua foto, kegagalan upload/retry, slider/pointer/mode, detail/zoom, refresh, galeri tersembunyi, metode lain, pembatalan dan logout. Captcha/PDF/peta/transport Cloudinary dimock; bukan QA visual atau layanan live. Lihat `SIMULASI-PROGRESS-BEFORE-AFTER.md`. |
| `npm run build` | Lolos. Masih ada warning chunk PDF >500 kB; bukan kegagalan build. |
| `npm run test:build` | Lolos: 50 chunk JS, 18 nilai nomor pelanggan impor tidak ditemukan; password demo tidak dikirim ke produksi. |
| Syntax/backend SDK | Node syntax check lolos; SDK asli berhasil memuat keempat callable. Runtime target diperbarui ke Node 22. Mesin lokal Node 24 menghasilkan engine warning saat install, bukan bukti validasi runtime cloud Node 22. |
| HTTP lokal | `/`, `/lacak-pesanan`, `/galeri`, `/pesan`, `/admin/login` dan modul fitur merespons 200. HTTP 200 tidak membuktikan interaksi/layout benar di browser. |
| Visual/browser | Tidak dilakukan: inventory browser tool kosong. Responsif, touch, drag, fokus modal dan kontras visual perlu QA browser sungguhan. |
| Firebase/reCAPTCHA/Cloudinary live | Tidak diuji end-to-end; tidak ada konfigurasi Firebase atau kredensial captcha proyek. Tidak mengirim pesanan atau upload gambar nyata. |

## Temuan tersisa — urutan prioritas

1. **P1 — Advisory dependency.** Audit npm online setelah pembaruan kompatibel: root 20 package terdampak (10 high, 10 moderate); backend 30 (2 high, 28 moderate), dengan runtime backend 9 (2 high, 7 moderate). Ini hitungan package termasuk dependensi transitif, bukan jumlah exploit yang sudah terbukti. DOMPurify diperbarui ke 3.4.16; perbaikan kompatibel juga diterapkan pada lockfile. Masih perlu migrasi terencana Firebase client/admin, Router, dan toolchain Tailwind; jangan memakai `audit fix --force` yang menyarankan downgrade/breaking change tanpa review. Sesudah migrasi ulangi seluruh test, build, serta audit.
2. **P1 — Aktivasi produksi.** Isi Firebase Web config dan `VITE_RECAPTCHA_SITE_KEY`; isi secret/hostname hanya di backend; set custom claim `role: admin`; deploy functions/rules/hosting bersama. Dengan config kosong, produksi tidak membuat order/admin lokal palsu. Tidak ada deployment dilakukan pada audit ini.
3. **P1 — Dokumen galeri lama.** Bila Firestore sebelumnya sudah di-seed, metadata seperti customer_phone/customer_name mungkin masih ada di dokumen publik. Sanitizer bundle/seeder bukan migrasi database. Bersihkan/pisahkan metadata sebelum membuka akses publik; rules Firestore bekerja per dokumen, bukan per field. Kode baru tidak menulis customer_name/phone ke galeri.
4. **P1 — Settings operasional masih publik pada implementasi lama.** `settings/general` dibaca publik dan dapat memuat daftar workers, nomor dan lokasi basecamp. Pisahkan data operasional ke dokumen admin-only; sediakan hanya outlet/kontak bisnis/jam operasional untuk publik. Ini masalah struktur lama di luar dua fitur baru, belum direstrukturisasi.
5. **P2 — CMS/published belum lengkap.** Rules content masih read-public tanpa flag published; beberapa keunggulan/promosi dan teks section masih hardcoded. Perlu keputusan publikasi + migrasi dokumen/komponen, bukan menambahkan rule yang mematikan konten tanpa migrasi.
6. **P2 — Kontak belum mengirim email server-side.** ContactPage masih handoff WA/mailto dengan slider client; callable sendContactEmail belum ada. Jangan menganggap slider sebagai captcha server atau email sudah terkirim.
7. **P2 — App Check & anti-abuse operasional.** App Check belum diaktifkan. Limiter tracking sudah ada, namun monitoring trafik, TTL expiresAt, budget alert, dan batas preset Cloudinary perlu dikonfigurasi di layanan asli.
8. **P2 — Peta/routing lama.** OSRM masih demo server tanpa SLA; rute belum dipersist sekali sesuai PRD, dan fallback garis lurus dapat disalahartikan sebagai rute jalan. Tidak ditambahkan tracking kurir real-time pada fitur baru.
9. **P2 — Pengujian rilis.** Jalankan emulator rules/callables, kasus penolakan captcha dan kegagalan jaringan, admin claims, race update status, Cloudinary upload, akses galeri tersembunyi, dan QA browser 360/390/768/1024/1440px. Periksa keyboard/modal/touch dan tidak ada horizontal overflow.
10. **P3 — Konsistensi legacy/performa.** Beberapa halaman lama masih memakai token Tailwind tak terdefinisi/utility versi lain. Fitur baru tidak menambah token tersebut. Chunk PDF besar perlu pemisahan loading/optimasi terukur. Belum tersedia lint/CI menyeluruh untuk seluruh proyek.

## Cara mencoba lokal

`npm run dev`, buka `/lacak-pesanan`, lalu **Coba contoh pelacakan**. Buka `/galeri` untuk slider/mode berdampingan, dan pilih Lihat detail untuk sudut/zoom. Akun demo admin hanya tersedia pada development tanpa Firebase. Tidak perlu menggunakan nomor pelanggan dari fixture asli.

## Sumber runtime

Node 18 sudah deprecated dan Node 22 didukung menurut [dokumentasi Firebase](https://firebase.google.com/docs/functions/manage-functions). Target deployment sekarang Node 22; ini tidak menggantikan pengujian deployment/emulator.

Whitelist CSP reCAPTCHA mengikuti [FAQ resmi Google](https://developers.google.com/recaptcha/docs/faq), termasuk connect-src Google reCAPTCHA dan kedua origin frame.
