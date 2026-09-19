# Fitur Kelola Akun Petugas

Admin dinas sekarang dapat membuat dan mengelola akun petugas langsung dari **Dashboard → Kelola akun petugas**. Perintah terminal `npm run user` tetap dapat dipakai sebagai sarana pemulihan, tetapi tidak lagi diperlukan untuk pekerjaan rutin.

## Pemasangan pembaruan

1. Cadangkan folder `data` aplikasi.
2. Ganti `server.js`, `db.js`, `schema.sql`, `public/app.js`, dan `public/style.css` dengan versi pada paket ini.
3. Jalankan aplikasi seperti biasa:

   ```bash
   npm start
   ```

Saat aplikasi melakukan inisialisasi, kolom status akun ditambahkan otomatis ke database lama. Semua akun yang sudah ada tetap aktif.

## Yang dapat dilakukan admin

- Membuat akun operator, kepala bidang, petugas perlindungan, pimpinan, atau admin.
- Mengubah nama, email, peran, dan bidang penempatan.
- Mereset kata sandi akun (minimal 12 karakter).
- Menonaktifkan dan mengaktifkan kembali akun.

Akun yang dinonaktifkan langsung kehilangan semua sesi masuk dan tidak dapat login kembali. Data akun tidak dihapus permanen agar jejak audit pengajuan tetap utuh.

## Aturan peran dan bidang

| Peran | Penempatan yang tersedia |
|---|---|
| Operator | Rehabsos, Linjamsos |
| Kepala Bidang | Rehabsos, Linjamsos, Anak, Perempuan |
| Petugas Perlindungan | Anak, Perempuan |
| Pimpinan | Umum |
| Admin | Umum |

Admin tidak dapat menonaktifkan atau menurunkan peran akun yang sedang digunakannya sendiri. Sistem juga memastikan minimal satu admin tetap aktif.

## Pemeriksaan

Jalankan:

```bash
npm test
```

Pengujian mencakup pembuatan akun, pembatasan akses non-admin, reset kata sandi, pencabutan sesi saat akun dinonaktifkan, dan perlindungan akun admin.
