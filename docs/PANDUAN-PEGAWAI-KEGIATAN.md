# Pembaruan pegawai dan kegiatan

Paket ini untuk versi aplikasi Dinsos NodeJS terakhir dalam percakapan ini.

## Pemasangan

1. Hentikan server dengan Ctrl+C.
2. Salin `server.js`, `schema.sql`, serta folder `public` dari paket ke folder proyek `dinsos-nodejs`, dan setujui penggantian file.
3. Jalankan kembali `npm start`. Tabel galeri dan tautan video dibuat otomatis saat server mulai; data lama tetap dipertahankan. Tidak perlu menghapus database, mengunggah ulang foto lama, atau memasang dependensi baru.
4. Di Mac, tekan Command+Shift+R pada browser untuk memuat JavaScript dan CSS terbaru.

`test/media.test.js` adalah pengujian tambahan, dapat disalin ke folder `test`. Jalankan `npm test` bila ingin memeriksa aplikasi.

## Pegawai

- Kartu menampilkan potret, status PNS/PPPK, nama, jabatan, penempatan, dan NIP.
- Foto opsional. Jika kosong atau gagal dimuat, website menampilkan avatar bawaan.
- Saat edit, unggah foto baru untuk mengganti foto lama; atau centang **Hapus foto dan gunakan avatar default**. Jika foto baru dipilih, foto baru tersebut yang digunakan.

## Kegiatan

- Daftar menampilkan sampul dan ringkasan. **Baca selengkapnya** membuka halaman kegiatan tersendiri dengan uraian lengkap.
- Unggah hingga 6 foto JPG/PNG sekaligus, maksimal 5 MB per foto dan total unggahan 20 MB. Foto pertama menjadi sampul.
- Saat edit, hapus centang foto yang ingin dihapus. Foto baru ditambahkan setelah foto yang dipertahankan. Penghapusan file dilakukan setelah perubahan berhasil disimpan.
- Galeri memiliki tombol sebelumnya, berikutnya, dan **Putar otomatis / Jeda slideshow**, dengan interval 5 detik. Pemutaran dimulai atas pilihan pengunjung dan berhenti saat berpindah halaman.
- Foto lama dari versi sebelumnya tetap muncul sebagai foto galeri pertama.
- Tautan YouTube opsional. Mendukung tautan watch, youtu.be, Shorts, live, dan embed. Video baru dimuat ketika pengunjung menekan **Putar video**; tersedia pula tautan **Buka di YouTube**.
- File video tidak disimpan oleh aplikasi. Database hanya menyimpan ID video; foto tetap berupa file di server dengan metadata di database.
- Kegiatan tanpa foto tetap dapat diterbitkan, termasuk kegiatan dengan video saja.
- Video harus mengizinkan penyematan dari pengaturan YouTube. Jika YouTube membatasi penyematan atau jaringan memblokirnya, gunakan **Buka di YouTube**.

## Verifikasi

14 pengujian otomatis lulus pada Node.js v24 / SQLite, termasuk data lama, foto pegawai kosong, penggantian/penghapusan foto, galeri banyak foto, validasi tautan YouTube, pembatasan akses, dan penolakan edit menggunakan revisi lama. Sintaks server dan JavaScript telah diperiksa. Tampilan belum diuji langsung di browser dan jalur MySQL belum diuji pada lingkungan ini.
