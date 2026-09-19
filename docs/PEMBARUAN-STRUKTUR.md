# Memasang pembaruan struktur kode

Paket ini berisi kode baru/perubahan dan gambar yang dipindahkan ke lokasi baru. Database, unggahan pengguna, `.env`, dan `node_modules` tidak disertakan. Tidak ada perubahan format data atau alur pelayanan yang disengaja dalam refaktor ini.

## Langkah untuk aplikasi yang sudah berjalan

1. Hentikan server dengan Ctrl+C.
2. Buat salinan cadangan proyek. Untuk SQLite, lakukan saat server berhenti agar database dan berkas WAL tersalin konsisten. Jika memakai MySQL, cadangkan database dengan mekanisme yang biasa digunakan.
3. Ekstrak ZIP ke folder sementara.
4. Salin **isi** folder `dinsos-nodejs` dari ZIP ke folder proyek lama. Gabungkan folder, lalu timpa file dengan nama yang sama. Jangan mengganti keseluruhan folder proyek atau `public` dengan operasi yang menghapus isi lama.
5. Pertahankan `.env`, `data/`, dan semua direktori pada `DATA_DIR` yang sudah digunakan. Jangan menghapus database, uploads, public-uploads, atau information-uploads.
6. Dari direktori utama proyek, jalankan:

```sh
npm test
npm start
```

Tidak perlu menjalankan `npm run init` atau membuat ulang akun. Tidak ada dependensi baru; `npm ci` hanya diperlukan bila dependensi belum terpasang. Paket mengandalkan `package.json`/lockfile aplikasi yang sudah ada.

Buka `http://localhost:3000` atau alamat `APP_ORIGIN` Anda. Muat ulang halaman sepenuhnya; di Mac gunakan Cmd+Shift+R. Periksa masuk akun, dashboard, informasi publik, dan satu pengajuan uji.

## File penting

- **Salin `src/` dan `public/js/` secara lengkap.** Entry point lama sekarang mengimpor modul dari folder ini.
- `server.js` dan `cli.js` tetap berada di root sehingga `npm start`, `npm run init`, dan `npm run user` tetap berlaku.
- `public/app.js` dan `public/style.css` sekarang hanya menjadi entry point/impor.
- Skema aktif berada di `src/database/schema.sql`. File `schema.sql` root yang disertakan hanya catatan penunjuk, bukan SQL untuk inisialisasi.
- `db.js`, `security.js`, dan `information-requests.js` root adalah penghubung kompatibilitas. Pertahankan saat memasang paket ini.
- Gambar menggunakan `public/assets/images/`. URL gambar lama tetap dilayani agar tautan yang sudah ada tidak rusak.

## Merapikan sisa file lama (opsional)

Setelah pembaruan teruji, file berikut boleh dipindahkan ke cadangan di luar proyek karena aplikasi tidak membacanya lagi:

- `public/logo.png`, `public/kantor-dinas-sosial.jpg`, dan `public/struktur-organisasi.png` — salinannya sudah ada di `public/assets/images/`.
- `PANDUAN-KELOLA-AKUN.md`, `PANDUAN-PEGAWAI-KEGIATAN.md`, dan `PANDUAN-PERMOHONAN-INFORMASI.md` di root — panduan berada di `docs/`.
- `schema.sql` di root — skema aktif berada di `src/database/schema.sql`.

Jangan menghapus berkas lain hanya karena tidak tercantum di atas. File lokal tambahan milik Anda tidak tercakup dalam refaktor ini.

## Jika perlu kembali ke versi lama

Hentikan server, lalu pulihkan kode dari salinan cadangan. Pertahankan data yang sedang digunakan kecuali memang bermaksud memulihkan seluruh snapshot. Jangan mencampurkan entry point lama dengan sebagian modul baru.

## Verifikasi paket

Pengujian otomatis memakai direktori sementara, bukan database aplikasi Anda. Seluruh 19 pengujian berhasil dengan SQLite pada Node.js 24. Uji browser visual dan MySQL nyata belum dilakukan ulang.
