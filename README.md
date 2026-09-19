# Portal Dinas Sosial P3A

Aplikasi HTML, CSS, JavaScript, dan Node.js dengan kode yang dipisahkan berdasarkan fitur. Frontend memakai ES modules bawaan browser, tanpa proses build.

## Paket proyek lengkap

Ekstrak paket ke folder baru. Tidak perlu menimpa kode proyek lama.
Baca **[panduan menjalankan paket lengkap](docs/MULAI-DI-SINI.md)** untuk membawa data lama atau memasang aplikasi baru.

## Menjalankan aplikasi

Dari direktori utama proyek, gunakan Node.js 24 atau lebih baru:

```sh
npm ci
npm start
```

Untuk instalasi baru saja, siapkan `.env` dari `.env.example` dan jalankan `npm run init` terlebih dahulu. Alamat bawaan adalah `http://localhost:3000`; sesuaikan `APP_ORIGIN` bila menggunakan alamat lain. Database SQLite bawaan berada di `data/dinsos.sqlite`; `DATA_DIR` tetap dibaca relatif terhadap direktori saat perintah dijalankan.

Akun petugas dikelola admin melalui menu Akun Petugas. CLI `npm run user` tetap tersedia untuk pembuatan admin awal. Operator Sekretariat memakai peran `operator` dan penempatan `sekretariat`; Sekretaris Dinas memakai peran `sekretaris`.

## Lokasi kode

| Direktori/file | Isi |
| --- | --- |
| `server.js` | Entry point server; menjalankan inisialisasi dan listen |
| `cli.js` | Entry point perintah CLI |
| `src/app.js` | Merangkai HTTP, session, dan handler fitur |
| `src/features/` | API autentikasi, akun, pengajuan, konten, dan permohonan informasi |
| `src/http/` | Pembacaan request, header keamanan, session, dan penyajian file |
| `src/security/` | Hash kata sandi, hak akses, dan penempatan petugas |
| `src/database/` | Koneksi, inisialisasi, program awal, dan skema SQL |
| `src/shared/` | Validasi yang digunakan beberapa fitur |
| `public/index.html` | Kerangka halaman, profil, visi-misi, dan footer |
| `public/js/` | Modul antarmuka per fitur, konfigurasi, dan router |
| `public/css/` | Gaya tampilan per bagian |
| `public/assets/images/` | Logo, foto kantor, dan bagan organisasi |
| `docs/` | Panduan pemakaian, pembaruan, dan pengembangan |
| `test/` | Pengujian integrasi dan akses aset |
| `data/` | Data aplikasi; tidak disertakan dalam paket pembaruan |

Lihat [panduan struktur kode](docs/STRUKTUR-KODE.md) untuk memilih file yang perlu diedit saat mengembangkan fitur. File `db.js`, `security.js`, dan `information-requests.js` di root hanya meneruskan ekspor untuk kompatibilitas; implementasinya berada di `src/`.

## Fitur yang dipertahankan

- Informasi publik: pegawai, kegiatan dengan galeri/YouTube, dokumen, dan pengumuman.
- Empat halaman bidang, tupoksi, kontak, serta jadwal pelayanan yang diatur admin.
- CRUD konten dan pengelolaan akun petugas dari dashboard admin.
- Pengajuan bantuan, kelengkapan dokumen, perbaikan, persetujuan Kabid, dan riwayat.
- Draf bantuan hanya dapat diakses pemilik; tidak masuk rekap petugas.
- Permohonan informasi melalui admin → operator bidang → Kabid/Sekretaris → admin → pemohon.
- Preview PDF/gambar dengan pemeriksaan akses dan tombol unduh terpisah.

Pelaporan kekerasan anak/perempuan tetap belum menerima pengajuan dalam implementasi ini. Refaktor struktur tidak membuka layanan tersebut atau mengubah hak akses.

## Pengujian

```sh
npm test
```

19 pengujian berhasil pada Node.js 24 dengan SQLite, termasuk pemuatan seluruh dependensi JavaScript/CSS, privasi draf, alur persetujuan, penggantian dokumen, akun, dan persistensi data. MySQL nyata, pemutaran YouTube, dan tampilan di browser belum diuji ulang dalam refaktor ini.

Paket ini tidak menambahkan dependensi runtime. Gunakan `src/database/schema.sql` sebagai sumber skema; tidak perlu mengimpor SQL secara manual untuk memasang pembaruan struktur.
