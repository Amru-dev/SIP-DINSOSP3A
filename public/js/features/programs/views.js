import { fields } from "../../config/fields.js";
import { api } from "../../core/api.js";
import { $, esc } from "../../core/dom.js";
import { bindForm, input } from "../../core/forms.js";
import { state } from "../../core/state.js";
import { dialog, notify } from "../../core/ui.js";
import { detail } from "../applications/detail.js";
import { login } from "../auth/views.js";

export function serviceCards(items = state.programs) {
  return items
    .map(
      (p) =>
        '<article class="card"><span class="tag">' +
        esc(fields[p.field]) +
        "</span><h3>" +
        esc(p.name) +
        "</h3><p>" +
        esc(p.description) +
        '</p><p class="muted">' +
        (p.is_open ? "Pengajuan dibuka" : "Belum menerima pengajuan") +
        '</p><button data-program="' +
        p.id +
        '" class="secondary">Informasi layanan →</button></article>',
    )
    .join("");
}

export function wirePrograms() {
  document
    .querySelectorAll("[data-program]")
    .forEach((b) => (b.onclick = () => showProgram(b.dataset.program)));
}

export function serviceGuide(p) {
  const isReport = p.kind === "laporan";
  const steps = [
    [
      "Siapkan persyaratan",
      "Baca persyaratan di bawah dan siapkan dokumen pendukung.",
    ],
    [
      "Isi dan kirim pengajuan",
      "Masuk dengan akun masyarakat, isi formulir, unggah berkas, lalu kirim pengajuan. Menyimpan draf belum berarti mengirim.",
    ],
    [
      "Pemeriksaan berkas",
      "Petugas memeriksa pengajuan. Jika berstatus perbaikan, baca catatan petugas, perbaiki data atau berkas, lalu kirim kembali.",
    ],
    [
      "Keputusan kepala bidang",
      "Kepala bidang meninjau dan menetapkan hasil pengajuan. Pengajuan tidak otomatis menjadikan pemohon penerima bantuan.",
    ],
    [
      "Pantau tindak lanjut",
      "Buka Dashboard untuk melihat status, catatan petugas, dan tindak lanjut pengajuan.",
    ],
  ];
  return (
    '<div class="service-guide"><span class="eyebrow">PANDUAN LAYANAN</span><h2>' +
    esc(p.name) +
    '</h2><div class="guide-status"><span class="tag">' +
    esc(fields[p.field]) +
    '</span><span class="tag">' +
    (!isReport && p.is_open ? "Pengajuan dibuka" : "Belum menerima pengajuan") +
    '</span></div><p class="guide-description">' +
    esc(p.description) +
    '</p><section class="guide-section"><h3>Persyaratan yang perlu disiapkan</h3>' +
    (p.requirements.length
      ? '<ol class="guide-requirements">' +
        p.requirements.map((x) => "<li>" + esc(x) + "</li>").join("") +
        "</ol>"
      : '<p class="empty">Persyaratan resmi belum ditetapkan oleh dinas.</p>') +
    (!isReport && p.requirements.length
      ? '<p class="muted">Berkas unggahan: PDF, JPG, atau PNG; maksimal 5 MB per file.</p>'
      : "") +
    "</section>" +
    (isReport
      ? '<p class="warning">Kanal ini belum menerima laporan. Jangan masukkan identitas korban di sini. Hubungi kontak dinas untuk informasi layanan. Dalam kondisi darurat, hubungi layanan darurat resmi setempat.</p>'
      : '<section class="guide-section">' +
        "<h3>Alur pengajuan melalui website</h3>" +
        '<p class="muted">Alur berikut dapat digunakan setelah pengajuan program dibuka.</p>' +
        '<ol class="guide-steps">' +
        steps
          .map(
            ([title, body]) =>
              "<li><strong>" + title + "</strong><p>" + body + "</p></li>",
          )
          .join("") +
        '</ol></section><div class="guide-action">' +
        (p.is_open
          ? '<p>Sudah memahami persyaratan dan alurnya?</p><button id="apply" type="button">Mulai pengajuan</button>'
          : '<p class="warning">Pengajuan belum dibuka oleh dinas. Hubungi kontak dinas untuk informasi lebih lanjut.</p>') +
        "</div>") +
    "</div>"
  );
}

export function showProgram(id) {
  const p = state.programs.find((x) => x.id === id);
  if (!p) return notify("Layanan tidak ditemukan.");
  dialog(serviceGuide(p));
  $("#dialog").scrollTop = 0;
  if (state.user && state.user.role !== "masyarakat")
    $("#dialog-body .guide-action")?.remove();
  if ($("#apply"))
    $("#apply").onclick = () => {
      if (!state.user) return login();
      if (state.user.role !== "masyarakat")
        return notify("Gunakan akun masyarakat untuk mengajukan bantuan.");
      dialog(
        "<h2>" +
          esc(p.name) +
          '</h2><form id="applyForm">' +
          input("phone", "Nomor telepon", "tel") +
          ('<label>Alamat<textarea name="address" required maxlength="500">' +
            "</textarea>" +
            "</label>" +
            '<label>Keterangan tambahan<textarea name="note" maxlength="2000">' +
            "</textarea>" +
            "</label>" +
            '<button type="submit">Simpan draf & unggah dokumen</button>' +
            "</form>"),
      );
      bindForm("applyForm", async (data) => {
        const result = await api("/applications", "POST", {
          ...data,
          program_id: p.id,
        });
        await detail(result.id);
      });
    };
}
