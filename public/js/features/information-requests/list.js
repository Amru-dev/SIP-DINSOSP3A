import { informationStatusNames } from "../../config/information-statuses.js";
import { api } from "../../core/api.js";
import { $, esc } from "../../core/dom.js";
import { state } from "../../core/state.js";
import { notify } from "../../core/ui.js";
import { informationRequestDetail } from "./detail.js";

export async function informationRequestList(panel) {
  const admin = state.user.role !== "masyarakat";
  panel.innerHTML = '<p role="status">Memuat permohonan informasi…</p>';
  const rows = await api("/information-requests");
  if (
    !panel.isConnected ||
    (state.user.role === "admin"
      ? state.dashboardSection !== "requests"
      : panel.dataset.workspace !== "information")
  )
    return;
  panel.innerHTML =
    "<h2>" +
    (admin ? "Permohonan Informasi Publik" : "Permohonan informasi saya") +
    "</h2>" +
    (!admin
      ? '<p><a href="#permohonan-informasi">+ Buat permohonan baru</a></p>'
      : "") +
    ('<div class="information-tools">' +
      '<label>Cari judul atau nomor permohonan<input type="search" id="requestSearch">' +
      "</label>" +
      '<label>Status<select id="requestStatus">' +
      '<option value="">Semua status</option>' +
      '<option value="diajukan">Diajukan</option>' +
      '<option value="diproses">Diproses</option>' +
      '<option value="diteruskan">Diteruskan ke bidang</option>' +
      '<option value="menunggu_persetujuan">Menunggu persetujuan</option>' +
      '<option value="perbaikan_bidang">Perbaikan jawaban</option>' +
      '<option value="disetujui_bidang">Siap dikirim admin</option>' +
      '<option value="selesai">Selesai</option>' +
      "</select>" +
      "</label>" +
      "</div>" +
      '<button type="button" class="secondary" id="requestRefresh">Muat ulang</button>' +
      '<div id="requestRows">' +
      "</div>");
  const draw = () => {
    const query = $("#requestSearch").value.toLowerCase(),
      status = $("#requestStatus").value;
    const shown = rows.filter(
      (r) =>
        (!status || r.status === status) &&
        [r.subject, r.id, r.applicant_name].some((x) =>
          String(x).toLowerCase().includes(query),
        ),
    );
    $("#requestRows").innerHTML = shown.length
      ? '<div class="table-wrap"><table><thead><tr><th>Permohonan</th>' +
        (admin ? "<th>Pemohon</th>" : "") +
        "<th>Status</th><th>Aksi</th></tr></thead><tbody>" +
        shown
          .map(
            (r) =>
              "<tr><td>" +
              esc(r.subject) +
              '<small class="request-date">' +
              new Date(r.created).toLocaleDateString("id-ID") +
              "</small></td>" +
              (admin ? "<td>" + esc(r.applicant_name) + "</td>" : "") +
              '<td><span class="tag">' +
              esc(informationStatusNames[r.status] || r.status) +
              '</span></td><td><button data-request-id="' +
              esc(r.id) +
              '">Buka</button></td></tr>',
          )
          .join("") +
        "</tbody></table></div>"
      : '<p class="empty">Tidak ada permohonan yang sesuai.</p>';
    panel
      .querySelectorAll("[data-request-id]")
      .forEach(
        (b) =>
          (b.onclick = () =>
            informationRequestDetail(b.dataset.requestId).catch((e) =>
              notify(e.message),
            )),
      );
  };
  if (state.user.role === "masyarakat")
    $("#requestStatus")
      .querySelectorAll("option")
      .forEach((o) => {
        if (!["", "diajukan", "diproses", "selesai"].includes(o.value))
          o.remove();
      });
  else $("#requestStatus").querySelector('option[value="diproses"]')?.remove();
  $("#requestSearch").oninput = draw;
  $("#requestStatus").onchange = draw;
  $("#requestRefresh").onclick = () =>
    informationRequestList(panel).catch((e) => notify(e.message));
  draw();
}
