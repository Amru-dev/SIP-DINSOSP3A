# Panduan pengembangan

## Alur backend

`server.js` membuka database dan menjalankan `createApp()` dari `src/app.js`. Untuk API, aplikasi memeriksa batas request, body, session, dan CSRF sebelum memanggil handler fitur. Handler yang menangani request mengembalikan nilai benar; handler lain mengembalikan `false`.

Setiap folder fitur menampung rute yang berkaitan. `service.js` menangani operasi bersama pengajuan; `repository.js` membentuk data kegiatan dari database. Validasi umum disimpan di `src/shared/validation.js`; aturan akses tetap ditegakkan server.

| Perubahan yang diinginkan | Lokasi utama |
| --- | --- |
| Masuk, keluar, registrasi | `src/features/auth/routes.js` |
| Kelola akun petugas | `src/features/accounts/routes.js`, `src/security/staff-roles.js` |
| Alur dan berkas pengajuan bantuan | `src/features/applications/`, `src/features/application-files/`, `src/security/access.js` |
| Alur permohonan informasi | `src/features/information-requests/routes.js` |
| Program dan persyaratan | `src/features/programs/routes.js` |
| Kontak serta jadwal bidang | `src/features/field-contacts/routes.js` |
| Kegiatan dan galeri | `src/features/activities/` |
| Pegawai dan dokumen publik | `src/features/public-content/routes.js` |
| Pengumuman | `src/features/announcements/routes.js` |
| Daftar informasi publik | `src/features/public-information/routes.js` |
| Schema dan inisialisasi | `src/database/index.js`, `src/database/schema.sql` |

Folder `src/http/` memisahkan penyajian aset publik, berkas publik, header keamanan, pembatasan request, JSON, dan session. Aset hanya disajikan dari lokasi yang diizinkan; jangan memperluasnya agar seluruh root proyek terbuka.

## Alur frontend

`index.html` memuat `app.js` sebagai ES module. Entry point tersebut mengimpor `js/main.js` untuk memasang event dan memuat session/program. `js/router.js` menentukan halaman berdasarkan hash URL.

- `js/core/`: API, state session, helper DOM, form, pesan, dan format tanggal.
- `js/config/`: nama bidang, tupoksi, dan label status.
- `js/layout/`: navigasi publik.
- `js/features/`: antarmuka setiap fitur. Pengajuan dan permohonan informasi memiliki file daftar/detail terpisah.
- `css/`: tampilan per bagian. `style.css` mempertahankan urutan impor karena beberapa gaya lama saling menimpa.

Contoh: untuk memperbaiki riwayat bantuan, edit `public/js/features/applications/components.js` dan `public/css/applications.css`. Untuk memperbaiki form kegiatan, edit `public/js/features/public-information/admin.js`; untuk detail kegiatan, edit `public/js/features/activities/views.js`.

Gunakan `state.user`/`state.programs` untuk data bersama. Gunakan `api()` untuk request agar token CSRF ikut terkirim. Semua input pengguna yang dimasukkan ke HTML harus melalui `esc()`. Menyembunyikan tombol tidak menggantikan pemeriksaan akses backend.

Modul tampilan tidak menjalankan inisialisasi halaman saat diimpor; pemasangan event awal berada di `main.js`. Sebagian fungsi tampilan mengimpor router untuk memuat ulang halaman setelah aksi, sehingga ada dependensi siklik antar fungsi. Hindari menjalankan render atau mengakses nilai impor di tingkat atas modul fitur.

## Menambahkan fitur

1. Buat handler dalam `src/features/<nama-fitur>/routes.js` dan daftarkan di `src/app.js`.
2. Pertahankan kontrak URL, status respons, dan validasi role/field untuk endpoint yang sudah dipakai.
3. Buat modul antarmuka di `public/js/features/<nama-fitur>/`, kemudian hubungkan lewat router/dashboard.
4. Tambahkan CSS di `public/css/` dan impor pada `public/style.css` jika diperlukan.
5. Tambahkan pengujian untuk perubahan perilaku, terutama hak akses dan transisi status.
6. Jalankan `npm test` dari root proyek.

Perintah test tidak membutuhkan database produksi. Perubahan skema berikutnya perlu migrasi yang menjaga data lama; jangan mengganti tabel yang sudah berisi data.

## Gaya penulisan

Gunakan indentasi dua spasi, titik koma, dan nama fungsi yang menjelaskan tujuannya. Konfigurasi `.editorconfig` dan `.prettierrc.json` disertakan untuk editor yang mendukungnya. Tidak ada formatter yang diwajibkan sebagai dependensi runtime.

Hindari menambahkan logika fitur langsung ke `server.js` atau `public/app.js`. Tambahkan komentar untuk alasan keputusan dan batasan penting, bukan mengulang arti setiap baris kode.
