# Nandin Kitchen — Website Jualan Kue + Dashboard Admin POS (React + Vite + PWA)

Aplikasi toko kue **Nandin Kitchen** sesuai *Workflow Aplikasi Nandin Kitchen*: website pemesanan kue untuk pelanggan + dashboard admin (POS kasir, produk, pesanan, stok, pembelian, laporan, pengaturan). Dibangun dengan **React + JSX + Vite**, tema *cream · putih · cokelat* (bakery premium), responsif (desktop/tablet/HP), dan dapat dipasang sebagai **PWA**.

> Status backend: **mock API** (localStorage) — struktur service sudah meniru REST API Laravel
> sehingga mudah dipindah ke backend sungguhan (Laravel 11 + Sanctum + Midtrans Snap + webhook).

## Menjalankan

```bash
npm install
npm run dev        # buka http://localhost:5173
npm run build      # build produksi + PWA service worker (dist/ sudah termasuk .htaccess)
npm run preview    # pratinjau hasil build
```

## 🚀 Deploy ke cPanel + MySQL

Panduan lengkap migrasi ke hosting cPanel (subdomain `nandin-kitchen.ciptakaryadigital.id`,
database MySQL `toranggo_nandin`, Laravel API, Midtrans & SMTP produksi):
baca **[TUTORIAL-DEPLOY-CPANEL.md](./TUTORIAL-DEPLOY-CPANEL.md)**.



Pelanggan dapat **mendaftar sendiri** lewat tombol *Masuk/Daftar* di sisi kanan navbar
(dilengkapi captcha 5 karakter & tombol intip kata sandi).

## Fitur Utama

### Website pelanggan (storefront)
- Beranda: **slider banner promo** (maks. 6 slide, dikelola dari dashboard — desktop tampil 2 sekaligus, mobile 1 per satu bergeser otomatis), hero banner, promo, kategori, produk unggulan.
- Katalog: pencarian, filter kategori (cake, brownies, cookies, pastry, hampers), sortir harga.
- Detail produk: ukuran & varian dengan penyesuaian harga, jumlah, catatan pesanan.
- Keranjang tersimpan di perangkat (localStorage).
- Checkout: data pemesan, ambil di toko / diantar (alamat + jadwal), pajak & ongkir otomatis,
  gratis ongkir di atas ambang.
- Pembayaran: **WhatsApp Click-to-Chat** (ringkasan pesanan otomatis) atau **Midtrans Snap**
  (simulasi sandbox — siap diganti token Snap backend + webhook).
- Pesanan Saya: status pesanan (menunggu → diproses → siap → dikirim → selesai), batal pesanan.
- Tentang Kami, tombol WhatsApp mengambang, PWA install prompt.

### Dashboard admin (`/admin`)
1. **Dashboard** — omzet hari ini, transaksi, pesanan masuk, grafik 7 hari, produk terlaris, notifikasi stok.
2. **POS Kasir** — pencarian cepat, diskon, tunai/transfer/QRIS, kembalian, cetak struk 58mm.
3. **Produk & Kategori** — CRUD produk (SKU, harga modal/jual, stok, ukuran, varian, foto upload/URL,
   status & pre-order) + CRUD kategori.
4. **Transaksi & Pesanan** — filter kanal/status, detail, verifikasi pembayaran, ubah status, batalkan,
   konfirmasi WA, cetak struk.
5. **Stok** — kartu stok, stok masuk/keluar manual, riwayat pergerakan, notifikasi stok menipis.
6. **Pembelian & Biaya** — pembelian supplier (otomatis stok masuk) + pengeluaran operasional.
7. **Laporan** — periode (hari/7 hari/30 hari/kustom), omzet, diskon, HPP & laba kotor, laba bersih,
   metode pembayaran, produk terlaris, **ekspor CSV**.
8. **Pengaturan** — profil toko, **logo & favicon custom (upload/URL + kembali ke default)**, **banner slider beranda** (maks. 6: upload/URL gambar atau emoji, judul, tombol link, urutan, aktif/nonaktif),
   nomor WhatsApp admin, konfigurasi **Midtrans** (sandbox/production, merchant & key — server key tersembunyi),
   konfigurasi **SMTP** (host/port/enkripsi/username/password, preset penyedia, email tes, notifikasi otomatis
   pesanan baru/pembayaran/selesai + outbox), ongkir/pajak/batas stok, akun admin & kasir, reset data.

### PWA
- `manifest.webmanifest` + ikon Nandin Kitchen, tampilan standalone, theme color cokelat.
- Service worker: cache aset & halaman, halaman offline (`/offline.html`).

## Footer
- Copyright tahun berjalan (otomatis) © Nandin Kitchen.
- *Developed by [Cipta Karya Digital Indonesia](https://ciptakaryadigital.id)*.

## Struktur Folder

```
nandin-kitchen/
├── public/                # logo, favicon, ikon PWA, manifest, sw.js, offline.html
├── src/
│   ├── app/router.jsx
│   ├── components/
│   │   ├── common/        # AuthModal, Captcha, PasswordInput, Modal, Toast, Chart, Photo
│   │   ├── products/      # ProductCard
│   │   └── admin/         # Receipt (struk kasir)
│   ├── layouts/           # StoreLayout, AdminLayout
│   ├── pages/
│   │   ├── store/         # Home, Products, ProductDetail, Cart, Checkout, MyOrders, About
│   │   └── admin/         # AdminLogin, Dashboard, POS, ProductsAdmin, OrdersAdmin,
│   │                      # StockAdmin, PurchasesAdmin, ReportsAdmin, SettingsAdmin
│   ├── context/           # Settings, Auth, Cart, Data
│   ├── services/          # db.js (mock API) + seed.js
│   └── utils/             # format.js, wa.js
├── index.html
└── package.json
```

## Migrasi ke Backend Laravel (Tahap 5–6 workflow)
- Ganti isi `src/services/db.js` dengan panggilan `fetch` ke REST API (struktur collection sudah disamakan).
- Login/register → Laravel Sanctum; captcha bisa divalidasi ulang di server.
- Midtrans: backend membuat transaksi + token Snap, verifikasi via **webhook** (bukan halaman sukses).
- SMTP: kirim email via Laravel `Mail::send()` memakai konfigurasi pada tab Pengaturan → SMTP
  (outbox simulasi tinggal diganti endpoint `POST /api/settings/smtp/test`).
- Validasi harga, stok, diskon, dan total tetap di backend; stok dipotong atomik saat pembayaran terverifikasi.
# nandin-kitchen
