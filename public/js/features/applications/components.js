import { esc, label } from "../../core/dom.js";
import { state } from "../../core/state.js";

export function documentBadge(a) {
  const d = a.documents;
  if (!d) return "";
  return (
    '<span class="document-completeness ' +
    (d.complete ? "complete" : "incomplete") +
    '">' +
    (d.complete
      ? "✓ Dokumen lengkap"
      : d.required
        ? "Dokumen " + d.uploaded + "/" + d.required + " — belum lengkap"
        : "Persyaratan belum ditetapkan") +
    "</span>"
  );
}

export function aidDocumentChecklist(a, p) {
  const requirements = p?.requirements || [],
    missing = requirements.filter(
      (r) => !a.files.some((f) => f.requirement === r),
    ),
    complete = requirements.length > 0 && !missing.length;
  const editable =
    state.user?.id === a.owner_id && ["draf", "perbaikan"].includes(a.status);
  return (
    '<section class="aid-checklist ' +
    (complete ? "complete" : "incomplete") +
    '"><h3>' +
    (complete
      ? "✓ Dokumen persyaratan lengkap"
      : requirements.length
        ? "Masih ada " + missing.length + " dokumen yang belum diunggah"
        : "Persyaratan belum ditetapkan") +
    "</h3><p>" +
    (requirements.length
      ? requirements.length -
        missing.length +
        " dari " +
        requirements.length +
        " persyaratan sudah diunggah."
      : "Hubungi bidang terkait untuk informasi persyaratan.") +
    "</p>" +
    (complete
      ? '<p class="muted">Lengkap berarti seluruh persyaratan sudah diunggah; keabsahan berkas tetap diperiksa petugas.</p>'
      : editable && requirements.length
        ? "<p>Lengkapi persyaratan berikut sebelum mengirim pengajuan.</p>"
        : "") +
    "<ul>" +
    requirements
      .map((r) => {
        const absent = missing.includes(r);
        return (
          '<li><span class="checklist-state">' +
          (absent ? "Belum diunggah" : "✓ Sudah diunggah") +
          "</span><span>" +
          esc(r) +
          "</span>" +
          (absent && editable
            ? '<button class="secondary" type="button" data-missing-requirement="' +
              esc(r) +
              '">Unggah berkas</button>'
            : "") +
          "</li>"
        );
      })
      .join("") +
    "</ul></section>"
  );
}

export const aidStatusNames = {
  draf: "Draf pengajuan",
  diajukan: "Pengajuan dikirim",
  diverifikasi: "Sedang diverifikasi",
  perbaikan: "Perlu perbaikan",
  menunggu_kabid: "Menunggu keputusan kepala bidang",
  disetujui: "Pengajuan disetujui",
  ditolak: "Pengajuan ditolak",
  direalisasikan: "Bantuan direalisasikan",
  ditangani: "Sedang ditangani",
  selesai: "Selesai",
  unggah: "Dokumen diunggah",
  ganti_berkas: "Dokumen diganti",
};

export function aidHistory(history) {
  const sorted = history
    .map((entry, index) => ({ ...entry, index }))
    .sort((a, b) => Number(b.created) - Number(a.created) || b.index - a.index);
  const uploads = sorted.filter((h) =>
      ["unggah", "ganti_berkas"].includes(h.action),
    ),
    events = sorted.filter(
      (h) => !["unggah", "ganti_berkas"].includes(h.action),
    );
  const timeline = (items, latest = false) =>
    '<ol class="aid-timeline">' +
    items
      .map((h, i) => {
        const date = new Date(Number(h.created)),
          valid = !Number.isNaN(date.valueOf());
        const tone = ["perbaikan", "ditolak"].includes(h.action)
          ? "attention"
          : ["disetujui", "direalisasikan", "selesai"].includes(h.action)
            ? "success"
            : "neutral";
        return (
          '<li class="aid-event aid-event-' +
          tone +
          '"><div class="aid-event-heading"><h4>' +
          esc(aidStatusNames[h.action] || label(h.action)) +
          "</h4>" +
          (latest && i === 0 ? '<span class="aid-latest">Terbaru</span>' : "") +
          '</div><p class="aid-event-meta">' +
          (valid
            ? '<time datetime="' +
              date.toISOString() +
              '">' +
              new Intl.DateTimeFormat("id-ID", {
                day: "numeric",
                month: "short",
                year: "numeric",
                hour: "2-digit",
                minute: "2-digit",
                timeZone: "Asia/Jakarta",
              }).format(date) +
              " WIB</time>"
            : "Waktu tidak tersedia") +
          "<span>Oleh " +
          esc(h.actor || "Petugas") +
          "</span></p>" +
          (h.note ? '<p class="aid-event-note">' + esc(h.note) + "</p>" : "") +
          "</li>"
        );
      })
      .join("") +
    "</ol>";
  return (
    '<section class="aid-history" aria-labelledby="aidHistoryTitle">' +
    '<div class="aid-section-heading">' +
    "<div>" +
    '<h3 id="aidHistoryTitle">Perjalanan pengajuan</h3>' +
    "<p>Perubahan status terbaru ditampilkan paling atas.</p>" +
    "</div>" +
    '<span class="aid-count">' +
    events.length +
    " aktivitas</span></div>" +
    (events.length
      ? timeline(events.slice(0, 5), true)
      : '<p class="empty">Belum ada perubahan status yang tercatat.</p>') +
    (events.length > 5
      ? '<details class="aid-older"><summary>Lihat ' +
        (events.length - 5) +
        " aktivitas sebelumnya</summary>" +
        timeline(events.slice(5)) +
        "</details>"
      : "") +
    '<details class="aid-upload-history"><summary>Riwayat dokumen <span>' +
    uploads.length +
    " aktivitas</span></summary>" +
    (uploads.length
      ? timeline(uploads)
      : '<p class="muted">Belum ada aktivitas unggah dokumen.</p>') +
    "</details></section>"
  );
}

export function aidSummary(a) {
  const descriptions = {
    draf: "Lengkapi data dan dokumen, lalu kirim pengajuan ke dinas.",
    diajukan: "Pengajuan sudah dikirim dan menunggu pemeriksaan petugas.",
    diverifikasi: "Petugas sedang memeriksa kelengkapan berkas pengajuan.",
    perbaikan:
      "Periksa catatan petugas di bawah. Perbaiki data atau dokumen, lalu kirim kembali pengajuan.",
    menunggu_kabid:
      "Berkas diteruskan kepada kepala bidang untuk penetapan hasil.",
    disetujui:
      "Pengajuan disetujui. Pantau tindak lanjut penyaluran bantuan melalui status pengajuan.",
    ditolak: "Pengajuan ditolak. Baca alasan keputusan pada riwayat di bawah.",
    direalisasikan: "Petugas telah mencatat realisasi bantuan.",
  };
  const latestNote = [...a.history]
    .reverse()
    .find((h) => h.action === a.status && h.note);
  return (
    '<div class="aid-summary"><span class="eyebrow">STATUS PENGAJUAN</span><h3>' +
    esc(aidStatusNames[a.status] || label(a.status)) +
    "</h3><p>" +
    esc(
      descriptions[a.status] ||
        "Lihat perkembangan penanganan pada riwayat di bawah.",
    ) +
    "</p>" +
    (["perbaikan", "ditolak"].includes(a.status) && latestNote
      ? '<div class="aid-action-note"><strong>Catatan petugas</strong><p>' +
        esc(latestNote.note) +
        "</p></div>"
      : "") +
    "</div>"
  );
}
