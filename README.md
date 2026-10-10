<p align="center">
  <img src="public/logo.png" alt="Logo Lave Streat (L.A.V.E Treatment)" width="200" />
</p>

<h1 align="center">Lave Streat</h1>

<p align="center">
  Website resmi <strong>L.A.V.E Treatment</strong>: cuci sepatu, repaint, antar-jemput, dan produk perawatan sepatu di area Sidoarjo–Surabaya.
</p>

<p align="center">
  <img src="https://img.shields.io/badge/React-18-2F6FED?logo=react&logoColor=white" alt="React" />
  <img src="https://img.shields.io/badge/Vite-6-2F6FED?logo=vite&logoColor=white" alt="Vite" />
  <img src="https://img.shields.io/badge/Tailwind_CSS-3-0A3D66?logo=tailwindcss&logoColor=white" alt="Tailwind CSS" />
  <img src="https://img.shields.io/badge/Firebase-Firestore_%7C_Auth_%7C_Functions-FDB813?logo=firebase&logoColor=black" alt="Firebase" />
</p>

---

## Tentang

Proyek ini punya dua sisi:

1. **Landing page publik**: profil usaha, katalog layanan & produk sabun, galeri before–after, testimoni, lokasi outlet, promosi, dan form pemesanan (tanpa login, dilindungi reCAPTCHA).
2. **Admin panel**: admin bisa mengelola konten landing page tanpa redeploy, pesanan masuk (terima, tolak, ubah status, rute peta), layanan, galeri, testimoni, dan pengaturan outlet.

## Fitur Utama

- 🧼 Katalog layanan cuci/repaint dan produk perawatan sepatu
- 🛒 Pemesanan guest dengan metode dijemput, antar sendiri, dikirim, atau ambil di outlet
- 🗺️ Pilih titik lokasi dan rute outlet → pelanggan dengan Leaflet + OpenStreetMap
- 🔒 Harga order dihitung ulang di server, plus verifikasi captcha di Cloud Function
- 🖼️ Upload gambar ke Cloudinary dari admin panel
- 📋 Riwayat status pesanan tercatat lengkap dengan timestamp

## Tech Stack

| Bagian | Teknologi |
| --- | --- |
| Frontend | React 18, Vite, Tailwind CSS, React Router, Motion |
| Backend & data | Firebase Firestore, Auth, Cloud Functions, Hosting |
| Media | Cloudinary (unsigned upload preset) |
| Peta | Leaflet, OpenStreetMap, OSRM |
| Keamanan | Google reCAPTCHA, Firestore Security Rules |

## Memulai

```bash
# 1. Install dependency
npm install

# 2. Salin env lalu isi kredensial Firebase & Cloudinary
cp .env.example .env

# 3. Jalankan dev server
npm run dev
```

Variabel environment yang dipakai:

```
VITE_FIREBASE_API_KEY
VITE_FIREBASE_AUTH_DOMAIN
VITE_FIREBASE_PROJECT_ID
VITE_FIREBASE_STORAGE_BUCKET
VITE_FIREBASE_MESSAGING_SENDER_ID
VITE_FIREBASE_APP_ID
VITE_CLOUDINARY_CLOUD_NAME
VITE_CLOUDINARY_UPLOAD_PRESET
VITE_USE_CLOUD_FUNCTIONS
```

Script lain: `npm run build` (build produksi) dan `npm run preview` (pratinjau hasil build).

## Struktur Proyek

```
src/
├── components/      # komponen shared (UI, peta, ImageUploader)
├── features/        # logika per fitur
├── lib/             # firebase, cloudinary, api per koleksi
└── pages/
    ├── public/      # halaman landing page
    └── admin/       # halaman admin panel
firebase-functions/  # Cloud Functions (captcha, order, email)
firestore.rules      # aturan keamanan Firestore
```

## Dokumentasi

- [`prd-lavestreat.md`](prd-lavestreat.md): requirement & data model
- [`design-brief-lavestreat.md`](design-brief-lavestreat.md): layout & komponen
- [`style-reference-lavestreat.md`](style-reference-lavestreat.md): design tokens
- [`security-architecture-lavestreat.md`](security-architecture-lavestreat.md): arsitektur keamanan

## Contributors

<table>
  <tr>
    <td align="center">
      <a href="https://github.com/Naufal-Ghani22">
        <img src="https://github.com/Naufal-Ghani22.png" width="80" alt="Naufal Ghani" /><br />
        <sub><b>Naufal Ghani</b></sub>
      </a>
    </td>
  </tr>
</table>
