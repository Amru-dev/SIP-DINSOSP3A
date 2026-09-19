# Menjalankan paket lengkap

Paket ini berisi seluruh kode sumber, gambar identitas dinas, skema database, pengujian, package.json, package-lock.json, dan contoh konfigurasi. Tidak memerlukan paket pembaruan sebelumnya.

Gunakan Node.js 24 atau lebih baru. Folder node_modules dipasang dengan npm ci agar sesuai komputer Anda. Database dan konfigurasi pribadi pada komputer Anda tidak termasuk ZIP ini.

## Memakai akun dan data lama

1. Hentikan server lama dengan Ctrl+C. Simpan folder lama sebagai cadangan.
2. Ekstrak ZIP ke lokasi berbeda. Folder dinsos-nodejs di dalam ZIP adalah proyek lengkap.
3. Salin file .env dari proyek lama ke root proyek baru. Di Finder Mac, tekan Cmd+Shift+. bila file .env tidak terlihat.
4. Salin seluruh folder data dari proyek lama ke root proyek baru saat server berhenti. Folder ini mencakup database SQLite beserta file pendampingnya, uploads, public-uploads, dan information-uploads. Jangan hanya menyalin file database.
5. Jika DATA_DIR di .env memakai lokasi khusus, salin seluruh direktori tersebut dan sesuaikan DATA_DIR agar menunjuk ke salinannya. Jika memakai MySQL, gunakan konfigurasi koneksi lama dan pertahankan seluruh direktori unggahan.
6. Buka Terminal pada direktori proyek baru dan jalankan:

```sh
npm ci
npm test
npm start
```

Buka http://localhost:3000 atau alamat APP_ORIGIN Anda. Akun dan data lama tersedia jika database serta unggahan disalin dengan benar. Tidak perlu membuat ulang akun atau menjalankan init untuk perpindahan ini.

## Instalasi baru tanpa data lama

Dari direktori proyek baru:

```sh
npm ci
cp .env.example .env
npm run init
```

Untuk membuat admin pertama di Terminal Mac (zsh):

```sh
read -s 'INITIAL_PASSWORD?Kata sandi admin (12–200 karakter): '
printf '\n'
export INITIAL_PASSWORD
npm run user -- admin@example.test "Admin Dinas" admin umum
unset INITIAL_PASSWORD
npm start
```

Ganti email contoh dengan email admin Anda. Kata sandi diketik ketika diminta, tidak perlu dibuat menjadi file. Setelah masuk, admin dapat menambahkan akun petugas melalui menu Akun Petugas.

## Panduan lain

- STRUKTUR-KODE.md: letak modul dan cara mengembangkan fitur.
- PANDUAN-KELOLA-AKUN.md: pengelolaan akun petugas.
- PANDUAN-PEGAWAI-KEGIATAN.md: pegawai dan kegiatan.
- PANDUAN-PERMOHONAN-INFORMASI.md: alur permohonan informasi.
- PEMBARUAN-STRUKTUR.md: panduan paket perubahan sebelumnya; tidak diperlukan untuk pemasangan paket lengkap ini.

Skema aktif berada di src/database/schema.sql. File penghubung db.js, security.js, dan information-requests.js di root dipertahankan untuk kompatibilitas. Gambar aktif berada di public/assets/images/.
