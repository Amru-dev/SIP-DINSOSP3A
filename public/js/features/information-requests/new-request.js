import { fields } from "../../config/fields.js";
import { api } from "../../core/api.js";
import { $, esc } from "../../core/dom.js";
import { bindForm, choice } from "../../core/forms.js";
import { state } from "../../core/state.js";
import { notify } from "../../core/ui.js";
import { login } from "../auth/views.js";
import { informationRequestDetail } from "./detail.js";

export function informationRequestCTA() {
  if (state.user && state.user.role !== "masyarakat") return "";
  return (
    '<section class="section info-request-cta">' +
    "<div>" +
    '<span class="eyebrow">BUTUH INFORMASI LAIN?</span>' +
    "<h2>Belum menemukan informasi yang dicari?</h2>" +
    "<p>Ajukan permohonan informasi atau dokumen kepada dinas. Jawaban dapat dilihat melalui akun Anda.</p>" +
    "</div>" +
    '<a class="request-link" href="#permohonan-informasi">Ajukan permohonan informasi →</a>' +
    "</section>"
  );
}

export function informationRequestPage() {
  $("#page").innerHTML =
    '<section class="section request-page">' +
    '<a href="#informasi">← Informasi Publik</a>' +
    "<h1>Permohonan Informasi Publik</h1>" +
    '<p>Jelaskan informasi atau dokumen yang Anda butuhkan. Untuk mengajukan bantuan sosial, gunakan <a href="#layanan">menu Layanan</a>.</p>' +
    '<p class="muted">Alur: kirim permohonan → admin meneruskan ke bidang → bidang menyiapkan jawaban dan meminta persetujuan → admin mengirim jawaban kepada Anda.</p>' +
    '<div id="requestEntry">' +
    "</div>" +
    "</section>";
  const entry = $("#requestEntry");
  if (!state.user) {
    entry.innerHTML =
      '<div class="card">' +
      "<h2>Masuk untuk mengirim permohonan</h2>" +
      "<p>Gunakan akun masyarakat agar Anda dapat memantau status dan membaca jawaban.</p>" +
      '<button id="requestLogin">Masuk / Daftar</button>' +
      "</div>";
    $("#requestLogin").onclick = () => login();
    return;
  }
  if (state.user.role !== "masyarakat") {
    entry.innerHTML =
      '<p>Pengiriman permohonan menggunakan akun masyarakat. Admin dapat menangani permohonan melalui dashboard.</p><a href="#dashboard">Buka dashboard</a>';
    return;
  }
  entry.innerHTML =
    '<form class="card" id="newInformationRequest"><p>Pemohon: <strong>' +
    esc(state.user.name) +
    '</strong></p><label>Judul permohonan<input name="subject" maxlength="180" required></label>' +
    choice("field", "Bidang tujuan", {
      sekretariat: "Sekretariat",
      ...fields,
    }) +
    ('<label>Informasi atau dokumen yang dibutuhkan<textarea name="details" maxlength="5000" rows="5" required placeholder="Sebutkan informasi, tahun dokumen, atau rincian lain agar permohonan mudah dipahami.">' +
      "</textarea>" +
      "</label>" +
      '<label>Tujuan penggunaan informasi<textarea name="purpose" maxlength="2000" required>' +
      "</textarea>" +
      "</label>" +
      '<label>Nomor telepon yang dapat dihubungi<input name="phone" type="tel" maxlength="30" required>' +
      "</label>" +
      '<p class="muted">Permohonan ditangani admin serta petugas dan pejabat bidang tujuan. Jawaban resmi akan ditampilkan kepada Anda setelah disetujui dan dikirim admin. Jangan mencantumkan data korban atau dokumen pribadi yang tidak diperlukan.</p>' +
      '<button type="submit">Kirim permohonan</button>' +
      "</form>");
  bindForm("newInformationRequest", async (data) => {
    const result = await api("/information-requests", "POST", data);
    entry.innerHTML =
      '<div class="card"><h2>Permohonan berhasil dikirim</h2><p class="request-number">Nomor: ' +
      esc(result.id) +
      ("</p>" +
        "<p>Pantau tanggapan melalui Dashboard → Permohonan informasi.</p>" +
        '<button type="button" id="openSubmittedRequest">Lihat permohonan</button> <a href="#dashboard">Buka dashboard</a>' +
        "</div>");
    $("#openSubmittedRequest").onclick = () =>
      informationRequestDetail(result.id).catch((e) => notify(e.message));
    notify("Permohonan berhasil dikirim.");
    await informationRequestDetail(result.id);
  });
}
