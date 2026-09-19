# Pembaruan hak akses dan alur permohonan

## Pemasangan

1. Hentikan server dengan Ctrl+C.
2. Salin seluruh file dalam paket ke folder proyek Dinsos NodeJS terakhir, sesuai susunan foldernya. Setujui penggantian file.
3. Jalankan `npm start`, lalu tekan Command+Shift+R pada browser.
4. Tidak perlu menghapus database atau memasang dependensi baru. Perubahan tabel dan penyesuaian data berjalan otomatis saat server mulai.

## Pengajuan bantuan

- Draf hanya dapat dilihat pemilik pengajuan. Operator, kabid, admin, dan pimpinan tidak bisa membuka detail maupun lampirannya. Draf tidak dimasukkan dalam rekap petugas.
- Setelah pemohon mengirim pengajuan, operator dan kabid bidang terkait mendapat akses sesuai kewenangan sebelumnya. Admin dan pimpinan tetap hanya mendapat rekap.
- Daftar pengajuan menampilkan penanda kelengkapan dokumen. Detailnya memuat semua persyaratan dengan status Sudah diunggah atau Belum diunggah.
- Pemohon dapat menekan Unggah berkas pada persyaratan yang belum tersedia. Tombol mengarahkan ke formulir unggah dan memilih persyaratan tersebut.
- Tombol Kirim pengajuan tidak aktif sebelum seluruh persyaratan diunggah. Server juga tetap memeriksa kelengkapannya.
- Dokumen lengkap berarti seluruh jenis persyaratan telah diunggah, bukan berarti isi dokumen sudah dinyatakan sah.

## Pengaturan akun

Admin membuka Dashboard → Akun Petugas.

| Peran | Penempatan | Tugas permohonan informasi |
|---|---|---|
| Admin | Umum | Meneruskan permohonan ke tujuan; mengirim jawaban yang sudah disetujui |
| Operator | Salah satu dari empat bidang | Menyusun jawaban dan lampiran; meminta persetujuan kabid |
| Kabid | Salah satu dari empat bidang | Menyetujui atau mengembalikan jawaban untuk diperbaiki |
| Operator Sekretariat | Sekretariat | Menyusun jawaban tujuan Sekretariat |
| Sekretaris Dinas | Sekretariat | Menyetujui atau mengembalikan jawaban Sekretariat |
| Masyarakat | Akun pendaftaran masyarakat | Mengirim permohonan dan membaca jawaban resmi miliknya |

Operator kini dapat ditempatkan pada Bidang Anak atau Bidang Perempuan untuk menangani permohonan informasi. Peran Petugas Perlindungan tetap untuk penanganan kasus, tidak memperoleh akses permohonan informasi. Pimpinan hanya memiliki rekap bantuan, tidak mendapat akses isi permohonan informasi.

Identitas peran dalam sistem: `operator` dan `sekretaris`; keduanya memakai penempatan `sekretariat`. Akun lama dengan peran `sekretariat` otomatis diubah menjadi `operator` saat server dimulai, tanpa mengubah ID, kata sandi, atau riwayatnya. Akun baru dibuat oleh admin, bukan otomatis dibuat dengan kata sandi bawaan.

## Alur permohonan informasi

### Empat bidang

Pemohon → Admin → Operator bidang → Kabid → Admin → Pemohon.

1. Pemohon mengirim permohonan. Pilihan tujuan terdiri atas Sekretariat dan empat bidang.
2. Admin membuka permohonan, memastikan tujuan, lalu memilih Teruskan ke bidang. Sebelum diteruskan, bidang belum dapat melihatnya.
3. Operator bidang menulis draf jawaban lengkap, menambahkan PDF bila diperlukan, lalu memilih Ajukan jawaban untuk persetujuan.
4. Kabid memeriksa teks dan lampiran. Kabid dapat menyetujui atau mengembalikan untuk perbaikan dengan catatan wajib.
5. Bila dikembalikan, operator memperbaiki jawaban dan mengajukannya kembali. Lampiran draf revisi harus dipilih kembali jika diperlukan; lampiran draf sebelumnya tidak otomatis dipakai.
6. Sesudah disetujui, admin memilih Kirim jawaban yang disetujui ke pemohon. Teks dan PDF yang dikirim sama persis dengan draf terakhir yang disetujui. Admin tidak dapat menggantinya saat penerusan.
7. Permohonan berstatus selesai. Pemohon dapat membaca jawaban dan melakukan preview/unduh PDF di dashboard.

### Sekretariat

Pemohon → Admin → Operator Sekretariat → Sekretaris Dinas → Admin → Pemohon.

Langkah penanganan sama, dengan Operator Sekretariat sebagai penyusun dan Sekretaris Dinas sebagai pemberi persetujuan.

## Tampilan sesuai kewenangan

- Admin: menu pengelolaan dan antrean penerusan permohonan informasi.
- Operator/Kabid Rehabsos dan Linjamsos: ruang kerja bantuan dan permohonan informasi bidangnya.
- Operator/Kabid Anak dan Perempuan: ruang kerja permohonan informasi bidangnya.
- Operator Sekretariat/Sekretaris: ruang kerja permohonan informasi Sekretariat.
- Pimpinan: rekap bantuan.
- Masyarakat: pengajuan bantuan dan permohonan informasi miliknya sendiri.

Formulir pengajuan bantuan dan ajakan membuat permohonan informasi tidak ditampilkan kepada akun petugas. Halaman informasi publik tetap dapat dibaca semua peran.

## Privasi dan riwayat lama

Catatan penerusan, draf jawaban, persetujuan, dan koreksi adalah riwayat internal. Pemohon hanya melihat status umum Diajukan/Diproses/Selesai dan jawaban yang telah dikirim admin. PDF draf juga dibatasi di server, bukan hanya disembunyikan tombolnya.

Tujuan lama `umum` otomatis diubah menjadi `sekretariat`. Permohonan lama berstatus `diproses` dikembalikan ke status `diajukan` agar admin meneruskannya melalui alur baru. Permohonan yang sudah selesai tetap selesai; jawaban lama yang sudah terlanjur dikirim tetap dapat dibaca pemohon.

Dokumen jawaban disimpan di `DATA_DIR/information-uploads`. Sertakan folder tersebut dan database ketika membuat cadangan. Pemberitahuan email/WhatsApp belum tersedia; pemohon membaca jawaban di dashboard.

## Pengujian

18 pengujian otomatis lulus pada Node.js / SQLite, termasuk akses draf dan lampiran, penanda kelengkapan, pembuatan akun baru, alur keempat bidang dan Sekretariat, pengembalian untuk perbaikan, larangan melewati persetujuan, perlindungan draf jawaban, penerusan persis jawaban yang disetujui, dan migrasi data lama. Tampilan browser dan MySQL belum diuji langsung dalam lingkungan ini.
