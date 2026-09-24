import { announcementCard } from "../announcements/views.js";
import { announcementFields, placements } from "../../config/fields.js";
import { api } from "../../core/api.js";
import { $, esc } from "../../core/dom.js";
import { formatDate } from "../../core/format.js";
import { notify } from "../../core/ui.js";
import { activityCard } from "../activities/views.js";
import { previewDocument } from "../documents/preview.js";
import { defaultAvatar, employeeCard } from "../employees/cards.js";

export async function publicInformation(kind) {
  const definitions = {
    employees: {
      title: "Data Pegawai",
      eyebrow: "PROFIL SUMBER DAYA MANUSIA",
      intro: "Informasi pegawai Dinas Sosial P3A berdasarkan unit penempatan.",
      search: "Cari nama, NIP, atau jabatan",
      filterLabel: "Semua penempatan",
      filter: placements,
    },
    activities: {
      title: "Kegiatan Dinas",
      eyebrow: "BERITA DAN KEGIATAN",
      intro:
        "Dokumentasi kegiatan yang telah dan sedang dilaksanakan oleh setiap bidang.",
      search: "Cari nama atau deskripsi kegiatan",
      filterLabel: "Semua bidang",
      filter: placements,
    },
    documents: {
      title: "Dokumen Publik",
      eyebrow: "DOKUMEN PERENCANAAN DAN KINERJA",
      intro: "Temukan dan unduh dokumen publik berdasarkan nama dan tahun.",
      search: "Cari nama dokumen",
      filterLabel: "Semua tahun",
      filter: null,
    },
    announcements: {
      title: "Pengumuman",
      eyebrow: "INFORMASI TERBARU DINAS",
      intro:
        "Pengumuman resmi, jadwal layanan, dan informasi penting dari Dinas Sosial P3A.",
      search: "Cari judul atau isi pengumuman",
      filterLabel: "Semua bidang",
      filter: announcementFields,
    },
  };
  const d = definitions[kind],
    info = await api("/public-information"),
    rows = info[kind];
  const years =
    kind === "documents"
      ? [...new Set(rows.map((row) => String(row.year)))].sort((a, b) => b - a)
      : [];
  const filterOptions = d.filter
    ? Object.entries(d.filter)
    : years.map((y) => [y, y]);
  $("#page").innerHTML =
    '<section class="section information-page"><span class="eyebrow">' +
    d.eyebrow +
    "</span><h1>" +
    d.title +
    '</h1><p class="page-intro">' +
    d.intro +
    '</p><nav class="information-tabs" aria-label="Kategori informasi publik"><a href="#pegawai"' +
    (kind === "employees" ? ' class="active"' : "") +
    '>Data Pegawai</a><a href="#kegiatan"' +
    (kind === "activities" ? ' class="active"' : "") +
    '>Kegiatan</a><a href="#dokumen"' +
    (kind === "documents" ? ' class="active"' : "") +
    '>Dokumen Publik</a><a href="#pengumuman"' +
    (kind === "announcements" ? ' class="active"' : "") +
    '>Pengumuman</a></nav><div class="information-tools"><label>Pencarian<input id="publicSearch" type="search" placeholder="' +
    d.search +
    '"></label><label>' +
    d.filterLabel +
    '<select id="publicFilter"><option value="">' +
    d.filterLabel +
    "</option>" +
    filterOptions
      .map(([v, t]) => '<option value="' + esc(v) + '">' + esc(t) + "</option>")
      .join("") +
    '</select></label></div><p id="resultCount" class="muted"></p><div id="contents" class="cards"></div></section>';
  const draw = () => {
    const q = $("#publicSearch").value.trim().toLowerCase(),
      filter = $("#publicFilter").value;
    const shown = rows.filter((row) => {
      const searchable =
        kind === "employees"
          ? [row.name, row.nip, row.position, row.employment_type]
          : kind === "activities"
            ? [row.name, row.description]
            : kind === "announcements"
              ? [row.title, row.body]
              : [row.name, row.year];
      const category =
        kind === "employees"
          ? row.placement
          : kind === "activities" || kind === "announcements"
            ? row.field
            : String(row.year);
      return (
        (!q ||
          searchable.some((value) =>
            String(value).toLowerCase().includes(q),
          )) &&
        (!filter || category === filter)
      );
    });
    $("#resultCount").textContent = shown.length + " informasi ditemukan";
    $("#contents").className =
      "cards " +
      (kind === "employees"
        ? "employee-grid"
        : kind === "activities"
          ? "activity-grid"
          : "");
    $("#contents").innerHTML =
      shown
        .map((row) => {
          if (kind === "employees") return employeeCard(row);
          if (kind === "activities") return activityCard(row);
          if (kind === "announcements") return announcementCard(row);
          return (
            '<article class="card document-card"><span class="document-icon">PDF</span><span class="tag">Tahun ' +
            row.year +
            "</span><h3>" +
            esc(row.name) +
            '</h3><p>Dipublikasikan: <time datetime="' +
            row.publish_date +
            '">' +
            formatDate(row.publish_date) +
            '</time></p><div class="document-actions"><button type="button" class="preview-link" data-preview="' +
            row.file_id +
            '" data-title="' +
            esc(row.name) +
            '">Preview dokumen</button><a class="download-link" href="/api/public-files/' +
            row.file_id +
            '?download=1">Unduh PDF</a></div></article>'
          );
        })
        .join("") ||
      '<p class="empty">Tidak ada informasi yang sesuai dengan pencarian.</p>';
    document.querySelectorAll(".employee-avatar").forEach(
      (img) =>
        (img.onerror = () => {
          img.onerror = null;
          img.src = defaultAvatar;
        }),
    );
    if (kind === "documents")
      document
        .querySelectorAll("[data-preview]")
        .forEach(
          (button) =>
            (button.onclick = () =>
              previewDocument(
                button.dataset.preview,
                button.dataset.title,
              ).catch((error) => notify(error.message))),
        );
  };
  $("#publicSearch").oninput = draw;
  $("#publicFilter").onchange = draw;
  draw();
}
