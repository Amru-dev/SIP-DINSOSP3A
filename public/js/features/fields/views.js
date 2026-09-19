import { fieldProfiles } from "../../config/field-profiles.js";
import { $, esc } from "../../core/dom.js";
import { state } from "../../core/state.js";
import { serviceCards, wirePrograms } from "../programs/views.js";

export function fieldGateway() {
  return (
    '<section class="section field-directory">' +
    '<div class="directory-heading">' +
    '<span class="eyebrow">LAYANAN DINAS SOSIAL P3A</span>' +
    "<h1>Pelayanan yang dekat<br>dengan kebutuhan Anda.</h1>" +
    '<p class="page-intro">Pilih salah satu dari empat bidang. Temukan program, baca persyaratan, dan ajukan layanan yang tersedia.</p>' +
    "</div>" +
    '<div class="field-grid">' +
    Object.entries(fieldProfiles)
      .map(
        ([id, field], index) =>
          '<a class="card field-card field-' +
          id +
          '" href="#bidang/' +
          id +
          '"><div class="field-card-top"><span class="field-number">0' +
          (index + 1) +
          '</span><span class="tag">' +
          state.programs.filter((p) => p.field === id).length +
          " layanan</span></div><h2>" +
          esc(field.name) +
          "</h2><p>" +
          esc(field.intro) +
          '</p><strong>Jelajahi layanan <span aria-hidden="true">↗</span></strong></a>',
      )
      .join("") +
    '</div><p class="source-note">Tugas dan fungsi bidang mengacu pada Perbup Mandailing Natal Nomor 94 Tahun 2022.</p></section>'
  );
}

export function fieldPage(id) {
  const field = Object.hasOwn(fieldProfiles, id) ? fieldProfiles[id] : null;
  if (!field) {
    $("#page").innerHTML =
      '<section class="section"><h1>Bidang tidak ditemukan</h1><a href="#layanan">Kembali ke Layanan</a></section>';
    return;
  }
  const items = state.programs.filter((p) => p.field === id);
  $("#page").innerHTML =
    '<section class="section field-page field-' +
    id +
    '"><a class="back-link" href="#layanan">← Semua bidang layanan</a><div class="field-banner"><span class="eyebrow">KENALI BIDANG KAMI</span><h1>' +
    esc(field.name) +
    "</h1><p>" +
    esc(field.intro) +
    '</p></div><nav class="information-tabs" aria-label="Pilih bidang">' +
    Object.entries(fieldProfiles)
      .map(
        ([key, value]) =>
          '<a href="#bidang/' +
          key +
          '"' +
          (key === id ? ' class="active" aria-current="page"' : "") +
          ">" +
          esc(value.short) +
          "</a>",
      )
      .join("") +
    ("</nav>" +
      '<div class="field-content">' +
      '<div class="field-programs">' +
      '<span class="eyebrow">MULAI DARI SINI</span>' +
      "<h2>Program dan layanan</h2>" +
      '<p class="page-intro">Baca informasi dan persyaratan sebelum mengajukan layanan.</p>' +
      '<div class="cards">') +
    (items.length
      ? serviceCards(items)
      : '<p class="empty">Belum ada program pada bidang ini.</p>') +
    ("</div>" +
      "</div>" +
      '<aside class="card field-duties">' +
      '<span class="eyebrow">PROFIL & KEWENANGAN</span>' +
      "<h2>Tugas Pokok dan Fungsi</h2>" +
      '<p class="source-note">Perbup Mandailing Natal Nomor 94 Tahun 2022 · Pasal ') +
    field.article +
    "</p><h3>Tugas pokok</h3><p>" +
    esc(field.task) +
    '</p><details><summary>Lihat 6 fungsi bidang</summary><ol type="a">' +
    field.functions.map((item) => "<li>" + esc(item) + "</li>").join("") +
    "</ol>" +
    (id === "perempuan"
      ? '<p class="source-note">Catatan sumber: Pasal 9 ayat (2) huruf e pada dokumen menyebut pelayanan kesehatan. Bunyi tersebut dipertahankan sesuai sumber dan perlu dikonfirmasi kepada dinas.</p>'
      : "") +
    '</details><p class="source-note">Disarikan dari dokumen tupoksi yang digunakan dinas.</p></aside></div></section>';
  wirePrograms();
}
