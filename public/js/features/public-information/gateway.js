import { dialog } from "../../core/ui.js";

export function publicGateway() {
  return (
    '<section class="section public-gateway">' +
    '<span class="eyebrow">LAYANAN INFORMASI PUBLIK</span>' +
    "<h2>Akses informasi dinas</h2>" +
    '<p class="page-intro">Informasi utama disajikan pada halaman tersendiri agar lebih mudah dicari, disaring, dan dibaca.</p>' +
    '<div class="cards gateway-grid">' +
    '<a class="card gateway-card" href="#pegawai">' +
    '<span class="gateway-number">01</span>' +
    "<h3>Data Pegawai</h3>" +
    "<p>Profil, NIP, jabatan, status kepegawaian, dan bidang penempatan.</p>" +
    "<strong>Lihat data pegawai →</strong>" +
    "</a>" +
    '<a class="card gateway-card" href="#kegiatan">' +
    '<span class="gateway-number">02</span>' +
    "<h3>Kegiatan Dinas</h3>" +
    "<p>Dokumentasi kegiatan, tanggal pelaksanaan, dan bidang pelaksana.</p>" +
    "<strong>Lihat kegiatan →</strong>" +
    "</a>" +
    '<a class="card gateway-card" href="#dokumen">' +
    '<span class="gateway-number">03</span>' +
    "<h3>Dokumen Publik</h3>" +
    "<p>Dokumen perencanaan, kinerja, dan pertanggungjawaban yang dapat diunduh.</p>" +
    "<strong>Lihat dokumen →</strong>" +
    "</a>" +
    '<a class="card gateway-card" href="#pengumuman">' +
    '<span class="gateway-number">04</span>' +
    "<h3>Pengumuman</h3>" +
    "<p>Informasi resmi, jadwal layanan, dan pemberitahuan penting dari dinas.</p>" +
    "<strong>Lihat pengumuman →</strong>" +
    "</a>" +
    "</div>" +
    "</section>"
  );
}

export function showOrganizationChart() {
  dialog(
    '<span class="eyebrow">STRUKTUR ORGANISASI</span>' +
      "<h2>Dinas Sosial P3A Kabupaten Mandailing Natal</h2>" +
      '<div class="organization-preview">' +
      '<img src="/struktur-organisasi.png" alt="Bagan struktur organisasi Dinas Sosial P3A Kabupaten Mandailing Natal">' +
      "</div>",
  );
}
